/**
 * @component StockBars
 * @description A visual component that displays stock levels using colored bars.
 * Shows the distribution of products across three categories:
 * - In Stock (green)
 * - Low Stock (yellow)
 * - Out of Stock (red)
 * Supports both light and dark themes.
 */

<script setup>
import { computed, onMounted } from 'vue'
import { useInventoryStore } from 'src/stores/inventoryStore'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const inventoryStore = useInventoryStore()

/** @type {number} The threshold below which stock is considered "low" */
const lowStockThreshold = 10

/**
 * @type {import('vue').ComputedRef<string>}
 * @description Computes text color based on current theme
 */
const textColor = computed(() => $q.dark.isActive ? '#ffffff' : '#000000')

/**
 * @type {import('vue').ComputedRef<number>}
 * @description Computes the total number of items in the inventory
 */
const totalItems = computed(() => inventoryStore.items.length)

/**
 * @type {import('vue').ComputedRef<number>}
 * @description Computes the number of items with normal stock levels
 */
const inStock = computed(() => inventoryStore.items.filter(item => item.quantity > lowStockThreshold).length)

/**
 * @type {import('vue').ComputedRef<number>}
 * @description Computes the number of items with low stock (below threshold)
 */
const lowStock = computed(() => inventoryStore.items.filter(item => item.quantity > 0 && item.quantity <= lowStockThreshold).length)

/**
 * @type {import('vue').ComputedRef<number>}
 * @description Computes the number of items out of stock
 */
const noStock = computed(() => inventoryStore.items.filter(item => item.quantity <= 0).length)

/**
 * @type {import('vue').ComputedRef<string>}
 * @description Computes the width percentage for the in-stock bar
 */
const inStockWidth = computed(() => totalItems.value === 0 ? '10%' : `${(inStock.value / totalItems.value) * 100}%`)

/**
 * @type {import('vue').ComputedRef<string>}
 * @description Computes the width percentage for the low-stock bar
 */
const lowStockWidth = computed(() => totalItems.value === 0 ? '10%' : `${(lowStock.value / totalItems.value) * 100}%`)

/**
 * @type {import('vue').ComputedRef<string>}
 * @description Computes the width percentage for the no-stock bar
 */
const noStockWidth = computed(() => totalItems.value === 0 ? '10%' : `${(noStock.value / totalItems.value) * 100}%`)

onMounted(() => {
  inventoryStore.loadInventory()
})
</script>

<template>
  <div class="stock-bars">
    <div class="stock-flex row no-wrap items-start content-start text-center text-black q-mb-sm">
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
    <div class="legends row wrap justify-center items-center q-mt-xs">
        <ul class="row items-center q-pa-none q-ma-none">
            <li class="inStockList" :style="{ color: textColor }">In Stocks</li>
            <li class="lowStockList" :style="{ color: textColor }">Low Stocks</li>
            <li class="noStockList" :style="{ color: textColor }">Out of Stocks</li>
        </ul>
    </div>
</div>
</template>

<style scoped>
.stock-bars {
  width: 100%;
  border: 1px solid var(--line-clr);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  padding: 1rem;
}
.stock-flex {
  font-weight: 600;
  width: 100%;
}
.bar {
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.legends ul {
  width: 100%;
  display: flex;
  justify-content: center;
  gap: 1rem;
}
.stock-bars ul li {
  list-style-type: square;
  font-size: 0.9rem;
  margin: 0;
  padding: 0 0.5rem;
}
.inStockList::marker {
  color: green;
  font-size: 1.2rem;
}
.lowStockList::marker {
  color: yellow;
  font-size: 1.2rem;
}
.noStockList::marker {
  color: red;
  font-size: 1.2rem;
}
</style>
