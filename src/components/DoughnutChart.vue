<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { Chart, registerables } from "chart.js";

Chart.register(...registerables);

const chartCanvas = ref(null);
let doughnutChart = null;

const data = {
    labels: ["Canned Foods", "Frozen Foods", "Beverages"],
    datasets: [
        {
            label: "Stocks",
            data: [300, 50, 100],
            backgroundColor: ["#FF6384", "#36A2EB", "#FFCE56"],
            hoverOffset: 4,
        },
    ],
}
const options = {
    responsive: true,
    plugins: {
        legend: {
            position: "top",
        },
        title: {
            display: true,
            text: "Product Category by Stocks",
        },
    },
}

onMounted(() => {
    doughnutChart = new Chart(chartCanvas.value, {
        type: "doughnut",
        data: data,
        options: options,
    });
});

onBeforeUnmount(() => {
    if (doughnutChart) doughnutChart.destroy();
});
</script>

<template>
  <div class="chart-container q-border-accent q-border-2" style="height: 300px">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<style scoped>
.chart-container {
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
</style>
