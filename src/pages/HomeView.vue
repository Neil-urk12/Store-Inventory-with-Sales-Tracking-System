<script setup>
import { defineAsyncComponent } from 'vue'
const StockBars = defineAsyncComponent(() => import('../components/home/StockBars.vue'))
const DailyPnl = defineAsyncComponent(() => import('../components/home/DailyPnl.vue'))
const DoughnutChart = defineAsyncComponent(() => import('../components/home/DoughnutChart.vue'))
const DashboardTable = defineAsyncComponent(() => import('../components/home/DashboardTable.vue'))
const SalesChart = defineAsyncComponent(() => import('../components/reports/SalesChart.vue'))
</script>

<template>
  <q-page class="q-pa-md" role="main" aria-label="Home">
    <div class="row q-col-gutter-md" role="group" aria-label="Dashboard Charts">
      <div class="col-12 col-md-6" role="group" aria-label="Sales Chart">
        <q-card class="dashboard-card text-white" aria-label="Sales Chart Card">
          <Suspense aria-label="Sales Chart Loading">
            <template #default>
              <q-card-section class="q-pa-md" aria-label="Sales Chart Section">
                <SalesChart aria-label="Sales Chart Component"/>
              </q-card-section>
            </template>
            <template #fallback>
              <q-card-section class="q-pa-md" aria-label="Sales Chart Loading">
                <q-skeleton type="rect" height="300px" animation="wave" aria-label="Loading Sales Chart" />
              </q-card-section>
            </template>
          </Suspense>
        </q-card>
      </div>
      <div class="col-12 col-md-6" role="group" aria-label="Stock and PNL">
        <q-card class="dashboard-card text-white" aria-label="Stock and PNL Card">
          <q-card-section class="q-pa-md content-wrapper" aria-label="Stock and PNL Section">
            <div class="stock-container q-mb-lg" role="region" aria-label="Stock Bars">
              <StockBars aria-label="Stock Bars Component"/>
            </div>
            <DailyPnl aria-label="Daily PNL Component"/>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6" role="group" aria-label="Product Distribution">
        <q-card class="dashboard-card text-white" aria-label="Product Distribution Card">
          <q-card-section class="q-pa-md" aria-label="Product Distribution Section">
            <Suspense aria-label="Product Distribution Loading">
              <template #default>
                <DoughnutChart aria-label="Product Distribution Chart"/>
              </template>
            </Suspense>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <q-card class="dashboard-card text-white">
          <div class="col-12 col-md-6" role="group" aria-label="Recent Sales">
            <q-card class="dashboard-card text-white" aria-label="Recent Sales Card">
              <q-card-section class="q-pa-md" aria-label="Recent Sales Section"><DashboardTable aria-label="Recent Sales Table"/></q-card-section>
            </q-card>
          </div>
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
