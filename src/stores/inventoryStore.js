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

/**
 * @function processItem
 * @param {Object} item - Raw item data
 * @returns {Object} Processed item with defaults and type conversions
 * @description Processes raw item data, ensuring all required fields are present and properly typed
 */
const processItem = (item) => ({
  ...item,
  category: item.category || 'Uncategorized',
  quantity: Number(item.quantity) || 0,
  price: Number(item.price) || 0,
  createdAt: item.createdAt || new Date().toISOString()
})

/**
 * @function validateItem
 * @param {Object} item - Item to validate
 * @returns {Array<string>} Array of validation error messages
 * @description Validates item data before saving
 */
const validateItem = (item) => {
  const errors = []
  if (!item.name?.trim()) errors.push('Name is required')
  if (!item.sku?.trim()) errors.push('SKU is required')
  if (typeof item.quantity !== 'number') errors.push('Quantity must be a number')
  if (typeof item.price !== 'number') errors.push('Price must be a number')
  if (item.price < 0) errors.push('Price cannot be negative')
  if (item.quantity < 0) errors.push('Quantity cannot be negative')
  // Image is optional, but validate URL format if provided
  if (item.image && item.image.trim()) {
    try {
      new URL(item.image)
    } catch (e) {
      errors.push('Invalid image URL format')
    }
  }
  return errors
}

/**
 * @function handleError
 * @param {Error} error - Error to handle
 * @param {*} fallback - Fallback value if needed
 * @throws {Error} Rethrows error if no fallback provided
 */
const handleError = (error, fallback = null) => {
  console.error('Operation failed:', error)
  if (fallback !== null) return fallback
  throw error
}

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
      pendingChanges: 0
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
    salesData: [],
    selectedTimeframe: 'daily',
    profitTimeframe: 'daily',
    cashFlowTransactions: {
      Cash: [],
      GCash: [],
      Growsari: []
    },
    inventoryData: [],
    financialData: [],
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
     * @returns {Array} Filtered and sorted items based on search query and category
     */
    filteredItems(state) {
      return state.items.filter(item => {
        const matchesSearch = !state.searchQuery ||
          item.name.toLowerCase().includes(state.searchQuery.toLowerCase())
        const matchesCategory = !state.categoryFilter ||
          item.category === state.categoryFilter
        return matchesSearch && matchesCategory
      })
    },

    /**
     * @getter
     * @returns {Array} Sorted items based on the current sort options
     */
    sortedItems(state) {
      const items = [...state.filteredItems]

      if (!state.sortBy || !SORT_OPTIONS.some(opt => opt.value === state.sortBy)) {
        return items
      }

      const getValue = (item) => {
        const value = item[state.sortBy]
        return value == null ? '' : value
      }

      return items.sort((a, b) => {
        const aVal = getValue(a)
        const bVal = getValue(b)

        const compare = typeof aVal === 'string'
          ? aVal.localeCompare(bVal)
          : aVal - bVal

        return state.sortDirection === 'asc' ? compare : -compare
      })
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
     * @returns {number} Total revenue from sales data
     */
    getTotalRevenue(state) {
      return state.salesData.reduce((sum, item) => sum + item.revenue, 0)
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
     * @returns {number} Net profit from financial data
     */
    getNetProfit(state) {
      return state.financialData.find(item => item.category === 'Net Profit')?.amount || 0
    },

    /**
     * @getter
     * @returns {number} Daily profit from sales data
     */
    getDailyProfit() {
      const today = new Date().toISOString().split('T')[0]
      return (this.salesData || [])
        .filter(sale => sale?.date?.startsWith(today))
        .reduce((total, sale) => total + ((sale?.price || 0) * (sale?.quantity || 0)), 0)
    },

    /**
     * @getter
     * @returns {number} Daily expense from cash flow transactions
     */
    getDailyExpense() {
      const today = new Date().toISOString().split('T')[0]
      const cashTransactions = this.cashFlowTransactions?.Cash || []
      return cashTransactions
        .filter(t => t?.date?.startsWith(today) && t?.type === 'expense')
        .reduce((total, t) => total + (t?.amount || 0), 0)
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
        value: category.value
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
        if (existingItems === 0) {
          const { isOnline } = useNetworkStatus()
          if (isOnline.value) {
            await this.syncWithFirestore()
            await syncQueue.processQueue()
          }
        }
        await this.loadInventory()
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
        console.log('Loading inventory...')

        // Load from local first
        const localItems = await db.getAllItems()
        this.items = localItems.map(processItem)

        // Sync with Firestore if online
        const { isOnline } = useNetworkStatus()
        if (isOnline.value) {
          await this.syncWithFirestore()
        }
      } catch (error) {
        this.error = handleError(error, 'Failed to load inventory')
      } finally {
        this.loading = false
      }
    },

    /**
     * @async
     * @method saveItem
     * @param {Object} item - Item to save
     * @returns {Promise<string>} Saved item ID
     * @description Saves an item to the local database and queues for sync
     */
    async saveItem(item) {
      const errors = validateItem(item)
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`)
      }

      const processedItem = processItem(item)
      let savedId

      // Always save to local DB first
      await db.transaction('rw', db.items, async () => {
        try {
          // Save to local DB
          savedId = await db.items.add({
            ...processedItem,
            syncStatus: 'pending',
            firebaseId: null,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString()
          })

          // Queue for sync
          await syncQueue.addToQueue({
            type: 'add',
            collection: 'items',
            data: {
              ...processedItem,
              id: savedId
            }
          })
        } catch (error) {
          console.error('Error saving item locally:', error)
          throw error
        }
      })

      return savedId
    },

    /**
     * @async
     * @method updateItem
     * @param {string} id - Item ID to update
     * @param {Object} changes - Changes to apply to the item
     * @returns {Promise<string>} Updated item ID
     * @description Updates an item in the local database and queues for sync
     */
    async updateItem(id, changes) {
      const item = await db.items.get(id)
      if (!item) throw new Error('Item not found')

      const updatedItem = { ...item, ...changes }
      const errors = validateItem(updatedItem)
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${errors.join(', ')}`)
      }

      // Add version tracking
      const version = (item.version || 0) + 1
      const timestamp = new Date().toISOString()

      // Always update local DB first with transaction
      return await db.transaction('rw', db.items, async () => {
        try {
          // Check if item was modified during our operation
          const currentItem = await db.items.get(id)
          if (currentItem.version !== item.version) {
            throw new Error('Item was modified by another process')
          }

          // Update local DB
          await db.items.update(id, {
            ...changes,
            version,
            syncStatus: 'pending',
            updatedAt: timestamp
          })

          // Queue for sync
          await syncQueue.addToQueue({
            type: 'update',
            collection: 'items',
            data: {
              ...changes,
              id,
              version,
              updatedAt: timestamp
            }
          })

          return id
        } catch (error) {
          // Attempt to rollback the local update
          if (error.message !== 'Item was modified by another process') {
            try {
              await db.items.update(id, item)
            } catch (rollbackError) {
              console.error('Failed to rollback local update:', rollbackError)
            }
          }
          throw error
        }
      })
    },

    /**
     * @async
     * @method deleteItem
     * @param {string} id - Item ID to delete
     * @returns {Promise<string>} Deleted item ID
     * @description Deletes an item from the local database and queues for sync
     */
    async deleteItem(id) {
      const item = await db.items.get(id)
      if (!item) throw new Error('Item not found')

      // Always delete from local DB first
      await db.transaction('rw', db.items, async () => {
        try {
          await db.items.delete(id)

          // Queue for sync only if item was previously synced
          if (item.firebaseId) {
            await syncQueue.addToQueue({
              type: 'delete',
              collection: 'items',
              docId: id
            })
          }
        } catch (error) {
          console.error('Error deleting item locally:', error)
          throw error
        }
      })

      return id
    },

    /**
     * @async
     * @method syncWithFirestore
     * @returns {Promise<void>}
     * @description Syncs local database with Firestore
     */
    async syncWithFirestore() {
      const { isOnline } = useNetworkStatus()
      if (!isOnline.value) return

      try {
        // Get all local items that have been synced before
        const localItems = await db.items
          .where('syncStatus')
          .equals('synced')
          .toArray()

        // Get all Firestore items
        const firestoreSnapshot = await getDocs(
          query(collection(fireDb, 'items'), orderBy('updatedAt', 'desc'))
        )
        const firestoreItems = firestoreSnapshot.docs.map(doc => ({
          ...doc.data(),
          firebaseId: doc.id
        }))

        await this.mergeChanges(localItems, firestoreItems)
      } catch (error) {
        console.error('Error syncing with Firestore:', error)
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
          const localItem = localItems.find(
            item => item.firebaseId === firestoreItem.firebaseId
          )

          if (localItem) {
            // Only update if the item is not pending local changes
            const currentItem = await db.items.get(localItem.id)
            if (currentItem.syncStatus !== 'pending') {
              const firestoreDate = new Date(firestoreItem.updatedAt)
              const localDate = new Date(currentItem.updatedAt)

              if (firestoreDate > localDate) {
                await db.items.update(localItem.id, {
                  ...firestoreItem,
                  id: localItem.id,
                  syncStatus: 'synced'
                })
              }
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
        const { isOnline } = useNetworkStatus()

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
     * @method generateSalesReport
     * @returns {Promise<Array>} Sales report data
     * @description Generates a sales report for the specified date range
     */
    async generateSalesReport() {
      try {
        this.loading = true;
        const { from, to } = this.dateRange;

        // Fetch sales data from database for the date range
        const salesData = await db.sales
          .where('date')
          .between(from, to)
          .toArray();

        return salesData.map(sale => ({
          id: sale.id,
          date: sale.date,
          amount: sale.amount,
          items: sale.items
        }));
      } catch (error) {
        console.error('Error generating sales report:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    /**
     * @async
     * @method generateFinancialReport
     * @returns {Promise<Object>} Financial report data
     * @description Generates a financial report for the specified date range
     */
    async generateFinancialReport() {
      try {
        this.loading = true;
        const { from, to } = this.dateRange;

        // Fetch financial data from database for the date range
        const transactions = await db.cashFlow
          .where('date')
          .between(from, to)
          .toArray();

        // Calculate totals
        const totals = transactions.reduce((acc, curr) => {
          if (curr.type === 'income') {
            acc.revenue += curr.amount;
          } else if (curr.type === 'expense') {
            acc.expenses += curr.amount;
          }
          return acc;
        }, { revenue: 0, expenses: 0 });

        return {
          ...totals,
          profit: totals.revenue - totals.expenses,
          period: { start: from, end: to }
        };
      } catch (error) {
        console.error('Error generating financial report:', error);
        throw error;
      } finally {
        this.loading = false;
      }
    },

    /**
     * @async
     * @method formatDate
     * @param {string} dateStr - Date string to format
     * @returns {string} Formatted date string
     * @description Formats a date string for display
     */
    formatDate(dateStr) {
      if (!dateStr) return ''
      return formatDate(new Date(dateStr), 'MM/DD/YY HH:mm:ss')
    },

    /**
     * @async
     * @method setDateRange
     * @param {Object} range - Date range to set
     * @returns {void}
     * @description Sets the date range for reports
     */
    setDateRange(range) {
      this.dateRange = {
        from: formatDate(new Date(range.from), 'YYYY-MM-DD'),
        to: formatDate(new Date(range.to), 'YYYY-MM-DD')
      }
    },

    /**
     * @async
     * @method fetchCashFlowTransactions
     * @param {string} paymentMethod - Payment method to fetch transactions for
     * @returns {Promise<boolean>} Success flag
     * @description Fetches cash flow transactions for the specified payment method
     */
    async fetchCashFlowTransactions(paymentMethod) {
      try {
        const q = query(
          collection(fireDb, `cashFlow_${paymentMethod}`),
          orderBy('date', 'desc')
        )

        const querySnapshot = await getDocs(q)
        this.cashFlowTransactions[paymentMethod] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate() || new Date()
        }))

        return true
      } catch (error) {
        console.error('Error fetching transactions:', error)
        return false
      }
    },

    /**
     * @async
     * @method getBalance
     * @param {string} paymentMethod - Payment method to get balance for
     * @returns {number} Balance
     * @description Gets the balance for the specified payment method
     */
    getBalance(paymentMethod) {
      if (!this.cashFlowTransactions[paymentMethod]) {
        return 0
      }
      return this.cashFlowTransactions[paymentMethod].reduce((total, transaction) => {
        return total + (transaction.type === 'in' ? transaction.value : -transaction.value)
      }, 0)
    },

    /**
     * @async
     * @method formatCurrency
     * @param {number} value - Value to format
     * @returns {string} Formatted currency string
     * @description Formats a value as a currency string
     */
    formatCurrency(value) {
      if (!value && value !== 0) {
        return new Intl.NumberFormat('en-PH', {
          style: 'currency',
          currency: 'PHP'
        }).format(0)
      }
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
      }).format(value)
    },

    /**
     * @async
     * @method deleteCashFlowTransaction
     * @param {string} paymentMethod - Payment method to delete transaction for
     * @param {string} transactionId - Transaction ID to delete
     * @returns {Promise<boolean>} Success flag
     * @description Deletes a cash flow transaction
     */
    async deleteCashFlowTransaction(paymentMethod, transactionId) {
      try {
        const docRef = doc(fireDb, `cashFlow_${paymentMethod}`, transactionId)
        await deleteDoc(docRef)

        // Update local state
        this.cashFlowTransactions[paymentMethod] = this.cashFlowTransactions[paymentMethod]
          .filter(t => t.id !== transactionId)

        return true
      } catch (error) {
        console.error('Error deleting transaction:', error)
        return false
      }
    },

    /**
     * @async
     * @method updateCashFlowTransaction
     * @param {string} paymentMethod - Payment method to update transaction for
     * @param {string} transactionId - Transaction ID to update
     * @param {Object} updatedData - Updated transaction data
     * @returns {Promise<boolean>} Success flag
     * @description Updates a cash flow transaction
     */
    async updateCashFlowTransaction(paymentMethod, transactionId, updatedData) {
      try {
        const docRef = doc(fireDb, `cashFlow_${paymentMethod}`, transactionId)
        await updateDoc(docRef, {
          ...updatedData,
          date: serverTimestamp()
        })

        // Update local state
        this.cashFlowTransactions[paymentMethod] = this.cashFlowTransactions[paymentMethod]
          .map(t => t.id === transactionId ? { ...t, ...updatedData, date: new Date() } : t)

        return true
      } catch (error) {
        console.error('Error updating transaction:', error)
        return false
      }
    },

    /**
     * @async
     * @method repopulateDatabase
     * @returns {Promise<void>}
     * @description Repopulates the database with mock data
     */
    async repopulateDatabase() {
      try {
        this.loading = true
        await db.repopulateWithMockData()
        await this.loadInventory()
      } catch (error) {
        console.error('Error repopulating database:', error)
        this.error = error.message
      } finally {
        this.loading = false
      }
    },

    /**
     * @async
     * @method loadCategories
     * @returns {Promise<void>}
     * @description Loads categories from the database
     */
    async loadCategories() {
      try {
        const categories = await db.categories.toArray()
        this.categories = categories
      } catch (error) {
        this.error = 'Failed to load categories'
        // Fallback to empty categories array instead of throwing
        this.categories = []
      }
    },

    /**
     * @async
     * @method addCategory
     * @param {string} categoryName - Category name to add
     * @returns {Promise<Object|null>} Added category object or null on error
     * @description Adds a category to the database
     */
    async addCategory(categoryName) {
      try {
        const exists = this.categories.some(
          cat => cat.name.toLowerCase() === categoryName.toLowerCase()
        )
        if (exists) {
          this.error = 'Category already exists'
          return null
        }

        const newCategory = {
          name: categoryName,
          value: categoryName.charAt(0).toLowerCase() + categoryName.slice(1),
          createdAt: new Date().toISOString()
        }
        const id = await db.categories.add(newCategory)
        const categoryWithId = { ...newCategory, id }
        this.categories.push(categoryWithId)
        this.error = null
        return categoryWithId
      } catch (error) {
        this.error = error.message || 'Failed to add category'
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
        this.categories = this.categories.filter(cat => cat.id !== categoryId)
        this.error = null
        return true
      } catch (error) {
        this.error = 'Failed to delete category'
        // Keep the UI state consistent even if DB operation fails
        this.categories = this.categories.filter(cat => cat.id !== categoryId)
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
        if (!acc[item.category]) {
          acc[item.category] = 0
        }
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
                return `${label}: ${this.formatCurrency(value)} (${percentage}%)`
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
  }
})
