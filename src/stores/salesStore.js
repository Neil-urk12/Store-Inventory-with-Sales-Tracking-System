/**
 * @fileoverview Manages sales
 */

import { defineStore } from 'pinia'
import { db } from '../db/dexiedb'
import { useNetworkStatus } from '../services/networkStatus'
import { formatDate } from '../utils/dateUtils'
import { useInventoryStore } from './inventoryStore'

const { isOnline } = useNetworkStatus()
const inventoryStore = useInventoryStore()

/**
 * @const {Store} useSalesStore
 * @description Sales store for managing sales and checkout of items
 */
export const useSalesStore = defineStore('sales', {
  state: () => ({
    products: [],
    cart: [],
    searchQuery: '',
    selectedCategory: '',
    selectedPaymentMethod: null,
    showCheckoutDialog: false
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
      return products.filter(product => {
        const matchesSearch = state.searchQuery === '' ||
          product.name.toLowerCase().includes(state.searchQuery.toLowerCase())
        const matchesCategory = !state.selectedCategory ||
          product.category === state.selectedCategory
        return matchesSearch && matchesCategory
      })
    }
  },

  actions: {
    /**
     * @method formatPrice
     * @returns {Promise<Int16Array>}
     * @description Formats the price for uniformity and consistency
     */
    formatPrice(price) {
      return price.toFixed(2)
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

    processCheckout() {
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
          if (product) {
            await inventoryStore.updateItemQuantity(item.id, product.quantity - item.quantity)
          }
        })

        // Save sale to database
        db.sales.add(sale)

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
    }
  }
})
