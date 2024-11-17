import { ref } from 'vue'

const isOnline = ref(navigator.onLine)

// Network status handlers
window.addEventListener('online', () => {
  isOnline.value = true
})

window.addEventListener('offline', () => {
  isOnline.value = false
})

export const useNetworkStatus = () => {
  return {
    isOnline
  }
}
