/**
 * @fileoverview Manages sales operations and checkout process.
 * Implements:
 * - Cart management
 * - Transaction processing
 * - Sales history
 */

import { defineStore } from 'pinia'
import { db } from '../db/dexiedb'
import {
  doc,
  serverTimestamp,
  setDoc
} from 'firebase/firestore'
import { db as fireDb } from '../firebase/firebaseconfig'
import { useNetworkStatus } from '../services/networkStatus'
import { formatDate } from '../utils/dateUtils'
import { useInventoryStore } from './inventoryStore'
import { useFinancialStore } from './financialStore'
import { useCentralizedSyncService } from '../services/centralizedSyncService'

const { isOnline } = useNetworkStatus()
const { syncWithFirestore, syncStatus } = useCentralizedSyncService()
const inventoryStore = useInventoryStore()
const financialStore = useFinancialStore()

function isValidDate(dateString) {
  if (!dateString) return false
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateString)) return false
  
  const date = new Date(dateString)
  return date instanceof Date && !isNaN(date)
}

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
    isCheckoutProcessing: false,
    dateRange: {
      from: formatDate(new Date(), 'YYYY-MM-DD'),
      to: formatDate(new Date(), 'YYYY-MM-DD')
    }
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
      if (!state.searchQuery && !state.selectedCategory) return products

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
    async initializeDb() {
      try {
        this.loading = true
        
        // First load local data
        this.sales = await db.getAllSales() || []

        if (isOnline.value) {
            // Sync with Firestore
            await syncWithFirestore('sales', {
                validateItem: (sale) => {
                    return sale && Array.isArray(sale.items) && typeof sale.total === 'number'
                },
                processItem: (sale) => {
                    // Ensure all numeric values and dates are properly formatted
                    const processed = {
                        ...sale,
                        id: sale.id || crypto.randomUUID(),
                        date: sale.date || formatDate(new Date(), 'YYYY-MM-DD'),
                        createdAt: sale.createdAt || new Date().toISOString(),
                        updatedAt: sale.updatedAt || new Date().toISOString(),
                        total: Number(sale.total) || 0,
                        items: (sale.items || []).map(item => ({
                            ...item,
                            total: Number(item.total) || 0,
                            price: Number(item.price) || 0,
                            quantity: Number(item.quantity) || 0
                        })),
                        total: Number(sale.total) || 0
                    }
                    return processed
                },
                orderByField: 'createdAt'
            })

            // Reload local data after sync
            this.sales = await db.getAllSales() || []
            console.log('Sales data synced with Firestore')
        }

        this.loading = false
        return true
      } catch (error) {
        console.error('Failed to initialize database:', error)
        return false
      }
    },
    /**
     *  Unya na
     *
     */
    async loadSales() {
      try {
        this.loading = true
        const localSales = await db.getAllSales() || []
        
        this.sales = localSales.map(sale => ({
          ...sale,
          date: isValidDate(sale.date) ? sale.date : formatDate(new Date(), 'YYYY-MM-DD')
        }))
      } catch (error) {
        console.error('Error loading sales:', error)
        throw error
      } finally {
        this.loading = false
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
      if (index > -1) this.cart.splice(index, 1)
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
        const currentDate = new Date()
        const saleId = crypto.randomUUID()
        
        const sale = {
          id: saleId,
          items: this.cart.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.quantity * item.price
          })),
          total: this.cart.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          ),
          paymentMethod: this.selectedPaymentMethod,
          date: formatDate(currentDate, 'YYYY-MM-DD'),
          dateTimeframe: currentDate.toISOString(),
          createdAt: currentDate.toISOString(),
          updatedAt: currentDate.toISOString(),
          firebaseId: saleId
        }

        // If online, add to Firestore first
        if (isOnline.value) {
          try {
            const saleRef = doc(fireDb, 'sales', saleId)
            await setDoc(saleRef, {
              ...sale,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            })
            console.log('Sale added to Firestore:', saleId)
          } catch (error) {
            console.error('Error adding sale to Firestore:', error)
            throw error
          }
        }

        // Update inventory quantities
        for (const item of this.cart) {
          const product = this.getProducts.find(p => p.id === item.id)
          if (product) {
            product.quantity = product.quantity - item.quantity
            await inventoryStore.updateExistingItem(item.id, product)
          }
        }

        // Add to local database
        await db.sales.add(sale)

        // Add financial transaction
        await financialStore.addTransaction({
          paymentMethod: this.selectedPaymentMethod,
          type: 'income',
          amount: sale.total,
          date: sale.date,
          description: 'Sale',
          dateTimeframe: new Date().toISOString()
        })

        this.clearCart()
        await this.loadSales()
        
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
     * @method setDateRange
     * @param {Object} range - Date range to set
     * @description Sets the date range for reports
     */
    setDateRange(range) {
      this.dateRange = range
    },
    /**
     * @async
     * @updated Get all sales
     * @method generateSalesReport
     * @returns {Promise<Array>} Array of daily sales report objects
     * @description Calculates and returns sales report data
     */
    async generateSalesReport() {
      try {
        if (this.sales.length === 0) await this.initializeDb()

        const dailySalesReport = {}
        const paymentMethods = ['cash', 'gcash', 'growsari']

        this.sales.forEach(sale => {
          const date = formatDate(new Date(sale.date), 'YYYY-MM-DD')
          const paymentMethod = sale.paymentMethod.toLowerCase()

          dailySalesReport[date] = dailySalesReport[date] || {
            date,
            'Cash Profits': 0,
            'Gcash Profits': 0,
            'Growsari Profits': 0,
            'Total Profits': 0
          }

          if (paymentMethods.includes(paymentMethod)) {
            dailySalesReport[date][
              `${
                paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)
              } Profits`
            ] += sale.total
            dailySalesReport[date]['Total Profits'] += sale.total
          }
        })

        const totalProfits = {}
        paymentMethods.forEach(method => {
          totalProfits[
            `${method.charAt(0).toUpperCase() + method.slice(1)} Profits`
          ] = this.sales
            .filter(sale => sale.paymentMethod.toLowerCase() === method)
            .reduce((total, sale) => total + sale.total, 0)
        })

        totalProfits['Total Profits'] = Object.values(totalProfits).reduce(
          (sum, profit) => sum + profit,
          0
        )

        dailySalesReport['Total Profits'] = { date: 'Total Profits', ...totalProfits }

        return Object.values(dailySalesReport)
      } catch (error) {
        console.error('Error generating sales report:', error)
        return []
      }
    }
  }
})
