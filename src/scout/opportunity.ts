/** ASV Scout 3.0: explainable, evidence-first ranking. Zero fabricated outcomes. */
export type LeadKind = 'hot' | 'growth' | 'watch' | 'rejected';
export type Service = 'mix_master' | 'stem_master' | 'beat' | 'production' | 'audit';
export type SignalKind = 'direct_request' | 'release_plan' | 'active_project';
export type LeadStatus = 'new' | 'reviewed' | 'contacted' | 'replied' | 'negotiating' | 'won' | 'lost' | 'snoozed' | 'favorite';
export type SourceType = 'group' | 'user';
export type Confidence = 'source_only' | 'needs_review';

export interface Candidate {
  id: string; // user:123 / group:456 (not a numeric id alone)
  ownerId: number;
  sourceType: SourceType;
  name: string;
  screenName?: string;
  membersCount?: number;
  description?: string;
  avatar?: string;
  activity?: string;
  profileUrl: string;
}
export interface VkPost {
  id: number;
  owner_id: number;
  from_id?: number;
  date: number;
  text?: string;
  copy_history?: unknown[];
  is_pinned?: number;
  marked_as_ads?: number;
}
export interface Signal {
  id: string;
  kind: SignalKind;
  service: Service | null;
  description: string;
  quote: string;
  url: string;
  publishedAt: string;
  ageDays: number;
  /** Source only = VK returned the post, not verification of the author or request. */
  confidence: Confidence;
  sourceOwnerId: number;
  authorId?: number;
  capturedAt: string;
}
export interface ScoreFactors { need: number; timing: number; fit: number; activity: number; contact: number }
export interface Opportunity {
  assessment?:{music:'supported'|'unknown';need:'explicit'|'activity'|'unknown';evidence:'api_original'|'unverified'};
  id: string;
  candidate: Candidate;
  kind: LeadKind;
  score: number | null;
  factors: ScoreFactors | null;
  confidence: Confidence | 'missing';
  service: Service | null;
  signals: Signal[];
  reasons: string[];
  assessedAt: string;
  source: 'newsfeed' | 'community' | 'demo' | 'manual';
  observedPosts?: VkPost[];
}
const DAY_MS = 86400000;
const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const NON_ARTIST = /(?:фан[ -]?клуб|fan[ -]?club|фан[ -]?страниц|музыкальн(?:ые|ая) новости|афиша концертов|магазин музыкальн|продаж[аи] оборудован|рекламное агентство|продвижение артистов|биржа музыкантов|кастинг|музыкальный паблик|студия\s+звукозаписи|рекламное\s+агентство|звукозапись\s+на\s+заказ|продюсерский\s+центр)/i;
const NEGATED = /(?:не\s+ищ(?:у|ем|ут)|не\s+нуж(?:ен|на|но)|уже\s+наш(?:[её]л|ли)|поиск\s+закрыт|вопрос\s+реш[её]н|ваканси[яи]\s+закрыта|не\s*актуальн|больше\s+не\s+ищ|для\s+друга|мой\s+друг\s+ищ|друзья\s+ищут|знакомый\s+ищ|ищу\s+клиент|наши\s+услуги)/i;
const OFFERING = /(?:предлага(?:ю|ем|ют)|оказыва(?:ю|ем|ют)\s+услуг|сведу\s+ваш|сделаем\s+ваш\s+мастеринг|ищете\s+звукорежисс[её]ра\?|прайс\s+на\s+сведени)/i;
const DIRECT: { pattern: RegExp; service: Service; label: string }[] = [
  {pattern:/(?:ищ(?:у|ем)(?![а-яё])|нуж(?:ен|на|но)|требуется)[^.!?\n]{0,65}(?:аудит|разбор\s+(?:микса|трека)|оценк[ау]\s+сведени)/i,service:'audit',label:'Ищет аудит материала'},
  { pattern: /(?:ищ(?:у|ем)(?![а-яё])|нуж(?:ен|на|но)|требуется)[^.!?\n]{0,65}(?:stem[ -]?мастеринг|стем[ -]?мастеринг|мастеринг\s+по\s+стемам)/i, service: 'stem_master', label: 'Ищет stem-мастеринг' },
  { pattern: /(?:ищ(?:у|ем)(?![а-яё])|нуж(?:ен|на|но)|требуется|подыскива(?:ю|ем)|посоветуйте|порекомендуйте)[^.!?\n]{0,75}(?:звукорежисс[её]р|сведени[ея]|свести|миксинг|мастеринг|инженер\s+по\s+звуку)|(?:кто\s+(?:может|сможет|готов))[^.!?\n]{0,45}(?:свести|сведени|мастеринг)/i, service: 'mix_master', label: 'Ищет сведение или мастеринг' },
  { pattern: /(?:ищ(?:у|ем)(?![а-яё])|нуж(?:ен|на|но)|требуется|посоветуйте)[^.!?\n]{0,75}(?:битмейкер|битмейкера|бит(?![а-яё])|минус(?![а-яё])|инструментал|аранжировщик|аранжировк)|(?:кто\s+(?:сделает|напишет))[^.!?\n]{0,45}(?:бит(?![а-яё])|минус(?![а-яё])|аранжировк)/i, service: 'beat', label: 'Ищет инструментал или аранжировку' },
  { pattern: /(?:ищ(?:у|ем)(?![а-яё])|нуж(?:ен|на|но)|требуется)[^.!?\n]{0,75}(?:саунд[ -]?продюсер|музыкальн(?:ый|ого)\s+продюсер|продакшн)/i, service: 'production', label: 'Ищет музыкальный продакшн' },
];
const RELEASE = /(?:премьера[^.!?\n]{0,60}(?:трек|сингл|альбом)|выш(?:ел|ла|ли)[^.!?\n]{0,30}(?:трек|сингл|альбом)|новый\s+(?:трек|сингл|альбом)\s+уже\s+(?:доступен|на\s+площадках))|(?:записыва(?:ю|ем|ют)|готов(?:лю|им|ят)|работа(?:ю|ем|ют)\s+над|скоро\s+выйдет|скоро\s+выходит|планиру(?:ю|ем)|готовится\s+к\s+выходу)[^.!?\n]{0,90}(?:альбом|ep\b|мини[ -]?альбом|трек|релиз|сингл|пластинк)|(?:альбом|ep\b|мини[ -]?альбом|трек|релиз|сингл)[^.!?\n]{0,65}(?:скоро|в\s+работе|на\s+подходе|в\s+процессе)/i;
const MUSIC = /(?:\bep\b|музык|пев(?:ец|ица)|вокал|артист|исполнител|рэп|rap\b|hip[ -]?hop|рок(?![а-яё])|rock\b|indie\b|инди|поп(?![а-яё])|pop\b|трек|сингл|альбом|бит(?![а-яё])|beat\b|муз\.?\s*группа|группа\s+\w+)/i;

function daysSince(dateSeconds: number, now: number) { return Math.max(0, (now - dateSeconds * 1000) / DAY_MS); }
function postUrl(p: VkPost) { return `https://vk.com/wall${p.owner_id}_${p.id}`; }
function byDate(a: Signal,b: Signal){return b.publishedAt.localeCompare(a.publishedAt)}

export function candidateFromOwner(ownerId: number, raw?: Record<string, unknown>): Candidate {
  const group = ownerId < 0;
  const n = raw || {};
  const name = group ? String(n.name || `Сообщество ${-ownerId}`) : [n.first_name, n.last_name].filter(Boolean).join(' ') || String(n.name || `Пользователь ${ownerId}`);
  const screenName = String(n.screen_name || n.domain || '').trim() || undefined;
  return {
    id: `${group ? 'group' : 'user'}:${Math.abs(ownerId)}`,
    ownerId, sourceType: group ? 'group' : 'user', name, screenName,
    membersCount: typeof n.members_count === 'number' ? n.members_count : undefined,
    description: String(n.description || n.status || n.about || ''),
    avatar: typeof n.photo_200 === 'string' ? n.photo_200 : undefined,
    activity: String(n.activity || ''),
    profileUrl: `https://vk.com/${screenName || (group ? 'club' : 'id') + Math.abs(ownerId)}`
  };
}

/** Classify a post without evaluating its author. Reject reposts, commercial spam and resolved requests. */
export function classifyPost(p: VkPost, now = Date.now()): Signal | null {
  if (!Number.isSafeInteger(p.id) || p.id<=0 || !Number.isSafeInteger(p.owner_id) || p.owner_id===0 || !Number.isFinite(p.date) || p.date<=0 || typeof p.text!=='string' || !p.text.trim()) return null;
  if (p.copy_history?.length || p.marked_as_ads) return null;
  if (p.date * 1000 > now + 300000) return null;
  const age = daysSince(p.date, now);
  if (age > 75) return null;
  if(/(?:на\s+концерт|для\s+концерт|озвучить\s+мероприят|прокат\s+звука|звукорежисс[её]р[^.!?]{0,30}на\s+свадьб)/i.test(p.text))return null;
  const normalized = p.text.replace(/\s+/g, ' ').trim();
  if (NEGATED.test(normalized) || OFFERING.test(normalized)) return null;
  const hit = DIRECT.find(x => x.pattern.test(normalized));
  const release = !hit && RELEASE.test(normalized);
  if (!hit && !release) return null;
  if ((hit && age > 30) || (release && age > 60)) return null;
  return {
    id: `wall${p.owner_id}_${p.id}`,
    kind: hit ? 'direct_request' : 'release_plan',
    service: hit?.service || null,
    description: hit?.label || 'Готовит новый материал или релиз',
    quote: normalized.slice(0, 550),
    url: postUrl(p), publishedAt: new Date(p.date*1000).toISOString(),
    ageDays: Math.floor(age),
    confidence: 'needs_review',
    sourceOwnerId: p.owner_id,
    authorId: p.from_id, capturedAt:new Date(now).toISOString(),
  };
}

export function evaluateOpportunity(candidate: Candidate, posts: VkPost[] | null, source:'newsfeed'|'community'|'demo'|'manual'='community', now=Date.now()): Opportunity {
  if(posts)posts=[...new Map(posts.filter(p=>p && typeof p==='object').map(p=>[`${p.owner_id}_${p.id}`,p])).values()];
  const base = { id:candidate.id, candidate, source, assessedAt:new Date(now).toISOString(), observedPosts:posts?.slice(0,20).map(p=>({id:p.id,owner_id:p.owner_id,from_id:p.from_id,date:p.date,text:typeof p.text==='string'?p.text.slice(0,12000):'',copy_history:p.copy_history?.length?[{}]:undefined,marked_as_ads:p.marked_as_ads})) };
  if (posts === null) return {...base,kind:'watch',score:null,factors:null,confidence:'missing',service:null,signals:[],reasons:['Не удалось получить публикации: оценка отсутствует']} ;
  const signals: Signal[] = [];
  const seen = new Set<string>();
  const ownPosts=posts.filter(p=>p.owner_id===candidate.ownerId && p.from_id===candidate.ownerId);
  for(const post of posts){ const s=classifyPost(post,now);if(s && !seen.has(s.id)){signals.push(s);seen.add(s.id)} }
  signals.sort(byDate);
  const attributed=signals.filter(s=>s.authorId===candidate.ownerId && s.sourceOwnerId===candidate.ownerId);
  const direct = attributed.filter(s=>s.kind==='direct_request').sort((a,b)=>a.ageDays-b.ageDays)[0];
  const release = attributed.filter(s=>s.kind==='release_plan')[0];
  const isNonArtist=NON_ARTIST.test(`${candidate.name} ${candidate.description||''}`);
  if (isNonArtist) return {...base,kind:'rejected',score:0,factors:null,confidence:'needs_review',service:null,signals,reasons:['Источник похож на тематический паблик, а не страницу артиста']};
  const recentOriginal = ownPosts.filter(p=>Number.isFinite(p.date) && p.date>0 && p.date*1000<=now+300000 && !p.copy_history?.length && !p.marked_as_ads && (typeof p.text==='string' && p.text.trim()) && daysSince(p.date,now)<=45).length;
  const hasMusicContext = MUSIC.test(`${candidate.name} ${candidate.description||''} ${ownPosts.slice(0,8).map(p=>p.text||'').join(' ')}`);
  const activeGrowth = !direct && !release && recentOriginal>=3 && hasMusicContext && !isNonArtist;
  if (!direct && !release && !activeGrowth) return {...base,kind:'watch',score:null,factors:null,confidence:signals.length?'needs_review':'missing',service:null,signals,reasons:[signals.length?'Запрос найден, но авторство не подтверждено: проверьте адресата':'Актуальных коммерческих сигналов не найдено']};
  const strongest = direct||release;
  // For active project discovery, there is NO verified commercial request.
  if(!strongest){
    const latest=ownPosts.filter(p=>!p.copy_history?.length && !p.marked_as_ads && Number.isFinite(p.date) && p.date*1000<=now+300000 && daysSince(p.date,now)<=45 && p.text).sort((a,b)=>b.date-a.date)[0];
    if(latest){signals.push({id:`wall${latest.owner_id}_${latest.id}`,kind:'active_project',service:null,description:'Регулярная активность музыкального проекта',quote:(latest.text||'').replace(/\s+/g,' ').slice(0,450),url:postUrl(latest),publishedAt:new Date(latest.date*1000).toISOString(),ageDays:Math.floor(daysSince(latest.date,now)),confidence:'needs_review',sourceOwnerId:latest.owner_id,authorId:latest.from_id,capturedAt:new Date(now).toISOString()});}
  }
  const best=strongest||signals[0];
  const need = direct?100:release?52:25;
  const timing = clamp(100-best.ageDays*(direct?2.3:1.5));
  const fit = direct?95:release?70:45;
  const activity = clamp(20+recentOriginal*12);
  const contact = candidate.screenName?75:45;
  const factors={need,timing,fit,activity,contact};
  const score=clamp(need*.35+timing*.25+fit*.2+activity*.1+contact*.1);
  const kind: LeadKind=direct?'hot':'growth';
  if(!hasMusicContext)return {...base,kind:'watch',score:null,factors:null,confidence:'needs_review',service:null,signals,reasons:['Не подтверждена музыкальная релевантность проекта']};
  const reasons=[best.description,`Возраст сигнала: ${best.ageDays} дн.`, 'Автор и актуальность запроса требуют ручной проверки'];
  if(isNonArtist) reasons.push('Публикация в тематическом сообществе: необходимо установить автора');
  const reliable=source==='community'||source==='newsfeed';
  return {...base,assessment:{music:hasMusicContext?'supported':'unknown',need:direct?'explicit':'activity',evidence:reliable?'api_original':'unverified'},kind,score:reliable||source==='demo'?score:null,factors:reliable||source==='demo'?factors:null,confidence:reliable?'source_only':'needs_review',service:direct?.service||null,signals:direct?[direct,...signals.filter(s=>s.id!==direct.id).sort(byDate)]:signals.sort(byDate),reasons:[...reasons.filter(r=>!r.startsWith('Автор и')), reliable?'VK вернул оригинальную публикацию от владельца; проверьте актуальность вручную':'Текст не проверен через VK API']};
}

export function draftOutreach(o:Opportunity): string {
  if (!o.signals.length || o.kind==='watch' || o.kind==='rejected') return '';
  const title = o.candidate.name.replace(/[\n\r]/g,' ').slice(0,80);
  const names:Record<Service,string>={mix_master:'сведением и мастерингом',stem_master:'stem-мастерингом',beat:'битами и аранжировками',production:'музыкальным продакшном',audit:'аудитом звучания'};
  const offering=o.service?names[o.service]:'сведением, мастерингом и музыкальным продакшном';
  const evidence=o.signals.find(s=>s.kind==='direct_request')||o.signals[0];
  const preface=o.kind==='hot'?`Увидели вашу публикацию от ${evidence.publishedAt.slice(0,10)} о поиске специалиста (${evidence.url})`:`Увидели публикацию о новой музыке от ${evidence.publishedAt.slice(0,10)} (${evidence.url})`;
  return `Привет, ${title}! Мы ASV Production — команда музыкального продакшна. ${preface}. Работаем с ${offering}. Подскажите, это сейчас актуально? Если да, можем коротко обсудить вашу задачу и предложить подходящий формат.`;
}
export const SERVICE_LABEL:Record<Service,string>={mix_master:'Сведение + мастеринг · 12 000 ₽',stem_master:'Stem-мастеринг · 5 000 ₽',beat:'Инструментал · 15 000 ₽',production:'Продакшн · от 35 000 ₽',audit:'Аудит · 4 000 ₽'};
export const STATUS_LABEL:Record<LeadStatus,string>={new:'Новый',reviewed:'Изучен',contacted:'Написали',replied:'Ответил',negotiating:'Переговоры',won:'Клиент',lost:'Неактуален',snoozed:'Отложен',favorite:'Избранное'};
