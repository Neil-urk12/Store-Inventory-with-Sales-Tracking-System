/**
 * @component DailyPnl
 * @description A component that displays daily profit and loss information.
 * Shows today's profit and expenses with color-coded values and loading states.
 * Integrates with the financial store for financial data.
 */

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useFinancialStore } from '../../stores/financialStore'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const financialStore = useFinancialStore()

/** @type {import('vue').Ref<boolean>} */
const isLoading = ref(true)
const isRefreshing = ref(false)
const retryCount = ref(0)
const maxRetries = 3

// Add refresh interval
const refreshInterval = ref(null)

/**
 * @description Loads financial data with retry mechanism
 */
const loadFinancialData = async () => {
  try {
    isRefreshing.value = true
    await financialStore.generateFinancialReport()
    await Promise.all([
      financialStore.fetchCashFlowTransactions('Cash'),
      financialStore.fetchCashFlowTransactions('GCash'),
      financialStore.fetchCashFlowTransactions('Growsari')
    ])
    retryCount.value = 0
  } catch (error) {
    console.error('Error loading financial data:', error)
    if (retryCount.value < maxRetries) {
      retryCount.value++
      $q.notify({
        type: 'warning',
        message: `Retrying data load (attempt ${retryCount.value}/${maxRetries})...`,
        timeout: 2000
      })
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount.value)))
      return loadFinancialData()
    }
    $q.notify({
      type: 'negative',
      message: 'Failed to load financial data after multiple attempts',
      actions: [
        {
          label: 'Retry',
          color: 'white',
          handler: () => {
            retryCount.value = 0
            loadFinancialData()
          }
        }
      ]
    })
  } finally {
    isLoading.value = false
    isRefreshing.value = false
  }
}

// Set up automatic refresh and initial load
onMounted(async () => {
  await loadFinancialData()
  // Refresh data every 5 minutes
  refreshInterval.value = setInterval(() => {
    // Only refresh if not already refreshing
    if (!isRefreshing.value) {
      loadFinancialData()
    }
  }, 300000)
})

// Clean up interval on component unmount
onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
})

/**
 * @type {import('vue').ComputedRef<string>}
 * @description Computes the text color based on the current theme
 * @returns {string} Hex color code for text
 */
const textColor = computed(() => $q.dark.isActive ? '#ffffff' : '#000000')

/**
 * @type {import('vue').ComputedRef<number>}
 * @description Computes the daily profit from the financial store
 * @returns {number} Daily profit value, defaults to 0 if error occurs
 */
const dailyProfit = computed(() => {
  try {
    return financialStore.getDailyProfit || 0
  } catch (error) {
    console.error('Error calculating daily profit:', error)
    return 0
  }
})

/**
 * @type {import('vue').ComputedRef<number>}
 * @description Computes the daily expenses from the financial store
 * @returns {number} Daily expense value, defaults to 0 if error occurs
 */
const dailyExpense = computed(() => {
  try {
    return financialStore.getDailyExpense || 0
  } catch (error) {
    console.error('Error calculating daily expense:', error)
    return 0
  }
})

/**
 * @type {import('vue').ComputedRef<number>}
 * @description Computes the net profit from the financial store
 * @returns {number} Net profit value
 */
const netProfit = computed(() => {
  return dailyProfit.value - dailyExpense.value
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
        <div class="text-subtitle2 q-mb-xs" :style="{ color: textColor }">Today's Profit</div>
        <div class="text-h6" :class="dailyProfit >= 0 ? 'text-positive' : 'text-negative'">
          <q-spinner-dots v-if="isRefreshing" size="1em" class="q-mr-xs" />
          {{ financialStore.formatCurrency(dailyProfit) }}
        </div>
      </div>
      <div class="text-center">
        <div class="text-subtitle2 q-mb-xs" :style="{ color: textColor }">Today's Expenses</div>
        <div class="text-h6 text-negative">
          <q-spinner-dots v-if="isRefreshing" size="1em" class="q-mr-xs" />
          {{ financialStore.formatCurrency(dailyExpense) }}
        </div>
      </div>
      <div class="text-center">
        <div class="text-subtitle2 q-mb-xs" :style="{ color: textColor }">Today's Net Profit</div>
        <div class="text-h6" :class="netProfit >= 0 ? 'text-positive' : 'text-negative'">
          <q-spinner-dots v-if="isRefreshing" size="1em" class="q-mr-xs" />
          {{ financialStore.formatCurrency(netProfit) }}
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
