import { route } from 'quasar/wrappers'
import { createRouter, createMemoryHistory, createWebHistory, createWebHashHistory } from 'vue-router'

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default route(function (/* { store, ssrContext } */) {
  const createHistory = process.env.SERVER
    ? createMemoryHistory
    : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

  const Router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes:[
      { path: '/', component: () => import('layouts/MainLayout.vue'),
        children: [
          { path: '', component: () => import('pages/HomeView.vue') },
          { path: '/inventory', component: () => import('pages/InventoryView.vue') },
          { path: '/reports', component: () => import('pages/ReportsView.vue') },
          { path: '/contacts', component: () => import('pages/ContactsView.vue') },
          { path: '/profile', component: () => import('pages/ProfileView.vue') },
        ]
      },
      { path: '/:catchAll(.*)*', component: () => import('pages/ErrorNotFound.vue') },
      { path: '/login', component: () => import('pages/LoginPage.vue') },
      { path: '/register', component: () => import('pages/RegisterPage.vue') },
      { path: '/forgot-password', component: () => import('pages/ForgotPasswordPage.vue') },
      { path: '/reset-password', component: () => import('pages/ResetPasswordPage.vue') },
      { path: '/dashboard', component: () => import('pages/DashboardPage.vue') },
      { path: '/change-password', component: () => import('pages/ChangePasswordPage.vue') },
      { path: '/change-email', component: () => import('pages/ChangeEmailPage.vue') },
      { path: '/settings', component: () => import('pages/SettingsPage.vue') },
      { path: '/about', component: () => import('pages/AboutPage.vue') },
    ],

    // Leave this as is and make changes in quasar.conf.js instead!
    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE)
  })

  return Router
})
