<script setup>
import { useInventoryStore } from 'src/stores/inventoryStore'
import { useFinancialStore } from 'src/stores/financialStore';
import { computed, ref } from 'vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const inventoryStore = useInventoryStore()
const financialStore = useFinancialStore()
const loading = ref(false)

const items = computed(() => inventoryStore.sortedItems)

const columns = [
  { name: 'sku', label: 'SKU', field: 'sku', align: 'left', sortable: true },
  {
    name: 'image',
    label: 'Image',
    field: 'image',
    align: 'left'
  },
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
  rowsPerPage: 10
})

async function updateField(item, field, value) {
  // Prevent unnecessary updates and type coercion issues
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

  // Debounce rapid updates
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
</script>

<template>
  <div class="q-pa-md">
    <q-table
      :rows="items"
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
      <template v-slot:body-cell-image="props">
        <q-td :props="props" auto-width>
          <q-img
            :src="props.row.image"
            spinner-color="primary"
            style="height: 50px; width: 50px"
            loading="lazy"
          />
        </q-td>
      </template>
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
          {{ props.row.name }}
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
          {{ props.row.sku }}
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
  height: calc(100vh - 150px);
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
