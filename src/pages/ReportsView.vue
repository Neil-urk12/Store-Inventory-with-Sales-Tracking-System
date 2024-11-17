<script setup>
import { ref, onMounted, computed, watch, onUnmounted, defineAsyncComponent } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useQuasar } from 'quasar'
import { useInventoryStore } from '../stores/inventoryStore'
const SalesReportDialog = defineAsyncComponent(() => import('../components/reports/SalesReportDialog.vue'))
const StockLevelsDialog = defineAsyncComponent(() => import('../components/reports/StockLevelsDialog.vue'))
const CashFlowDialog = defineAsyncComponent(() => import('../components/reports/CashFlowDialog.vue'))

Chart.register(...registerables)

const $q = useQuasar()
const textColor = computed(() => $q.dark.isActive ? '#ffffff' : '#000000')
const salesTrendChart = ref(null)
const categoryChart = ref(null)
const inventoryStore = useInventoryStore()
const stockModal = ref(false)
const salesReportDialog = ref(false)
const cashFlowDialog = ref(false)
const selectedPaymentMethod = ref('')

const selectedTimeframe = computed(() => inventoryStore.selectedTimeframe)

const timeframeOptions = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' }
]

const paymentMethods = [
  { label: 'Cash', value: 'Cash', icon: 'payments', color: 'positive' },
  { label: 'GCash', value: 'GCash', icon: 'phone_android', color: 'blue' },
  { label: 'Growsari', value: 'Growsari', icon: 'store', color: 'orange' }
]

const updateSalesTimeframe = (value) => inventoryStore.updateSalesTimeframe(value)

const isRenderingSales = ref(false)
const isRenderingCategory = ref(false)

const renderSalesChart = async () => {
  if (salesTrendChart.value) {
    salesTrendChart.value.destroy()
  }

  const ctx = document.getElementById('salesTrendChart')
  if (!ctx) return

  const textColor = $q.dark.isActive ? '#ffffff' : '#000000'

  salesTrendChart.value = new Chart(ctx, {
    type: 'bar',
    data: inventoryStore.getChartData(selectedTimeframe.value),
    options: inventoryStore.getChartOptions(textColor)
  })
}

const renderCategoryChart = async () => {
  if (categoryChart.value) {
    categoryChart.value.destroy()
  }

  const ctx = document.getElementById('categoryChart')
  if (!ctx) return

  const textColor = $q.dark.isActive ? '#ffffff' : '#000000'

  categoryChart.value = new Chart(ctx, {
    type: 'pie',
    data: inventoryStore.getCategoryChartData(),
    options: inventoryStore.getCategoryChartOptions(textColor)
  })
}

const rerenderSalesChart = async () => {
  if (isRenderingSales.value) return
  isRenderingSales.value = true

  try {
    await renderSalesChart()
  } finally {
    isRenderingSales.value = false
  }
}

const rerenderCategoryChart = async () => {
  if (isRenderingCategory.value) return
  isRenderingCategory.value = true

  try {
    await renderCategoryChart()
  } finally {
    isRenderingCategory.value = false
  }
}

const openCashFlow = (method) => {
  selectedPaymentMethod.value = method
  cashFlowDialog.value = true
}

watch(() => $q.dark.isActive, async () => {
  await renderSalesChart()
  await renderCategoryChart()
})

onMounted(async () => {
  await renderSalesChart()
  await renderCategoryChart()
})

onUnmounted(() => {
  if (salesTrendChart.value) salesTrendChart.value.destroy()
  if (categoryChart.value) categoryChart.value.destroy()
})

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
</script>

<template>
  <q-page padding>
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6 col-lg-4">
        <q-card class="report-card bg-transparent">
          <q-card-section>
            <div class="section-containers full-width row wrap justify-evenly items-center content-start">
              <div class="sales">
                <div class="text-h6" :style="textColor">Sales Reports</div>
                <q-btn color="primary" label="Generate Sales Report" @click="salesReportDialog = true" class="q-mt-sm" />
              </div>
              <div class="financial">
                <div class="text-h6" :style="textColor">Stock Reports</div>
                <q-btn color="primary" label="View Stock Levels" @click="viewStockLevels" class="q-mt-sm" />
              </div>
              <div class="cash-flow">
                <div class="text-h6" :style="textColor">Cash Flow Reports</div>
                <q-btn-group spread>
                  <q-btn v-for="method in paymentMethods" :key="method.value" :color="method.color" :icon="method.icon" @click="openCashFlow(method.value)" class="q-mt-sm" />
                </q-btn-group>
              </div>
            </div>
          </q-card-section>
          <q-card-section>
            <div class="chart-wrapper">
              <div class="row q-ma-none items-center">
                <q-btn
                  round
                  color="primary"
                  :loading="isRenderingCategory"
                  :disable="isRenderingCategory"
                  @click="rerenderCategoryChart"
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
              </div>
              <div class="chart-container">
                <div v-if="isRenderingCategory" class="absolute-center">
                  <q-spinner-dots size="40px" />
                </div>
                <canvas id="categoryChart"></canvas>
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
          </q-card-section>
        </q-card>
      </div>
    </div>
    <SalesReportDialog v-model="salesReportDialog" />
    <StockLevelsDialog v-model="stockModal" />
    <CashFlowDialog
      v-model="cashFlowDialog"
      :selected-payment-method="selectedPaymentMethod"
    />
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

.sales, .financial, .cash-flow {
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
</style>
