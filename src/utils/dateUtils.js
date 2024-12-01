/**
 * @fileoverview Date manipulation and formatting utilities
 * @module dateUtils
 * @description A collection of utility functions for handling dates, formatting, and comparisons.
 * Uses Quasar's date utilities for consistent date handling across the application.
 */

import { date } from 'quasar'

/**
 * @function formatDate
 * @param {Date|string} dateStr - The date to format. Can be a Date object or ISO string
 * @param {string} [format='YYYY-MM-DD'] - The format string using Quasar's date format tokens
 * @returns {string} The formatted date string
 * @description Formats a date using Quasar's date formatter.
 * Common formats:
 * - 'YYYY-MM-DD' -> '2023-12-31'
 * - 'DD/MM/YYYY' -> '31/12/2023'
 * - 'MMMM D, YYYY' -> 'December 31, 2023'
 * @example
 * formatDate('2023-12-31') // Returns '2023-12-31'
 * formatDate('2023-12-31', 'MMM D, YYYY') // Returns 'Dec 31, 2023'
 */
export const formatDate = (dateStr, format = 'YYYY-MM-DD') => {
  if (!dateStr) return ''
  return date.formatDate(new Date(dateStr), format)
}

/**
 * @function getCurrentDate
 * @param {string} [format='YYYY-MM-DD'] - The format string using Quasar's date format tokens
 * @returns {string} The formatted current date
 * @description Gets the current date formatted according to the specified format.
 * Uses the user's local timezone.
 * @example
 * getCurrentDate() // Returns today's date as 'YYYY-MM-DD'
 * getCurrentDate('MMM D, YYYY') // Returns today's date as 'Dec 31, 2023'
 */
export const getCurrentDate = (format = 'YYYY-MM-DD') => {
  return formatDate(new Date(), format)
}

/**
 * @function getRelativeDate
 * @param {number} days - Number of days to add (positive) or subtract (negative) from today
 * @param {string} [format='YYYY-MM-DD'] - The format string using Quasar's date format tokens
 * @returns {string} The formatted date relative to today
 * @description Calculates a date relative to today by adding or subtracting days.
 * Useful for getting dates in the past or future.
 * @example
 * getRelativeDate(1) // Returns tomorrow's date
 * getRelativeDate(-1) // Returns yesterday's date
 * getRelativeDate(7, 'MMM D') // Returns date 7 days from now in 'Dec 31' format
 */
export const getRelativeDate = (days, format = 'YYYY-MM-DD') => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return formatDate(date, format)
}

/**
 * @function isValidDate
 * @param {Date|string} dateStr - The date to validate
 * @returns {boolean} True if the date is valid and parseable
 * @description Checks if a given date string or object represents a valid date.
 * Returns false for null, undefined, invalid date strings, or invalid Date objects.
 * @example
 * isValidDate('2023-12-31') // Returns true
 * isValidDate('invalid') // Returns false
 * isValidDate(null) // Returns false
 */
export const isValidDate = (dateStr) => {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d instanceof Date && !isNaN(d)
}

/**
 * @function compareDates
 * @param {Date|string} date1 - First date to compare
 * @param {string} date2 - Second date to compare
 * @returns {number} Comparison result: -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 * @description Compares two dates and returns their relative order.
 * Useful for sorting dates or determining their chronological order.
 * Both dates are converted to Date objects before comparison.
 * @example
 * compareDates('2023-01-01', '2023-12-31') // Returns -1
 * compareDates('2023-12-31', '2023-01-01') // Returns 1
 * compareDates('2023-01-01', '2023-01-01') // Returns 0
 */
export const compareDates = (date1, date2) => {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  return d1 < d2 ? -1 : d1 > d2 ? 1 : 0
}
