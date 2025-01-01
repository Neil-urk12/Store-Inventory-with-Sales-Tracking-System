/**
 * @fileoverview Centralized service for handling data synchronization.
 * @module centralizedSyncService
 * @description Provides a generic and reusable service for managing data synchronization
 * between local storage and remote APIs.
 */

import { ref } from 'vue'
import {
  collection,
  query,
  orderBy,
  writeBatch,
  onSnapshot,
  limit,
  getDocs,
} from 'firebase/firestore'
import { db as fireDb } from '../firebase/firebaseconfig'
import { useNetworkStatus } from './networkStatus'
import debounce from 'lodash/debounce'
import { db } from '../db/dexiedb'

/**
 * @class CentralizedSyncService
 * @description Manages the synchronization process.
 */
class CentralizedSyncService {
  constructor() {
    this.syncProgress = ref({
      current: 0,
      total: 0
    })
    this.isSyncing = ref(false)
    this.syncStatus = ref({
      lastSync: null,
      inProgress: false,
      error: null,
      pendingChanges: 0,
      totalItems: 0,
      processedItems: 0,
      failedItems: [],
      retryCount: 0,
      maxRetries: 3,
      retryDelay: 1000
    })

    this.unsubscribers = new Map()

    // Add online listener for auto-sync
    window.addEventListener('online', () => {
      this.syncAllCollections()
    })
  }

  async syncAllCollections() {
    const collections = ['sales', 'inventory', 'categories', 'financial']
    for (const collection of collections) {
      try {
        await this.syncWithFirestore(collection)
      } catch (error) {
        console.error(`Error syncing ${collection}:`, error)
      }
    }
  }

  async syncWithFirestore(collectionName, options = {}) {
    const { isOnline } = useNetworkStatus()
    if (!isOnline.value || this.syncStatus.value.inProgress) return

    const {
      processItem,
      validateItem,
      orderByField = 'updatedAt',
      batchSize = 500,
      queryLimit = 100
    } = options

    try {
      this.syncStatus.value.inProgress = true
      this.cleanupListener(collectionName)

      const localItems = await db[collectionName].toArray()
      let firestoreQuery = query(
        collection(fireDb, collectionName),
        orderBy(orderByField, 'desc'),
        limit(queryLimit)
      )

      // Set up real-time listener
      this.unsubscribers.set(
        collectionName,
        onSnapshot(
          firestoreQuery,
          { includeMetadataChanges: true },
          debounce(async (snapshot) => {
            if (snapshot.metadata.hasPendingWrites) return
            await this.handleFirestoreChanges(snapshot, collectionName, {
              localItems,
              processItem,
              validateItem,
              batchSize
            })
          }, 1000),
          (error) => this.handleSyncError(error, collectionName)
        )
      )

      // Initial sync for existing data
      const snapshot = await getDocs(firestoreQuery)
      await this.handleFirestoreChanges(snapshot, collectionName, {
        localItems,
        processItem,
        validateItem,
        batchSize
      })

    } catch (error) {
      this.handleSyncError(error, collectionName)
    } finally {
      this.syncStatus.value.inProgress = false
    }
  }

  async handleFirestoreChanges(snapshot, collectionName, options) {
    const { localItems, processItem, validateItem, batchSize } = options
    const localUpdates = []
    const batch = writeBatch(fireDb)
    let batchCount = 0

    for (const change of snapshot.docChanges?.() || snapshot.docs) {
      const doc = change.doc || change
      if (doc.metadata?.hasPendingWrites) continue

      let processedItem = { ...doc.data(), firebaseId: doc.id }

      if (!processedItem.syncStatus)
        processedItem.syncStatus = 'synced'

      if (validateItem && !validateItem(processedItem)) {
        console.warn(`Invalid item in Firestore: ${doc.id}`)
        continue
      }


      if (processItem)
        processedItem = processItem(processedItem)

      const existingItem = localItems.find(
        item => item.firebaseId === processedItem.firebaseId
      )

      if (existingItem) {
        const firestoreDate = processedItem.updatedAt || new Date()
        const localDate = new Date(existingItem.updatedAt || 0)

        if (firestoreDate > localDate && existingItem.syncStatus !== 'pending')
          localUpdates.push({ id: existingItem.id, data: processedItem })

      } else {
        const duplicateCheck = await db[collectionName]
          .where('firebaseId')
          .equals(processedItem.firebaseId)
          .count()

        if (duplicateCheck === 0)
          localUpdates.push({ data: processedItem })
      }

      batchCount++
      if (batchCount >= batchSize) {
        await batch.commit()
        batchCount = 0
      }
    }

    if (batchCount > 0)
      await batch.commit()

    if (localUpdates.length > 0)
      await this.processBatchUpdates(localUpdates, collectionName)
  }

  async processBatchUpdates(updates, collectionName) {
    const BATCH_SIZE = 50
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE)
      await Promise.all(
        batch.map(async update => {
          if (update.id) {
            await db[collectionName].update(update.id, {
              ...update.data,
              syncStatus: 'synced',
              updatedAt: new Date().toISOString()
            })
          } else {
            await db[collectionName].add({
              ...update.data,
              syncStatus: 'synced',
              updatedAt: new Date().toISOString()
            })
          }
        })
      )
    }
  }

  handleSyncError(error, collectionName) {
    console.error(`Firestore sync error for ${collectionName}:`, error)
    this.syncStatus.value.error = error.message
    this.syncStatus.value.inProgress = false
    this.cleanupListener(collectionName)
  }

  cleanupListener(collectionName) {
    const unsubscribe = this.unsubscribers.get(collectionName)
    if (unsubscribe) {
      unsubscribe()
      this.unsubscribers.delete(collectionName)
    }
  }

  cleanupAllListeners() {
    for (const [collectionName] of this.unsubscribers) {
      this.cleanupListener(collectionName)
    }
  }
}

export const centralizedSyncService = new CentralizedSyncService()

export function useCentralizedSyncService() {
  return {
    syncProgress: centralizedSyncService.syncProgress,
    isSyncing: centralizedSyncService.isSyncing,
    syncStatus: centralizedSyncService.syncStatus,
    syncWithFirestore: (collectionName, options) =>
      centralizedSyncService.syncWithFirestore(collectionName, options),
    cleanupAllListeners: () => centralizedSyncService.cleanupAllListeners()
  }
}
