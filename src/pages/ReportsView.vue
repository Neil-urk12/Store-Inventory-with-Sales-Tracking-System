<script setup>
import { ref, onMounted, computed, watch, onUnmounted, defineAsyncComponent } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useQuasar } from 'quasar'
import { useInventoryStore } from '../stores/inventoryStore'
import { useFinancialStore } from '../stores/financialStore'
const SalesReportDialog = defineAsyncComponent(() => import('../components/reports/SalesReportDialog.vue'))
const StockLevelsDialog = defineAsyncComponent(() => import('../components/reports/StockLevelsDialog.vue'))
const CashFlowDialog = defineAsyncComponent(() => import('../components/reports/CashFlowDialog.vue'))
const SalesChart = defineAsyncComponent(() => import('../components/reports/SalesChart.vue'))

Chart.register(...registerables)

const $q = useQuasar()
const textColor = computed(() => $q.dark.isActive ? '#ffffff' : '#000000')
const categoryChart = ref(null)
const inventoryStore = useInventoryStore()
const financialStore = useFinancialStore()
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

const isRenderingCategory = ref(false)

const getCategoryChartData = () => {
  // Group items by category and calculate total sales
  const categoryData = inventoryStore.items.reduce((acc, item) => {
    if (!acc[item.category])
      acc[item.category] = 0
    // Assuming each item's sales contribution is quantity * price
    acc[item.category] += item.quantity * item.price
    return acc
  }, {})
  const labels = Object.keys(categoryData).map(category =>
    category.charAt(0).toUpperCase() + category.slice(1)
  )
  const data = Object.values(categoryData)

  const colors = [
    '#FF6384',
    '#36A2EB',
    '#FFCE56',
    '#4BC0C0',
    '#9966FF',
    '#FF9F40'
  ]

  return {
    labels,
    datasets: [{
      data,
      backgroundColor: colors.slice(0, labels.length),
      hoverBackgroundColor: colors.slice(0, labels.length)
    }]
  }
}

const getCategoryChartOptions = (textColor) => {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: textColor,
          font: {
            size: 12
          }
        }
      },
      title: {
        display: true,
        text: 'Sales by Category',
        color: textColor,
        font: {
          size: 16
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const label = context.label || ''
            const value = context.raw || 0
            const total = context.dataset.data.reduce((a, b) => a + b, 0)
            const percentage = ((value / total) * 100).toFixed(1)
            return `${label}: ${financialStore.formatCurrency(value)} (${percentage}%)`
          }
        }
      }
    }
  }
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
    data: getCategoryChartData(),
    options: getCategoryChartOptions(textColor)
  })
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

watch(() => inventoryStore.items, async () => {
  await renderCategoryChart()
}, { deep: true })

watch(() => $q.dark.isActive, async () => {
  await renderCategoryChart()
})

onMounted(async () => {
  await inventoryStore.loadInventory()
  await renderCategoryChart()
})

onUnmounted(() => {
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
    <div class="row q-col-gutter-xl">
      <div class="col-12 col-md-6">
        <q-card class="report-card">
          <q-card-section>
            <div class="section-containers row q-col-gutter-md justify-start items-stretch">
              <div class="col-12 col-sm-4">
                <div class="report-section">
                  <div class="text-h6 q-mb-sm" :style="textColor">Sales Reports</div>
                  <q-btn
                    color="primary"
                    label="Generate Report"
                    @click="salesReportDialog = true"
                    class="full-width"
                    icon="assessment"
                  />
                </div>
              </div>
              <div class="col-12 col-sm-4">
                <div class="report-section">
                  <div class="text-h6 q-mb-sm" :style="textColor">Stock Reports</div>
                  <q-btn
                    color="primary"
                    label="View Stock"
                    @click="viewStockLevels"
                    class="full-width"
                    icon="inventory"
                  />
                </div>
              </div>
              <div class="col-12 col-sm-4">
                <div class="report-section">
                  <div class="text-h6 q-mb-sm" :style="textColor">Cash Flow</div>
                  <div class="row q-col-gutter-sm">
                    <div v-for="method in paymentMethods" :key="method.value" class="col-4">
                      <q-btn
                        :color="method.color"
                        :icon="method.icon"
                        @click="openCashFlow(method.value)"
                        class="full-width"
                        square
                      >
                        <q-tooltip>{{ method.label }}</q-tooltip>
                      </q-btn>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </q-card-section>
          <q-card-section>
            <div class="chart-wrapper q-pt-md">
              <div class="row items-center justify-between q-mb-md">
                <div class="text-h6" :style="textColor">Category Distribution</div>
                <q-btn
                  round
                  flat
                  color="primary"
                  :loading="isRenderingCategory"
                  :disable="isRenderingCategory"
                  @click="rerenderCategoryChart"
                  icon="refresh"
                >
                  <q-tooltip>Refresh Chart</q-tooltip>
                  <template v-slot:loading>
                    <q-spinner-dots />
                  </template>
                </q-btn>
              </div>
              <div class="chart-container">
                <div v-if="isRenderingCategory" class="absolute-center">
                  <q-spinner-dots size="40px" color="primary"/>
                </div>
                <div v-else-if="!inventoryStore.items.length" class="absolute-center text-center">
                  <q-icon name="bar_chart" size="48px" color="grey-5" />
                  <div class="text-grey-5 q-mt-sm">No category data available</div>
                </div>
                <canvas v-else id="categoryChart"></canvas>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <SalesChart class="full-height" />
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
  transition: all 0.3s ease;
}

.report-section {
  padding: 1rem;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.03);
  height: 100%;
}

.dark .report-section {
  background: rgba(255, 255, 255, 0.05);
}

.chart-wrapper {
  position: relative;
}

.chart-container {
  position: relative;
  height: 400px;
  width: 100%;
}

.q-btn {
  transition: transform 0.2s ease;
}

.q-btn:hover {
  transform: translateY(-2px);
}

@media (max-width: 599px) {
  .report-section {
    margin-bottom: 1rem;
  }

  .chart-container {
    height: 300px;
  }
}
</style>
