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

  const existingContacts = await Promise.all([
    contactsList.filter(c => c.phone === contact.phone && c.id !== contact.id),
    contactsList.filter(c => c.name === contact.name && c.id !== contact.id),
    contactsList.filter(c => c.email === contact.email && c.id !== contact.id)
  ])

  if(existingContacts[0].length > 0)
    errors.push('Contact with this phone number already exists')
  if(existingContacts[1].length > 0)
    errors.push('Contact with this name already exists')
  if(existingContacts[2].length > 0)
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
  // contacts.forEach(contact => {
  //   const validation = validateContact(contact, contactsList)
  //   if (!validation.isValid) {
  //     invalidContacts.push({
  //       item: contact,
  //       errors: validation.errors
  //     })
  //   }
  // })

  // categories.forEach(category => {
  //   const validation = validateContactCategory(category)
  //   if (!validation.isValid) {
  //     invalidCategories.push({
  //       item: category,
  //       errors: validation.errors
  //     })
  //   }
  // })

  return {
    isValid: invalidContacts.length === 0 && invalidCategories.length === 0,
    invalidContacts : [...invalidContacts],
    invalidCategories : [...invalidCategories]
  }
}
