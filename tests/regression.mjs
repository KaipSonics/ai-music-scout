import {createRequire} from 'node:module';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {evaluateOpportunity,candidateFromOwner,draftOutreach,classifyPost}=require('../.test-dist/scout/opportunity.js');
const crm=require('../.test-dist/scout/persistence.js');
const vk=require('../.test-dist/scout/vk.js');
const {safeInvoke}=require('../.test-dist/utils/tauriBridge.js');
const {inspectManualPost,discover}=require('../.test-dist/scout/discovery.js');
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const now=Date.now(),c=candidateFromOwner(-42,{name:'Независимый артист',screen_name:'artist'});
const p=(text='Ищу звукорежиссера для сведения EP',extra={})=>({id:1,owner_id:-42,from_id:-42,date:Math.floor(now/1000),text,...extra});
const o=()=>evaluateOpportunity(c,[p()]);
test('score is exactly the published weighted sum',()=>{const v=o(),f=v.factors;assert.equal(v.score,Math.round(f.need*.35+f.timing*.25+f.fit*.2+f.activity*.1+f.contact*.1));});
test('audience does not change commercial score',()=>assert.equal(o().score,evaluateOpportunity({...c,membersCount:9000000},[p()]).score));
test('third-party wall and unknown byline are not attributed to artist',()=>{
 for(const extra of [{from_id:99},{from_id:undefined},{owner_id:99}])assert.equal(evaluateOpportunity(c,[p(undefined,extra)]).score,null);
});
test('third-party requests, resolved requests, spam, and invalid posts rejected',()=>{
 for(const text of ['Неактуально, ищу звукорежиссера','Мой друг ищет звукорежиссера','Предлагаю сведение, ищу клиентов','Ищут звукорежиссера','Поиск закрыт, нужен бит'])assert.equal(classifyPost(p(text)),null,text);
 for(const extra of [{id:0},{owner_id:0},{date:NaN},{date:now/1000+86400},{marked_as_ads:1},{copy_history:[{}]}])assert.equal(classifyPost(p(undefined,extra)),null);
});
test('active growth excludes duplicate, future, repost and foreign posts',()=>{
 const rows=[p('Музыка'),p('Музыка'),p('Музыка')];assert.notEqual(evaluateOpportunity(c,rows).kind,'growth');
});
test('manual entry has no verified score and no claimed listening',()=>{
 const m=inspectManualPost('https://vk.com/wall-42_1','Ищу звукорежиссера','Артист',new Date().toISOString().slice(0,10));
 assert.equal(m.source,'manual');assert.equal(m.score,null);assert(!/послуш|прослуш|радио-уров/i.test(draftOutreach(m)));assert(draftOutreach(m).includes('https://vk.com/wall-42_1'));
});
test('dedupe across concurrent scans and preserve notes/status/revenue',async()=>{
 storage.clear();await Promise.all([crm.mergeScan([o()]),crm.mergeScan([o()])]);assert.equal((await crm.loadRecords()).length,1);
 await Promise.all([crm.updateRecord(c.id,{note:'Важный контекст'}),crm.updateRecord(c.id,{status:'contacted'})]);
 await crm.updateRecord(c.id,{status:'replied'});await crm.updateRecord(c.id,{status:'won',valueRub:12000});await crm.mergeScan([o()]);
 let rows=await crm.loadRecords();assert.equal(rows[0].note,'Важный контекст');assert.equal(rows[0].status,'won');assert.equal(rows[0].valueRub,12000);assert.equal(crm.summarize(rows).revenue,12000);
 await crm.updateRecord(c.id,{status:'lost'});rows=await crm.loadRecords();assert.equal(crm.summarize(rows).contacted,1);assert.equal(crm.summarize(rows).replies,1);assert.equal(crm.summarize(rows).revenue,0);
});
test('successful recheck removes canceled signal, does not keep historical max',async()=>{
 storage.clear();await crm.mergeScan([o()]);await crm.mergeScan([evaluateOpportunity(c,[p('Уже нашли звукорежиссера')])]);assert.equal((await crm.loadRecords())[0].opportunity.score,null);
});
test('loaded opportunity expires automatically without rescanning',async()=>{
 storage.clear();await crm.mergeScan([o()]);const raw=JSON.parse(storage.get('asv_scout_v3_records'));raw[0].opportunity.observedPosts[0].date-=40*86400;storage.set('asv_scout_v3_records',JSON.stringify(raw));assert.equal((await crm.loadRecords())[0].opportunity.score,null);
});
test('JSON restore preserves current notes and rejects corruption/demo',async()=>{
 storage.clear();await crm.mergeScan([o()]);const snapshot=crm.exportRecords(await crm.loadRecords());await crm.updateRecord(c.id,{note:'Новая заметка'});assert.equal((await crm.importRecords(snapshot)).records[0].note,'Новая заметка');
 await assert.rejects(crm.importRecords('{invalid'));const bad=JSON.parse(snapshot);bad.records[0].status='fake';await assert.rejects(crm.importRecords(JSON.stringify(bad)));
 await crm.mergeScan([{...o(),source:'demo',id:'group:88'}]);assert.equal((await crm.loadRecords()).length,1);
 storage.set('asv_scout_v3_records','{bad');await assert.rejects(crm.mergeScan([o()]));assert.equal(storage.get('asv_scout_v3_records'),'{bad');
});
test('legacy user/group namespace, status, notes, history survive import',async()=>{
 storage.clear();storage.set('asv_crm_artists',JSON.stringify([{id:'a',vk_id:'42',name:'User',link:'https://vk.com/id42',status:'Ответил',notes:'user note'},{id:'b',vk_id:'42',name:'Group',link:'https://vk.com/club42',status:'Клиент',notes:'group note'},{id:'c',vk_id:'99',name:'Ambiguous',link:'https://vk.com/custom',status:'Новый'}]));
 storage.set('asv_crm_history',JSON.stringify([{artist_id:'a',content:'Ответ по задаче',created_at:new Date().toISOString()}]));
 assert.equal(await crm.importLegacyWeb(),2);assert.equal(await crm.importLegacyWeb(),0);const rows=await crm.loadRecords();assert.equal(rows.find(r=>r.id==='user:42').status,'replied');assert.equal(rows.find(r=>r.id==='group:42').note,'group note');assert.equal(rows.find(r=>r.id==='user:42').history[0].text,'Ответ по задаче');assert.equal((await safeInvoke('db_get_artists')).length,3);
});
test('web legacy CRM supports upsert, notes, status, delete, history',async()=>{
 storage.clear();const id=await safeInvoke('db_save_artist',{artist:{vk_id:'9',name:'A'}});await safeInvoke('db_save_artist',{artist:{vk_id:'9',name:'B'}});assert.equal((await safeInvoke('db_get_artists')).length,1);await safeInvoke('db_update_notes',{id,notes:'note'});await safeInvoke('db_update_status',{id,status:'Ответил'});assert.equal((await safeInvoke('db_get_artist',{id})).notes,'note');await safeInvoke('db_save_history',{artistId:id,recordType:'note',content:'test'});assert.equal((await safeInvoke('db_get_history',{artistId:id})).length,1);await safeInvoke('db_delete_artist',{id});assert.equal((await safeInvoke('db_get_artists')).length,0);
});
test('AI errors, timeouts and malformed JSON never yield invented score',async()=>{
 for(const command of ['ai_profile_candidate_v2','ai_generate_team_message','ai_analyze'])await assert.rejects(safeInvoke(command),/заменены/);
});
test('VK invalid token, rate limit, network, malformed JSON and empty results',async()=>{
 const original=globalThis.fetch;try{
  for(const [code,match] of [[5,/токен/],[6,/Лимит/],[15,/доступ/]]){globalThis.fetch=async()=>new Response(JSON.stringify({error:{error_code:code,error_msg:'secret-value'}}));await assert.rejects(vk.searchPosts('test','test-placeholder',0),match);}
  globalThis.fetch=async()=>{throw new Error('secret-value')};await assert.rejects(vk.searchPosts('test','test-placeholder',0),e=>!e.message.includes('secret-value')&&/сет/.test(e.message));
  globalThis.fetch=async()=>new Response('{invalid');await assert.rejects(vk.searchPosts('test','test-placeholder',0),/JSON/);
  globalThis.fetch=async()=>new Response(JSON.stringify({response:{items:[]}}));assert.equal((await vk.searchPosts('test','test-placeholder',0)).items.length,0);
  globalThis.fetch=async()=>new Response(JSON.stringify({response:{items:'bad'}}));await assert.rejects(vk.searchPosts('test','test-placeholder',0),/некорректный/);
 }finally{globalThis.fetch=original;}
});
test('VK uses bounded deterministic queries with token only in POST body',async()=>{
 const original=fetch;let calls=0;globalThis.fetch=async(url,init)=>{calls++;assert(!url.includes('access_token'));assert.equal(init.method,'POST');assert.equal(init.body.get('access_token'),'test-placeholder');return new Response(JSON.stringify({response:url.endsWith('groups.getById')?[{id:42,name:'Artist',description:'Независимый музыкант'}]:{items:[p()],groups:[{id:42,name:'Artist',description:'Независимый музыкант'}]}}));};
 try{const report=await discover({token:'test-placeholder',mode:'hot',maxQueries:1});assert.equal(calls,2);assert.equal(report.opportunities.length,1);}finally{globalThis.fetch=original;}
});
test('desktop VK adapter preserves signed owner ID and explicit rate-limit failure',async()=>{
 const old=globalThis.window;globalThis.window={__TAURI_INTERNALS__:{invoke:async(command,args)=>{assert.equal(command,'vk_get_wall_v3');assert.equal(args.ownerId,-42);return {items:[p()]};}}};
 try{assert.equal((await vk.getWall(c,'test-placeholder'))[0].owner_id,-42);
  window.__TAURI_INTERNALS__.invoke=async()=>{throw 'VK newsfeed.search (6): Лимит запросов';};
  await assert.rejects(vk.searchPosts('test','test-placeholder',0),e=>e instanceof vk.VkApiError&&e.code===6);
 }finally{if(old===undefined)delete globalThis.window;else globalThis.window=old;}
});
test('audit and published release are recognized without inventing demand',()=>{
 assert.equal(classifyPost(p('Нужен аудит материала')).service,'audit');
 const result=evaluateOpportunity(c,[p('Вышел новый трек на площадках')]);assert.equal(result.kind,'growth');assert.equal(result.service,null);
});
