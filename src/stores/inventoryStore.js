/**
 * @fileoverview Manages inventory data and operations, including local and cloud synchronization.
 * Implements Pinia store pattern for state management with offline-first capabilities.
 * Handles CRUD operations for inventory items and categories with Firestore integration.
 */

import { defineStore } from 'pinia'
import { db } from '../db/dexiedb'
import {
  collection,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp,
  where,
  onSnapshot,
  limit,
  getDoc
} from 'firebase/firestore'
import { db as fireDb } from '../firebase/firebaseconfig'
import { useNetworkStatus } from '../services/networkStatus'
import debounce from 'lodash/debounce'
import { formatDate } from '../utils/dateUtils'
import { processItem, validateItem, handleError } from '../utils/validation'
import filterItems from 'src/utils/filterUtils'
import { useCentralizedSyncService } from '../services/centralizedSyncService'
const { syncWithFirestore, syncStatus } = useCentralizedSyncService()

/**
 * @typedef {Object} SyncStatus
 * @property {string|null} lastSync - ISO timestamp of the last successful sync
 * @property {boolean} inProgress - Indicates if a sync operation is currently running
 * @property {string|null} error - Error message from the last failed sync attempt
 * @property {number} pendingChanges - Count of local changes waiting to be synced
 * @property {number} totalItems - Total number of items to be processed in current sync
 * @property {number} processedItems - Number of items successfully processed in current sync
 * @property {Array<Object>} failedItems - Items that failed to sync with their error details
 * @property {number} retryCount - Number of sync retry attempts made
 * @property {number} maxRetries - Maximum number of retry attempts allowed
 * @property {number} retryDelay - Milliseconds to wait between retry attempts
 */

/**
 * @typedef {Object} InventoryItem
 * @property {string} id - Unique identifier for the item
 * @property {string} name - Name of the item
 * @property {string} sku - Stock Keeping Unit (unique)
 * @property {string} categoryId - Reference to the item's category
 * @property {number} quantity - Current stock quantity
 * @property {number} price - Item price
 * @property {Date} createdAt - Timestamp of item creation
 * @property {Date} updatedAt - Timestamp of last update
 * @property {string} [firebaseId] - Firestore document ID if synced
 */

/**
 * @typedef {Object} Category
 * @property {string} id - Unique identifier for the category
 * @property {string} name - Category name
 * @property {Date} createdAt - Timestamp of category creation
 * @property {Date} updatedAt - Timestamp of last update
 * @property {string} [firebaseId] - Firestore document ID if synced
 */

/**
 * @const {Ref<boolean>} isOnline
 * @description A reactive reference to the online/offline status of the application.
 */
const { isOnline } = useNetworkStatus()
/**
 * @const {string} DEFAULT_SORT
 * @description The default sorting field for inventory items.
 */
const DEFAULT_SORT = 'name'
/**
 * @const {string} DEFAULT_SORT_DIRECTION
 * @description The default sorting direction for inventory items.
 */
const DEFAULT_SORT_DIRECTION = 'asc'
/**
 * @const {Array<Object>} SORT_OPTIONS
 * @description Available sorting options for the inventory list.
 */
const SORT_OPTIONS = [
  { label: 'Name', value: 'name' },
  { label: 'Price', value: 'price' },
  { label: 'Quantity', value: 'quantity' },
  { label: 'Category', value: 'category' }
]
/**
 * @const {Store} useInventoryStore
 * @description Pinia store for managing inventory state and operations
 */
export const useInventoryStore = defineStore('inventory', {
  state: () => {
    /**
     * @type {Object}
     * @property {boolean} loading - Indicates if the store is currently loading data.
     * @property {string|null} error - Stores any error messages encountered during operations.
     * @property {Array<Object>} items - Array of inventory items.
     * @property {string} searchQuery - Current search query for filtering items.
     * @property {string|null} categoryFilter - Current category filter for filtering items.
     * @property {boolean} itemDialog - Indicates if the item dialog is open.
     * @property {boolean} deleteDialog - Indicates if the delete confirmation dialog is open.
     * @property {Object} editedItem - The item currently being edited in the dialog.
     * @property {Object|null} itemToDelete - The item selected for deletion.
     * @property {boolean} editMode - Indicates if the item dialog is in edit mode.
     * @property {string} viewMode - Current view mode of the inventory list ('list' or 'grid').
     * @property {string} sortBy - Current sorting field for inventory items.
     * @property {string} sortDirection - Current sorting direction for inventory items.
     * @property {Array<Object>} sortOptions - Available sorting options for the inventory list.
     * @property {Array<Object>} categories - Array of inventory categories.
     * @property {boolean} categoryDialog - Indicates if the category dialog is open.
     * @property {Object|null} editedCategory - The category currently being edited in the dialog.
     * @property {Array<string>} selectedItems - Array of IDs of selected items.
     * @property {Object} dateRange - Selected date range for filtering data.
     * @property {Array<Object>} topSellingProducts - Top selling products.
     */
    return {
      loading: false,
      error: null,
      items: [],
      searchQuery: '',
      categoryFilter: null,
      itemDialog: false,
      deleteDialog: false,
      editedItem: {},
      itemToDelete: null,
      editMode: false,
      viewMode: 'list',
      // Do not remove this until further review
      sortBy: DEFAULT_SORT,
      sortDirection: DEFAULT_SORT_DIRECTION,
      sortOptions: SORT_OPTIONS,
      categories: [],
      categoryDialog: false,
      editedCategory: null,
      selectedItems: [],
      /**
       * @type {Object}
       * @property {string} from - Start date of the selected date range.
       * @property {string} to - End date of the selected date range.
       */
      dateRange: {
        from: formatDate(new Date(), 'YYYY-MM-DD'),
        to: formatDate(new Date(), 'YYYY-MM-DD')
      },
      topSellingProducts: [],
      // unsubscribeItems: null,
      // unsubscribeCategories: null
    }
    // Do not remove this until further review
  },

  getters: {
    /**
     * @returns {Array} Filtered items based on search query and category
     */
    filteredItems(state) {
      return filterItems(state.items, {
        searchQuery: state.searchQuery,
        categoryFilter: state.categoryFilter,
        getCategoryName: this.getCategoryName
      })
    },

    /**
     * @returns {Function} Function to get category name from ID
     */
    getCategoryName: (state) => (categoryId) => {
      if (!categoryId) return 'Uncategorized'

      if (typeof categoryId === 'string' && !state.categories.find(cat => cat.id === categoryId))
        return categoryId

      const category = state.categories.find(cat => cat.id === categoryId)
      return category ? category.name : 'Uncategorized'
    },

    /**
     * @returns {Array} Sorted items based on the current sort options
     */
    sortedItems(state) {
      const items = this.filteredItems
      if (state.sortBy) {
        items.sort((a, b) => {
          let aVal = a[state.sortBy]
          let bVal = b[state.sortBy]

          if (state.sortBy === 'category') {
            aVal = this.getCategoryName(a.categoryId)
            bVal = this.getCategoryName(b.categoryId)
          }

          if (typeof aVal === 'string') {
            return state.sortDesc
              ? bVal.localeCompare(aVal)
              : aVal.localeCompare(bVal)
          }
          return state.sortDesc ? bVal - aVal : aVal - bVal
        })
      }

      return items.map(item => ({
        ...item,
        category: this.getCategoryName(item.categoryId)
      }))
    },

    /**
     * @returns {Array} Stock data for all items
     */
    stockData(state) {
      return state.items.map(item => ({
        name: item.name,
        'current stock': item.quantity,
        'dead stock': 0,
        lastUpdated: formatDate(new Date(), 'MM/DD/YYYY')
      }))
    },

    /**
     * @returns {Array} Categories with their corresponding stock levels
     */
    getCategoryStocks() {
      return Object.values(
        this.items.reduce((acc, item) => {
          acc[item.category] = (acc[item.category] || 0) + item.quantity
          return acc
        }, {})
      )
    },

    /**
     * @returns {Array} List of unique categories
     */
    getCategories() {
      return [...new Set(this.items.map(item => item.category))]
    },

    /**
     * @returns {Array} Recently added products
     */
    getRecentlyAddedProducts() {
      return [...this.items]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
    },

    /**
     * @returns {Array} Formatted categories for display
     */
    formattedCategories(state) {
      return state.categories.map(category => ({
        label: category.name,
        value: category.id
      }))
    },
  },

  actions: {
    /**
     * @async
     * @returns {Promise<void>}
     * @description Initializes the database and performs initial sync if needed
     */
    async initializeDb() {
      try {
        if (isOnline.value) {
          await syncWithFirestore('items', {
            processItem,
            validateItem,
            orderByField: 'updatedAt'
          })
        }

        await this.loadInventory()
        await this.loadCategories()
      } catch (error) {
        this.error = handleError(error, 'Failed to initialize database')
      }
    },

    /**
     * @async
     * @returns {Promise<void>}
     * @description Loads inventory from local database and syncs with Firestore if online
     */
    async loadInventory() {
      try {
        this.loading = true

        let localItems = await db.getAllItems()
        if (!localItems)
          localItems = []

        this.items = localItems.map(processItem)

        if (localItems.length === 0 && isOnline.value) {
          await syncWithFirestore('items', processItem, validateItem)
          const updatedItems = await db.getAllItems()
          this.items = updatedItems ? updatedItems.map(processItem) : []
        }
        else if (localItems.length > 0 && isOnline.value) await syncWithFirestore('items', processItem, validateItem)

      } catch (error) {
        this.error = handleError(error, 'Failed to load inventory')
      } finally {
        this.loading = false
      }
    },

    /**
     * @async
     * @param {Object} item - New item to create
     * @returns {Promise<Object>} Created item result
     */
    async createNewItem(item) {
      this.loading = true
      try {
        const existingItem = await db.items
          .where('sku')
          .equals(item.sku)
          .first()

        if (existingItem)
          throw new Error('Item with the same SKU already exists')

        if (item.categoryId) {
          const categoryExists = await db.categories
            .where('id')
            .equals(item.categoryId)
            .count()

          if (!categoryExists)
            throw new Error('Selected category does not exist')
        }

        const errors = validateItem(item)
        if (errors.length > 0)
          throw new Error(`Validation failed: ${errors.join(', ')}`)

        const id = crypto.randomUUID()

        const processedItem = {
          ...processItem(item),
          syncStatus: 'pending',
          id: id
        }

        const result = await db.createItem(processedItem)

        if (isOnline.value) {
          const docRef = await addDoc(collection(fireDb, 'items'), {
            ...processedItem,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            syncStatus: 'synced'
          })

          await db.updateItem(id, {
            firebaseId: docRef.id,
            syncStatus: 'synced'
          })
        }

        await this.loadInventory()
        return { id: id, offline: !isOnline.value }
      } catch (error) {
        console.error('Error creating item:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * @async
     * @param {string} id - Item ID to update
     * @param {Object} changes - Changes to apply
     * @returns {Promise<Object>} Update result
     */
    async updateExistingItem(id, changes) {
      this.loading = true

      try {
        const errors = validateItem({ ...changes, id })
        if (errors.length > 0)
          throw new Error(`Validation failed: ${errors.join(', ')}`)

        const processedChanges = processItem(changes)
        const result = await db.updateExistingItem(id, processedChanges)

        if (isOnline.value) {
          const item = await db.items.get(id)
          if (item?.firebaseId) {
            await updateDoc(doc(fireDb, 'items', item.firebaseId), {
              ...processedChanges,
              updatedAt: serverTimestamp()
            })
            await this.loadInventory()
            return { id, offline: false }
          }
        }

        await this.loadInventory()
        return { id, offline: true }
      } catch (error) {
        console.error('Error updating item:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * @async
     * @param {string} id - Item ID to delete
     * @returns {Promise<string>} Deleted item ID
     * @description Deletes an item from the local database and queues for sync
     */
    async deleteItem(id) {
      try {
        const item = await db.items.get(id)
        if (!item) throw new Error('Item not found')

        await db.transaction('rw', db.items, async () => {
          await db.items.delete(id)
        })

        if (isOnline.value && item.firebaseId) {
          try {
            const docRef = doc(fireDb, 'items', item.firebaseId)
            await deleteDoc(docRef)
          } catch (error) {
            console.error('Error deleting from Firestore:', error)
          }
        }

        return id
      } catch (error) {
        console.error('Error in deleteItem:', error)
        throw error
      }
    },

    /**
     * @async
     * @returns {Promise<void>}
     * @description Loads categories from the database and syncs with Firestore
     */
    async loadCategories() {
      try {
        this.loading = true

        const localCategories = await db.categories.toArray()
        this.categories = localCategories

        if (isOnline.value) {
          await syncWithFirestore('categories', {
            validateItem: (category) => {
              return category && typeof category.name === 'string'
            },
            processItem: (category) => ({
              ...category,
              createdAt: category.createdAt || new Date(),
              updatedAt: category.updatedAt || new Date()
            }),
            orderByField: 'updatedAt'
          })

          this.categories = await db.categories.toArray()
        }
      } catch (error) {
        console.error('Error loading categories:', error)
        this.error = handleError(error, 'Failed to load categories')
      } finally {
        this.loading = false
      }
    },

    /**
     * @async
     * @param {Array} localCategories - Local categories to merge
     * @param {Array} firestoreCategories - Firestore categories to merge
     * @returns {Promise<void>}
     * @description Merges local and Firestore categories, resolving conflicts
     * @private
     */

    /**
     * @async
     * @param {string} categoryName - Category name to add
     * @returns {Promise<Object|null>} Added category object or null on error
     * @description Adds a category to the database and syncs with Firestore
     */
    async addCategory(categoryName) {
      try {
        if (!categoryName.trim() || typeof categoryName !== 'string')
          throw new Error('Invalid category name')

        const sanitizedName = categoryName.trim()

        const existingCategory = this.categories.find(
          c => c.name.toLowerCase().replace(/\s+/g, '') === sanitizedName.toLowerCase().replace(/\s+/g, '')
        )
        if (existingCategory)
          throw new Error('Category already exists')

        // If online, create in Firestore first to get the server timestamp
        if (isOnline.value) {
          try {
            const docRef = await addDoc(collection(fireDb, 'categories'), {
              id: crypto.randomUUID(),
              name: categoryName,
              syncStatus: 'synced', // Add syncStatus field
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            })

            // Get the document to access the server timestamp
            const docSnap = await getDoc(docRef)
            const firestoreData = docSnap.data()

            const newCategory = {
              id: firestoreData.id,
              name: categoryName,
              createdAt: firestoreData.createdAt.toDate(),
              updatedAt: firestoreData.updatedAt.toDate(),
              firebaseId: docRef.id
            }

            // Add to local database
            await db.categories.add(newCategory)
            this.categories.push(newCategory)

            return { id: newCategory.id, name: categoryName, firebaseId: docRef.id }
          } catch (error) {
            console.error('Error adding category to Firestore:', error)
          }
        }

        // Offline handling or if Firestore failed
        const now = new Date()
        const newCategory = {
          id: crypto.randomUUID(),
          name: categoryName,
          createdAt: now,
          updatedAt: now
        }

        // Add to local database
        await db.categories.add(newCategory)
        this.categories.push(newCategory)

        return { id: newCategory.id, name: categoryName }
      } catch (error) {
        console.error('Error adding category:', error)
        this.error = error.message
        return null
      }
    },

    /**
     * @async
     * @param {string} categoryId - Category ID to delete
     * @returns {Promise<boolean>} Success flag
     * @description Deletes a category from the database
     */
    async deleteCategory(categoryId) {
      try {
        const category = this.categories.find(c => c.id === categoryId)
        if (!category)
          throw new Error('Category not found')

        const itemsInCategory = this.items.filter(item => item.categoryId === categoryId)
        if (itemsInCategory.length > 0) {
          throw new Error('Cannot delete category with existing items')
        }

        await db.categories.delete(categoryId)

        // Update local state
        this.categories = this.categories.filter(c => c.id !== categoryId)

        if (isOnline.value) {
          try {
            const docRef = doc(fireDb, 'categories', categoryId)
            await deleteDoc(docRef)
          } catch (error) {
            console.error('Error deleting category from Firestore:', error)
            this.error = handleError(error, 'Failed to delete category')
            return false
          }
        }

        return true
      } catch (error) {
        console.error('Error deleting category:', error)
        this.error = handleError(error, 'Failed to delete category')
        return false
      }
    },

    /**
     * @async
     * @returns {void}
     * @description Opens the category dialog
     */
    openCategoryDialog() {
      this.categoryDialog = true
      this.editedCategory = null
      this.error = null
    },

    /**
     * @async
     * @returns {void}
     * @description Closes the category dialog
     */
    closeCategoryDialog() {
      this.categoryDialog = false
      this.editedCategory = null
      this.error = null
    },

    /**
     * @async
     * @param {Object|null} item - Item to edit or null for new item
     * @returns {void}
     * @description Opens the item dialog
     */
    openItemDialog(item = null) {
      if (item) {
        this.editMode = true;
        this.editedItem = { ...item };
      } else {
        this.editMode = false;
        this.editedItem = {
          name: '',
          sku: '',
          category: '',
          quantity: 0,
          price: 0,
          image: null
        };
      }
      this.itemDialog = true;
    },

    /**
     * @async
     * @returns {void}
     * @description Closes the item dialog
     */
    closeItemDialog() {
      this.itemDialog = false;
      this.editedItem = {};
      this.editMode = false;
    },

    /**
     * @async
     * @param {Object} item - Item to delete
     * @returns {void}
     * @description Confirms deletion of an item
     */
    async confirmDelete(item) {
      this.itemToDelete = item;
      this.deleteDialog = true;
    },

    /**
     * @async
     * @returns {void}
     * @description Handles deletion confirmation
     */
    async handleDeleteConfirm() {
      if (!this.itemToDelete) return;

      try {
        const itemId = this.itemToDelete.id;
        await this.deleteItem(itemId);

        // Remove item from local state
        const index = this.items.findIndex(item => item.id === itemId);
        if (index !== -1) {
          this.items.splice(index, 1);
        }

        this.deleteDialog = false;
        this.itemToDelete = null;
      } catch (error) {
        console.error('Error deleting item:', error);
        throw error;
      }
    },

    /**
     * @description Handles search query changes
     */
    handleSearch(itemToSearch) {
      // Debounced search function to prevent excessive filtering
      const debouncedSearch = debounce((query) => {
        this.searchQuery = query;
      }, 300);

      debouncedSearch(itemToSearch);
    },
    /**
     * @method exportToCSV
     * @param {Array} data - Data to export
     * @param {string} filename - Name of the file to export
     * @description Exports data to a CSV file
     */
    exportToCSV(data, filename) {
      if (!data || !data.length) return

      const headers = Object.keys(data[0])
      const csvContent = [
        headers.join(','),
        ...data.map(row =>
          headers.map(header => {
            let cell = row[header]

            if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"')))
              cell = `"${cell.replace(/"/g, '""')}"`

            return cell
          }).join(',')
        )
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)

      link.setAttribute('href', url)
      link.setAttribute('download', `${filename}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    },

    /**
     * @param {Object} item - The item to retry syncing.
     * @returns {Promise<boolean>} True if the retry was successful, false otherwise.
     * @description Retries syncing a failed item.
     */
    async retryFailedSync(item) {
      const { retryCount, maxRetries, retryDelay } = this.syncStatus

      if (retryCount >= maxRetries) {
        console.error(`Max retries (${maxRetries}) reached for item:`, item.id)
        return false
      }

      try {
        this.syncStatus.retryCount++
        await new Promise(resolve => setTimeout(resolve, retryDelay))

        if (item.syncOperation === 'add')
          await this.createNewItem(item)
        else if (item.syncOperation === 'update')
          await this.updateExistingItem(item.id, item)
        else if (item.syncOperation === 'delete')
          await this.deleteItem(item.id)

        this.syncStatus.failedItems = this.syncStatus.failedItems.filter(
          failed => failed.id !== item.id
        )
        return true
      } catch (error) {
        console.error(`Retry failed for item ${item.id}:`, error)
        return false
      }
    },

    /**
     * @async
     * @returns {Promise<void>}
     * @description Cleans up duplicate items in the local database based on their firebaseId.
     */
    async cleanupDuplicates() {
      try {
        this.loading = true
        const allItems = await db.items.toArray()
        const seenSkus = new Set()
        const duplicates = []

        for (const item of allItems) {
          if (item.sku) {
            if (seenSkus.has(item.sku)) {
              duplicates.push(item.id)
            } else {
              seenSkus.add(item.sku)
            }
          }
        }

        if (duplicates.length > 0) {
          await db.transaction('rw', db.items, async () => {
            for (const id of duplicates) {
              await db.items.delete(id)
            }
          })
        }

        await this.loadInventory()
      } catch (error) {
        console.error('Error cleaning up duplicates:', error)
        this.error = handleError(error, 'Failed to cleanup duplicates')
      } finally {
        this.loading = false
      }
    },
    /**
     * @param {boolean} [fullCleanup=false] - Whether to perform a full data cleanup or just reset UI state
     * @description Resets UI state and optionally clears all data.
     * Used for cleanup before navigation or component unmount.
     */
    cleanup(fullCleanup = false) {
      // Reset UI state
      this.loading = false
      this.error = null
      this.itemDialog = false
      this.deleteDialog = false
      this.editedItem = {}
      this.itemToDelete = null

      if (fullCleanup) {
        // Full data cleanup
        this.items = []
        this.searchQuery = ''
        this.categoryFilter = null
        this.selectedItems = []
        this.sortBy = DEFAULT_SORT
        this.sortDirection = DEFAULT_SORT_DIRECTION
        this.categories = []
        this.topSellingProducts = []
      }
    },

    /**
     * @method generateSKU
     * @param {string} name - Item name to base the SKU on
     * @returns {string} Generated SKU
     * @description Generates a unique SKU based on item name and random string (max 9 chars)
     */
    generateSKU(name) {
      const prefix = name
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase()
        .padEnd(3, 'X')
        .slice(0, 3)

      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
      let randomPart = ''
      for (let i = 0; i < 5; i++)
        randomPart += chars.charAt(Math.floor(Math.random() * chars.length))

      return `${prefix}-${randomPart}`
    },

    /**
     * @method isSkuUnique
     * @param {string} sku - SKU to check
     * @returns {Promise<boolean>} Whether the SKU is unique
     */
    async isSkuUnique(sku) {
      const existingItem = await db.items
        .where('sku')
        .equals(sku)
        .first()
      return !existingItem
    },

    /**
     * @method getUniqueSku
     * @param {string} name - Item name to base the SKU on
     * @returns {Promise<string>} A unique SKU
     */
    async getUniqueSku(name) {
      let sku
      let isUnique = false
      let attempts = 0
      const maxAttempts = 10

      while (!isUnique && attempts < maxAttempts) {
        sku = this.generateSKU(name)
        isUnique = await this.isSkuUnique(sku)
        attempts++
      }

      if (!isUnique)
        throw new Error('Unable to generate unique SKU. Please try again.')

      return sku
    },

    /**
     * @method processBatches
     * @private
     * @param {Array<InventoryItem|Category>} items - Array of items to process
     * @param {number} batchSize - Maximum number of operations per batch
     * @param {Function} processFn - Function to process each item in the batch
     * @returns {Promise<void>}
     * @throws {Error} If batch commit fails
     * @description Processes items in batches to avoid Firestore write limits
     */
    async processBatches(items, batchSize, processFn) {
      let batch = writeBatch(fireDb)
      let operationsCount = 0

      for (const item of items) {
        try {
          await processFn(item, batch)
          operationsCount++

          if (operationsCount >= batchSize) {
            await batch.commit()
            batch = writeBatch(fireDb)
            operationsCount = 0
          }
        } catch (error) {
          console.error('Error processing item:', error)
        }
      }

      if (operationsCount > 0) {
        try {
          await batch.commit()
        } catch (error) {
          console.error('Error committing final batch:', error)
        }
      }
    },
  }
})
