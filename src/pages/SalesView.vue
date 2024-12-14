<script setup>
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { useInventoryStore } from '../stores/inventoryStore'
import { useSalesStore } from 'src/stores/salesStore'
import { useFinancialStore } from 'src/stores/financialStore'
import { useQuasar } from 'quasar'
const Product = defineAsyncComponent(() => import('src/components/sales/Product.vue'))

const $q = useQuasar()
const inventoryStore = useInventoryStore()
const salesStore = useSalesStore()
const financialStore = useFinancialStore()

const paymentMethods = ['Cash', 'GCash', 'Growsari']

const categories = computed(() => inventoryStore.formattedCategories)
const subtotal = computed(() =>
  salesStore.getCart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
)

const total = computed(() => subtotal.value)

const handleUpdateCartQuantity = (item, change) => {
  const result = salesStore.updateCartQuantity(item, change)
  if (!result.success) {
    $q.notify({
      type: 'warning',
      message: result.error
    })
  }
}

const handleRemoveFromCart = (item) => salesStore.removeFromCart(item)

const processCheckout = async () => {
  salesStore.isCheckoutProcessing = true
  const result = await salesStore.processCheckout()
  salesStore.isCheckoutProcessing = false

  if (result.success) {
    $q.notify({
      type: 'positive',
      message: 'Purchase completed successfully!'
    })
    salesStore.clearCart()
    inventoryStore.loadInventory()
    await salesStore.loadSales()
  } else {
    $q.notify({
      type: 'negative',
      message: result.error
    })
  }
}

onMounted(async () => {
  try {
    const loadTasks = [
      salesStore.sales.length === 0 ? salesStore.loadSales().catch(error => {
        console.error('Error loading sales:', error);
        $q.notify({
          type: 'negative',
          message: 'Error loading sales data. Some features may be limited.',
          timeout: 5000
        });
      }) : Promise.resolve(),
      inventoryStore.items.length === 0 ? inventoryStore.loadInventory() : Promise.resolve(),
      inventoryStore.categories.length === 0 ? inventoryStore.loadCategories() : Promise.resolve()
    ]

    await Promise.all(loadTasks)
  } catch (error) {
    console.error('Error during initialization:', error);
    $q.notify({
      type: 'negative',
      message: 'Error initializing the application. Please refresh the page.',
      timeout: 5000
    });
  }
})
</script>

<template>
  <q-page padding>
    <div class="row q-col-gutter-md">
      <!-- Left Side - Product Selection and Cart -->
      <div class="col-12 col-md-8">
        <q-card class="full-height">
          <q-card-section>
            <div class="row items-center justify-between q-mb-md">
              <div class="text-h6 col-12 col-sm-auto q-mb-sm-xs">Point of Sale</div>
              <div class="row q-gutter-sm col-12 col-sm-auto">
                <q-btn
                  color="primary"
                  icon="history"
                  :label="$q.screen.gt.xs ? 'Sales History' : ''"
                  to="/sales/history"
                  class="col-auto"
                />
                <q-input
                  v-model="salesStore.searchQuery"
                  dense
                  outlined
                  placeholder="Search products..."
                  class="col-12 col-sm-auto"
                  style="min-width: 200px"
                >
                  <template v-slot:append>
                    <q-icon name="search" />
                  </template>
                </q-input>
                <q-select
                  v-model="salesStore.selectedCategory"
                  :options="categories"
                  label="Category"
                  dense
                  outlined
                  emit-value
                  map-options
                  options-dense
                  placeholder="Category"
                  class="col-12 col-sm-auto"
                  style="min-width: 150px"
                />
              </div>
            </div>
            <!-- Products Grid -->
            <Product></Product>
          </q-card-section>
        </q-card>
      </div>

      <!-- Right Side - Cart and Payment -->
      <div class="col-12 col-md-4">
        <q-card class="full-height">
          <q-card-section>
            <div class="text-h6 q-mb-md">Shopping Cart</div>

            <!-- Cart Items -->
            <q-list separator>
              <q-item v-for="item in salesStore.getCart" :key="item.id">
                <q-item-section>
                  <q-item-label class="text-bold bg-primary q-pa-xs">{{ item.name }}</q-item-label>
                  <q-item-label caption>
                    {{ financialStore.formatCurrency(item.price) }} × {{ item.quantity }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <div class="row items-center q-gutter-sm">
                    <q-btn-group spread>
                      <q-btn
                        flat
                        dense
                        icon="remove"
                        @click.stop="handleUpdateCartQuantity(item, -1)"
                      />
                      <q-btn
                        flat
                        dense
                        :label="item.quantity.toString()"
                        style="min-width: 40px"
                      />
                      <q-btn
                        flat
                        dense
                        icon="add"
                        @click.stop="handleUpdateCartQuantity(item, 1)"
                      />
                    </q-btn-group>
                    <q-btn
                      flat
                      round
                      dense
                      icon="delete"
                      color="negative"
                      @click.stop="handleRemoveFromCart(item)"
                    />
                  </div>
                </q-item-section>
              </q-item>
            </q-list>

            <!-- Cart Summary -->
            <div class="q-mt-md">
              <div class="row justify-between q-mb-sm">
                <div class="text-subtitle1">Subtotal:</div>
                <div class="text-subtitle1">{{ financialStore.formatCurrency(subtotal) }}</div>
              </div>
              <div class="row justify-between q-mb-md">
                <div class="text-subtitle1">Total:</div>
                <div class="text-h6 text-primary">{{ financialStore.formatCurrency(total) }}</div>
              </div>

              <!-- Payment Method Selection -->
              <q-select
                v-model="salesStore.selectedPaymentMethod"
                :options="paymentMethods"
                label="Payment Method"
                outlined
                class="q-mb-md"
              />

              <!-- Checkout Button -->
              <q-btn
                color="primary"
                class="full-width"
                label="Checkout"
                :disable="!salesStore.getCart.length || salesStore.isCheckoutProcessing"
                @click="salesStore.showCheckoutDialog = !salesStore.isCheckoutProcessing ? true : salesStore.showCheckoutDialog"
                :loading="salesStore.isCheckoutProcessing"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Checkout Dialog -->
    <q-dialog v-model="salesStore.showCheckoutDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section class="row items-center">
          <div class="text-h6">Confirm Purchase</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <div class="q-mb-md">
            <div class="text-subtitle2">Payment Method</div>
            <div>{{ salesStore.selectedPaymentMethod }}</div>
          </div>
          <div class="text-h6">Total: {{ financialStore.formatCurrency(total) }}</div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn
            flat
            label="Confirm"
            color="primary"
            @click="processCheckout"
            :disable="salesStore.isCheckoutProcessing"
            :loading="salesStore.isCheckoutProcessing"/>
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>
/* Mobile-first styles */
.q-page {
  max-width: 100%;
}

/* Responsive adjustments */
@media (max-width: 599px) {
  .q-gutter-sm > * {
    margin: 4px !important;
  }

  .q-mb-sm-xs {
    margin-bottom: 8px;
  }

  .q-card-section {
    padding: 12px !important;
  }
}

/* Ensure cart items are properly spaced */
.q-item {
  flex-wrap: wrap;
}

@media (min-width: 600px) {
  .q-item {
    flex-wrap: nowrap;
  }
}
</style>
