<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSalesStore } from '../stores/salesStore'
import { useFinancialStore } from 'src/stores/financialStore'
import { useQuasar } from 'quasar'

const $q = useQuasar()

const salesStore = useSalesStore()
const financialStore = useFinancialStore()
const loading = computed ( () => salesStore.loading )
const searchQuery = ref('')
const dateRange = ref({ from: '', to: '' })
const showDetails = ref(false)
const selectedSale = ref(null)
const sales = computed( () => salesStore.sales )

const columns = [
  {
    name: 'date',
    required: true,
    label: 'Date',
    align: 'left',
    field: row => new Date(row.date).toLocaleString(),
    sortable: true
  },
  {
    name: 'items',
    align: 'center',
    label: 'Items',
    field: 'items'
  },
  {
    name: 'paymentMethod',
    align: 'left',
    label: 'Payment Method',
    field: 'paymentMethod',
    sortable: true
  },
  {
    name: 'total',
    align: 'right',
    label: 'Total',
    field: 'total',
    sortable: true
  }
]

const pagination = ref({
  sortBy: 'date',
  descending: true,
  page: 1,
  rowsPerPage: 10
})

const filteredSales = computed(() => {
  let filtered = [...sales.value]

  if (dateRange.value.from && dateRange.value.to) {
    filtered = filtered.filter(sale => {
      const from = formatDate(new Date(dateRange.value.from), 'YYYY-MM-DD')
      const to = formatDate(new Date(dateRange.value.to), 'YYYY-MM-DD')
      return sale.date >= from && sale.date <= to
    })
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(sale =>
      sale.paymentMethod.toLowerCase().includes(query) ||
      sale.items.some(item => item.name.toLowerCase().includes(query))
    )
  }

  return filtered
})

const showSaleDetails = (sale) => {
  selectedSale.value = sale
  showDetails.value = true
}

const loadSales = async () => {
  try {
    const result = await salesStore.initializeDb()
    if (result)
      $q.notify({
        type: 'positive',
        message: 'Sales loaded successfully'
      })
  } catch (error) {
    $q.notify({
      type: 'negative',
      message: 'Error loading sales'
    })
    console.error('Error loading sales:', error)
  }
}

onMounted(async () => await loadSales())
</script>


<template>
  <q-page padding>
    <div class="row q-col-gutter-md">
      <div class="col-12">
        <q-card>
          <q-card-section>
            <div class="row items-center justify-between q-mb-md">
              <div class="text-h6">Sales History</div>
              <q-btn color="primary" icon="arrow_back" label="Return to Sales" to="/sales" />
            </div>
            <div class="row q-col-gutter-sm q-mb-md">
              <div class="col-grow">
                <q-input
                  v-model="searchQuery"
                  dense
                  outlined
                  placeholder="Search sales..."
                >
                  <template v-slot:append>
                    <q-icon name="search" />
                  </template>
                </q-input>
              </div>
              <div class="col-auto">
                <q-btn-dropdown color="primary" label="Date Range">
                  <q-date v-model="dateRange" range />
                </q-btn-dropdown>
              </div>
            </div>

            <q-table
              :rows="filteredSales"
              :columns="columns"
              row-key="id"
              :loading="loading"
              :filter="searchQuery"
              :pagination="pagination"
            >
              <template v-slot:body-cell-items="props">
                <q-td :props="props">
                  <q-btn v-if="props.row.items" flat round color="primary" icon="visibility" @click="showSaleDetails(props.row)">
                    <q-tooltip>View Items</q-tooltip>
                  </q-btn>
                  {{ props.row.items.length ? props.row.items.length : 0 }} items
                </q-td>
              </template>
              <template v-slot:body-cell-total="props">
                <q-td :props="props">
                  {{ financialStore.formatCurrency(props.row.total) }}
                </q-td>
              </template>
            </q-table>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Sale Details Dialog -->
    <q-dialog v-model="showDetails" persistent>
      <q-card style="min-width: 350px">
        <q-card-section class="row items-center">
          <div class="text-h6">Sale Details</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <div class="q-mb-md">
            <div class="text-subtitle2">Date:</div>
            <div>{{ selectedSale ? new Date(selectedSale.date).toLocaleString() : '' }}</div>
          </div>
          <div class="q-mb-md">
            <div class="text-subtitle2">Payment Method:</div>
            <div>{{ selectedSale?.paymentMethod }}</div>
          </div>
          <div class="q-mb-md">
            <div class="text-subtitle2">Items:</div>
            <q-list>
              <q-item v-for="item in selectedSale?.items" :key="item.id">
                <q-item-section>
                  <q-item-label>{{ item.name }}</q-item-label>
                  <q-item-label caption>
                    Quantity: {{ item.quantity }} × {{ financialStore.formatCurrency(item.price) }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  {{ financialStore.formatCurrency(item.total) }}
                </q-item-section>
              </q-item>
            </q-list>
          </div>
          <div class="text-h6 text-right">
            Total: {{ selectedSale ? financialStore.formatCurrency(selectedSale.total) : '0.00' }}
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
.q-table__card {
  box-shadow: none;
}
</style>
