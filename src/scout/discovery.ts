import {candidateFromOwner,classifyPost,evaluateOpportunity,type Candidate,type Opportunity,type VkPost} from './opportunity';
import {aborted} from './network';
import {VkApiError,authorsFromSearch,delay,getWall,getOwner,searchGroups,searchPosts} from './vk';
export type ScanMode='both'|'hot'|'growth';
export interface ScanOptions{token:string;mode:ScanMode;tokenType?:'user'|'service';maxGroups?:number;maxQueries?:number;terms?:string[];growthTerms?:string[];signal?:AbortSignal}
export interface ScanStats{postQueries:number;groupQueries:number;checkedGroups:number;postCount:number;failures:string[];candidates:number;rejected:number;unverified:number}
export interface ScanReport{opportunities:Opportunity[];checked:Opportunity[];stats:ScanStats}
export type Progress=(s:{done:number;total:number;stage:string})=>void;
const HOT=['ищу звукорежиссера','нужно сведение','ищу битмейкера','нужен мастеринг','нужна аранжировка','ищу музыкального продюсера','нужен аудит трека'];
const GROWTH=['независимый артист','рэп исполнитель','инди группа','музыкальный проект'];
let active=false;
/** A run has one owner. UI/transport cancellation never commits stale results. */
export async function discover(options:ScanOptions,onProgress:Progress=()=>{}):Promise<ScanReport>{
 if(active)throw new Error('Поиск уже выполняется');aborted(options.signal);active=true;
 const limit=Math.max(1,Math.min(30,options.maxGroups??12)),queryCount=Math.max(1,Math.min(8,options.maxQueries??4));
 const stats:ScanStats={postQueries:0,groupQueries:0,checkedGroups:0,postCount:0,failures:[],candidates:0,rejected:0,unverified:0};
 const checked=new Map<string,Opportunity>(),hotPosts=new Map<number,VkPost[]>(),profiles=new Map<number,Candidate>();
 const hot=[...new Set([...(options.terms||[]),...HOT].map(s=>s.trim()).filter(Boolean))].slice(0,queryCount);
 const growth=[...new Set([...(options.growthTerms||[]),...GROWTH].map(s=>s.trim()).filter(Boolean))].slice(0,queryCount);
 const total=(options.mode!=='growth'?hot.length:0)+(options.mode!=='hot'?growth.length:0)+limit*2;let done=0;
 const progress=(stage:string)=>{aborted(options.signal);onProgress({done,total,stage});};
 function failure(label:string,e:unknown){aborted(options.signal);if(e instanceof VkApiError&&[5,6,29].includes(e.code))throw e;stats.failures.push(label+': '+String(e));}
 function merge(candidate:Candidate,posts:VkPost[],source:'newsfeed'|'community'){
  const prior=checked.get(candidate.id);const all=[...new Map([...(prior?.observedPosts||[]),...posts].map(p=>[`${p.owner_id}_${p.id}`,p])).values()];
  checked.set(candidate.id,evaluateOpportunity(candidate,all,source));
 }
 try{
  if(options.mode!=='growth')for(const phrase of hot){
   progress('Поиск коммерческих публикаций: '+phrase);
   try{const response=await searchPosts(phrase,options.token,Math.floor(Date.now()/1000-30*86400),options.signal);aborted(options.signal);stats.postQueries++;
    for(const [id,profile]of authorsFromSearch(response))profiles.set(id,profile);
    for(const p of response.items){stats.postCount++;if(!p||!classifyPost(p))continue;const posts=hotPosts.get(p.owner_id)||[];posts.push(p);hotPosts.set(p.owner_id,posts);}
   }catch(e){failure('newsfeed.search',e);}done++;await delay(400,options.signal);
  }
  const recentOwners=[...hotPosts.keys()].sort((a,b)=>Math.max(...hotPosts.get(b)!.map(p=>p.date))-Math.max(...hotPosts.get(a)!.map(p=>p.date))).slice(0,limit);
  for(const owner of recentOwners){
   progress('Проверка профиля и авторства: '+owner);
   let candidate=profiles.get(owner)||candidateFromOwner(owner);
   try{candidate=await getOwner(owner,options.token,options.signal);}catch(e){failure('Профиль '+owner,e);}await delay(400,options.signal);
   merge(candidate,hotPosts.get(owner)!,'newsfeed');done++;
  }
  const wallFallback=options.mode==='hot'&&stats.postQueries===0;
  if((options.mode!=='hot'||wallFallback)&&options.tokenType!=='service'){
   const groups=new Map<string,Candidate>();
   for(const phrase of growth){
    progress('Поиск музыкальных проектов: '+phrase);
    try{for(const c of await searchGroups(phrase,options.token,options.signal))groups.set(c.id,c);stats.groupQueries++;}catch(e){failure('groups.search',e);}
    done++;await delay(400,options.signal);
   }
   for(let candidate of [...groups.values()].slice(0,limit)){
    try{candidate=await getOwner(candidate.ownerId,options.token,options.signal);}catch(e){failure('Профиль '+candidate.name,e);}await delay(400,options.signal);
    progress('Проверка публикаций и коммерческих сигналов: '+candidate.name);
    try{const posts=await getWall(candidate,options.token,options.signal);aborted(options.signal);stats.checkedGroups++;stats.postCount+=posts.length;merge(candidate,posts,'community');}
    catch(e){failure('wall.get '+candidate.name,e);}done++;await delay(400,options.signal);
   }
  }
  if(options.tokenType==='service'&&options.mode!=='hot')stats.failures.push('Growth: groups.search требует пользовательский токен; сервисный токен применяется только к поиску публикаций.');
  aborted(options.signal);const all=[...checked.values()];stats.candidates=all.length;stats.rejected=all.filter(o=>o.kind==='rejected').length;stats.unverified=all.filter(o=>o.kind==='watch').length;
  onProgress({done:total,total,stage:'Результаты готовы'});
  return {checked:all,opportunities:all.filter(o=>(options.mode!=='hot'||o.kind==='hot')&&['hot','growth'].includes(o.kind)&&o.score!==null&&o.confidence==='source_only').sort((a,b)=>Number(b.kind==='hot')-Number(a.kind==='hot')||(b.score??0)-(a.score??0)),stats};
 }finally{active=false;}
}
export function inspectManualPost(url:string,text:string,candidateName:string,publicationDate:string):Opportunity{
 const match=/^https:\/\/(?:m\.)?vk\.com\/wall(-?\d+)_(\d+)(?:\?.*)?$/.exec(url.trim());
 if(!match)throw new Error('Нужна ссылка https://vk.com/wall-123_456');
 const owner=Number(match[1]),id=Number(match[2]),date=Date.parse(publicationDate);
 if(!Number.isSafeInteger(owner)||!owner||!Number.isSafeInteger(id)||id<=0||!Number.isFinite(date))throw new Error('Некорректный ID или дата');
 const candidate={...candidateFromOwner(owner),name:candidateName.trim()||candidateFromOwner(owner).name};
 return evaluateOpportunity(candidate,[{id,owner_id:owner,from_id:owner,date:date/1000,text}],'manual');
}
