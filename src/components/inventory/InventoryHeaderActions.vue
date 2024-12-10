<template>
  <div class="row q-col-gutter-md q-mb-md items-center">
    <div class="col-12 col-sm-6">
      <div class="text-h6">Inventory Management</div>
    </div>
  </div>
  <div class="row q-col-gutter-md q-mb-md">
    <div class="col-12 col-sm-6">
      <q-input
        v-model="inventoryStore.searchQuery"
        outlined
        dense
        placeholder="Search inventory...."
        clearable
        @clear="() => { inventoryStore.searchQuery = ''; inventoryStore.handleSearch(); }"
        @update:model-value="inventoryStore.handleSearch">
        <template v-slot:append>
          <q-icon name="search" />
        </template>
      </q-input>
    </div>
    <div class="col-12 col-sm-6">
      <div class="row q-col-gutter-sm">
        <div class="col-6">
          <q-select
            v-model="inventoryStore.categoryFilter"
            :options="inventoryStore.formattedCategories"
            outlined
            dense
            label="Category"
            emit-value
            map-options
            clearable
            @clear="() => inventoryStore.categoryFilter = null"
          />
        </div>
        <div class="col-6">
          <q-btn-group spread>
            <q-btn
            color="primary"
            icon="add"
            dense
            label="Add Item"
            @click="inventoryStore.openItemDialog()"
          />
          <q-btn
            color="primary"
            icon="category"
            dense
            label="Add Categories"
            @click="inventoryStore.openCategoryDialog()"
          />
          </q-btn-group>
        </div>
      </div>
    </div>
  </div>
  <q-dialog v-model="inventoryStore.categoryDialog">
    <q-card style="min-width: 350px">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">Add Category</div>
        <q-space/>
        <q-btn icon="close" flat round dense v-close-popup aria-label="Close dialog" />
      </q-card-section>

      <q-card-section>
        <q-input
          v-model="newCategoryName"
          label="Category Name"
          :rules="[val => !!val || 'Category name is required']"
          @keyup.enter="handleAddCategory"
        />
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" v-close-popup />
        <q-btn flat label="Add" color="primary" @click="handleAddCategory" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { useInventoryStore } from 'src/stores/inventoryStore'
import { onMounted, ref, watch } from 'vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const inventoryStore = useInventoryStore()
const newCategoryName = ref('')

// Reset category input when dialog closes
watch(() => inventoryStore.categoryDialog, (newVal) => {
  if (!newVal) {
    newCategoryName.value = ''
  }
})

const handleAddCategory = async () => {
  if (!newCategoryName.value) {
    $q.notify({
      color: 'negative',
      message: 'Category name is required',
      position: 'top'
    })
    return
  }

  const result = await inventoryStore.addCategory(newCategoryName.value)

  if (result) {
    $q.notify({
      color: 'positive',
      message: 'Category added successfully',
      position: 'top'
    })
    newCategoryName.value = ''
    inventoryStore.closeCategoryDialog()
  } else {
    $q.notify({
      color: 'negative',
      message: inventoryStore.error || 'Failed to add category',
      position: 'top'
    })
  }
}

onMounted(async () => {
  await inventoryStore.loadCategories()
})
</script>

<style scoped>
.q-btn-group {
  box-shadow: none;
}
</style>
