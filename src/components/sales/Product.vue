<script setup>
import { useInventoryStore } from 'src/stores/inventoryStore'
import { useSalesStore } from 'src/stores/salesStore'
import { useFinancialStore } from 'src/stores/financialStore'
import { computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'
import { useNetworkStatus } from 'src/services/networkStatus'

const $q = useQuasar()
const { isOnline } = useNetworkStatus()

const salesStore = useSalesStore()
const inventoryStore = useInventoryStore()
const financialStore = useFinancialStore()
const filteredProducts = computed(() => salesStore.filteredProducts)
const hasProducts = computed(() => filteredProducts.value && filteredProducts.value.length > 0)

const handleAddToCart = (product) => {
  const result = salesStore.addToCart(product)
  if (!result.success) {
    $q.notify({
      type: 'negative',
      message: result.error
    })
  }
}

onMounted(async () => {
  if(filteredProducts.value === 0)
    await inventoryStore.loadInventory()
})
</script>

<template>
  <div class="row q-col-gutter-md">
    <div v-if="!hasProducts" class="col-12">
      <q-card class="text-center q-pa-lg">
        <q-icon name="inventory_2" size="4rem" color="grey-5" />
        <div class="text-h6 q-mt-md text-grey-7">No Products Available</div>
        <div class="text-body2 text-grey-6 q-mt-sm">
          {{ salesStore.selectedCategory 
            ? `No products found in category "${salesStore.selectedCategory}"`
            : salesStore.searchQuery
              ? `No products match "${salesStore.searchQuery}"`
              : 'No products have been added to inventory yet'
          }}
        </div>
      </q-card>
    </div>

    <div
      v-else
      v-for="product in filteredProducts"
      :key="product.id"
      class="col-6 col-sm-4 col-md-3"
    >
      <q-card
        class="product-card cursor-pointer"
        @click="handleAddToCart(product)"
        :class="{ 'out-of-stock': product.quantity <= 0 }"

      >
        <q-img
          v-if="isOnline"
          :src="'https://cdn.quasar.dev/img/parallax2.jpg'"
          :ratio="1"
          basic
          loading="lazy"
        >
          <div class="absolute-bottom text-subtitle2 text-center bg-primary text-bold">
            {{ product.name }}
          </div>
        </q-img>
        <div v-else class="offlineBg">
          <div class="absolute-top text-subtitle2 text-center bg-primary q-pa-xs q-ma-none">
            {{ product.name }}
          </div>
        </div>
        <q-card-section class="q-pt-xs">
          <div class="row items-center justify-between">
            <div class="text-subtitle1 text-weight-bold">
              {{ financialStore.formatCurrency(product.price) }}
            </div>
            <div class="text-caption">
              Stock: {{ product.quantity }}
            </div>
          </div>
        </q-card-section>
      </q-card>
      <!-- <q-card
        class="product-card cursor-pointer"
        @click="handleAddToCart(product)"
        :class="{ 'out-of-stock': product.quantity <= 0 }"
        v-else
      >
        <div class="row items-center justify-between q-mb-md">
          <div class="absolute-bottom text-subtitle2 text-center bg-primary text-bold">
            {{ product.name }}
          </div>
        </div>
        <q-card-section class="q-pt-xs">
          <div class="row items-center justify-between">
            <div class="text-subtitle1 text-weight-bold">
              {{ financialStore.formatCurrency(product.price) }}
            </div>
            <div class="text-caption">
              Stock: {{ product.quantity }}
            </div>
          </div>
        </q-card-section>
      </q-card> -->
    </div>
  </div>
</template>

<style lang="scss" scoped>
.product-card {
  transition: all 0.3s ease;
  border: #7954f8 1px solid;
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
.offlineBg{
  height: 60px;
}
.q-card {
  .q-icon {
    opacity: 0.5;
  }
}
</style>
