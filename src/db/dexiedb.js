import Dexie from 'dexie';
// Remove after full implementation of database
import { mockItems, mockCategories } from '../data/mockdata';

class AppDatabase extends Dexie {
  constructor() {
    super('inventoryDb');

    this.version(1).stores({
      // Inventory tables
      items: '++id, name, sku, category, quantity, price, image, createdAt, updatedAt',
      sales: '++id, itemId, quantity, price, date',
      cashFlow: '++id, paymentMethod, type, amount, date, description',

      // Contacts tables
      categories: '++id, name, value, createdAt',
      contacts: '++id, categoryId, name, email, phone, avatar, [categoryId+name]',

      // Sync queue table
      syncQueue: '++id, type, collection, data, docId, timestamp'
    });

    this.items.hook('creating', (primKey, obj) => {
      obj.createdAt = new Date().toISOString();
      obj.updatedAt = new Date().toISOString();
    });

    this.items.hook('updating', (modifications, primKey, obj) => {
      modifications.updatedAt = new Date().toISOString();
    });
  }

  // Inventory Methods--------------------------------------------------
  async getAllItems() {
    return await this.items.toArray();
  }

  async addItem(item) {
    return await this.items.add(item);
  }

  async updateItem(id, changes) {
    return await this.items.update(id, changes);
  }

  async deleteItem(id) {
    return await this.items.delete(id);
  }

  async addSale(sale) {
    return await this.sales.add({
      ...sale,
      date: new Date().toISOString()
    });
  }

  async addCashFlowTransaction(transaction) {
    return await this.cashFlow.add({
      ...transaction,
      date: new Date().toISOString()
    });
  }
//--------------------------------------------------------------------
  // Contacts Methods
  async getAllCategories() {
    return await this.categories.toArray();
  }

  async addCategory(category) {
    return await this.categories.add(category);
  }

  async updateCategory(id, changes) {
    return await this.categories.update(id, changes);
  }

  async deleteCategory(id) {
    // Delete all contacts in this category first
    await this.contacts.where('categoryId').equals(id).delete();
    return await this.categories.delete(id);
  }

  async getContactsByCategory(categoryId) {
    return await this.contacts.where('categoryId').equals(categoryId).toArray();
  }

  async getAllContacts() {
    return await this.contacts.toArray();
  }

  async addContact(contact) {
    return await this.contacts.add(contact);
  }

  async updateContact(id, changes) {
    return await this.contacts.update(id, changes);
  }

  async deleteContact(id) {
    return await this.contacts.delete(id);
  }
  //--------------------------------------------------------------------
  // Sync Methods
  async syncWithFirestore(firestoreData, table) {
    // Begin transaction
    return await this.transaction('rw', this[table], async () => {
      // Clear existing data
      await this[table].clear();

      // Add new data
      await this[table].bulkAdd(firestoreData);
    });
  }

  async syncWithFirestoreSimple(items, tableName) {
    const table = this.table(tableName);
    await table.clear();
    await table.bulkAdd(items);
  }

  //--------------------------------------------------------------------

  // Utility Methods
  // Remove after full implementation of database
  async clearAllTables() {
    await this.transaction('rw',
      this.items,
      this.sales,
      this.cashFlow,
      this.categories,
      this.contacts,
      this.syncQueue,
      async () => {
        await Promise.all([
          this.items.clear(),
          this.sales.clear(),
          this.cashFlow.clear(),
          this.categories.clear(),
          this.contacts.clear(),
          this.syncQueue.clear()
        ])
    });
  }

  // Remove after full implementation of database
  async repopulateWithMockData() {
    await this.transaction('rw',
      this.items,
      this.categories,
      this.contacts,
      async () => {
        // Clear existing data
        await this.clearAllTables()

        // Add mock items
        for (const item of mockItems) {
          const { id, ...itemData } = item // Remove the id to let Dexie auto-generate it
          await this.items.add(itemData)
        }

        // Add mock categories and contacts
        for (const category of mockCategories) {
          const { contacts, ...categoryData } = category
          const categoryId = await this.categories.add(categoryData)

          // Add contacts for this category
          for (const contact of contacts) {
            const { id, ...contactData } = contact // Remove the id to let Dexie auto-generate it
            await this.contacts.add({
              ...contactData,
              categoryId
            })
          }
        }
    })
  }
}

// Create and export a single instance
export const db = new AppDatabase();
