/**
 * @fileoverview The local database instance.
 * All functions and methods are managed and implemented in this file.
 * **/

import Dexie from 'dexie';
import { useInventoryStore } from 'src/stores/inventoryStore';


export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}
export class DatabaseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DatabaseError';
  }
}
/**
 * @class AppDatabase
 * @description The local database instance.
 * Manages all functions and methods for the database.
 * @extends Dexie
*/
class AppDatabase extends Dexie {
  /**
   * @constructor
   * @description Creates a new instance of the AppDatabase class.
  */
  constructor() {
    super('inventoryDb'); // Name of the database

    this.version(2).stores({
      // Inventory tables
      categories: '++id, name, description, createdAt, updatedAt, syncStatus, firebaseId',
      items: '++id, name, sku, categoryId, category, quantity, price, image, createdAt, updatedAt, syncStatus, firebaseId, [categoryId+name]',

      // Sales tables
      sales: '++id, total, paymentMethod, date, items, syncStatus, firebaseId',

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
      // Ensure category information is preserved
      if (obj.categoryId && !obj.category) {
        const store = useInventoryStore();
        obj.category = store.getCategoryName(obj.categoryId);
      }
    });

    this.items.hook('updating', (modifications, primKey, obj) => {
      modifications.updatedAt = new Date().toISOString();
      // Ensure category information is preserved during updates
      if (modifications.categoryId && !modifications.category) {
        const store = useInventoryStore();
        modifications.category = store.getCategoryName(modifications.categoryId);
      }
    });

    this.categories.hook('creating', (primKey, obj) => {
      obj.createdAt = new Date().toISOString();
      obj.updatedAt = new Date().toISOString();
    });

    this.categories.hook('updating', (modifications, primKey, obj) => {
      modifications.updatedAt = new Date().toISOString();
    });
  }

  // Inventory Methods--------------------------------------------------
  /**
   * @async
   * @method getAllItems
   * @returns {Promise<Array>}
   * @description Returns an array of all items in the database.
  */
  async getAllItems() {
    return await this.items.toArray();
  }
  /**
   * @async
   * @method createItem
   * @param {Object} item
   * @returns {Promise<Object>}
   * @description Creates a new item in the database with validation
   * @throws {Error} If validation fails
  */
  async createItem(item) {
    // Validate required fields
    if (!item.name?.trim())
      throw new ValidationError('Item name is required');
    if (!item.categoryId)
      throw new ValidationError('Category is required');
    if (typeof item.price !== 'number' || item.price < 0)
      throw new ValidationError('Valid price is required');

    // Sanitize and prepare item data
    const newItem = {
      ...item,
      name: item.name.trim(),
      sku: item.sku?.trim() || null,
      quantity: Math.max(0, parseInt(item.quantity) || 0),
      price: parseFloat(item.price),
      image: item.image?.trim() || null,
      syncStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    try {
      // Check for duplicate SKU if provided
      if (newItem.sku) {
        const existingItem = await this.items.where('sku').equals(newItem.sku).first()
        if (existingItem)
          throw new ValidationError(`Item with SKU ${newItem.sku} already exists`);
      }

      return await this.items.add(newItem)
    } catch (error) {
      console.error('Database error creating item:', error)
      throw DatabaseError('Failed to create item')
    }
  }

  /**
   * @async
   * @method updateExistingItem
   * @param {number} id
   * @param {Object} changes
   * @returns {Promise<Object>}
   * @description Updates an existing item in the database with validation
   * @throws {Error} If validation fails or item not found
  */
  async updateExistingItem(id, changes) {
    // Check if item exists
    const existingItem = await this.items.get(id);
    if (!existingItem) {
      throw new Error('Item not found');
    }

    // Validate changes
    if (changes.name !== undefined && !changes.name?.trim()) {
      throw new Error('Item name cannot be empty');
    }
    if (changes.price !== undefined && (typeof changes.price !== 'number' || changes.price < 0)) {
      throw new Error('Price must be a non-negative number');
    }
    if (changes.quantity !== undefined && (typeof changes.quantity !== 'number' || changes.quantity < 0)) {
      throw new Error('Quantity must be a non-negative number');
    }

    try {
      // Check for duplicate SKU if SKU is being changed
      if (changes.sku && changes.sku !== existingItem.sku) {
        const duplicateSku = await this.items.where('sku').equals(changes.sku.trim()).first();
        if (duplicateSku) {
          throw new Error(`Item with SKU ${changes.sku} already exists`);
        }
      }

      // Sanitize and prepare update data
      const updatedChanges = {
        ...changes,
        name: changes.name?.trim() || existingItem.name,
        sku: changes.sku?.trim() || existingItem.sku,
        quantity: changes.quantity !== undefined ? Math.max(0, parseInt(changes.quantity)) : existingItem.quantity,
        price: changes.price !== undefined ? parseFloat(changes.price) : existingItem.price,
        image: changes.image?.trim() || existingItem.image,
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending'
      };

      return await this.items.update(id, updatedChanges);
    } catch (error) {
      console.error('Database error updating item:', error);
      throw error;
    }
  }
  /**
   * @async
   * @method addItem
   * @param {Object} item
   * @returns {Promise<Object>}
   * @description Adds an item to the database.
  */
  async addItem(item) {
    return await this.items.add(item);
  }
  /**
   * @async
   * @method updateItem
   * @param {*} id
   * @param {*} changes
   * @returns {Promise<Object>}
   * @description Updates an item in the database.
  */
  async updateItem(id, changes) {
    return await this.items.update(id, changes);
  }
  /**
   * @async
   * @method deleteItem
   * @param {*} id
   * @returns {Promise<Object>}
   * @description Deletes an item from the database.
  */
  async deleteItem(id) {
    return await this.items.delete(id);
  }
  /**
   * @async
   * @method addSale
   * @param {Object} sale
   * @returns {Promise<Object>}
   * @description Adds a sale to the database.
  */
  async addSale(sale) {
    return await this.sales.add({
      ...sale,
      date: new Date().toISOString()
    });
  }
  /**
   * @async
   * @method addCashFlowTransaction
   * @param {Object} transaction
   * @returns {Promise<Object>}
   * @description Adds a cash flow transaction to the database.
  */
  async addCashFlowTransaction(transaction) {
    return await this.cashFlow.add({
      ...transaction,
      date: new Date().toISOString()
    });
  }
//--------------------------------------------------------------------
  // Contacts Methods
  /**
   * @async
   * @method getAllContactCategories
   * @returns {Promise<Array>}
   * @description Returns an array of all contact categories in the database.
  */
  async getAllContactCategories() {
    return await this.contactCategories.toArray();
  }
  /**
   * @async
   * @method addContactCategory
   * @param {Object} contactCategory
   * @returns {Promise<Object>}
   * @description Adds a contact category to the database.
  */
  async addContactCategory(contactCategory) {
    return await this.contactCategories.add(contactCategory);
  }
  /**
   * @async
   * @method updateContactCategory
   * @param {*} contactCategoryId
   * @param {*} changes
   * @returns {Promise<Object>}
   * @description Updates a contact category in the database.
  */
  async updateContactCategory(contactCategoryId, changes) {
    return await this.contactCategories.update(contactCategoryId, changes);
  }
  /**
   * @async
   * @method deleteContactCategory
   * @param {*} contactCategoryId
   * @returns {Promise<Object>}
   * @description Deletes a contact category from the database.
  */
  async deleteContactCategory(contactCategoryId) {
    // Delete all contacts in this contact category first
    await this.contactsList.where('categoryId').equals(contactCategoryId).delete();
    return await this.contactCategories.delete(contactCategoryId);
  }
  /**
   * @async
   * @method getContactsByCategory
   * @param {*} contactCategoryId
   * @returns {Promise<Array>}
   * @description Returns an array of contacts in a specific category.
  */
  async getContactsByCategory(contactCategoryId) {
    return await this.contactsList.where('categoryId').equals(contactCategoryId).toArray();
  }
  /**
   * @async
   * @method getAllContacts
   * @returns {Promise<Array>}
   * @description Returns an array of all contacts in the database.
  */
  async getAllContacts() {
    return await this.contactsList.toArray();
  }
  /**
   * @async
   * @method addContact
   * @param {Object} contactPerson
   * @returns {Promise<Object>}
   * @description Adds a contact to the database.
  */
  async addContact(contactPerson) {
    if(!contactPerson.name?.trim()) throw new ValidationError('Contact name is required')
    if(!contactPerson.categoryId) throw new ValidationError('Contact category is required')

    const existingContact = await this.contactsList
      .where('[categoryId+name]')
      .equals([contactPerson.categoryId, contactPerson.name.trim().toLowerCase()])
      .or('email')
      .equals(contactPerson.email?.trim().toLowerCase())
      .first()

    if (existingContact) {
      throw new ValidationError(
        existingContact.name.toLowerCase() === contactPerson.name.trim().toLowerCase()
          ? 'A contact with this name already exists in the category'
          : 'A contact with this email already exists'
      )
    }

    const newContact = {
      ...contactPerson,
      name: contactPerson.name.trim(),
      email: contactPerson.email?.trim().toLowerCase() || null,
      phone: contactPerson.phone?.trim() || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending'
    }

    try {
      return await this.contactsList.add(newContact)
    } catch (error) {
      console.error('Database error adding contact:', error)
      throw new DatabaseError('Failed to add contact')
    }
  }
  /**
   * @async
   * @method updateContact
   * @param {*} contactId
   * @param {*} changes
   * @returns {Promise<Object>}
   * @description Updates a contact in the database.
  */
  async updateContact(contactId, changes) {
    return await this.contactsList.update(contactId, changes);
  }
  /**
   * @async
   * @method deleteContact
   * @param {*} contactId
   * @returns {Promise<Object>}
   * @description Deletes a contact from the database.
  */
  async deleteContact(contactId) {
    return await this.contactsList.delete(contactId);
  }
  //--------------------------------------------------------------------
  // Sync Methods
  /**
   * @async
   * @method syncWithFirestore
   * @param {Array} firestoreData
   * @param {String} table
   * @returns {Promise<Object>}
   * @description Syncs data from a Firestore table to a Dexie table.
  */
  async syncWithFirestore(firestoreData, table) {
    // Begin transaction
    return await this.transaction('rw', this[table], async () => {
      // Clear existing data
      await this[table].clear();

      // Add new data
      await this[table].bulkAdd(firestoreData);
    });
  }
  /**
   * @async
   * @method syncWithFirestoreSimple
   * @param {Array} items
   * @param {String} tableName
   * @returns {Promise<Object>}
   * @description Syncs data from an array to a Dexie table.
  */
  async syncWithFirestoreSimple(items, tableName) {
    const table = this.table(tableName);
    await table.clear();
    await table.bulkAdd(items);
  }

  //--------------------------------------------------------------------
  /**
   * @async
   * @method clearAllTables
   * @returns {Promise<Object>}
   * @description Clears all tables in the database.
  */
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
export const db = new AppDatabase()
