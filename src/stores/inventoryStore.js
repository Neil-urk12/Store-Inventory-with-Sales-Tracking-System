/**
 * @fileoverview Manages inventory data and operations, including local and cloud synchronization.
 * Implements Pinia store pattern for state management.
 */

import { defineStore } from 'pinia'
import { db } from '../db/dexiedb'
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore'
import { db as fireDb } from '../firebase/firebaseconfig'
import { useNetworkStatus } from '../services/networkStatus'
import { syncQueue } from '../services/syncQueue'
import debounce from 'lodash/debounce'
import { formatDate } from '../utils/dateUtils'
import { date } from 'quasar'
import { useFinancialStore } from './financialStore'
import { processItem, validateItem, handleError } from '../utils/inventoryUtils'

// Get network status at the store level
const { isOnline } = useNetworkStatus()
const financialStore = useFinancialStore()
// Constants
const BATCH_SIZE = 500
const DEFAULT_SORT = 'name'
const DEFAULT_SORT_DIRECTION = 'asc'
const SORT_OPTIONS = [
  { label: 'Name', value: 'name' },
  { label: 'Price', value: 'price' },
  { label: 'Quantity', value: 'quantity' },
  { label: 'Category', value: 'category' }
]

// Debounced search function to prevent excessive database calls
const debouncedSearch = debounce((store) => {
  store.loadInventory()
}, 300)

/**
 * @const {Store} useInventoryStore
 * @description Pinia store for managing inventory state and operations
 */
export const useInventoryStore = defineStore('inventory', {
  state: () => ({
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
      retryDelay: 1000 // 1 second delay between retries
    },
    sortBy: DEFAULT_SORT,
    sortDirection: DEFAULT_SORT_DIRECTION,
    sortOptions: SORT_OPTIONS,
    categories: [],
    categoryDialog: false,
    editedCategory: null,
    selectedItems: [],
    dateRange: {
      from: formatDate(new Date(), 'YYYY-MM-DD'),
      to: formatDate(new Date(), 'YYYY-MM-DD')
    },
    inventoryData: [],
    lowStockAlerts: [],
    topSellingProducts: [],
    chartData: {
      daily: { labels: [], datasets: [] },
      weekly: { labels: [], datasets: [] },
      monthly: { labels: [], datasets: [] }
    }
  }),

  getters: {
    /**
     * @getter
     * @returns {Array} Filtered items based on search query and category
     */
    filteredItems(state) {
      return state.items.filter(item => {
        const searchQuery = state.searchQuery?.toLowerCase() || ''
        const categoryFilter = state.categoryFilter

        // Search in multiple fields
        const matchesSearch = !searchQuery || [
          item.name,
          item.sku,
          this.getCategoryName(item.categoryId)
        ].some(field =>
          String(field).toLowerCase().includes(searchQuery)
        )

        // Category filter
        const matchesCategory = !categoryFilter || item.categoryId === categoryFilter

        return matchesSearch && matchesCategory
      })
    },

    /**
     * @getter
     * @returns {Function} Function to get category name from ID
     */
    getCategoryName: (state) => (categoryId) => {
      // If no categoryId is provided, return Uncategorized
      if (!categoryId) return 'Uncategorized'

      if (typeof categoryId === 'string' && !state.categories.find(cat => cat.id === categoryId))
        return categoryId

      // Otherwise look up the category by ID
      const category = state.categories.find(cat => cat.id === categoryId)
      return category ? category.name : 'Uncategorized'
    },

    /**
     * @getter
     * @returns {Array} Sorted items based on the current sort options
     */
    sortedItems(state) {
      const items = this.filteredItems
      if (state.sortBy) {
        items.sort((a, b) => {
          let aVal = a[state.sortBy]
          let bVal = b[state.sortBy]

          // Map categoryId to category name for sorting
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
     * @getter
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
     * @getter
     * @returns {Array} Items with low stock levels
     */
    getLowStockItems(state) {
      return state.inventoryData.filter(item => item.currentStock <= item.minStock * 1.2)
    },

    /**
     * @getter
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
     * @getter
     * @returns {Array} List of unique categories
     */
    getCategories() {
      return [...new Set(this.items.map(item => item.category))]
    },

    /**
     * @getter
     * @returns {Array} Recently added products
     */
    getRecentlyAddedProducts() {
      return [...this.items]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
    },

    /**
     * @getter
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
     * @method initializeDb
     * @returns {Promise<void>}
     * @description Initializes the database and performs initial sync if needed
     */
    async initializeDb() {
      try {
        const existingItems = await db.items.count()

        // Always try to sync with Firestore when online, not just when empty
          if (isOnline.value) {
            await this.syncWithFirestore()
            await syncQueue.processQueue()
          }

        // If we're still empty after sync attempt, and we're offline,
        // we'll wait for online status to try again
        if (existingItems === 0 && !isOnline.value) {
          this.error = 'No local data available. Waiting for network connection...'
        }

        await this.loadInventory()
        await this.loadCategories()
      } catch (error) {
        this.error = handleError(error, 'Failed to initialize database')
      }
    },

    /**
     * @async
     * @method loadInventory
     * @returns {Promise<void>}
     * @description Loads inventory from local database and syncs with Firestore if online
     */
    async loadInventory() {
      try {
        this.loading = true

        // Load from local first
        const localItems = await db.getAllItems()
        this.items = localItems.map(processItem)

        // If we have no items locally and we're online, force a sync
        if (localItems.length === 0 && isOnline.value) {
          await this.syncWithFirestore()
          const updatedItems = await db.getAllItems()
          this.items = updatedItems.map(processItem)
        }

        else if (isOnline.value) await this.syncWithFirestore()

      } catch (error) {
        this.error = handleError(error, 'Failed to load inventory')
      } finally {
        this.loading = false
      }
    },

    /**
     * @async
     * @method createNewItem
     * @param {Object} item - New item to create
     * @returns {Promise<Object>} Created item result
     */
    async createNewItem(item) {
      this.loading = true;

      try {
        // Validate item before saving
        const errors = validateItem(item);
        if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`)
        }

        // Process item (format data, set defaults, etc.)
        const processedItem = processItem(item)
        const result = await db.createItem(processedItem)

        if (isOnline.value) {
          try {
            // Add to Firestore if online
            const docRef = await addDoc(collection(fireDb, 'items'), {
              ...processedItem,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            await db.updateItem(result, { firebaseId: docRef.id });
            return { id: result, offline: false };
          } catch (firebaseError) {
            console.error('Firebase error:', firebaseError);
            // If Firebase fails, queue for sync
            await this.queueForSync('create', processedItem, result);
            return { id: result, offline: true };
          }
        }

        // Queue for sync if offline
        await this.queueForSync('create', processedItem, result);
        await this.loadInventory();
        return { id: result, offline: true };
      } catch (error) {
        console.error('Error creating item:', error);
        this.syncStatus.failedItems.push({
          ...item,
          error: error.message,
          syncOperation: 'create'
        })
        throw error;
      } finally {
        this.loading = false;
      }
    },

    /**
     * @async
     * @method updateExistingItem
     * @param {string} id - Item ID to update
     * @param {Object} changes - Changes to apply
     * @returns {Promise<Object>} Update result
     */
    async updateExistingItem(id, changes) {
      this.loading = true;

      try {
        // Validate changes before updating
        const errors = validateItem({ ...changes, id });
        if (errors.length > 0) {
          throw new Error(`Validation failed: ${errors.join(', ')}`);
        }

        // Process changes
        const processedChanges = processItem(changes);
        const result = await db.updateExistingItem(id, processedChanges);

        if (isOnline.value) {
          const item = await db.items.get(id);
          if (item?.firebaseId) {
            try {
              await updateDoc(doc(fireDb, 'items', item.firebaseId), {
                ...processedChanges,
                updatedAt: serverTimestamp()
              });
              return { id, offline: false };
            } catch (firebaseError) {
              console.error('Firebase error:', firebaseError);
              // If Firebase fails, queue for sync
              await this.queueForSync('update', processedChanges, id);
              return { id, offline: true };
            }
          }
        }

        // Queue for sync if offline
        await this.queueForSync('update', processedChanges, id);
        await this.loadInventory();
        return { id, offline: true };
      } catch (error) {
        console.error('Error updating item:', error);
        this.syncStatus.failedItems.push({
          ...changes,
          error: error.message,
          syncOperation: 'update'
        })
        throw error;
      } finally {
        this.loading = false;
      }
    },

    /**
     * @async
     * @method queueForSync
     * @param {string} type - Operation type ('create' or 'update')
     * @param {Object} data - Data to sync
     * @param {string} docId - Document ID
     * @private
     */
    async queueForSync(type, data, docId) {
      await syncQueue.add({
        type,
        collection: 'items',
        data,
        docId,
        timestamp: new Date().toISOString(),
        attempts: 0,
        status: 'pending'
      });
    },

    /**
     * @async
     * @method deleteItem
     * @param {string} id - Item ID to delete
     * @returns {Promise<string>} Deleted item ID
     * @description Deletes an item from the local database and queues for sync
     */
    async deleteItem(id) {
      try {
        const item = await db.items.get(id)
        if (!item) throw new Error('Item not found')

      // Always delete from local DB first
        await db.transaction('rw', db.items, async () => {
          await db.items.delete(id)
        })

        // If online and item was synced with Firestore, delete from Firestore
        if (isOnline.value && item.firebaseId) {
          try {
            const docRef = doc(fireDb, 'items', item.firebaseId)
            await deleteDoc(docRef)
          } catch (error) {
            console.error('Error deleting from Firestore:', error)
            // Queue for sync if Firestore delete fails
            await syncQueue.addToQueue({
              type: 'delete',
              collection: 'items',
              docId: id,
              firebaseId: item.firebaseId
            })
          }
        } else if (item.firebaseId) {
          // Offline but item exists in Firestore, queue for sync
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
      if (!isOnline.value) return

      try {
        const localItems = await db.items.toArray()

        const firestoreSnapshot = await getDocs(
          query(collection(fireDb, 'items'), orderBy('updatedAt', 'desc'))
        )
        const firestoreItems = firestoreSnapshot.docs.map(doc => ({
          ...doc.data(),
          firebaseId: doc.id
        }))

        // Make sure categories are loaded before processing items
        await this.loadCategories()

        for (const firestoreItem of firestoreItems) {
          try {
            // Check if item already exists by firebaseId
            const existingItems = await db.items
              .where('firebaseId')
              .equals(firestoreItem.firebaseId)
              .toArray()

            if (existingItems.length > 0) {
              // Update the first instance and delete any duplicates
              const [itemToKeep, ...duplicates] = existingItems

              if (itemToKeep.syncStatus !== 'pending') {
                const firestoreDate = new Date(firestoreItem.updatedAt)
                const localDate = new Date(itemToKeep.updatedAt)

                if (firestoreDate > localDate) {
                  await db.items.update(itemToKeep.id, {
                    ...firestoreItem,
                    id: itemToKeep.id,
                    syncStatus: 'synced'
                  })
                }
              }

              // Delete any duplicate entries
              for (const duplicate of duplicates) {
                await db.items.delete(duplicate.id)
              }
            } else if (firestoreItem.localId) {
              // This is a new item from another client
              const existingLocal = await db.items
                .where('id')
                .equals(parseInt(firestoreItem.localId))
                .first()

              if (!existingLocal) {
                await db.items.add({
                  ...firestoreItem,
                  syncStatus: 'synced'
                })
              }
            } else {
              // Completely new item
              await db.items.add({
                ...firestoreItem,
                syncStatus: 'synced'
              })
            }
          } catch (itemError) {
            // Track failed items individually
            this.syncStatus.failedItems.push({
              ...firestoreItem,
              error: itemError.message,
              syncOperation: 'create'
            })
          }
        }

        await this.mergeChanges(localItems, firestoreItems)
        this.items = await db.getAllItems()
      } catch (error) {
        console.error('Error syncing with Firestore:', error)
        this.error = handleError(error, 'Failed to sync with Firestore')
        throw error
      }
    },

    /**
     * @async
     * @method mergeChanges
     * @param {Array} localItems - Local items to merge
     * @param {Array} firestoreItems - Firestore items to merge
     * @returns {Promise<void>}
     * @description Merges local and Firestore items, resolving conflicts
     */
    async mergeChanges(localItems, firestoreItems) {
      return await db.transaction('rw', db.items, async () => {
        // Only process items that are already synced (not pending local changes)
        for (const firestoreItem of firestoreItems) {
          // Check if item already exists by firebaseId
          const existingItems = await db.items
            .where('firebaseId')
            .equals(firestoreItem.firebaseId)
            .toArray()

          if (existingItems.length > 0) {
            // Update the first instance and delete any duplicates
            const [itemToKeep, ...duplicates] = existingItems

            if (itemToKeep.syncStatus !== 'pending') {
              const firestoreDate = new Date(firestoreItem.updatedAt)
              const localDate = new Date(itemToKeep.updatedAt)

              if (firestoreDate > localDate) {
                await db.items.update(itemToKeep.id, {
                  ...firestoreItem,
                  id: itemToKeep.id,
                  syncStatus: 'synced'
                })
              }
            }

            // Delete any duplicate entries
            for (const duplicate of duplicates) {
              await db.items.delete(duplicate.id)
            }
          } else if (firestoreItem.localId) {
            // This is a new item from another client
            const existingLocal = await db.items
              .where('id')
              .equals(parseInt(firestoreItem.localId))
              .first()

            if (!existingLocal) {
              await db.items.add({
                ...firestoreItem,
                syncStatus: 'synced'
              })
            }
          } else {
            // Completely new item
            await db.items.add({
              ...firestoreItem,
              syncStatus: 'synced'
            })
          }
        }

        // Don't delete local items that haven't been synced yet
        for (const localItem of localItems) {
          if (localItem.firebaseId &&
              !firestoreItems.find(item => item.firebaseId === localItem.firebaseId)) {
            const currentItem = await db.items.get(localItem.id)
            if (currentItem.syncStatus !== 'pending') {
              await db.items.delete(localItem.id)
            }
          }
        }
      })
    },

    /**
     * @async
     * @method addItem
     * @param {Object} item - Item to add
     * @returns {Promise<string>} Added item ID
     * @description Adds an item to the local database and queues for sync
     */
    async addItem(item) {
      try {
        const id = await db.addItem(item)
        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'add',
            collection: 'inventory',
            data: { ...item, localId: id },
            timestamp: new Date()
          })
          await syncQueue.processQueue()
        }

        await this.loadInventory()
        return id
      } catch (error) {
        console.error('Error adding item:', error)
        this.error = error.message
        throw error
      }
    },

    /**
     * @async
     * @method deleteSelected
     * @returns {Promise<void>}
     * @description Deletes selected items from the local database
     */
    async deleteSelected() {
      const selectedItems = this.selectedItems.filter(id => this.items.some(item => item.id === id))
      // Uncomment the API call here
      this.items = this.items.filter(item => !selectedItems.includes(item.id))
      this.selectedItems = []
    },

    /**
     * @async
     * @method loadCategories
     * @returns {Promise<void>}
     * @description Loads categories from the database and syncs with Firestore
     */
    async loadCategories() {
      try {
        this.loading = true

        // Load from local DB first
        const localCategories = await db.categories.toArray()
        this.categories = localCategories

        // Sync with Firestore if online
        if (isOnline.value) {
          try {
            const snapshot = await getDocs(query(collection(fireDb, 'categories'), orderBy('name')))
            const firestoreCategories = snapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate() || new Date(),
              updatedAt: doc.data().updatedAt?.toDate() || new Date()
            }))

            // Merge local and Firestore categories
            await this.mergeCategoriesWithFirestore(localCategories, firestoreCategories)
          } catch (error) {
            console.error('Error syncing categories with Firestore:', error)
            // Continue with local categories
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
     * @method mergeCategoriesWithFirestore
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

        // Handle local categories not in Firestore
        for (const localCat of localCategories) {
          const firestoreCat = firestoreCategories.find(fc => fc.id === localCat.id)
          if (!firestoreCat) {
            // Category exists locally but not in Firestore
            if (localCat.id.startsWith('temp_')) {
              // This is a new local category, add to Firestore
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
            // Local category is newer, update Firestore
            const docRef = doc(fireDb, 'categories', localCat.id)
            batch.update(docRef, {
              name: localCat.name,
              updatedAt: serverTimestamp()
            })
          }
        }

        // Handle Firestore categories not in local DB
        for (const firestoreCat of firestoreCategories) {
          const localCat = localCategories.find(lc => lc.id === firestoreCat.id)
          if (!localCat) {
            // Category exists in Firestore but not locally
            await db.categories.add({
              id: firestoreCat.id,
              name: firestoreCat.name,
              createdAt: firestoreCat.createdAt,
              updatedAt: firestoreCat.updatedAt
            })
          } else if (new Date(firestoreCat.updatedAt) > new Date(localCat.updatedAt)) {
            // Firestore category is newer, update local
            await db.categories.update(localCat.id, {
              name: firestoreCat.name,
              updatedAt: firestoreCat.updatedAt
            })
          }
        }

        // Commit Firestore changes
        await batch.commit()

        // Update local IDs for new categories
        for (const update of updates) {
          if (update.type === 'update') {
            await db.categories.where('id').equals(update.oldId).modify(category => {
              category.id = update.newId
            })
          }
        }

        // Reload categories from local DB
        const updatedCategories = await db.categories.toArray()
        this.categories = updatedCategories
      } catch (error) {
        console.error('Error merging categories:', error)
        throw error
      }
    },

    /**
     * @async
     * @method addCategory
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
              type: 'create',
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
            type: 'create',
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
     * @method deleteCategory
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
     * @method openCategoryDialog
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
     * @method closeCategoryDialog
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
     * @method getCategoryChartData
     * @returns {Object} Chart data for categories
     * @description Gets chart data for categories
     */
    getCategoryChartData() {
      // Group items by category and calculate total sales
      const categoryData = this.items.reduce((acc, item) => {
        if (!acc[item.category])
          acc[item.category] = 0
        // Assuming each item's sales contribution is quantity * price
        acc[item.category] += item.quantity * item.price
        return acc
      }, {})
      const labels = Object.keys(categoryData).map(category =>
        category.charAt(0).toUpperCase() + category.slice(1)
      )
      const data = Object.values(categoryData)

      const colors = [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
        '#FF9F40'
      ]

      return {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          hoverBackgroundColor: colors.slice(0, labels.length)
        }]
      }
    },

    /**
     * @async
     * @method getCategoryChartOptions
     * @param {string} textColor - Text color for the chart
     * @returns {Object} Chart options for categories
     * @description Gets chart options for categories
     */
    getCategoryChartOptions(textColor) {
      return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: textColor,
              font: {
                size: 12
              }
            }
          },
          title: {
            display: true,
            text: 'Sales by Category',
            color: textColor,
            font: {
              size: 16
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || ''
                const value = context.raw || 0
                const total = context.dataset.data.reduce((a, b) => a + b, 0)
                const percentage = ((value / total) * 100).toFixed(1)
                return `${label}: ${financialStore.formatCurrency(value)} (${percentage}%)`
              }
            }
          }
        }
      }
    },

    /**
     * @async
     * @method openItemDialog
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
     * @method closeItemDialog
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
     * @method confirmDelete
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
     * @method handleDeleteConfirm
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
     * @method handleSearch
     * @description Handles search query changes
     */
    handleSearch() {
      // Reactive through state, but we can add logging or additional handling here
    },

    /**
     * @method handleFilters
     * @description Handles category filter changes
     */
    handleFilters() {
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
            // Handle cells that contain commas or quotes
            if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
              cell = `"${cell.replace(/"/g, '""')}"` // escape double quotes
            }
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

    getChartData(timeframe) {
      const labels = []
      const salesData = []

      // Sample data generation based on timeframe
      const now = new Date()
      let dataPoints = 0

      switch (timeframe) {
        case 'daily':
          dataPoints = 7
          for (let i = dataPoints - 1; i >= 0; i--) {
            const date = new Date(now)
            date.setDate(date.getDate() - i)
            labels.push(formatDate(date, 'MM/DD'))
            salesData.push(Math.floor(Math.random() * 1000))
          }
          break
        case 'weekly':
          dataPoints = 4
          for (let i = dataPoints - 1; i >= 0; i--) {
            const date = new Date(now)
            date.setDate(date.getDate() - (i * 7))
            labels.push(`Week ${dataPoints - i}`)
            salesData.push(Math.floor(Math.random() * 5000))
          }
          break
        case 'monthly':
          dataPoints = 12
          for (let i = dataPoints - 1; i >= 0; i--) {
            const date = new Date(now)
            date.setMonth(date.getMonth() - i)
            labels.push(formatDate(date, 'MMM'))
            salesData.push(Math.floor(Math.random() * 20000))
          }
          break
        case 'yearly':
          dataPoints = 5
          for (let i = dataPoints - 1; i >= 0; i--) {
            const date = new Date(now)
            date.setFullYear(date.getFullYear() - i)
            labels.push(date.getFullYear().toString())
            salesData.push(Math.floor(Math.random() * 100000))
          }
          break
      }

      return {
        labels,
        datasets: [{
          label: 'Sales',
          data: salesData,
          backgroundColor: '#1976D2',
          borderColor: '#1976D2',
          borderWidth: 1
        }]
      }
    },

    getChartOptions(textColor) {
      return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: textColor + '20'
            },
            ticks: {
              color: textColor
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: textColor
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    },

    async retryFailedSync(item) {
      const { retryCount, maxRetries, retryDelay } = this.syncStatus

      if (retryCount >= maxRetries) {
        console.error(`Max retries (${maxRetries}) reached for item:`, item.id)
        return false
      }

      try {
        this.syncStatus.retryCount++
        await new Promise(resolve => setTimeout(resolve, retryDelay))

        if (item.syncOperation === 'create') {
          await this.createNewItem(item)
        } else if (item.syncOperation === 'update') {
          await this.updateExistingItem(item.id, item)
        } else if (item.syncOperation === 'delete') {
          await this.deleteItem(item.id)
        }

        // Remove from failed items if successful
        this.syncStatus.failedItems = this.syncStatus.failedItems.filter(
          failed => failed.id !== item.id
        )
        return true
      } catch (error) {
        console.error(`Retry failed for item ${item.id}:`, error)
        return false
      }
    },

    async retryAllFailedItems() {
      const failedItems = [...this.syncStatus.failedItems]
      const results = await Promise.allSettled(
        failedItems.map(item => this.retryFailedSync(item))
      )

      return results.filter(result => result.status === 'fulfilled' && result.value).length
    },

    async cleanupDuplicates() {
      try {
        this.loading = true
        await db.transaction('rw', db.items, async () => {
          // Get all items
          const allItems = await db.items.toArray()

          // Group items by firebaseId
          const groupedItems = allItems.reduce((acc, item) => {
            if (!item.firebaseId) return acc
            if (!acc[item.firebaseId]) acc[item.firebaseId] = []
            acc[item.firebaseId].push(item)
            return acc
          }, {})

          // For each group of items with the same firebaseId
          for (const [firebaseId, items] of Object.entries(groupedItems)) {
            if (items.length > 1) {
              // Keep the first item, delete the rest
              const [itemToKeep, ...duplicates] = items

              // Delete duplicates
              for (const duplicate of duplicates) {
                await db.items.delete(duplicate.id)
              }
            }
          }
        })

        // Reload inventory after cleanup
        await this.loadInventory()
      } catch (error) {
        this.error = handleError(error, 'Failed to cleanup duplicates')
      } finally {
        this.loading = false
      }
    },

    cleanup(fullCleanup = false) {
      // Cancel any pending debounced operations
      if (debouncedSearch && typeof debouncedSearch.cancel === 'function') {
        debouncedSearch.cancel()
      }

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
  }
})
