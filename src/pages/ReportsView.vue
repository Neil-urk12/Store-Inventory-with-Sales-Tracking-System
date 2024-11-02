
<template>
  <q-page class="flex flex-center">
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6 col-lg-4">
        <q-card class="my-card">
          <q-card-section>
            <div class="text-h6">Inventory Report</div>
          </q-card-section>
          <q-card-section>
            <q-btn color="primary" label="Generate Report" @click="generateInventoryReport" />
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <q-card class="my-card">
          <q-card-section>
            <div class="text-h6">Sales Report</div>
          </q-card-section>
          <q-card-section>
            <q-btn color="primary" label="Generate Report" @click="generateSalesReport" />
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6 col-lg-4">
        <q-card class="my-card">
          <q-card-section>
            <div class="text-h6">Purchase Report</div>
          </q-card-section>
          <q-card-section>
            <q-btn color="primary" label="Generate Report" @click="generatePurchaseReport" />
          </q-card-section>
        </q-card>
      </div>
    </div>
    <q-dialog v-model="showReportDialog" full-width>
      <q-card>
        <q-card-section>
          <div class="text-h6">{{ reportTitle }}</div>
        </q-card-section>
        <q-card-section>
          <q-table :rows="reportData" :columns="reportColumns" row-key="name" />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat label="Close" color="primary" v-close-popup />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<script setup>
import { ref, computed } from 'vue'

const showReportDialog = ref(false)
const reportTitle = ref('')
const reportData = ref([])
const reportColumns = ref([
  { name: 'name', label: 'Name', field: 'name' },
  { name: 'quantity', label: 'Quantity', field: 'quantity' },
  { name: 'price', label: 'Price', field: 'price' },
])

const generateInventoryReport = async () => {
  // Call API to generate inventory report
  // const response = await fetch('/api/inventory-report')
  // const data = await response.json()
  const inventoryReport = [
    { name: 'Product A', quantity: 100, price: 10.99 },
    { name: 'Product B', quantity: 50, price: 5.99 },
    { name: 'Product C', quantity: 200, price: 7.99 },
  ]
  reportData.value = inventoryReport
  // reportData.value = data
  reportTitle.value = 'Inventory Report'
  showReportDialog.value = true
}

const generateSalesReport = async () => {
  // Call API to generate sales report
  const response = await fetch('/api/sales-report')
  const data = await response.json()
  reportData.value = data
  reportTitle.value = 'Sales Report'
  showReportDialog.value = true
}

const generatePurchaseReport = async () => {
  // Call API to generate purchase report
  const response = await fetch('/api/purchase-report')
  const data = await response.json()
  reportData.value = data
  reportTitle.value = 'Purchase Report'
  showReportDialog.value = true
}
</script>

<style scoped>
.my-card {
  width: 100%;
  max-width: 250px;
}

/* Add some media queries to make the layout more responsive */
@media (max-width: 768px) {
 .my-card {
    max-width: 100%;
  }
}

@media (max-width: 480px) {
 .q-dialog {
    width: 100%;
  }
}
</style>
