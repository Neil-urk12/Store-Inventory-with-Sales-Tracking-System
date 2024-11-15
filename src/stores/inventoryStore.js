import { defineStore } from 'pinia'
import { debounce } from 'lodash'
import { date } from 'quasar'

const { formatDate, addToDate } = date

const mockData = [
  {
    id: 1,
    name: 'Apple iPhone 13',
    sku: 'IPH13',
    category: 'electronics',
    quantity: 10,
    price: 999.99,
    image: 'https://picsum.photos/200/300'
  },
  {
    id: 2,
    name: 'Samsung Galaxy S22',
    sku: 'SGS22',
    category: 'electronics',
    quantity: 5,
    price: 899.99,
    image: 'https://picsum.photos/200/301'
  },
  {
    id: 3,
    name: 'Nike Air Max 270',
    sku: 'NAM270',
    category: 'clothing',
    quantity: 20,
    price: 129.99,
    image: 'https://picsum.photos/200/302'
  },
  {
    id: 4,
    name: 'Adidas Superstar',
    sku: 'ADSUP',
    category: 'clothing',
    quantity: 15,
    price: 99.99,
    image: 'https://picsum.photos/200/303'
  },
  {
    id: 5,
    name: 'Harry Potter and the Philosopher\'s Stone',
    sku: 'HP1',
    category: 'books',
    quantity: 30,
    price: 19.99,
    image: 'https://picsum.photos/200/304'
  },
  {
    id: 6,
    name: 'The Lord of the Rings',
    sku: 'LOTR',
    category: 'books',
    quantity: 25,
    price: 29.99,
    image: 'https://picsum.photos/200/305'
  },
  {
    id: 7,
    name: 'Apple MacBook Air',
    sku: 'MBA',
    category: 'electronics',
    quantity: 8,
    price: 1499.99,
    image: 'https://picsum.photos/200/306'
  },
  {
    id: 8,
    name: 'Dell Inspiron 15',
    sku: 'DIN15',
    category: 'electronics',
    quantity: 12,
    price: 699.99,
    image: 'https://picsum.photos/200/307'
  },
  {
    id: 9,
    name: 'Nike Air Force 1',
    sku: 'NAF1',
    category: 'clothing',
    quantity: 18,
    price: 89.99,
    image: 'https://picsum.photos/200/308'
  },
  {
    id: 10,
    name: 'Adidas Yeezy Boost 350',
    sku: 'ADYB350',
    category: 'clothing',
    quantity: 10,
    price: 299.99,
    image: 'https://picsum.photos/200/309'
  }
]

export const useInventoryStore = defineStore('inventory', {
  state: () => ({
    loading: false,
    lowStocks: 0,
    outOfStocks: 0,
    error: null,
    items: mockData,
    searchQuery: '',
    categoryFilter: null,
    viewMode: 'list',
    itemDialog: false,
    deleteDialog: false,
    editedItem: {},
    itemToDelete: null,
    editMode: false,
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
      from: formatDate(new Date(), 'YYYY-MM-DD'),
      to: formatDate(new Date(), 'YYYY-MM-DD')
    },
    salesData: [
      {
        productId: 1,
        productName: 'Apple iPhone 13',
        quantitySold: 50,
        revenue: 49999.50
      },
      {
        productId: 2,
        productName: 'Samsung Galaxy S22',
        quantitySold: 30,
        revenue: 26999.70
      },
      {
        productId: 3,
        productName: 'Nike Air Max 270',
        quantitySold: 75,
        revenue: 9749.25
      }
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
    filteredItems: (state) => {
      let result = [...state.items]
      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase()
        result = result.filter(item =>
          item.name.toLowerCase().includes(query) ||
          item.sku.toLowerCase().includes(query)
        )
      }
      if (state.categoryFilter) result = result.filter(item => item.category === state.categoryFilter)
      return result
    },
    sortedItems: (state) => {
      const sorted = state.filteredItems
      if(state.sortBy && state.sortOptions.some(option => option.value === state.sortBy))  {
        sorted.sort((a, b) => {
          const aValue = a[state.sortBy]
          const bValue = b[state.sortBy]
          if (typeof aValue === 'string')
            return state.sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
          return state.sortDirection === 'asc'? aValue - bValue: bValue - aValue
        })
      }
      return sorted
    },
    stockData: (state) => {
      return state.items.map(item => ({
        name: item.name,
        'current stock': item.quantity,
        'dead stock': 0 // Placeholder - needs actual dead stock data
      }))
    },
    getTotalRevenue: (state) => {
      return state.salesData.reduce((sum, item) => sum + item.revenue, 0)
    },
    getLowStockItems: (state) => {
      return state.inventoryData.filter(item => item.currentStock <= item.minStock * 1.2)
    },
    getNetProfit: (state) => {
      return state.financialData.find(item => item.category === 'Net Profit')?.amount || 0
    }
  },

  actions: {
    async loadInventory() {
      this.loading = true
      this.error = null

      try {
        // const response = await fetch('/api/inventory')
        // this.items = await response.json()
        this.items = mockData
      } catch (err) {
        this.error = 'Failed to load inventory. Please try again.'
        console.error('Error loading inventory:', err)
      } finally {
        this.loading = false
      }
    },
    sortInventory(column, order) {
      this.sortBy = column;
      this.sortDirection = order;
      this.handleSortForGrid();
    },
    toggleSortDirection() {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
      this.handleSortForGrid();
    },
    setSortBy(sortBy) {
      this.sortBy = sortBy;
      this.handleSortForGrid();
    },
    debouncedSearch: debounce(function (query) {
      this.handleSearch(query)
    }, 300),
    handleSearch(query) {
      this.searchQuery = query
      this.debouncedSearch(query)
    },
    handleFilters() {
      this.pagination.page = 1
    },
    handleSortForGrid() {
      this.pagination.page = 1
      this.items = this.sortedItems
      this.pagination.sortBy = this.sortBy
      this.pagination.descending = this.sortDirection === 'desc'
    },
    openItemDialog(item = null) {
      this.editMode =!!item
      this.editedItem = item ? {...item } : {
        name: '',
        sku: '',
        category: '',
        quantity: 0,
        price: 0,
        image: ''
      }
      this.itemDialog = true
    },
    resetForm() {
      this.editedItem = {
        name: '',
        sku: '',
        category: '',
        quantity: 0,
        price: 0,
        image: ''
      }
    },
    confirmDelete(item) {
      this.itemToDelete = item
      this.deleteDialog = true
    },
    async deleteSelected() {
      const selectedItems = this.selectedItems.filter(id => this.items.some(item => item.id === id))
      // Uncomment the API call here
      this.items = this.items.filter(item => !selectedItems.includes(item.id))
      this.selectedItems = []
    },
    async deleteItem() {
      // API call here
      this.items = this.items.filter(item => item.id!== this.itemToDelete.id)
      this.deleteDialog = false
    },
    async saveItem() {
      // API call here
      if (this.editMode) {
        const index = this.items.findIndex(item => item.id === this.editedItem.id)
        this.items[index] = {...this.editedItem }
      } else {
        const existingItem = this.items.find(item => this.items.sku === this.editedItem.sku)
        if(existingItem) throw new Error('Item already exists')
        this.editedItem.id = Date.now()
        this.items.push({...this.editedItem })
      }
      this.itemDialog = false
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
            date: new Date(2024, 0, 15) // January 15, 2024
          },
          {
            productName: 'Product B',
            quantitySold: 30,
            revenue: 3000,
            date: new Date(2024, 0, 14) // January 14, 2024
          },
          {
            productName: 'Product C',
            quantitySold: 20,
            revenue: 2000,
            date: new Date(2024, 0, 10) // January 10, 2024
          },
          {
            productName: 'Product D',
            quantitySold: 40,
            revenue: 4000,
            date: new Date() // Today
          }
        ]
      } catch (error) {
        console.error('Error generating sales report:', error)
        throw error
      }
    },
    formatDate(dateStr) {
      if (!dateStr) return ''
      return formatDate(new Date(dateStr), 'MM/DD/YY HH:mm:ss')
    },

    setDateRange(range) {
      this.dateRange = {
        from: formatDate(new Date(range.from), 'YYYY-MM-DD'),
        to: formatDate(new Date(range.to), 'YYYY-MM-DD')
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
  }
})
