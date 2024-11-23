<template>
  <div>
    <div class="row q-col-gutter-sm q-mb-md">
      <div class="col-12 col-sm-4">
        <q-select
          v-model="inventoryStore.sortBy"
          :options="sortOptions"
          outlined
          dense
          label="Sort by"
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
            { label: 'Descending', value: 'desc' },
          ]"
          @update:model-value="inventoryStore.toggleSortDirection"
        />
      </div>
    </div>

    <div class="row q-col-gutter-md">
      <div
        v-for="item in items"
        :key="item.id"
        class="col-12 col-sm-6 col-md-4 col-lg-3"
      >
        <q-card class="inventory-card">
          <q-img
            :src="item.image"
            :ratio="1"
            spinner-color="primary"
            style="height: 200px"
            loading="lazy"
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
  </div>
</template>

<script setup>
import { useInventoryStore } from 'src/stores/inventoryStore'
import { computed } from 'vue'

const inventoryStore = useInventoryStore()

const sortOptions = [
  { label: 'Name', value: 'name' },
  { label: 'Price', value: 'price' },
  { label: 'Quantity', value: 'quantity' },
  { label: 'Category', value: 'category' }
]

const items = computed(() => inventoryStore.sortedItems)

function formatPrice(price) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(price)
}

function getStockColor(quantity) {
  if (quantity <= 0) return 'negative'
  if (quantity <= 10) return 'warning'
  return 'positive'
}
</script>

<style lang="scss" scoped>
.inventory-card {
  height: 100%;
  transition: all 0.3s ease;
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
  }
}

@media (max-width: 599px) {
  .inventory-card {
    margin-bottom: 1rem;
  }
}
</style>
