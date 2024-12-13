/**
 * @fileoverview Utility functions for inventory management.
 * Provides helpers for:
 * - Data processing
 * - Validation
 * - Error handling
 * - Type conversion
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {Array<string>} errors - Array of validation error messages
 */

/**
 * @typedef {Object} ProcessedItem
 * @property {string} categoryId - Category ID or null
 * @property {string} category - Category name
 * @property {number} quantity - Normalized quantity
 * @property {number} price - Normalized price
 * @property {string} createdAt - ISO timestamp
 */

import { useInventoryStore } from 'src/stores/inventoryStore'

/**
 * @function processItem
 * @param {Object} item - Raw item data
 * @param {string} [item.categoryId] - Optional category ID
 * @param {string} [item.category] - Optional category name
 * @param {number|string} [item.quantity] - Item quantity (will be converted to number)
 * @param {number|string} [item.price] - Item price (will be converted to number)
 * @param {string} [item.createdAt] - Creation timestamp
 * @returns {Object} Processed item with defaults and type conversions
 * @property {string} category - Category name, defaults to 'Uncategorized'
 * @property {string|null} categoryId - Category ID or null if not provided
 * @property {number} quantity - Normalized quantity value
 * @property {number} price - Normalized price value
 * @property {string} createdAt - ISO timestamp string
 * @description Processes raw item data, ensuring all required fields are present and properly typed.
 * Converts string numbers to actual numbers and sets default values for missing fields.
 */
export const processItem = (item) => {
  const store = useInventoryStore()

  return {
    ...item,
    categoryId: item.categoryId || null,
    category: item.category || store.getCategoryName(item.categoryId) || 'Uncategorized',
    quantity: Number(item.quantity) || 0,
    price: Number(item.price) || 0,
    createdAt: item.createdAt || new Date().toISOString()
  }
}

/**
 * @function validateItem
 * @param {Object} item - Item to validate
 * @param {string} [item.name] - Item name
 * @param {string} [item.sku] - Stock Keeping Unit
 * @param {number} [item.quantity] - Item quantity
 * @param {number} [item.price] - Item price
 * @param {string} [item.image] - Optional image URL
 * @returns {Array<string>} Array of validation error messages
 * @description Validates item data before saving. Checks for:
 * - Required fields (name, SKU)
 * - Numeric values (quantity, price)
 * - Non-negative values (quantity, price)
 * - Valid URL format for image (if provided)
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
 * @param {Error} error - Error object to handle
 * @param {*} [fallback=null] - Optional fallback value to return instead of throwing
 * @returns {*} Fallback value if provided
 * @throws {Error} Original error if no fallback is provided
 * @description Generic error handler that either returns a fallback value or rethrows the error.
 * Logs all errors to console before handling them.
 */
export const handleError = (error, fallback = null) => {
  console.error('Operation failed:', error)
  if (fallback !== null) return fallback
  throw error
}
