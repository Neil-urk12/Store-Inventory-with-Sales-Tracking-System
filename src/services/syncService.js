/**
 * @fileoverview Service for handling offline data synchronization with Firebase
 * @module syncService
 * @description Provides functionality for queuing and processing operations when offline,
 * and syncing them with Firebase when the connection is restored. Uses Dexie for IndexedDB
 * storage and supports background sync via Service Workers.
 */

import { useNetworkStatus } from './networkStatus'
import Dexie from 'dexie'

/**
 * @type {Dexie}
 * @description Dexie database instance for storing offline operations
 * Schema:
 * - pendingRequests: Stores operations to be synced
 *   - id: Auto-incrementing primary key
 *   - type: Operation type (create/update/delete)
 *   - timestamp: When the operation was queued
 */
const db = new Dexie('offlineSync')
db.version(1).stores({
  pendingRequests: '++id,type,timestamp'
})

/**
 * @async
 * @function queueOperation
 * @param {Object} operation - The operation to be queued
 * @param {string} operation.type - Operation type ('create', 'update', or 'delete')
 * @param {string} operation.url - The API endpoint URL
 * @param {Object} operation.headers - Request headers
 * @param {Object} [operation.data] - Request payload (for create/update)
 * @returns {Promise<void>}
 * @description Adds an operation to the pending requests queue for later processing.
 * Each operation is timestamped when added to the queue.
 * @example
 * await queueOperation({
 *   type: 'create',
 *   url: '/api/items',
 *   headers: { 'Content-Type': 'application/json' },
 *   data: { name: 'New Item' }
 * })
 */
export const queueOperation = async (operation) => {
  await db.pendingRequests.add({
    ...operation,
    timestamp: new Date().toISOString()
  })
}

/**
 * @async
 * @function processQueue
 * @returns {Promise<void>}
 * @description Processes all queued operations when online.
 * Operations are processed in order and removed from the queue when successful.
 * Failed operations remain in the queue for retry.
 * @throws {Error} Logs errors for failed operations but doesn't stop processing
 */
export const processQueue = async () => {
  const { isOnline } = useNetworkStatus()
  if (!isOnline.value) return

  const items = await db.pendingRequests.toArray()

  for (const item of items) {
    try {
      // Process the operation based on its type
      switch (item.type) {
        case 'create':
          await fetch(item.url, {
            method: 'POST',
            headers: item.headers,
            body: JSON.stringify(item.data)
          })
          break
        case 'update':
          await fetch(item.url, {
            method: 'PUT',
            headers: item.headers,
            body: JSON.stringify(item.data)
          })
          break
        case 'delete':
          await fetch(item.url, {
            method: 'DELETE',
            headers: item.headers
          })
          break
      }
      // Remove the successfully processed item
      await db.pendingRequests.delete(item.id)
    } catch (error) {
      console.error('Error processing queued operation:', error)
      // Leave failed items in the queue for retry
    }
  }
}

/**
 * @async
 * @function registerBackgroundSync
 * @returns {Promise<void>}
 * @description Registers a background sync task with the Service Worker.
 * This enables automatic sync attempts when the browser regains connectivity,
 * even if the app is not open.
 * @requires ServiceWorker API
 * @requires Background Sync API
 */
export const registerBackgroundSync = async () => {
  if ('serviceWorker' in navigator && 'sync' in window.registration) {
    try {
      await window.registration.sync.register('syncData')
    } catch (error) {
      console.error('Background sync registration failed:', error)
    }
  }
}

/**
 * @function initBackgroundSync
 * @description Initializes the background sync functionality.
 * Sets up event listeners for online/offline status and triggers
 * initial sync if online.
 * @listens window#online
 */
export const initBackgroundSync = () => {
  const { isOnline } = useNetworkStatus()

  // Process queue when coming back online
  window.addEventListener('online', () => {
    processQueue()
  })

  // Initial queue processing if online
  if (isOnline.value) {
    processQueue()
  }
}
