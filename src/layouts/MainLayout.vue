<template>
  <q-layout view="hHh lpR lFf">
    <q-header elevated>
      <q-toolbar>
        <q-btn
          flat
          dense
          round
          icon="menu"
          aria-label="Menu"
          @click="toggleLeftDrawer"
        />

        <q-toolbar-title>
          <div class="absolute-center bg-primary">
            NJL Inventory System
          </div>
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-drawer
      v-model="leftDrawerOpen"
      show-if-above
      overlay behavior="desktop"
      bordered
    >
      <q-list>
        <q-item-label
          header
        >
          NJL Store Inventory System
        </q-item-label>
        <EssentialLink
          v-for="link in linksList"
          :key="link.title"
          v-bind="link"
        />
        <ColorToggle class="bg-accent"></ColorToggle>
      </q-list>
    </q-drawer>

    <q-page-container>
      <RouterView/>
    </q-page-container>
    <q-footer reveal bordered class="bg-primary text-white" v-show="isAtBottomOfPage">
      <q-toolbar>
        <q-toolbar-title class="row justify-center">
          <div class="col-12 col-md-6 text-center">
            <div class="text-h6">NJL Inventory System</div>
            <div class="text-caption">Copyright {{ copyrightYear }} NJL Inventory System. All rights reserved.</div>
            <div class="text-caption">Developed by: <a href="#" target="_blank" class="text-white">Neil Jhonreise Vallecer</a></div>
            <SocialMediaLinks></SocialMediaLinks>
          </div>
        </q-toolbar-title>
      </q-toolbar>
    </q-footer>
  </q-layout>
</template>

<script setup>
import { useScroll } from '@vueuse/core'
import { ref, watch } from 'vue'
import EssentialLink from 'components/EssentialLink.vue'
import ColorToggle from 'components/ColorToggle.vue'
import SocialMediaLinks from 'src/components/SocialMediaLinks.vue'

const isAtBottomOfPage = ref(false);
const { y } = useScroll(document)

watch(y, (newValue) => {
  const isAtBottom = newValue + window.innerHeight >= document.documentElement.scrollHeight;
  isAtBottomOfPage.value = isAtBottom;
});

defineOptions({
  name: 'MainLayout'
})

const linksList = [
  {
    title: 'Dashboard',
    icon: 'dashboard',
    link: '/'
  },
  {
    title: 'Inventory',
    icon: 'inventory',
    link: '/inventory'
  },
  {
    title: 'Reports',
    icon: 'analytics',
    link: '/reports'
  },
  {
    title: 'Contacts',
    icon: 'contacts',
    link: '/contacts'
  },
  {
    title: 'Profile',
    icon: 'person',
    link: '/profile'
  },
  {
    title: 'Facebook',
    icon: 'public',
    link: 'https://facebook.quasar.dev'
  },
  {
    title: 'Quasar Awesome',
    icon: 'favorite',
    link: 'https://awesome.quasar.dev'
  }
]

const leftDrawerOpen = ref(false)

function toggleLeftDrawer () {
  leftDrawerOpen.value = !leftDrawerOpen.value
}
</script>
