import { defineStore } from 'pinia'
import { debounce } from 'lodash'
import { date } from 'quasar'

const { formatDate } = date

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
    ],
    selectedTimeframe: 'weekly',
    profitTimeframe: 'weekly',
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
    }
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
      const items = [...state.filteredItems]  // Create a new array to avoid mutating the original
      if(state.sortBy && state.sortOptions.some(option => option.value === state.sortBy))  {
        items.sort((a, b) => {
          const aValue = a[state.sortBy]
          const bValue = b[state.sortBy]

          // Handle null or undefined values
          if (aValue == null) return state.sortDirection === 'asc' ? 1 : -1
          if (bValue == null) return state.sortDirection === 'asc' ? -1 : 1

          // Handle different data types
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
    stockData: (state) => {
      return state.items.map(item => ({
        name: item.name,
        'current stock': item.quantity,
        'dead stock': 0, // Placeholder - needs actual dead stock data
        lastUpdated: formatDate(new Date(), 'MM/DD/YYYY') // Adding current date as lastUpdated
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
      // Convert data to CSV format
      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','), // Header row
        ...data.map(row => 
          headers.map(header => {
            let cell = row[header]
            // Handle special cases (objects, arrays, etc.)
            if (typeof cell === 'object' && cell !== null) {
              cell = JSON.stringify(cell)
            }
            // Escape quotes and wrap in quotes if contains comma
            cell = String(cell).replace(/"/g, '""')
            return cell.includes(',') ? `"${cell}"` : cell
          }).join(',')
        )
      ].join('\n');

      // Create and trigger download
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
  }
})
