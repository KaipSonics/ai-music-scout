import {isTauri, safeInvoke} from '../utils/tauriBridge';
import {candidateFromOwner,evaluateOpportunity,STATUS_LABEL,type Opportunity,type LeadStatus} from './opportunity';
const KEY='asv_scout_v3_records';
const MAX_RECORDS=2500;
export interface ActivityEvent { at:string; type:'status'|'note'|'scan'|'followup'|'conversion'; text:string }
export interface LeadRecord {
 profile?:{name?:string;description?:string;contacts?:string;music_links?:string};
 id:string; opportunity:Opportunity; status:LeadStatus; note:string; firstSeen:string; lastSeen:string;
 contactedAt?:string; repliedAt?:string; negotiatingAt?:string; followUpAt?:string; wonAt?:string; valueRub?:number; history:ActivityEvent[];
}
function validateRecord(r:unknown):r is LeadRecord {
 if(!r||typeof r!=='object')return false;
 const v=r as LeadRecord,o=v.opportunity,c=o?.candidate;
 return typeof v.id==='string' && /^(group|user):[1-9]\d*$/.test(v.id) && v.id===o?.id && c?.id===v.id &&
   typeof c.name==='string' && Number.isSafeInteger(c.ownerId) && c.ownerId!==0 && candidateFromOwner(c.ownerId).id===v.id &&
   typeof c.profileUrl==='string' && /^https:\/\/(?:m\.)?vk\.(?:com|ru)\//.test(c.profileUrl) &&
   (v.profile===undefined || Object.values(v.profile).every(x=>typeof x==='string')) && typeof v.note==='string' && typeof v.firstSeen==='string' && typeof v.lastSeen==='string' &&
   Object.hasOwn(STATUS_LABEL,v.status) && Array.isArray(v.history) && v.history.every(e=>typeof e?.at==='string'&&typeof e.text==='string') &&
   ['hot','growth','watch','rejected'].includes(o.kind) && ['community','newsfeed','manual'].includes(o.source) &&
   Array.isArray(o.signals) && o.signals.every(s=>typeof s?.id==='string'&&typeof s.quote==='string'&&/^https:\/\/vk.com\/wall-?\d+_\d+$/.test(s.url)&&Number.isFinite(Date.parse(s.publishedAt))) &&
   Array.isArray(o.reasons) && (o.score===null || (Number.isFinite(o.score)&&o.score>=0&&o.score<=100)) &&
   (v.valueRub===undefined || (Number.isFinite(v.valueRub)&&v.valueRub>=0));
}
function refreshed(r:LeadRecord):LeadRecord {
 const o=r.opportunity;
 // Re-evaluate at today's date. Historical scores must never stay hot indefinitely.
 const posts=o.observedPosts||o.signals.map(s=>({id:Number(s.id.split('_').at(-1)),owner_id:s.sourceOwnerId,from_id:s.authorId,date:Date.parse(s.publishedAt)/1000,text:s.quote}));
 const current=evaluateOpportunity(o.candidate,posts,o.source);
 current.assessedAt=o.assessedAt;
 current.signals=current.signals.map(s=>({...s,capturedAt:o.signals.find(x=>x.id===s.id)?.capturedAt||o.assessedAt}));
 return {...r,opportunity:current};
}
async function readRecords():Promise<LeadRecord[]> {
 let data:unknown;
 if(isTauri())data=await safeInvoke<unknown>('scout_get_records');
 else {try{data=JSON.parse(localStorage.getItem(KEY)||'[]');}catch{throw new Error('CRM повреждена. Данные не перезаписаны; восстановите JSON-экспорт.');}}
 if(!Array.isArray(data)||!data.every(validateRecord))throw new Error('Некорректная запись CRM. Автоматическая перезапись отключена. Восстановите экспорт.');
 return data;
}
export async function loadRecords():Promise<LeadRecord[]> {return (await readRecords()).map(refreshed);}
async function saveAll(records:LeadRecord[]):Promise<void> {
 if(records.length>MAX_RECORDS)throw new Error('Лимит CRM 2500 контактов. Существующие данные сохранены.');
 if(!records.every(validateRecord))throw new Error('Некорректные данные CRM');
 if(isTauri())await safeInvoke('scout_save_records',{records});
 else { const before=localStorage.getItem(KEY); if(before!==null)localStorage.setItem(KEY+'_backup',before);localStorage.setItem(KEY,JSON.stringify(records)); }
}
let pending:Promise<unknown>=Promise.resolve();
function mutate<T>(operation:()=>Promise<T>):Promise<T> {
 const run=()=>typeof navigator!=='undefined' && navigator.locks ? navigator.locks.request(KEY,operation):operation();
 const next=pending.then(run,run);pending=next.catch(()=>{});return next;
}
export function mergeScan(found:Opportunity[]):Promise<LeadRecord[]> {return mutate(async()=>{
 const records=await readRecords(),byId=new Map(records.map(r=>[r.id,r]));
 for(const o of found){
   if(o.source==='demo')continue;
   const old=byId.get(o.id),at=new Date().toISOString();
   if(!old && (o.kind==='watch'||o.kind==='rejected'))continue;
   const opportunity={...o};
   if(!old)byId.set(o.id,{id:o.id,opportunity,status:'new',note:'',firstSeen:at,lastSeen:at,history:[{at,type:'scan',text:'Найден новый сигнал'}]});
   else byId.set(o.id,{...old,opportunity,lastSeen:at,history:[...old.history,{at,type:'scan' as const,text:'Повторная проверка: '+o.kind}]});
 }
 const next=[...byId.values()];await saveAll(next);return next.map(refreshed);
});}
export function updateRecord(id:string,changes:Partial<Pick<LeadRecord,'status'|'note'|'followUpAt'|'valueRub'>>):Promise<LeadRecord[]> {return mutate(async()=>{
 const rows=await readRecords(),i=rows.findIndex(r=>r.id===id);if(i<0)throw new Error('Лид не найден');
 if(changes.status && !Object.hasOwn(STATUS_LABEL,changes.status))throw new Error('Некорректный статус');
 if(changes.valueRub!==undefined && (!Number.isFinite(changes.valueRub)||changes.valueRub<0))throw new Error('Некорректная сумма');
 if(changes.followUpAt && !/^\d{4}-\d{2}-\d{2}$/.test(changes.followUpAt))throw new Error('Некорректная дата');
 const prev=rows[i],at=new Date().toISOString(),events:ActivityEvent[]=[];
 if(changes.status && changes.status!==prev.status)events.push({at,type:'status',text:`Статус: ${prev.status} → ${changes.status}`});
 if(changes.note!==undefined && changes.note!==prev.note)events.push({at,type:'note',text:changes.note||'Заметка очищена'});
 if(changes.followUpAt!==undefined && changes.followUpAt!==prev.followUpAt)events.push({at,type:'followup',text:'Напоминание: '+(changes.followUpAt||'снято')});
 if(changes.valueRub!==undefined && changes.valueRub!==prev.valueRub)events.push({at,type:'conversion',text:`Сумма заказа: ${changes.valueRub} ₽`});
 const status=changes.status;
 rows[i]={...prev,...changes,contactedAt:prev.contactedAt||(['contacted','replied','negotiating','won'].includes(status||'')?at:undefined),repliedAt:prev.repliedAt||(['replied','negotiating','won'].includes(status||'')?at:undefined),negotiatingAt:prev.negotiatingAt||(status==='negotiating'?at:undefined),wonAt:prev.wonAt||(status==='won'?at:undefined),history:[...prev.history,...events]};
 await saveAll(rows);return rows.map(refreshed);
});}
export function removeRecord(id:string):Promise<LeadRecord[]> {return mutate(async()=>{const rows=(await readRecords()).filter(r=>r.id!==id);await saveAll(rows);return rows.map(refreshed);});}
export function exportRecords(records:LeadRecord[]):string {return JSON.stringify({format:'asv-scout-v3',exportedAt:new Date().toISOString(),records},null,2);}
export function importRecords(json:string):Promise<{records:LeadRecord[];imported:number}> {return mutate(async()=>{
 let root;try{root=JSON.parse(json);}catch{throw new Error('Некорректный JSON');}
 if(root?.format!=='asv-scout-v3'||!Array.isArray(root.records)||!root.records.every(validateRecord))throw new Error('Некорректный экспорт Scout 3.0');
 const current=await readRecords(),byId=new Map(current.map(r=>[r.id,r]));let count=0;
 // Existing entries win: import never erases notes/history/statuses recorded after export.
 for(const record of root.records)if(!byId.has(record.id)){byId.set(record.id,record);count++;}
 const records=[...byId.values()];await saveAll(records);return {records:records.map(refreshed),imported:count};
});}
export function importLegacyWeb():Promise<number> {return mutate(async()=>{
 const old=await safeInvoke<any[]>('db_get_artists'),existing=await readRecords(),byId=new Map(existing.map(r=>[r.id,r]));let count=0;
 const statuses:Record<string,LeadStatus>={'Новый':'new','Изучен':'reviewed','Написали':'contacted','Ответил':'replied','Клиент':'won','Не актуален':'lost','Избранное':'favorite','new':'new'};
 for(const a of old){
   // Legacy vk_id is positive for both users and groups. Use the saved URL/raw type, never guess.
   const link=String(a.link||''),raw=String(a.raw_data||'');
   let type: 'group'|'user'|null=null;
   if(/vk\.(?:com|ru)\/(?:club|public)/.test(link)||String(a.vk_id).startsWith('-'))type='group';
   else if(/vk\.(?:com|ru)\/id\d/.test(link))type='user';
   else {try{const obj=JSON.parse(raw);if(obj.type==='group'||obj.type==='page'||obj.type==='event')type='group';else if(obj.first_name)type='user';}catch{}}
   if(!type)continue; // Ambiguous IDs remain fully accessible in Archive CRM.
   const number=Number(String(a.vk_id||'').replace(/^-/,''));if(!Number.isSafeInteger(number)||number<=0)continue;
   const c=candidateFromOwner(type==='group'?-number:number,{name:a.name||'Артист'});if(byId.has(c.id))continue;
   const at=new Date().toISOString(),history=await safeInvoke<any[]>('db_get_history',{artistId:a.id});
   byId.set(c.id,{id:c.id,opportunity:evaluateOpportunity(c,null),status:statuses[a.status]||'reviewed',note:String(a.notes||''),firstSeen:a.created_at||at,lastSeen:at,history:history.map<ActivityEvent>(h=>({at:h.created_at||at,type:'note' as const,text:String(h.content||'')})).concat([{at,type:'scan',text:'Перенос из архива без коммерческой оценки'}])});count++;
 }
 await saveAll([...byId.values()]);return count;
});}
export function summarize(records:LeadRecord[]){
 const wins=records.filter(r=>r.status==='won');
 const contacted=records.filter(r=>!!r.contactedAt||['contacted','replied','negotiating','won'].includes(r.status)).length;
 const replies=records.filter(r=>!!r.repliedAt||['replied','negotiating','won'].includes(r.status)).length;
 return {total:records.length,hot:records.filter(r=>r.opportunity.kind==='hot'&&r.opportunity.confidence==='source_only').length,growth:records.filter(r=>r.opportunity.kind==='growth'&&r.opportunity.confidence==='source_only').length,contacted,replies,negotiating:records.filter(r=>r.negotiatingAt||r.status==='negotiating').length,wins:wins.length,revenue:wins.reduce((s,r)=>s+(r.valueRub||0),0)};
}

export function updateProfile(id:string,changes:{name?:string;description?:string;contacts?:string;music_links?:string}):Promise<void>{return mutate(async()=>{
 const rows=await readRecords(),row=rows.find(r=>r.id===id);if(!row)throw new Error('Лид не найден');
 if(changes.name!==undefined){if(!changes.name.trim())throw new Error('Укажите имя артиста');changes.name=changes.name.trim().slice(0,200);}
 if(changes.description!==undefined)changes.description=changes.description.slice(0,10000);
 row.profile={...row.profile,...changes};row.history.push({at:new Date().toISOString(),type:'note',text:'Обновлена карточка артиста'});await saveAll(rows);
});}
export function addRecordEvent(id:string,text:string):Promise<void>{return mutate(async()=>{const rows=await readRecords(),row=rows.find(r=>r.id===id);if(!row)throw new Error('Лид не найден');row.history.push({at:new Date().toISOString(),type:'note',text:text.slice(0,10000)});await saveAll(rows);});}
export function reconcileScan(found:Opportunity[]):Promise<void>{return mutate(async()=>{const rows=await readRecords();const checked=new Map(found.map(o=>[o.id,o]));for(const r of rows){const o=checked.get(r.id);if(o){r.opportunity=o;r.lastSeen=new Date().toISOString();}}await saveAll(rows);});}
