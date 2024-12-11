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
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc
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
     * Retrieves contacts belonging to a specific category.
     * @param {string} contactCategoryId - The ID of the contact category.
     * @returns {Array} An array of contacts belonging to the specified category, or an empty array if no contacts are found or the category does not exist.
     */
    getContactsByCategory: (state) => (contactCategoryId) => {
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
     * Handles errors consistently across the store.  Sets the store's `error` state based on the type of error encountered.
     * @private
     * @param {Error} error - The error object to handle.
     * @param {string} context - The context where the error occurred (for logging purposes).
     * @throws {Error} Re-throws the original error after setting the store's error state.
     */
    _handleActionError(error, context) {
      if (error instanceof ContactError) this.error = error.message
      else if (error instanceof ValidationError) this.error = `Validation error: ${error.message}`
      else if (error instanceof DatabaseError) this.error = `Database error: ${error.message}`
      else this.error = 'An unexpected error occurred'
      throw error
    },

    /**
     * Sets the contact currently being edited, ensuring immutability by creating a deep copy.
     * @param {Object} contact - The contact object to be edited.  If null, clears the currently edited contact.
     */
    setContactBeingEdited(contact) {
      this.contactBeingEdited = contact ? JSON.parse(JSON.stringify(contact)) : null
    },

    /**
     * Initializes the contacts database and performs an initial synchronization with Firestore if online.
     * @async
     * @method initializeDb
     * @returns {Promise<void>}
     * @description Initializes the contacts database and performs initial sync if needed
     */
    async initializeDb() {
      try {
        if(this.contactsList.length === 0 || this.contactCategories.length === 0)
          await this.loadContactCategories()
        else {
          this.contactCategories = await db.getAllContactCategories()
          this.contactsList = await db.getAllContacts()
        }
        if (isOnline.value) {
          await this.syncWithFirestore()
          await processQueueDebounced()
        }
      } catch (error) {
        this._handleActionError(error, 'initializeDb')
      }
    },

    /**
     * Loads contact categories from the local database and retrieves their associated contacts.
     * @async
     * @returns {Promise<void>}
     * @description Loads contact categories and their associated contacts
     */
    async loadContactCategories() {
      this.loading = true
      try {
        const categories = await db.getAllContactCategories()
        for (const category of categories)
          category.contacts = await db.getContactsByCategory(category.id)
        this.contactCategories = categories
      } catch (error) {
        this._handleActionError(error, 'loadContactCategories')
      } finally {
        this.loading = false
      }
    },

    /**
     * Adds a new contact to the database and optionally synchronizes it with Firestore.
     * @async
     * @param {Object} contact - The contact object to add.
     * @returns {Promise<string>} The ID of the newly added contact.
     * @throws {ContactError} If contact validation fails or database operations fail.  Provides specific error messages for validation and database errors.
     */
    async addContact(contact) {
      try {
        if(this.contactsList.length === 0) this.contactsList = await db.getAllContacts()
        const validation = await validateContact(contact, this.contactsList, contact.id)
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
     * Adds a new contact category to the database and optionally synchronizes it with Firestore.
     * @async
     * @method addContactCategory
     * @param {Object} contactCategory - Category to add
     * @returns {Promise<string>} ID of added category
     * @throws {ContactError} If adding category fails
     */
    async addContactCategory(contactCategory) {
      try {
        const validation = await validateContactCategory(contactCategory)
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
     * Updates an existing contact category in the database and optionally synchronizes the changes with Firestore.
     * @async
     * @param {string} id - The ID of the contact category to update.
     * @param {Object} changes - An object containing the changes to apply to the contact category.
     * @returns {Promise<void>}
     * @throws {ContactError} If database operations fail.
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
     * Deletes a contact category from the database and optionally synchronizes the deletion with Firestore.
     * @async
     * @param {string} id - The ID of the contact category to delete.
     * @returns {Promise<void>}
     * @throws {ContactError} If database operations fail.
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
     * Updates an existing contact in the database and optionally synchronizes the changes with Firestore.
     * @async
     * @param {string} id - The ID of the contact to update.
     * @param {Object} changes - An object containing the changes to apply to the contact.
     * @returns {Promise<void>}
     * @throws {ContactError} If database operations fail.
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
     * Deletes a contact from the database and optionally synchronizes the deletion with Firestore.  Handles cases where the contact might exist only locally or in Firestore.
     * @async
     * @param {string} contactId - The ID of the contact to delete.
     * @returns {Promise<void>}
     * @throws {ContactError} If database operations fail.
     */
    async deleteContact(contactId) {
      try {
        const localRecord = await this.contactCategories.flatMap(c => c.contacts).find(c => c.id === contactId || c.localId === contactId)
        const firebaseRecord = localRecord ? localRecord.firebaseId : localRecord.localId || localRecord.id
        await db.deleteContact(contactId)

        const deleteOperation = {
          type: 'delete',
          collection: 'contactsList',
          docId: contactId.toString(),
          firebaseId: firebaseRecord
        }

        if (isOnline.value) {
          if (firebaseRecord) {
            try {
              await deleteDoc(doc(fireDb, 'contactsList', firebaseRecord))
            } catch (error) {
              if (error.code === 'not-found')
                console.warn(`Firebase document with ID ${firebaseRecord} not found`)
              else {
                console.error('Error deleting from Firebase:', error)
                if (this.handleSyncError(error))
                  await syncQueue.processQueue(deleteOperation)
                else
                  throw error
              }
            }
          } else
            await syncQueue.processQueue(deleteOperation)
        } else
          await syncQueue.addToQueue(deleteOperation)
        await this.loadContactCategories()
      } catch (error) {
        this._handleActionError(error, 'deleteContact')
      }
    },

    /**
     * Fetches contact categories and contacts from Firestore.
     * @async
     * @method fetchFirestoreData
     * @returns {Promise<Object>} - An object containing firestore contact categories and contacts
     * @description Fetches contact categories and contacts from Firestore
     */
    async fetchFirestoreData() {
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

      return { firestoreContactCategories, firestoreContactsList }
    },

    /**
     * Merges local and Firestore data for contact categories and contacts. Uses the `mergeChanges` action to handle the merging logic.
     * @async
     * @param {Array} localContactCategories - Array of local contact categories.
     * @param {Array} localContacts - Array of local contacts.
     * @param {Object} firestoreData - Object containing Firestore contact categories and contacts.
     * @returns {Promise<Object>} An object containing the merged contact categories and contacts.
     */
    async mergeLocalAndFirestoreData(localContactCategories, localContacts, firestoreData) {
      const { firestoreContactCategories, firestoreContactsList } = firestoreData
      const mergedContactCategories = await this.mergeChanges(localContactCategories, firestoreContactCategories, 'name')
      const mergedContacts = await this.mergeChanges(localContacts, firestoreContactsList, 'name')
      return { mergedContactCategories, mergedContacts }
    },

    /**
     * Updates Firestore with merged data in batches to improve efficiency and handle large datasets.  Includes error handling for batch updates.
     * @async
     * @param {Array} mergedContactCategories - Array of merged contact categories.
     * @param {Array} mergedContacts - Array of merged contacts.
     * @returns {Promise<void>}
     * @description Updates Firestore with merged data in batches
     */
    async updateFirestoreData(mergedContactCategories, mergedContacts) {
      const batchSize = 500

      async function processBatchUpdates(collectionName, items) {
        if (!items || items.length === 0) return

        const collectionRef = collection(fireDb, collectionName)
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = writeBatch(fireDb)
          const currentBatch = items.slice(i, Math.min(i + batchSize, items.length))

          await Promise.all(currentBatch.map(async (item) => {
            const { id, ...itemData } = item

            // Validate ID
            if (id && typeof id !== 'string')
              return console.error(`Invalid ID type for item in ${collectionName}:`, item)

            const docRef = id ? doc(collectionRef, id) : doc(collectionRef)
            const isUpdate = !!id // More concise way to check for existence of id
            const timestampData = {
              updatedAt: serverTimestamp(),
              ...(isUpdate ? {} : { createdAt: serverTimestamp() }),
            }

            try {
              if (isUpdate) {
                // Check for document existence before updating
                const docSnap = await getDoc(docRef)
                if (docSnap.exists()) {
                  await updateDoc(docRef, { ...itemData, ...timestampData })
                } else {
                  console.warn(`Document with ID ${id} not found in ${collectionName}. Creating it`)
                  await setDoc(docRef, { ...itemData, ...timestampData }) // No need for merge: true here
                }
              } else
                await setDoc(docRef, { ...itemData, ...timestampData }) // No need for merge: true here

            } catch (error) {
              console.error(`Error updating/creating document in ${collectionName}:`, error, item)
              // Implement more sophisticated error handling (retry, logging, etc.)
            }
          }))

          // currentBatch.forEach(item => {
          //   const { id, ...itemData } = item
          //   const docRef = id && typeof id === 'string' ? doc(collectionRef, id) : doc(collectionRef);
          //   const isUpdate = id && typeof id === 'string';
          //   const timestampData = isUpdate
          //       ? { updatedAt: serverTimestamp() }
          //       : { createdAt: serverTimestamp(), updatedAt: serverTimestamp() };

          //   batch[isUpdate ? 'update' : 'set'](docRef, { ...itemData, ...timestampData }, { merge: isUpdate });
          // });

          try {
            await batch.commit()
          } catch (error) {
            console.error(`Batch update failed for ${collectionName}:`, error)
          }
        }
      }

      // async function processBatchUpdates(collectionName, items){
      //   if(!items || items.length === 0) return

      //   const collectionRef = collection(fireDb, collectionName)
      //   for (let i = 0; i < items.length; i += batchSize) {
      //     const batch = writeBatch(fireDb)
      //     const currentBatch = items.slice(i, Math.min(i + batchSize, items.length))

      //     for (const item of currentBatch) {
      //       const { id, ...itemData } = item
      //       if (id && typeof id === 'string') {
      //         const docRef = doc(collectionRef, id)
      //         const docSnapshot = await getDoc(docRef)
      //         if (docSnapshot.exists()) {
      //           batch.update(docRef, {
      //             ...itemData,
      //             updatedAt: serverTimestamp()
      //           })
      //         } else {
      //           batch.set(docRef, {
      //             ...itemData,
      //             createdAt: serverTimestamp(),
      //             updatedAt: serverTimestamp()
      //           })
      //         }
      //       } else {
      //         const newDocRef = doc(collectionRef)
      //         batch.set(newDocRef, {
      //           ...itemData,
      //           createdAt: serverTimestamp(),
      //           updatedAt: serverTimestamp()
      //         })
      //       }
      //     }

      //     try {
      //       await batch.commit()
      //     } catch (error) {
      //       console.error(`${collectionName} batch update failed:`, error)
      //     }
      //   }
      // }

      async function deleteDuplicates(collectionName, uniqueField) {
        const collectionRef = collection(fireDb, collectionName)
        const querySnapshot = await getDocs(collectionRef)
        const existingItems = new Map()
        const batch = writeBatch(fireDb)
        let deleteCount = 0

        querySnapshot.forEach(doc => {
          const data = doc.data()
          const key = data[uniqueField]
          if (existingItems.has(key)){
            batch.delete(doc.ref)
            deleteCount++
          }
          else
            existingItems.set(key, data)
        })

        if (deleteCount > 0) {
          try {
            await batch.commit()
            console.log(`Deleted ${deleteCount} duplicate documents from ${collectionName}`)
          } catch (error) {
            console.error(`Error deleting duplicates from ${collectionName}:`, error)
          }
        }
      }

      await Promise.all([
        deleteDuplicates('contactCategories', 'name'),
        deleteDuplicates('contactsList', 'name')
      ]);
      await Promise.all([
        processBatchUpdates('contactCategories', mergedContactCategories),
        processBatchUpdates('contactsList', mergedContacts)
      ])


      // if (mergedContactCategories.length > 0) {
      //   const contactCategoriesRef = collection(fireDb, 'contactCategories')
      //   for (let i = 0; i < mergedContactCategories.length; i += batchSize) {
      //     const batch = writeBatch(fireDb)
      //     const currentBatch = mergedContactCategories.slice(i, Math.min(i + batchSize, mergedContactCategories.length))

      //     for (const category of currentBatch) {
      //       const { id, ...categoryData } = category
      //       if (id && typeof id === 'string') {
      //         const docRef = doc(contactCategoriesRef, id)
      //         const docSnapshot = await getDoc(docRef)
      //         if (docSnapshot.exists()) {
      //           batch.update(docRef, {
      //             ...categoryData,
      //             updatedAt: serverTimestamp()
      //           })
      //         } else {
      //           batch.set(docRef, {
      //             ...categoryData,
      //             createdAt: serverTimestamp(),
      //             updatedAt: serverTimestamp()
      //           })
      //         }
      //       } else {
      //         const newDocRef = doc(contactCategoriesRef)
      //         batch.set(newDocRef, {
      //           ...categoryData,
      //           createdAt: serverTimestamp(),
      //           updatedAt: serverTimestamp()
      //         })
      //       }
      //     }

      //     try {
      //       await batch.commit()
      //     } catch (error) {
      //       console.error('Contact category batch update failed:', error)
      //     }
      //   }
      // }

      // Update contacts in Firebase
      // if (mergedContacts.length > 0) {
      //   const contactsRef = collection(fireDb, 'contactsList')
      //   for (let i = 0; i < mergedContacts.length; i += batchSize) {
      //     const batch = writeBatch(fireDb)
      //     const currentBatch = mergedContacts.slice(i, Math.min(i + batchSize, mergedContacts.length))

      //     for (const contact of currentBatch) {
      //       const { id, ...contactData } = contact
      //       if (id && typeof id === 'string') {
      //         const docRef = doc(contactsRef, id)
      //         const docSnapshot = await getDoc(docRef)
      //         if (docSnapshot.exists()) {
      //           batch.update(docRef, {
      //             ...contactData,
      //             updatedAt: serverTimestamp()
      //           })
      //         } else {
      //           batch.set(docRef, {
      //             ...contactData,
      //             createdAt: serverTimestamp(),
      //             updatedAt: serverTimestamp()
      //           })
      //         }
      //       } else {
      //         const newDocRef = doc(contactsRef)
      //         batch.set(newDocRef, {
      //           ...contactData,
      //           createdAt: serverTimestamp(),
      //           updatedAt: serverTimestamp()
      //         })
      //       }
      //     }

      //     try {
      //       await batch.commit()
      //     } catch (error) {
      //       console.error('Contact batch update failed:', error)
      //     }
      //   }
      // }
    },

    /**
     * Updates the local IndexedDB database with merged contact categories and contacts data.
     * @async
     * @param {Array} mergedContactCategories - Array of merged contact categories.
     * @param {Array} mergedContacts - Array of merged contacts.
     * @returns {Promise<void>}
     */
    async updateLocalDatabase(mergedContactCategories, mergedContacts) {
      if (mergedContactCategories.length > 0)
        await db.syncWithFirestoreSimple(mergedContactCategories, 'contactCategories')

      if (mergedContacts.length > 0)
        await db.syncWithFirestoreSimple(mergedContacts, 'contactsList')
    },

    /**
     * Uploads new local data to Firestore if no merged data exists during synchronization.  Handles batch uploads for efficiency.
     * @async
     * @param {Array} localContactCategories - Array of local contact categories.
     * @param {Array} localContacts - Array of local contacts.
     * @returns {Promise<void>}
     * @description Uploads any new local data to Firestore if no merged data exists
     */
    async uploadNewData(localContactCategories, localContacts) {
      const contactCategoriesRef = collection(fireDb, 'contactCategories')
      const contactsRef = collection(fireDb, 'contactsList')

      const batchSize = 500

      // Upload contact categories
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
          if (batchCount >= batchSize) {
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
          if (batchCount >= batchSize) {
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
    },

    /**
     * Synchronizes local contacts data with Firestore.  Handles offline scenarios, data validation, merging, and updates in batches.
     * @async
     * @returns {Promise<void>}
     * @throws {ContactError} If any error occurs during the synchronization process.  Provides specific error messages for offline errors and validation failures.
     */
    async syncWithFirestore() {
      try {
        if (!isOnline.value)
          throw new ContactError('Cannot sync while offline', 'OFFLINE_ERROR')

        const localContactCategories = await db.getAllContactCategories()
        const localContacts = await db.getAllContacts()

        this.contactsSyncStatus.inProgress = true

        // Validate data before syncing
        const validationResult = await validateDataBeforeSync(localContacts, localContactCategories, this.contactsList)
        if (!validationResult.isValid) {
          const errorMessage = [
            'Validation failed:',
            ...validationResult.invalidContacts.map(({ item, errors = [] }) =>
              `Contact "${item.name || 'Unknown'}": ${errors.length > 0 ? errors.join(', ') : null}`
            ),
            ...validationResult.invalidCategories.map(({ item, errors = [] }) =>
              `Category "${item.name || 'Unknown'}": ${errors.length > 0 ? errors.join(', ') : null}`
            )
          ].join('\n')
          throw new ContactError(errorMessage)
        }

        const firestoreData = await this.fetchFirestoreData()
        const mergedData = await this.mergeLocalAndFirestoreData(localContactCategories, localContacts, firestoreData)
        await this.updateFirestoreData(mergedData.mergedContactCategories, mergedData.mergedContacts)
        await this.updateLocalDatabase(mergedData.mergedContactCategories, mergedData.mergedContacts)

        if (mergedData.mergedContactCategories.length === 0 && mergedData.mergedContacts.length === 0)
          await this.uploadNewData(localContactCategories, localContacts)

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
     * Merges local and Firestore items, resolving conflicts based on the `updatedAt` timestamp.  Handles cases with compound keys (e.g., category and name).
     * @async
     * @param {Array} localItems - Array of local items to merge.
     * @param {Array} firestoreItems - Array of Firestore items to merge.
     * @param {string} uniqueField - The field to use for merging and identifying unique items (e.g., 'name').
     * @returns {Promise<Array>} An array of merged items without duplicates.  The merge prioritizes items with more recent `updatedAt` timestamps.  If items have the same name, the local item is prioritized if it's newer.  If both items have the same name and timestamp, the Firestore item is kept.  Duplicate items are logged to the console.
     */
    async mergeChanges(localItems, firestoreItems, uniqueField) {
      const mergedItems = new Map();
      const usedIds = new Set();
      const duplicateItems = [];

      // Helper function to determine which item is newer based on updatedAt timestamp
      function isLocalItemNewer(localItem, existingItem) {
        const localDate = new Date(localItem.updatedAt || 0)
        const existingDate = new Date(existingItem.updatedAt || 0)
        return localDate > existingDate
      }

      // Determine if a compound key (e.g., categoryId-name) should be used
      const useCompoundKey = uniqueField === 'name' && localItems[0]?.categoryId !== undefined

      // Function to generate the key based on whether a compound key is needed
      const getItemKey = (item) => useCompoundKey
        ? `${item.categoryId}-${item.name}`
        : item[uniqueField]

      // Function to generate a new ID if needed
      const generateNewId = () => `new-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`

      // Detect duplicate local items
      const localItemKeys = new Set()
      for (const localItem of localItems) {
        const key = getItemKey(localItem)
        if (localItemKeys.has(key)) duplicateItems.push(localItem)
        else localItemKeys.add(key)
      }

      // Detect duplicate firestore items
      const firestoreItemKeys = new Set()
      for (const firestoreItem of firestoreItems) {
        const key = getItemKey(firestoreItem)
        if (firestoreItemKeys.has(key))duplicateItems.push(firestoreItem)
        else firestoreItemKeys.add(key)
      }

      // Add Firestore items to the merged map, marking IDs as used
      for (const firestoreItem of firestoreItems) {
        const key = getItemKey(firestoreItem)
        if (!key) console.warn('Firestore item missing unique field:', firestoreItem)
        else {
          mergedItems.set(key, firestoreItem)
          usedIds.add(firestoreItem.id)
        }
      }

      // firestoreItems.forEach(item => {
      //   const key = useCompoundKey ? `${item.categoryId}-${item.name}` : item[uniqueField]
      //   if (key) merged.set(key, item);
      //   else console.warn('Firestore item missing unique field:', item)
      // });

      for(const localItem of localItems) {
        const key = getItemKey(localItem)
        if (!key) {
          console.warn('Local item missing unique field:', localItem)
          continue
        }

        if (duplicateItems.includes(localItem)) continue

        const existingItem = mergedItems.get(key)

        if (!existingItem || isLocalItemNewer(localItem, existingItem)) {
          if (existingItem && existingItem.name === localItem.name) {
            duplicateItems.push(localItem)
            continue
          }

          let itemToMerge = { ...localItem }

          if (existingItem && existingItem.id)
            itemToMerge.id = existingItem.id
          else if (localItem.id && usedIds.has(localItem.id)) {
            itemToMerge.id = generateNewId(localItem)
            itemToMerge.localId = localItem.id
          }

          mergedItems.set(key, itemToMerge)

          // if(localItem.id && usedIds.has(localItem.id)){
          //   itemToMerge.id = generateNewId(localItem)
          //   itemToMerge.localId = localItem.id
          //   console.log('itemToMerge:', itemToMerge)
          // }
          // if(existingItem.name === localItem.name){
          //   console.warn('Duplicate item detected:', localItem)
          //   mergedItems.delete(key)
          // }
          // console.log('mergedItems:', mergedItems)
          // console.log('usedIds:', usedIds)
          // console.log('itemToMerge:', itemToMerge)
          // usedIds.add(itemToMerge.id)
        } else if (existingItem.name === localItem.name){
          duplicateItems.push(localItem)
        }
      }

      return Array.from(mergedItems.values())

      // localItems.forEach(localItem => {
      //   const key = useCompoundKey ? `${localItem.categoryId}-${localItem.name}` : localItem[uniqueField];
      //   if (!key) return console.warn('Local item missing unique field:', localItem);

      //   const existingItem = merged.get(key);
      //   if (!existingItem) {
      //     if (!localItem.id || !seenIds.has(localItem.id)) merged.set(key, localItem);
      //     return;
      //   }

      //   const localDate = new Date(localItem.updatedAt || 0);
      //   const existingDate = new Date(existingItem.updatedAt || 0);

      //   if (localDate > existingDate) {
      //     merged.set(key, { ...localItem, id: existingItem.id });
      //   }
      // })

      // const result = Array.from(merged.values())
      // const uniqueCheck = new Set()
      // return result.filter(item => {
      //   const key = useCompoundKey ? `${item.categoryId}-${item.name}` : item[uniqueField];
      //   if (!key || uniqueCheck.has(key)) {
      //     console.warn('Duplicate or invalid item filtered out:', item)
      //     return false
      //   }
      //   uniqueCheck.add(key)
      //   return true
      // })
    }

  }
})
