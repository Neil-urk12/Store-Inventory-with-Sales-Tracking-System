<script setup>
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import { useQuasar } from 'quasar'
import { useSalesStore } from 'src/stores/salesStore'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const $q = useQuasar()
const salesStore = useSalesStore()

const salesTrendChart = ref(null)
const chartData = ref(null)
const isRenderingSales = ref(false)
const selectedTimeframe = ref('daily')

const timeframeOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' }
]

const getChartOptions = async (textColor) => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: {
          color: textColor,
          autoSkip: true,
          maxRotation: 45,
          minRotation: 0
        },
        grid: {
          display: true,
          color: $q.dark.isActive ? '#5c5c5c' : '#e0e0e0'
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
      },
      tooltip: {
        enabled: true,
        mode: 'index',
        intersect: false,
        backgroundColor: $q.dark.isActive ? '#333' : '#fff',
        titleColor: $q.dark.isActive ? '#fff' : '#333',
        bodyColor: $q.dark.isActive ? '#fff' : '#333',
        borderColor: $q.dark.isActive ? '#555' : '#ccc',
        borderWidth: 1,
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(context.parsed.y);
            }
            return label;
          }
        }
      }
    }
  }
}

const getSalesDataByTimeframe = async (timeframe) => {
  if (salesStore.sales.length === 0)
    await salesStore.loadSales()

  const sales = computed(() => salesStore.sales)
  const salesRecords = sales.value || []

  const salesData = {}

  salesRecords.forEach(sale => {
    const date = new Date(sale.dateTimeframe)
    let key

    if (timeframe === 'daily')
      key = date.toLocaleDateString()
    else if (timeframe === 'weekly')
      key = 'Week ' + getWeekNumber(date)
    else if (timeframe === 'monthly')
      key = date.toLocaleString('default', { month: 'long', year: 'numeric' })
    else if (timeframe === 'yearly')
      key = date.getFullYear().toString()

    salesData[key] = salesData[key] || { total: 0, count: 0 }
    salesData[key].total += sale.total
    salesData[key].count++
  })

  return salesData
}

const getWeekNumber = (date) => {
  date = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  let yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  let weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7)

  return weekNo
}

const getChartData = async (timeframe) => {
  if (!timeframe) return null

  if (salesStore.sales.length === 0)
    await salesStore.loadSales()

  const salesData = await getSalesDataByTimeframe(timeframe)

  if (!salesData || Object.keys(salesData).length === 0)
    return null

  const labels = Object.keys(salesData)
  const data = Object.values(salesData).map(item => item.total)
  return {
    labels: labels,
    datasets: [
      {
        label: 'Sales',
        data: data,
        backgroundColor: $q.dark.isActive ? 'rgba(76, 175, 80, 0.2)' : 'rgba(0, 123, 255, 0.2)',
        borderColor: $q.dark.isActive ? '#4CAF50' : '#007bff',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }
    ]
  }
}

const updateSalesTimeframe = async (value) => {
  selectedTimeframe.value = value
  await rerenderSalesChart()
}

const renderSalesChart = async () => {
  if (salesTrendChart.value)
    salesTrendChart.value.destroy()

  const ctx = document.getElementById('salesTrendChart')
  if (!ctx) {
    return $q.notify({
      type: 'negative',
      message: 'Error: Canvas element not found.'
    })
  }

  const textColor = $q.dark.isActive ? '#ffffff' : '#000000'
  chartData.value = await getChartData(selectedTimeframe.value)

  if (!chartData.value || !chartData.value.datasets[0].data.length)
    return

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
    await new Promise(resolve => setTimeout(resolve, 500))
    await renderSalesChart()
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Error rendering sales chart: ' + error.message
    })
    console.error('Error rendering sales chart:', error)
  } finally {
    isRenderingSales.value = false
  }
}

watch(() => salesStore.sales, () => {
  rerenderSalesChart()
}, { deep: true })

watch(() => salesStore.sales, async (newSales) => {
  if (newSales.length > 0) {
    $q.notify({
      type: 'positive',
      message: 'Sales loaded successfully',
      position: 'bottom-right',
      timeout: 2000
    })
  } else {
    $q.notify({
      type: 'warning',
      message: 'No sales data available to display',
      position: 'bottom-right',
      timeout: 2000
    })
  }
}, { deep: true })

watch(() => $q.dark.isActive, () => {
  rerenderSalesChart()
})

onMounted(async () => {
  if (salesStore.sales.length === 0)
    await salesStore.initializeDb()
  await rerenderSalesChart()
})

onUnmounted(() => {
  if (salesTrendChart.value) {
    salesTrendChart.value.destroy()
  }
})
</script>

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
          <canvas v-show="hasData" id='salesTrendChart'></canvas>
          <div v-if="isRenderingSales" class="absolute-center">
            <q-spinner-dots size="40px" />
          </div>
          <div v-else-if="!hasData" class="absolute-center text-center">
            <q-icon name="show_chart" size="48px" color="grey-5" />
            <div class="text-grey-5 q-mt-sm">No sales data available for selected timeframe</div>
          </div>
        </div>
      </div>
    </q-card-section>
  </q-card>
</template>

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


</style>
