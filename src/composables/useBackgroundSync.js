// import { onMounted, onUnmounted } from 'vue'
// import { queueOperation, processQueue, registerBackgroundSync, initBackgroundSync } from '../services/syncService'
// import { useInventoryStore } from '../stores/inventoryStore' // Import the store

// export function useBackgroundSync() {
//   const inventoryStore = useInventoryStore() // Initialize the store

//   // Handle sync messages from service worker
//   const handleSyncMessage = (event) => {
//     if (event.data && event.data.type === 'SYNC_REQUIRED') {
//       processQueue()
//     }
//   }

//   onMounted(() => {
//     // Initialize background sync
//     initBackgroundSync()

//     // Listen for sync messages from service worker
//     navigator.serviceWorker?.addEventListener('message', handleSyncMessage)
//   })

//   onUnmounted(() => {
//     // Clean up event listener
//     navigator.serviceWorker?.removeEventListener('message', handleSyncMessage)
//   })

//   const saveWithSync = async (operation) => {
//     try {
//       const dexieResult = await inventoryStore.saveToDexie(operation) // Assuming this function exists in the store

//       const firebaseOperation = { ...operation, dexieId: dexieResult.id } // Add Dexie ID for tracking
//       await queueOperation(firebaseOperation)
//       await registerBackgroundSync()

//       return { ...dexieResult, queued: true, message: 'Operation queued for background sync' }
//     } catch (error) {
//       console.error("Error saving data:", error)
//       return { queued: false, error: error.message }
//     }
//   }

//   return { saveWithSync }
// }
