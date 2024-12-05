<script setup>
import { useInventoryStore } from 'src/stores/inventoryStore'
import { useSalesStore } from 'src/stores/salesStore'
import { computed, onMounted } from 'vue'
import { useQuasar } from 'quasar'

const $q = useQuasar()

const salesStore = useSalesStore()
const inventoryStore = useInventoryStore()
const filteredProducts = computed(() => salesStore.filteredProducts)

const handleAddToCart = (product) => {
  const result = salesStore.addToCart(product)
  if (!result.success) {
    $q.notify({
      type: 'negative',
      message: result.error
    })
  }
}

onMounted(() => inventoryStore.loadInventory())
</script>

<template>
  <div class="row q-col-gutter-md">
    <div
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
              ₱{{ salesStore.formatPrice(product.price) }}
            </div>
            <div class="text-caption">
              Stock: {{ product.quantity }}
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.product-card {transition: all 0.3s ease;}
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
