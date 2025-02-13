/**
 * @fileoverview Manages financial data and reporting.
 * Features:
 * - Revenue tracking
 * - Expense management
 * - Profit calculations
 * - Financial reporting
 */

/**
 * @typedef {Object} FinancialReport
 * @property {Object} revenue - Revenue breakdown
 * @property {Object} expenses - Expense categories
 * @property {Object} profit - Profit analysis
 * @property {Object} trends - Historical trends
 */

import { defineStore } from 'pinia'
import { db } from '../db/dexiedb'
import { useNetworkStatus } from '../services/networkStatus'
import { formatDate } from '../utils/dateUtils'
import { db as fireDb } from '../firebase/firebaseconfig'
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore'

const { isOnline } = useNetworkStatus()

export const useFinancialStore = defineStore('financial', {
  state: () => ({
    financialData: [],
    dateRange: {
      from: formatDate(new Date(), 'YYYY-MM-DD'),
      to: formatDate(new Date(), 'YYYY-MM-DD')
    },
    profitTimeframe: 'daily',
    isLoading: false,
    error: null,
    cachedGetters: {} // Add this line
  }),

  getters: {
    getDailyExpense(state) {
      const today = formatDate(new Date(), 'YYYY-MM-DD')
      const cacheKey = JSON.stringify({ financialData: state.financialData, today })

      if (this.cachedGetters[cacheKey])
        return this.cachedGetters[cacheKey];

      const result = state.financialData
        .filter(item => item.date === today && item.type === 'expense')
        .reduce((sum, item) => sum + Number(item.amount), 0)

      this.cachedGetters[cacheKey] = result;
      return result
    },
    /**
     * @getter
     * @returns {Array} Returns array of sales
    */
    getDailyProfit(state) {
      const today = formatDate(new Date(), 'YYYY-MM-DD');
      const cacheKey = JSON.stringify({ financialData: state.financialData, today, type: 'income' })

      if (this.cachedGetters[cacheKey])
        return this.cachedGetters[cacheKey]

      const result = state.financialData
        .filter(item => item.date === today && item.type === 'income')
        .reduce((sum, item) => sum + Number(item.amount), 0)

      this.cachedGetters[cacheKey] = result
      return result
    },
    getWeeklyExpense(state) {
      const today = formatDate(new Date(), 'YYYY-MM-DD')
      const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()))
      const endOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + 6))
      const cacheKey = JSON.stringify({ financialData: state.financialData, startOfWeek, endOfWeek, type: 'expense' })

      if (this._cachedGetters[cacheKey])
        return this._cachedGetters[cacheKey]

      const result = state.financialData
        .filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= startOfWeek && itemDate <= endOfWeek && item.type === 'expense'
        })
        .reduce((sum, item) => sum + Number(item.amount), 0)

      this.cachedGetters[cacheKey] = result
      return result
    }
  },

  actions: {
    /**
     *
     *
    */
    async loadTransactions(){
      try {
        if(this.financialData.length === 0)
          this.financialData = await db.getAllTransactions()
      } catch (error) {
        console.error('Error loading transactions', error)
      }
    },
    /**
     * @method syncWithFirestore
     * @description Syncs unsynced transactions with Firestore when online
     * @private
     */
    async syncWithFirestore() {
      if (!isOnline.value) return

      if (!fireDb)
        return console.error('Firebase DB not initialized')

      if (this.financialData.length === 0)
        this.loadTransactions()

      try {
        const unsyncedTransactions = this.financialData.filter(
          transaction => transaction.syncStatus === 'pending'
        )

        if (unsyncedTransactions.length === 0) return

        const firestoreRef = collection(fireDb, 'cashFlow')

        for (const transaction of unsyncedTransactions) {
          try {
            const validation = await this.validateTransactionData(transaction)
            if (!validation.isValid) {
              console.error(
                `Validation failed for transaction ${transaction.id}:`,
                validation.errors
              )
              // Handle invalid transaction, e.g., mark for review or skip
              await db.cashFlow.update(transaction.id, {
                syncStatus: 'validation_failed',
                syncError: validation.errors.join(', ')
              })
              continue
            }

            const cleanTransaction = {
              paymentMethod: transaction.paymentMethod,
              type: transaction.type,
              amount: Number(transaction.amount),
              date: transaction.date || formatDate(new Date(), 'YYYY-MM-DD'),
              description: transaction.description,
              createdAt: transaction.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }

            if (!transaction.firestoreId) {
              const docRef = await addDoc(firestoreRef, {
                ...cleanTransaction,
                timestamp: serverTimestamp(),
                lastUpdated: serverTimestamp()
              })

              await db.cashFlow.update(transaction.id, {
                firestoreId: docRef.id,
                syncStatus: 'synced',
                ...cleanTransaction
              })
            } else {
              const docRef = doc(fireDb, 'cashFlow', transaction.firestoreId)
              await updateDoc(docRef, {
                ...cleanTransaction,
                lastUpdated: serverTimestamp()
              })

              await db.cashFlow.update(transaction.id, {
                syncStatus: 'synced',
                ...cleanTransaction
              })
            }
          } catch (error) {
            console.error(`Error syncing transaction ${transaction.id}:`, error)
            await db.cashFlow.update(transaction.id, {
              syncStatus: 'error',
              syncError: error.message
            })
            throw error
          }
        }
      } catch (error) {
        console.error('Error in syncWithFirestore:', error)
        throw error
      }
    },

    async fetchCashFlowTransactions(paymentMethod) {
      try {
        this.isLoading = true
        this.error = null

        if (!paymentMethod)
          throw new Error('Payment method is required')

        const transactions = await db.cashFlow
          .where('paymentMethod')
          .equals(paymentMethod)
          .reverse()
          .sortBy('date')

        if (isOnline.value) {
          const pendingCount = await db.cashFlow
            .where('syncStatus')
            .equals('pending')
            .count()

          if (pendingCount > 0) {
            try {
              await this.syncWithFirestore()
            } catch (error) {
              console.error('Background sync failed:', error)
            }
          }
        }

        return transactions || []
      } catch (error) {
        console.error(`Error fetching ${paymentMethod} transactions:`, error)
        this.error = error.message
        return []
      } finally {
        this.isLoading = false
      }
    },

    async getTransactionsByDateRange(paymentMethod, startDate, endDate) {
      try {
        return await db.cashFlow
          .where('paymentMethod')
          .equals(paymentMethod)
          .and(item => {
            const itemDate = new Date(item.date)
            return itemDate >= new Date(startDate) && itemDate <= new Date(endDate)
          })
          .toArray()
      } catch (error) {
        console.error('Error fetching transactions by date range:', error)
        throw error
      }
    },

    async addTransaction(transactionData) {
      try {
        const validation = await this.validateTransactionData(transactionData)
        if (!validation.isValid) {
          console.error('Validation failed:', validation.errors)
          throw new Error(validation.errors.join(', '))
        }

        const cleanTransaction = {
          paymentMethod: transactionData.paymentMethod,
          type: transactionData.type,
          amount: Number(transactionData.amount),
          date: formatDate(transactionData.date, 'YYYY-MM-DD') || formatDate(new Date(), 'YYYY-MM-DD'),
          description: transactionData.description?.trim() || '',
          syncStatus: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }

        const id = await db.cashFlow.add(cleanTransaction)

        if (isOnline.value) {
          try {
            if (!fireDb)
              throw new Error('Firebase DB not initialized')

            const firestoreRef = collection(fireDb, 'cashFlow')

            const docRef = await addDoc(firestoreRef, {
              ...cleanTransaction,
              syncStatus: 'synced',
              timestamp: serverTimestamp(),
              lastUpdated: serverTimestamp()
            })

            await db.cashFlow.update(id, {
              firestoreId: docRef.id,
              syncStatus: 'synced'
            })
          } catch (error) {
            console.error('Error syncing to Firestore:', error)
            await db.cashFlow.update(id, {
              syncStatus: 'error',
              syncError: error.message
            })
          }
        }

        return id
      } catch (error) {
        console.error('Error adding transaction:', error)
        throw error
      }
    },

    async updateTransaction(id, updatedData) {
      try {
        const transaction = await db.cashFlow.get(id)
        if (!transaction)
          throw new Error('Transaction not found')

        const cleanUpdate = {
          ...updatedData,
          amount: Number(updatedData.amount),
          date: updatedData.date || transaction.date,
          description: updatedData.description?.trim() || transaction.description,
          syncStatus: 'pending',
          updatedAt: new Date().toISOString()
        }

        await db.cashFlow.update(id, cleanUpdate)

        if (isOnline.value && transaction.firestoreId) {
          try {
            const docRef = doc(fireDb, 'cashFlow', transaction.firestoreId)
            await updateDoc(docRef, {
              ...cleanUpdate,
              lastUpdated: serverTimestamp()
            })

            await db.cashFlow.update(id, {
              syncStatus: 'synced'
            })
          } catch (error) {
            console.error('Error syncing to Firestore:', error)
          }
        }
      } catch (error) {
        console.error('Error updating transaction:', error)
        throw error
      }
    },

    async deleteTransaction(id) {
      try {
        const transaction = await db.cashFlow.get(id)
        if (!transaction)
          throw new Error('Transaction not found')

        await db.cashFlow.delete(id)

        if (isOnline.value && transaction.firestoreId) {
          try {
            const docRef = doc(fireDb, 'cashFlow', transaction.firestoreId)
            await deleteDoc(docRef)
          } catch (error) {
            console.error('Error deleting from Firestore:', error)
          }
        }
      } catch (error) {
        console.error('Error deleting transaction:', error)
        throw error
      }
    },

    async mergeCashFlowTransactions(localTransactions, firestoreTransactions) {
      try {
        const mergeOperations = []

        // Update local transactions with Firestore data
        for (const fireTransaction of firestoreTransactions) {
          const localMatch = localTransactions.find(
            local => local.firestoreId === fireTransaction.id
          )

          if (localMatch) {
            // Update if Firestore version is newer
            const fireTimestamp = new Date(fireTransaction.timestamp).getTime()
            const localTimestamp = new Date(localMatch.timestamp).getTime()

            if (fireTimestamp > localTimestamp) {
              mergeOperations.push(
                db.cashFlow.update(localMatch.id, {
                  ...fireTransaction,
                  syncStatus: 'synced'
                })
              )
            }
          } else {
            // Add new transaction from Firestore
            mergeOperations.push(
              db.cashFlow.add({
                ...fireTransaction,
                firestoreId: fireTransaction.id,
                syncStatus: 'synced'
              })
            )
          }
        }

        // Find local transactions not in Firestore (might be deleted remotely)
        const firebaseIds = new Set(firestoreTransactions.map(t => t.id))
        const localOnly = localTransactions.filter(
          local => local.firestoreId && !firebaseIds.has(local.firestoreId)
        )

        // Mark these as unsynced to handle potential deletes
        for (const local of localOnly) {
          mergeOperations.push(
            db.cashFlow.update(local.id, { syncStatus: 'pending' })
          )
        }

        await Promise.all(mergeOperations)
        return true
      } catch (error) {
        console.error('Error merging transactions:', error)
        return false
      }
    },

    async generateFinancialReport() {
      try {
        const { from, to } = this.dateRange

        const transactions = await db.cashFlow
          .where('date')
          .between(from, to)
          .toArray()

        const dailyTotals = transactions.reduce((acc, transaction) => {
          const date = transaction.date
          if (!acc[date]) {
            acc[date] = {
              date,
              income: 0,
              expense: 0,
              profit: 0
            }
          }

          const amount = Number(transaction.amount) || 0
          if (transaction.type === 'income') {
            acc[date].income += amount
            acc[date].profit += amount
          } else if (transaction.type === 'expense') {
            acc[date].expense += amount
            acc[date].profit -= amount
          }

          return acc
        }, {})

        this.financialData = Object.values(dailyTotals)
          .sort((a, b) => new Date(b.date) - new Date(a.date))

        return this.financialData
      } catch (error) {
        console.error('Error generating financial report:', error)
        throw error
      }
    },

    async generateCashFlowReport() {
      try {
        const { from, to } = this.dateRange

        const transactions = await db.cashFlow
          .where('date')
          .between(from, to)
          .toArray()

        const dailyTotals = transactions.reduce((acc, transaction) => {
          const date = transaction.date
          if (!acc[date]) {
            acc[date] = {
              date,
              totalIncome: 0,
              totalExpenses: 0,
              netCashFlow: 0
            }
          }

          const amount = Number(transaction.amount) || 0
          if (transaction.type === 'income') {
            acc[date].totalIncome += amount
          } else if (transaction.type === 'expense') {
            acc[date].totalExpenses += amount
          }
          acc[date].netCashFlow = acc[date].totalIncome - acc[date].totalExpenses

          return acc
        }, {})

        return Object.values(dailyTotals)
      } catch (error) {
        console.error('Error generating cash flow report:', error)
        return [] // Return an empty array in case of error
      }
    },

    async validateTransactionData(data) {
      const errors = []

      if (!data.paymentMethod)
        errors.push('Payment method is required')

      if (!data.type || !['income', 'expense'].includes(data.type))
        errors.push('Invalid transaction type')

      if (!data.amount || isNaN(Number(data.amount)) || Number(data.amount) <= 0)
        errors.push('Amount must be a positive number')

      if (!data.date)
        errors.push('Date is required')

      if (!data.description?.trim())
        errors.push('Description is required')

      return {
        isValid: errors.length === 0,
        errors
      }
    },

    setDateRange(range) {
      this.dateRange = range
    },

    formatCurrency(value) {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
      }).format(value)
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
    }
  }
})
