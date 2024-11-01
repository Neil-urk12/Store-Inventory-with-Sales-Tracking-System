<template>
  <q-btn
    :color="modeColor"
    :icon="darkModeIcon"
    @click="toggleDarkMode"
  />
</template>

<script setup>
import { useQuasar } from 'quasar'
import { watch, ref } from 'vue'
const $q = useQuasar()

const modeColor = ref($q.darkMode? 'yellow' : 'blue')
const darkModeIcon = ref($q.darkMode? 'light_mode' : 'dark_mode')

watch(() => $q.dark.isActive, (newMode) => {
  darkModeIcon.value = newMode? 'light_mode' : 'dark_mode'
  modeColor.value = newMode? 'yellow' : 'blue'
})

function toggleDarkMode() {
  $q.dark.toggle();
}
</script>
