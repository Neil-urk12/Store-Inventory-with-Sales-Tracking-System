/**
 * @fileoverview Manages inventory data and operations, including local and cloud synchronization.
 * Implements Pinia store pattern for state management.
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
  getDocs
} from 'firebase/firestore'
import { db as fireDb } from '../firebase/firebaseconfig'
import { useNetworkStatus } from '../services/networkStatus'
import { syncQueue } from '../services/syncQueue'
import debounce from 'lodash/debounce'
import { formatDate } from '../utils/dateUtils'
import { processItem, validateItem, handleError } from '../utils/inventoryUtils'
import filterItems from 'src/utils/filterUtils'

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
     * @property {Object} syncStatus - Status of the synchronization process.
     * @property {string} sortBy - Current sorting field for inventory items.
     * @property {string} sortDirection - Current sorting direction for inventory items.
     * @property {Array<Object>} sortOptions - Available sorting options for the inventory list.
     * @property {Array<Object>} categories - Array of inventory categories.
     * @property {boolean} categoryDialog - Indicates if the category dialog is open.
     * @property {Object|null} editedCategory - The category currently being edited in the dialog.
     * @property {Array<string>} selectedItems - Array of IDs of selected items.
     * @property {Object} dateRange - Selected date range for filtering data.
     * @property {Array<Object>} inventoryData - Aggregated inventory data for reports.
     * @property {Array<Object>} lowStockAlerts - Items with low stock levels.
     * @property {Array<Object>} topSellingProducts - Top selling products.
     * @property {Object} chartData - Chart data for various timeframes.
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
      /**
       * @type {Object}
       * @property {string|null} lastSync - Timestamp of the last successful sync.
       * @property {boolean} inProgress - Indicates if a sync is currently in progress.
       * @property {string|null} error - Stores any error messages encountered during sync.
       * @property {number} pendingChanges - Number of pending local changes to be synced.
       * @property {number} totalItems - Total number of items to be synced.
       * @property {number} processedItems - Number of items processed during sync.
       * @property {Array<Object>} failedItems - Array of items that failed to sync.
       * @property {number} retryCount - Current retry attempt for failed syncs.
       * @property {number} maxRetries - Maximum number of retry attempts for failed syncs.
       * @property {number} retryDelay - Delay in milliseconds between retry attempts.
       */
      syncStatus: {
        lastSync: null,
        inProgress: false,
        error: null,
        pendingChanges: 0,
        totalItems: 0,
        processedItems: 0,
        failedItems: [],
        retryCount: 0,
        maxRetries: 3,
        retryDelay: 1000
      },
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
      inventoryData: [],
      lowStockAlerts: [],
      topSellingProducts: [],
      /**
       * @type {Object}
       * @property {Object} daily - Chart data for daily timeframe.
       * @property {Object} weekly - Chart data for weekly timeframe.
       * @property {Object} monthly - Chart data for monthly timeframe.
       */
      chartData: {
        daily: { labels: [], datasets: [] },
        weekly: { labels: [], datasets: [] },
        monthly: { labels: [], datasets: [] }
      },
      unsubscribeItems: null,
      unsubscribeCategories: null
    }
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
     * @returns {Array} Items with low stock levels
     */
    getLowStockItems(state) {
      return state.inventoryData.filter(item => item.currentStock <= item.minStock * 1.2)
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
          await this.syncWithFirestore()
          await syncQueue.processQueue()
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
          await this.syncWithFirestore()
          const updatedItems = await db.getAllItems()
          this.items = updatedItems ? updatedItems.map(processItem) : []
        }
        else if (localItems.length > 0 && isOnline.value) await this.syncWithFirestore()

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
        const errors = validateItem(item)
        if (errors.length > 0)
          throw new Error(`Validation failed: ${errors.join(', ')}`)

        const processedItem = processItem(item)
        const result = await db.createItem(processedItem)

        if (isOnline.value) {
          // If online, create directly in Firestore
          const docRef = await addDoc(collection(fireDb, 'items'), {
            ...processedItem,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })

          await db.updateItem(result, { firebaseId: docRef.id })
          await this.loadInventory()
          return { id: result, firebaseId: docRef.id, offline: false }
        } else {
          await syncQueue.addToQueue({
            type: 'add',
            collection: 'items',
            data: processedItem,
            docId: result
          })
          await this.loadInventory()
          return { id: result, offline: true }
        }
      } catch (error) {
        console.error('Error creating item:', error)
        this.syncStatus.failedItems.push({
          ...item,
          error: error.message,
          syncOperation: 'add'
        })
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

        await syncQueue.addToQueue({
          type: 'update',
          collection: 'items',
          data: processedChanges,
          docId: id
        })
        await this.loadInventory()
        return { id, offline: true }
      } catch (error) {
        console.error('Error updating item:', error)
        this.syncStatus.failedItems.push({
          ...changes,
          error: error.message,
          syncOperation: 'update'
        })
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
            await syncQueue.addToQueue({
              type: 'delete',
              collection: 'items',
              docId: id,
              firebaseId: item.firebaseId
            })
          }
        } else if (item.firebaseId) {
          await syncQueue.addToQueue({
            type: 'delete',
            collection: 'items',
            docId: id,
            firebaseId: item.firebaseId
          })
        }

        return id
      } catch (error) {
        console.error('Error in deleteItem:', error)
        this.syncStatus.failedItems.push({
          id,
          error: error.message,
          syncOperation: 'delete'
        })
        throw error
      }
    },

    /**
     * @async
     * @method syncWithFirestore
     * @returns {Promise<void>}
     * @description Syncs local database with Firestore
     */
    async syncWithFirestore() {
      if (!isOnline.value || this.syncStatus.inProgress) return

      try {
        this.syncStatus.inProgress = true

        // Ensure we clean up any existing listeners
        this.cleanupListeners()

        const localItems = await db.items.toArray()
        let firestoreQuery = query(
          collection(fireDb, 'items'),
          orderBy('updatedAt', 'desc'),
          // Limit the query to prevent excessive data transfer
          limit(100)
        )

        this.unsubscribeItems = onSnapshot(
          firestoreQuery,
          { includeMetadataChanges: true },
          debounce(async (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return

            const localUpdates = []
            const batch = writeBatch(fireDb)
            let batchCount = 0

            for (const change of snapshot.docChanges()) {
              // Skip if this is a local change
              if (change.doc.metadata.hasPendingWrites) continue

              const firestoreItem = { ...change.doc.data(), firebaseId: change.doc.id }
              
              if (change.type === 'added' || change.type === 'modified') {
                const existingItem = localItems.find(
                  item => item.firebaseId === firestoreItem.firebaseId
                )

                if (existingItem) {
                  // Only update if Firestore version is newer
                  const firestoreDate = firestoreItem.updatedAt?.toDate() || new Date()
                  const localDate = new Date(existingItem.updatedAt)
                  
                  if (firestoreDate > localDate && existingItem.syncStatus !== 'pending') {
                    localUpdates.push({ id: existingItem.id, data: firestoreItem })
                  }
                } else {
                  // Check for duplicates before adding
                  const duplicateCheck = await db.items
                    .where('firebaseId')
                    .equals(firestoreItem.firebaseId)
                    .count()
                  
                  if (duplicateCheck === 0) {
                    localUpdates.push({ data: firestoreItem })
                  }
                }
              } else if (change.type === 'removed') {
                const existingItem = localItems.find(
                  item => item.firebaseId === firestoreItem.firebaseId
                )
                if (existingItem) {
                  await db.items.delete(existingItem.id)
                }
              }

              batchCount++
              if (batchCount >= 500) {
                await batch.commit()
                batchCount = 0
              }
            }

            if (batchCount > 0) {
              await batch.commit()
            }

            // Process updates in smaller batches
            if (localUpdates.length > 0) {
              await this.processBatchUpdates(localUpdates)
              await this.loadInventory()
            }
          }, 1000),
          (error) => {
            console.error('Firestore sync error:', error)
            this.error = handleError(error, 'Failed to sync with Firestore')
            this.syncStatus.inProgress = false
            this.cleanupListeners()
          }
        )

        await this.loadCategories()
      } catch (error) {
        console.error('Error in syncWithFirestore:', error)
        this.error = handleError(error, 'Failed to sync with Firestore')
      } finally {
        this.syncStatus.inProgress = false
      }
    },


    async processBatchUpdates(updates) {
      const BATCH_SIZE = 50
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE)
        await Promise.all(
          batch.map(async update => {
            if (update.id) {
              await db.items.update(update.id, {
                ...update.data,
                syncStatus: 'synced',
                updatedAt: new Date().toISOString()
              })
            } else {
              await db.items.add({
                ...update.data,
                syncStatus: 'synced',
                updatedAt: new Date().toISOString()
              })
            }
          })
        )
      }
    },

    // Add a new method to cleanup listeners
    cleanupListeners() {
      if (this.unsubscribeItems) {
        this.unsubscribeItems()
        this.unsubscribeItems = null
      }
      if (this.unsubscribeCategories) {
        this.unsubscribeCategories()
        this.unsubscribeCategories = null
      }
    },

    /**
     * @async
     * @returns {Promise<void>}
     * @description Deletes selected items from the local database
     */
    async deleteSelected() {
      const selectedItems = this.selectedItems.filter(id => this.items.some(item => item.id === id))
      this.items = this.items.filter(item => !selectedItems.includes(item.id))
      this.selectedItems = []
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
          try {
            const lastSync = this.syncStatus.lastSync
            let firestoreQuery = query(collection(fireDb, 'categories'), orderBy('updatedAt', 'desc'))

            if (lastSync) {
              firestoreQuery = query(
                collection(fireDb, 'categories'),
                where('updatedAt', '>', new Date(lastSync)),
                orderBy('updatedAt', 'desc')
              )
            }

            const snapshot = await getDocs(firestoreQuery)
            const firestoreCategories = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate() || new Date(),
              updatedAt: doc.data().updatedAt?.toDate() || new Date()
            }))

            await this.mergeCategoriesWithFirestore(localCategories, firestoreCategories)
          } catch (error) {
            console.error('Error syncing categories with Firestore:', error)
          }
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
    async mergeCategoriesWithFirestore(localCategories, firestoreCategories) {
      try {
        const batch = writeBatch(fireDb)
        const updates = []

        for (const localCat of localCategories) {
          const firestoreCat = firestoreCategories.find(fc => fc.id === localCat.id)
          if (!firestoreCat) {
            if (localCat.id.startsWith('temp_')) {
              const docRef = doc(collection(fireDb, 'categories'))
              batch.set(docRef, {
                name: localCat.name,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              })
              updates.push({
                type: 'update',
                oldId: localCat.id,
                newId: docRef.id,
                data: localCat
              })
            }
          } else if (new Date(localCat.updatedAt) > new Date(firestoreCat.updatedAt)) {
            const docRef = doc(fireDb, 'categories', localCat.id)
            batch.update(docRef, {
              name: localCat.name,
              updatedAt: serverTimestamp()
            })
          }
        }

        for (const firestoreCat of firestoreCategories) {
          const localCat = localCategories.find(lc => lc.id === firestoreCat.id)
          if (!localCat) {
            await db.categories.add({
              id: firestoreCat.id,
              name: firestoreCat.name,
              createdAt: firestoreCat.createdAt,
              updatedAt: firestoreCat.updatedAt
            })
          } else if (new Date(firestoreCat.updatedAt) > new Date(localCat.updatedAt)) {
            await db.categories.update(localCat.id, {
              name: firestoreCat.name,
              updatedAt: firestoreCat.updatedAt
            })
          }
        }

        await batch.commit()

        for (const update of updates) {
          if (update.type === 'update') {
            await db.categories.where('id').equals(update.oldId).modify(category => {
              category.id = update.newId
            })
          }
        }

        const updatedCategories = await db.categories.toArray()
        this.categories = updatedCategories
      } catch (error) {
        console.error('Error merging categories:', error)
        throw error
      }
    },

    /**
     * @async
     * @param {string} categoryName - Category name to add
     * @returns {Promise<Object|null>} Added category object or null on error
     * @description Adds a category to the database and syncs with Firestore
     */
    async addCategory(categoryName) {
      try {
        if (!categoryName || typeof categoryName !== 'string')
          throw new Error('Invalid category name')

        const existingCategory = this.categories.find(
          c => c.name.toLowerCase() === categoryName.toLowerCase()
        )
        if (existingCategory)
          throw new Error('Category already exists')

        const tempId = 'temp_' + Date.now()
        const newCategory = {
          id: tempId,
          name: categoryName,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        await db.categories.add(newCategory)
        this.categories.push(newCategory)

        if (isOnline.value) {
          try {
            const docRef = await addDoc(collection(fireDb, 'categories'), {
              name: categoryName,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            })

            await db.categories.where('id').equals(tempId).modify(category => {
              category.id = docRef.id
            })

            this.categories = this.categories.map(c =>
              c.id === tempId ? { ...c, id: docRef.id } : c
            )

            return { id: docRef.id, name: categoryName }
          } catch (error) {
            console.error('Error adding category to Firestore:', error)
            await syncQueue.addToQueue({
              type: 'add',
              collection: 'categories',
              data: {
                name: categoryName,
                createdAt: new Date(),
                updatedAt: new Date()
              },
              tempId
            })
            return { id: tempId, name: categoryName }
          }
        } else {
          await syncQueue.addToQueue({
            type: 'add',
            collection: 'categories',
            data: {
              name: categoryName,
              createdAt: new Date(),
              updatedAt: new Date()
            },
            tempId
          })
          return { id: tempId, name: categoryName }
        }
      } catch (error) {
        console.error('Error adding category:', error)
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
        await db.categories.delete(categoryId)

        this.categories = this.categories.filter(c => c.id !== categoryId)

        if (isOnline.value) {
          try {
            const docRef = doc(fireDb, 'categories', categoryId)
            await deleteDoc(docRef)
          } catch (error) {
            console.error('Error deleting category from Firestore:', error)
            await syncQueue.addToQueue({
              type: 'delete',
              collection: 'categories',
              docId: categoryId
            })
            this.error = handleError(error, 'Failed to delete category')
            return false
          }
        } else {
          await syncQueue.addToQueue({
            type: 'delete',
            collection: 'categories',
            docId: categoryId
          })
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
     * @returns {Promise<number>} The number of items that were successfully retried.
     * @description Retries syncing all failed items.
     */
    async retryAllFailedItems() {
      const failedItems = [...this.syncStatus.failedItems]
      const results = await Promise.allSettled(
        failedItems.map(item => this.retryFailedSync(item))
      )

      return results.filter(result => result.status === 'fulfilled' && result.value).length
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
        const seenFirebaseIds = new Set()
        const duplicates = []

        for (const item of allItems) {
          if (item.firebaseId) {
            if (seenFirebaseIds.has(item.firebaseId)) {
              duplicates.push(item.id)
            } else {
              seenFirebaseIds.add(item.firebaseId)
            }
          }
        }

        if (duplicates.length > 0) {
          await db.transaction('rw', db.items, async () => {
            for (const id of duplicates) {
              await db.items.delete(id)
            }
          })
          
          console.log(`Cleaned up ${duplicates.length} duplicate items`)
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
      this.cleanupListeners()
      
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
        this.inventoryData = []
        this.lowStockAlerts = []
        this.topSellingProducts = []
      }

      // Reset sync status
      this.syncStatus = {
        lastSync: null,
        inProgress: false,
        error: null,
        pendingChanges: 0,
        totalItems: 0,
        processedItems: 0,
        failedItems: [],
        retryCount: 0,
        maxRetries: 3,
        retryDelay: 1000
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
     * @param {Array} items - Array of items to process
     * @param {number} batchSize - Size of each batch
     * @param {Function} processFn - Function to process each batch
     * @returns {Promise<void>}
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
