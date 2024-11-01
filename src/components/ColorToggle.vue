<template>
  <q-btn
    :color="$q.darkMode? 'primary' : 'secondary'"
    :icon="$q.darkMode? 'dark_mode' : 'light_mode'"
    @click="toggleDarkMode"
  />
</template>

<script setup>
import { useQuasar } from 'quasar';

const $q = useQuasar();

function toggleDarkMode() {
  $q.dark.toggle();
}
</script>
