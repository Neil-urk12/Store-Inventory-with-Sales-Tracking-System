<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { useInventoryStore } from '../stores/inventoryStore'

const $q = useQuasar()
const inventoryStore = useInventoryStore()

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

const filter = ref('')
const pagination = ref({
  sortBy: 'name',
  descending: false,
  page: 1,
  rowsPerPage: 5,
})

const stockColumns = [
  {
    name: 'name',
    label: 'Product Name',
    field: 'name',
    align: 'left',
    sortable: true,
    style: 'position: sticky; left: 0; z-index: 2;',
    classes: $q.dark.isActive ? 'bg-dark sticky-column' : 'bg-grey-2 sticky-column'
  },
  { name: 'current stock', label: 'Current Stock', field: 'current stock', align: 'left', sortable: true },
  { name: 'dead stock', label: 'Dead Stock', field: 'dead stock', align: 'left', sortable: true },
  {
    name: 'lastUpdated',
    label: 'Last Updated',
    field: 'lastUpdated',
    align: 'left',
    sortable: true
  }
]

const category = ref(null)
const categoryFilter = ref(null)
const categories = [
  { label: 'Electronics', value: 'electronics' },
  { label: 'Clothing', value: 'clothing' },
  { label: 'Books', value: 'books' }
]

const filteredStockData = computed(() => {
  let result = [...inventoryStore.stockData]
  if (categoryFilter.value) {
    result = result.filter(item => {
      const stockItem = inventoryStore.items.find(i => i.name === item.name)
      return stockItem && stockItem.category === categoryFilter.value
    })
  }
  return result
})

const handleCategoryFilter = () => categoryFilter.value = category.value
const sortStockData = (column, order) => inventoryStore.sortInventory(column, order)

const exportStockData = () => {
  const stockData = inventoryStore.stockData.map(item => ({
    'Product Name': item.name,
    'Current Stock': item['current stock'],
    'Dead Stock': item['dead stock'],
    'Last Updated': item.lastUpdated
  }))
  inventoryStore.exportToCSV(stockData, 'stock-levels-report')
}
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <q-card>
      <q-card-section class="row items-center">
        <div class="text-h6">Stock Levels</div>
        <q-space />
        <q-select
          v-model="category"
          :options="categories"
          label="Category"
          outlined
          dense
          class="q-mx-md"
          style="min-width: 200px"
          emit-value
          map-options
          clearable
          @update:model-value="handleCategoryFilter"
        />
        <q-btn
          color="primary"
          icon="file_download"
          label="Export CSV"
          @click="exportStockData"
          class="q-ml-sm"
        />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section>
        <q-table
          :rows="filteredStockData"
          :columns="stockColumns"
          row-key="name"
          :filter="filter"
          no-data-label="I didn't find anything for you"
          v-model:pagination="pagination"
          :loading="inventoryStore.loading"
          :rows-per-page-options="[5, 10, 15, 20]"
          class="my-table"
        >
          <template v-slot:header="props">
            <q-tr :props="props">
              <q-th v-for="col in props.cols" :key="col.name" :props="props">
                <div class="text-weight-bold text-grey-8">
                  <q-btn
                    flat
                    dense
                    size="sm"
                    :color="col.name === inventoryStore.sortBy ? (inventoryStore.sortDirection === 'asc' ? 'primary' : 'negative') : ''"
                    @click="sortStockData(col.name, col.name === inventoryStore.sortBy ? (inventoryStore.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc')"
                  >
                    {{ col.label }}
                    <q-icon :name="col.name === inventoryStore.sortBy ? (inventoryStore.sortDirection === 'asc' ? 'arrow_drop_up' : 'arrow_drop_down') : ''" />
                  </q-btn>
                </div>
              </q-th>
            </q-tr>
          </template>
          <template v-slot:body="props">
            <q-tr :props="props">
              <q-td v-for="col in props.cols" :key="col.name" :props="props">
                {{ props.row[col.name] }}
              </q-td>
            </q-tr>
          </template>
        </q-table>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.sticky-column {
  position: sticky;
  left: 0;
  z-index: 2;
  transition: background-color 0.3s ease;
}

:deep(.q-table__grid-content) {
  overflow-x: auto !important;
}

/* Add box shadow for better visual separation */
:deep(.sticky-column) {
  box-shadow: 4px 0 6px -2px rgba(0, 0, 0, 0.1);
}

/* Dark mode specific styles */
.body--dark :deep(.sticky-column) {
  box-shadow: 4px 0 6px -2px rgba(255, 255, 255, 0.1);
}
</style>
