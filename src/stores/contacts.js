import { defineStore } from 'pinia'
import { db } from '../db/dexiedb'
// Remove after full implementation of database
import { mockCategories } from '../data/mockdata'
import { collection, query, getDocs, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { db as fireDb } from '../firebase/firebaseconfig'
import { useNetworkStatus } from '../services/networkStatus'
import { syncQueue } from '../services/syncQueue'

export const useContactsStore = defineStore('contacts', {
  state: () => ({
    categories: [],
    loading: false,
    error: null,
    online: false
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
      try {
        // Check Firestore data
        const categoriesSnapshot = await getDocs(query(collection(fireDb, 'categories')))
        const contactsSnapshot = await getDocs(query(collection(fireDb, 'contacts')))
        
        const firestoreCategories = categoriesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        const firestoreContacts = contactsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))

        if (firestoreCategories.length > 0 || firestoreContacts.length > 0) {
          // Firestore has data, sync to local
          if (firestoreCategories.length > 0) {
            await db.syncWithFirestoreSimple(firestoreCategories, 'categories')
          }
          if (firestoreContacts.length > 0) {
            await db.syncWithFirestoreSimple(firestoreContacts, 'contacts')
          }
          await this.loadCategories()
        } else {
          // Firestore is empty, push local data to Firestore
          const localCategories = await db.getAllCategories()
          const localContacts = await db.getAllContacts()

          if (localCategories.length > 0) {
            const categoriesRef = collection(fireDb, 'categories')
            for (const category of localCategories) {
              const { id, ...categoryData } = category
              await addDoc(categoriesRef, {
                ...categoryData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              })
            }
          }

          if (localContacts.length > 0) {
            const contactsRef = collection(fireDb, 'contacts')
            for (const contact of localContacts) {
              const { id, ...contactData } = contact
              await addDoc(contactsRef, {
                ...contactData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
              })
            }
          }
        }
      } catch (error) {
        console.error('Error syncing with Firestore:', error)
        console.error('Continuing with local data')
      }
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
