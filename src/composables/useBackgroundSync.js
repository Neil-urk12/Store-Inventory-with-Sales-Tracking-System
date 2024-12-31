import { onMounted, onUnmounted } from 'vue'
import { useNetworkStatus } from '../services/networkStatus'
import { useInventoryStore } from '../stores/inventoryStore'

export function useBackgroundSync() {
  const inventoryStore = useInventoryStore()
  const { isOnline } = useNetworkStatus()

  const syncData = async () => {
    if (isOnline.value) {
      await inventoryStore.syncWithServer()
    }
  }

  onMounted(() => {
    window.addEventListener('online', syncData)
  })

  onUnmounted(() => {
    window.removeEventListener('online', syncData)
  })

  return {
    syncData
  }
}
