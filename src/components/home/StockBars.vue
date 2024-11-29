<script setup>
import { computed, onMounted } from 'vue'
import { useInventoryStore } from 'src/stores/inventoryStore'
import { useQuasar } from 'quasar'

onMounted(() => {
  inventoryStore.loadInventory()
})
const $q = useQuasar()
const inventoryStore = useInventoryStore()
const lowStockThreshold = 8
const textColor = computed(() => $q.dark.isActive ? '#ffffff' : '#000000')

const totalStock = computed(() => inventoryStore.items.reduce((sum, item) => sum + item.quantity, 0))

const inStock = computed(() => inventoryStore.items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0))
const lowStock = computed(() => inventoryStore.items.reduce((sum, item) => sum + Math.max(0, Math.min(item.quantity, lowStockThreshold)), 0))
const noStock = computed(() => inventoryStore.items.reduce((sum, item) => sum + Math.max(0, Math.min(0, item.quantity)), 0))

const inStockWidth = computed(() => totalStock.value === 0 ? '10%' : `${(inStock.value / totalStock.value) * 100}%`)
const lowStockWidth = computed(() => totalStock.value === 0 ? '10%' : `${(lowStock.value / totalStock.value) * 100}%`)
const noStockWidth = computed(() => totalStock.value === 0 ? '10%' : `${(noStock.value / totalStock.value) * 100}%`)
</script>

<template>
  <div class="stock-bars  fit column justify-center q-mb-md">
    <div class="stock-flex fit row no-wrap items-start content-start text-center text-black">
        <div class="bar green bg-green" :style="{ width: inStockWidth, minWidth: '10%' }">
            {{ inStock }}
        </div>
        <div
            class="bar yellow bg-yellow"
            :style="{ width: lowStockWidth, minWidth: '10%' }"
        >
            {{ lowStock }}
        </div>
        <div class="bar red bg-red" :style="{ width: noStockWidth, minWidth: '10%' }">
            {{ noStock }}
        </div>
    </div>
    <div class="legends fit row wrap justify-center items-center content-start q-mt-xs">
        <ul class="fit row items-center content-start q-pa-none">
            <li class="inStockList" :style="{ color: textColor }">In Stocks</li>
            <li class="lowStockList" :style="{ color: textColor }">Low Stocks</li>
            <li class="noStockList" :style="{ color: textColor }">Out of Stocks</li>
        </ul>
    </div>
</div>
</template>

<style scoped>
.stock-bars{
  border: 1px solid var(--line-clr);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  padding: 1rem 2rem;
  border-radius: 16px;
}
.stock-flex {font-weight: 600}
.bar {height: 20px}
.stock-bars ul li {
  margin: 0.25rem 0.85rem 0rem 0.85rem;
  list-style-type: square;
  font-size: 1.25rem;
}
.inStockList::marker {
  color: green;
  font-size: 1.5rem
}
.lowStockList::marker {
  color: yellow;
  font-size: 1.5rem
}
.noStockList::marker {
  color: red;
  border: 1px solid rgb(255, 255, 255);
  font-size: 1.5rem
}
</style>
