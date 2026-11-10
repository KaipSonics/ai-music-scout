import {createRouter,createWebHashHistory} from 'vue-router';
import Search from '../views/SearchView.vue';
import CRM from '../views/CRMView.vue';
import Artist from '../views/ArtistView.vue';
import Settings from '../views/SettingsView.vue';
export const router=createRouter({history:createWebHashHistory(),routes:[
 {path:'/',redirect:'/crm'},{path:'/search',component:Search},{path:'/crm',component:CRM},
 {path:'/settings',component:Settings},{path:'/artist/:id',component:Artist},
 {path:'/radar',redirect:'/search'},{path:'/legacy-crm',redirect:'/crm'},
 {path:'/:pathMatch(.*)*',redirect:'/search'}]});
