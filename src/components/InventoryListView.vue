<template>
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
          @click="inventoryStore.confirmDelete(props.row)"
        />
      </q-td>
    </template>
  </q-table>
</template>

<script setup>
import { useInventoryStore } from 'src/stores/inventoryStore'
import { computed, ref } from 'vue'

const inventoryStore = useInventoryStore()
const loading = ref(false)

const items = computed(() => inventoryStore.sortedItems)

const columns = [
  { name: 'image', label: 'Image', field: 'image', align: 'left' },
  { name: 'name', label: 'Name', field: 'name', align: 'left', sortable: true },
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
  if (!sortBy) {
    return data
  }

  return data.sort((a, b) => {
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
.inventory-table {
  .q-table__card {
    border-radius: 8px;
  }
}

@media (max-width: 599px) {
  .q-table {
    &__container {
      overflow-x: auto;
    }
  }
}
</style>
