<script setup>
import { defineAsyncComponent } from 'vue'
const ComboChart = defineAsyncComponent(() => import('../components/home/ComboChart.vue'))
const StockBars = defineAsyncComponent(() => import('../components/home/StockBars.vue'))
const DailyPnl = defineAsyncComponent(() => import('../components/home/DailyPnl.vue'))
const DoughnutChart = defineAsyncComponent(() => import('../components/home/DoughnutChart.vue'))
const DashboardTable = defineAsyncComponent(() => import('../components/home/DashboardTable.vue'))
</script>

<template>
  <q-page class="q-pa-md">
    <div class="row q-col-gutter-md">
      <div class="col-12 col-md-6">
        <q-card class="section-card text-white">
          <Suspense>
            <template #default>
              <ComboChart />
            </template>
            <template #fallback>
              <q-card-section>
                <q-skeleton type="rect" height="200px" animation="wave" />
              </q-card-section>
            </template>
          </Suspense>
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
            <Suspense>
              <template #default>
                <DoughnutChart></DoughnutChart>
              </template>
            </Suspense>
          </q-card-section>
        </q-card>
      </div>
      <div class="col-12 col-md-6">
        <q-card class="section-card text-white">
          <q-card-section>
            <DashboardTable></DashboardTable>
          </q-card-section>
        </q-card>
      </div>
    </div>
  </q-page>
</template>
