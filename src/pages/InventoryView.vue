<template>
  <div class="q-pa-md">
    <!-- Header Actions -->
    <div class="row q-col-gutter-md q-mb-md items-center">
      <div class="col-12 col-sm-6">
        <div class="text-h6">Inventory Management</div>
      </div>
      <div class="col-12 col-sm-6 text-right">
        <q-btn
          color="primary"
          icon="add"
          label="Add Item"
          @click="inventoryStore.openItemDialog()"
        />
      </div>
    </div>

    <!-- Search and Filter Section -->
    <div class="row q-col-gutter-md q-mb-md">
      <div class="col-12 col-sm-6">
        <q-input
          v-model="inventoryStore.searchQuery"
          outlined
          dense
          placeholder="Search inventory..."
          clearable
          @clear="inventoryStore.handleSearch"
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
              :options="inventoryStore.categories"
              outlined
              dense
              label="Category"
              emit-value
              map-options
              clearable
              @update:model-value="inventoryStore.handleFilters"
            />
          </div>
          <div class="col-6">
            <q-btn-group spread>
              <q-btn
                :color="inventoryStore.viewMode === 'grid' ? 'primary' : 'grey'"
                icon="grid_view"
                @click="inventoryStore.viewMode = 'grid'"
                dense
              />
              <q-btn
                :color="inventoryStore.viewMode === 'list' ? 'primary' : 'grey'"
                icon="list"
                @click="inventoryStore.viewMode = 'list'"
                dense
              />
            </q-btn-group>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="inventoryStore.loading" class="row justify-center q-pa-md">
      <q-spinner-dots color="primary" size="40px" />
    </div>

    <!-- Error State -->
    <q-banner v-if="inventoryStore.error" class="bg-negative text-white q-mb-md">
      {{ inventoryStore.error }}
      <template v-slot:action>
        <q-btn flat color="white" label="Retry" @click="loadInventory" />
      </template>
    </q-banner>

    <!-- Grid View with Sorting Options -->
    <template v-if="inventoryStore.viewMode === 'grid'">
      <div class="row q-col-gutter-sm q-mb-md">
        <div class="col-12 col-sm-4">
          <q-select
            v-model="inventoryStore.sortBy"
            :options="inventoryStore.sortOptions"
            outlined
            dense
            label="Sort by"
            @update:model-value="inventoryStore.handleSortForGrid"
          />
        </div>
        <div class="col-12 col-sm-4">
          <q-btn-toggle
            v-model="inventoryStore.sortDirection"
            spread
            no-caps
            toggle-color="primary"
            :options="[
              { label: 'Ascending', value: 'asc' },
              { label: 'Descending', value: 'desc' }
            ]"
            @update:model-value="inventoryStore.handleSortForGrid"
          />
        </div>
      </div>

      <div class="row q-col-gutter-md">
        <div
          v-for="item in inventoryStore.sortedItems"
          :key="item.id"
          class="col-12 col-sm-6 col-md-4 col-lg-3"
        >
          <q-card class="inventory-card">
            <q-img
              :src="item.image"
              :ratio="1"
              spinner-color="primary"
              style="height: 200px"
            >
              <div class="absolute-bottom text-subtitle2 text-center bg-transparent">
                {{ item.name }}
              </div>
            </q-img>

            <q-card-section>
              <div class="row items-center justify-between">
                <div class="text-h6">{{ item.name }}</div>
                <div class="text-subtitle1 text-weight-bold">
                  {{ formatPrice(item.price) }}
                </div>
              </div>
              <div class="text-subtitle2">SKU: {{ item.sku }}</div>
              <div class="text-subtitle2">Category: {{ item.category }}</div>
            </q-card-section>

            <q-card-section>
              <div class="row items-center justify-between">
                <div>
                  <q-badge :color="getStockColor(item.quantity)">
                    {{ item.quantity }} in stock
                  </q-badge>
                </div>
                <div>
                  <q-btn
                    flat
                    round
                    color="primary"
                    icon="edit"
                    @click="inventoryStore.openItemDialog(item)"
                  />
                  <q-btn
                    flat
                    round
                    color="negative"
                    icon="delete"
                    @click="inventoryStore.confirmDelete(item)"
                  />
                </div>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>
    </template>

    <!-- List View -->
    <q-table
      v-else
      :rows="inventoryStore.sortedItems"
      :columns="inventoryStore.columns"
      row-key="id"
      :loading="loading"
      :pagination.sync="pagination"
      :sort-method="customSort"
      flat
      bordered
      class="inventory-table"
    >
      <template v-slot:body-cell-image="props">
        <q-td :props="props">
          <q-img
            :src="props.row.image"
            spinner-color="primary"
            style="height: 50px; width: 50px"
          />
        </q-td>
      </template>

      <template v-slot:body-cell-quantity="props">
        <q-td :props="props">
          <q-badge :color="getStockColor(props.row.quantity)">
            {{ props.row.quantity }}
          </q-badge>
        </q-td>
      </template>

      <template v-slot:body-cell-actions="props">
        <q-td :props="props">
          <q-btn
            flat
            round
            color="primary"
            icon="edit"
            @click="inventoryStore.openItemDialog(props.row)"
          />
          <q-btn
            flat
            round
            color="negative"
            icon="delete"
            @click="confirmDelete(props.row)"
          />
        </q-td>
      </template>
    </q-table>

    <!-- Item Dialog (Add/Edit) -->
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useInventoryStore } from 'src/stores/inventoryStore'
import { mapState } from 'pinia';

const { pagination, editedItem } = mapState(useInventoryStore, ['pagination',  'editedItem'])
onMounted(() => {
  inventoryStore.loadInventory()
})

const inventoryStore = useInventoryStore()
// const sortedItems = computed(() => {
//    const sorted = [...inventoryStore.filteredItems]
//    sorted.sort((a, b) => {
//      const aValue = a[inventoryStore.sortBy]
//      const bValue = b[inventoryStore.sortBy]

//      if (typeof aValue === 'string') {
//        return inventoryStore.sortDirection === 'asc'
//          ? aValue.localeCompare(bValue)
//          : bValue.localeCompare(aValue)
//      }

//      return inventoryStore.sortDirection === 'asc'
//        ? aValue - bValue
//        : bValue - aValue
//    })

//    return sorted
//  })
const categories = computed(() => inventoryStore.categories)
const loading = computed(() => inventoryStore.loading)

const formatPrice =  (price) => {
  return `$${price.toFixed(2)}`
}
const getStockColor = (quantity) => {
  return quantity > 10 ? 'positive' : 'negative'
}

// const editedItem = computed({
//    get: () => inventoryStore.editedItem,
//    set: (value) => {
//      inventoryStore.editedItem = value
//    }
//  })
const editMode = computed(() => inventoryStore.editMode)
const confirmDelete = (item) => {
   inventoryStore.confirmDelete(item)
 }
 const saveItem = () => {
   inventoryStore.saveItem()
 }
 const deleteItem = () => {
   inventoryStore.deleteItem()
 }
const customSort = (rows, sortBy, descending) => {
  return rows.sort((a, b) => {
    const aValue = a[sortBy]
    const bValue = b[sortBy]

    if (typeof aValue === 'string') {
      return descending
        ? bValue.localeCompare(aValue)
        : aValue.localeCompare(bValue)
    }

    return descending
      ? bValue - aValue
      : aValue - bValue
  })
}
</script>

<style lang="scss" scoped>
.inventory-card {
  height: 100%;
  transition: all 0.3s ease;
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
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
