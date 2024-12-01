import { defineStore } from 'pinia'
import { db } from '../db/dexiedb'
import { useNetworkStatus } from '../services/networkStatus'
import { formatDate } from '../utils/dateUtils'

const { isOnline } = useNetworkStatus()

export const useSalesStore = defineStore('sales', {
  
})
