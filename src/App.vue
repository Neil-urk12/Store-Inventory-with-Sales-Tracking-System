<template>
  <router-view />
</template>

<script setup>
import { onMounted } from 'vue'
import { DataPruningService } from 'src/services/dataPruning'

defineOptions({
  name: 'App'
});

onMounted(() => {
  DataPruningService.startAutoPrune()
})
</script>
