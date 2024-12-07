<template>
  <q-dialog
    v-model="dialogModel"
    maximized
    transition-show="slide-up"
    transition-hide="slide-down"
  >
    <q-card class="column">
      <q-card-section class="column q-pb-none">
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-h6">{{ selectedPaymentMethod }} Transactions</div>
          <q-btn
            icon="close"
            flat
            round
            dense
            v-close-popup
            :disable="loading"
          />
        </div>
        <div class="row items-center justify-between q-mb-sm">
          <div class="text-h6">
            Balance: {{ financialStore.formatCurrency(totalBalance) }}
          </div>
        </div>
        <div class="row items-center justify-start q-gutter-sm">
          <q-btn
            color="primary"
            icon="add"
            :label="$q.screen.gt.xs ? 'Add Transaction' : ''"
            @click="showAddDialog = true"
            :disable="loading"
          >
            <q-tooltip v-if="!$q.screen.gt.xs">Add Transaction</q-tooltip>
          </q-btn>
          <q-btn
            color="primary"
            icon="file_download"
            :label="$q.screen.gt.xs ? 'Export CSV' : ''"
            @click="exportTransactions"
            :disable="loading || !transactions.length"
          >
            <q-tooltip v-if="!$q.screen.gt.xs">Export CSV</q-tooltip>
          </q-btn>
        </div>
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
          :grid="$q.screen.lt.sm"
        >
          <template #top-right>
            <q-input
              dense
              debounce="300"
              v-model="filter"
              placeholder="Search"
              class="q-mb-sm"
            >
              <template #append>
                <q-icon name="search" />
              </template>
            </q-input>
          </template>

          <template #item="props" v-if="$q.screen.lt.sm">
            <div class="q-pa-xs col-xs-12 col-sm-6 col-md-4">
              <q-card flat bordered>
                <q-card-section>
                  <div class="row items-center justify-between">
                    <div class="text-subtitle2">{{ props.row.description }}</div>
                    <q-badge
                      :color="props.row.type === 'income' ? 'positive' : 'negative'"
                      text-color="white"
                    >
                      {{ props.row.type.toUpperCase() }}
                    </q-badge>
                  </div>
                  <div class="row items-center justify-between q-mt-sm">
                    <div>{{ financialStore.formatCurrency(props.row.amount) }}</div>
                    <div>{{ props.row.date }}</div>
                  </div>
                  <div class="row items-center justify-end q-mt-sm">
                    <q-btn
                      flat
                      round
                      dense
                      color="primary"
                      icon="edit"
                      @click="editTransaction(props.row)"
                      :disable="loading"
                    >
                      <q-tooltip>Edit Transaction</q-tooltip>
                    </q-btn>
                    <q-btn
                      flat
                      round
                      dense
                      color="negative"
                      icon="delete"
                      @click="confirmDelete(props.row)"
                      :disable="loading"
                    >
                      <q-tooltip>Delete Transaction</q-tooltip>
                    </q-btn>
                  </div>
                </q-card-section>
              </q-card>
            </div>
          </template>

          <template #body="props" v-else>
            <q-tr :props="props">
              <q-td
                v-for="col in props.cols"
                :key="col.name"
                :props="props"
              >
                <template v-if="col.name === 'type'">
                  <q-badge
                    :color="props.row.type === 'income' ? 'positive' : 'negative'"
                    text-color="white"
                  >
                    {{ props.row.type.toUpperCase() }}
                  </q-badge>
                </template>
                <template v-else-if="col.name === 'actions'">
                  <div class="row items-center justify-end">
                    <q-btn
                      flat
                      round
                      dense
                      color="primary"
                      icon="edit"
                      @click="editTransaction(props.row)"
                      :disable="loading"
                    >
                      <q-tooltip>Edit Transaction</q-tooltip>
                    </q-btn>
                    <q-btn
                      flat
                      round
                      dense
                      color="negative"
                      icon="delete"
                      @click="confirmDelete(props.row)"
                      :disable="loading"
                    >
                      <q-tooltip>Delete Transaction</q-tooltip>
                    </q-btn>
                  </div>
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
        <div class="text-h6">{{ editMode ? 'Edit' : 'Add' }} Transaction</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <q-select
          v-model="newTransaction.type"
          :options="transactionTypes"
          label="Type"
          option-label="label"
          option-value="value"
          emit-value
          map-options
          outlined
          class="q-mb-md"
          :disable="loading"
        >
          <template #option="{ opt, selected, toggleOption }">
            <q-item
              clickable
              v-close-popup
              :active="selected"
              @click="toggleOption(opt)"
            >
              <q-item-section>
                <q-badge
                  :color="opt.value === 'income' ? 'positive' : 'negative'"
                  text-color="white"
                >
                  {{ opt.label }}
                </q-badge>
              </q-item-section>
            </q-item>
          </template>
          <template #selected>
            <q-badge
              :color="newTransaction.type === 'income' ? 'positive' : 'negative'"
              text-color="white"
            >
              {{ transactionTypes.find(t => t.value === newTransaction.type)?.label }}
            </q-badge>
          </template>
        </q-select>

        <q-input
          v-model.number="newTransaction.amount"
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
          :label="editMode ? 'Save' : 'Add'"
          @click="editMode ? updateTransaction() : addTransaction()"
          :loading="loading"
          :disable="loading || !newTransaction.amount || !newTransaction.description"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>

  <q-dialog v-model="showDeleteDialog" persistent>
    <q-card>
      <q-card-section class="row items-center">
        <q-avatar icon="warning" color="negative" text-color="white" />
        <span class="q-ml-sm">Are you sure you want to delete this transaction?</span>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Cancel" color="primary" v-close-popup :disable="loading" />
        <q-btn flat label="Delete" color="negative" @click="deleteTransaction" :loading="loading" :disable="loading" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useQuasar, date } from 'quasar'
import { useFinancialStore } from '../../stores/financialStore'

const $q = useQuasar()
const financialStore = useFinancialStore()

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
    name: 'amount',
    label: 'Amount',
    field: 'amount',
    sortable: true,
    format: val => financialStore.formatCurrency(val)
  },
  {
    name: 'description',
    label: 'Description',
    field: 'description',
    sortable: true
  },
  {
    name: 'actions',
    label: 'Actions',
    field: 'actions',
    align: 'right'
  }
]

const transactions = ref([])

const totalBalance = computed(() => {
  return transactions.value.reduce((sum, transaction) => {
    const amount = Number(transaction?.amount) || 0
    return sum + (transaction?.type === 'income' ? amount : -amount)
  }, 0)
})

const transactionTypes = [
  { label: 'Income', value: 'income' },
  { label: 'Expense', value: 'expense' }
]

const newTransaction = ref({
  type: 'income',
  amount: 0,
  description: '',
  date: date.formatDate(new Date(), 'YYYY-MM-DD')
})

const showAddDialog = ref(false)
const loading = ref(false)

const editMode = ref(false)
const showDeleteDialog = ref(false)
const selectedTransaction = ref(null)

const resetTransaction = () => {
  newTransaction.value = {
    type: 'income',
    amount: 0,
    description: '',
    date: date.formatDate(new Date(), 'YYYY-MM-DD')
  }
  editMode.value = false
  selectedTransaction.value = null
}

const editTransaction = (transaction) => {
  editMode.value = true
  selectedTransaction.value = transaction
  newTransaction.value = {
    type: transaction.type,
    amount: transaction.amount,
    description: transaction.description,
    date: transaction.date
  }
  showAddDialog.value = true
}

const updateTransaction = async () => {
  if (!selectedTransaction.value) return

  try {
    loading.value = true
    await financialStore.updateTransaction(selectedTransaction.value.id, {
      ...newTransaction.value,
      date: date.formatDate(new Date(newTransaction.value.date), 'YYYY-MM-DD')
    })

    await fetchTransactions()
    showAddDialog.value = false

    $q.notify({
      type: 'positive',
      message: 'Transaction updated successfully',
      timeout: 2000
    })
  } catch (error) {
    console.error('Error updating transaction:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to update transaction. Please try again.',
      timeout: 3000
    })
  } finally {
    loading.value = false
  }
}

const confirmDelete = (transaction) => {
  selectedTransaction.value = transaction
  showDeleteDialog.value = true
}

const deleteTransaction = async () => {
  if (!selectedTransaction.value) return

  try {
    loading.value = true
    await financialStore.deleteTransaction(selectedTransaction.value.id)

    await fetchTransactions()
    showDeleteDialog.value = false

    $q.notify({
      type: 'positive',
      message: 'Transaction deleted successfully',
      timeout: 2000
    })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to delete transaction. Please try again.',
      timeout: 3000
    })
  } finally {
    loading.value = false
  }
}

const addTransaction = async () => {
  try {
    loading.value = true
    await financialStore.addTransaction({
      ...newTransaction.value,
      paymentMethod: props.selectedPaymentMethod,
      date: date.formatDate(new Date(newTransaction.value.date), 'YYYY-MM-DD')
    })

    await fetchTransactions()
    showAddDialog.value = false
    resetTransaction()

    $q.notify({
      type: 'positive',
      message: 'Transaction added successfully',
      timeout: 2000
    })
  } catch (error) {
    console.error('Error adding transaction:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to add transaction. Please try again.',
      timeout: 3000
    })
  } finally {
    loading.value = false
  }
}

const exportTransactions = () => {
  if (!transactions.value.length) return

  const data = transactions.value.map(transaction => ({
    'Date': date.formatDate(transaction.date, 'YYYY-MM-DD HH:mm'),
    'Type': transaction.type === 'income' ? 'Income' : 'Expense',
    'Amount': financialStore.formatCurrency(transaction.amount),
    'Description': transaction.description
  }))

  financialStore.exportToCSV(data, `${props.selectedPaymentMethod.toLowerCase()}-transactions`)
}

const fetchTransactions = async () => {
  try {
    loading.value = true
    const result = await financialStore.fetchCashFlowTransactions(props.selectedPaymentMethod)

    if (financialStore.error) {
      throw new Error(financialStore.error)
    }

    transactions.value = result
  } catch (error) {
    console.error('Error fetching transactions:', error)
    $q.notify({
      type: 'negative',
      message: 'Failed to load transactions. Please try again.',
      timeout: 3000
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

onUnmounted(() => {
  resetTransaction()
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
