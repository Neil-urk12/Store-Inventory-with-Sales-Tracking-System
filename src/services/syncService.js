/**
 * @fileoverview Service for handling offline data synchronization with Firebase
 * @module syncService
 * @description Provides functionality for queuing and processing operations when offline,
 * and syncing them with Firebase when the connection is restored.
 */

import { useNetworkStatus } from './networkStatus'
import { useCentralizedSyncService } from './centralizedSyncService'

const { syncWithFirestore } = useCentralizedSyncService()

/**
 * @function initSync
 * @description Initializes the sync functionality.
 * Sets up event listeners for online/offline status and triggers
 * initial sync if online.
 */
export const initSync = () => {
  const { isOnline } = useNetworkStatus()

  window.addEventListener('online', () => {
    const collections = ['sales', 'inventory', 'categories', 'financial']
    collections.forEach(collection => {
      syncWithFirestore(collection).catch(error => {
        console.error(`Error syncing ${collection}:`, error)
      })
    })
  })

  if (isOnline.value) {
    const collections = ['sales', 'inventory', 'categories', 'financial']
    collections.forEach(collection => {
      syncWithFirestore(collection).catch(error => {
        console.error(`Error syncing ${collection}:`, error)
      })
    })
  }
}
