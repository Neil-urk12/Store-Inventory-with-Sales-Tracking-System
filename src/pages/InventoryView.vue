<script setup>
import { onMounted, onUnmounted, onBeforeUnmount } from "vue"
import { useInventoryStore } from "src/stores/inventoryStore"
import { defineAsyncComponent } from "vue"
const InventoryHeaderActions = defineAsyncComponent(() => import('src/components/inventory/InventoryHeaderActions.vue'))
const DeleteDialog = defineAsyncComponent(() => import('src/components/inventory/DeleteDialog.vue'))
const ItemDialog = defineAsyncComponent(() => import('src/components/inventory/ItemDialog.vue'))
const InventoryListView = defineAsyncComponent(() => import('src/components/inventory/InventoryListView.vue'))
const inventoryStore = useInventoryStore()

onMounted(async () => {
  await inventoryStore.cleanupDuplicates()
  await inventoryStore.initializeDb()
})

onUnmounted(() => {
  inventoryStore.cleanup(true)
})
</script>

<template>
  <div class="q-pa-md">
    <InventoryHeaderActions></InventoryHeaderActions>
    <div v-if="inventoryStore.loading" class="row justify-center q-pa-md">
      <q-spinner-dots color="primary" size="40px" />
    </div>
    <q-banner
      v-if="inventoryStore.error"
      class="bg-negative text-white q-mb-md"
    >
      {{ inventoryStore.error }}
      <template v-slot:action>
        <q-btn flat color="white" label="Retry" @click="inventoryStore.loadInventory" />
      </template>
    </q-banner>
    <Suspense>
      <template #default>
        <InventoryListView />
      </template>
      <template #fallback>
        <div class="row justify-center q-pa-md">
          <q-spinner-dots color="primary" size="40px" />
        </div>
      </template>
    </Suspense>
    <ItemDialog></ItemDialog>
    <DeleteDialog></DeleteDialog>
  </div>
</template>

<style lang="scss" scoped>
.inventory-card {
  height: 100%;
  transition: all 0.3s ease;
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  }
}
@media (max-width: 599px) {
  .inventory-card {margin-bottom: 1rem}
  .q-table {
    &__container {overflow-x: auto}
  }
}
</style>
