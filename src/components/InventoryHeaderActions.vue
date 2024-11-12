<template>
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
  <div class="row q-col-gutter-md q-mb-md">
    <div class="col-12 col-sm-6">
      <q-input
        v-model="inventoryStore.searchQuery"
        outlined
        dense
        placeholder="Search inventory...."
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
</template>

<script setup>
import { useInventoryStore } from 'src/stores/inventoryStore'
const inventoryStore = useInventoryStore()
</script>
