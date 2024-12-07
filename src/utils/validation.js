/**
 * @fileoverview Validation utilities for contacts and categories
 */

/**
 * Validates a contact object
 * @param {Object} contact - Contact to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateContact = (contact) => {
  const errors = []

  if (!contact.name?.trim())
    errors.push('Contact name is required')
  if (contact.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))
    errors.push('Invalid email format')
  if (contact.phone?.trim() && !/^\+?[\d\s-()]+$/.test(contact.phone))
    errors.push('Invalid phone number format')
  if (!contact.categoryId)
    errors.push('Contact category is required')

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates a contact category object
 * @param {Object} category - Category to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateContactCategory = (category) => {
  const errors = []

  if (!category.name?.trim())
    errors.push('Category name is required')
  if (category.description && category.description.length > 500)
    errors.push('Category description must not exceed 500 characters')

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Validates data before syncing with Firestore
 * @param {Array} contacts - Contacts to validate
 * @param {Array} categories - Categories to validate
 * @returns {Object} Validation results with invalid items
 */
export const validateDataBeforeSync = (contacts, categories) => {
  const invalidContacts = []
  const invalidCategories = []

  contacts.forEach(contact => {
    const validation = validateContact(contact)
    if (!validation.isValid) {
      invalidContacts.push({
        item: contact,
        errors: validation.errors
      })
    }
  })

  categories.forEach(category => {
    const validation = validateContactCategory(category)
    if (!validation.isValid) {
      invalidCategories.push({
        item: category,
        errors: validation.errors
      })
    }
  })

  return {
    isValid: invalidContacts.length === 0 && invalidCategories.length === 0,
    invalidContacts,
    invalidCategories
  }
}
