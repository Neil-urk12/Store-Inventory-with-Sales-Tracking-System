<script setup>
import { ref, onMounted, computed, watch, nextTick, onUnmounted } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useQuasar } from 'quasar'
import { useInventoryStore } from '../stores/inventoryStore'

Chart.register(...registerables)

const $q = useQuasar()
const textColor = computed(() => $q.dark.isActive ? '#ffffff' : '#000000')
const salesTrendChart = ref(null)
const profitTrendChart = ref(null)
const inventoryStore = useInventoryStore()
const stockModal = ref(false)
const filter = ref('')
const pagination = ref({
  sortBy: 'name',
  descending: false,
  page: 1,
  rowsPerPage: 5,
})

const selectedTimeframe = computed(() => inventoryStore.selectedTimeframe)
const profitTimeframe = computed(() => inventoryStore.profitTimeframe)

const timeframeOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' }
]

const createComboChart = (canvasId, title, timeframe) => {
  const canvas = document.getElementById(canvasId)
  if (!canvas) return null

  const ctx = canvas.getContext('2d')
  const chartData = inventoryStore.getChartData(timeframe)
  const chartOptions = inventoryStore.getChartOptions(textColor.value)

  return new Chart(ctx, {
    type: 'bar',
    data: chartData,
    options: chartOptions
  })
}

const updateSalesTimeframe = (value) => {
  inventoryStore.updateSalesTimeframe(value)
}

const updateProfitTimeframe = (value) => {
  inventoryStore.updateProfitTimeframe(value)
}

const isRenderingSales = ref(false)
const isRenderingProfit = ref(false)

const rerenderSalesChart = async () => {
  if (isRenderingSales.value) return
  isRenderingSales.value = true

  try {
    if (salesTrendChart.value) {
      salesTrendChart.value.destroy()
    }
    await nextTick()
    salesTrendChart.value = createComboChart('salesTrendChart', 'Sales Trend', selectedTimeframe.value)
  } finally {
    isRenderingSales.value = false
  }
}

const rerenderProfitChart = async () => {
  if (isRenderingProfit.value) return
  isRenderingProfit.value = true

  try {
    if (profitTrendChart.value) {
      profitTrendChart.value.destroy()
    }
    await nextTick()
    profitTrendChart.value = createComboChart('profitTrendChart', 'Profit Trend', profitTimeframe.value)
  } finally {
    isRenderingProfit.value = false
  }
}

watch(selectedTimeframe, rerenderSalesChart)
watch(profitTimeframe, rerenderProfitChart)
watch(textColor, () => {
  rerenderSalesChart()
  rerenderProfitChart()
})

onMounted(() => {
  salesTrendChart.value = createComboChart('salesTrendChart', 'Sales Trend', selectedTimeframe.value)
  profitTrendChart.value = createComboChart('profitTrendChart', 'Profit Trend', profitTimeframe.value)
})

onUnmounted(() => {
  if (salesTrendChart.value) {
    salesTrendChart.value.destroy()
  }
  if (profitTrendChart.value) {
    profitTrendChart.value.destroy()
  }
})

const stockColumns = [
  {
    name: 'name',
    label: 'Product Name',
    field: 'name',
    align: 'left',
    sortable: true,
    style: 'position: sticky; left: 0; z-index: 2;',
    classes: $q.dark.isActive ? 'bg-dark sticky-column' : 'bg-grey-2 sticky-column'
  },
  { name: 'current stock', label: 'Current Stock', field: 'current stock', align: 'left', sortable: true },
  { name: 'dead stock', label: 'Dead Stock', field: 'dead stock', align: 'left', sortable: true },
  {
    name: 'lastUpdated',
    label: 'Last Updated',
    field: 'lastUpdated',
    align: 'left',
    sortable: true
  }
]

const category = ref(null)
const categoryFilter = ref(null)
const categories = [
  { label: 'Electronics', value: 'electronics' },
  { label: 'Clothing', value: 'clothing' },
  { label: 'Books', value: 'books' }
]

const filteredStockData = computed(() => {
  let result = [...inventoryStore.stockData]
  if (categoryFilter.value) {
    result = result.filter(item => {
      const stockItem = inventoryStore.items.find(i => i.name === item.name)
      return stockItem && stockItem.category === categoryFilter.value
    })
  }
  return result
})

const handleCategoryFilter = () => categoryFilter.value = category.value


const sortStockData = (column, order) => inventoryStore.sortInventory(column, order)


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

const salesReportDialog = ref(false)
const salesReportColumns = [
  {
    name: 'productName',
    label: 'Product Name',
    field: 'productName',
    align: 'left',
    sortable: true,
    style: 'position: sticky; left: 0; z-index: 2;',
    classes: $q.dark.isActive ? 'bg-dark sticky-column' : 'bg-grey-2 sticky-column'
  },
  { name: 'quantitySold', label: 'Quantity Sold', field: 'quantitySold', align: 'right', sortable: true },
  { name: 'revenue', label: 'Revenue', field: 'revenue', align: 'right', sortable: true },
  {
    name: 'date',
    label: 'Sale Date',
    field: 'date',
    align: 'left',
    sortable: true,
    format: val => date.formatDate(new Date(), 'MM/DD/YYYY')
  }
]
const rawSalesData = ref([])
const salesReportTimeframe = ref(null)
const salesReportTimeframeFilter = ref(null)
const salesReportTimeframeOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' }
]

const filteredSalesData = computed(() => {
  let result = [...rawSalesData.value]
  if (salesReportTimeframeFilter.value) {
    const currentDate = new Date()
    result = result.filter(item => {
      const saleDate = new Date(item.date)
      switch (salesReportTimeframeFilter.value) {
        case 'daily':
          return saleDate.toDateString() === currentDate.toDateString()
        case 'weekly':
          const weekAgo = new Date(currentDate)
          weekAgo.setDate(currentDate.getDate() - 7)
          return saleDate >= weekAgo
        case 'monthly':
          return saleDate.getMonth() === currentDate.getMonth() &&
                 saleDate.getFullYear() === currentDate.getFullYear()
        case 'yearly':
          return saleDate.getFullYear() === currentDate.getFullYear()
        default:
          return true
      }
    })
  }
  return result
})

const updateSalesReportTimeframe = (value) =>salesReportTimeframeFilter.value = value

const generateSalesReport = async () => {
  try {
    rawSalesData.value = await inventoryStore.generateSalesReport()
    salesReportDialog.value = true
  } catch (error) {
    $q.notify({
      color: 'negative',
      message: 'Failed to generate sales report',
      icon: 'error'
    })
  }
}

const exportStockData = () => {
  const stockData = inventoryStore.stockData.map(item => ({
    'Product Name': item.name,
    'Current Stock': item['current stock'],
    'Dead Stock': item['dead stock'],
    'Last Updated': item.lastUpdated
  }));
  inventoryStore.exportToCSV(stockData, 'stock-levels-report');
};

const exportSalesReport = () => {
  const salesData = filteredSalesData.value.map(item => ({
    'Product Name': item.productName,
    'Quantity Sold': item.quantitySold,
    'Revenue': item.revenue,
    'Sale Date': item.date
  }));
  inventoryStore.exportToCSV(salesData, 'sales-report');
};
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
                <q-btn color="primary" label="Generate Sales Report" @click="generateSalesReport" class="q-mt-sm" />
              </div>
              <div class="financial">
                <div class="text-h6" :style="textColor">Stock Reports</div>
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
                    <q-item v-for="option in timeframeOptions" :key="option.value" clickable v-close-popup @click="updateSalesTimeframe(option.value)">
                      <q-item-section>{{ option.label }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-btn-dropdown>
              </div>
              <div class="chart-container">
                <div v-if="isRenderingSales" class="absolute-center">
                  <q-spinner-dots size="40px" />
                </div>
                <canvas id="salesTrendChart"></canvas>
              </div>
            </div>
            <div class="chart-wrapper">
              <div class="row q-ma-none items-center">
                <q-btn
                  round
                  color="primary"
                  :loading="isRenderingProfit"
                  :disable="isRenderingProfit"
                  @click="rerenderProfitChart"
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
                  :label="'Profit: ' + profitTimeframe"
                  class="q-mr-md"
                  :disable="isRenderingProfit"
                >
                  <q-list>
                    <q-item v-for="option in timeframeOptions" :key="option.value" clickable v-close-popup @click="updateProfitTimeframe(option.value)">
                      <q-item-section>{{ option.label }}</q-item-section>
                    </q-item>
                  </q-list>
                </q-btn-dropdown>
              </div>
              <div class="chart-container">
                <div v-if="isRenderingProfit" class="absolute-center">
                  <q-spinner-dots size="40px" />
                </div>
                <canvas id="profitTrendChart"></canvas>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>
    <q-dialog v-model="stockModal">
      <q-card>
        <q-card-section class="row items-center">
          <div class="text-h6">Stock Levels</div>
          <q-space />
          <q-select
            v-model="category"
            :options="categories"
            label="Category"
            outlined
            dense
            class="q-mx-md"
            style="min-width: 200px"
            emit-value
            map-options
            clearable
            @update:model-value="handleCategoryFilter"
          />
          <q-btn
            color="primary"
            icon="file_download"
            label="Export CSV"
            @click="exportStockData"
            class="q-ml-sm"
          />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <q-table
            :rows="filteredStockData"
            :columns="stockColumns"
            row-key="name"
            :filter="filter"
            no-data-label="I didn't find anything for you"
            v-model:pagination="pagination"
            :loading="inventoryStore.loading"
            :rows-per-page-options="[5, 10, 15, 20]"
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
    <q-dialog v-model="salesReportDialog">
      <q-card style="width: 900px; max-width: 90vw;">
        <q-card-section class="row items-center q-pb-none">
          <div class="text-h6">Sales Report</div>
          <q-space />
          <q-select
            v-model="salesReportTimeframe"
            :options="salesReportTimeframeOptions"
            label="Time Range"
            outlined
            dense
            class="q-mx-md"
            emit-value
            map-options
            clearable
            @update:model-value="updateSalesReportTimeframe"
          />
          <q-btn
            color="primary"
            icon="file_download"
            label="Export CSV"
            @click="exportSalesReport"
            class="q-mr-sm"
          />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section class="col q-pa-md">
          <q-table
            :rows="filteredSalesData"
            :columns="salesReportColumns"
            no-data-label="I didn't find anything for you"
            row-key="productName"
            :pagination="{ rowsPerPage: 10 }"
            flat
            class="fit"
            :rows-per-page-options="[5, 10, 15, 20]"
            virtual-scroll
          >
            <template v-slot:header="props">
              <q-tr :props="props">
                <q-th
                  v-for="col in props.cols"
                  :key="col.name"
                  :props="props"
                  class="text-weight-bold"
                >
                  {{ col.label }}
                </q-th>
              </q-tr>
            </template>

            <template v-slot:body="props">
              <q-tr :props="props">
                <q-td
                  v-for="col in props.cols"
                  :key="col.name"
                  :props="props"
                >
                  <template v-if="col.name === 'price' || col.name === 'total'">
                    {{ inventoryStore.formatCurrency(props.row[col.name]) }}
                  </template>
                  <template v-else>
                    {{ props.row[col.name] }}
                  </template>
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
  min-height: 300px;
}
:deep(.q-table) {
  color: var(--q-primary-text-color);
}
@media (max-width: 600px) {
  .chart-container {
    height: 250px;
  }
}

.sticky-column {
  transition: background-color 0.3s ease;
}

:deep(.q-table__grid-content) {
  overflow-x: auto !important;
}

/* Add box shadow for better visual separation */
:deep(.sticky-column) {
  box-shadow: 4px 0 6px -2px rgba(0, 0, 0, 0.1);
}

/* Dark mode specific styles */
.body--dark :deep(.sticky-column) {
  box-shadow: 4px 0 6px -2px rgba(255, 255, 255, 0.1);
}
</style>
