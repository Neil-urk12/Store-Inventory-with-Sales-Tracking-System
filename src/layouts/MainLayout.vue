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
          @click="leftDrawerOpen = !leftDrawerOpen"
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
         <ColorToggle class="bg-accent q-mt-md q-ml-md"></ColorToggle>
        <q-space></q-space>
        <q-btn flat dense aria-label="sign out" class="bg-primary q-ml-md q-mt-md q-px-md" @click="logout">
          Sign out
        </q-btn>
      </q-list>
    </q-drawer>

    <q-page-container>
      <RouterView/>
    </q-page-container>
    <!-- <q-footer reveal bordered class="bg-primary text-white" v-show="isAtBottomOfPage">
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
    </q-footer> -->
  </q-layout>
</template>

<script setup>
import { defineAsyncComponent, ref } from 'vue'
const EssentialLink = defineAsyncComponent(() => import('src/components/layout/EssentialLink.vue'))
const ColorToggle = defineAsyncComponent(() => import('src/components/layout/ColorToggle.vue'))
import { useAuthStore } from 'src/stores/authStore'
import { useRouter } from 'vue-router';

const router = useRouter()
const authStore = useAuthStore()

defineOptions({
  name: 'MainLayout'
})

async function logout (){
  await authStore.logout()
  localStorage.removeItem("isAuthenticated")
  router.push('/login')
}

const linksList = [
  { title: 'Dashboard', icon: 'dashboard', link: '/' },
  { title: 'Inventory', icon: 'inventory', link: '/inventory' },
  { title: 'Reports', icon: 'analytics', link: '/reports' },
  { title: 'Contacts', icon: 'contacts', link: '/contacts' },
]

const leftDrawerOpen = ref(false)
</script>
