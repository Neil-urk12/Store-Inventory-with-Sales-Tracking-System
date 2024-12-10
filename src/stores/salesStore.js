/**
 * @fileoverview Manages sales
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
import { formatDate } from '../utils/dateUtils'
import { useInventoryStore } from './inventoryStore'
import { useFinancialStore } from './financialStore'
import { validateSales } from 'src/utils/validation'
import { syncQueue } from 'src/services/syncQueue'

const { isOnline } = useNetworkStatus()
const inventoryStore = useInventoryStore()
const financialStore = useFinancialStore()

/**
 * @const {Store} useSalesStore
 * @description Sales store for managing sales and checkout of items
 */
export const useSalesStore = defineStore('sales', {
  state: () => ({
    products: [],
    cart: [],
    sales: [],
    searchQuery: '',
    selectedCategory: '',
    selectedPaymentMethod: null,
    showCheckoutDialog: false,
    loading: false,
    dateRange: {
      from: formatDate(new Date(), 'YYYY-MM-DD'),
      to: formatDate(new Date(), 'YYYY-MM-DD')
    },
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
  }),

  getters: {
    /**
     * @getter
     * @returns {Array} Returns array of products
     */
    getProducts: (state) => {
      return inventoryStore.sortedItems || []
    },
    /**
     * @getter
     * @returns {Array} Returns array of carts
     */
    getCart: (state) => {
      return state.cart
    },
    /**
     * @getter
     * @returns {Array} Filtered products based on search query and category
     */
    filteredProducts: (state) => {
      const products = inventoryStore.sortedItems || []
      if (!state.searchQuery && !state.selectedCategory)
        return products;

      return filterItems(products, {
        searchQuery: state.searchQuery,
        categoryFilter: state.selectedCategory,
        getCategoryName: categoryId => inventoryStore.getCategoryName(categoryId)
      })
    }
  },

  actions: {
    /**
     * initializeDB
    */
   async initializeDb(){
    try {
      const existingSales = await db.sales.count()
      if (isOnline.value) {
        await this.syncWithFirestore()
        await syncQueue.processQueue()
      }

      if(existingSales === 0 && !isOnline.value)
        console.error ('No local data available. Waiting for network connection...')

      await this.loadSales()
    } catch (error) {
      console.error (error, 'Failed to initialize database')
    }
   },
    /**
     *  Unya na
     *
    */
    async loadSales(){
      try {
        this.loading = true
        const localSales = await db.sales.orderBy('date').reverse().toArray()
        const validation = await validateSales(localSales)
        if (!validation.isValid) throw new Error(validation.errors)
        this.sales = localSales
        if(localSales.length === 0 && isOnline.value)
          await this.syncWithFirestore()
      } catch (error) {
        console.error('Error loading sales:', error)
      } finally {
        this.loading = false
      }
    },
    /**
     *  Sync with firestore unya na
    */
    async syncWithFirestore(){
      if (!isOnline.value) return

      try {
        const localSales = await db.sales.orderBy('date').reverse().toArray()
        const firestoreSnapshot = await getDocs(
          query(collection(fireDb, 'sales'), orderBy('updatedAt', 'desc'))
        )
        const firestoreSales = firestoreSnapshot.docs.map(doc => ({
          ...doc.data(),
          firebaseId: doc.id
        }))

        await db.transaction('rw', db.sales, async () => {
          for(const firestoreSale of firestoreSales) {
            try {
              const existingSales = await db.sales
                .where('firebaseId')
                .equals(firestoreSale.firebaseId)
                .toArray()

              if (existingSales.length === 0 && !firestoreSale.localId) {
                await db.sales.add({
                  ...firestoreSale,
                  syncStatus: 'synced'
                })
                continue
              }

              if (existingSales.length === 0 && firestoreSale.localId) {
                const existingSale = await db.sales
                  .where('id')
                  .equals(parseInt(firestoreSale.localId))
                  .first()

                if(!existingSale){
                  await db.sales.add({
                    ...firestoreSale,
                    syncStatus: 'synced'
                  })
                }
                continue
              }

              const [ saleToKeep, ...duplicates ] = existingSales

              if (saleToKeep.syncStatus === 'pending' || new Date(firestoreSale.updatedAt) > new Date(saleToKeep.updatedAt)) {
                for (const duplicate of duplicates)
                  await db.sales.delete(duplicate.id)

                continue
              }

              await db.sales.update(saleToKeep.id, {
                ...firestoreSale,
                id: saleToKeep.id,
                syncStatus: 'synced'
              })

              for (const duplicate of duplicates)
                await db.items.delete(duplicate.id)


            } catch (error) {
              this.syncStatus.failedItems.push({
                ...firestoreSale,
                error: error.message,
                syncOperation: 'create'
              })
            }
          }
        })

        for (const localSale of localSales) {
          if (
            !localSale.firebaseId ||
            firestoreItems.find ((sale) => sale.firebaseId === localSale.firebaseId)
          ) continue

          const currentSaleItem = await db.sales.get(localSale.id)

          if (currentSaleItem && currentSaleItem.syncStatus === 'pending')
            continue

          await db.delete(localSale.id)
        }
        this.sales = await db.getAllSales()
      } catch (error) {
        console.error('Error syncing with Firestore : ', error)
        throw error
      }
    },
    /**
     * @method updateCartQuantity
     * @returns {Promise<void>}
     * @description Update cart quantity when adding products from the cart
     */
    updateCartQuantity(item, change) {
      const product = this.getProducts.find(p => p.id === item.id)
      if (!product) return { success: false }

      const existingItem = this.cart.find(i => i.id === item.id)
      if (!existingItem) return { success: false }

      const newQuantity = existingItem.quantity + change

      if (newQuantity <= 0) {
        this.removeFromCart(item)
        return { success: true }
      }

      if (newQuantity <= product.quantity) {
        existingItem.quantity = newQuantity
        return { success: true }
      }

      return { success: false, error: 'Cannot add more than available stock' }
    },
    /**
     * @method removeFromCart
     * @returns {Promise<void>}
     * @description Initializes the database and performs initial sync if needed
     */
    removeFromCart(item) {
      const index = this.cart.findIndex(i => i.id === item.id)
      if (index > -1)
        this.cart.splice(index, 1)
      return { success: true }
    },

    addToCart(product) {
      if (product.quantity <= 0) {
        return { success: false, error: 'Product is out of stock' }
      }

      const existingItem = this.cart.find(item => item.id === product.id)
      if (existingItem) {
        if (existingItem.quantity < product.quantity) {
          existingItem.quantity++
          return { success: true }
        }
        return { success: false, error: 'Cannot add more than available stock' }
      }

      this.cart.push({
        ...product,
        quantity: 1
      })
      return { success: true }
    },

    async processCheckout() {
      if (!this.selectedPaymentMethod)
        return { success: false, error: 'Please select a payment method' }

      if (this.cart.length === 0)
        return { success: false, error: 'Cart is empty' }

      try {
        // Create sale record
        const sale = {
          id: crypto.randomUUID(),
          items: this.cart.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.quantity * item.price
          })),
          total: this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          paymentMethod: this.selectedPaymentMethod,
          date: new Date().toISOString()
        }
        // Update inventory quantities
        this.cart.forEach(async (item) => {
          const product = this.getProducts.find(p => p.id === item.id)
          product.quantity = product.quantity - item.quantity
          if (product)
            await inventoryStore.updateExistingItem(item.id, product)
        })

        // Save sale to database
        await db.sales.add(sale)

        // Create cash flow entry
        await financialStore.addTransaction({
          paymentMethod: this.selectedPaymentMethod,
          type: 'income',
          amount: sale.total,
          date: sale.date,
          description: 'Sale',
        })

        // Clear cart and reset checkout state
        this.clearCart()

        return { success: true, sale }
      } catch (error) {
        console.error('Checkout error:', error)
        return { success: false, error: 'Failed to process checkout' }
      }
    },

    setSearchQuery(query) {
      this.searchQuery = query
    },

    setSelectedCategory(category) {
      this.selectedCategory = category
    },

    setSelectedPaymentMethod(method) {
      this.selectedPaymentMethod = method
    },

    setShowCheckoutDialog(show) {
      this.showCheckoutDialog = show
    },

    clearCart() {
      this.cart = []
      this.showCheckoutDialog = false
      this.selectedPaymentMethod = null
      return { success: true }
    },

    /**
     * @async
     * @method generateSalesReport
     * @returns {Promise<Array>} Sales report data
     * @description Generates a sales report for the specified date range
     */
    async generateSalesReport() {
      try {
        this.loading = true
        const { from, to } = this.dateRange

        // Fetch sales data from database for the date range
        const salesData = await db.sales
          .where('date')
          .between(from, to)
          .toArray()

        return salesData.map(sale => ({
          id: sale.id,
          date: sale.date,
          items: sale.items,
          quantity: sale.quantity,
          total: sale.total
        }))
      } catch (error) {
        console.error('Error generating sales report:', error)
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * @method setDateRange
     * @param {Object} range - Date range to set
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
     * @method generateSalesReport
     * @returns {Promise<Array>} Array of daily sales report objects
     * @description Calculates and returns sales report data
     */
    async generateSalesReport() {
      try {
        const salesData = await db.sales.toArray(); // Fetch all sales data from Dexie.js

        const reportData = {};

        // Aggregate data by date
        salesData.forEach(sale => {
          const saleDate = formatDate(new Date(sale.createdAt), 'YYYY-MM-DD');
          if (!reportData[saleDate]) {
            reportData[saleDate] = {
              date: saleDate,
              grossProfit: 0,
              netProfit: 0,
              loss: 0
            };
          }

          // Calculate profit/loss based on payment method (example logic)
          const profit = sale.total - sale.cost; // Assuming 'cost' property exists
          if (sale.paymentMethod === 'cash') {
            reportData[saleDate].grossProfit += profit;
            reportData[saleDate].netProfit += profit; // Adjust for cash-specific expenses
          } else if (sale.paymentMethod === 'credit') {
            reportData[saleDate].grossProfit += profit;
            reportData[saleDate].netProfit += profit * 0.95; // Adjust for credit card fees
          } else {
            reportData[saleDate].loss += profit < 0 ? profit : 0;
          }
        });

        return Object.values(reportData);
      } catch (error) {
        console.error('Error generating sales report:', error);
        // Return an empty array in case of error
        return [];
      }
    },
  }
})
