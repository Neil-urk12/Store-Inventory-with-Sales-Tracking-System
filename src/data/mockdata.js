import { date } from 'quasar'
const { formatDate } = date

// Generate dynamic dates for last restocked
const generateRecentDate = () => {
  const date = new Date()
  date.setDate(date.getDate() - Math.floor(Math.random() * 30)) // Random date within last 30 days
  return formatDate(date, 'YYYY-MM-DD')
}

// Generate dynamic product data
export const mockItems = [
  {
    id: 1,
    name: 'Apple iPhone 13',
    sku: 'IPH13',
    category: 'electronics',
    quantity: Math.floor(Math.random() * 50) + 1,
    price: 999.99,
    image: 'https://picsum.photos/200/300'
  },
  {
    id: 2,
    name: 'Samsung Galaxy S22',
    sku: 'SGS22',
    category: 'electronics',
    quantity: Math.floor(Math.random() * 50) + 1,
    price: 899.99,
    image: 'https://picsum.photos/200/301'
  },
  {
    id: 3,
    name: 'Nike Air Max 270',
    sku: 'NAM270',
    category: 'clothing',
    quantity: Math.floor(Math.random() * 50) + 1,
    price: 129.99,
    image: 'https://picsum.photos/200/302'
  },
  {
    id: 4,
    name: 'Adidas Superstar',
    sku: 'ADSUP',
    category: 'clothing',
    quantity: Math.floor(Math.random() * 50) + 1,
    price: 99.99,
    image: 'https://picsum.photos/200/303'
  },
  {
    id: 5,
    name: 'Harry Potter and the Philosopher\'s Stone',
    sku: 'HP1',
    category: 'books',
    quantity: Math.floor(Math.random() * 50) + 1,
    price: 19.99,
    image: 'https://picsum.photos/200/304'
  },
  {
    id: 6,
    name: 'The Lord of the Rings',
    sku: 'LOTR',
    category: 'books',
    quantity: Math.floor(Math.random() * 50) + 1,
    price: 29.99,
    image: 'https://picsum.photos/200/305'
  },
  {
    id: 7,
    name: 'Apple MacBook Air',
    sku: 'MBA',
    category: 'electronics',
    quantity: Math.floor(Math.random() * 50) + 1,
    price: 1499.99,
    image: 'https://picsum.photos/200/306'
  },
  {
    id: 8,
    name: 'Dell Inspiron 15',
    sku: 'DIN15',
    category: 'electronics',
    quantity: Math.floor(Math.random() * 50) + 1,
    price: 699.99,
    image: 'https://picsum.photos/200/307'
  },
  {
    id: 9,
    name: 'Nike Air Force 1',
    sku: 'NAF1',
    category: 'clothing',
    quantity: Math.floor(Math.random() * 50) + 1,
    price: 89.99,
    image: 'https://picsum.photos/200/308'
  },
  {
    id: 10,
    name: 'Adidas Yeezy Boost 350',
    sku: 'ADYB350',
    category: 'clothing',
    quantity: Math.floor(Math.random() * 50) + 1,
    price: 299.99,
    image: 'https://picsum.photos/200/309'
  }
]

// Generate dynamic sales data based on items
export const mockSalesData = mockItems.slice(0, 3).map(item => ({
  productId: item.id,
  productName: item.name,
  quantitySold: Math.floor(Math.random() * 100) + 1,
  revenue: (Math.floor(Math.random() * 100) + 1) * item.price
}))

// Generate dynamic inventory data
export const mockInventoryData = [
  {
    id: 1,
    product: 'Gaming Laptop',
    currentStock: Math.floor(Math.random() * 20) + 1,
    minStock: 5,
    maxStock: 20,
    lastRestocked: generateRecentDate(),
    category: 'electronics'
  },
  {
    id: 2,
    product: 'Wireless Mouse',
    currentStock: Math.floor(Math.random() * 100) + 1,
    minStock: 20,
    maxStock: 100,
    lastRestocked: generateRecentDate(),
    category: 'electronics'
  },
  {
    id: 3,
    product: 'USB-C Cable',
    currentStock: Math.floor(Math.random() * 300) + 1,
    minStock: 50,
    maxStock: 300,
    lastRestocked: generateRecentDate(),
    category: 'accessories'
  },
  {
    id: 4,
    product: 'Mechanical Keyboard',
    currentStock: Math.floor(Math.random() * 50) + 1,
    minStock: 10,
    maxStock: 50,
    lastRestocked: generateRecentDate(),
    category: 'electronics'
  },
  {
    id: 5,
    product: 'Monitor Stand',
    currentStock: Math.floor(Math.random() * 60) + 1,
    minStock: 15,
    maxStock: 60,
    lastRestocked: generateRecentDate(),
    category: 'accessories'
  }
]

// Generate dynamic financial data
const currentDate = formatDate(new Date(), 'YYYY-MM-DD')
export const mockFinancialData = [
  { id: 1, category: 'Revenue', amount: Math.floor(Math.random() * 50000) + 20000, date: currentDate, type: 'income' },
  { id: 2, category: 'Cost of Goods', amount: -Math.floor(Math.random() * 30000) - 10000, date: currentDate, type: 'expense' },
  { id: 3, category: 'Operating Expenses', amount: -Math.floor(Math.random() * 10000) - 2000, date: currentDate, type: 'expense' },
  { id: 4, category: 'Tax', amount: -Math.floor(Math.random() * 5000) - 1000, date: currentDate, type: 'expense' }
]

// Calculate net profit dynamically
const netProfit = mockFinancialData.reduce((sum, item) => sum + item.amount, 0)
mockFinancialData.push({ id: 5, category: 'Net Profit', amount: netProfit, date: currentDate, type: 'summary' })

// Generate dynamic low stock alerts based on inventory data
export const mockLowStockAlerts = mockInventoryData
  .filter(item => item.currentStock <= item.minStock * 1.5) // Alert when stock is within 50% of minimum
  .map(item => ({
    id: item.id,
    product: item.product,
    currentStock: item.currentStock,
    minStock: item.minStock,
    status: item.currentStock <= item.minStock ? 'critical' : 'warning'
  }))

// Generate dynamic top selling products
export const mockTopSellingProducts = mockItems
  .slice(0, 5)
  .map(item => ({
    id: item.id,
    product: item.name,
    totalSold: Math.floor(Math.random() * 100) + 1,
    revenue: (Math.floor(Math.random() * 100) + 1) * item.price
  }))
  .sort((a, b) => b.revenue - a.revenue)
