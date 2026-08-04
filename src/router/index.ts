import { createRouter, createWebHistory } from 'vue-router';
import Search from '../views/Search.vue';
import CRM from '../views/CRM.vue';
import ArtistCard from '../views/ArtistCard.vue';
import Settings from '../views/Settings.vue';

const routes = [
  { path: '/', redirect: '/crm' },
  { path: '/search', component: Search },
  { path: '/crm', component: CRM },
  { path: '/artist/:id', component: ArtistCard },
  { path: '/settings', component: Settings },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
