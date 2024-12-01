/**
 * @fileoverview Utility functions for inventory management
 */

import { useInventoryStore } from 'src/stores/inventoryStore'

/**
 * @function processItem
 * @param {Object} item - Raw item data
 * @returns {Object} Processed item with defaults and type conversions
 * @description Processes raw item data, ensuring all required fields are present and properly typed
 */
export const processItem = (item) => {
  const store = useInventoryStore()
  const category = item.categoryId ?
    store.categories.find(c => c.id === item.categoryId)?.name || 'Uncategorized' :
    'Uncategorized'

  return {
    ...item,
    category,
    categoryId: item.categoryId || null,
    quantity: Number(item.quantity) || 0,
    price: Number(item.price) || 0,
    createdAt: item.createdAt || new Date().toISOString()
  }
}

/**
 * @function validateItem
 * @param {Object} item - Item to validate
 * @returns {Array<string>} Array of validation error messages
 * @description Validates item data before saving
 */
export const validateItem = (item) => {
  const errors = []
  if (!item.name?.trim()) errors.push('Name is required')
  if (!item.sku?.trim()) errors.push('SKU is required')
  if (typeof item.quantity !== 'number') errors.push('Quantity must be a number')
  if (typeof item.price !== 'number') errors.push('Price must be a number')
  if (item.price < 0) errors.push('Price cannot be negative')
  if (item.quantity < 0) errors.push('Quantity cannot be negative')
  // Image is optional, but validate URL format if provided
  if (item.image && item.image.trim()) {
    try {
      new URL(item.image)
    } catch (e) {
      errors.push('Invalid image URL format')
    }
  }
  return errors
}

/**
 * @function handleError
 * @param {Error} error - Error to handle
 * @param {*} fallback - Fallback value if needed
 * @throws {Error} Rethrows error if no fallback provided
 */
export const handleError = (error, fallback = null) => {
  console.error('Operation failed:', error)
  if (fallback !== null) return fallback
  throw error
}
