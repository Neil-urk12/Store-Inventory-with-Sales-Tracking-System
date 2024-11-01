<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const chartCanvas = ref(null);
let comboChart = null;
const selectedTimeframe = ref('weekly');

const dailyData = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [
    {
      label: 'Sales',
      data: [30, 40, 50, 60, 70, 80, 90],
      type: 'line',
      borderColor: '#42A5F5',
      fill: false,
      tension: 0.1,
    },
    {
      label: 'Expenses',
      data: [20, 30, 40, 50, 60, 70, 80],
      type: 'bar',
      backgroundColor: '#FF6384',
    }
  ]
};

const weeklyData = {
  labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
  datasets: [
    {
      label: 'Sales',
      data: [150, 200, 250, 300],
      type: 'line',
      borderColor: '#42A5F5',
      fill: false,
      tension: 0.1,
    },
    {
      label: 'Expenses',
      data: [100, 150, 200, 250],
      type: 'bar',
      backgroundColor: '#FF6384',
    }
  ]
};

const monthlyData = {
  labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  datasets: [
    {
      label: 'Sales',
      data: [700, 800, 800, 700, 700, 1000, 1200, 730, 800, 1000, 750, 900, 800],
      type: 'line',
      borderColor: '#42A5F5',
      fill: false,
      tension: 0.1,
    },
    {
      label: 'Expenses',
      data: [500, 600, 700, 800, 900, 1000, 1100, 800, 600, 400, 700,  500, 600],
      type: 'bar',
      backgroundColor: '#FF6384',
    }
  ]
};

const yearlyData = {
  labels: ['2020', '2021', '2022', '2023'],
  datasets: [
    {
      label: 'Sales',
      data: [5000, 6000, 7000, 8000],
      type: 'line',
      borderColor: '#42A5F5',
      fill: false,
      tension: 0.1,
    },
    {
      label: 'Expenses',
      data: [4000, 5000, 6000, 7000],
      type: 'bar',
      backgroundColor: '#FF6384',
    }
  ]
}

const options = {
  responsive: true,
  plugins: {
    legend: {
      position: 'top',
    },
    title: {
      display: true,
      text: 'Sales and Expenses Chart',
    }
  },
  scales: {
    y: {
      beginAtZero: true
    }
  }
};

const updateChart = () => {
  if (comboChart) {
    switch (selectedTimeframe.value) {
      case 'daily':
        comboChart.data = dailyData;
        break;
      case 'weekly':
        comboChart.data = weeklyData;
        break;
      case 'monthly':
        comboChart.data = monthlyData;
        break;
      case 'yearly':
        comboChart.data = yearlyData;
        break;
    }
    comboChart.update()
  }
}


onMounted(() => {
  comboChart = new Chart(chartCanvas.value, {
    type: 'bar',
    data: weeklyData,
    options: options
  })
})

onBeforeUnmount(() => {
  if (comboChart)
    comboChart.destroy()
})
</script>

<template>
    <div class="chart-container" :style="{ color: $q.dark.isActive? 'white' : 'black' }">
        <select v-model="selectedTimeframe" @change="updateChart" class="timeframe-select bg-secondary text-black">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
        </select>
        <canvas ref="chartCanvas"></canvas>
    </div>
</template>

<style scoped>
.chart-container {
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.timeframe-select {
  margin: 4px 0 0 0;
  border: 1px solid #444;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}
.timeframe-select:hover {background-color: #333}
canvas {
  max-width: 600px;
  max-height: 200px
}
</style>
