import { defineStore } from 'pinia'
import { db } from '../db/dexiedb'
// Remove after full implementation of database
import { mockItems, mockSalesData, mockInventoryData, mockFinancialData, mockLowStockAlerts, mockTopSellingProducts } from '../data/mockdata'
import { collection, query, getDocs, serverTimestamp, updateDoc, addDoc, deleteDoc, doc } from 'firebase/firestore'
import { db as fireDb } from '../firebase/firebaseconfig'
import { useNetworkStatus } from '../services/networkStatus'
import { syncQueue } from '../services/syncQueue'
import { formatDate } from '../utils/dateUtils'
import debounce from 'lodash/debounce'
import { date } from 'quasar'

const { formatDate: formatQuasarDate } = date

export const useInventoryStore = defineStore('inventory', {
  state: () => ({
    loading: false,
    lowStocks: 0,
    outOfStocks: 0,
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
    pagination: {
      rowsPerPage: 10,
      sortBy: 'name',
      descending: false
    },
    sortBy: 'name',
    sortDirection: 'asc',
    sortOptions: [
      { label: 'Name', value: 'name' },
      { label: 'Price', value: 'price' },
      { label: 'Quantity', value: 'quantity' },
      { label: 'Category', value: 'category' }
    ],
    categories: [
      { label: 'Electronics', value: 'electronics' },
      { label: 'Clothing', value: 'clothing' },
      { label: 'Food', value: 'food' },
      { label: 'Books', value: 'books' }
    ],
    columns: [
      { name: 'image', label: 'Image', field: 'image', align: 'left' },
      { name: 'name', label: 'Name', field: 'name', align: 'left', sortable: true },
      { name: 'sku', label: 'SKU', field: 'sku', align: 'left', sortable: true },
      { name: 'category', label: 'Category', field: 'category', align: 'left', sortable: true },
      { name: 'quantity', label: 'Stock', field: 'quantity', align: 'left', sortable: true },
      { name: 'price', label: 'Price', field: 'price', align: 'left', sortable: true },
      { name: 'actions', label: 'Actions', field: 'actions', align: 'right' }
    ],
    selectedItems: [],
    dateRange: {
      from: formatQuasarDate(new Date(), 'YYYY-MM-DD'),
      to: formatQuasarDate(new Date(), 'YYYY-MM-DD')
    },
    salesData: mockSalesData,
    selectedTimeframe: 'daily',
    profitTimeframe: 'daily',
    cashFlowTransactions: {
      Cash: [],
      GCash: [],
      Growsari: []
    },
    inventoryData: mockInventoryData,
    financialData: mockFinancialData,
    lowStockAlerts: mockLowStockAlerts,
    topSellingProducts: mockTopSellingProducts,
    chartData: {
      daily: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'Sales',
            data: [30, 40, 50, 60, 70, 80, 90],
            type: 'line',
            borderColor: '#42A5F5',
            fill: false,
            tension: 0.1
          },
          {
            label: 'Expenses',
            data: [20, 30, 40, 50, 60, 70, 80],
            type: 'bar',
            backgroundColor: '#FF6384'
          }
        ]
      },
      weekly: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [
          {
            label: 'Sales',
            data: [150, 200, 250, 300],
            type: 'line',
            borderColor: '#42A5F5',
            fill: false,
            tension: 0.1
          },
          {
            label: 'Expenses',
            data: [100, 150, 200, 250],
            type: 'bar',
            backgroundColor: '#FF6384'
          }
        ]
      },
      monthly: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Sales',
            data: [700, 800, 900, 1000, 1100, 1200],
            type: 'line',
            borderColor: '#42A5F5',
            fill: false,
            tension: 0.1
          },
          {
            label: 'Expenses',
            data: [600, 700, 800, 900, 1000, 1100],
            type: 'bar',
            backgroundColor: '#FF6384'
          }
        ]
      },
      yearly: {
        labels: ['2020', '2021', '2022', '2023'],
        datasets: [
          {
            label: 'Sales',
            data: [8000, 9000, 10000, 11000],
            type: 'line',
            borderColor: '#42A5F5',
            fill: false,
            tension: 0.1
          },
          {
            label: 'Expenses',
            data: [7000, 8000, 9000, 10000],
            type: 'bar',
            backgroundColor: '#FF6384'
          }
        ]
      }
    },
    cashFlowTransactions: {
      Cash: [],
      GCash: [],
      Growsari: []
    }
  }),

  getters: {
    filteredItems(state) {
      let items = [...state.items]
      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase()
        items = items.filter(item =>
          item.name.toLowerCase().includes(query) ||
          item.sku.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
        )
      }
      if (state.categoryFilter)
        items = items.filter(item => item.category === state.categoryFilter)
      return items
    },

    sortedItems(state) {
      const items = [...state.filteredItems]  // Create a new array to avoid mutating the original
      if(state.sortBy && state.sortOptions.some(option => option.value === state.sortBy))  {
        items.sort((a, b) => {
          const aValue = a[state.sortBy]
          const bValue = b[state.sortBy]

          if (aValue == null) return state.sortDirection === 'asc' ? 1 : -1
          if (bValue == null) return state.sortDirection === 'asc' ? -1 : 1

          if (typeof aValue === 'string') {
            return state.sortDirection === 'asc'
              ? aValue.localeCompare(bValue)
              : bValue.localeCompare(aValue)
          }
          const numA = Number(aValue)
          const numB = Number(bValue)
          return state.sortDirection === 'asc'
            ? numA - numB
            : numB - numA
        })
      }
      return items
    },
    stockData(state) {
      return state.items.map(item => ({
        name: item.name,
        'current stock': item.quantity,
        'dead stock': 0,
        lastUpdated: formatDate(new Date(), 'MM/DD/YYYY')
      }))
    },
    getTotalRevenue(state) {
      return state.salesData.reduce((sum, item) => sum + item.revenue, 0)
    },
    getLowStockItems(state) {
      return state.inventoryData.filter(item => item.currentStock <= item.minStock * 1.2)
    },
    getNetProfit(state) {
      return state.financialData.find(item => item.category === 'Net Profit')?.amount || 0
    }
  },

  actions: {
    async initializeDb() {
      try {
        const existingItems = await db.getAllItems();
        if (existingItems.length === 0) {
          // Populate with mock data if empty
          for (const item of mockItems) await db.addItem(item);
        }
        await this.loadInventory();

        // Initial sync if online
        const { isOnline } = useNetworkStatus()
        if (isOnline.value) {
          await this.syncWithFirestore()
          await syncQueue.processQueue()
        }
      } catch (error) {
        console.error('Error initializing database:', error);
        this.error = error.message;
      }
    },

    async loadInventory() {
      this.loading = true;
      this.error = null;

      try {
        this.items = await db.getAllItems();
      } catch (error) {
        this.error = 'Failed to load inventory. Please try again.';
        console.error('Error loading inventory:', error);
      } finally {
        this.loading = false;
      }
    },

    async saveItem() {
      try {
        if (this.editMode) {
          await db.updateItem(this.editedItem.id, this.editedItem);
        } else {
          await db.addItem(this.editedItem);
        }
        await this.loadInventory();
        this.itemDialog = false;
      } catch (error) {
        console.error('Error saving item:', error);
        throw error;
      }
    },

    async deleteItem() {
      try {
        await db.deleteItem(this.itemToDelete.id);
        await this.loadInventory();
        this.deleteDialog = false;
      } catch (error) {
        console.error('Error deleting item:', error);
        throw error;
      }
    },

    async syncWithFirestore() {
      try {
        const querySnapshot = await getDocs(query(collection(fireDb, 'inventory')))
        const firestoreItems = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))

        if (firestoreItems.length > 0) {
          // Firestore has data, sync to local
          await db.syncWithFirestoreSimple(firestoreItems, 'items')
          await this.loadInventory()
        } else {
          // Firestore is empty, push local data to Firestore
          const localItems = await db.getAllItems()
          if (localItems.length > 0) {
            const inventoryRef = collection(fireDb, 'inventory')
            for (const item of localItems) {
              const { id, ...itemData } = item
              await addDoc(inventoryRef, {
                ...itemData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              })
            }
          }
        }
      } catch (error) {
        console.error('Error syncing with Firestore:', error)
        console.error('Continuing with local data')
      }
    },

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

    async updateItem(id, changes) {
      try {
        await db.updateItem(id, changes)
        const { isOnline } = useNetworkStatus()

        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'update',
            collection: 'inventory',
            docId: id,
            data: changes,
            timestamp: new Date()
          })
          await syncQueue.processQueue()
        }

        await this.loadInventory()
      } catch (error) {
        console.error('Error updating item:', error)
        this.error = error.message
        throw error
      }
    },

    async deleteSelected() {
      const selectedItems = this.selectedItems.filter(id => this.items.some(item => item.id === id))
      // Uncomment the API call here
      this.items = this.items.filter(item => !selectedItems.includes(item.id))
      this.selectedItems = []
    },

    async generateSalesReport() {
      try {
        // In a real application, this would fetch from an API
        // For now, return the mock data
        return [
          {
            productName: 'Product A',
            quantitySold: 50,
            revenue: 5000,
            date: date.formatDate(new Date(2024, 0, 15), 'MM/DD/YY HH:mm:ss') // January 15, 2024
          },
          {
            productName: 'Product B',
            quantitySold: 30,
            revenue: 3000,
            date: date.formatDate(new Date(2024, 0, 14), 'MM/DD/YY HH:mm:ss') // January 14, 2024
          },
          {
            productName: 'Product C',
            quantitySold: 20,
            revenue: 2000,
            date: date.formatDate(new Date(2024, 0, 10), 'MM/DD/YY HH:mm:ss') // January 10, 2024
          },
          {
            productName: 'Product D',
            quantitySold: 40,
            revenue: 4000,
            date: date.formatDate(new Date(), 'MM/DD/YY HH:mm:ss')
          }
        ]
      } catch (error) {
        console.error('Error generating sales report:', error)
        throw error
      }
    },

    formatDate(dateStr) {
      if (!dateStr) return ''
      return formatQuasarDate(new Date(dateStr), 'MM/DD/YY HH:mm:ss')
    },

    setDateRange(range) {
      this.dateRange = {
        from: formatQuasarDate(new Date(range.from), 'YYYY-MM-DD'),
        to: formatQuasarDate(new Date(range.to), 'YYYY-MM-DD')
      }
    },

    async generateFinancialReport() {
      try {
        this.loading = true
        // Mock financial data generation based on date range
        const startDate = new Date(this.dateRange.from)
        const endDate = new Date(this.dateRange.to)

        // Mock data for demonstration
        const report = {
          totalRevenue: this.getTotalRevenue,
          netProfit: this.getNetProfit,
          period: `${this.formatDate(this.dateRange.from)} - ${this.formatDate(this.dateRange.to)}`,
          summary: {
            sales: Math.floor(Math.random() * 1000),
            expenses: Math.floor(Math.random() * 500),
            profit: Math.floor(Math.random() * 500)
          }
        }

        return report
      } catch (error) {
        console.error('Error generating financial report:', error)
        throw error
      } finally {
        this.loading = false
      }
    },
    updateSalesTimeframe(value) {
      this.selectedTimeframe = value;
    },

    updateProfitTimeframe(value) {
      this.profitTimeframe = value;
    },

    getChartData(timeframe) {
      return this.chartData[timeframe];
    },

    getChartOptions(textColor) {
      return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: textColor
            },
            grid: {
              color: textColor,
              drawBorder: false
            }
          },
          x: {
            ticks: {
              color: textColor
            },
            grid: {
              color: textColor,
              drawBorder: false
            }
          }
        },
        plugins: {
          legend: {
            labels: {
              color: textColor
            }
          }
        }
      };
    },
    exportToCSV(data, filename) {
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row =>
          headers.map(header => {
            let cell = row[header]
            if (typeof cell === 'object' && cell !== null)
              cell = JSON.stringify(cell)

            cell = String(cell).replace(/"/g, '""')
            return cell.includes(',') ? `"${cell}"` : cell
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `${filename}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    async updateItem(item) {
      try {
        const itemRef = doc(fireDb, 'inventory', item.id)
        await updateDoc(itemRef, item)

        const index = this.items.findIndex(i => i.id === item.id)
        if (index !== -1)
          this.items[index] = { ...this.items[index], ...item }
      } catch (error) {
        console.error('Error updating item:', error)
        throw error
      }
    },
    async addCashFlowTransaction(paymentMethod, transaction) {
      try {
        const docRef = await addDoc(collection(fireDb, `cashFlow_${paymentMethod}`), {
          ...transaction,
          date: serverTimestamp()
        })

        this.cashFlowTransactions[paymentMethod].push({
          ...transaction,
          id: docRef.id,
          date: new Date()
        })

        return true
      } catch (error) {
        console.error('Error adding transaction:', error)
        return false
      }
    },

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

    getBalance(paymentMethod) {
      if (!this.cashFlowTransactions[paymentMethod]) {
        return 0
      }
      return this.cashFlowTransactions[paymentMethod].reduce((total, transaction) => {
        return total + (transaction.type === 'in' ? transaction.value : -transaction.value)
      }, 0)
    },

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
    // Remove after full implementation of database ---------------------------------
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
  }
})
