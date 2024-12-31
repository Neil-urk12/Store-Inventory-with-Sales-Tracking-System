<script setup>
import { useInventoryStore } from 'src/stores/inventoryStore'
import { useFinancialStore } from 'src/stores/financialStore';
import { computed, ref, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { debounce } from 'lodash'

const $q = useQuasar()
const inventoryStore = useInventoryStore()
const financialStore = useFinancialStore()
const loading = ref(false)

const items = computed(() => inventoryStore.sortedItems)

const columns = [
  { name: 'sku', label: 'SKU', field: 'sku', align: 'left', sortable: true },
  {
    name: 'name',
    label: 'Name',
    field: 'name',
    align: 'left',
    sortable: true,
    style: 'position: sticky; left: 0; z-index: 2; box-shadow: 4px 0 4px rgba(0,0,0,0.1);',
    headerStyle: 'position: sticky; left: 0; z-index: 3; box-shadow: 4px 0 4px rgba(0,0,0,0.1);'
  },
  { name: 'category', label: 'Category', field: 'category', align: 'left', sortable: true },
  { name: 'quantity', label: 'Stock', field: 'quantity', align: 'left', sortable: true },
  { name: 'price', label: 'Price', field: 'price', align: 'left', sortable: true },
  { name: 'actions', label: 'Actions', field: 'actions', align: 'right' }
]

const pagination = ref({
  sortBy: 'name',
  descending: false,
  page: 1,
  rowsPerPage: 8
})

const stockFilter = ref('all')

const filteredItems = computed(() => {
  let result = [...items.value]

  // Stock filter
  if (stockFilter.value === 'low') {
    result = result.filter(item => item.quantity <= 10 && item.quantity > 0)
  } else if (stockFilter.value === 'out') {
    result = result.filter(item => item.quantity <= 0)
  }

  return result
})

const lowStockItems = computed(() =>
  items.value.filter(item => item.quantity <= 10)
)

const outOfStockItems = computed(() =>
  items.value.filter(item => item.quantity <= 0)
)

function exportToCSV() {
  if (!filteredItems.value || filteredItems.value.length === 0) {
    $q.notify({
      type: 'warning',
      message: 'No data available to export',
      position: 'top',
      timeout: 2000
    })
    return
  }

  const headers = columns
    .filter(col => col.name !== 'actions')
    .map(col => col.label)
    .join(',')

  const rows = filteredItems.value.map(item =>
    columns
      .filter(col => col.name !== 'actions')
      .map(col => `"${item[col.field]}"`)
      .join(',')
  ).join('\n')

  const csv = `${headers}\n${rows}`
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventory-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  window.URL.revokeObjectURL(url)
}

async function updateField(item, field, value) {
  if (String(value) === String(item[field])) return

  const updatePromise = (async () => {
    try {
      loading.value = true
      await inventoryStore.updateItem(item.id, { [field]: value })
      $q.notify({
        type: 'positive',
        message: `Successfully updated ${field}`,
        position: 'top',
        timeout: 2000
      })
    } catch (error) {
      console.error('Error updating item:', error)
      $q.notify({
        type: 'negative',
        message: `Failed to update ${field}: ${error.message}`,
        position: 'top',
        timeout: 3000
      })
      throw error
    } finally {
      loading.value = false
    }
  })()

  await debounce(() => updatePromise, 300)()
}

function getStockColor(quantity) {
  if (quantity <= 0) return 'negative'
  if (quantity <= 10) return 'warning'
  return 'positive'
}

function customSort(rows, sortBy, descending) {
  const data = [...rows]
  if (!sortBy) return data

  return data.sort((a, b) => {
    const aValue = a[sortBy]
    const bValue = b[sortBy]

    if (typeof aValue === 'string')
      return descending
        ? bValue.localeCompare(aValue)
        : aValue.localeCompare(bValue)

    return descending
      ? bValue - aValue
      : aValue - bValue
  })
}

onMounted(() => {
  checkLowStock()
})

function checkLowStock() {
  if (lowStockItems.value.length > 0) {
    $q.notify({
      type: 'warning',
      message: `${lowStockItems.value.length} items are running low on stock`,
      position: 'top-right',
      timeout: 5000,
      actions: [
        { label: 'View', color: 'white', handler: () => {
          pagination.value.sortBy = 'quantity'
          pagination.value.descending = true
        }}
      ]
    })
  }

  if (outOfStockItems.value.length > 0) {
    $q.notify({
      type: 'negative',
      message: `${outOfStockItems.value.length} items are out of stock`,
      position: 'top-right',
      timeout: 5000,
      actions: [
        { label: 'View', color: 'white', handler: () => {
          pagination.value.sortBy = 'quantity'
          pagination.value.descending = true
        }}
      ]
    })
  }
}
</script>

<template>
  <div class="q-pa-md">
    <div class="row q-mb-md items-center justify-between">
      <div class="row q-gutter-md items-center">
        <q-select
          v-model="stockFilter"
          :options="[
            { label: 'All Stock', value: 'all' },
            { label: 'Low Stock', value: 'low' },
            { label: 'Out of Stock', value: 'out' }
          ]"
          dense
          outlined
          emit-value
          map-options
          class="col-auto"
          style="min-width: 150px"
        />
      </div>

      <div class="row q-gutter-sm">
        <q-btn
          color="primary"
          icon="cleaning_services"
          label="Clean Duplicates"
          @click="inventoryStore.cleanupDuplicates()"
        />
        <q-btn
          color="primary"
          icon="download"
          label="Export CSV"
          @click="exportToCSV"
        />
      </div>
    </div>

    <q-table
      :rows="filteredItems"
      :columns="columns"
      row-key="id"
      :loading="loading"
      :pagination.sync="pagination"
      :sort-method="customSort"
      flat
      bordered
      class="inventory-table"
      virtual-scroll
      :virtual-scroll-sticky-start="48"
      sticky-header
      :rows-per-page-options="[5, 10, 20, 50, 100]"
    >
      <template v-slot:body-cell-name="props">
        <q-td :props="props">
          <q-popup-edit
            v-model="props.row.name"
            v-slot="scope"
            buttons
            @save-handler="updateField(props.row, 'name', scope.value)"
          >
            <q-input
              v-model="scope.value"
              dense
              autofocus
            />
          </q-popup-edit>
          {{ props.value }}
        </q-td>
      </template>
      <template v-slot:body-cell-sku="props">
        <q-td :props="props">
          <q-popup-edit
            v-model="props.row.sku"
            v-slot="scope"
            buttons
            @save-handler="updateField(props.row, 'sku', scope.value)"
          >
            <q-input
              v-model="scope.value"
              dense
              autofocus
            />
          </q-popup-edit>
          {{ props.value }}
        </q-td>
      </template>
      <template v-slot:body-cell-category="props">
        <q-td :props="props">
          {{ props.row.category }}
        </q-td>
      </template>
      <template v-slot:body-cell-quantity="props">
        <q-td :props="props">
          <q-popup-edit
            v-model="props.row.quantity"
            v-slot="scope"
            buttons
            @save-handler="updateField(props.row, 'quantity', Number(scope.value))"
          >
            <q-input
              v-model.number="scope.value"
              type="number"
              dense
              autofocus
              :rules="[
                val => val >= 0 || 'Quantity cannot be negative'
              ]"
            />
          </q-popup-edit>
          <q-badge :color="getStockColor(props.row.quantity)" class="text-black text-weight-medium stock-badge">
            {{ props.row.quantity }}
          </q-badge>
        </q-td>
      </template>
      <template v-slot:body-cell-price="props">
        <q-td :props="props">
          <q-popup-edit
            v-model="props.row.price"
            v-slot="scope"
            buttons
            @save-handler="updateField(props.row, 'price', Number(scope.value))"
          >
            <q-input
              v-model.number="scope.value"
              type="number"
              dense
              autofocus
              prefix="$"
              :step="0.01"
              :rules="[
                val => val >= 0 || 'Price cannot be negative'
              ]"
            />
          </q-popup-edit>
          {{ financialStore.formatCurrency(props.row.price) }}
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
            @click="inventoryStore.confirmDelete(props.row)"
          />
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<style lang="scss" scoped>
.inventory-table {
  height: calc(80vh - 150px);
  :deep(.q-table) {
    td[style*="position: sticky"],
    th[style*="position: sticky"] {
      background: #f5c353;
      color: #0b1937;
      max-width: 200px;
      white-space: normal;
    }
  }
}
.stock-badge {
  font-size: 14px;
  padding: 6px 10px;
}
@media (max-width: 599px) {
  .q-table {
    &__container {
      overflow-x: auto;
    }
    td:not([style*="position: sticky"]),
    th:not([style*="position: sticky"]) {
      padding-left: 12px;
    }
  }
  :deep(.q-table) {
    td[style*="position: sticky"],
    th[style*="position: sticky"] {
      font-size: 12px;
      padding: 8px;
      max-width: 120px;
    }
  }
  .row {
    flex-direction: column;
    .q-input, .q-select {
      width: 100%;
      margin-bottom: 8px;
    }
    .q-gutter-sm {
      width: 100%;
      justify-content: space-between;
    }
  }
}
@media (max-width: 400px) {
  :deep(.q-table) {
    td[style*="position: sticky"],
    th[style*="position: sticky"] {
      font-size: 11px;
      padding: 6px;
      max-width: 100px;
    }
  }
}
</style>
