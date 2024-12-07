/**
 * @fileoverview Manages financial operations including cash flow and transactions
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
    error: null
  }),

  getters: {
    getDailyProfit() {
      const today = new Date()
      const todayStr = formatDate(today, 'YYYY-MM-DD')
      return this.financialData
        .filter(item => item.date === todayStr)
        .reduce((sum, item) => sum + item.profit, 0)
    },

    getDailyExpense() {
      const today = new Date()
      const todayStr = formatDate(today, 'YYYY-MM-DD')
      return this.financialData
        .filter(item => item.date === todayStr && item.type === 'expense')
        .reduce((sum, item) => sum + Number(item.amount), 0)
    }
  },

  actions: {
    /**
     * @method syncWithFirestore
     * @description Syncs unsynced transactions with Firestore when online
     * @private
     */
    async syncWithFirestore() {
      if (!isOnline.value) {
        return console.log('Not online, skipping sync')
      }

      if (!fireDb) {
        console.error('Firebase DB not initialized')
        return
      }

      try {
        console.log('Starting sync with Firestore...')

        // Get all pending transactions
        const unsyncedTransactions = await db.cashFlow
          .where('syncStatus')
          .equals('pending')
          .toArray()

        console.log(`Found ${unsyncedTransactions.length} unsynced transactions`)

        if (unsyncedTransactions.length === 0) {
          return console.log('No transactions to sync')
        }

        const firestoreRef = collection(fireDb, 'cashFlow')

        // Process each unsynced transaction
        for (const transaction of unsyncedTransactions) {
          try {
            console.log(`Syncing transaction ${transaction.id}...`)

            // Clean up the transaction data before sending to Firestore
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
              console.log('New transaction - adding to Firestore...')
              // New transaction - add to Firestore
              const docRef = await addDoc(firestoreRef, {
                ...cleanTransaction,
                timestamp: serverTimestamp(),
                lastUpdated: serverTimestamp()
              })
              console.log(`Added to Firestore with ID: ${docRef.id}`)

              // Update local record with Firestore ID
              await db.cashFlow.update(transaction.id, {
                firestoreId: docRef.id,
                syncStatus: 'synced',
                ...cleanTransaction // Update local record with cleaned data
              })
              console.log('Updated local record with Firestore ID')
            } else {
              console.log('Existing transaction - updating in Firestore...')
              // Existing transaction - update in Firestore
              const docRef = doc(fireDb, 'cashFlow', transaction.firestoreId)
              await updateDoc(docRef, {
                ...cleanTransaction,
                lastUpdated: serverTimestamp()
              })
              console.log('Updated in Firestore')

              // Mark as synced in local DB
              await db.cashFlow.update(transaction.id, {
                syncStatus: 'synced',
                ...cleanTransaction // Update local record with cleaned data
              })
              console.log('Updated local record sync status')
            }
          } catch (error) {
            console.error(`Error syncing transaction ${transaction.id}:`, error)
            // Mark transaction for retry
            await db.cashFlow.update(transaction.id, {
              syncStatus: 'error',
              syncError: error.message
            })
            throw error // Rethrow to handle in outer catch
          }
        }

        console.log('Sync completed successfully')
      } catch (error) {
        console.error('Error in syncWithFirestore:', error)
        throw error
      }
    },

    async fetchCashFlowTransactions(paymentMethod) {
      try {
        this.isLoading = true
        this.error = null

        if (!paymentMethod) {
          throw new Error('Payment method is required')
        }

        // Always fetch from local DB first
        const transactions = await db.cashFlow
          .where('paymentMethod')
          .equals(paymentMethod)
          .reverse()
          .sortBy('date')

        // Only attempt sync if online and there are pending transactions
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
              // Don't throw error here as we still have local data
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
        console.log('Adding transaction with data:', transactionData)

        // Validate transaction data
        const validation = await this.validateTransactionData(transactionData)
        if (!validation.isValid) {
          console.error('Validation failed:', validation.errors)
          throw new Error(validation.errors.join(', '))
        }

        // Clean up the transaction data
        const cleanTransaction = {
          paymentMethod: transactionData.paymentMethod,
          type: transactionData.type,
          amount: Number(transactionData.amount),
          date: transactionData.date || formatDate(new Date(), 'YYYY-MM-DD'),
          description: transactionData.description?.trim() || '',
          syncStatus: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }

        console.log('Cleaned transaction data:', cleanTransaction)

        // Always add to local DB first
        const id = await db.cashFlow.add(cleanTransaction)
        console.log('Added to local DB with ID:', id)

        // If online, sync immediately
        if (isOnline.value) {
          try {
            console.log('Online, attempting Firebase sync...')
            if (!fireDb) {
              throw new Error('Firebase DB not initialized')
            }

            const firestoreRef = collection(fireDb, 'cashFlow')
            console.log('Created Firestore reference')

            const docRef = await addDoc(firestoreRef, {
              ...cleanTransaction,
              timestamp: serverTimestamp(),
              lastUpdated: serverTimestamp()
            })
            console.log('Added to Firestore with ID:', docRef.id)

            // Update local record with Firestore ID
            await db.cashFlow.update(id, {
              firestoreId: docRef.id,
              syncStatus: 'synced'
            })
            console.log('Updated local record with Firestore ID')
          } catch (error) {
            console.error('Error syncing to Firestore:', error)
            // Keep the transaction in pending state for later sync
            await db.cashFlow.update(id, {
              syncStatus: 'error',
              syncError: error.message
            })
          }
        } else {
          console.log('Offline - transaction will sync later')
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
        if (!transaction) {
          throw new Error('Transaction not found')
        }

        // Clean up the updated data
        const cleanUpdate = {
          ...updatedData,
          amount: Number(updatedData.amount),
          date: updatedData.date || transaction.date,
          description: updatedData.description?.trim() || transaction.description,
          syncStatus: 'pending',
          updatedAt: new Date().toISOString()
        }

        // Always update local DB first
        await db.cashFlow.update(id, cleanUpdate)

        // Only attempt immediate sync if online and has Firestore ID
        if (isOnline.value && transaction.firestoreId) {
          try {
            const docRef = doc(fireDb, 'cashFlow', transaction.firestoreId)
            await updateDoc(docRef, {
              ...cleanUpdate,
              lastUpdated: serverTimestamp()
            })

            // Mark as synced
            await db.cashFlow.update(id, {
              syncStatus: 'synced'
            })
          } catch (error) {
            console.error('Error syncing to Firestore:', error)
            // Don't throw error as local update was successful
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
        if (!transaction) {
          throw new Error('Transaction not found')
        }

        // Always delete from local DB first
        await db.cashFlow.delete(id)

        // Only attempt Firestore deletion if online and has Firestore ID
        if (isOnline.value && transaction.firestoreId) {
          try {
            const docRef = doc(fireDb, 'cashFlow', transaction.firestoreId)
            await deleteDoc(docRef)
          } catch (error) {
            console.error('Error deleting from Firestore:', error)
            // Don't throw error as local delete was successful
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

        // Get all transactions within date range
        const transactions = await db.cashFlow
          .where('date')
          .between(from, to)
          .toArray()

        // Calculate daily totals
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

        // Convert to array and sort by date
        this.financialData = Object.values(dailyTotals)
          .sort((a, b) => new Date(b.date) - new Date(a.date))

        return this.financialData
      } catch (error) {
        console.error('Error generating financial report:', error)
        throw error
      }
    },

    async validateTransactionData(data) {
      const errors = []

      if (!data.paymentMethod) {
        errors.push('Payment method is required')
      }

      if (!data.type || !['income', 'expense'].includes(data.type)) {
        errors.push('Invalid transaction type')
      }

      if (!data.amount || isNaN(Number(data.amount)) || Number(data.amount) <= 0) {
        errors.push('Amount must be a positive number')
      }

      if (!data.date) {
        errors.push('Date is required')
      }

      if (!data.description?.trim()) {
        errors.push('Description is required')
      }

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
            if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"'))) {
              cell = `"${cell.replace(/"/g, '""')}"`
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
    }
  }
})
