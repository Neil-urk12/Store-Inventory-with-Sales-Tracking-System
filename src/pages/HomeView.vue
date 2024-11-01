<template>
  <q-page class="q-pa-md">
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <q-card class="section-card text-white">
          <q-card-section>
            <ComboChart></ComboChart>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card class="section-card text-white">
          <q-card-section>
            <StockBars></StockBars>
            <DailyPnl></DailyPnl>
          </q-card-section>
        </q-card>
      </div>

      <div class="col-12 col-md-6">
        <q-card class="section-card text-white text-center q-pa-md">
          <q-card-section>
            <DoughnutChart></DoughnutChart>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <q-card class="section-card text-white">
          <q-card-title class="text-h5 q-my-md q-mx-md" :style="{ color: $q.dark.isActive? 'white' : 'black' }">Recently Added Products</q-card-title>
          <q-card-section>
            <DashboardTable></DashboardTable>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<script setup>
import ComboChart from '../components/ComboChart.vue'
import StockBars from '../components/StockBars.vue'
import DailyPnl from '../components/DailyPnl.vue'
import DoughnutChart from '../components/DoughnutChart.vue'
import DashboardTable from '../components/DashboardTable.vue'


</script>
