<script setup>
import { useInventoryStore } from 'src/stores/inventoryStore'
import { useQuasar } from 'quasar'
import { computed } from 'vue'

const inventoryStore = useInventoryStore()
const $q = useQuasar()
const editedItem = computed(() => inventoryStore.editedItem)
const categories = computed(() => inventoryStore.categories)
const loading = computed(() => inventoryStore.loading)
const editMode = computed(() => inventoryStore.editMode)

const saveItem = async () => {
  try {
   await inventoryStore.saveItem()
    $q.notify({
      color: 'positive',
      message: `Item ${inventoryStore.editMode ? 'updated' : 'added'} successfully`
    })
  } catch (err) {
    $q.notify({
      color: 'negative',
      message: `Failed to ${inventoryStore.editMode ? 'update' : 'add'} item`
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <q-dialog v-model="inventoryStore.itemDialog" persistent>
    <q-card style="min-width: 350px">
      <q-card-section>
        <div class="text-h6">{{ editMode ? 'Edit Item' : 'Add New Item' }}</div>
      </q-card-section>

      <q-card-section>
        <q-form @submit="saveItem" class="q-gutter-md">
          <q-input
            v-model="editedItem.name"
            label="Name"
            :rules="[val => !!val || 'Name is required']"
            dense
            outlined
          />

          <q-input
            v-model="editedItem.sku"
            label="SKU"
            :rules="[val => !!val || 'SKU is required']"
            dense
            outlined
          />

          <q-select
            v-model="editedItem.category"
            :options="categories"
            label="Category"
            :rules="[val => !!val || 'Category is required']"
            dense
            outlined
            emit-value
            map-options
          />

          <q-input
            v-model.number="editedItem.quantity"
            label="Quantity"
            type="number"
            :rules="[
              val => val >= 0 || 'Quantity cannot be negative',
              val => !!val || 'Quantity is required'
            ]"
            dense
            outlined
          />
          <q-input
            v-model.number="editedItem.price"
            label="Price"
            type="number"
            :rules="[
              val => val >= 0 || 'Price cannot be negative',
              val => !!val || 'Price is required'
            ]"
            dense
            outlined
            prefix="$"
          />
          <q-input
            v-model="editedItem.image"
            label="Image URL"
            dense
            outlined
          />
        </q-form>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" v-close-popup />
        <q-btn flat label="Save" color="primary" @click="saveItem" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
