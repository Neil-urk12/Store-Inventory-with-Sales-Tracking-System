<script setup>
import { ref } from 'vue'
const dailyProfit = ref(1000);
const dailyExpense = ref(500);
</script>

<template>
  <div class="dailyPNLcontainer fit column justify-center">
    <div class="profitBox bg-accent q-mb-none fit row justify-evenly items-center q-py-md">
        <p class="q-ma-none">Today's Profit : +{{ dailyProfit }}</p>
        <p class="q-ma-none">Today's Loss : -{{ dailyExpense }}</p>
    </div>
  </div>
</template>

<style scoped>
.profitBox {border-radius: 12px}
</style>
