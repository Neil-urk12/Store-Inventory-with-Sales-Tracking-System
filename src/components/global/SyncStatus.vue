<script setup>
import { computed } from 'vue'
import { useNetworkStatus } from 'src/services/networkStatus'
import { useCentralizedSyncService } from 'src/services/centralizedSyncService'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const { isOnline } = useNetworkStatus()
const { isSyncing, syncProgress, syncStatus } = useCentralizedSyncService()

const showStatus = computed(() => !isOnline.value || isSyncing.value || syncStatus.value.pendingChanges > 0)
const statusClass = computed(() => ({
  'bg-warning text-white': !isOnline.value,
  'bg-info text-white': isSyncing.value
}))

const canManualSync = computed(() => 
  isOnline.value && 
  syncStatus.value.pendingChanges > 0 && 
  !isSyncing.value
)

async function triggerManualSync() {
  try {
    const { syncWithFirestore } = useCentralizedSyncService()
    const collections = ['sales', 'inventory', 'categories', 'financial']
    for (const collection of collections) {
      await syncWithFirestore(collection)
    }
    $q.notify({
      type: 'positive',
      message: 'Sync completed successfully'
    })
  } catch (error) {
    console.error('Sync error:', error)
    $q.notify({
      type: 'negative',
      message: 'Sync failed. Please try again.'
    })
  }
}

function checkNetworkQuality() {
  if ('connection' in navigator) {
    const connection = navigator.connection
    return {
      type: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt
    }
  }
  return null
}
</script>

<template>
  <div class="sync-status" v-if="showStatus">
    <q-banner dense :class="statusClass">
      <template v-if="!isOnline">
        <q-icon name="cloud_off" />
        <span class="q-ml-sm">You're offline. Changes will sync when connection is restored.</span>
        <template v-if="syncStatus.pendingChanges > 0">
          <br>
          <small>{{ syncStatus.pendingChanges }} changes pending</small>
        </template>
      </template>
      
      <template v-else-if="isSyncing">
        <q-spinner-dots class="q-mr-sm" />
        <span>Syncing changes...</span>
        <template v-if="syncProgress">
          <br>
          <small>{{ syncProgress.current }}/{{ syncProgress.total }} items</small>
        </template>
      </template>

      <template v-slot:action>
        <q-btn
          v-if="canManualSync"
          flat
          color="white"
          label="Sync Now"
          @click="triggerManualSync"
          :loading="isSyncing"
        />
      </template>
    </q-banner>
  </div>
</template>

<style scoped>
.sync-status {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 2000;
}
</style> 