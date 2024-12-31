/**
 * @fileoverview Header component for inventory management interface.
 * Provides search, filtering, and action buttons for inventory operations.
 * Handles category management through a dialog interface.
 */

 <script setup>
import { useInventoryStore } from 'src/stores/inventoryStore'
import { onMounted, ref, watch } from 'vue'
import { useQuasar, debounce } from 'quasar'

const $q = useQuasar()
const inventoryStore = useInventoryStore()
const newCategoryName = ref('')
const loading = ref(false)

watch(() => inventoryStore.categoryDialog, (newVal) => {
  if (!newVal)
    newCategoryName.value = ''
})

const debouncedSearch = debounce ((itemToSearch) =>
  inventoryStore.handleSearch(itemToSearch), 500)

const handleAddCategory = async () => {
  if (!newCategoryName.value.trim()) {
    $q.notify({
      color: 'negative',
      message: 'Category name is required',
      position: 'top'
    })
    return
  }

  loading.value = true
  try {
    const result = await inventoryStore.addCategory(newCategoryName.value.trim())
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
  } catch (error) {
    $q.notify({
      color: 'negative',
      message: error.message || 'Failed to add category',
      position: 'top'
    })
  } finally {
    loading.value = false
  }
}

const handleDeleteCategory = async (categoryId) => {
  try {
    const result = await inventoryStore.deleteCategory(categoryId)
    if (result) {
      $q.notify({
        color: 'positive',
        message: 'Category deleted successfully',
        position: 'top'
      })
    }
  } catch (error) {
    $q.notify({
      color: 'negative',
      message: error.message || 'Failed to delete category',
      position: 'top'
    })
  }
}

onMounted(async () => {
  if(inventoryStore.categories.length === 0)
    await inventoryStore.loadCategories()
})
</script>

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
        @update:model-value="debouncedSearch">
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
          >
            <template v-slot:option="{ opt, selected, toggleOption }">
              <q-item clickable @click="toggleOption(opt)">
                <q-item-section>
                  <q-item-label>{{ opt.label }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn
                    flat
                    round
                    dense
                    icon="delete"
                    color="negative"
                    @click.stop="handleDeleteCategory(opt.value)"
                    v-if="opt.value"
                  >
                    <q-tooltip>Delete Category</q-tooltip>
                  </q-btn>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
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
        <q-btn flat label="Cancel" color="primary" v-close-popup :disable="loading" />
        <q-btn 
          flat 
          label="Add" 
          color="primary" 
          @click="handleAddCategory" 
          :loading="loading"
          :disable="!newCategoryName"
        >
          <template v-slot:loading>
            <q-spinner-dots />
          </template>
        </q-btn>
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.q-btn-group {
  box-shadow: none;
}
</style>
