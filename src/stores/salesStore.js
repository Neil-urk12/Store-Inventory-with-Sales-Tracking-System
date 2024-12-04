import { defineStore } from 'pinia'
import { db } from '../db/dexiedb'
import { useNetworkStatus } from '../services/networkStatus'
import { formatDate } from '../utils/dateUtils'
import { useInventoryStore } from './inventoryStore'

const { isOnline } = useNetworkStatus()
const inventoryStore = useInventoryStore()

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
    getProducts: (state) => {
      return inventoryStore.sortedItems || []
    },
    getCart: (state) => {
      return state.cart
    },
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
    formatPrice(price) {
      return price.toFixed(2)
    },

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
