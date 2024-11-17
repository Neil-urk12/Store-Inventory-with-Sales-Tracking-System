<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue"
import { Chart, registerables } from "chart.js"
import { useInventoryStore } from 'src/stores/inventoryStore'

Chart.register(...registerables)
const inventoryStore = useInventoryStore()
const chartCanvas = ref(null)
let doughnutChart = null
const isLoading = ref(true)

const chartData = computed(() => {
  const items = inventoryStore.items || []
  console.log('Chart data items:', items)
  console.log('Items length:', items.length)
  console.log('Raw items data:', JSON.stringify(items, null, 2))

  if (!items.length) {
    console.log('No items found, returning default data')
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
    console.log(`Processing item: ${item.name}, category: ${category}, quantity: ${quantity}`)
    categories[category] = (categories[category] || 0) + quantity
  })

  console.log('Processed categories:', categories)
  console.log('Category keys:', Object.keys(categories))
  console.log('Category values:', Object.values(categories))

  return {
    labels: Object.keys(categories),
    datasets: [{
      data: Object.values(categories),
      backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0", "#9966FF"],
      hoverOffset: 4
    }]
  }
})

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "top",
      labels: { color: 'white' }
    },
    title: {
      display: true,
      text: "Product Category by Stocks",
      color: 'white',
      padding: { top: 10, bottom: 20 }
    }
  }
}

async function createChart() {
  console.log('Creating chart...')

  // Wait for the next DOM update
  await nextTick()

  if (!chartCanvas.value) {
    console.warn('Canvas element still not found after nextTick')
    return
  }

  try {
    if (doughnutChart) {
      console.log('Destroying old chart')
      doughnutChart.destroy()
    }

    const ctx = chartCanvas.value.getContext('2d')
    if (!ctx) {
      console.error('Could not get 2d context from canvas')
      return
    }

    console.log('Chart data:', chartData.value)
    doughnutChart = new Chart(ctx, {
      type: "doughnut",
      data: chartData.value,
      options
    })
    console.log('Chart created successfully')
  } catch (error) {
    console.error('Error creating chart:', error)
  }
}

onMounted(async () => {
  console.log('Component mounted')
  try {
    await inventoryStore.loadInventory()
    console.log('Inventory loaded')
    isLoading.value = false
    await nextTick()
    await createChart()
  } catch (error) {
    console.error('Error in mount:', error)
  }
})

onBeforeUnmount(() => {
  if (doughnutChart) {
    doughnutChart.destroy()
  }
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
  height: 300px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 1rem;
}

.canvas-wrapper {
  height: 100%;
  width: 100%;
  position: relative;
}
</style>
