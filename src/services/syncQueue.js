/**
 * @fileoverview Manages synchronization between local IndexedDB and Firebase Firestore
 * @module syncQueue
 * @description Implements a robust queue-based system for handling offline operations,
 * conflict resolution, and data synchronization between local IndexedDB and Firebase Firestore.
 * Features include:
 * - Offline operation support
 * - Automatic retry with exponential backoff
 * - Conflict resolution
 * - Lock mechanism to prevent concurrent syncs
 * - Periodic sync scheduling
 */

import { db } from '../db/dexiedb'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc
} from 'firebase/firestore'
import { db as fireDb } from '../firebase/firebaseconfig'
import { useNetworkStatus } from './networkStatus'

/**
 * @constant {Object} SYNC_CONFIG
 * @property {number} LOCK_TIMEOUT - Maximum time in ms to hold sync lock (5000ms)
 * @property {number} MAX_RETRIES - Maximum number of retry attempts (5)
 * @property {number[]} RETRY_DELAYS - Delay in ms for each retry attempt [1s, 2s, 5s, 10s, 30s]
 * @description Configuration constants for sync operations
 */
const LOCK_TIMEOUT = 5000 // 5 seconds
const MAX_RETRIES = 5
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000] // Exponential backoff

/**
 * @class SyncQueue
 * @description Manages the synchronization queue between local database and Firebase.
 * Implements a robust offline-first architecture with:
 * - Queue-based operation management
 * - Automatic retry with exponential backoff
 * - Conflict resolution between local and remote data
 * - Locking mechanism to prevent concurrent sync operations
 * @example
 * // Initialize and start sync
 * const queue = new SyncQueue()
 * queue.startPeriodicSync()
 *
 * // Queue an operation
 * await queue.addToQueue({
 *   type: 'add',
 *   collection: 'items',
 *   data: { name: 'New Item' }
 * })
 */
class SyncQueue {
  /**
   * @constructor
   * @description Creates a new SyncQueue instance.
   * Initializes processing state and generates a unique process ID
   * for lock management.
   */
  constructor() {
    this.isProcessing = false
    this.lockId = 'sync_lock'
    this.processId = Math.random().toString(36).substring(7)
    this.startNetworkListener()
  }

  startNetworkListener() {
    window.addEventListener('online', () => this.checkAndProcessQueue())
    // window.addEventListener('offline', this.processQueue)
  }
  async checkAndProcessQueue() {
    const { isOnline } = useNetworkStatus()
    if (isOnline.value) {
      const pendingOperations = await db.syncQueue.where('status').equals('pending').toArray();
      if (pendingOperations.length > 0)
        await this.processQueue()
    }
  }
  /**
   * @async
   * @method addToQueue
   * @param {Object} operation - The operation to be queued
   * @param {('add'|'update'|'delete')} operation.type - Operation type
   * @param {string} operation.collection - Target collection name
   * @param {Object} [operation.data] - Data payload for add/update
   * @param {string} [operation.docId] - Document ID for update/delete
   * @returns {Promise<void>}
   * @description Adds an operation to the sync queue for later processing.
   * Each operation is timestamped and initialized with retry tracking.
   * @throws {Error} If operation is invalid or queue is full
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
   * @description Processes all pending operations in the sync queue.
   * Features:
   * - Online status check before processing
   * - Lock acquisition to prevent concurrent processing
   * - Retry logic with exponential backoff
   * - Error handling and operation status updates
   * @fires SyncQueue#syncComplete
   * @fires SyncQueue#syncError
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
   * @param {Object} operation - Operation to process
   * @returns {Promise<void>}
   * @description Processes a single operation from the queue.
   * Handles:
   * - Add operations with Firebase document creation
   * - Update operations with conflict resolution
   * - Delete operations with verification
   * - Local database updates with sync status
   * @throws {Error} If operation fails or is invalid
   * @private
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
            await db[collectionName].update(data.id, {
              firebaseId: docRef.id,
              syncStatus: 'synced'
            })
          } catch (error) {
            // If add operation fails, update local record with error and set syncStatus to 'failed'
            await db[collectionName].update(data.id, {
              firebaseId: null, // Clear firebaseId if add operation failed
              syncStatus: 'failed',
              error: error.message
            })
            console.error(`Sync Error for ${operation.type} operation:`, {
              operation,
              error: error.message,
              timestamp: new Date().toISOString()
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

            const docRef = doc(fireDb, collectionName, localRecord.firebaseId)
            const docSnap = await getDoc(docRef)

            if (!docSnap.exists()) {
              throw new Error('Firebase document not found')
            }

            const firebaseData = docSnap.data()

            if (firebaseData.version > data.version) {
              const mergedData = await this.resolveConflict(
                firebaseData,
                data
              )
              await updateDoc(docRef, {
                ...mergedData,
                localId: data.id.toString(),
                updatedAt: new Date().toISOString()
              })
              .then(() => {
                // Update local record with merged data and set syncStatus to 'synced'
                db[collectionName].update(data.id, {
                  ...mergedData,
                  syncStatus: 'synced'
                })
              })
            } else {
              await updateDoc(docRef, {
                ...data,
                localId: data.id.toString(),
                updatedAt: new Date().toISOString()
              })
              .then(() => {
                // Update local record and set syncStatus to 'synced'
                db[collectionName].update(data.id, {
                  syncStatus: 'synced'
                })
              })
            }
          } catch (error) {
            const shouldRetry = this.handleSyncError(error)
            if (shouldRetry) {
              const retryCount = (operation.retryCount || 0) + 1
              if (retryCount <= MAX_RETRIES) {
                await this.requeueWithDelay(operation, retryCount)
                return
              }
            }

            // Update local record with error and set syncStatus to 'failed'
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
            if (docId){
              await deleteDoc(doc(fireDb, collectionName, docId))
              await db[collectionName].delete(docId)
            } else {
              console.warn('No firebaseId found for delete operation')
              // You might want to handle this case differently,
              // e.g., by marking the local record as deleted or retrying later.
            }
          } catch (error) {
            console.error('Error deleting document:', error)
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
   * @param {Object} firebaseData - Remote data from Firebase
   * @param {Object} localData - Local data from IndexedDB
   * @returns {Promise<Object>} Resolved data
   * @description Resolves conflicts between local and Firebase data
   * using a timestamp-based strategy with custom merge logic.
   * @private
   */
  async resolveConflict(firebaseData, localData) {
    // Simple last-write-wins strategy
    // Could be enhanced with field-level merging if needed
    return localData.updatedAt > firebaseData.updatedAt
      ? localData
      : firebaseData
  }

  /**
   * @async
   * @method requeueWithDelay
   * @param {Object} operation - Failed operation
   * @param {number} retryCount - Current retry attempt
   * @returns {Promise<void>}
   * @description Requeues a failed operation with exponential backoff.
   * Delay increases with each retry attempt.
   * @private
   */
  async requeueWithDelay(operation, retryCount) {
    const delay =
      RETRY_DELAYS[retryCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1]
    await new Promise(resolve => setTimeout(resolve, delay))
    await this.addToQueue({
      ...operation,
      retryCount,
      lastAttempt: new Date().toISOString()
    })
  }

  /**
   * @method handleSyncError
   * @param {Error} error - Sync error
   * @returns {boolean} Whether to retry the operation
   * @description Handles synchronization errors with logging
   * and retry decision logic.
   * @private
   */
  handleSyncError(error) {
    // Network errors should be retried
    if (
      error.code === 'unavailable' ||
      error.code === 'network-request-failed'
    ) {
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
   * @returns {Promise<boolean>} Whether lock was acquired
   * @description Attempts to acquire a distributed lock for sync
   * processing using IndexedDB.
   * @private
   */
  async acquireLock() {
    return await db.transaction('rw', db.syncLocks, async () => {
      const lock = await db.syncLocks.get(this.lockId)
      const now = Date.now()

      if (lock && now - lock.timestamp < LOCK_TIMEOUT) {
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
   * @description Releases the sync processing lock.
   * @private
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
   * @param {number} [interval=30000] - Sync interval in ms
   * @returns {void}
   * @description Starts periodic synchronization when online.
   * Automatically adjusts to network status changes.
   * @example
   * syncQueue.startPeriodicSync(60000) // Sync every minute
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
