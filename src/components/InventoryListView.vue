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
            @click="inventoryStore.confirmDelete(props.row)"
          />
        </q-td>
      </template>
    </q-table>
  </div>
</template>

<script setup>
import { useInventoryStore } from 'src/stores/inventoryStore'
import { computed, ref } from 'vue'

const inventoryStore = useInventoryStore()
const loading = ref(false)

const items = computed(() => inventoryStore.sortedItems)

const columns = [
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
  { name: 'sku', label: 'SKU', field: 'sku', align: 'left', sortable: true },
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

<style lang="scss" scoped>
.inventory-table {
  height: calc(100vh - 150px);
  :deep(.q-table) {
    td[style*="position: sticky"],
    th[style*="position: sticky"] {
      background: lightblue;
      color: black;
      max-width: 200px;
      white-space: normal;
    }
  }
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
