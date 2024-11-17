<script setup>
import { ref, computed, onMounted } from 'vue'
import { useInventoryStore } from 'src/stores/inventoryStore'

const inventoryStore = useInventoryStore()
const isLoading = ref(true)

onMounted(async () => {
  try {
    await inventoryStore.loadInventory()
  } finally {
    isLoading.value = false
  }
})

const dailyProfit = computed(() => {
  try {
    return inventoryStore.getDailyProfit || 0
  } catch (error) {
    console.error('Error calculating daily profit:', error)
    return 0
  }
})

const dailyExpense = computed(() => {
  try {
    return inventoryStore.getDailyExpense || 0
  } catch (error) {
    console.error('Error calculating daily expense:', error)
    return 0
  }
})
</script>

<template>
  <div class="dailyPNLcontainer fit column justify-center">
    <div v-if="isLoading" class="q-pa-md">
      <q-skeleton type="text" class="text-subtitle1" />
      <q-skeleton type="text" class="text-subtitle1 q-mt-sm" />
    </div>
    <div v-else class="profitBox bg-accent q-mb-none fit row justify-evenly items-center q-pa-md">
      <div class="text-center">
        <div class="text-subtitle2 q-mb-xs">Today's Profit</div>
        <div class="text-h6" :class="dailyProfit >= 0 ? 'text-positive' : 'text-negative'">
          {{ inventoryStore.formatCurrency(dailyProfit) }}
        </div>
      </div>
      <div class="text-center">
        <div class="text-subtitle2 q-mb-xs">Today's Expenses</div>
        <div class="text-h6 text-negative">
          {{ inventoryStore.formatCurrency(dailyExpense) }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profitBox {
  border-radius: 12px;
  min-height: 100px;
}
</style>
