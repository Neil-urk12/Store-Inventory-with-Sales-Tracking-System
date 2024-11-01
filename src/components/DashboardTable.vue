<template>
  <q-table
    :rows="products"
    :columns="columns"
    row-key="id"
    :loading="loading"
    :pagination="pagination"
    :rows-per-page-options="[5, 10, 15]"
  >
    <template v-slot:body="props">
      <q-tr :props="props">
        <q-td key="image" :props="props">
          <q-img :src="props.row.image" :alt="props.row.name" style="width: 50px" />
        </q-td>
        <q-td key="name" :props="props">{{ props.row.name }}</q-td>
        <q-td key="quantity" :props="props">{{ props.row.quantity }}</q-td>
        <q-td key="price" :props="props">{{ props.row.price }}</q-td>
      </q-tr>
    </template>
  </q-table>
</template>

<script setup>
import { ref, computed } from 'vue'
const loading = ref(false)
const pagination = ref({
  sortBy: 'name',
  descending: false,
  page: 1,
  rowsPerPage: 5,
})

const columns = computed(() => [
  {
    name: 'image',
    label: 'Image',
    field: 'image',
    align: 'left',
    format: (val) => `<img src="${val}" width="50" height="50" />`,
  },
  {
    name: 'name',
    label: 'Name',
    field: 'name',
    align: 'left',
  },
  {
    name: 'quantity',
    label: 'Quantity',
    field: 'quantity',
    align: 'left',
  },
  {
    name: 'price',
    label: 'Price',
    field: 'price',
    align: 'left',
  },
])

const products = computed(() => [
  {
    id: 1,
    image: 'public/images/a.png',
    name: 'Product 1',
    quantity: 10,
    price: 19.99,
  },
  {
    id: 2,
    image: 'public/images/b.png',
    name: 'Product 2',
    quantity: 20,
    price: 29.99,
  },
  {
    id: 3,
    image: 'public/images/c.png',
    name: 'Product 3',
    quantity: 30,
    price: 39.99,
  },
  {
    id: 4,
    image: 'public/images/d.png',
    name: 'Product 4',
    quantity: 40,
    price: 49.99,
  },
  {
    id: 5,
    image: 'public/images/a.png',
    name: 'Product 5',
    quantity: 50,
    price: 59.99,
  },
])
</script>
