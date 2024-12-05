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
      { path: '/login', name: 'login', component: () => import('pages/LoginView.vue'), meta: { requiresAuth: false } },
      {
        path: '/',
        component: () => import('layouts/MainLayout.vue'),
        children: [
          { path: '/', name: 'home', component: () => import('pages/HomeView.vue'), meta: { requiresAuth: false } },
          { path: '/inventory', component: () => import('pages/InventoryView.vue'), meta: { requiresAuth: false } },
          { path: '/sales', component: () => import('pages/SalesView.vue'), meta: { requiresAuth: false } },
          { path: '/sales/history', component: () => import('pages/SalesHistoryView.vue'), meta: { requiresAuth: false } },
          { path: '/reports', component: () => import('pages/ReportsView.vue'), meta: { requiresAuth: false } },
          { path: '/contacts', component: () => import('pages/ContactsView.vue'), meta: { requiresAuth: false } },
          { path: '/profile', component: () => import('pages/ProfileView.vue'), meta: { requiresAuth: false } },
        ]
      },
      { path: '/:catchAll(.*)*', component: () => import('pages/ErrorNotFound.vue') }
    ],

    // Leave this as is and make changes in quasar.conf.js instead!
    // quasar.conf.js -> build -> vueRouterMode
    // quasar.conf.js -> build -> publicPath
    history: createHistory(process.env.VUE_ROUTER_BASE)
  })

  Router.beforeEach((to, _from, next) => {
    const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true'
    const requiresAuth = to.meta.requiresAuth

    if (requiresAuth && !isAuthenticated)
      next('/login')
    else if (to.path === '/login' && isAuthenticated)
      next('/')
    else
      next()
  })

  return Router
})
