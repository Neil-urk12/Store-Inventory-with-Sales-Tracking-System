/**
 * @component DashboardTable
 * @description A table component that displays recently added products.
 * Features include sorting, pagination, and image display.
 * Integrates with the inventory store for product data.
 */

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useInventoryStore } from 'src/stores/inventoryStore'

const inventoryStore = useInventoryStore()

/** @type {import('vue').Ref<boolean>} */
const loading = ref(true)

/**
 * @type {import('vue').Ref<Object>}
 * @description Table pagination configuration
 */
const pagination = ref({
  sortBy: 'createdAt',
  descending: true,
  page: 1,
  rowsPerPage: 5,
})

/**
 * @type {Array<Object>}
 * @description Table column definitions with sorting and formatting options
 */
const columns = [
  {
    name: 'image',
    label: 'Image',
    field: 'image',
    align: 'left',
  },
  {
    name: 'name',
    label: 'Name',
    field: 'name',
    align: 'left',
    sortable: true,
  },
  {
    name: 'quantity',
    label: 'Quantity',
    field: 'quantity',
    align: 'left',
    sortable: true,
  },
  {
    name: 'price',
    label: 'Price',
    field: row => inventoryStore.formatCurrency(row.price),
    sortable: true,
  },
  {
    name: 'createdAt',
    label: 'Added Date',
    field: 'createdAt',
    format: val => new Date(val).toLocaleDateString(),
    sortable: true,
  }
]

/**
 * @type {import('vue').ComputedRef<Array>}
 * @description Computed property that returns sorted and sliced products array
 * @returns {Array} Array of most recently added products, limited to 5 items
 */
const products = computed(() => {
  return [...inventoryStore.items]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5)
})

onMounted(async () => {
  await inventoryStore.loadInventory()
  loading.value = false
})
</script>

<template>
  <q-table
    title="Recently Added Products"
    :rows="products"
    :columns="columns"
    row-key="id"
    :loading="loading"
    :pagination="pagination"
    :rows-per-page-options="[5, 10, 15]"
    class="my-sticky-header-table"
  >
    <template v-slot:body="props">
      <q-tr :props="props">
        <q-td key="image" :props="props">
          <q-img
            :src="props.row.image"
            :alt="props.row.name"
            style="width: 50px; height: 50px; object-fit: cover"
            @error="(err) => props.row.image = '/images/no-image.png'"
          />
        </q-td>
        <q-td key="name" :props="props">{{ props.row.name }}</q-td>
        <q-td key="quantity" :props="props">{{ props.row.quantity }}</q-td>
        <q-td key="price" :props="props">{{ props.row.price }}</q-td>
        <q-td key="createdAt" :props="props">
          {{ new Date(props.row.createdAt).toLocaleDateString() }}
        </q-td>
      </q-tr>
    </template>
  </q-table>
</template>

<style scoped>
.my-sticky-header-table {
  max-height: 365px;
}

.my-sticky-header-table .q-table__top,
.my-sticky-header-table .q-table__bottom,
.my-sticky-header-table thead tr:first-child th {
  background-color: var(--q-primary);
}

.my-sticky-header-table thead tr th {
  position: sticky;
  z-index: 1;
}

.my-sticky-header-table thead tr:first-child th {
  top: 0;
}
</style>
