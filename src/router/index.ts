import { createRouter, createWebHashHistory } from 'vue-router';
import Search from '../views/Search.vue';
import CRM from '../views/CRM.vue';
import ArtistCard from '../views/ArtistCard.vue';
import Settings from '../views/ScoutSettingsView.vue';
import OpportunityFeed from '../views/OpportunityFeed.vue';
import ScoutCRM from '../views/ScoutCRMView.vue';
import Analytics from '../views/AnalyticsView.vue';

const routes = [
  { path: '/', redirect: '/radar' },
  { path: '/search', component: Search },
  { path: '/radar', component: OpportunityFeed },
  { path: '/analytics', component: Analytics },
  { path: '/crm', component: ScoutCRM },
  { path: '/legacy-crm', component: CRM },
  { path: '/artist/:id', component: ArtistCard },
  { path: '/settings', component: Settings },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});
