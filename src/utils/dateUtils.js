import { date } from 'quasar'

/**
 * Format a date using Quasar's date formatter
 * @param {Date|string} dateStr - The date to format
 * @param {string} format - The format string (default: 'YYYY-MM-DD')
 * @returns {string} The formatted date string
 */
export const formatDate = (dateStr, format = 'YYYY-MM-DD') => {
  if (!dateStr) return ''
  return date.formatDate(new Date(dateStr), format)
}

/**
 * Get the current date formatted
 * @param {string} format - The format string (default: 'YYYY-MM-DD')
 * @returns {string} The formatted current date
 */
export const getCurrentDate = (format = 'YYYY-MM-DD') => {
  return formatDate(new Date(), format)
}

/**
 * Get a date relative to today
 * @param {number} days - Number of days to add/subtract from today
 * @param {string} format - The format string (default: 'YYYY-MM-DD')
 * @returns {string} The formatted date
 */
export const getRelativeDate = (days, format = 'YYYY-MM-DD') => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return formatDate(date, format)
}

/**
 * Check if a date is valid
 * @param {Date|string} dateStr - The date to check
 * @returns {boolean} True if the date is valid
 */
export const isValidDate = (dateStr) => {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d instanceof Date && !isNaN(d)
}

/**
 * Compare two dates
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date
 * @returns {number} -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export const compareDates = (date1, date2) => {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  return d1 < d2 ? -1 : d1 > d2 ? 1 : 0
}
