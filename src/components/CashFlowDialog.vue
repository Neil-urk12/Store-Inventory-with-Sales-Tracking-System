<template>
  <q-dialog
    v-model="dialogModel"
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="column">
      <q-card-section class="row items-center q-pb-none">
        <div class="text-h6">{{ selectedPaymentMethod }} Transactions</div>
        <q-space />
        <div class="text-h6 q-mr-md">
          Balance: {{ inventoryStore.formatCurrency(totalBalance) }}
        </div>
        <q-btn
          color="primary"
          icon="add"
          label="Add Transaction"
          @click="showAddDialog = true"
          class="q-mr-sm"
          :disable="loading"
        />
        <q-btn
          color="primary"
          icon="file_download"
          label="Export CSV"
          @click="exportTransactions"
          class="q-mr-sm"
          :disable="loading || !transactions.length"
        />
        <q-btn
          icon="close"
          flat
          round
          dense
          v-close-popup
          :disable="loading"
        />
      </q-card-section>

      <q-card-section class="col q-pa-md">
        <q-table
          :rows="transactions"
          :columns="columns"
          v-model:pagination="pagination"
          row-key="id"
          :filter="filter"
          flat
          :rows-per-page-options="[10, 20, 50]"
          :loading="loading"
        >
          <template #top-right>
            <q-input
              borderless
              dense
              debounce="300"
              v-model="filter"
              placeholder="Search"
            >
              <template #append>
                <q-icon name="search" />
              </template>
            </q-input>
          </template>

          <template #body="props">
            <q-tr :props="props">
              <q-td
                v-for="col in props.cols"
                :key="col.name"
                :props="props"
              >
                <template v-if="col.name === 'type'">
                  <q-badge
                    :color="props.row.type === 'in' ? 'positive' : 'negative'"
                    text-color="white"
                  >
                    {{ props.row.type.toUpperCase() }}
                  </q-badge>
                </template>
                <template v-else>
                  {{ col.format ? col.format(props.row[col.name]) : props.row[col.name] }}
                </template>
              </q-td>
            </q-tr>
          </template>

          <template #no-data>
            <div class="full-width row flex-center q-pa-md text-grey-8">
              No transactions found
            </div>
          </template>
        </q-table>
      </q-card-section>
    </q-card>
  </q-dialog>

  <q-dialog v-model="showAddDialog" persistent>
    <q-card style="min-width: 350px">
      <q-card-section>
        <div class="text-h6">Add Transaction</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-select
          v-model="newTransaction.type"
          :options="[
            { label: 'Money In', value: 'in' },
            { label: 'Money Out', value: 'out' }
          ]"
          label="Type"
          option-label="label"
          option-value="value"
          emit-value
          map-options
          outlined
          class="q-mb-md"
          :disable="loading"
        >
          <template #option="{ opt }">
            <q-item v-bind="opt">
              <q-item-section>
                <q-badge
                  :color="opt.value === 'in' ? 'positive' : 'negative'"
                  text-color="white"
                >
                  {{ opt.label }}
                </q-badge>
              </q-item-section>
            </q-item>
          </template>
        </q-select>

        <q-input
          v-model.number="newTransaction.value"
          type="number"
          label="Amount"
          outlined
          class="q-mb-md"
          :rules="[
            val => val > 0 || 'Amount must be greater than 0'
          ]"
          :disable="loading"
        />

        <q-input
          v-model="newTransaction.description"
          label="Description"
          outlined
          class="q-mb-md"
          :rules="[
            val => !!val || 'Description is required'
          ]"
          :disable="loading"
        />
      </q-card-section>

      <q-card-actions align="right" class="text-primary">
        <q-btn flat label="Cancel" v-close-popup :disable="loading" />
        <q-btn
          flat
          label="Add"
          @click="addTransaction"
          :loading="loading"
          :disable="loading || !newTransaction.value || !newTransaction.description"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useQuasar, date } from 'quasar'
import { useInventoryStore } from '../stores/inventoryStore'

const $q = useQuasar()
const inventoryStore = useInventoryStore()

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  selectedPaymentMethod: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

const dialogModel = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const filter = ref('')
const pagination = ref({
  sortBy: 'date',
  descending: true,
  page: 1,
  rowsPerPage: 10
})

const columns = [
  {
    name: 'date',
    label: 'Date',
    field: 'date',
    sortable: true,
    format: val => date.formatDate(val, 'YYYY-MM-DD HH:mm')
  },
  {
    name: 'type',
    label: 'Type',
    field: 'type',
    sortable: true
  },
  {
    name: 'value',
    label: 'Amount',
    field: 'value',
    sortable: true,
    format: val => inventoryStore.formatCurrency(val)
  },
  {
    name: 'description',
    label: 'Description',
    field: 'description',
    sortable: true
  }
]

const transactions = computed(() => {
  return inventoryStore.cashFlowTransactions[props.selectedPaymentMethod] || []
})

const totalBalance = computed(() => {
  return inventoryStore.getBalance(props.selectedPaymentMethod) || 0
})

const newTransaction = ref({
  type: 'in',
  value: 0,
  description: ''
})

const showAddDialog = ref(false)
const loading = ref(false)

const addTransaction = async () => {
  if (!newTransaction.value.value || !newTransaction.value.description) {
    $q.notify({
      color: 'negative',
      message: 'Please fill in all fields'
    })
    return
  }

  loading.value = true
  try {
    const success = await inventoryStore.addCashFlowTransaction(
      props.selectedPaymentMethod,
      newTransaction.value
    )

    if (success) {
      newTransaction.value = {
        type: 'in',
        value: 0,
        description: ''
      }
      showAddDialog.value = false
      $q.notify({
        color: 'positive',
        message: 'Transaction added successfully'
      })
    } else {
      throw new Error('Failed to add transaction')
    }
  } catch (error) {
    console.error('Error adding transaction:', error)
    $q.notify({
      color: 'negative',
      message: 'Failed to add transaction'
    })
  } finally {
    loading.value = false
  }
}

const exportTransactions = () => {
  if (!transactions.value.length) return

  const data = transactions.value.map(transaction => ({
    'Date': date.formatDate(transaction.date, 'YYYY-MM-DD HH:mm'),
    'Type': transaction.type === 'in' ? 'Money In' : 'Money Out',
    'Amount': inventoryStore.formatCurrency(transaction.value),
    'Description': transaction.description
  }))

  inventoryStore.exportToCSV(data, `${props.selectedPaymentMethod.toLowerCase()}-transactions`)
}

const fetchTransactions = async () => {
  loading.value = true
  try {
    await inventoryStore.fetchCashFlowTransactions(props.selectedPaymentMethod)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    $q.notify({
      color: 'negative',
      message: 'Failed to fetch transactions'
    })
  } finally {
    loading.value = false
  }
}

watch(() => props.selectedPaymentMethod, () => {
  if (props.modelValue && props.selectedPaymentMethod) fetchTransactions()
})

onMounted(() => {
  if (props.modelValue && props.selectedPaymentMethod) fetchTransactions()
})
</script>

<style scoped>
.q-table__container {
  height: calc(100vh - 150px);
}

:deep(.q-table__top),
:deep(.q-table__bottom) {
  padding: 8px;
}
</style>
