import type {Candidate,Opportunity,VkPost} from './opportunity';
import {candidateFromOwner,evaluateOpportunity} from './opportunity';
import {VkApiError,authorsFromSearch,delay,getWall,searchGroups,searchPosts} from './vk';

export type ScanMode='both'|'hot'|'growth';
export interface ScanOptions { token:string; mode:ScanMode; maxGroups?:number; maxQueries?:number; terms?:string[]; signal?:AbortSignal }
export interface ScanStats { postQueries:number; groupQueries:number; checkedGroups:number; postCount:number; failures:string[]; candidates:number }
export interface ScanReport {opportunities:Opportunity[];stats:ScanStats}
export type Progress = (state:{done:number;total:number;stage:string})=>void;
const DIRECT_QUERIES=[
  'ищу звукорежиссера','нужно сведение','ищу битмейкера','ищу продюсера',
  'кто может свести трек','нужна аранжировка','ищем звукорежиссера','нужен мастеринг'
];
const GROWTH_QUERIES=['независимый артист','рэп исполнитель','инди группа','поп исполнитель','рок группа','музыкальный проект'];
const MIN_POST_TIME_DAYS=75;
const SKIP_NAMES=/фан[ -]?клуб|fan[ -]?club|новости рэпа|биржа музыкантов|оборудовани|музыкальный магазин/i;
function numericUnique<T extends {id:string}>(a:T[]):T[]{return [...new Map(a.map(v=>[v.id,v])).values()]}
function strongest(first:Opportunity,second:Opportunity):Opportunity{
  const posts=[...new Map([...(first.observedPosts||[]),...(second.observedPosts||[])].map(p=>[`${p.owner_id}_${p.id}`,p])).values()];
  const candidate=first.candidate.screenName?first.candidate:second.candidate;
  return evaluateOpportunity(candidate,posts,second.source);
}

/** Sequential calls + throttling to respect VK limits; partial errors are visible to operator. */
export async function discover(options:ScanOptions, onProgress:Progress=()=>{}):Promise<ScanReport>{
  const maxQ=Math.max(1,Math.min(12,options.maxQueries??4));
  const maxGroups=Math.max(1,Math.min(50,options.maxGroups??15));
  const doHot=options.mode!=='growth',doGrowth=options.mode!=='hot';
  const stats:ScanStats={postQueries:0,groupQueries:0,checkedGroups:0,postCount:0,failures:[],candidates:0};
  const found=new Map<string,Opportunity>();
  const queriesHot=[...new Set([...(options.terms||[]).filter(Boolean),...DIRECT_QUERIES])].slice(0,maxQ);
  const queriesGrowth=[...new Set(GROWTH_QUERIES)].slice(0,Math.min(maxQ,6));
  const total=(doHot?queriesHot.length:0)+(doGrowth?queriesGrowth.length+maxGroups:0);
  let done=0;const progress=(stage:string)=>onProgress({done,total,stage});
  function check(){if(options.signal?.aborted)throw new Error('Сканирование отменено');}
  function merge(o:Opportunity){found.set(o.id,found.has(o.id)?strongest(found.get(o.id)!,o):o);}
  if(doHot){
    for(const q of queriesHot){
      check();progress(`Публикации: «${q}»`);
      try{
        const response=await searchPosts(q,options.token,Math.floor(Date.now()/1000-MIN_POST_TIME_DAYS*86400));
        const authors=authorsFromSearch(response);
        stats.postQueries++;
        for(const p of response.items){
          if(!p?.id||!p.owner_id)continue;
          stats.postCount++;
          // When posting on another person's wall, the byline is uncertain.
          const owner=p.owner_id;
          const candidate=authors.get(owner)||candidateFromOwner(owner);
          const o=evaluateOpportunity(candidate,[p],'newsfeed');
          merge(o);
        }
      }catch(e){if(e instanceof VkApiError && [5,6,29].includes(e.code))throw e;stats.failures.push(`Посты «${q}»: ${String(e)}`)}
      done++;progress('Поиск публикаций');await delay(370);
    }
  }
  if(doGrowth){
    const groups:Candidate[]=[];
    for(const q of queriesGrowth){
      check();progress(`Артисты: «${q}»`);
      try{
        const list=await searchGroups(q,options.token);stats.groupQueries++;
        groups.push(...list.filter(x=>!SKIP_NAMES.test(x.name)));
      }catch(e){if(e instanceof VkApiError && [5,6,29].includes(e.code))throw e;stats.failures.push(`Группы «${q}»: ${String(e)}`)}
      done++;progress('Поиск артистов');await delay(370);
    }
    const chosen=numericUnique(groups).slice(0,maxGroups);
    stats.candidates=chosen.length;
    for(const candidate of chosen){
      check();progress(`Стена: ${candidate.name}`);
      try{
        const posts=await getWall(candidate,options.token);
        stats.checkedGroups++;
        stats.postCount+=posts.length;
        const o=evaluateOpportunity(candidate,posts,'community');
        merge(o);
      }catch(e){if(e instanceof VkApiError && [5,6,29].includes(e.code))throw e;stats.failures.push(`Стена ${candidate.name}: ${String(e)}`)}
      done++;progress('Анализ стен');await delay(370);
    }
  }
  const opportunities=[...found.values()].sort((a,b)=>(b.score??-1)-(a.score??-1));
  done=total;progress('Готово');
  return {opportunities,stats};
}

/** Human-input discovery: lets a producer test an original VK post without API access. */
export function inspectManualPost(url:string,text:string,candidateName:string,publicationDate:string):Opportunity {
  const match=/^https:\/\/(?:m\.)?vk\.com\/wall(-?\d+)_(\d+)(?:\?.*)?$/.exec(url.trim());
  if(!match)throw new Error('Нужна ссылка формата https://vk.com/wall-123_456');
  const ownerId=Number(match[1]),id=Number(match[2]);
  if(!Number.isSafeInteger(ownerId)||ownerId===0||!Number.isSafeInteger(id)||id<=0)throw new Error('Некорректный VK ID');
  const dateMs=Date.parse(publicationDate);
  if(!Number.isFinite(dateMs))throw new Error('Укажите корректную дату публикации');
  const p:VkPost={id,owner_id:ownerId,from_id:ownerId,date:Math.floor(dateMs/1000),text};
  const candidate={...candidateFromOwner(ownerId),name:candidateName.trim()||candidateFromOwner(ownerId).name};
  return evaluateOpportunity(candidate,[p],'manual');
}
