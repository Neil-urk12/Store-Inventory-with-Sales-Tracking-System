/**
 * @component DailyPnl
 * @description A component that displays daily profit and loss information.
 * Shows today's profit and expenses with color-coded values and loading states.
 * Integrates with the inventory store for financial data.
 */

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useInventoryStore } from 'src/stores/inventoryStore'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const inventoryStore = useInventoryStore()

/** @type {import('vue').Ref<boolean>} */
const isLoading = ref(true)

/**
 * @type {import('vue').ComputedRef<string>}
 * @description Computes the text color based on the current theme
 * @returns {string} Hex color code for text
 */
const textColor = computed(() => $q.dark.isActive ? '#ffffff' : '#000000')

onMounted(async () => {
  try {
    await inventoryStore.loadInventory()
  } finally {
    isLoading.value = false
  }
})

/**
 * @type {import('vue').ComputedRef<number>}
 * @description Computes the daily profit from the inventory store
 * @returns {number} Daily profit value, defaults to 0 if error occurs
 */
const dailyProfit = computed(() => {
  try {
    return inventoryStore.getDailyProfit || 0
  } catch (error) {
    console.error('Error calculating daily profit:', error)
    return 0
  }
})

/**
 * @type {import('vue').ComputedRef<number>}
 * @description Computes the daily expenses from the inventory store
 * @returns {number} Daily expense value, defaults to 0 if error occurs
 */
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
    <div v-else class="profitBox q-mb-none fit row justify-evenly items-center q-pa-md">
      <div class="text-center">
        <div class="text-subtitle2 q-mb-xs" :style="{ color : textColor }">Today's Profit</div>
        <div class="text-h6" :class="dailyProfit >= 0 ? 'text-positive' : 'text-negative'">
          {{ inventoryStore.formatCurrency(dailyProfit) }}
        </div>
      </div>
      <div class="text-center">
        <div class="text-subtitle2 q-mb-xs" :style="{ color : textColor }">Today's Expenses</div>
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
  border: 1px solid var(--line-clr);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
  padding: 1rem 2rem;
  border-radius: 16px;
}
</style>
