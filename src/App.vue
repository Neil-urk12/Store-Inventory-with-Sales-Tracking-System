<template>
  <router-view />
</template>

<script setup>
import { syncQueue } from 'src/services/syncQueue'
import { onMounted } from 'vue'
import { DataPruningService } from 'src/services/dataPruning'

defineOptions({
  name: 'App'
});

onMounted(() => {
  syncQueue.checkAndProcessQueue()
  DataPruningService.startAutoPrune()
})
</script>
