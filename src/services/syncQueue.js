/**
 * @fileoverview Manages synchronization between local IndexedDB and Firebase Firestore.
 * Implements a queue-based system for handling offline operations and conflict resolution.
 */

import { db } from '../db/dexiedb'
import { collection, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore'
import { db as fireDb } from '../firebase/firebaseconfig'
import { useNetworkStatus } from './networkStatus'

/** Configuration constants for sync operations */
const LOCK_TIMEOUT = 5000 // 5 seconds
const MAX_RETRIES = 5
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000] // Exponential backoff

/**
 * @class SyncQueue
 * @description Manages the synchronization queue between local database and Firebase.
 * Handles offline operations, retries, and conflict resolution.
 */
class SyncQueue {
  /**
   * @constructor
   * Creates a new SyncQueue instance with a unique process ID.
   */
  constructor() {
    this.isProcessing = false
    this.lockId = 'sync_lock'
    this.processId = Math.random().toString(36).substring(7)
  }

  /**
   * @async
   * @method addToQueue
   * @param {Object} operation - The operation to be queued
   * @param {string} operation.type - Type of operation ('add', 'update', 'delete')
   * @param {string} operation.collection - Target collection name
   * @param {Object} [operation.data] - Data for add/update operations
   * @param {string} [operation.docId] - Document ID for update/delete operations
   * @returns {Promise<void>}
   * @description Adds an operation to the sync queue for later processing
   */
  async addToQueue(operation) {
    // Always add to queue first, process later when online
    await db.syncQueue.add({
      ...operation,
      attempts: 0,
      lastAttempt: null,
      status: 'pending',
      error: null,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * @async
   * @method processQueue
   * @returns {Promise<void>}
   * @description Processes all pending operations in the sync queue when online.
   * Implements retry logic with exponential backoff for failed operations.
   */
  async processQueue() {
    const { isOnline } = useNetworkStatus()
    if (!isOnline.value || this.isProcessing) {
      return
    }

    const hasLock = await this.acquireLock()
    if (!hasLock) return

    this.isProcessing = true

    try {
      const operations = await db.syncQueue
        .where('status')
        .equals('pending')
        .toArray()

      for (const operation of operations) {
        try {
          await this.processOperation(operation)
          // Only remove from queue if successfully processed
          await db.syncQueue.delete(operation.id)
        } catch (error) {
          console.error('Error processing operation:', operation, error)
          const nextAttempt = (operation.attempts || 0) + 1

          if (nextAttempt >= MAX_RETRIES) {
            await db.syncQueue.update(operation.id, {
              status: 'failed',
              error: error.message
            })
          } else {
            await db.syncQueue.update(operation.id, {
              attempts: nextAttempt,
              lastAttempt: new Date().toISOString(),
              error: error.message,
              status: 'pending'
            })
            // Wait before next retry using exponential backoff
            await new Promise(resolve =>
              setTimeout(resolve, RETRY_DELAYS[nextAttempt - 1])
            )
          }
        }
      }
    } catch (error) {
      console.error('Error processing queue:', error)
    } finally {
      this.isProcessing = false
      await this.releaseLock()
    }
  }

  /**
   * @async
   * @method processOperation
   * @param {Object} operation - The operation to process
   * @returns {Promise<void>}
   * @description Processes a single operation from the queue.
   * Handles add, update, and delete operations with Firebase.
   * @throws {Error} If operation processing fails
   */
  async processOperation(operation) {
    const { type, collection: collectionName, data, docId } = operation

    try {
      switch (type) {
        case 'add': {
          try {
            const docRef = await addDoc(collection(fireDb, collectionName), {
              ...data,
              localId: data.id.toString(),
              updatedAt: new Date().toISOString()
            })
            // Update local record with Firebase ID
            await db[collectionName].update(data.id, {
              firebaseId: docRef.id,
              syncStatus: 'synced'
            })
          } catch (error) {
            // If add operation fails, try to update local record with error
            await db[collectionName].update(data.id, {
              syncStatus: 'failed',
              error: error.message
            })
            throw error
          }
          break
        }

        case 'update': {
          try {
            const localRecord = await db[collectionName].get(data.id)
            if (!localRecord?.firebaseId) {
              throw new Error('No Firebase ID found for update operation')
            }

            // Get Firebase document to check if it exists and handle conflicts
            const docRef = doc(fireDb, collectionName, localRecord.firebaseId)
            const docSnap = await getDoc(docRef)

            if (!docSnap.exists()) {
              throw new Error('Firebase document not found')
            }

            const firebaseData = docSnap.data()

            // Handle conflict resolution
            if (firebaseData.version > data.version) {
              // Firebase has newer version, need to merge changes
              const mergedData = await this.resolveConflict(firebaseData, data)
              await updateDoc(docRef, {
                ...mergedData,
                localId: data.id.toString(),
                updatedAt: new Date().toISOString()
              })

              // Update local with merged data
              await db[collectionName].update(data.id, {
                ...mergedData,
                syncStatus: 'synced'
              })
            } else {
              // Our version is newer or same, proceed with update
              await updateDoc(docRef, {
                ...data,
                localId: data.id.toString(),
                updatedAt: new Date().toISOString()
              })

              await db[collectionName].update(data.id, {
                syncStatus: 'synced'
              })
            }
          } catch (error) {
            const shouldRetry = this.handleSyncError(error)
            if (shouldRetry) {
              // Increment retry count and requeue with delay
              const retryCount = (operation.retryCount || 0) + 1
              if (retryCount <= MAX_RETRIES) {
                await this.requeueWithDelay(operation, retryCount)
                return
              }
            }

            // Update local record with error if we're not retrying
            await db[collectionName].update(data.id, {
              syncStatus: 'failed',
              error: error.message
            })
            throw error
          }
          break
        }

        case 'delete': {
          try {
            const localRecord = await db[collectionName].get(docId)
            if (localRecord?.firebaseId) {
              await deleteDoc(doc(fireDb, collectionName, localRecord.firebaseId))
            }
          } catch (error) {
            // If delete operation fails, try to update local record with error
            await db[collectionName].update(docId, {
              syncStatus: 'failed',
              error: error.message
            })
            throw error
          }
          break
        }

        default:
          throw new Error(`Unknown operation type: ${type}`)
      }
    } catch (error) {
      console.error(`Error processing ${type} operation:`, error)
      throw error
    }
  }

  /**
   * @async
   * @method resolveConflict
   * @param {Object} firebaseData - Data from Firebase
   * @param {Object} localData - Data from local database
   * @returns {Object} Resolved data
   * @description Resolves conflicts between local and Firebase data
   * based on timestamps and sync status
   */
  async resolveConflict(firebaseData, localData) {
    // Simple last-write-wins strategy
    // Could be enhanced with field-level merging if needed
    return localData.updatedAt > firebaseData.updatedAt ? localData : firebaseData
  }

  /**
   * @async
   * @method requeueWithDelay
   * @param {Object} operation - Failed operation to requeue
   * @param {number} retryCount - Current retry attempt number
   * @returns {Promise<void>}
   * @description Requeues a failed operation with exponential backoff delay
   */
  async requeueWithDelay(operation, retryCount) {
    const delay = RETRY_DELAYS[retryCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1]
    await new Promise(resolve => setTimeout(resolve, delay))
    await this.addToQueue({
      ...operation,
      retryCount,
      lastAttempt: new Date().toISOString()
    })
  }

  /**
   * @method handleSyncError
   * @param {Error} error - Error that occurred during sync
   * @returns {void}
   * @description Handles and logs synchronization errors
   */
  handleSyncError(error) {
    // Network errors should be retried
    if (error.code === 'unavailable' || error.code === 'network-request-failed') {
      return true
    }
    // Document not found or permission errors should not be retried
    if (error.code === 'not-found' || error.code === 'permission-denied') {
      return false
    }
    // Default to retry for unknown errors
    return true
  }

  /**
   * @async
   * @method acquireLock
   * @returns {Promise<boolean>}
   * @description Attempts to acquire a lock for sync processing
   * to prevent multiple instances from processing simultaneously
   */
  async acquireLock() {
    return await db.transaction('rw', db.syncLocks, async () => {
      const lock = await db.syncLocks.get(this.lockId)
      const now = Date.now()

      if (lock && (now - lock.timestamp < LOCK_TIMEOUT)) {
        return false
      }

      await db.syncLocks.put({
        lockId: this.lockId,
        timestamp: now,
        owner: this.processId
      })
      return true
    })
  }

  /**
   * @async
   * @method releaseLock
   * @returns {Promise<void>}
   * @description Releases the sync processing lock
   */
  async releaseLock() {
    await db.transaction('rw', db.syncLocks, async () => {
      const lock = await db.syncLocks.get(this.lockId)
      if (lock && lock.owner === this.processId) {
        await db.syncLocks.delete(this.lockId)
      }
    })
  }

  /**
   * @method startPeriodicSync
   * @param {number} [interval=30000] - Sync interval in milliseconds
   * @returns {void}
   * @description Starts periodic synchronization when online
   */
  startPeriodicSync(interval = 30000) {
    const { isOnline } = useNetworkStatus()

    setInterval(() => {
      if (isOnline.value) {
        this.processQueue()
      }
    }, interval)
  }
}

/** @const {SyncQueue} syncQueue - Singleton instance of SyncQueue */
export const syncQueue = new SyncQueue()
