import { onMounted, onUnmounted } from 'vue'
import { queueOperation, processQueue, registerBackgroundSync, initBackgroundSync } from '../services/syncService'

export function useBackgroundSync() {
  // Handle sync messages from service worker
  const handleSyncMessage = (event) => {
    if (event.data && event.data.type === 'SYNC_REQUIRED') {
      processQueue()
    }
  }

  onMounted(() => {
    // Initialize background sync
    initBackgroundSync()
    
    // Listen for sync messages from service worker
    navigator.serviceWorker?.addEventListener('message', handleSyncMessage)
  })

  onUnmounted(() => {
    // Clean up event listener
    navigator.serviceWorker?.removeEventListener('message', handleSyncMessage)
  })

  // Function to save data with offline support
  const saveWithSync = async (operation) => {
    try {
      // Try to perform the operation directly
      const response = await fetch(operation.url, {
        method: operation.type === 'create' ? 'POST' : 
               operation.type === 'update' ? 'PUT' : 'DELETE',
        headers: operation.headers,
        body: JSON.stringify(operation.data)
      })
      
      if (!response.ok) {
        throw new Error('Network response was not ok')
      }
      
      return response.json()
    } catch (error) {
      // If offline or request fails, queue the operation
      await queueOperation(operation)
      // Register for background sync
      await registerBackgroundSync()
      
      return {
        queued: true,
        message: 'Operation queued for background sync'
      }
    }
  }

  return {
    saveWithSync
  }
}
