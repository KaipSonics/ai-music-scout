/** Compatibility adapter: original artist screens, canonical v3 records, untouched legacy rows. */
import {safeInvoke} from '../utils/tauriBridge';
import {loadRecords,mergeScan,updateRecord,updateProfile,removeRecord,addRecordEvent,importRecords,exportRecords,type LeadRecord} from './persistence';
import type {ArtistRecord,CRMStatus,HistoryRecord} from '../types/artist';
import type {LeadStatus,Opportunity} from './opportunity';
const toStatus:Record<LeadStatus,CRMStatus>={new:'Новый',reviewed:'Изучен',contacted:'Написали',replied:'Ответил',negotiating:'Переговоры',won:'Клиент',lost:'Не актуален',snoozed:'Отложен',favorite:'Избранное'};
const fromStatus=Object.fromEntries(Object.entries(toStatus).map(([a,b])=>[b,a])) as Record<CRMStatus,LeadStatus>;
function parse(text:string){try{return JSON.parse(text||'{}')||{};}catch{return {};}}
export function identity(a:Pick<ArtistRecord,'id'|'vk_id'|'link'|'raw_data'>):string|undefined{
 if(/^(group|user):\d+$/.test(a.id))return a.id;
 const raw=parse(a.raw_data),number=Math.abs(Number(a.vk_id));if(!Number.isSafeInteger(number)||!number)return;
 if(/vk\.(com|ru)\/(club|public)\d+/.test(a.link)||Number(a.vk_id)<0||['group','page','event'].includes(raw.type))return 'group:'+number;
 if(/vk\.(com|ru)\/id\d+/.test(a.link)||raw.first_name)return 'user:'+number;
}
export function asArtist(r:LeadRecord):ArtistRecord{
 const c=r.opportunity.candidate;
 return {id:r.id,vk_id:String(c.ownerId),name:r.profile?.name||c.name,link:c.profileUrl,description:r.profile?.description??c.description??'',followers:c.membersCount||0,last_activity:r.opportunity.signals[0]?.publishedAt||'Не проверена',music_links:r.profile?.music_links||c.profileUrl,contacts:r.profile?.contacts||c.profileUrl,avatar:c.avatar||'',raw_data:'',status:toStatus[r.status],notes:r.note,created_at:r.firstSeen,updated_at:r.lastSeen,opportunity:r.opportunity,contacted_at:r.contactedAt,replied_at:r.repliedAt,follow_up:r.followUpAt,value_rub:r.valueRub};
}
function legacyExtras(raw:string){const value=parse(raw).__scoutCRM||{};return {contacted_at:typeof value.contacted_at==='string'?value.contacted_at:undefined,replied_at:typeof value.replied_at==='string'?value.replied_at:undefined,follow_up:typeof value.follow_up==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value.follow_up)?value.follow_up:'',value_rub:Number.isFinite(value.value_rub)&&value.value_rub>=0?value.value_rub:0};}
export async function allArtists():Promise<ArtistRecord[]>{
 const current=await loadRecords(),legacy=await safeInvoke<ArtistRecord[]>('db_get_artists');
 if(!Array.isArray(legacy))throw new Error('Некорректный формат старой CRM');
 const keys=new Set(current.map(r=>r.id));
 return [...current.map(asArtist),...legacy.filter(a=>!keys.has(identity(a)||'')).map(a=>({...a,status:(String(a.status)==='new')?'Новый':a.status,...legacyExtras(a.raw_data)}))];
}
async function resolved(id:string){const rows=await allArtists();let row=rows.find(a=>a.id===id);if(!row){const old=await safeInvoke<ArtistRecord[]>('db_get_artists');const previous=old.find(a=>a.id===id);row=rows.find(a=>a.id===(previous&&identity(previous)));}if(!row)throw new Error('Артист не найден');return row;}
export async function saveOpportunity(o:Opportunity,status:CRMStatus='Новый'):Promise<string>{
 if(o.source==='demo')throw new Error('Демонстрация не записывается в рабочую CRM');
 const before=await allArtists();const existing=before.find(a=>identity(a)===o.id || a.link?.replace(/\/$/,'')===o.candidate.profileUrl.replace(/\/$/,''));if(existing)return existing.id;
 await mergeScan([o]);if(status!=='Новый')await updateRecord(o.id,{status:fromStatus[status]});return o.id;
}
export async function crmInvoke<T=any>(command:string,args:Record<string,any>={}):Promise<T>{
 if(command==='db_save_history'&&args.history)args={artistId:args.history.artist_id,recordType:args.history.record_type,content:args.history.content};
 let output:unknown;
 switch(command){
 case 'db_get_artists':output=(await allArtists()).filter(a=>!args.statusFilter||a.status===args.statusFilter);break;
 case 'db_get_artist':output=await resolved(args.id);break;
 case 'db_get_stats':{const rows=await allArtists();output={total:rows.length,new:rows.filter(a=>a.status==='Новый').length,favorites:rows.filter(a=>a.status==='Избранное').length};break;}
 case 'db_get_history':{const row=await resolved(args.artistId);if(row.opportunity){const r=(await loadRecords()).find(r=>r.id===row.id)!;output=r.history.map((h,i)=>({id:i,artist_id:row.id,record_type:h.type,content:h.text,created_at:h.at}));}else output=await safeInvoke(command,{...args,artistId:row.id});break;}
 case 'db_save_history':{const row=await resolved(args.artistId);if(row.opportunity)await addRecordEvent(row.id,String(args.content));else await safeInvoke(command,{...args,artistId:row.id});break;}
 case 'db_save_artist':{
 const a=args.artist as ArtistRecord;if(!a?.name?.trim())throw new Error('Укажите имя артиста');
 if(a.opportunity){await updateProfile(a.id,{name:a.name,description:a.description,contacts:a.contacts,music_links:a.music_links});await updateRecord(a.id,{status:fromStatus[a.status],note:a.notes,followUpAt:a.follow_up||'',valueRub:a.value_rub||0});output=a.id;}
 else{const raw=parse(a.raw_data),meta=legacyExtras(a.raw_data),at=new Date().toISOString();raw.__scoutCRM={...meta,follow_up:a.follow_up||'',value_rub:Math.max(0,Number(a.value_rub)||0),contacted_at:meta.contacted_at||(['Написали','Ответил','Переговоры','Клиент'].includes(a.status)?at:undefined),replied_at:meta.replied_at||(['Ответил','Переговоры','Клиент'].includes(a.status)?at:undefined)};output=await safeInvoke(command,{artist:{...a,raw_data:JSON.stringify(raw)}});}break;
 }
 case 'db_update_notes':case 'db_update_status':{
 const a=await resolved(args.id);const status=args.status as CRMStatus;
 if(command==='db_update_status'&&!fromStatus[status])throw new Error('Некорректный статус');
 if(a.opportunity)await updateRecord(a.id,command==='db_update_status'?{status:fromStatus[status]}:{note:String(args.notes)});
 else{if(command==='db_update_status')await crmInvoke('db_save_artist',{artist:{...a,status}});else await safeInvoke(command,{...args,id:a.id});await safeInvoke('db_save_history',{artistId:a.id,recordType:'status',content:command==='db_update_status'?'Статус: '+status:String(args.notes)});}break;
 }
 case 'db_delete_artist':{const a=await resolved(args.id);if(a.opportunity)await removeRecord(a.id);else await safeInvoke(command,{id:a.id});break;}
 default:return safeInvoke(command,args);
 }return output as T;
}
export async function exportCRM():Promise<string>{const legacy=await safeInvoke<ArtistRecord[]>('db_get_artists');const legacyHistory=Object.fromEntries(await Promise.all(legacy.map(async a=>[a.id,await safeInvoke('db_get_history',{artistId:a.id})])));return JSON.stringify({format:'asv-unified-crm',version:1,legacy,legacyHistory,scout:JSON.parse(exportRecords(await loadRecords()))},null,2);}
export async function importCRM(text:string):Promise<number>{
 let data;try{data=JSON.parse(text);}catch{throw new Error('Некорректный JSON');}
 if(data?.format==='asv-scout-v3')return (await importRecords(text)).imported;
 const legacy=Array.isArray(data)?data:data?.format==='asv-unified-crm'?data.legacy:data?.artists;
 if(!Array.isArray(legacy)||legacy.length>2500||!legacy.every(a=>a&&typeof a.id==='string'&&typeof a.name==='string'&&typeof a.vk_id==='string'&&typeof a.link==='string'))throw new Error('Некорректный экспорт CRM');
 // Validate v3 before any legacy writes. Existing rows always win on import.
 if(data.format==='asv-unified-crm')await importRecords(JSON.stringify(data.scout));
 const old=await safeInvoke<ArtistRecord[]>('db_get_artists');let count=0;
 for(const a of legacy){if(old.some(x=>x.id===a.id||identity(x)&&identity(x)===identity(a)))continue;await safeInvoke('db_save_artist',{artist:a});if(Array.isArray(data.legacyHistory?.[a.id]))for(const h of data.legacyHistory[a.id]){if(typeof h.content==='string')await safeInvoke('db_save_history',{artistId:a.id,recordType:h.record_type||'note',content:h.content});}old.push(a);count++;}
 return count;
}
export function csvCRM(rows:ArtistRecord[]):string{const cell=(v:unknown)=>'"'+String(v??'').replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';return '\ufeff'+[['Артист','Статус','Заметки','Напоминание','Сумма','VK'],...rows.map(a=>[a.name,a.status,a.notes,a.follow_up,a.value_rub,a.link])].map(row=>row.map(cell).join(',')).join('\r\n');}
export type {HistoryRecord};
