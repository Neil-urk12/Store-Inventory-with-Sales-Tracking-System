<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useQuasar } from 'quasar'
import { useInventoryStore } from '../stores/inventoryStore' // Assuming inventory data is here

Chart.register(...registerables)

const $q = useQuasar()
const textColor = computed(() => $q.dark.isActive ? '#ffffff' : '#000000')
const salesTrendChart = ref(null)
const profitTrendChart = ref(null)
const selectedTimeframe = ref('weekly')
const inventoryStore = useInventoryStore()
const stockModal = ref(false)
const stockColumns = [
  { name: 'name', label: 'Product Name', field: 'name', align: 'left', sortable: true },
  { name: 'current stock', label: 'Current Stock', field: 'current stock', align: 'left', sortable: true },
  { name: 'dead stock', label: 'Dead Stock', field: 'dead stock', align: 'left', sortable: true }
]

const timeframeOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' }
]

const chartData = {
  daily: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    sales: [30, 40, 50, 60, 70, 80, 90],
    expenses: [20, 30, 40, 50, 60, 70, 80]
  },
  weekly: {
    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
    sales: [150, 200, 250, 300],
    expenses: [100, 150, 200, 250]
  },
  monthly: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    sales: [700, 800, 900, 1000, 1100, 1200],
    expenses: [500, 600, 700, 800, 900, 1000]
  },
  yearly: {
    labels: ['2020', '2021', '2022', '2023'],
    sales: [5000, 6000, 7000, 8000],
    expenses: [4000, 5000, 6000, 7000]
  }
}

const createComboChart = (canvasId, title) => {
  const ctx = document.getElementById(canvasId)
  const currentTextColor = $q.dark.isActive ? '#ffffff' : '#000000'

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: chartData.weekly.labels,
      datasets: [
        {
          label: 'Sales',
          data: chartData.weekly.sales,
          type: 'line',
          borderColor: '#42A5F5',
          fill: false,
          tension: 0.1
        },
        {
          label: 'Expenses',
          data: chartData.weekly.expenses,
          type: 'bar',
          backgroundColor: '#FF6384'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: currentTextColor
          }
        },
        title: {
          display: true,
          text: title,
          color: currentTextColor
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: currentTextColor
          },
          grid: {
            color: currentTextColor + '20'
          }
        },
        x: {
          ticks: {
            color: currentTextColor
          },
          grid: {
            color: currentTextColor + '20'
          }
        }
      }
    }
  })
}

const showResults = ref({
  columns : [
    {
      name: 'name',
      required: true,
      label: 'Dessert (100g serving)',
      align: 'left',
      field: row => row.name,
      format: val => `${val}`,
      sortable: true
    },
    { name: 'calories', align: 'center', label: 'Calories', field: 'calories', sortable: true },
    { name: 'fat', label: 'Fat (g)', field: 'fat', sortable: true },
    { name: 'carbs', label: 'Carbs (g)', field: 'carbs' },
    { name: 'protein', label: 'Protein (g)', field: 'protein' },
    { name: 'sodium', label: 'Sodium (mg)', field: 'sodium' },
    { name: 'calcium', label: 'Calcium (%)', field: 'calcium', sortable: true, sort: (a, b) => parseInt(a, 10) - parseInt(b, 10) },
    { name: 'iron', label: 'Iron (%)', field: 'iron', sortable: true, sort: (a, b) => parseInt(a, 10) - parseInt(b, 10) }
  ],
  rows : [
    {
      name: 'Frozen Yogurt',
      calories: 159,
      fat: 6.0,
      carbs: 24,
      protein: 4.0,
      sodium: 87,
      calcium: '14%',
      iron: '1%'
    },
    {
      name: 'Ice cream sandwich',
      calories: 237,
      fat: 9.0,
      carbs: 37,
      protein: 4.3,
      sodium: 129,
      calcium: '8%',
      iron: '1%'
    },
    {
      name: 'Eclair',
      calories: 262,
      fat: 16.0,
      carbs: 23,
      protein: 6.0,
      sodium: 337,
      calcium: '6%',
      iron: '7%'
    },
    {
      name: 'Cupcake',
      calories: 305,
      fat: 3.7,
      carbs: 67,
      protein: 4.3,
      sodium: 413,
      calcium: '3%',
      iron: '8%'
    },
    {
      name: 'Gingerbread',
      calories: 356,
      fat: 16.0,
      carbs: 49,
      protein: 3.9,
      sodium: 327,
      calcium: '7%',
      iron: '16%'
    },
    {
      name: 'Jelly bean',
      calories: 375,
      fat: 0.0,
      carbs: 94,
      protein: 0.0,
      sodium: 50,
      calcium: '0%',
      iron: '0%'
    },
    {
      name: 'Lollipop',
      calories: 392,
      fat: 0.2,
      carbs: 98,
      protein: 0,
      sodium: 38,
      calcium: '0%',
      iron: '2%'
    },
    {
      name: 'Honeycomb',
      calories: 408,
      fat: 3.2,
      carbs: 87,
      protein: 6.5,
      sodium: 562,
      calcium: '0%',
      iron: '45%'
    },
    {
      name: 'Donut',
      calories: 452,
      fat: 25.0,
      carbs: 51,
      protein: 4.9,
      sodium: 326,
      calcium: '2%',
      iron: '22%'
    },
    {
      name: 'KitKat',
      calories: 518,
      fat: 26.0,
      carbs: 65,
      protein: 7,
      sodium: 54,
      calcium: '12%',
      iron: '6%'
    }
  ]
})


const qSelectRef = ref(null)
const qSelectRef2 = ref(null)

const isUpdating = ref(false)
let updateTimeout = null

watch(() => $q.dark.isActive, async () => {
  if (updateTimeout) clearTimeout(updateTimeout)
  if (isUpdating.value) return
  isUpdating.value = true
  await nextTick()
  if (salesTrendChart.value) salesTrendChart.value.destroy()
  if (profitTrendChart.value) profitTrendChart.value.destroy()
  salesTrendChart.value = createComboChart('salesTrendChart', 'Sales Performance')
  profitTrendChart.value = createComboChart('profitTrendChart', 'Profit Analysis')

  updateTimeout = setTimeout(() => {
    isUpdating.value = false
  }, 100)
})

const updateCharts = () => {
  const currentData = chartData[selectedTimeframe.value]

  if (salesTrendChart.value && profitTrendChart.value) {
    salesTrendChart.value.data.labels = currentData.labels
    salesTrendChart.value.data.datasets[0].data = currentData.sales
    salesTrendChart.value.data.datasets[1].data = currentData.expenses
    profitTrendChart.value.data.labels = currentData.labels
    profitTrendChart.value.data.datasets[0].data = currentData.sales
    profitTrendChart.value.data.datasets[1].data = currentData.expenses
    salesTrendChart.value.update()
    profitTrendChart.value.update()
  }
}

const exportReport = () => {

}

const generateFinancialReport = () => {

}

const generateSalesReport = () => {

}

const category = ref([

])

const sortStockData = (column, order) => {
  inventoryStore.sortInventory(column, order)
}

const viewStockLevels = () => {
  if (inventoryStore.stockData.length === 0) {
    $q.notify({
      type: 'negative',
      message: 'No stock data available.'
    })
    return
  }
  stockModal.value = true
}

onMounted(() => {
  salesTrendChart.value = createComboChart('salesTrendChart', 'Sales Performance')
  profitTrendChart.value = createComboChart('profitTrendChart', 'Profit Analysis')
})
</script>

<template>
  <q-page padding>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6 col-lg-4">
        <q-card class="report-card bg-transparent">
          <q-card-section>
            <div class="section-containers full-width row wrap justify-evenly items-center content-start">
              <div class="sales ">
                <div class="text-h6" :style="textColor">Sales Reports</div>
                <q-select ref="qSelectRef2" :dark="$q.dark.isActive" v-model="selectedTimeframe" :options="timeframeOptions" label="Time Range" outlined dense class="q-mb-md" @update:model-value="updateCharts" />
                <q-btn color="primary" label="Generate Sales Report" @click="generateSalesReport" class="q-mt-sm" />
              </div>
              <div class="financial">
                <div class="text-h6" :style="textColor">Financial Analysis</div>
                <q-select ref="qSelectRef" :dark="$q.dark.isActive" v-model="category" :options="categoryOptions" label="Category" />
                <q-btn color="primary" label="View Stock Levels" @click="viewStockLevels" class="q-mt-sm" />
              </div>
              <div class="financial-analysis full-width column items-center">
                <div class="text-h6" :style="textColor">Financial Analysis by Date Range</div>
                <q-date v-model="dateRange" :style="{ color: $q.dark.isActive? 'white' : 'black' }" range />
                <q-btn color="positive" label="Generate Financial Report" @click="generateFinancialReport" class="q-mt-sm" />
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <q-card class="chart-card bg-transparent">
          <q-card-section class="chart-section">
            <div class="chart-wrapper">
              <div class="row q-mb-md items-center">
                <q-btn color="primary" label="Rerender Sales Chart" @click="rerenderSalesChart" class="q-mr-md"/>
                <q-btn-dropdown flat color="primary" :label="'Sales: ' + salesTimeframe" class="q-mr-md" :dark="$q.dark.isActive">
                  <q-list>
                    <q-item v-for="option in timeframeOptions" :key="option.value" clickable v-close-popup @click="updateSalesTimeframe(option.value)">
                      <q-item-section>{{ option.label }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-btn-dropdown>
              </div>
              <div class="chart-container">
                <canvas id="salesTrendChart"></canvas>
              </div>
            </div>
            <div class="chart-wrapper">
              <div class="row q-mb-md items-center">
                <q-btn color="primary" label="Rerender Profit Chart" @click="rerenderProfitChart" class="q-mr-md"/>
                <q-btn-dropdown flat bg- color="primary" :label="'Profit: ' + profitTimeframe" class="q-mr-md">
                  <q-list>
                    <q-item v-for="option in timeframeOptions" :key="option.value" clickable v-close-popup @click="updateProfitTimeframe(option.value)">
                      <q-item-section>{{ option.label }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-btn-dropdown>
              </div>
              <div class="chart-container">
                <canvas id="profitTrendChart"></canvas>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
    <q-table
      v-if="showResults"
      :rows="showResults.rows"
      :columns="showResults.columns"
      row-key="id"
      class="q-mt-md"
    >
      <template v-slot:top>
        <div class="q-table__title">{{ reportTitle }}</div>
        <q-space />
        <q-btn color="primary" icon="download" label="Export" @click="exportReport" />
      </template>
    </q-table>


    <q-dialog v-model="stockModal">
      <q-card>
        <q-card-section class="row items-center">
          <div class="text-h6">Stock Levels</div>
          <q-space />
          <q-btn flat round dense icon="close" v-close-popup />
        </q-card-section>

        <q-card-section>
          <q-table
            :rows="inventoryStore.stockData"
            :columns="stockColumns"
            row-key="name"
            :filter="filter"
            :pagination.sync="pagination"
            :loading="loading"
            class="my-table"
          >
            <template v-slot:header="props">
              <q-tr :props="props">
                <q-th v-for="col in props.cols" :key="col.name" :props="props">
                  <div class="text-weight-bold text-grey-8">
                    <q-btn
                      flat
                      dense
                      size="sm"
                      :color="col.name === inventoryStore.sortBy ? (inventoryStore.sortDirection === 'asc' ? 'primary' : 'negative') : ''"
                      @click="sortStockData(col.name, col.name === inventoryStore.sortBy ? (inventoryStore.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc')"
                    >
                      {{ col.label }}
                      <q-icon :name="col.name === inventoryStore.sortBy ? (inventoryStore.sortDirection === 'asc' ? 'arrow_drop_up' : 'arrow_drop_down') : ''" />
                    </q-btn>
                  </div>
                </q-th>
              </q-tr>
            </template>
            <template v-slot:body="props">
              <q-tr :props="props">
                <q-td v-for="col in props.cols" :key="col.name" :props="props">
                  {{ props.row[col.name] }}
                </q-td>
              </q-tr>
            </template>
          </q-table>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.report-card {
  height: 100%;
  min-height: 250px;
  color: var(--q-primary-text-color)
}
.q-table__title {
  font-size: 1.2em;
  font-weight: 500
}
.sales, .financial {
  overflow: auto
}
.chart-card {
  height: 100%;
  min-height: 400px;
  border-radius: 8px;
}
.chart-container {
  position: relative;
  height: 250px;
  width: 100%;
}
:deep(.q-table) {
  color: var(--q-primary-text-color);
}
@media (max-width: 600px) {
  .chart-container {
    height: 250px;
  }
}
</style>
