/**
 * @fileoverview This file contains functions for syncing data with firebase.
*/

import { useNetworkStatus } from './networkStatus'
import Dexie from 'dexie'

/**
 * Create a new Dexie database instance for offline sync.
 */
const db = new Dexie('offlineSync')
db.version(1).stores({
  pendingRequests: '++id,type,timestamp'
})

/**
 * Queue a new operation to be processed later.
 * @async
 * @param {Object} operation - The operation to be queued.
 * @description This function adds a new operation to the pendingRequests table.
*/
export const queueOperation = async (operation) => {
  await db.pendingRequests.add({
    ...operation,
    timestamp: new Date().toISOString()
  })
}

/**
 * @async
 * @description Process all queued operations.
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
 * @description Register the service worker for background sync
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
 * @description Initialize background sync when online.
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
