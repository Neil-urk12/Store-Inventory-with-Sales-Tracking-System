<template>
  <div class="q-pa-md">
    <InventoryHeaderActions></InventoryHeaderActions>
    <div v-if="loading" class="row justify-center q-pa-md">
      <q-spinner-dots color="primary" size="40px" />
    </div>
    <q-banner
      v-if="inventoryStore.error"
      class="bg-negative text-white q-mb-md"
    >
      {{ inventoryStore.error }}
      <template v-slot:action>
        <q-btn flat color="white" label="Retry" @click="loadInventory" />
      </template>
    </q-banner>
    <Suspense>
      <template #default>
        <InventoryGridView v-if="inventoryStore.viewMode === 'grid'" />
        <InventoryListView v-else />
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

<script setup>
import { computed, onMounted } from "vue"
import { useInventoryStore } from "src/stores/inventoryStore"
import { defineAsyncComponent } from "vue"
const InventoryHeaderActions = defineAsyncComponent(() => import('src/components/InventoryHeaderActions.vue'))
const DeleteDialog = defineAsyncComponent(() => import('src/components/DeleteDialog.vue'))
const ItemDialog = defineAsyncComponent(() => import('src/components/ItemDialog.vue'))
const InventoryGridView = defineAsyncComponent(() => import('src/components/InventoryGridView.vue'))
const InventoryListView = defineAsyncComponent(() => import('src/components/InventoryListView.vue'))
const inventoryStore = useInventoryStore();
const loading = computed(() => inventoryStore.loading)
const loadInventory = () => inventoryStore.loadInventory()

onMounted(async () => {
  await inventoryStore.initializeDb()
  await inventoryStore.loadInventory()
})
</script>

<style lang="scss" scoped>
.inventory-card {
  height: 100%;
  transition: all 0.3s ease;
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  }
}
.inventory-table {
  .q-table__card {
    border-radius: 8px;
  }
}
@media (max-width: 599px) {
  .inventory-card {
    margin-bottom: 1rem;
  }
  .q-table {
    &__container {
      overflow-x: auto;
    }
  }
}
</style>
