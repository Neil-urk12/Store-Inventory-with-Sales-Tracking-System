<script setup>
import { ref, computed, onMounted, defineAsyncComponent } from 'vue'
import { useInventoryStore } from '../stores/inventoryStore'
import { useSalesStore } from 'src/stores/salesStore';
import { useQuasar } from 'quasar'
const Product = defineAsyncComponent(() => import('src/components/sales/Product.vue'));

const $q = useQuasar()
const inventoryStore = useInventoryStore()
const salesStore = useSalesStore()

const paymentMethods = [ 'Cash', 'GCash', 'Growsari']

// const categories = computed(() => {
//   // const uniqueCategories = [...new Set(salesStore.products.map(p => p.category))]
//   return [...new Set(salesStore.products.map(p => p.category))].map(cat => ({ label: cat, value: cat}))
//   // const uniqueCategories = [...new Set(products.value.map(p => p.category))]
//   // return uniqueCategories.map(cat => ({ label: cat, value: cat }))
// })
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

// const removeFromCart = (item) => (salesStore.cart.value.indexOf(item) > -1) ? salesStore.cart.value.splice(index, 1) : null //Final immutable optimization
  // const index = cart.value.indexOf(item)   //initial
  // if (index > -1) cart.value.splice(index, 1)
  // if(cart.value.indexOf(item) > -1) cart.value.splice(index, 1)  //optimized 1

const processCheckout = () => {
  const result = salesStore.clearCart()
  if (result.success) {
    $q.notify({
      type: 'positive',
      message: 'Purchase completed successfully!'
    })
  }
}

onMounted(() => {
  inventoryStore.loadInventory()
  inventoryStore.loadCategories()
})
</script>

<template>
  <q-page padding>
    <div class="row q-col-gutter-md">
      <!-- Left Side - Product Selection and Cart -->
      <div class="col-12 col-lg-8">
        <q-card class="full-height">
          <q-card-section>
            <div class="row items-center justify-between q-mb-md">
              <div class="text-h6">Point of Sale</div>
              <div class="row q-gutter-sm">
                <q-input
                  v-model="salesStore.searchQuery"
                  dense
                  outlined
                  placeholder="Search products..."
                  class="col-grow"
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
      <div class="col-12 col-lg-4">
        <q-card class="full-height">
          <q-card-section>
            <div class="text-h6 q-mb-md">Shopping Cart</div>

            <!-- Cart Items -->
            <q-list separator>
              <q-item v-for="item in salesStore.getCart" :key="item.id">
                <q-item-section>
                  <q-item-label class="text-bold bg-primary q-pa-xs">{{ item.name }}</q-item-label>
                  <q-item-label caption>
                    ₱{{ salesStore.formatPrice(item.price) }} × {{ item.quantity }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <div class="row items-center q-gutter-sm">
                    <q-btn
                      flat
                      round
                      dense
                      icon="remove"
                      @click.stop="handleUpdateCartQuantity(item, -1)"
                    />
                    <span class="text-subtitle1">{{ item.quantity }}</span>
                    <q-btn
                      flat
                      round
                      dense
                      icon="add"
                      @click.stop="handleUpdateCartQuantity(item, 1)"
                    />
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
                <div class="text-subtitle1">₱{{ salesStore.formatPrice(subtotal) }}</div>
              </div>
              <div class="row justify-between q-mb-md">
                <div class="text-subtitle1">Total:</div>
                <div class="text-h6 text-primary">₱{{ salesStore.formatPrice(total) }}</div>
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
                :disable="!salesStore.getCart.length"
                @click="salesStore.showCheckoutDialog = true"
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
          <div class="text-h6">Total: ₱{{ salesStore.formatPrice(total) }}</div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="Cancel" color="primary" v-close-popup />
          <q-btn flat label="Confirm" color="primary" @click="processCheckout" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </q-page>
</template>

<style scoped>

</style>
