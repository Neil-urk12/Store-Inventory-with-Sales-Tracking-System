/**
 * @fileoverview Local database implementation using Dexie.js.
 * Provides offline-first storage with:
 * - Schema versioning
 * - CRUD operations
 * - Data validation
 * - Sync status tracking
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} code - Error code
 * @property {string} message - Error message
 * @property {string} field - Field that failed validation
 */

/**
 * @typedef {Object} DatabaseError
 * @property {string} code - Error code
 * @property {string} message - Error message
 * @property {Error} [originalError] - Original error object
 */

import Dexie from 'dexie';
import { useInventoryStore } from 'src/stores/inventoryStore';
import { formatDate } from '../utils/dateUtils';


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
    super('inventoryDb')

    this.version(1).stores({
      items: '++id, name, sku, categoryId, quantity, price, firebaseId, syncStatus',
      categories: '++id, name, firebaseId, syncStatus',
      sales: '++id, date, total, paymentMethod, firebaseId, syncStatus',
      cashFlow: '++id, date, type, amount, paymentMethod, description, firebaseId, syncStatus',
      contacts: '++id, name, email, phone, categoryId, firebaseId, syncStatus',
      contactCategories: '++id, name, firebaseId, syncStatus'
    })

    this.items.hook('creating', (primKey, obj) => {
      obj.createdAt = formatDate(new Date(), 'YYYY-MM-DD')
      obj.updatedAt = formatDate(new Date(), 'YYYY-MM-DD')
      obj.syncStatus = obj.syncStatus || 'pending'

      // Ensure category information is preserved
      if (obj.categoryId && !obj.category) {
        const store = useInventoryStore()
        obj.category = store.getCategoryName(obj.categoryId)
      }
    })

    this.categories.hook('creating', (primKey, obj) => {
      obj.createdAt = formatDate(new Date(), 'YYYY-MM-DD')
      obj.updatedAt = formatDate(new Date(), 'YYYY-MM-DD')
      obj.syncStatus = obj.syncStatus || 'pending'
    })

    this.categories.hook('updating', (modifications, primKey, obj) => {
      modifications.updatedAt = formatDate(new Date(), 'YYYY-MM-DD')
      modifications.syncStatus = modifications.syncStatus || 'pending'
    })
  }

  // Add helper method for handling temp IDs
  async updateFirebaseId(collection, tempId, firebaseId) {
    try {
      await this[collection].where('tempId').equals(tempId).modify(item => {
        item.firebaseId = firebaseId;
        item.syncStatus = 'synced';
        item.tempId = null;
      });
    } catch (error) {
      console.error(`Error updating Firebase ID for ${collection}:`, error);
      throw error;
    }
  }

  // Inventory Methods--------------------------------------------------
  /**
   * @async
   * @method getAllItems
   * @returns {Promise<Array>}
   * @description Returns an array of all items in the database.
  */
  async getAllItems() {
    return await this.items.toArray()
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
      throw new ValidationError('Item name is required')
    if (!item.categoryId)
      throw new ValidationError('Category is required')
    if (typeof item.price !== 'number' || item.price < 0)
      throw new ValidationError('Valid price is required')
    if (!item.sku || item.sku.length > 9)
      throw new ValidationError('Invalid SKU format')

    // Sanitize and prepare item data
    const newItem = {
      ...item,
      name: item.name.trim(),
      sku: item.sku,
      quantity: Math.max(0, parseInt(item.quantity) || 0),
      price: parseFloat(item.price),
      image: item.image?.trim() || null,
      tempId: `temp_${Date.now()}`,
      syncStatus: 'pending',
      createdAt: formatDate(new Date(), 'YYYY-MM-DD'),
      updatedAt: formatDate(new Date(), 'YYYY-MM-DD')
    }

    try {
      // Check for duplicate SKU
      const existingItem = await this.items.where('sku').equals(newItem.sku).first()
      if (existingItem)
        throw new ValidationError(`Item with SKU ${newItem.sku} already exists`)

      const existingByName = await this.items
        .where('name')
        .equalsIgnoreCase(item.name.trim())
        .first()
        
      if (existingByName) 
        throw new ValidationError(`Item with name "${item.name}" already exists`)

      return await this.transaction('rw', this.items, async () => {
        return await this.items.add(newItem)
      })
    } catch (error) {
      console.error('Database error creating item:', error)
      throw error instanceof ValidationError ? error : new DatabaseError('Failed to create item')
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
    const existingItem = await this.items.get(id)
    if (!existingItem)
      throw new Error('Item not found')

    // Validate changes
    if (changes.name !== undefined && !changes.name?.trim())
      throw new Error('Item name cannot be empty')
    if (changes.price !== undefined && (typeof changes.price !== 'number' || changes.price < 0))
      throw new Error('Price must be a non-negative number')
    if (changes.quantity !== undefined && (typeof changes.quantity !== 'number' || changes.quantity < 0))
      throw new Error('Quantity must be a non-negative number')

    try {
      // Check for duplicate SKU if SKU is being changed
      if (changes.sku && changes.sku !== existingItem.sku) {
        const duplicateSku = await this.items.where('sku').equals(changes.sku.trim()).first()
        if (duplicateSku)
          throw new Error(`Item with SKU ${changes.sku} already exists`)
      }

      // Sanitize and prepare update data
      const updatedChanges = {
        ...changes,
        name: changes.name?.trim() || existingItem.name,
        sku: changes.sku?.trim() || existingItem.sku,
        quantity: changes.quantity !== undefined ? Math.max(0, parseInt(changes.quantity)) : existingItem.quantity,
        price: changes.price !== undefined ? parseFloat(changes.price) : existingItem.price,
        image: changes.image?.trim() || existingItem.image,
        updatedAt: formatDate(new Date(), 'YYYY-MM-DD'),
        syncStatus: 'pending'
      }

      return await this.items.update(id, updatedChanges)
    } catch (error) {
      console.error('Database error updating item:', error)
      throw error
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
    return await this.items.add(item)
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
    return await this.items.update(id, changes)
  }
  /**
   * @async
   * @method deleteItem
   * @param {*} id
   * @returns {Promise<Object>}
   * @description Deletes an item from the database.
  */
  async deleteItem(id) {
    return await this.items.delete(id)
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
      date: formatDate(new Date(), 'YYYY-MM-DD')
    })
  }
  /**
   * @async
   * @method getAllSales
   * @returns {Promise<Array>}
   * @description Returns an array of all sales in the database.
  */
  async getAllSales() {
    return await this.sales.toArray()
  }
  /**
   * @async
   * @method deleteSale
   * @param {number} saleId
   * @returns {Promise<void>}
   * @description Deletes a sale from the database by its ID.
   * @throws {Error} If an error occurs during deletion.
   */
  async deleteSale(saleId) {
    try {
      await this.sales.delete(saleId)
    } catch (error) {
      console.error('Database error deleting sale:', error)
      throw error; // Re-throw the error for handling by the caller
    }
  }

  /**
   * @async
   * @method bulkDeleteSales
   * @param {Array<number>} saleIds - An array of sale IDs to delete.
   * @returns {Promise<void>}
   * @description Deletes multiple sales from the database by their IDs.
   * @throws {Error} If an error occurs during deletion.
   */
  async bulkDeleteSales(saleIds) {
    try {
      await this.sales.bulkDelete(saleIds);
    } catch (error) {
      console.error('Database error deleting sales:', error)
      throw error; // Re-throw the error for handling by the caller
    }
  }
  /**
   *
   *
  */
    async getAllTransactions(){
      try {
        const transactions = await this.cashFlow.toArray()
        return transactions.map(transaction => ({
          ...transaction,
          syncStatus: transaction.syncStatus || null,  // Example
          syncError: transaction.syncError || null     // Example
        }))
      } catch (error) {
        console.error('Error getting all transactions:', error)
        throw error
      }
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
      date: formatDate(new Date(), 'YYYY-MM-DD')
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
    return await this.contactCategories.toArray()
  }
  /**
   * @async
   * @method addContactCategory
   * @param {Object} contactCategory
   * @returns {Promise<Object>}
   * @description Adds a contact category to the database.
  */
  async addContactCategory(contactCategory) {
    return await this.contactCategories.add(contactCategory)
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
    return await this.contacts.toArray()
  }
  /**
   * @async
   * @method addContact
   * @param {Object} contactPerson
   * @returns {Promise<Object>}
   * @description Adds a contact to the database.
  */
  async addContact(contactPerson) {
    if (!contactPerson.name?.trim()) {
      throw new ValidationError('Contact name is required');
    }
    if (!contactPerson.categoryId) {
      throw new ValidationError('Contact category is required');
    }

    try {
      // Prepare contact data with proper types
      const contact = {
        ...contactPerson,
        name: contactPerson.name.trim().toLowerCase(),
        email: contactPerson.email?.trim()?.toLowerCase() || null,
        phone: contactPerson.phone?.trim() || null,
        categoryId: contactPerson.categoryId.toString(),
        createdAt: new Date(),
        updatedAt: new Date(),
        syncStatus: 'pending'
      };

      // Check for duplicates
      const duplicateCheck = await this.checkDuplicateContact(contact);
      if (duplicateCheck.exists) {
        const errorMessages = {
          '[categoryId+name]': 'A contact with this name already exists in the category',
          'email': 'A contact with this email already exists',
          'phone': 'A contact with this phone number already exists'
        };
        throw new ValidationError(errorMessages[duplicateCheck.field]);
      }

      // Add the contact
      const id = await this.contactsList.add(contact);
      return id;

    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      console.error('Database error adding contact:', error);
      throw new DatabaseError('Failed to add contact');
    }
  }
  /**
   * @async
   * @method checkDuplicateContact
   * @param {Object} contact
   * @returns {Promise<Object>}
   * @description Checks for duplicate contacts in the database.
  */
  async checkDuplicateContact(contact) {
    try {
      // First check the compound key (categoryId + name)
      const existingByName = await this.contactsList
        .where('[categoryId+name]')
        .equals([contact.categoryId.toString(), contact.name.trim().toLowerCase()])
        .first();

      if (existingByName) {
        return {
          exists: true,
          field: '[categoryId+name]'
        };
      }

      // Then check email if provided
      if (contact.email?.trim()) {
        const existingByEmail = await this.contactsList
          .where('email')
          .equals(contact.email.trim().toLowerCase())
          .first();

        if (existingByEmail) {
          return {
            exists: true,
            field: 'email'
          };
        }
      }

      // Finally check phone if provided
      if (contact.phone?.trim()) {
        const existingByPhone = await this.contactsList
          .where('phone')
          .equals(contact.phone.trim())
          .first();

        if (existingByPhone) {
          return {
            exists: true,
            field: 'phone'
          };
        }
      }

      return { exists: false };
    } catch (error) {
      console.error('Error checking for duplicate contact:', error);
      throw new DatabaseError('Error checking for duplicate contact');
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
      async () => {
        await Promise.all([
          this.items.clear(),
          this.sales.clear(),
          this.cashFlow.clear(),
          this.contactCategories.clear(),
          this.contactsList.clear()
        ])
    })
  }

  /**
   * @async
   * @method deleteCategory
   * @param {string} categoryId - ID of the category to delete
   * @returns {Promise<void>}
   * @description Deletes a category if it has no associated items
   * @throws {Error} If category has associated items or deletion fails
   */
  async deleteCategory(categoryId) {
    try {
      // Check if category exists
      const category = await this.categories.get(categoryId)
      if (!category) {
        throw new Error('Category not found')
      }

      // Check if any items use this category
      const itemsCount = await this.items
        .where('categoryId')
        .equals(categoryId)
        .count()

      if (itemsCount > 0) {
        throw new Error('Cannot delete category with existing items')
      }

      // Delete the category
      await this.categories.delete(categoryId)
    } catch (error) {
      console.error('Database error deleting category:', error)
      throw error
    }
  }

  /**
   * @async
   * @method deleteCategory
   * @param {string} categoryId - ID of the category to delete
   * @returns {Promise<void>}
   * @description Deletes a category if it has no associated items
   * @throws {Error} If category has associated items or deletion fails
   */
  async deleteCategory(categoryId) {
    try {
      // Check if category exists
      const category = await this.categories.get(categoryId)
      if (!category) {
        throw new Error('Category not found')
      }

      // Check if any items use this category
      const itemsCount = await this.items
        .where('categoryId')
        .equals(categoryId)
        .count()

      if (itemsCount > 0) {
        throw new Error('Cannot delete category with existing items')
      }

      // Delete the category
      await this.categories.delete(categoryId)
    } catch (error) {
      console.error('Database error deleting category:', error)
      throw error
    }
  }

  // Add method to find by temp ID
  async findByTempId(collection, tempId) {
    return await this[collection].where('tempId').equals(tempId).first();
  }

}

// Create and export a single instance
export const db = new AppDatabase()
