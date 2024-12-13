<template>
  <router-view />
</template>

<script setup>
import { syncQueue } from 'src/services/syncQueue'
import { onMounted } from 'vue'

defineOptions({
  name: 'App'
});

onMounted(() => {
  syncQueue.checkAndProcessQueue()
})
</script>
