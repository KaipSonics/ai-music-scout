import {backendConfiguration,aborted,abortable} from './network';
import {isTauri, safeInvoke} from '../utils/tauriBridge';
import type {Candidate,VkPost} from './opportunity';
import {candidateFromOwner} from './opportunity';

const API_VERSION='5.131';
const endpoint='https://api.vk.com/method/';
function cleanToken(t:string):string { const trimmed=t.trim();const m=/(?:[?#&]|^)access_token=([^&#]+)/.exec(trimmed);return m?decodeURIComponent(m[1]):trimmed; }
export class VkApiError extends Error {
  method:string; code:number;
  constructor(method:string,code:number,message:string){super(`VK ${method} (${code}): ${message}`);this.method=method;this.code=code;}
}
export interface VkSearchResponse {items:VkPost[];groups?:Record<string,unknown>[];profiles?:Record<string,unknown>[];next_from?:string}
async function webCall(method:string,params:Record<string,string|number>,token:string,signal?:AbortSignal):Promise<unknown> {
  aborted(signal);const backend=backendConfiguration();
  if(backend.url&&!backend.key)throw new Error('Укажите ключ доступа API-сервера');
  const body=new URLSearchParams();
  for(const [key,value] of Object.entries({...params,access_token:cleanToken(token),v:API_VERSION})) body.set(key,String(value));
  let response:Response;
  try{response=await fetch(backend.url?backend.url+'/api/vk/'+method:endpoint+method,{method:'POST',body,headers:backend.url?{Authorization:'Bearer '+backend.key}:{},cache:'no-store',referrerPolicy:'no-referrer',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(16000)]):AbortSignal.timeout(16000)});}
  catch{aborted(signal);throw new Error(`VK ${method}: сеть, таймаут или CORS. Для веба настройте API-сервер, для desktop используйте Tauri.`)}
  if(!response.ok){if(backend.url)throw new Error(`API-сервер: ${response.status===401?'неверный ключ доступа':response.status===403?'источник запроса не разрешён':response.status===429?'лимит запросов; повторите позже':'VK недоступен или некорректный ответ'} (HTTP ${response.status})`);throw new Error(`VK ${method}: HTTP ${response.status}`);}
  let result;try{result=await response.json();}catch{throw new Error(`VK ${method}: некорректный JSON`)}
  if(result?.error)throw new VkApiError(method,Number(result.error.error_code||0),({5:'Недействительный токен',6:'Лимит запросов. Повторите позже',15:'Нет доступа к методу или данным',27:'Нет прав приложения',29:'Достигнут лимит'} as Record<number,string>)[Number(result.error.error_code)]||'Запрос отклонён VK; проверьте права токена');
  if(!result?.response)throw new Error(`VK ${method}: отсутствует response`);
  return result.response;
}
async function call<T>(command:string,method:string,params:Record<string,string|number>,token:string,signal?:AbortSignal):Promise<T>{
  aborted(signal);if(!cleanToken(token))throw new Error('Сначала укажите VK-токен в настройках');
  if(isTauri()){try{return await abortable(safeInvoke<T>(command,{...params,...(command==='scout_get_owner'?{ownerId:method==='groups.getById'?-Number(params.group_ids):Number(params.user_ids)}:{}),token:cleanToken(token)}),signal);}catch(e){aborted(signal);const m=/VK [^(]+\((\d+)\)/.exec(String(e));if(m)throw new VkApiError(method,Number(m[1]),'Запрос отклонён VK; проверьте токен, права и лимиты');throw new Error(`VK ${method}: сеть недоступна, таймаут или ошибка транспорта`);}}
  const webParams:Record<string,string|number>={};
  for(const [key,value] of Object.entries(params)){
    const apiKey=key==='query'?'q':key==='startTime'?'start_time':key==='ownerId'?'owner_id':key;
    webParams[apiKey]=value;
  }
  return webCall(method,webParams,token,signal) as Promise<T>;
}
export async function testToken(token:string):Promise<string>{
  if(!cleanToken(token))throw new Error('VK-токен отсутствует');
  if(isTauri())return safeInvoke<string>('scout_test_token',{token:cleanToken(token)});
  const users=await webCall('users.get',{},token) as {first_name:string;last_name:string}[];
  if(!Array.isArray(users)||!users.length||typeof users[0]?.first_name!=='string'||typeof users[0]?.last_name!=='string')throw new Error('VK не вернул пользователя');
  return `${users[0].first_name} ${users[0].last_name}`;
}
export async function searchPosts(q:string,token:string,startTime:number,signal?:AbortSignal):Promise<VkSearchResponse>{
  const raw=await call<VkSearchResponse>('vk_newsfeed_search_v3','newsfeed.search',{query:q,startTime,extended:1,count:40},token,signal);
  if(!Array.isArray(raw?.items))throw new Error(`VK newsfeed.search: некорректный результат для «${q}»`);
  return raw;
}
export async function searchGroups(q:string,token:string,signal?:AbortSignal):Promise<Candidate[]>{
  const response=await call<{items:Record<string,unknown>[]}>('vk_search_v3','groups.search',{query:q,count:35,offset:0},token,signal);
  if(!Array.isArray(response?.items))throw new Error('VK groups.search вернул некорректные данные');
  return response.items.filter(x=>x&&Number.isSafeInteger(x.id)&&Number(x.id)>0).map(x=>candidateFromOwner(-Number(x.id),x));
}
export async function getWall(candidate:Candidate,token:string,signal?:AbortSignal):Promise<VkPost[]>{
  const response=await call<{items:VkPost[]}>('vk_get_wall_v3','wall.get',{ownerId:candidate.ownerId,count:20,filter:'owner'},token,signal);
  if(!Array.isArray(response?.items))throw new Error(`Не удалось прочитать стену ${candidate.name}`);
  return response.items;
}
/** Expand profiles/groups bundled in newsfeed.search; do not invent artist metadata. */
export function authorsFromSearch(result:VkSearchResponse):Map<number,Candidate>{
  const map=new Map<number,Candidate>();
  for(const p of Array.isArray(result.groups)?result.groups:[]){if(p&&typeof p.id==='number')map.set(-p.id,candidateFromOwner(-p.id,p))}
  for(const p of Array.isArray(result.profiles)?result.profiles:[]){if(p&&typeof p.id==='number')map.set(p.id,candidateFromOwner(p.id,p))}
  return map;
}
export function delay(ms:number,signal?:AbortSignal):Promise<void>{
 aborted(signal);return new Promise((resolve,reject)=>{const done=()=>{signal?.removeEventListener('abort',cancel);resolve();};const timer=setTimeout(done,ms);const cancel=()=>{clearTimeout(timer);reject(new DOMException('Поиск отменён пользователем','AbortError'));};signal?.addEventListener('abort',cancel,{once:true});});
}
export async function getOwner(ownerId:number,token:string,signal?:AbortSignal):Promise<Candidate>{
 const group=ownerId<0;
 const raw=await call<unknown>('scout_get_owner',group?'groups.getById':'users.get',group?{group_ids:Math.abs(ownerId),fields:'description,members_count,activity,status,photo_200'}:{user_ids:ownerId,fields:'about,status,domain,photo_200'},token,signal);
 const rows=Array.isArray(raw)?raw:(raw as {groups?:unknown[]})?.groups;
 if(!Array.isArray(rows)||!rows[0]||typeof rows[0]!=='object')throw new Error('VK: профиль источника недоступен');
 if(Number((rows[0] as Record<string,unknown>).id)!==Math.abs(ownerId))throw new Error('VK: ID полученного профиля не соответствует источнику');
 return candidateFromOwner(ownerId,rows[0]);
}
