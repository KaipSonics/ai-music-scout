import {test} from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {discover}=require('../.test-dist/scout/discovery.js');
const {candidateFromOwner,evaluateOpportunity,classifyPost}=require('../.test-dist/scout/opportunity.js');
const crm=require('../.test-dist/scout/crm.js');const store=require('../.test-dist/scout/persistence.js');const {configureBackend}=require('../.test-dist/scout/network.js');const vk=require('../.test-dist/scout/vk.js');
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const c=candidateFromOwner(-42,{name:'Артист',description:'Независимый музыкант'}),post={id:1,owner_id:-42,from_id:-42,date:Date.now()/1000,text:'Нужен бит для нового трека'};
test('Russian Cyrillic service boundaries and unrelated live-sound requests',()=>{assert.equal(classifyPost(post).service,'beat');assert.equal(classifyPost({...post,text:'Нужен звукорежиссер на концерт'}),null);assert.equal(evaluateOpportunity(candidateFromOwner(-1,{name:'Студия звукозаписи'}),[{...post,owner_id:-1,from_id:-1}]).kind,'rejected');});
test('cancel aborts in-flight transport and prevents overlapping scan',async()=>{
 const prior=fetch;globalThis.fetch=(_url,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('cancelled','AbortError')),{once:true}));
 try{const controller=new AbortController(),running=discover({token:'test-placeholder',mode:'hot',signal:controller.signal,maxQueries:1});await assert.rejects(discover({token:'test-placeholder',mode:'hot'}),/уже выполняется/);controller.abort();await assert.rejects(running,e=>e.name==='AbortError');
  const cancelled=new AbortController();cancelled.abort();await assert.rejects(discover({token:'test-placeholder',mode:'hot',signal:cancelled.signal}),e=>e.name==='AbortError');
 }finally{globalThis.fetch=prior;}
});
test('unsupported newsfeed falls back to official community walls with visible diagnostic',async()=>{
 const prior=fetch;globalThis.fetch=async url=>new Response(JSON.stringify(url.endsWith('newsfeed.search')?{error:{error_code:15}}:url.endsWith('groups.getById')?{response:[{id:42,name:'Артист',description:'Музыкант'}]}:url.endsWith('groups.search')?{response:{items:[{id:42,name:'Артист',description:'Музыкант'}]}}:{response:{items:[post]}}));
 try{const result=await discover({token:'test-placeholder',mode:'hot',maxQueries:1,maxGroups:1});assert.equal(result.opportunities[0].kind,'hot');assert.equal(result.stats.failures.length,1);assert.equal(result.stats.checkedGroups,1);}finally{globalThis.fetch=prior;}
});
test('backend client keeps secrets in session, uses configured endpoint and generic diagnostics',async()=>{
 assert.throws(()=>configureBackend('http://untrusted.example','k'));configureBackend('https://api.example','test-key');const prior=fetch;
 globalThis.fetch=async(url,init)=>{assert.equal(url,'https://api.example/api/vk/newsfeed.search');assert.equal(init.headers.Authorization,'Bearer test-key');return new Response(JSON.stringify({response:{items:[]}}));};
 try{assert.equal((await vk.searchPosts('mix','test-placeholder',0)).items.length,0);assert.equal(storage.size,0);}finally{globalThis.fetch=prior;configureBackend('','');}
});
test('original CRM adapter preserves legacy data, v3 notes/deal/events, dedupe and export restore',async()=>{
 storage.clear();storage.set('asv_crm_artists',JSON.stringify([{id:'legacy',vk_id:'99',name:'Старый артист',link:'https://vk.com/id99',raw_data:'{}',notes:'Не терять',status:'Ответил',description:'',followers:0,last_activity:'',music_links:'',contacts:'',avatar:''}]));
 const opportunity=evaluateOpportunity(c,[post]);const id=await crm.saveOpportunity(opportunity);assert.equal(await crm.saveOpportunity(opportunity),id);assert.equal((await crm.allArtists()).length,2);
 let artist=await crm.crmInvoke('db_get_artist',{id});artist.notes='Поговорили';artist.value_rub=12000;artist.follow_up='2026-12-10';artist.status='Переговоры';await crm.crmInvoke('db_save_artist',{artist});
 await crm.crmInvoke('db_save_history',{history:{artist_id:id,record_type:'Заметка',content:'Реальный ответ'}});assert((await crm.crmInvoke('db_get_history',{artistId:id})).some(h=>h.content==='Реальный ответ'));
 await crm.crmInvoke('db_update_status',{id,status:'Клиент'});artist=await crm.crmInvoke('db_get_artist',{id});assert.equal(artist.value_rub,12000);assert.equal(artist.notes,'Поговорили');
 const exported=await crm.exportCRM();storage.clear();await crm.importCRM(exported);assert.equal((await crm.allArtists()).length,2);assert.equal((await store.loadRecords())[0].note,'Поговорили');assert.equal((await crm.crmInvoke('db_get_artist',{id:'legacy'})).notes,'Не терять');
});

test('service sellers and distant matched excerpts do not create misleading evidence',()=>{
 assert.equal(classifyPost({...post,text:'Ищу заказчиков на сведение треков'}),null);
 const signal=classifyPost({...post,text:'Текст вступления. '.repeat(100)+'Ищу звукорежиссера для сведения нового трека'});assert(signal.quote.includes('Ищу звукорежиссера'));assert(signal.quote.length<=550);
});
