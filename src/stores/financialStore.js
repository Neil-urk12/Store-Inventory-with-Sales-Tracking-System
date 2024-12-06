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
    cashFlowTransactions: {
      Cash: [],
      GCash: [],
      Growsari: []
    },
    financialData: [],
    dateRange: {
      from: formatDate(new Date(), 'YYYY-MM-DD'),
      to: formatDate(new Date(), 'YYYY-MM-DD')
    },
    profitTimeframe: 'daily'
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
      return Object.values(this.cashFlowTransactions)
        .flat()
        .filter(transaction =>
          transaction.date === todayStr &&
          transaction.type === 'expense'
        )
        .reduce((sum, transaction) => sum + transaction.amount, 0)
    },

    getBalance: (state) => (paymentMethod) => {
      const transactions = state.cashFlowTransactions[paymentMethod] || []
      return transactions.reduce((balance, transaction) => {
        return balance + (transaction.type === 'income' ? transaction.amount : -transaction.amount)
      }, 0)
    }
  },

  actions: {
    /**
     * @method syncWithFirestore
     * @description Syncs unsynced transactions with Firestore when online
     * @private
     */
    async syncWithFirestore() {
      if (!isOnline.value) return

      try {
        const unsyncedTransactions = await db.cashFlowTransactions
          .where('synced')
          .equals(false)
          .toArray()

        for (const transaction of unsyncedTransactions) {
          const firestoreRef = collection(fireDb, 'cashFlowTransactions')
          const docRef = await addDoc(firestoreRef, {
            ...transaction,
            timestamp: serverTimestamp()
          })

          await db.cashFlowTransactions.update(transaction.id, {
            firestoreId: docRef.id,
            synced: true
          })
        }
      } catch (error) {
        console.error('Error syncing with Firestore:', error)
      }
    },

    async fetchCashFlowTransactions(paymentMethod) {
      try {
        // Load from local DB first
        const localTransactions = await db.cashFlowTransactions
          .where('paymentMethod')
          .equals(paymentMethod)
          .toArray()

        this.cashFlowTransactions[paymentMethod] = localTransactions

        // If online, sync with Firestore
        if (isOnline.value) {
          const firestoreRef = collection(fireDb, 'cashFlowTransactions')
          const snapshot = await getDocs(firestoreRef)
          const firestoreTransactions = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(t => t.paymentMethod === paymentMethod)

          // Merge and update local DB
          await this.mergeCashFlowTransactions(localTransactions, firestoreTransactions)

          // Sync any remaining unsynced transactions
          this.syncWithFirestore()
            .catch(error => console.error('Background sync failed:', error))
        }

        return true
      } catch (error) {
        console.error('Error fetching cash flow transactions:', error)
        return false
      }
    },

    /**
     * @method mergeCashFlowTransactions
     * @description Merges local and Firestore transactions, handling conflicts based on timestamp
     * @param {Array} localTransactions - Local transactions from IndexedDB
     * @param {Array} firestoreTransactions - Transactions from Firestore
     */
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
                db.cashFlowTransactions.update(localMatch.id, {
                  ...fireTransaction,
                  synced: true
                })
              )
            }
          } else {
            // Add new transaction from Firestore
            mergeOperations.push(
              db.cashFlowTransactions.add({
                ...fireTransaction,
                firestoreId: fireTransaction.id,
                synced: true
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
            db.cashFlowTransactions.update(local.id, { synced: false })
          )
        }

        await Promise.all(mergeOperations)
        return true
      } catch (error) {
        console.error('Error merging transactions:', error)
        return false
      }
    },

    async addCashFlowTransaction(paymentMethod, transactionData) {
      const validation = this.validateTransactionData(transactionData)
      if (!validation.isValid) {
        console.error('Invalid transaction data:', validation.errors)
        throw new Error(validation.errors.join(', '))
      }

      try {
        const transaction = {
          ...transactionData,
          paymentMethod,
          timestamp: new Date().toISOString(),
          synced: false
        }

        // Save to local DB first
        const id = await db.cashFlowTransactions.add(transaction)
        transaction.id = id

        // Update state
        if (!this.cashFlowTransactions[paymentMethod]) {
          this.cashFlowTransactions[paymentMethod] = []
        }
        this.cashFlowTransactions[paymentMethod].push(transaction)

        // Try to sync with Firestore in background if online
        if (isOnline.value) {
          this.syncWithFirestore()
            .catch(error => console.error('Background sync failed:', error))
        }

        return true
      } catch (error) {
        console.error('Error adding cash flow transaction:', error)
        return false
      }
    },

    async updateCashFlowTransaction(paymentMethod, transactionId, updatedData) {
      const validation = this.validateTransactionData(updatedData)
      if (!validation.isValid) {
        console.error('Invalid transaction data:', validation.errors)
        throw new Error(validation.errors.join(', '))
      }

      try {
        // Update local DB
        await db.cashFlowTransactions.update(transactionId, {
          ...updatedData,
          synced: false
        })

        // Update local state
        const transactions = this.cashFlowTransactions[paymentMethod]
        const index = transactions.findIndex(t => t.id === transactionId)
        if (index !== -1) {
          transactions[index] = {
            ...transactions[index],
            ...updatedData,
            synced: false
          }
        }

        // Try to sync with Firestore in background if online
        if (isOnline.value) {
          this.syncWithFirestore()
            .catch(error => console.error('Background sync failed:', error))
        }

        return true
      } catch (error) {
        console.error('Error updating cash flow transaction:', error)
        return false
      }
    },

    async deleteCashFlowTransaction(paymentMethod, transactionId) {
      try {
        const transaction = await db.cashFlowTransactions.get(transactionId)

        // Delete from local DB first
        await db.cashFlowTransactions.delete(transactionId)

        // Update local state
        const transactions = this.cashFlowTransactions[paymentMethod]
        const index = transactions.findIndex(t => t.id === transactionId)
        if (index !== -1) {
          transactions.splice(index, 1)
        }

        // If online and has Firestore ID, delete from Firestore in background
        if (isOnline.value && transaction?.firestoreId) {
          const docRef = doc(fireDb, 'cashFlowTransactions', transaction.firestoreId)
          deleteDoc(docRef)
            .catch(error => console.error('Error deleting from Firestore:', error))
        }

        return true
      } catch (error) {
        console.error('Error deleting cash flow transaction:', error)
        return false
      }
    },

    /**
     * @method validateTransactionData
     * @param {Object} data - Transaction data to validate
     * @returns {Object} Validation result with isValid and errors
     */
    validateTransactionData(data) {
      const errors = []

      if (!data.type || !['income', 'expense'].includes(data.type)) {
        errors.push('Invalid transaction type')
      }

      if (typeof data.amount !== 'number' || data.amount <= 0) {
        errors.push('Amount must be a positive number')
      }

      if (!data.date || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
        errors.push('Invalid date format (required: YYYY-MM-DD)')
      }

      return {
        isValid: errors.length === 0,
        errors
      }
    },

    async generateFinancialReport() {
      try {
        const { from, to } = this.dateRange
        const transactions = await db.cashFlowTransactions
          .where('date')
          .between(from, to)
          .toArray()

        const report = {
          totalIncome: 0,
          totalExpense: 0,
          netProfit: 0,
          transactionsByMethod: {},
          dailyBreakdown: {}
        }

        transactions.forEach(transaction => {
          const { type, amount, paymentMethod, date } = transaction

          // Update totals
          if (type === 'income') {
            report.totalIncome += amount
          } else {
            report.totalExpense += amount
          }

          // Update by payment method
          if (!report.transactionsByMethod[paymentMethod]) {
            report.transactionsByMethod[paymentMethod] = {
              income: 0,
              expense: 0
            }
          }
          report.transactionsByMethod[paymentMethod][type] += amount

          // Update daily breakdown
          if (!report.dailyBreakdown[date]) {
            report.dailyBreakdown[date] = {
              income: 0,
              expense: 0
            }
          }
          report.dailyBreakdown[date][type] += amount
        })

        report.netProfit = report.totalIncome - report.totalExpense
        return report
      } catch (error) {
        console.error('Error generating financial report:', error)
        return null
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
