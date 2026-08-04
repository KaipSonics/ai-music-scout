import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

import Search from './views/Search.vue'
import ArtistCard from './views/ArtistCard.vue'
import CRM from './views/CRM.vue'
import Settings from './views/Settings.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/crm' },
    { path: '/search', component: Search },
    { path: '/artist/:id', component: ArtistCard },
    { path: '/crm', component: CRM },
    { path: '/settings', component: Settings },
  ]
})

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')
