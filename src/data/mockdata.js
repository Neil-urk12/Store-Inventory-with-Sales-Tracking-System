import { date } from 'quasar'
const { formatDate } = date

/**
 * Template for inventory items structure
 * Replace this with real data from your backend
 */
export const itemTemplate = {
  id: 'string | number', // Unique identifier
  name: 'string', // Product name
  sku: 'string', // Stock keeping unit
  category: 'string', // Product category
  quantity: 'number', // Current stock quantity
  price: 'number', // Product price
  image: 'string', // URL to product image
  createdAt: 'string', // ISO date string
  updatedAt: 'string', // ISO date string
  syncStatus: 'string', // Status of sync with backend
  firebaseId: 'string' // ID in Firebase (if using Firebase)
}

/**
 * Template for sales data structure
 * Replace this with real data from your backend
 */
export const salesDataTemplate = {
  id: 'string | number', // Unique identifier
  date: 'string', // ISO date string
  amount: 'number', // Sale amount
  items: [{ // Array of items sold
    id: 'string | number',
    quantity: 'number',
    price: 'number'
  }],
  syncStatus: 'string',
  firebaseId: 'string'
}

/**
 * Template for inventory data structure
 * Replace this with real data from your backend
 */
export const inventoryDataTemplate = {
  totalItems: 'number',
  totalValue: 'number',
  categories: [{
    name: 'string',
    count: 'number',
    value: 'number'
  }],
  lastUpdated: 'string' // ISO date string
}

/**
 * Template for financial data structure
 * Replace this with real data from your backend
 */
export const financialDataTemplate = {
  revenue: 'number',
  expenses: 'number',
  profit: 'number',
  period: {
    start: 'string', // ISO date string
    end: 'string' // ISO date string
  }
}

/**
 * Template for low stock alerts structure
 * Replace this with real data from your backend
 */
export const lowStockAlertsTemplate = [{
  id: 'string | number',
  name: 'string',
  currentStock: 'number',
  threshold: 'number',
  category: 'string'
}]

/**
 * Template for top selling products structure
 * Replace this with real data from your backend
 */
export const topSellingProductsTemplate = [{
  id: 'string | number',
  name: 'string',
  salesCount: 'number',
  revenue: 'number',
  period: 'string' // e.g., 'daily', 'weekly', 'monthly'
}]

/**
 * Template for contact categories structure
 * Replace this with real data from your backend
 */
export const contactCategoriesTemplate = [{
  id: 'string | number',
  name: 'string',
  contacts: [{
    id: 'string | number',
    name: 'string',
    email: 'string',
    phone: 'string',
    avatar: 'string'
  }]
}]
