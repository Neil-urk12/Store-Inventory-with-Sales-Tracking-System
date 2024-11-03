<template>
  <div class="q-pa-md">
    <InventoryHeaderActions></InventoryHeaderActions>

    <!-- Loading State -->
    <div v-if="loading" class="row justify-center q-pa-md">
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
            @update"inventoryStore.setSortBy"
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
            :options="[{ label: 'Ascending', value: 'asc' }, { label: 'Descending', value: 'desc' }]"
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
      :rows="items"
      :columns="columns"
      row-key="id"
      :loading="loading"
      :pagination.sync="pagination"
      :sort-method="inventoryStore.customSort"
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
    <ItemDialog></ItemDialog>
    <DeleteDialog></DeleteDialog>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useInventoryStore } from 'src/stores/inventoryStore'
import InventoryHeaderActions from 'src/components/InventoryHeaderActions.vue';
import DeleteDialog from 'src/components/DeleteDialog.vue';
import ItemDialog from 'src/components/ItemDialog.vue';

onMounted(() => {
  inventoryStore.loadInventory()
})

const inventoryStore = useInventoryStore()
const loading = computed(() => inventoryStore.loading)
const pagination = computed(() => inventoryStore.pagination)
const sortOptions = computed(() => inventoryStore.sortOptions)
const columns = computed(() => inventoryStore.columns)
const items = computed(() => inventoryStore.items)

const formatPrice =  (price) => {
  return `$${price.toFixed(2)}`
}
const getStockColor = (quantity) => {
  return quantity > 10 ? 'positive' : 'negative'
}

const confirmDelete = (item) => inventoryStore.confirmDelete(item)
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
