/**
 * @fileoverview Manages contacts and contact categories with local and cloud synchronization.
 * Implements Pinia store pattern for contact management.
 */

import { defineStore } from 'pinia'
import { db } from '../db/dexiedb'
import {
  collection,
  getDocs,
  query,
  writeBatch,
  doc,
  serverTimestamp,
  getDoc
} from 'firebase/firestore'
import { db as fireDb } from '../firebase/firebaseconfig'
import { useNetworkStatus } from '../services/networkStatus'
import { syncQueue } from '../services/syncQueue'
import { debounce } from 'lodash'
import { validateContact, validateContactCategory, validateDataBeforeSync } from '../utils/validation'
import { DatabaseError, ValidationError } from '../db/dexiedb'

const { isOnline } = useNetworkStatus()

// Debounced queue processing to handle multiple rapid changes efficiently
const processQueueDebounced = debounce(() => syncQueue.processQueue(), 1000)

/**
 * Custom error class for contact-related errors
 */
class ContactError extends Error {
  constructor(message, code) {
    super(message)
    this.name = 'ContactError'
    this.code = code
  }
}

/**
 * @const {Store} useContactsStore
 * @description Pinia store for managing contacts and contact categories
 */
export const useContactsStore = defineStore('contacts', {
  state: () => ({
    loading: false,
    error: null,
    contactCategories: [],
    contactsList: [],
    searchQuery: '',
    contactCategoryFilter: null,
    contactEntryDialog: false,
    contactBeingEdited: null,
    editMode: false,
    contactsSyncStatus: {
      lastSync: null,
      inProgress: false,
      error: null,
      pendingChanges: 0
    }
  }),

  getters: {
    /**
     * @getter
     * @param {string} contactCategoryId - Category ID to filter by
     * @returns {Array} Contacts in the specified category
     */
    getContactsByCategory: (state) => (contactCategoryId) => {
      // const contactCategory = state.contactCategories.find(c => c.id === contactCategoryId)
      // return contactCategory ? contactCategory.contacts : []
      return state.contactCategories.find(c => c.id === contactCategoryId)?.contacts || []
    },

    /**
     * @getter
     * @param {string} contactCategoryId - Category ID to find
     * @returns {Object|undefined} Contact category by ID
     */
    getContactCategoryById: (state) => (contactCategoryId) => {
      return state.contactCategories.find(c => c.id === contactCategoryId)
    }
  },

  actions: {
    /**
     * Handles errors consistently across the store
     * @private
     */
    _handleActionError(error, context) {
      console.error(`Error in ${context}:`, error)
      if (error instanceof ContactError) this.error = error.message
      else if (error instanceof ValidationError) this.error = `Validation error: ${error.message}`
      else if (error instanceof DatabaseError) this.error = `Database error: ${error.message}`
      else this.error = 'An unexpected error occurred'
      throw error
    },

    /**
     * Sets the contact being edited with proper immutability
     */
    setContactBeingEdited(contact) {
      this.contactBeingEdited = contact ? JSON.parse(JSON.stringify(contact)) : null
    },

    /**
     * @async
     * @method initializeDb
     * @returns {Promise<void>}
     * @description Initializes the contacts database and performs initial sync if needed
     */
    async initializeDb() {
      try {
        await this.loadContactCategories()

        if (isOnline.value) {
          await this.syncWithFirestore()
          await processQueueDebounced()
        }
      } catch (error) {
        this._handleActionError(error, 'initializeDb')
      }
    },

    /**
     * @async
     * @method loadContactCategories
     * @returns {Promise<void>}
     * @description Loads contact categories and their associated contacts
     */
    async loadContactCategories() {
      this.loading = true
      try {
        const categories = await db.getAllContactCategories()
        for (const category of categories) {
          category.contacts = await db.getContactsByCategory(category.id)
        }
        this.contactCategories = categories
      } catch (error) {
        this._handleActionError(error, 'loadContactCategories')
      } finally {
        this.loading = false
      }
    },

    /**
     * @async
     * @method addContact
     * @param {Object} contact - Contact to add
     * @returns {Promise<string>} ID of added contact
     * @throws {ContactError} If validation fails or adding contact fails
     */
    async addContact(contact) {
      try {
        const validation = await validateContact(contact, this.contactsList)
        if (!validation.isValid)
          throw new ValidationError(validation.errors[0])

        const id = await db.addContact(contact)

        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'add',
            collection: 'contactsList',
            data: { ...contact, id: id.toString() },
            timestamp: new Date()
          })
          await processQueueDebounced()
        }

        await this.loadContactCategories()
        return id
      } catch (error) {
        this._handleActionError(error, 'addContact')
      }
    },

    /**
     * @async
     * @method addContactCategory
     * @param {Object} contactCategory - Category to add
     * @returns {Promise<string>} ID of added category
     * @throws {ContactError} If adding category fails
     */
    async addContactCategory(contactCategory) {
      try {
        const validation = validateContactCategory(contactCategory)
        if (!validation.isValid)
          throw new ValidationError(validation.errors[0])

        const id = await db.addContactCategory(contactCategory)
        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'add',
            collection: 'contactCategories',
            data: { ...contactCategory, localId: id },
            timestamp: new Date()
          })
          await processQueueDebounced()
        }
        await this.loadContactCategories()
        return id
      } catch (error) {
        this._handleActionError(error, 'addContactCategory')
      }
    },

    /**
     * @async
     * @method updateContactCategory
     * @param {string} id - Category ID to update
     * @param {Object} changes - Changes to apply to the category
     * @returns {Promise<void>}
     * @throws {ContactError} If updating category fails
     */
    async updateContactCategory(id, changes) {
      try {
        await db.updateContactCategory(id, changes)
        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'update',
            collection: 'contactCategories',
            docId: id,
            data: changes,
            timestamp: new Date()
          })
          await processQueueDebounced()
        }
        await this.loadContactCategories()
      } catch (error) {
        this._handleActionError(error, 'updateContactCategory')
      }
    },

    /**
     * @async
     * @method deleteContactCategory
     * @param {string} id - Category ID to delete
     * @returns {Promise<void>}
     * @throws {ContactError} If deleting category fails
     */
    async deleteContactCategory(id) {
      try {
        await db.deleteContactCategory(id)
        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'delete',
            collection: 'contactCategories',
            docId: id.toString(),
            timestamp: new Date()
          })
          await processQueueDebounced()
        }
        await this.loadContactCategories()
      } catch (error) {
        this._handleActionError(error, 'deleteContactCategory')
      }
    },

    /**
     * @async
     * @method updateContact
     * @param {string} id - Contact ID to update
     * @param {Object} changes - Changes to apply to the contact
     * @returns {Promise<void>}
     * @throws {ContactError} If updating contact fails
     */
    async updateContact(id, changes) {
      try {
        await db.updateContact(id, changes)
        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'update',
            collection: 'contactsList',
            docId: id.toString(),
            data: { ...changes, id: id.toString() },
            timestamp: new Date()
          })
          await processQueueDebounced()
        }
        await this.loadContactCategories()
      } catch (error) {
        this._handleActionError(error, 'updateContact')
      }
    },

    /**
     * @async
     * @method deleteContact
     * @param {string} id - Contact ID to delete
     * @returns {Promise<void>}
     * @throws {ContactError} If deleting contact fails
     */
    async deleteContact(id) {
      try {
        await db.deleteContact(id)
        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'delete',
            collection: 'contactsList',
            docId: id.toString(),
            timestamp: new Date()
          })
          await processQueueDebounced()
        }
        await this.loadContactCategories()
      } catch (error) {
        this._handleActionError(error, 'deleteContact')
      }
    },

    /**
     * @async
     * @method syncWithFirestore
     * @returns {Promise<void>}
     * @description Synchronizes local contacts data with Firestore
     */
    async syncWithFirestore() {
      try {
        if (!isOnline.value)
          throw new ContactError('Cannot sync while offline', 'OFFLINE_ERROR')

        const localContactCategories = await db.getAllContactCategories()
        const localContacts = await db.getAllContacts()

        this.contactsSyncStatus.inProgress = true

        // Validate data before syncing
        const validationResult = validateDataBeforeSync(localContacts, localContactCategories, this.contactsList)
        if (!validationResult.isValid) {
          if(validationResult.invalidContacts.length > 0 || validationResult.invalidCategories.length > 0){
            const errorMessage = [
              'Validation failed:',
              ...validationResult.invalidContacts.map(({ item, errors = [] }) =>
                `Contact "${item.name || 'Unknown'}": ${errors.length > 0 ? errors.join(', ') : 'Unspecified error'}`
              ),
              ...validationResult.invalidCategories.map(({ item, errors = [] }) =>
                `Category "${item.name || 'Unknown'}": ${errors.length > 0 ? errors.join(', ') : 'Unspecified error'}`
              )
            ].join('\n')
            throw new ContactError(errorMessage)
          }
        }

        const contactCategoriesSnapshot = await getDocs(query(collection(fireDb, 'contactCategories')))
        const contactsListSnapshot = await getDocs(query(collection(fireDb, 'contactsList')))

        const firestoreContactCategories = contactCategoriesSnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            ...data,
            updatedAt: data.updatedAt && typeof data.updatedAt.toDate === 'function'
              ? data.updatedAt.toDate().toISOString()
              : new Date().toISOString()
          }
        })
        const firestoreContactsList = contactsListSnapshot.docs.map(doc => {
          const data = doc.data()
          return {
            id: doc.id,
            ...data,
            updatedAt: data.updatedAt && typeof data.updatedAt.toDate === 'function'
              ? data.updatedAt.toDate().toISOString()
              : new Date().toISOString()
          }
        })

        const mergedContactCategories = await this.mergeChanges(localContactCategories, firestoreContactCategories, 'name')
        const mergedContacts = await this.mergeChanges(localContacts, firestoreContactsList, 'name')

        const batchSize = 500

        // Update contact categories in Firebase
        if (mergedContactCategories.length > 0) {
          const contactCategoriesRef = collection(fireDb, 'contactCategories')
          for (let i = 0; i < mergedContactCategories.length; i += batchSize) {
            const batch = writeBatch(fireDb)
            const currentBatch = mergedContactCategories.slice(i, Math.min(i + batchSize, mergedContactCategories.length))

            for (const category of currentBatch) {
              const { id, ...categoryData } = category
              if (id && typeof id === 'string') {
                const docRef = doc(contactCategoriesRef, id)
                const docSnapshot = await getDoc(docRef)
                if (docSnapshot.exists()) {
                  batch.update(docRef, {
                    ...categoryData,
                    updatedAt: serverTimestamp()
                  })
                } else {
                  batch.set(docRef, {
                    ...categoryData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                  })
                }
              } else {
                const newDocRef = doc(contactCategoriesRef)
                batch.set(newDocRef, {
                  ...categoryData,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                })
              }
            }

            try {
              await batch.commit()
            } catch (error) {
              console.error('Contact category batch update failed:', error)
            }
          }
        }

        // Update contacts in Firebase
        if (mergedContacts.length > 0) {
          const contactsRef = collection(fireDb, 'contactsList')
          for (let i = 0; i < mergedContacts.length; i += batchSize) {
            const batch = writeBatch(fireDb)
            const currentBatch = mergedContacts.slice(i, Math.min(i + batchSize, mergedContacts.length))

            for (const contact of currentBatch) {
              const { id, ...contactData } = contact
              if (id && typeof id === 'string') {
                const docRef = doc(contactsRef, id)
                const docSnapshot = await getDoc(docRef)
                if (docSnapshot.exists()) {
                  batch.update(docRef, {
                    ...contactData,
                    updatedAt: serverTimestamp()
                  })
                } else {
                  batch.set(docRef, {
                    ...contactData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                  })
                }
              } else {
                const newDocRef = doc(contactsRef)
                batch.set(newDocRef, {
                  ...contactData,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                })
              }
            }

            try {
              await batch.commit()
            } catch (error) {
              console.error('Contact batch update failed:', error)
            }
          }
        }

        // Sync merged data back to local database
        if (mergedContactCategories.length > 0)
          await db.syncWithFirestoreSimple(mergedContactCategories, 'contactCategories')

        if (mergedContacts.length > 0) {
          await db.syncWithFirestoreSimple(mergedContacts, 'contactsList')
        } else {
          const contactCategoriesRef = collection(fireDb, 'contactCategories')
          const contactsRef = collection(fireDb, 'contactsList')

          if (localContactCategories.length > 0) {
            const batch = writeBatch(fireDb)
            let batchCount = 0

            for (const category of localContactCategories) {
              const { id, ...categoryData } = category
              const newDocRef = doc(contactCategoriesRef)
              batch.set(newDocRef, {
                ...categoryData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              })

              batchCount++
              if (batchCount >= 500) {
                try {
                  await batch.commit()
                  batchCount = 0
                } catch (error) {
                  console.error('Contact category batch upload failed:', error)
                }
              }
            }

            if (batchCount > 0) {
              try {
                await batch.commit()
              } catch (error) {
                console.error('Final contact category batch upload failed:', error)
              }
            }
          }

          // Upload contacts
          if (localContacts.length > 0) {
            const batch = writeBatch(fireDb)
            let batchCount = 0

            for (const contact of localContacts) {
              const { id, ...contactData } = contact
              const newDocRef = doc(contactsRef)
              batch.set(newDocRef, {
                ...contactData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              })

              batchCount++
              if (batchCount >= 500) {
                try {
                  await batch.commit()
                  batchCount = 0
                } catch (error) {
                  console.error('Contact batch upload failed:', error)
                }
              }
            }

            if (batchCount > 0) {
              try {
                await batch.commit()
              } catch (error) {
                console.error('Final contact batch upload failed:', error)
              }
            }
          }
        }

        await this.loadContactCategories()

        this.contactsSyncStatus.lastSync = new Date().toISOString()
        this.contactsSyncStatus.pendingChanges = 0
      } catch (error) {
        this._handleActionError(error, 'syncWithFirestore')
      } finally {
        this.contactsSyncStatus.inProgress = false
      }
    },

    /**
     * @async
     * @method mergeChanges
     * @param {Array} localItems - Local items to merge
     * @param {Array} firestoreItems - Firestore items to merge
     * @param {string} uniqueField - Field to use for merging
     * @returns {Promise<Array>} Merged items without duplicates
     */
    async mergeChanges(localItems, firestoreItems, uniqueField) {
      const merged = new Map()
      const seenIds = new Set(firestoreItems.map(item => item.id).filter(Boolean))

      firestoreItems.forEach(item => {
        if (item[uniqueField])
          merged.set(item[uniqueField], item)
        else
          console.warn('Firestore item missing unique field:', item)
      })

      localItems.forEach(localItem => {
        if (!localItem[uniqueField])
          return console.warn('Local item missing unique field:', localItem)

        const existingItem = merged.get(localItem[uniqueField])
        if (!existingItem) {
          if (!localItem.id || !seenIds.has(localItem.id))
            merged.set(localItem[uniqueField], localItem)
          return
        }

        const localDate = new Date(localItem.updatedAt || 0)
        const existingDate = new Date(existingItem.updatedAt || 0)

        if (localDate > existingDate) {
          merged.set(localItem[uniqueField], {
            ...localItem,
            id: existingItem.id
          })
        }
      })

      const result = Array.from(merged.values())
      const uniqueCheck = new Set()
      return result.filter(item => {
        const key = item[uniqueField]
        if (!key || uniqueCheck.has(key)) {
          console.warn('Duplicate or invalid item filtered out:', item)
          return false
        }
        uniqueCheck.add(key)
        return true
      })
    }
  }
})
