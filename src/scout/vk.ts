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
async function webCall(method:string,params:Record<string,string|number>,token:string):Promise<unknown> {
  const body=new URLSearchParams();
  for(const [key,value] of Object.entries({...params,access_token:cleanToken(token),v:API_VERSION})) body.set(key,String(value));
  let response:Response;
  try{response=await fetch(endpoint+method,{method:'POST',body,cache:'no-store',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(16000)});}
  catch{throw new Error(`VK ${method}: ошибка сети, таймаут или CORS. Попробуйте десктопную версию.`)}
  if(!response.ok)throw new Error(`VK ${method}: HTTP ${response.status}`);
  let result;try{result=await response.json();}catch{throw new Error(`VK ${method}: некорректный JSON`)}
  if(result?.error)throw new VkApiError(method,Number(result.error.error_code||0),({5:'Недействительный токен',6:'Лимит запросов. Повторите позже',15:'Нет доступа к методу или данным',27:'Нет прав приложения',29:'Достигнут лимит'} as Record<number,string>)[Number(result.error.error_code)]||'Запрос отклонён VK; проверьте права токена');
  if(!result?.response)throw new Error(`VK ${method}: отсутствует response`);
  return result.response;
}
async function call<T>(command:string,method:string,params:Record<string,string|number>,token:string):Promise<T>{
  if(!cleanToken(token))throw new Error('Сначала укажите VK-токен в настройках');
  if(isTauri()){try{return await safeInvoke<T>(command,{...params,token:cleanToken(token)});}catch(e){const m=/VK [^(]+\((\d+)\)/.exec(String(e));if(m)throw new VkApiError(method,Number(m[1]),'Запрос отклонён VK; проверьте токен, права и лимиты');throw new Error(`VK ${method}: сеть недоступна, таймаут или ошибка транспорта`);}}
  const webParams:Record<string,string|number>={};
  for(const [key,value] of Object.entries(params)){
    const apiKey=key==='query'?'q':key==='startTime'?'start_time':key==='ownerId'?'owner_id':key;
    webParams[apiKey]=value;
  }
  return webCall(method,webParams,token) as Promise<T>;
}
export async function testToken(token:string):Promise<string>{
  if(!cleanToken(token))throw new Error('VK-токен отсутствует');
  if(isTauri())return safeInvoke<string>('scout_test_token',{token:cleanToken(token)});
  const users=await webCall('users.get',{},token) as {first_name:string;last_name:string}[];
  if(!users?.length)throw new Error('VK не вернул пользователя');
  return `${users[0].first_name} ${users[0].last_name}`;
}
export async function searchPosts(q:string,token:string,startTime:number):Promise<VkSearchResponse>{
  const raw=await call<VkSearchResponse>('vk_newsfeed_search_v3','newsfeed.search',{query:q,startTime,extended:1,count:40},token);
  if(!Array.isArray(raw?.items))throw new Error(`VK newsfeed.search: некорректный результат для «${q}»`);
  return raw;
}
export async function searchGroups(q:string,token:string):Promise<Candidate[]>{
  const response=await call<{items:Record<string,unknown>[]}>('vk_search_v3','groups.search',{query:q,count:35,offset:0,fields:'description,members_count,activity,status,photo_200'},token);
  if(!Array.isArray(response?.items))throw new Error('VK groups.search вернул некорректные данные');
  return response.items.filter(x=>Number.isInteger(x.id)).map(x=>candidateFromOwner(-Number(x.id),x));
}
export async function getWall(candidate:Candidate,token:string):Promise<VkPost[]>{
  const response=await call<{items:VkPost[]}>('vk_get_wall_v3','wall.get',{ownerId:candidate.ownerId,count:20,filter:'owner'},token);
  if(!Array.isArray(response?.items))throw new Error(`Не удалось прочитать стену ${candidate.name}`);
  return response.items;
}
/** Expand profiles/groups bundled in newsfeed.search; do not invent artist metadata. */
export function authorsFromSearch(result:VkSearchResponse):Map<number,Candidate>{
  const map=new Map<number,Candidate>();
  for(const p of result.groups||[]){if(typeof p.id==='number')map.set(-p.id,candidateFromOwner(-p.id,p))}
  for(const p of result.profiles||[]){if(typeof p.id==='number')map.set(p.id,candidateFromOwner(p.id,p))}
  return map;
}
export async function delay(ms:number){return new Promise<void>(resolve=>setTimeout(resolve,ms))}
