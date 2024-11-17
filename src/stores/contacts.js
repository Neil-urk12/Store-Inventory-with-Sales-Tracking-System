import { defineStore } from 'pinia'
import { db } from '../db/dexiedb'
// Remove after full implementation of database
import { mockCategories } from '../data/mockdata'
import { collection, query, getDocs, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { db as fireDb } from '../firebase/firebaseconfig'
import { useNetworkStatus } from '../services/networkStatus'
import { syncQueue } from '../services/syncQueue'

export const useContactsStore = defineStore('contacts', {
  state: () => ({
    loading: false,
    error: null,
    categories: [],
    contacts: [],
    searchQuery: '',
    categoryFilter: null,
    contactDialog: false,
    editedContact: {},
    editMode: false,
    syncStatus: {
      lastSync: null,
      inProgress: false,
      error: null,
      pendingChanges: 0
    }
  }),

  getters: {
    getContactsByCategory: (state) => (categoryId) => {
      const category = state.categories.find(c => c.id === categoryId)
      return category ? category.contacts : []
    },

    getCategoryById: (state) => (categoryId) => {
      return state.categories.find(c => c.id === categoryId)
    }
  },

  actions: {
    async initializeDb() {
      try {
        const existingCategories = await db.getAllCategories()
        if (existingCategories.length === 0) {
          for (const category of mockCategories) {
            const catId = await db.addCategory({
              name: category.name
            })

            for (const contact of category.contacts) {
              await db.addContact({
                ...contact,
                categoryId: catId
              })
            }
          }
        }
        await this.loadCategories()

        // Initial sync if online
        const { isOnline } = useNetworkStatus()
        if (isOnline.value) {
          await this.syncWithFirestore()
          await syncQueue.processQueue()
        }
      } catch (error) {
        console.error('Error initializing database:', error)
        this.error = error.message
      }
    },

    async loadCategories() {
      this.loading = true
      try {
        const categories = await db.getAllCategories()
        for (const category of categories) {
          category.contacts = await db.getContactsByCategory(category.id)
        }
        this.categories = categories
      } catch (error) {
        console.error('Error loading categories:', error)
        this.error = error.message
      } finally {
        this.loading = false
      }
    },

    async addCategory(category) {
      try {
        const id = await db.addCategory(category)
        const { isOnline } = useNetworkStatus()

        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'add',
            collection: 'categories',
            data: { ...category, localId: id },
            timestamp: new Date()
          })
          await syncQueue.processQueue()
        }

        await this.loadCategories()
        return id
      } catch (error) {
        console.error('Error adding category:', error)
        this.error = error.message
        throw error
      }
    },

    async updateCategory(id, changes) {
      try {
        await db.updateCategory(id, changes)
        const { isOnline } = useNetworkStatus()

        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'update',
            collection: 'categories',
            docId: id,
            data: changes,
            timestamp: new Date()
          })
          await syncQueue.processQueue()
        }

        await this.loadCategories()
      } catch (error) {
        console.error('Error updating category:', error)
        this.error = error.message
        throw error
      }
    },

    async deleteCategory(id) {
      try {
        await db.deleteCategory(id)
        const { isOnline } = useNetworkStatus()

        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'delete',
            collection: 'categories',
            docId: id,
            timestamp: new Date()
          })
          await syncQueue.processQueue()
        }

        await this.loadCategories()
      } catch (error) {
        console.error('Error deleting category:', error)
        this.error = error.message
        throw error
      }
    },

    async addContact(contact) {
      try {
        const id = await db.addContact(contact)
        const { isOnline } = useNetworkStatus()

        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'add',
            collection: 'contacts',
            data: { ...contact, localId: id },
            timestamp: new Date()
          })
          await syncQueue.processQueue()
        }

        await this.loadCategories()
        return id
      } catch (error) {
        console.error('Error adding contact:', error)
        this.error = error.message
        throw error
      }
    },

    async updateContact(id, changes) {
      try {
        await db.updateContact(id, changes)
        const { isOnline } = useNetworkStatus()

        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'update',
            collection: 'contacts',
            docId: id,
            data: changes,
            timestamp: new Date()
          })
          await syncQueue.processQueue()
        }

        await this.loadCategories()
      } catch (error) {
        console.error('Error updating contact:', error)
        this.error = error.message
        throw error
      }
    },

    async deleteContact(id) {
      try {
        await db.deleteContact(id)
        const { isOnline } = useNetworkStatus()

        if (isOnline.value) {
          await syncQueue.addToQueue({
            type: 'delete',
            collection: 'contacts',
            docId: id,
            timestamp: new Date()
          })
          await syncQueue.processQueue()
        }

        await this.loadCategories()
      } catch (error) {
        console.error('Error deleting contact:', error)
        this.error = error.message
        throw error
      }
    },

    async syncWithFirestore() {
      if (this.syncStatus.inProgress) {
        console.log('Sync already in progress, skipping...')
        return
      }

      try {
        this.syncStatus.inProgress = true
        this.syncStatus.error = null

        // Get local data
        const localCategories = await db.getAllCategories()
        const localContacts = await db.getAllContacts()

        // Get Firestore data
        const categoriesSnapshot = await getDocs(query(collection(fireDb, 'categories')))
        const contactsSnapshot = await getDocs(query(collection(fireDb, 'contacts')))

        const firestoreCategories = categoriesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          updatedAt: doc.data().updatedAt?.toDate()?.toISOString() || new Date().toISOString()
        }))
        const firestoreContacts = contactsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          updatedAt: doc.data().updatedAt?.toDate()?.toISOString() || new Date().toISOString()
        }))

        if (firestoreCategories.length > 0 || firestoreContacts.length > 0) {
          // Merge changes
          const mergedCategories = await this.mergeChanges(localCategories, firestoreCategories, 'name')
          const mergedContacts = await this.mergeChanges(localContacts, firestoreContacts, 'email')

          // Update Firestore in batches
          const batchSize = 500

          // Update categories
          if (mergedCategories.length > 0) {
            const categoriesRef = collection(fireDb, 'categories')
            for (let i = 0; i < mergedCategories.length; i += batchSize) {
              const batch = writeBatch(fireDb)
              const currentBatch = mergedCategories.slice(i, Math.min(i + batchSize, mergedCategories.length))

              for (const category of currentBatch) {
                const { id, ...categoryData } = category
                if (id) {
                  batch.update(doc(categoriesRef, id), {
                    ...categoryData,
                    updatedAt: serverTimestamp()
                  })
                } else {
                  const newDocRef = doc(categoriesRef)
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
                console.error('Category batch update failed:', error)
                // Continue with next batch
              }
            }
          }

          // Update contacts
          if (mergedContacts.length > 0) {
            const contactsRef = collection(fireDb, 'contacts')
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
          if (mergedCategories.length > 0) {
            await db.syncWithFirestoreSimple(mergedCategories, 'categories')
          }
          if (mergedContacts.length > 0) {
            await db.syncWithFirestoreSimple(mergedContacts, 'contacts')
          }
        } else {
          // Firestore is empty, push local data
          const categoriesRef = collection(fireDb, 'categories')
          const contactsRef = collection(fireDb, 'contacts')

          // Upload categories
          if (localCategories.length > 0) {
            const batch = writeBatch(fireDb)
            let batchCount = 0

            for (const category of localCategories) {
              const { id, ...categoryData } = category
              const newDocRef = doc(categoriesRef)
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
                  console.error('Category batch upload failed:', error)
                }
              }
            }

            if (batchCount > 0) {
              try {
                await batch.commit()
              } catch (error) {
                console.error('Final category batch upload failed:', error)
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
        await this.loadCategories()

        this.syncStatus.lastSync = new Date().toISOString()
        this.syncStatus.pendingChanges = 0
      } catch (error) {
        console.error('Error in sync process:', error)
        this.syncStatus.error = error.message
        // Don't throw, let the app continue
      } finally {
        this.syncStatus.inProgress = false
      }
    },

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
    },

    // Remove after full implementation of database
    async repopulateDatabase() {
      try {
        this.loading = true
        await db.repopulateWithMockData()
        await this.loadCategories()
      } catch (error) {
        console.error('Error repopulating database:', error)
        this.error = error.message
      } finally {
        this.loading = false
      }
    }
  }
})
