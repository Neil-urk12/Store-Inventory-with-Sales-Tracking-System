<script setup>
import { ref, computed, onMounted } from 'vue'
import { useInventoryStore } from '../stores/inventoryStore'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const inventoryStore = useInventoryStore()
const searchQuery = ref('')
const selectedCategory = ref(null)

const products = computed(() => inventoryStore.sortedItems)

const cart = ref([])
const selectedPaymentMethod = ref(null)
const showCheckoutDialog = ref(false)

const paymentMethods = [
  'Cash',
  'GCash',
  'Growsari'
]

const categories = computed(() => {
  const uniqueCategories = [...new Set(products.value.map(p => p.category))]
  return uniqueCategories.map(cat => ({ label: cat, value: cat }))
})

const filteredProducts = computed(() => {
  return products.value.filter(product => {
    const matchesSearch = searchQuery.value === '' ||
      product.name.toLowerCase().includes(searchQuery.value.toLowerCase())
    const matchesCategory = !selectedCategory.value ||
      product.category === selectedCategory.value
    return matchesSearch && matchesCategory
  })
})

const subtotal = computed(() => {
  return cart.value.reduce((sum, item) => sum + (item.price * item.quantity), 0)
})

const total = computed(() => subtotal.value)

// Methods
const formatPrice = (price) => price.toFixed(2)

const addToCart = (product) => {
  if (product.quantity <= 0) {
    $q.notify({
      type: 'negative',
      message: 'Product is out of stock'
    })
    return
  }

  const existingItem = cart.value.find(item => item.id === product.id)
  if (existingItem) {
    if (existingItem.quantity < product.quantity)
      existingItem.quantity++
    else {
      $q.notify({
        type: 'warning',
        message: 'Cannot add more than available stock'
      })
    }
  } else {
    cart.value.push({
      ...product,
      quantity: 1
    })
  }
}

const updateCartQuantity = (item, change) => {
  const product = mockProducts.find(p => p.id === item.id)
  const newQuantity = item.quantity + change

  if (newQuantity <= 0)
    removeFromCart(item)
  else if (newQuantity <= product.quantity)
    item.quantity = newQuantity
  else {
    $q.notify({
      type: 'warning',
      message: 'Cannot add more than available stock'
    })
  }
}

const removeFromCart = (item) => {
  const index = cart.value.indexOf(item)
  if (index > -1) cart.value.splice(index, 1)
}

const processCheckout = () => {
  $q.notify({
    type: 'positive',
    message: 'Purchase completed successfully!'
  })
  cart.value = []
  showCheckoutDialog.value = false
}

onMounted(() => {
  inventoryStore.loadInventory()
})
</script>

<template>z
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
                  v-model="searchQuery"
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
                  v-model="selectedCategory"
                  :options="categories"
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
            <div class="row q-col-gutter-md">
              <div
                v-for="product in filteredProducts"
                :key="product.id"
                class="col-6 col-sm-4 col-md-3"
              >
                <q-card
                  class="product-card cursor-pointer"
                  @click="addToCart(product)"
                  :class="{ 'out-of-stock': product.quantity <= 0 }"
                >
                  <q-img
                    :src="product.image || 'https://cdn.quasar.dev/img/parallax2.jpg'"
                    :ratio="1"
                    basic
                    loading="lazy"
                  >
                    <div class="absolute-bottom text-subtitle2 text-center bg-primary text-bold">
                      {{ product.name }}
                    </div>
                  </q-img>
                  <q-card-section class="q-pt-xs">
                    <div class="row items-center justify-between">
                      <div class="text-subtitle1 text-weight-bold">
                        ₱{{ formatPrice(product.price) }}
                      </div>
                      <div class="text-caption">
                        Stock: {{ product.quantity }}
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
              </div>
            </div>
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
              <q-item v-for="item in cart" :key="item.id">
                <q-item-section>
                  <q-item-label class="text-bold bg-primary q-pa-xs">{{ item.name }}</q-item-label>
                  <q-item-label caption>
                    ₱{{ formatPrice(item.price) }} × {{ item.quantity }}
                  </q-item-label>
                </q-item-section>
                <q-item-section side>
                  <div class="row items-center q-gutter-sm">
                    <q-btn-group flat>
                      <q-btn
                        flat
                        dense
                        icon="remove"
                        @click="updateCartQuantity(item, -1)"
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
                        @click="updateCartQuantity(item, 1)"
                      />
                    </q-btn-group>
                    <q-btn
                      flat
                      dense
                      round
                      color="negative"
                      icon="delete"
                      @click="removeFromCart(item)"
                    />
                  </div>
                </q-item-section>
              </q-item>
            </q-list>

            <!-- Cart Summary -->
            <div class="q-mt-md">
              <div class="row justify-between q-mb-sm">
                <div class="text-subtitle1">Subtotal:</div>
                <div class="text-subtitle1">₱{{ formatPrice(subtotal) }}</div>
              </div>
              <div class="row justify-between q-mb-md">
                <div class="text-subtitle1">Total:</div>
                <div class="text-h6 text-primary">₱{{ formatPrice(total) }}</div>
              </div>

              <!-- Payment Method Selection -->
              <q-select
                v-model="selectedPaymentMethod"
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
                :disable="!cart.length"
                @click="showCheckoutDialog = true"
              />
            </div>
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- Checkout Dialog -->
    <q-dialog v-model="showCheckoutDialog" persistent>
      <q-card style="min-width: 350px">
        <q-card-section class="row items-center">
          <div class="text-h6">Confirm Purchase</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section>
          <div class="q-mb-md">
            <div class="text-subtitle2">Payment Method</div>
            <div>{{ selectedPaymentMethod }}</div>
          </div>
          <div class="text-h6">Total: ₱{{ formatPrice(total) }}</div>
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
.product-card {
  transition: all 0.3s ease;
}

.product-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}

.out-of-stock {
  opacity: 0.6;
}

.out-of-stock:hover {
  transform: none;
  cursor: not-allowed;
}
</style>
