/**
 * @fileoverview Validation utilities for contacts and categories
 */

/**
 * Validates a contact object
 * @param {Object} contact - Contact to validate
 * @returns {Object} Validation result with isValid and errors
 */
export const validateContact = async (contact, contactsList) => {
  if(!contactsList) throw new Error('Contacts list is required')

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
    contactsList.where('phone').equals(contact.phone).first(),
    contactsList.where('name').equals(contact.name).first(),
    contactsList.where('email').equals(contact.email).first()
  ]

  const existingContacts = await Promise.all(existingContactsPromises)

  if(existingContacts[0] && existingContacts[0].id !== contact.id)
    errors.push('Contact with this phone number already exists')
  if(existingContacts[1] && existingContacts[1].id !== contact.id)
    errors.push('Contact with this name already exists')
  if(existingContacts[2] && existingContacts[2].id !== contact.id)
    errors.push('Contact with this email already exists')

  // const existingPhone = await contactsList.where('phone').equals(contact.phone).first()
  // if (existingPhone && existingPhone.id !== contact.id)
  //   errors.push('Contact with this phone number already exists')

  // const existingName = await contactsList.where('name').equals(contact.name).first()
  // if (existingName && existingName.id !== contact.id)
  //   errors.push('Contact with this name already exists')

  // const existingEmail = await contactsList.where('email').equals(contact.email).first()
  // if (existingEmail && existingEmail.id !== contact.id)
  //   errors.push('Contact with this email already exists')

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
export const validateDataBeforeSync = (contacts, categories, contactsList) => {
  const invalidContacts = []
  const invalidCategories = []

  contacts.forEach(contact => {
    const validation = validateContact(contact, contactsList)
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
