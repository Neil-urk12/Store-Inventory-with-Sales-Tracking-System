<script setup>
import { ref, computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { date } from 'quasar'
import { useInventoryStore } from 'src//stores/inventoryStore'
import { useSalesStore } from 'src/stores/salesStore'

const $q = useQuasar()
const inventoryStore = useInventoryStore()
const salesStore = useSalesStore()

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

const salesReportColumns = [
  {
    name: 'date',
    label: 'Date',
    field: 'date',
    align: 'left',
    sortable: true,
    format: val => date.formatDate(val, 'MM/DD/YYYY')
  },
  {
    name: 'cashProfit',
    label: 'Total Cash Profits',
    field: 'Cash Profits',
    align: 'right',
    sortable: true
  },
  {
    name: 'gcashProfit',
    label: 'Total Gcash Profits',
    field: 'Gcash Profits',
    align: 'right',
    sortable: true
  },
  {
    name: 'growsariProfit',
    label: 'Growsari Profits',
    field: 'Growsari Profits',
    align: 'right',
    sortable: true
  },
  {
    name: 'totalProfit',
    label: 'Total Profits',
    field: 'Total Profits',
    align: 'right',
    sortable: true
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

const updateSalesReportTimeframe = (value) => salesReportTimeframeFilter.value = value

const generateSalesReport = async () => {
  try {
    rawSalesData.value = await salesStore.generateSalesReport()
    console.log(rawSalesData.value)
  } catch (error) {
    $q.notify({
      color: 'negative',
      message: 'Failed to generate sales report',
      icon: 'error'
    })
  }
}

const exportSalesReport = () => {
  const salesData = filteredSalesData.value.map(item => ({
    'Date': date.formatDate(item.date, 'MM/DD/YYYY'),
    'Cash Profits': item.cashProfit,
    'Gcash Profits': item.gcashProfit,
    'Growsari Profits': item.growsariProfit
  }))
  inventoryStore.exportToCSV(salesData, 'sales-report')
}

// Call generateSalesReport when the dialog is opened
const onDialogShow = () => {
  generateSalesReport()
}

onMounted (() => {
  if(salesStore.sales.length === 0)
    salesStore.initializeDb()
})
</script>

<template>
  <q-dialog
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    @show="onDialogShow"
  >
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
        <q-btn
          icon="close"
          flat
          round
          dense
          v-close-popup
        />
      </q-card-section>

      <q-card-section class="col q-pa-md">
        <q-table
          :rows="filteredSalesData"
          :columns="salesReportColumns"
          no-data-label="No sales data available for this period."
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
                v-for="(col, index) in props.cols"
                :key="col.name"
                :props="props"
              >{{ col.name === 'date' ? date.formatDate(props.row.date, 'MM/DD/YYYY') : props.row[col.field] }}
              </q-td>
            </q-tr>
          </template>
        </q-table>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.sticky-column {
  position: sticky;
  left: 0;
  z-index: 2;
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
