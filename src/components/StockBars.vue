<script setup>
import { ref, computed, onMounted } from 'vue'
import { useInventoryStore } from '../stores/inventoryStore'

onMounted(() => {
  inventoryStore.loadInventory()
})

const inventoryStore = useInventoryStore()
const lowStockThreshold = 8

const totalStock = computed(() => inventoryStore.items.reduce((sum, item) => sum + item.quantity, 0))

const inStock = computed(() => inventoryStore.items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0))
const lowStock = computed(() => inventoryStore.items.reduce((sum, item) => sum + Math.max(0, Math.min(item.quantity, lowStockThreshold)), 0))
const noStock = computed(() => inventoryStore.items.reduce((sum, item) => sum + Math.max(0, Math.min(0, item.quantity)), 0))


const inStockWidth = computed(() => totalStock.value === 0 ? '10%' : `${(inStock.value / totalStock.value) * 100}%`)
const lowStockWidth = computed(() => totalStock.value === 0 ? '10%' : `${(lowStock.value / totalStock.value) * 100}%`)
const noStockWidth = computed(() => totalStock.value === 0 ? '10%' : `${(noStock.value / totalStock.value) * 100}%`)
</script>

<template>
  <div class="stock-bars bg-accent">
    <div class="stock-flex">
        <div class="bar green" :style="{ width: inStockWidth, minWidth: '10%' }">
            {{ inStock }}
        </div>
        <div
            class="bar yellow"
            :style="{ width: lowStockWidth, minWidth: '10%' }"
        >
            {{ lowStock }}
        </div>
        <div class="bar red" :style="{ width: noStockWidth, minWidth: '10%' }">
            {{ noStock }}
        </div>
    </div>
    <div class="legends">
        <ul>
            <li class="inStockList">In Stocks</li>
            <li class="lowStockList">Low Stocks</li>
            <li class="noStockList">Out of Stocks</li>
        </ul>
    </div>
</div>
</template>

<style scoped>
.legends{
  display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    margin-top: 10px;
}
.stock-flex {text-align: center}
.stock-bars{flex-direction: column}
.stock-bars{
  border: 1px solid var(--line-clr);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  padding: 1rem 2rem;
  border-radius: 16px;
  width: 100%;
  display: flex;
  justify-content: center
}
.stock-flex {
  display: flex;
  flex-direction: row;
  color: black;
  font-weight: 600
}
.bar {height: 20px}
.green {background-color: green}
.yellow {background-color: yellow}
.red {background-color: red}
ul {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0
}
.stock-bars ul li {
  margin: 0.25rem 0.85rem 0rem 0.85rem;
  list-style-type: square;
  font-size: 1.25rem;
  color: white
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
@media (max-width: 426px) {
  .stock-bars {padding: 0.5rem}
  .stock-bars ul li {font-size: 1.1rem}
  .stock-bars ul li::marker { font-size: 1.25rem}
  .stock-bars ul {flex-direction: column}
  .stock-bars ul li {margin: 0.25rem 0.5rem 0rem 0.5rem}
}
</style>
