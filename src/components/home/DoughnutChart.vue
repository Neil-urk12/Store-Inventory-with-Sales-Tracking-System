/**
 * @component DoughnutChart
 * @description A doughnut chart component that visualizes inventory data by product categories.
 * Uses Chart.js for rendering and integrates with the inventory store for data management.
 * Supports both light and dark themes.
 */

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from "vue"
import { Chart, registerables } from "chart.js"
import { useInventoryStore } from 'src/stores/inventoryStore'
import { useQuasar } from 'quasar'

Chart.register(...registerables)
const inventoryStore = useInventoryStore()
const $q = useQuasar()

/** @type {import('vue').Ref<HTMLCanvasElement|null>} */
const chartCanvas = ref(null)

/** @type {Chart|null} */
let doughnutChart = null

/** @type {import('vue').Ref<boolean>} */
const isLoading = ref(true)

/**
 * @type {import('vue').ComputedRef<Object>}
 * @description Computes the chart data from the inventory store.
 * Processes items to group them by category and calculate quantities.
 * @returns {Object} Chart.js compatible data object with labels and datasets
 */
const chartData = computed(() => {
  const items = inventoryStore.items || []

  if (!items.length) {
    console.warn('No items found, returning default data')
    return {
      labels: ['No Data'],
      datasets: [{
        data: [1],
        backgroundColor: ['#cccccc'],
      }]
    }
  }

  const categories = {}
  items.forEach(item => {
    const category = item.category || 'Uncategorized'
    const quantity = Number(item.quantity) || 0
    // console.log(`Processing item: ${item.name}, category: ${category}, quantity: ${quantity}`)
    categories[category] = (categories[category] || 0) + quantity
  })

  return {
    labels: Object.keys(categories),
    datasets: [{
      data: Object.values(categories),
      backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"],
      hoverOffset: 4
    }]
  }
})

/**
 * @type {import('vue').ComputedRef<Object>}
 * @description Computes the chart options based on current theme.
 * @returns {Object} Chart.js configuration options
*/
const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "top",
      labels: { color: $q.dark.isActive ? 'white' : 'black' }
    },
    title: {
      display: true,
      text: "Product Category by Stocks",
      color: $q.dark.isActive ? 'white' : 'black',
      padding: { top: 10, bottom: 20 }
    }
  }
}))

/**
 * @async
 * @function createChart
 * @description Creates or recreates the doughnut chart with current data and options.
 * Handles chart cleanup and canvas context initialization.
 * @returns {Promise<void>}
 */
async function createChart() {
  await nextTick()

  if (!chartCanvas.value)
    return console.warn('Canvas element still not found after nextTick')

  try {
    if (doughnutChart)
      doughnutChart.destroy()

    const ctx = chartCanvas.value.getContext('2d')
    if (!ctx)
      return console.error('Could not get 2d context from canvas')

    doughnutChart = new Chart(ctx, {
      type: "doughnut",
      data: chartData.value,
      options: options.value
    })
    console.log('Chart created successfully')
  } catch (error) {
    console.error('Error creating chart:', error)
  }
}

watch(() => $q.dark.isActive, () => createChart() )

onMounted(async () => {
  try {
    if(inventoryStore.items.length === 0)
      await inventoryStore.loadInventory()

    console.log('Inventory loaded')
    isLoading.value = false
    // await nextTick()
    await createChart()
  } catch (error) {
    console.error('Error in mount:', error)
  }
})

onBeforeUnmount(() => {
  if (doughnutChart)
    doughnutChart.destroy()
})
</script>

<template>
  <div class="chart-container q-border-accent q-border-2 q-pa-md">
    <template v-if="isLoading">
      <q-spinner
        color="primary"
        size="3em"
      />
    </template>
    <div v-else class="canvas-wrapper">
      <canvas
        ref="chartCanvas"
        style="width: 100%; height: 100%"
      ></canvas>
    </div>
  </div>
</template>

<style scoped>
.chart-container {
  height: 350px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.canvas-wrapper {
  height: 100%;
  width: 100%;
  position: relative;
}
</style>
