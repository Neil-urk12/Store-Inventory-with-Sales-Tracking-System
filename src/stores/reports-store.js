import { defineStore } from 'pinia'

export const useReportsStore = defineStore('reports', {
  state: () => ({
    salesData: [
      { id: 1, product: 'Gaming Laptop', quantity: 12, revenue: 24000, date: '2024-01-15', category: 'electronics' },
      { id: 2, product: 'Wireless Mouse', quantity: 45, revenue: 2250, date: '2024-01-15', category: 'electronics' },
      { id: 3, product: 'USB-C Cable', quantity: 100, revenue: 1500, date: '2024-01-16', category: 'accessories' },
      { id: 4, product: 'Mechanical Keyboard', quantity: 20, revenue: 3000, date: '2024-01-16', category: 'electronics' },
      { id: 5, product: 'Monitor Stand', quantity: 15, revenue: 750, date: '2024-01-17', category: 'accessories' }
    ],

    inventoryData: [
      { id: 1, product: 'Gaming Laptop', currentStock: 8, minStock: 5, maxStock: 20, lastRestocked: '2024-01-10', category: 'electronics' },
      { id: 2, product: 'Wireless Mouse', currentStock: 35, minStock: 20, maxStock: 100, lastRestocked: '2024-01-12', category: 'electronics' },
      { id: 3, product: 'USB-C Cable', currentStock: 150, minStock: 50, maxStock: 300, lastRestocked: '2024-01-14', category: 'accessories' },
      { id: 4, product: 'Mechanical Keyboard', currentStock: 15, minStock: 10, maxStock: 50, lastRestocked: '2024-01-15', category: 'electronics' },
      { id: 5, product: 'Monitor Stand', currentStock: 25, minStock: 15, maxStock: 60, lastRestocked: '2024-01-16', category: 'accessories' }
    ],

    financialData: [
      { id: 1, category: 'Revenue', amount: 31500, date: '2024-01-15', type: 'income' },
      { id: 2, category: 'Cost of Goods', amount: -18900, date: '2024-01-15', type: 'expense' },
      { id: 3, category: 'Operating Expenses', amount: -5250, date: '2024-01-15', type: 'expense' },
      { id: 4, category: 'Tax', amount: -1470, date: '2024-01-15', type: 'expense' },
      { id: 5, category: 'Net Profit', amount: 5880, date: '2024-01-15', type: 'summary' }
    ],

    lowStockAlerts: [
      { id: 1, product: 'Gaming Laptop', currentStock: 8, minStock: 5, status: 'warning' },
      { id: 2, product: 'Mechanical Keyboard', currentStock: 15, minStock: 10, status: 'warning' }
    ],

    topSellingProducts: [
      { id: 1, product: 'Gaming Laptop', totalSold: 12, revenue: 24000 },
      { id: 2, product: 'Wireless Mouse', totalSold: 45, revenue: 2250 },
      { id: 3, product: 'USB-C Cable', totalSold: 100, revenue: 1500 }
    ]
  }),

  getters: {
    getTotalRevenue: (state) => {
      return state.salesData.reduce((sum, item) => sum + item.revenue, 0)
    },
    getLowStockItems: (state) => {
      return state.inventoryData.filter(item => item.currentStock <= item.minStock * 1.2)
    },
    getNetProfit: (state) => {
      return state.financialData.find(item => item.category === 'Net Profit')?.amount || 0
    }
  }
})
