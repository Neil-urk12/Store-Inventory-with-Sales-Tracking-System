/**
 * @module networkStatus
 * @description A Vue composable for tracking the application's network connectivity status
 */

import { ref } from 'vue'

/**
 * @type {import('vue').Ref<boolean>}
 * @description Reactive reference tracking the current online/offline status
 * @default navigator.onLine
 */
const isOnline = ref(navigator.onLine)

// Network status handlers
window.addEventListener('online', () => {
  isOnline.value = true
})

window.addEventListener('offline', () => {
  isOnline.value = false
})

/**
 * @function useNetworkStatus
 * @description A composable that provides reactive network connectivity status
 * @returns {{isOnline: import('vue').Ref<boolean>}} An object containing the reactive online status
 * @example
 * // In a Vue component
 * import { useNetworkStatus } from '@/services/networkStatus'
 * 
 * const { isOnline } = useNetworkStatus()
 * // Use isOnline.value to check network status
 */
export const useNetworkStatus = () => {
  return {
    isOnline
  }
}
