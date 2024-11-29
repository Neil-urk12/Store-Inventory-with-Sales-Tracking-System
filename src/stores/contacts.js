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
  orderBy,
  writeBatch,
  doc,
  serverTimestamp
} from 'firebase/firestore'
import { db as fireDb } from '../firebase/firebaseconfig'
import { useNetworkStatus } from '../services/networkStatus'
import { syncQueue } from '../services/syncQueue'

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
    contactBeingEdited: {},
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
      const contactCategory = state.contactCategories.find(c => c.id === contactCategoryId)
      return contactCategory ? contactCategory.contacts : []
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
     * @async
     * @method initializeDb
     * @returns {Promise<void>}
     * @description Initializes the contacts database and performs initial sync if needed
     */
    async initializeDb() {
      try {
        const existingContactCategories = await db.getAllContactCategories()
        if (existingContactCategories.length === 0) {
          const { isOnline } = useNetworkStatus()
          if (isOnline.value) {
            await this.syncWithFirestore()
            await syncQueue.processQueue()
          }
        }
        await this.loadContactCategories()
      } catch (error) {
        console.error('Error initializing database:', error)
        this.error = error.message
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
        console.error('Error loading contact categories:', error)
        this.error = error.message
      } finally {
        this.loading = false
      }
    },

    /**
     * @async
     * @method addContact
     * @param {Object} contact - Contact to add
     * @returns {Promise<string>} ID of added contact
     * @throws {Error} If adding contact fails
     */
    async addContact(contact) {
      try {
        const id = await db.addContact(contact)
        const { isOnline } = useNetworkStatus()

        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'add',
            collection: 'contactsList',
            data: { ...contact, id: id.toString() },
            timestamp: new Date()
          })
          await syncQueue.processQueue()
        }

        await this.loadContactCategories()
        return id
      } catch (error) {
        console.error('Error adding contact:', error)
        this.error = error.message
        throw error
      }
    },

    /**
     * @async
     * @method addContactCategory
     * @param {Object} contactCategory - Category to add
     * @returns {Promise<string>} ID of added category
     * @throws {Error} If adding category fails
     */
    async addContactCategory(contactCategory) {
      try {
        const id = await db.addContactCategory(contactCategory)
        const { isOnline } = useNetworkStatus()

        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'add',
            collection: 'contactCategories',
            data: { ...contactCategory, localId: id },
            timestamp: new Date()
          })
          await syncQueue.processQueue()
        }

        await this.loadContactCategories()
        return id
      } catch (error) {
        console.error('Error adding contact category:', error)
        this.error = error.message
        throw error
      }
    },

    /**
     * @async
     * @method updateContactCategory
     * @param {string} id - Category ID to update
     * @param {Object} changes - Changes to apply to the category
     * @returns {Promise<void>}
     * @throws {Error} If updating category fails
     */
    async updateContactCategory(id, changes) {
      try {
        await db.updateContactCategory(id, changes)
        const { isOnline } = useNetworkStatus()

        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'update',
            collection: 'contactCategories',
            docId: id,
            data: changes,
            timestamp: new Date()
          })
          await syncQueue.processQueue()
        }

        await this.loadContactCategories()
      } catch (error) {
        console.error('Error updating contact category:', error)
        this.error = error.message
        throw error
      }
    },

    /**
     * @async
     * @method deleteContactCategory
     * @param {string} id - Category ID to delete
     * @returns {Promise<void>}
     * @throws {Error} If deleting category fails
     */
    async deleteContactCategory(id) {
      try {
        await db.deleteContactCategory(id)
        const { isOnline } = useNetworkStatus()

        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'delete',
            collection: 'contactCategories',
            docId: id.toString(),
            timestamp: new Date()
          })
          await syncQueue.processQueue()
        }

        await this.loadContactCategories()
      } catch (error) {
        console.error('Error deleting contact category:', error)
        this.error = error.message
        throw error
      }
    },

    /**
     * @async
     * @method updateContact
     * @param {string} id - Contact ID to update
     * @param {Object} changes - Changes to apply to the contact
     * @returns {Promise<void>}
     * @throws {Error} If updating contact fails
     */
    async updateContact(id, changes) {
      try {
        await db.updateContact(id, changes)
        const { isOnline } = useNetworkStatus()

        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'update',
            collection: 'contactsList',
            docId: id.toString(),
            data: { ...changes, id: id.toString() },
            timestamp: new Date()
          })
          await syncQueue.processQueue()
        }

        await this.loadContactCategories()
      } catch (error) {
        console.error('Error updating contact:', error)
        this.error = error.message
        throw error
      }
    },

    /**
     * @async
     * @method deleteContact
     * @param {string} id - Contact ID to delete
     * @returns {Promise<void>}
     * @throws {Error} If deleting contact fails
     */
    async deleteContact(id) {
      try {
        await db.deleteContact(id)
        const { isOnline } = useNetworkStatus()

        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'delete',
            collection: 'contactsList',
            docId: id.toString(),
            timestamp: new Date()
          })
          await syncQueue.processQueue()
        }

        await this.loadContactCategories()
      } catch (error) {
        console.error('Error deleting contact:', error)
        this.error = error.message
        throw error
      }
    },

    /**
     * @async
     * @method syncWithFirestore
     * @returns {Promise<void>}
     * @description Synchronizes local contacts data with Firestore
     */
    async syncWithFirestore() {
      if (this.contactsSyncStatus.inProgress) {
        console.log('Sync already in progress, skipping...')
        return
      }

      try {
        this.contactsSyncStatus.inProgress = true
        this.contactsSyncStatus.error = null

        // Get local data
        const localContactCategories = await db.getAllContactCategories()
        const localContacts = await db.getAllContacts()

        // Get Firestore data
        const contactCategoriesSnapshot = await getDocs(query(collection(fireDb, 'contactCategories')))
        const contactsListSnapshot = await getDocs(query(collection(fireDb, 'contactsList')))

        const firestoreContactCategories = contactCategoriesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          updatedAt: doc.data().updatedAt?.toDate()?.toISOString() || new Date().toISOString()
        }))
        const firestoreContactsList = contactsListSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          updatedAt: doc.data().updatedAt?.toDate()?.toISOString() || new Date().toISOString()
        }))

        if (firestoreContactCategories.length > 0 || firestoreContactsList.length > 0) {
          // Merge changes
          const mergedContactCategories = await this.mergeChanges(localContactCategories, firestoreContactCategories, 'name')
          const mergedContacts = await this.mergeChanges(localContacts, firestoreContactsList, 'email')

          // Update Firestore in batches
          const batchSize = 500

          // Update contact categories
          if (mergedContactCategories.length > 0) {
            const contactCategoriesRef = collection(fireDb, 'contactCategories')
            for (let i = 0; i < mergedContactCategories.length; i += batchSize) {
              const batch = writeBatch(fireDb)
              const currentBatch = mergedContactCategories.slice(i, Math.min(i + batchSize, mergedContactCategories.length))

              for (const category of currentBatch) {
                const { id, ...categoryData } = category
                if (id) {
                  batch.update(doc(contactCategoriesRef, id), {
                    ...categoryData,
                    updatedAt: serverTimestamp()
                  })
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
                // Continue with next batch
              }
            }
          }

          // Update contacts
          if (mergedContacts.length > 0) {
            const contactsRef = collection(fireDb, 'contactsList')
            for (let i = 0; i < mergedContacts.length; i += batchSize) {
              const batch = writeBatch(fireDb)
              const currentBatch = mergedContacts.slice(i, Math.min(i + batchSize, mergedContacts.length))

              for (const contact of currentBatch) {
                const { id, ...contactData } = contact
                if (id) {
                  batch.update(doc(contactsRef, id), {
                    ...contactData,
                    updatedAt: serverTimestamp()
                  })
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
                // Continue with next batch
              }
            }
          }

          // Update local database
          if (mergedContactCategories.length > 0) {
            await db.syncWithFirestoreSimple(mergedContactCategories, 'contactCategories')
          }
          if (mergedContacts.length > 0) {
            await db.syncWithFirestoreSimple(mergedContacts, 'contactsList')
          }
        } else {
          // Firestore is empty, push local data
          const contactCategoriesRef = collection(fireDb, 'contactCategories')
          const contactsRef = collection(fireDb, 'contactsList')

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

        // Reload data
        await this.loadContactCategories()

        this.contactsSyncStatus.lastSync = new Date().toISOString()
        this.contactsSyncStatus.pendingChanges = 0
      } catch (error) {
        console.error('Error in sync process:', error)
        this.contactsSyncStatus.error = error.message
        // Don't throw, let the app continue
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
     * @returns {Promise<Array>} Merged items
     */
    async mergeChanges(localItems, firestoreItems, uniqueField) {
      const merged = new Map()

      // Create maps for faster lookups
      const firestoreMap = new Map(
        firestoreItems.map(item => [item[uniqueField], item])
      )

      // Process local items first
      for (const localItem of localItems) {
        try {
          const firestoreItem = firestoreMap.get(localItem[uniqueField])

          if (firestoreItem) {
            // Item exists in both - compare timestamps
            const localDate = new Date(localItem.updatedAt)
            const firestoreDate = new Date(firestoreItem.updatedAt)

            merged.set(localItem[uniqueField],
              localDate > firestoreDate
                ? { ...localItem, id: firestoreItem.id }
                : firestoreItem
            )
          } else {
            // Only in local - add as new
            merged.set(localItem[uniqueField], localItem)
          }
        } catch (error) {
          console.error('Error merging item:', error)
          // Skip problematic item but continue merging
          continue
        }
      }

      // Add Firestore-only items
      for (const firestoreItem of firestoreItems) {
        if (!merged.has(firestoreItem[uniqueField])) {
          merged.set(firestoreItem[uniqueField], firestoreItem)
        }
      }

      return Array.from(merged.values())
    }
  }
})
