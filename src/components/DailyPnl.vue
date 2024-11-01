<script setup>
import { ref } from 'vue'
const dailyProfit = ref(1000);
const dailyExpense = ref(500);
</script>

<template>
  <div class="dailyPNLcontainer">
    <div class="profitBox bg-accent">
        <p>Today's Profit : +{{ dailyProfit }}</p>
        <p>Today's Loss : -{{ dailyExpense }}</p>
    </div>
  </div>
</template>

<style scoped>
*{
  margin: 0;
}
p{
  margin: 0;
}
.dailyPNLcontainer {
  color:#fff;
  width: 100%;
  padding: 0.5rem 1rem;
  display: flex;
  flex-direction: column;
}
.profitBox {
  display: flex;
  justify-content: space-evenly;
  align-items: center;
  flex-direction: row;
  width: 100%;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}
</style>
