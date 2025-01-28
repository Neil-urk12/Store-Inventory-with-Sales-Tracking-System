/**
 * @fileoverview Validation utilities for contacts and categories
 */

/**
 * Validates a contact object
 * @param {Object} contact - Contact to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateContact = async (contact, contactsList, newContactId = null) => {
  if (!contactsList) throw new Error('Contacts list is required')

  const errors = []

  if (!contact.name?.trim())
    errors.push('Contact name is required')
  if (contact.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))
    errors.push('Invalid email format')
  if (contact.phone?.trim() && !/^\+?[\d\s-()]+$/.test(contact.phone))
    errors.push('Invalid phone number format')
  if (!contact.categoryId)
    errors.push('Contact category is required')

  const existingContactsPromises = [
    contact.phone?.trim()
      ? contactsList.filter(
        (c) =>
          c.phone?.trim() === contact.phone?.trim() && c.id !== newContactId
      )
      : Promise.resolve([]), // Resolve with an empty array if phone is empty
    contactsList.filter(
      (c) => c.name.trim() === contact.name.trim() && c.id !== newContactId
    ), // Added trim() to name comparison for consistency
    contact.email?.trim()
      ? contactsList.filter(
        (c) =>
          c.email?.trim() === contact.email?.trim() && c.id !== newContactId
      )
      : Promise.resolve([]), // Resolve with an empty array if email is empty
  ];

  const existingContactsResults = await Promise.allSettled(
    existingContactsPromises
  )


  // Check for fulfilled promises and if their value (the filtered array) has any elements
  if (
    existingContactsResults[0].status === 'fulfilled' &&
    existingContactsResults[0].value.length > 0
  )
    errors.push('Contact with this phone number already exists');
  if (
    existingContactsResults[1].status === 'fulfilled' &&
    existingContactsResults[1].value.length > 0
  )
    errors.push('Contact with this name already exists');
  if (
    existingContactsResults[2].status === 'fulfilled' &&
    existingContactsResults[2].value.length > 0
  )
    errors.push('Contact with this email already exists');
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
export const validateDataBeforeSync = async (contacts, categories, contactsList) => {
  const invalidContacts = []
  const invalidCategories = []

  const contactPromises = contacts.map(contact => validateContact(contact, contactsList))
  const contactResults = await Promise.all(contactPromises)

  contactResults.forEach((validation, index) => {
    const contact = contacts[index];
    if (!validation.isValid) {
      invalidContacts.push({
        item: contact,
        errors: validation.errors || ['Unspecified error']
      })
    }
  })

  const categoryPromises = categories.map(category => validateContactCategory(category))
  const categoryResults = await Promise.all(categoryPromises)

  categoryResults.forEach((validation, index) => {
    const category = categories[index];
    if (!validation.isValid) {
      invalidCategories.push({
        item: category,
        errors: validation.errors || ['Unspecified error']
      })
    }
  })

  return {
    isValid: invalidContacts.length === 0 && invalidCategories.length === 0,
    invalidContacts: [...invalidContacts],
    invalidCategories: [...invalidCategories]
  }
}
