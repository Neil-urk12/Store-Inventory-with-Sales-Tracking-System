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
          <q-card-section class="card-title-section q-pa-xs" :style="{ color: $q.dark.isActive? 'white' : 'black' }">
            <h5 class="q-my-xs q-mx-xs">Recently Added Products</h5>
          </q-card-section>
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
