/**
 * @fileoverview Manages sales operations and checkout process.
 * Implements:
 * - Cart management
 * - Transaction processing
 * - Sales history
 * - Offline support
 */

/**
 * @typedef {Object} Sale
 * @property {string} id - Unique sale ID
 * @property {Array<CartItem>} items - Items in the sale
 * @property {number} total - Total sale amount
 * @property {string} paymentMethod - Payment method used
 * @property {Date} createdAt - Sale timestamp
 */

import { defineStore } from 'pinia'
import { db } from '../db/dexiedb'
import {
  collection,
  getDocs,
  query,
  orderBy,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  where,
  doc,
  writeBatch,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore'
import { db as fireDb } from '../firebase/firebaseconfig'
import { useNetworkStatus } from '../services/networkStatus'
import { formatDate } from '../utils/dateUtils'
import { useInventoryStore } from './inventoryStore'
import { useFinancialStore } from './financialStore'
import { validateSales } from 'src/utils/validation'
import { syncQueue } from 'src/services/syncQueue'
import filterItems from 'src/utils/filterUtils'

const { isOnline } = useNetworkStatus()
const inventoryStore = useInventoryStore()
const financialStore = useFinancialStore()

function isValidDate(dateString) {
  if (!dateString) return false;
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
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
        if (isOnline.value) {
          await this.syncWithFirestore()
          await syncQueue.processQueue()
        } else this.sales = await db.getAllSales()

        this.loading = false
        return true
      } catch (error) {
        console.error(error, 'Failed to initialize database')
        return false
      }
    },
    /**
     * @async
     * @method uploadSalesData
     * @description Uploads all sales data from the local database to Firestore
     * @returns {Promise<void>}
     */
    async uploadSalesData(changedSales) {
      if (!isOnline.value)
        return console.warn('Offline. Sales data will be uploaded when online.')

      if (changedSales.length === 0)
        return console.log('No sales changes to upload.')

      this.syncStatus.inProgress = true
      this.syncStatus.error = null

      console.log('Uploading changed sales data:', changedSales);

      for (const sale of changedSales) {
        try {
          await runTransaction(fireDb, async (transaction) => {
            const saleRef = doc(fireDb, 'sales', sale.id)

            const saleDoc = await getDoc(saleRef)
            if (!saleDoc.exists()) {
              console.log(`Creating new sale record for sale ID: ${sale.id}`);
              transaction.set(saleRef, {
                 ...sale,
                dateTimeframe: new Date().toISOString(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              })
            } else {
              console.log(`Updating existing sale record for sale ID: ${sale.id}`);
              transaction.update(saleRef, {
                ...sale,
                dateTimeframe: new Date().toISOString(),
                updatedAt: serverTimestamp()
              });
            }
          });
          console.log(`Sale ${sale.id} uploaded/updated successfully!`);
          this.syncStatus.processedItems++
        } catch (error) {
          console.error(`Error uploading/updating sale ${sale.id}:`, error);
          this.syncStatus.failedItems.push({
            ...sale,
            error: error.message,
            syncOperation: 'create'
          })
          if (error.code !== 'already-exists') {
            // Add to sync queue with retry logic
            syncQueue.addToQueue({
              type: 'add',
              data: sale,
              retries: 0,
              onError: err => {
                console.error(
                  `Failed to upload sale ${sale.id} after multiple retries:`,
                  err
                );
              }
            });
          }
          return
        }
      }
      this.syncStatus.inProgress = false
    },
    /**
     *  Unya na
     *
     */
    async loadSales() {
      try {
        this.loading = true

        if(isOnline.value)
          await this.syncWithFirestore()

        const localSales = await db.getAllSales()
        
        const salesWithValidDates = localSales.map(sale => {
          if (!isValidDate(sale.date)) {
            sale.date = formatDate(new Date(), 'YYYY-MM-DD')
          }
          return sale
        })

        const validation = await validateSales(salesWithValidDates)
        if (!validation.isValid) {
          console.error('Sales validation failed:', validation.errors)
          throw new Error(validation.errors)
        }

        this.sales = salesWithValidDates
      } catch (error) {
        console.error('Error loading sales:', error)
        throw error
      } finally {
        this.loading = false
      }
    },
    /**
     *  Sync with firestore unya na
     */
    async syncWithFirestore() {
      if (!isOnline.value)
        return console.error('Cannot sync while offline')

      this.syncStatus.inProgress = true
      this.syncStatus.error = null
      this.syncStatus.processedItems = 0
      this.syncStatus.failedItems = []

      const beforeSyncSales = await db.getAllSales()

      try {
        const localSales = await db.sales.orderBy('date').reverse().toArray()
        const firestoreSnapshot = await getDocs(
          query(collection(fireDb, 'sales'), orderBy('createdAt', 'desc'))
        )
        const firestoreSales = firestoreSnapshot.docs.map(doc => ({
          ...doc.data(),
          firebaseId: doc.id
        }))

        const firestoreValidationResult = validateSales(localSales)
        const localValidationResult = validateSales(firestoreSales)
        if (!firestoreValidationResult.isValid && !localValidationResult)
          throw new Error(
            firestoreValidationResult.errors || localValidationResult.errors
          )

        await db.transaction('rw', db.sales, async () => {
          for (const firestoreSale of firestoreSales) {
            try {
              const existingSales = localSales.filter(sale => sale.firebaseId === firestoreSale.firebaseId)

              if (existingSales.length === 0 && !firestoreSale.localId) {
                await db.sales.add({
                  ...firestoreSale,
                  syncStatus: 'synced',
                  dateTimeframe: new Date().toISOString()
                })
                this.syncStatus.processedItems++
                continue
              }

              if (existingSales.length === 0 && firestoreSale.localId) {
                const existingSaleByLocalId = await db.sales
                  .where('id')
                  .equals(firestoreSale.localId)
                  .first()

                if (!existingSaleByLocalId) {
                  await db.sales.add({
                    ...firestoreSale,
                    syncStatus: 'synced',
                    dateTimeframe: new Date().toISOString()
                  })
                  this.syncStatus.processedItems++
                }
                continue
              }

              const [saleToKeep, ...duplicates] = existingSales
              const duplicateIdsToDelete = []

              if (saleToKeep.syncStatus === 'pending') {
                this.syncStatus.pendingChanges++
                await syncQueue.addToQueue({
                  operation: 'update',
                  collection: 'sales',
                  data: {
                    ...saleToKeep,
                    updatedAt: serverTimestamp(),
                    dateTimeframe: new Date().toISOString()
                  },
                  docId: saleToKeep.firebaseId
                })

                await db.sales.update(saleToKeep.id, {
                  ...firestoreSale,
                  syncStatus: 'synced',
                  date: formatDate(new Date(firestoreSale.date)),
                  updatedAt: serverTimestamp(),
                  dateTimeframe: new Date().toISOString()
                })
                this.syncStatus.processedItems++
              } else if (
                new Date(firestoreSale.updatedAt) >
                new Date(saleToKeep.updatedAt)
              ) {
                await db.sales.update(saleToKeep.id, {
                  ...firestoreSale,
                  syncStatus: 'synced',
                  dateTimeframe: new Date().toISOString()
                })
                this.syncStatus.processedItems++
              } else {
                this.syncStatus.pendingChanges++
                await syncQueue.addToQueue({
                  type: 'update',
                  collection: 'sales',
                  data: {
                    ...saleToKeep,
                    updatedAt: serverTimestamp(),
                    syncStatus: 'synced',
                    dateTimeframe: new Date().toISOString()
                  },
                  docId: firestoreSale.firebaseId
                })

                await db.sales.update(saleToKeep.id, { syncStatus: 'synced', dateTimeframe: new Date().toISOString() })
                this.syncStatus.processedItems++
              }

              for (const duplicate of duplicates)
                duplicateIdsToDelete.push(duplicate.id)

              if (duplicateIdsToDelete.length > 0)
                await db.bulkDeleteSales(duplicateIdsToDelete)
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
          if (!localSale.firebaseId) {
            try {
              await runTransaction(fireDb, async (transaction) => {
                const newSaleRef = doc(collection(fireDb, 'sales'))
                const newSaleWithTimestamp = {
                  ...localSale,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                  dateTimeframe: new Date().toISOString()
                }

                const conflictQuery = query(
                  collection(fireDb, 'sales'),
                  where('id', '==', newSaleWithTimestamp.id),
                  where('createdAt', '>=', new Date(Date.now() - 60000))
                );
                const conflictSnapshot = await getDocs(conflictQuery)

                if (!conflictSnapshot.empty) {
                  console.warn(`Conflict detected for sale ${newSaleWithTimestamp.id}. Skipping.`)
                  this.syncStatus.failedItems.push({
                    ...newSaleWithTimestamp,
                    error: 'Conflict detected',
                    syncOperation: 'create'
                  })
                  return
                }

                transaction.set(newSaleRef, newSaleWithTimestamp)

                await db.sales.update(localSale.id, { firebaseId: newSaleRef.id, syncStatus: 'synced', dateTimeframe: new Date().toISOString() })
                this.syncStatus.processedItems++
              })
            } catch (error) {
              console.error('Error creating sale in Firestore:', error)
              this.syncStatus.failedItems.push({
                ...localSale,
                error: error.message,
                syncOperation: 'create'
              })
            }
          } else {
            const firestoreFirebaseIds = new Set(firestoreSales.map(sale => sale.firebaseId))

            if (firestoreFirebaseIds.has(localSale.firebaseId))
              continue

            const currentSaleItem = await db.sales.get(localSale.id);

            if (currentSaleItem && currentSaleItem.syncStatus === 'pending')
              continue

            this.syncStatus.pendingChanges++
            await syncQueue.addToQueue({
              type: 'delete',
              collection: 'sales',
              docId: localSale.firebaseId,
              data: {
                updatedAt: serverTimestamp(),
                dateTimeframe: new Date().toISOString()
              },
            })

            await db.deleteSale(localSale.id);
            this.syncStatus.processedItems++
          }
        }

        const afterSyncSales = await db.getAllSales()

        const changedSales = afterSyncSales.filter(afterSale => {
          const beforeSale = beforeSyncSales.find(
            beforeSale => beforeSale.id === afterSale.id
          )
          return !beforeSale || JSON.stringify(beforeSale) !== JSON.stringify(afterSale)
        })

        if (changedSales.length > 0) {
          console.log(
            'Changes detected. Uploading',
            changedSales.length,
            'sales records...'
          )
          this.sales = afterSyncSales
          this.uploadSalesData(changedSales)
        } else {
          console.log('No changes detected. Skipping upload.')
        }
      } catch (error) {
        console.error('Error syncing with Firestore : ', error)
        this.syncStatus.error = error.message
        throw error
      } finally {
        this.syncStatus.inProgress = false
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
        this.syncStatus.pendingChanges++
        syncQueue.addToQueue({
          type: 'update',
          collection: 'items',
          data: {
            quantity: newQuantity
          },
          docId: item.id
        })
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
      this.syncStatus.pendingChanges++
      syncQueue.addToQueue({
        type: 'update',
        collection: 'items',
        data: {
          quantity: item.quantity
        },
        docId: item.id
      })
      return { success: true }
    },

    async addToCartWithRetry(product) {
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          const result = this.addToCart(product);
          if (result.success) {
            return result;
          } else {
            return result;
          }
        } catch (error) {
          retries++;
          console.error(`Error adding to cart (attempt ${retries}):`, error);
          if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      return { success: false, error: 'Failed to add to cart after multiple retries.' };
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

    async removeFromCartWithRetry(item) {
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          const result = this.removeFromCart(item);
          if (result.success) {
            return result;
          } else {
            this.$q.notify({ type: 'negative', message: result.error || 'Failed to remove from cart. Please try again.' });
            return result;
          }
        } catch (error) {
          retries++;
          console.error(`Error removing from cart (attempt ${retries}):`, error);
          if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      this.$q.notify({ type: 'negative', message: 'Failed to remove from cart after multiple retries. Please check your connection.' });
      return { success: false, error: 'Failed to remove from cart after multiple retries.' };
    },

    async processCheckout() {
      if (!this.selectedPaymentMethod)
        return { success: false, error: 'Please select a payment method' }

      if (this.cart.length === 0)
        return { success: false, error: 'Cart is empty' }

      try {
        const currentDate = new Date()
        const sale = {
          id: crypto.randomUUID(),
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
          createdAt: currentDate.toISOString()
        }

        this.cart.forEach(async item => {
          const product = this.getProducts.find(p => p.id === item.id)
          product.quantity = product.quantity - item.quantity
          if (product)
            await inventoryStore.updateExistingItem(item.id, product)
        })

        await db.sales.add(sale)

        await financialStore.addTransaction({
          paymentMethod: this.selectedPaymentMethod,
          type: 'income',
          amount: sale.total,
          date: sale.date,
          description: 'Sale',
          dateTimeframe: new Date().toISOString()
        })

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
