import Dexie from 'dexie';

class AppDatabase extends Dexie {
  constructor() {
    super('inventoryDb');

    this.version(1).stores({
      // Inventory tables
      items: '++id, name, sku, category, quantity, price, image, createdAt, updatedAt, syncStatus, firebaseId',
      sales: '++id, itemId, quantity, price, date, syncStatus, firebaseId',
      cashFlow: '++id, paymentMethod, type, amount, date, description, syncStatus, firebaseId',

      // Contacts tables
      contactCategories: '++id, name, value, createdAt, syncStatus, firebaseId',
      contactsList: '++id, categoryId, name, email, phone, avatar, [categoryId+name], syncStatus, firebaseId',

      // Sync queue table
      syncQueue: '++id, type, collection, data, docId, timestamp, attempts, lastAttempt, status, error',
      syncLocks: 'lockId, timestamp, owner'
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
  async getAllContactCategories() {
    return await this.contactCategories.toArray();
  }

  async addContactCategory(contactCategory) {
    return await this.contactCategories.add(contactCategory);
  }

  async updateContactCategory(contactCategoryId, changes) {
    return await this.contactCategories.update(contactCategoryId, changes);
  }

  async deleteContactCategory(contactCategoryId) {
    // Delete all contacts in this contact category first
    await this.contactsList.where('categoryId').equals(contactCategoryId).delete();
    return await this.contactCategories.delete(contactCategoryId);
  }

  async getContactsByCategory(contactCategoryId) {
    return await this.contactsList.where('categoryId').equals(contactCategoryId).toArray();
  }

  async getAllContacts() {
    return await this.contactsList.toArray();
  }

  async addContact(contactPerson) {
    return await this.contactsList.add(contactPerson);
  }

  async updateContact(contactId, changes) {
    return await this.contactsList.update(contactId, changes);
  }

  async deleteContact(contactId) {
    return await this.contactsList.delete(contactId);
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
  async clearAllTables() {
    await this.transaction('rw',
      this.items,
      this.sales,
      this.cashFlow,
      this.contactCategories,
      this.contactsList,
      this.syncQueue,
      this.syncLocks,
      async () => {
        await Promise.all([
          this.items.clear(),
          this.sales.clear(),
          this.cashFlow.clear(),
          this.contactCategories.clear(),
          this.contactsList.clear(),
          this.syncQueue.clear(),
          this.syncLocks.clear()
        ])
    });
  }

}

// Create and export a single instance
export const db = new AppDatabase();
