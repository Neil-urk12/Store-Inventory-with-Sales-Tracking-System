<template>
  <q-card class="chart-card bg-transparent">
    <q-card-section class="chart-section">
      <div class="chart-wrapper">
        <div class="row q-ma-none items-center">
          <q-btn
            round
            color="primary"
            :loading="isRenderingSales"
            :disable="isRenderingSales"
            @click="rerenderSalesChart"
            class="q-mr-md"
            icon="refresh"
          >
            <q-tooltip anchor="center right" self="center left">
              Refresh Chart
            </q-tooltip>
            <template v-slot:loading>
              <q-spinner-dots />
            </template>
          </q-btn>
          <q-btn-dropdown
            flat
            color="primary"
            :label="'Sales: ' + selectedTimeframe"
            class="q-mr-md"
            :dark="$q.dark.isActive"
            :disable="isRenderingSales"
          >
            <q-list>
              <q-item
                v-for="option in timeframeOptions"
                :key="option.value"
                clickable
                v-close-popup
                @click="updateSalesTimeframe(option.value)"
              >
                <q-item-section>{{ option.label }}</q-item-section>
              </q-item>
            </q-list>
          </q-btn-dropdown>
        </div>
        <div class="chart-container">
          <div v-if="isRenderingSales" class="absolute-center">
            <q-spinner-dots size="40px" />
          </div>
          <div v-else-if="!hasData" class="absolute-center text-center">
            <q-icon name="show_chart" size="48px" color="grey-5" />
            <div class="text-grey-5 q-mt-sm">No sales data available for selected timeframe</div>
          </div>
          <canvas v-else id="salesTrendChart"></canvas>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { useInventoryStore } from 'src/stores/inventoryStore'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const $q = useQuasar()
const inventoryStore = useInventoryStore()
const salesTrendChart = ref(null)
const chartData = ref(null)

const isRenderingSales = ref(false)
const selectedTimeframe = computed(() => inventoryStore.selectedTimeframe)
const timeframeOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' }
]

const getChartOptions = (textColor) => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: {
          color: textColor
        },
        grid: {
          display: false
        }
      },
      y: {
        ticks: {
          color: textColor,
          beginAtZero: true
        },
        grid: {
          color: $q.dark.isActive ? '#5c5c5c' : '#e0e0e0'
        }
      }
    },
    plugins: {
      legend: {
        display: false
      }
    }
  }
}

const getChartData = (timeframe) => {
  const salesData = inventoryStore.getSalesDataByTimeframe(timeframe)

  if (!salesData || Object.keys(salesData).length === 0) {
    return null
  }

  const labels = Object.keys(salesData)
  const data = Object.values(salesData).map(item => item.total)

  return {
    labels: labels,
    datasets: [
      {
        label: 'Sales',
        data: data,
        backgroundColor: $q.dark.isActive ? '#4CAF50' : '#007bff',
        borderColor: $q.dark.isActive ? '#4CAF50' : '#007bff',
        borderWidth: 1
      }
    ]
  }
}

const updateSalesTimeframe = (value) => {
  inventoryStore.updateSalesTimeframe(value)
  rerenderSalesChart()
}

const renderSalesChart = async () => {
  if (salesTrendChart.value) {
    salesTrendChart.value.destroy()
  }

  const ctx = document.getElementById('salesTrendChart')
  if (!ctx) return

  const textColor = $q.dark.isActive ? '#ffffff' : '#000000'
  chartData.value = getChartData(selectedTimeframe.value)

  if (!chartData.value || !chartData.value.datasets[0].data.length) {
    return
  }

  salesTrendChart.value = new Chart(ctx, {
    type: 'bar',
    data: chartData.value,
    options: getChartOptions(textColor)
  })
}

const hasData = computed(() => {
  return chartData.value && 
         chartData.value.datasets && 
         chartData.value.datasets[0] && 
         chartData.value.datasets[0].data && 
         chartData.value.datasets[0].data.length > 0
})

const rerenderSalesChart = async () => {
  if (isRenderingSales.value) return
  isRenderingSales.value = true
  chartData.value = null

  try {
    // Add a small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 500))
    await renderSalesChart()
  } catch (error) {
    console.error('Error rendering sales chart:', error)
  } finally {
    isRenderingSales.value = false
  }
}

watch(() => inventoryStore.items, () => {
  rerenderSalesChart()
}, { deep: true })

watch(() => $q.dark.isActive, () => {
  rerenderSalesChart()
})

onMounted(async () => {
  await rerenderSalesChart()
})

onUnmounted(() => {
  if (salesTrendChart.value) {
    salesTrendChart.value.destroy()
  }
})
</script>

<style scoped>
.chart-card {
  height: 100%;
}

.chart-section {
  height: 100%;
}

.chart-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chart-container {
  flex-grow: 1;
  position: relative;
  min-height: 300px;
}

canvas {
  width: 100% !important;
  height: 100% !important;
}
</style>
