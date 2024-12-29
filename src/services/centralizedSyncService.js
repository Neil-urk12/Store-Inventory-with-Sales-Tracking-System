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
  doc,
  updateDoc,
  serverTimestamp
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
    this.unsubscribeItems = null
    this.unsubscribeCategories = null
  }

  async syncData(options) {
    // Implementation will be added here
    console.log('Syncing data with options:', options)
  }

  async syncWithFirestore(collectionName, processItem, validateItem) {
    const { isOnline } = useNetworkStatus()
    if (!isOnline.value || this.syncStatus.value.inProgress) return

    try {
      this.syncStatus.value.inProgress = true

      // Ensure we clean up any existing listeners
      this.cleanupListeners()

      const localItems = await db[collectionName].toArray()
      let firestoreQuery = query(
        collection(fireDb, collectionName),
        orderBy('updatedAt', 'desc'),
        // Limit the query to prevent excessive data transfer
        limit(100)
      )

      this.unsubscribeItems = onSnapshot(
        firestoreQuery,
        { includeMetadataChanges: true },
        debounce(async (snapshot) => {
          if (snapshot.metadata.hasPendingWrites) return

          const localUpdates = []
          const batch = writeBatch(fireDb)
          let batchCount = 0

          for (const change of snapshot.docChanges()) {
            // Skip if this is a local change
            if (change.doc.metadata.hasPendingWrites) continue

            const firestoreItem = { ...change.doc.data(), firebaseId: change.doc.id }

            if (change.type === 'added' || change.type === 'modified') {
              const existingItem = localItems.find(
                item => item.firebaseId === firestoreItem.firebaseId
              )

              if (existingItem) {
                // Only update if Firestore version is newer
                const firestoreDate = firestoreItem.updatedAt?.toDate() || new Date()
                const localDate = new Date(existingItem.updatedAt)

                if (firestoreDate > localDate && existingItem.syncStatus !== 'pending') {
                  localUpdates.push({ id: existingItem.id, data: firestoreItem })
                }
              } else {
                // Check for duplicates before adding
                const duplicateCheck = await db[collectionName]
                  .where('firebaseId')
                  .equals(firestoreItem.firebaseId)
                  .count()

                if (duplicateCheck === 0) {
                  localUpdates.push({ data: firestoreItem })
                }
              }
            } else if (change.type === 'removed') {
              const existingItem = localItems.find(
                item => item.firebaseId === firestoreItem.firebaseId
              )
              if (existingItem) {
                await db[collectionName].delete(existingItem.id)
              }
            }

            batchCount++
            if (batchCount >= 500) {
              await batch.commit()
              batchCount = 0
            }
          }

          if (batchCount > 0) {
            await batch.commit()
          }

          // Process updates in smaller batches
          if (localUpdates.length > 0) {
            await this.processBatchUpdates(localUpdates, collectionName)
            // await this.loadInventory()
          }
        }, 1000),

        (error) => {
          console.error('Firestore sync error:', error)
          this.syncStatus.value.error = error.message
          this.syncStatus.value.inProgress = false
          this.cleanupListeners()
        }
      )
    } catch (error) {
      console.error('Error in syncWithFirestore:', error)
      this.syncStatus.value.error = error.message
    } finally {
      this.syncStatus.value.inProgress = false
    }
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

  // Add a new method to cleanup listeners
  cleanupListeners() {
    if (this.unsubscribeItems) {
      this.unsubscribeItems()
      this.unsubscribeItems = null
    }
    if (this.unsubscribeCategories) {
      this.unsubscribeCategories()
      this.unsubscribeCategories = null
    }
  }
}

/** @const {CentralizedSyncService} centralizedSyncService - Singleton instance of CentralizedSyncService */
export const centralizedSyncService = new CentralizedSyncService()

export function useCentralizedSyncService() {
  return {
    syncProgress: centralizedSyncService.syncProgress,
    isSyncing: centralizedSyncService.isSyncing,
    syncData: (options) => centralizedSyncService.syncData(options)
  }
}
