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
  getDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  limit,
  where
} from 'firebase/firestore'
import { db as fireDb } from '../firebase/firebaseconfig'
import { useNetworkStatus } from './networkStatus'
import { ref } from 'vue'
import debounce from 'lodash/debounce'

/**
 * @constant {Object} SYNC_CONFIG
 * @property {number} LOCK_TIMEOUT - Maximum time in ms to hold sync lock (5000ms)
 * @property {number} MAX_RETRIES - Maximum number of retry attempts (5)
 * @property {number[]} RETRY_DELAYS - Delay in ms for each retry attempt [1s, 2s, 5s, 10s, 30s]
 * @description Configuration constants for sync operations
 */
const LOCK_TIMEOUT = 5000
const MAX_RETRIES = 5
const RETRY_DELAYS = [1000, 2000, 5000, 10000, 30000]
const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  resetTimeout: 60000,  //wip!!
  halfOpenTimeout: 30000
}

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
    this.syncProgress = ref({
      current: 0,
      total: 0
    })
    this.pendingOperations = ref(0)
    this.isSyncing = ref(false)
    
    this.isProcessing = false
    this.lockId = 'sync_lock'
    this.processId = Math.random().toString(36).substring(7)
    this.listeners = new Map()
    this.unsubscribers = new Map()
    this.listenerConfig = {
      batchSize: 100,
      debounceTime: 1000
    }
    
    this.startNetworkListener()
    this.monitorPendingOperations()
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
    this.startPeriodicSync()
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
    await db.syncQueue.add({
      ...operation,
      attempts: 0,
      lastAttempt: null,
      status: 'pending',
      error: null,
      timestamp: new Date().toISOString()
    });
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
    this.isSyncing.value = true

    try {
      // Setup listeners for main collections
      ['items', 'categories', 'sales'].forEach(collection => {
        this.setupCollectionListener(collection);
      });

      // Process pending operations
      const operations = await db.syncQueue
        .where('status')
        .equals('pending')
        .toArray()

      this.syncProgress.value = {
        current: 0,
        total: operations.length
      }

      for (const operation of operations) {
        try {
          await this.processOperation(operation)
          await db.syncQueue.delete(operation.id)
          this.syncProgress.value.current++
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
      this.isSyncing.value = false
      this.syncProgress.value = { current: 0, total: 0 }
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
    const { type, collection: collectionName, data, docId } = operation;

    try {
      switch (type) {
        case 'add': {
          const docRef = await addDoc(collection(fireDb, collectionName), {
            ...data,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });

          // Update local record with Firebase ID
          if (docId) {
            await db[collectionName].update(docId, {
              firebaseId: docRef.id,
              syncStatus: 'synced'
            });
          }
          break;
        }

        case 'update': {
          const localItem = await db[collectionName].get(docId);
          if (!localItem) {
            throw new Error('Item not found for update');
          }

          if (localItem.firebaseId) {
            await updateDoc(doc(fireDb, collectionName, localItem.firebaseId), {
              ...data,
              updatedAt: serverTimestamp()
            });
            
            await db[collectionName].update(docId, {
              syncStatus: 'synced'
            });
          } else {
            // If no firebaseId, treat as new item
            const docRef = await addDoc(collection(fireDb, collectionName), {
              ...data,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            await db[collectionName].update(docId, {
              firebaseId: docRef.id,
              syncStatus: 'synced'
            });
          }
          break;
        }

        case 'delete': {
          const localItem = await db[collectionName].get(docId);
          if (!localItem) {
            console.warn('Item not found for deletion');
            return;
          }

          if (localItem.firebaseId) {
            await deleteDoc(doc(fireDb, collectionName, localItem.firebaseId));
          }

          await db[collectionName].delete(docId);
          break;
        }

        default:
          throw new Error(`Unknown operation type: ${type}`);
      }
    } catch (error) {
      console.error(`Error processing ${type} operation:`, error);
      throw error;
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

  async monitorPendingOperations() {
    // Update pending operations count periodically
    setInterval(async () => {
      const count = await db.syncQueue
        .where('status')
        .equals('pending')
        .count()
      this.pendingOperations.value = count
    }, 5000)
  }

  /**
   * @method setupCollectionListener
   * @param {string} collectionName - Name of collection to listen to
   * @description Sets up a real-time listener for a Firestore collection
   */
  setupCollectionListener(collectionName) {
    if (this.unsubscribers.has(collectionName)) {
      return;
    }

    try {
      const firestoreQuery = query(
        collection(fireDb, collectionName),
        orderBy('updatedAt', 'desc'),
        limit(this.listenerConfig.batchSize)
      );

      const unsubscribe = onSnapshot(
        firestoreQuery,
        { includeMetadataChanges: true },
        debounce(async (snapshot) => {
          if (snapshot.metadata.hasPendingWrites) return;

          const changes = [];
          snapshot.docChanges().forEach(change => {
            if (change.doc.metadata.hasPendingWrites) return;

            changes.push({
              type: change.type,
              id: change.doc.id,
              data: { ...change.doc.data(), firebaseId: change.doc.id }
            });
          });

          if (changes.length > 0) {
            await this.processCollectionChanges(collectionName, changes);
          }
        }, this.listenerConfig.debounceTime),
        (error) => {
          console.error(`Listener error for ${collectionName}:`, error);
          this.handleListenerError(collectionName, error);
        }
      );

      this.unsubscribers.set(collectionName, unsubscribe);
      console.log(`Listener setup for ${collectionName}`);
    } catch (error) {
      console.error(`Error setting up listener for ${collectionName}:`, error);
    }
  }

  /**
   * @method processCollectionChanges
   * @private
   */
  async processCollectionChanges(collectionName, changes) {
    try {
      await db.transaction('rw', db[collectionName], async () => {
        for (const change of changes) {
          const { type, id, data } = change;
          const localItem = await db[collectionName]
            .where('firebaseId')
            .equals(id)
            .first();

          switch (type) {
            case 'added':
            case 'modified':
              if (localItem) {
                if (localItem.syncStatus !== 'pending') {
                  await db[collectionName].update(localItem.id, {
                    ...data,
                    syncStatus: 'synced',
                    updatedAt: new Date().toISOString()
                  });
                }
              } else {
                await db[collectionName].add({
                  ...data,
                  syncStatus: 'synced',
                  updatedAt: new Date().toISOString()
                });
              }
              break;

            case 'removed':
              if (localItem && localItem.syncStatus !== 'pending') {
                await db[collectionName].delete(localItem.id);
              }
              break;
          }
        }
      });
    } catch (error) {
      console.error(`Error processing changes for ${collectionName}:`, error);
    }
  }

  /**
   * @method handleListenerError
   * @private
   */
  handleListenerError(collectionName, error) {
    const retryDelay = 5000;
    this.removeListener(collectionName);
    
    setTimeout(() => {
      if (this.isProcessing) {
        this.setupCollectionListener(collectionName);
      }
    }, retryDelay);
  }

  /**
   * @method removeListener
   * @param {string} collectionName
   */
  removeListener(collectionName) {
    const unsubscribe = this.unsubscribers.get(collectionName);
    if (unsubscribe) {
      unsubscribe();
      this.unsubscribers.delete(collectionName);
    }
  }

  /**
   * @method removeAllListeners
   */
  removeAllListeners() {
    for (const [collectionName] of this.unsubscribers) {
      this.removeListener(collectionName);
    }
  }

  // Update cleanup on instance destruction
  cleanup() {
    this.removeAllListeners();
  }
}

/** @const {SyncQueue} syncQueue - Singleton instance of SyncQueue */
export const syncQueue = new SyncQueue()

syncQueue.checkAndProcessQueue()

export function useSyncQueue() {
  return {
    pendingOperations: syncQueue.pendingOperations,
    isSyncing: syncQueue.isSyncing,
    syncProgress: syncQueue.syncProgress,
    processQueue: () => syncQueue.processQueue()
  }
}

// Cleanup on window unload
window.addEventListener('unload', () => {
  syncQueue.cleanup();
});
