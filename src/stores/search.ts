import {defineStore} from 'pinia';
import {computed,ref} from 'vue';
import {discover,type ScanStats} from '../scout/discovery';
import {reconcileScan} from '../scout/persistence';
import {candidateFromOwner,evaluateOpportunity,type Opportunity} from '../scout/opportunity';
import {useSettingsStore} from './settings';
export const useSearchStore=defineStore('search',()=>{
 const userSearchQuery=ref(''),results=ref<Opportunity[]>([]),filter=ref('all'),demo=ref(false);
 const currentStep=ref(0),stepMessage=ref(''),error=ref(''),isSearching=ref(false),report=ref<ScanStats|null>(null),state=ref<'idle'|'searching'|'ready'|'empty'|'error'|'cancelled'>('idle');
 let controller:AbortController|undefined;let generation=0;
 const filteredResults=computed(()=>results.value.filter(o=>filter.value==='all'||o.kind===filter.value).map(o=>({id:o.id,name:o.candidate.name,description:o.candidate.description,members_count:o.candidate.membersCount,screen_name:o.candidate.screenName,photo_200:o.candidate.avatar,photo_100:undefined as string|undefined,city:undefined as {title:string}|undefined,opportunity:o})));
 const evidenceMap=computed(()=>Object.fromEntries(results.value.map(o=>[o.id,{artist_type:o.kind==='hot'?'HOT LEAD':'GROWTH LEAD',commercial_score:o.score,summary:o.reasons[0],asv_reason:o.reasons.join(' · ')}])));
 async function start(){if(isSearching.value)return;const settings=useSettingsStore();if(!settings.vkToken){error.value='Укажите VK-токен в настройках или откройте демонстрацию';state.value='error';return;}
  const run=++generation;controller=new AbortController();isSearching.value=true;error.value='';report.value=null;results.value=[];demo.value=false;currentStep.value=1;state.value='searching';
  try{const data=await discover({token:settings.vkToken,tokenType:settings.tokenType,mode:settings.mode,maxGroups:settings.maxGroups,maxQueries:settings.maxQueries,terms:settings.extraKeywords.split(',').filter(Boolean),growthTerms:userSearchQuery.value.split(',').map(s=>s.trim()).filter(Boolean),signal:controller.signal},p=>{if(run===generation){currentStep.value=p.stage.includes('Проверка')?3:2;stepMessage.value=p.stage;}});
   if(run!==generation)return;await reconcileScan(data.checked);if(run!==generation)return;
   results.value=data.opportunities;report.value=data.stats;currentStep.value=4;state.value=results.value.length?'ready':data.stats.failures.length?'error':'empty';stepMessage.value=results.value.length?'Результаты готовы':'Подходящих возможностей не найдено';
   if(data.stats.failures.length)error.value='Часть источников недоступна. Откройте диагностику поиска.';
  }catch(e){if(run!==generation)return;currentStep.value=0;if((e as Error).name==='AbortError'){state.value='cancelled';stepMessage.value='Поиск отменён пользователем';}else{state.value='error';error.value=String(e);}}
  finally{if(run===generation)isSearching.value=false;}
 }
 function cancel(){controller?.abort();generation++;isSearching.value=false;currentStep.value=0;state.value='cancelled';stepMessage.value='Поиск отменён пользователем';}
 function showDemo(){if(isSearching.value)return;demo.value=!demo.value;results.value=[];error.value='';report.value=null;currentStep.value=0;state.value='idle';if(!demo.value)return;
  const now=Date.now();results.value=[['NEON WAVES','Ищу звукорежиссера для сведения EP'],['SOUTH SIDE','Нужен битмейкер для нового сингла'],['APARTMENT SOUNDS','Записываем новый альбом'],['MIDNIGHT LINE','Вышел новый трек']].map(([name,text],i)=>{const owner=-1101-i;return evaluateOpportunity(candidateFromOwner(owner,{name,description:'Независимый музыкальный артист',screen_name:'example'+i,members_count:1200+i*200}),[{id:100+i,owner_id:owner,from_id:owner,date:Math.floor(now/1000)-86400*(i+1),text}],'demo');});state.value='ready';
 }
 return {userSearchQuery,filteredResults,evidenceMap,filter,results,demo,currentStep,stepMessage,error,isSearching,report,state,start,cancel,showDemo};
});
