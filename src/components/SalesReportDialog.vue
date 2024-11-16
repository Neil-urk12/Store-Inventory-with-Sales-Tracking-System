<script setup>
import { ref, computed } from 'vue'
import { useQuasar } from 'quasar'
import { date } from 'quasar'
import { useInventoryStore } from '../stores/inventoryStore'

const $q = useQuasar()
const inventoryStore = useInventoryStore()

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

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

const updateSalesReportTimeframe = (value) => salesReportTimeframeFilter.value = value

const generateSalesReport = async () => {
  try {
    rawSalesData.value = await inventoryStore.generateSalesReport()
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
    'Product Name': item.productName,
    'Quantity Sold': item.quantitySold,
    'Revenue': item.revenue,
    'Sale Date': item.date
  }))
  inventoryStore.exportToCSV(salesData, 'sales-report')
}

// Call generateSalesReport when the dialog is opened
const onDialogShow = () => {
  generateSalesReport()
}
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