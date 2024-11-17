<template>
  <q-dialog v-model="inventoryStore.deleteDialog">
    <q-card>
      <q-card-section class="row items-center">
        <q-avatar icon="warning" color="negative" text-color="white" />
        <span class="q-ml-sm">Are you sure you want to delete this item?</span>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" v-close-popup />
        <q-btn flat label="Delete" color="negative" @click="deleteItem" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
<script setup>
import { useInventoryStore } from 'src/stores/inventoryStore'
import { useQuasar } from 'quasar'

const inventoryStore = useInventoryStore()
const $q = useQuasar()

const deleteItem = async () => {
  try {
    await inventoryStore.deleteItem()
    $q.notify({
      color: 'positive',
      message: 'Item deleted successfully'
    })
  } catch (err) {
    $q.notify({
      color: 'negative',
      message: 'Failed to delete item'
    })
  }
}
</script>
