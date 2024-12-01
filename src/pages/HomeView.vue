<script setup>
import { defineAsyncComponent } from 'vue'
const StockBars = defineAsyncComponent(() => import('../components/home/StockBars.vue'))
const DailyPnl = defineAsyncComponent(() => import('../components/home/DailyPnl.vue'))
const DoughnutChart = defineAsyncComponent(() => import('../components/home/DoughnutChart.vue'))
const DashboardTable = defineAsyncComponent(() => import('../components/home/DashboardTable.vue'))
const SalesChart = defineAsyncComponent(() => import('../components/reports/SalesChart.vue'))
</script>

<template>
  <q-page class="q-pa-md">
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <q-card class="dashboard-card text-white">
          <Suspense>
            <template #default>
              <q-card-section class="q-pa-md">
                <SalesChart />
              </q-card-section>
            </template>
            <template #fallback>
              <q-card-section class="q-pa-md">
                <q-skeleton type="rect" height="300px" animation="wave" />
              </q-card-section>
            </template>
          </Suspense>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <q-card class="dashboard-card text-white">
          <q-card-section class="q-pa-md content-wrapper">
            <div class="stock-container q-mb-lg">
              <StockBars></StockBars>
            </div>
            <DailyPnl></DailyPnl>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <q-card class="dashboard-card text-white">
          <q-card-section class="q-pa-md">
            <Suspense>
              <template #default>
                <DoughnutChart></DoughnutChart>
              </template>
            </Suspense>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <q-card class="dashboard-card text-white">
          <q-card-section class="q-pa-md">
            <DashboardTable></DashboardTable>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>

<style scoped>
.dashboard-card {
  height: 100%;
  min-height: 400px;
  transition: all 0.3s ease;
}

.dashboard-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.3);
}

.q-card-section {
  height: 100%;
}

.content-wrapper {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  padding-top: 2rem;
  padding-bottom: 2rem;
}

.stock-container {
  width: 100%;
}
</style>
