import {defineStore} from 'pinia';import {ref} from 'vue';
import {safeInvoke} from '../utils/tauriBridge';import {testToken,searchPosts} from '../scout/vk';import {configureBackend} from '../scout/network';
export const useSettingsStore=defineStore('settings',()=>{
 const vkToken=ref(''),tokenUserName=ref(''),isTokenValid=ref<boolean|null>(null);
 let prefs:Record<string,unknown>={};try{prefs=JSON.parse(localStorage.getItem('asv_scout_v3_preferences')||'{}')||{};}catch{}
 const tokenType=ref<'user'|'service'>(prefs.tokenType==='service'?'service':'user');
 const mode=ref<'both'|'hot'|'growth'>(['both','hot','growth'].includes(String(prefs.mode))?prefs.mode as 'both'|'hot'|'growth':'both');
 const maxQueries=ref(Math.max(1,Math.min(8,Number(prefs.maxQueries)||4))),maxGroups=ref(Math.max(1,Math.min(30,Number(prefs.maxGroups)||12))),extraKeywords=ref(String(prefs.extraKeywords||''));
 const backendUrl=ref(String(prefs.backendUrl||'')),backendKey=ref('');
 const offerMixingTemplate=ref('Здравствуйте, {name}! Мы ASV Production. Занимаемся сведением и мастерингом — 12 000 ₽. Подскажите, актуальна ли сейчас помощь с подготовкой материала?');
 const offerArrangementTemplate=ref('Здравствуйте, {name}! Мы ASV Production. Создаём инструменталы и аранжировки — 15 000 ₽. Если у вас есть такая задача, можем обсудить детали.');
 const offerMasteringTemplate=ref('Здравствуйте, {name}! Мы ASV Production. Предлагаем stem-мастеринг — 5 000 ₽. Подскажите, актуален ли этот формат для вашего проекта?');
 const offerProductionTemplate=ref('Здравствуйте, {name}! Мы ASV Production. Работаем над музыкальным продакшном — от 35 000 ₽. Готовы обсудить вашу задачу, если она актуальна.');
 const offerAuditTemplate=ref('Здравствуйте, {name}! Мы ASV Production. Проводим аудит материала — 4 000 ₽. Если нужен разбор, можем обсудить его формат.');
 const entries=[['offer_mixing',offerMixingTemplate],['offer_arrangement',offerArrangementTemplate],['offer_mastering',offerMasteringTemplate],['offer_production',offerProductionTemplate],['offer_audit',offerAuditTemplate]] as const;
 async function loadSettings(){await safeInvoke('db_delete_setting',{key:'vk_token'});for(const [key,value]of entries){const text=await safeInvoke<string>('db_get_setting',{key});if(text&&!/послуш|прослуш|LUFS|премиальн|радио-уров/i.test(text))value.value=text;}configureBackend(backendUrl.value,backendKey.value);}
 function persist(){configureBackend(backendUrl.value,backendKey.value);localStorage.setItem('asv_scout_v3_preferences',JSON.stringify({mode:mode.value,maxQueries:maxQueries.value,maxGroups:maxGroups.value,extraKeywords:extraKeywords.value,tokenType:tokenType.value,backendUrl:backendUrl.value}));}
 async function saveVkToken(token:string){vkToken.value=token.trim();isTokenValid.value=null;tokenUserName.value='';await safeInvoke('db_delete_setting',{key:'vk_token'});}
 async function verifyToken(){persist();tokenUserName.value='';isTokenValid.value=null;try{if(tokenType.value==='service'){await searchPosts('ASV Production',vkToken.value,Math.floor(Date.now()/1000-86400));tokenUserName.value='Сервисный токен: newsfeed.search доступен';}else tokenUserName.value=await testToken(vkToken.value);isTokenValid.value=true;return tokenUserName.value;}catch(e){isTokenValid.value=false;throw e;}}
 async function saveSettings(token:string,mixing:string,arrangement:string,mastering:string,production=offerProductionTemplate.value,audit=offerAuditTemplate.value){
 const texts=[mixing,arrangement,mastering,production,audit];if(texts.some(t=>/послуш|прослуш/i.test(t)))throw new Error('Уберите утверждение о прослушивании из автоматического шаблона');
 persist();await saveVkToken(token);for(let i=0;i<entries.length;i++){entries[i][1].value=texts[i];await safeInvoke('db_set_setting',{key:entries[i][0],value:texts[i]});}
 }
 return{tokenType,vkToken,tokenUserName,isTokenValid,mode,maxQueries,maxGroups,extraKeywords,backendUrl,backendKey,persist,loadSettings,saveVkToken,verifyToken,saveSettings,offerMixingTemplate,offerArrangementTemplate,offerMasteringTemplate,offerProductionTemplate,offerAuditTemplate};
});
