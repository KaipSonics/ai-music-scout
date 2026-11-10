<script setup lang="ts">
import {computed,onMounted,ref} from 'vue';
import {useSettingsStore} from '../stores/settings';
import {discover,inspectManualPost,type ScanStats} from '../scout/discovery';
import {candidateFromOwner,draftOutreach,evaluateOpportunity,SERVICE_LABEL,STATUS_LABEL,type Opportunity,type LeadStatus} from '../scout/opportunity';
import {loadRecords,mergeScan,updateRecord,summarize,type LeadRecord} from '../scout/persistence';
import {openExternal} from '../utils/tauriBridge';

const settings=useSettingsStore();
const rows=ref<LeadRecord[]>([]),loading=ref(false),error=ref(''),message=ref('');
const filter=ref<'all'|'hot'|'growth'|'watch'>('all'),query=ref('');
const showHandled=ref(false),sortBy=ref('priority'),draftText=ref(''),draftOpen=ref(false);
const demoMode=ref(false),demo=ref<LeadRecord[]>([]);
const progress=ref({done:0,total:1,stage:''});
const report=ref<ScanStats|null>(null),detail=ref<string|null>(null),editNote=ref(''),editReminder=ref('');
const manual=ref(false),manualUrl=ref(''),manualText=ref(''),manualName=ref(''),manualDate=ref(new Date().toISOString().slice(0,10));
const visible=computed(()=>demoMode.value?demo.value:rows.value);
const counts=computed(()=>demoMode.value?{...summarize(visible.value),hot:demo.value.filter(r=>r.opportunity.kind==='hot').length,growth:demo.value.filter(r=>r.opportunity.kind==='growth').length}:summarize(visible.value));
const filtered=computed(()=>visible.value.filter(r=>(showHandled.value||!['contacted','replied','negotiating','won','lost','snoozed'].includes(r.status))&&(filter.value==='all'||r.opportunity.kind===filter.value)&&`${r.opportunity.candidate.name} ${r.opportunity.candidate.description||''} ${r.opportunity.signals.map(s=>s.quote).join(' ')}`.toLowerCase().includes(query.value.trim().toLowerCase())).sort((a,b)=>sortBy.value==='recent'?b.lastSeen.localeCompare(a.lastSeen):Number(b.opportunity.kind==='hot'&&b.opportunity.confidence==='source_only')-Number(a.opportunity.kind==='hot'&&a.opportunity.confidence==='source_only')||(b.opportunity.score??-1)-(a.opportunity.score??-1)));
const active=computed(()=>visible.value.find(x=>x.id===detail.value));
const formatDate=(v:string)=>new Date(v).toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'});
function setFilter(id:string){ filter.value=id as 'all'|'hot'|'growth'|'watch' }
const isPending=(r:LeadRecord)=>!!r.followUpAt && r.status!=='won'&&r.status!=='lost'&&new Date(r.followUpAt).getTime()<Date.now();
async function reload(){try{rows.value=await loadRecords()}catch(e){error.value=String(e)}}
onMounted(reload);
function buildDemo(){const now=Date.now();const mk=(id:number,name:string,text:string,age:number,count:number)=>{
  const c={...candidateFromOwner(-id,{name,screen_name:'example'+id,members_count:count,description:'Независимый музыкальный проект'})};
  const o=evaluateOpportunity(c,[{id:100+id,owner_id:-id,from_id:-id,date:Math.floor((now-age*86400000)/1000),text}],'demo');
  return {id:o.id,opportunity:o,status:'new' as LeadStatus,note:'',firstSeen:new Date(now).toISOString(),lastSeen:new Date(now).toISOString(),history:[]};
};demo.value=[mk(1101,'NEON WAVES','Ищем звукорежиссера для сведения нового EP. Кто поможет с 5 треками?',2,4200),mk(1102,'SOUTH SIDE','Нужен битмейкер, чтобы написать бит под новый сингл',4,9600),mk(1103,'APARTMENT SOUNDS','Записываем новый альбом, уже собрали большую часть материала',6,3100),mk(1104,'MIDNIGHT LINE','Готовим мини-альбом, скоро покажем первые треки',13,1600)];}
function toggleDemo(){demoMode.value=!demoMode.value;if(demoMode.value)buildDemo();message.value=demoMode.value?'Демонстрационные контакты. Данные вымышлены и не сохраняются.':'';error.value='';detail.value=null;}
async function scan(){if(!settings.vkToken){error.value='Нет VK-токена. Добавьте его в разделе «Настройки».';return}
  loading.value=true;error.value='';message.value='';report.value=null;demoMode.value=false;
  try{
    const result=await discover({token:settings.vkToken,mode:settings.mode,maxGroups:settings.maxGroups,maxQueries:settings.maxQueries,terms:settings.extraKeywords.split(',').map(s=>s.trim()).filter(Boolean)},p=>progress.value=p);
    report.value=result.stats;rows.value=await mergeScan(result.opportunities);
    message.value=`Проверка завершена: ${result.opportunities.length} возможностей, ${result.stats.postCount} публикаций просмотрено. ${result.stats.failures.length?'Есть ошибки источников — смотрите отчёт.':''}`;
    if(result.stats.failures.length && !result.opportunities.length)error.value='Не удалось получить подходящие результаты. Ниже перечислены ошибки VK API.';
  }catch(e){error.value=String(e)}finally{loading.value=false}}
async function saveManual(){error.value='';message.value='';
  try{const o=inspectManualPost(manualUrl.value,manualText.value,manualName.value,manualDate.value);
    rows.value=await mergeScan([o]);demoMode.value=false;message.value='Публикация добавлена для ручной проверки. Реальность автора не проверялась.';manual.value=false;manualText.value='';manualUrl.value='';
  }catch(e){error.value=String(e)}
}
function inspect(r:LeadRecord){detail.value=r.id;editNote.value=r.note;editReminder.value=r.followUpAt?.slice(0,10)||'';}
async function changeStatus(r:LeadRecord,status:LeadStatus){
  if(demoMode.value){r.status=status;return}
  try{rows.value=await updateRecord(r.id,{status});message.value='Статус сохранён'}catch(e){error.value=String(e)}
}
async function saveDetails(){if(!active.value)return;
  if(demoMode.value){active.value.note=editNote.value;active.value.followUpAt=editReminder.value||undefined;detail.value=null;return}
  try{rows.value=await updateRecord(active.value.id,{note:editNote.value,followUpAt:editReminder.value||''});detail.value=null;message.value='Изменения сохранены'}catch(e){error.value=String(e)}
}
async function copyDraft(o:Opportunity){
  const text=draftOutreach(o);if(!text){error.value='Для этого контакта нет обоснованного черновика';return}
  draftText.value=text;draftOpen.value=true;
}
async function go(url:string){try{await openExternal(url)}catch(e){error.value=String(e)}}
</script>
<template>
<section class="page">
  <div class="page-heading"><div class="heading"><p class="eyebrow">PRODUCTION INTELLIGENCE / DISCOVERY</p><h1>Коммерческий <span class="accent">радар.</span></h1><p>Находим не просто артистов, а конкретные поводы предложить услуги ASV.</p></div>
    <div class="toolbar"><button class="button ghost" @click="toggleDemo">{{demoMode?'Закрыть демо':'◎ Демо'}}</button><button class="button primary" :disabled="loading" @click="scan">{{loading?'⌛ Сканирование…':'◉ Запустить радар'}}</button></div>
  </div>
  <div v-if="demoMode" class="warning">ДЕМО-РЕЖИМ: все артисты и публикации вымышлены. Демо не отправляет запросы VK и ничего не записывает в CRM.</div>
  <div v-if="error" class="warning" role="alert">{{error}}</div>
  <div v-if="message" class="notice" role="status">{{message}}</div>
  <div v-if="loading" class="panel mb"><div class="space"><strong style="font-size:13px">{{progress.stage}}</strong><span class="muted-note">{{progress.done}} / {{progress.total}}</span></div><div class="progress-track"><div :style="{width:(progress.done/Math.max(1,progress.total)*100)+'%'}"></div></div></div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Всего в базе <span class="kpi-icon">▦</span></div><strong>{{counts.total}}</strong><small>Уникальные контакты</small></div>
    <div class="kpi"><div class="kpi-label">Hot Leads <span class="kpi-icon">↗</span></div><strong>{{counts.hot}}</strong><small>Прямые коммерческие сигналы</small></div>
    <div class="kpi"><div class="kpi-label">Growth Leads <span class="kpi-icon">◈</span></div><strong>{{counts.growth}}</strong><small>Перспективные проекты</small></div>
    <div class="kpi"><div class="kpi-label">Ответили <span class="kpi-icon">↗</span></div><strong>{{counts.replies}}</strong><small>В CRM (отмечено вручную)</small></div>
  </div>
  <div class="panel">
    <div class="panel-header"><div><h2>Лента возможностей</h2><div class="panel-sub">Приоритет по признакам интереса, а не «вероятности заказа» от ИИ</div></div><button class="button small ghost" @click="manual=!manual">+ Добавить публикацию</button></div>
    <div v-if="manual" class="manual-panel">
      <div class="panel-header"><h2>Ручная проверка публикации VK</h2><button class="button small ghost" @click="manual=false">×</button></div>
      <div class="manual-grid"><div class="field-group"><label>Ссылка на пост</label><input v-model="manualUrl" class="field" placeholder="https://vk.com/wall-123_456" /></div><div class="field-group"><label>Имя автора / проекта</label><input v-model="manualName" class="field" placeholder="Название артиста" /></div></div>
      <div class="field-group"><label>Текст публикации</label><textarea v-model="manualText" class="field" placeholder="Скопируйте текст опубликованного поста"></textarea></div>
      <div class="row"><div class="field-group" style="margin:0;max-width:200px"><label>Дата публикации</label><input v-model="manualDate" type="date" class="field" /></div><button class="button primary" style="align-self:end" @click="saveManual">Проверить и сохранить</button></div>
      <p class="muted-note">Ручной ввод не подтверждает подлинность поста. Scout только анализирует предоставленный текст.</p>
    </div>
    <div class="filterbar"><label class="muted-note"><input v-model="showHandled" type="checkbox" /> Показать обработанные</label><select v-model="sortBy" class="field narrow" aria-label="Сортировка"><option value="priority">По приоритету Hot → Growth</option><option value="recent">Недавно обнаруженные</option></select><div class="segment"><button v-for="item in [{id:'all',label:'Все'},{id:'hot',label:'Горячие'},{id:'growth',label:'Перспективные'},{id:'watch',label:'Без сигнала'}]" :key="item.id" :class="{active:filter===item.id}" @click="setFilter(item.id)">{{item.label}}</button></div><input v-model="query" class="field narrow push" placeholder="⌕  Артист или публикация…" /></div>
    <div v-if="!filtered.length" class="empty"><div class="empty-icon">◎</div><strong>Пока нет найденных возможностей</strong><p>Подключите VK и запустите поиск, проверьте конкретную публикацию вручную или откройте демонстрацию.</p><div class="toolbar"><button class="button primary" @click="scan">Запустить радар</button><button class="button" @click="toggleDemo">Открыть демо</button></div></div>
    <div v-else class="lead-list">
      <article v-for="r in filtered" :key="r.id" class="lead">
        <div class="lead-head"><div class="lead-avatar"><img v-if="r.opportunity.candidate.avatar" :src="r.opportunity.candidate.avatar" alt="" referrerpolicy="no-referrer" /><template v-else>{{r.opportunity.candidate.name.slice(0,1).toUpperCase()}}</template></div>
          <div class="lead-info"><h3>{{r.opportunity.candidate.name}}</h3><div class="lead-meta"><span>{{r.opportunity.candidate.sourceType==='group'?'Сообщество VK':'Профиль VK'}}</span><span v-if="r.opportunity.candidate.membersCount">{{r.opportunity.candidate.membersCount.toLocaleString('ru-RU')}} подписчиков</span><span>{{STATUS_LABEL[r.status]}}</span></div></div>
          <div class="lead-score"><strong>{{r.opportunity.score??'—'}}</strong><small>Opportunity / 100</small></div>
        </div>
        <div class="lead-tags"><span :class="['chip',r.opportunity.kind]">{{r.opportunity.kind==='hot'?'↗ HOT LEAD':r.opportunity.kind==='growth'?'◈ GROWTH':'◌ ПРОВЕРИТЬ'}}</span><span v-if="r.opportunity.service" class="chip source">{{SERVICE_LABEL[r.opportunity.service]}}</span><span v-if="isPending(r)" class="chip hot">⏰ Напомнить</span><span class="chip watch">{{r.opportunity.confidence==='source_only'?'Оригинал получен через VK':r.opportunity.confidence==='missing'?'Нет доказательств':'Нужна проверка автора'}}</span></div>
        <p class="lead-desc">{{r.opportunity.reasons.join(' · ')}}</p>
        <div v-if="r.opportunity.signals.length" class="evidence"><div class="evidence-head"><span>◉ {{r.opportunity.signals[0].description}}</span><span class="evidence-time">{{formatDate(r.opportunity.signals[0].publishedAt)}} · {{r.opportunity.signals[0].ageDays}} дн.</span></div><div class="evidence-quote">«{{r.opportunity.signals[0].quote}}»</div><div class="evidence-footer"><span class="muted-note">{{r.opportunity.source==='manual'?'Ручной ввод · источник не проверен через API':'Источник получен через VK · актуальность проверьте вручную'}}</span><button v-if="!demoMode" class="text-link" @click="go(r.opportunity.signals[0].url)">Открыть источник ↗</button><span v-else class="muted-note">Демо-ссылка неактивна</span></div></div>
        <div v-else class="evidence"><div class="evidence-quote">Подтверждённые актуальные публикации отсутствуют. Не отправляйте коммерческое сообщение без проверки.</div></div>
        <div class="lead-actions"><button class="button small primary" :disabled="!r.opportunity.signals.length || demoMode" @click="copyDraft(r.opportunity)">Черновик обращения</button><button class="button small" @click="inspect(r)">Открыть карточку</button><button class="button small ghost" :disabled="demoMode" @click="go(r.opportunity.candidate.profileUrl)">Профиль ↗</button><span class="push"></span><select class="field select" style="max-width:150px;padding:7px 9px;min-height:32px;font-size:12px" :value="r.status" @change="changeStatus(r,($event.target as HTMLSelectElement).value as LeadStatus)"><option v-for="(label,key) in STATUS_LABEL" :key="key" :value="key">{{label}}</option></select></div>
      </article>
    </div>
  </div>
  <div v-if="report" class="panel mt"><div class="panel-header"><h2>Отчёт последнего сканирования</h2><span class="chip source">API: {{report.postQueries}} поисков постов, {{report.checkedGroups}} проверок стен</span></div><p class="muted-note">Просмотрено публикаций: {{report.postCount}}. Ошибок: {{report.failures.length}}. Ошибки не превращаются в подтверждённые лиды.</p><details v-if="report.failures.length"><summary>Показать ошибки источников</summary><p v-for="(f,i) in report.failures" :key="i" class="muted-note" style="overflow-wrap:anywhere">{{f}}</p></details></div>
  <div v-if="detail && active" class="modal-backdrop" @click.self="detail=null"><div class="modal panel" role="dialog" aria-modal="true" aria-label="Карточка лида"><div class="panel-header"><h2>{{active.opportunity.candidate.name}}</h2><button class="button ghost small" @click="detail=null">✕ Закрыть</button></div><div class="lead-tags"><span :class="['chip',active.opportunity.kind]">{{active.opportunity.kind.toUpperCase()}}</span><span class="chip">Оценка: {{active.opportunity.score??'неизвестна'}}</span></div>
    <div v-for="signal in active.opportunity.signals" :key="signal.id" class="evidence"><strong>{{signal.description}} · {{formatDate(signal.publishedAt)}}</strong><p class="evidence-quote">{{signal.quote}}</p><p class="muted-note">Владелец: {{signal.sourceOwnerId}} · Автор: {{signal.authorId??'неизвестен'}} · Получено: {{formatDate(signal.capturedAt)}}</p><button v-if="!demoMode" class="text-link" @click="go(signal.url)">Источник ↗</button></div>
    <div class="field-group"><label>Заметки для команды</label><textarea v-model="editNote" class="field" placeholder="Контекст, ответ артиста, ограничения…"></textarea></div>
    <div class="field-group"><label>Вернуться к контакту (дата)</label><input v-model="editReminder" class="field" type="date" /></div>
    <div v-if="active.opportunity.factors" class="factor-list"><strong>Факторы: потребность × 0,35 + актуальность × 0,25 + услуги × 0,20 + активность × 0,10 + контакт × 0,10</strong><div v-for="(v,k) in active.opportunity.factors" :key="k" class="factor"><span>{{({need:'Потребность',timing:'Актуальность',fit:'Услуги ASV',activity:'Активность',contact:'Контакт'} as Record<string,string>)[k]}}</span><div class="factor-track"><div :style="{width:v+'%'}"></div></div><strong>{{v}}</strong></div></div>
    <div class="divider"></div><strong style="font-size:13px">История</strong><div class="history mt"><div v-for="(h,i) in [...active.history].reverse().slice(0,12)" :key="i" class="history-row">{{h.text}}<small>{{formatDate(h.at)}}</small></div></div><div class="row mt"><button class="button primary" @click="saveDetails">Сохранить</button><button class="button ghost" @click="detail=null">Отмена</button></div>
  </div></div>
<div v-if="draftOpen" class="modal-backdrop" @click.self="draftOpen=false"><div class="modal panel" role="dialog" aria-modal="true" aria-label="Черновик обращения"><div class="panel-header"><h2>Личное обращение</h2><button class="button ghost" @click="draftOpen=false">Закрыть</button></div><p class="muted-note">Проверьте автора и источник. Отправка только вручную через VK.</p><textarea v-model="draftText" class="field" aria-label="Текст обращения" rows="8"></textarea><button class="button primary" @click="draftOpen=false">Готово</button></div></div>
</section>
</template>
<style scoped>
.progress-track,.factor-track{background:#23383b;overflow:hidden;border-radius:20px;height:6px;margin-top:10px}.progress-track div,.factor-track div{height:100%;background:#2ec4b6;transition:width .3s}.manual-panel{background:#0d181d;padding:18px;border-radius:11px;border:1px solid #31514f;margin-bottom:16px}.manual-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;justify-content:center;align-items:center;padding:18px;z-index:50}.modal{max-width:550px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 20px 80px rgba(0,0,0,.55)}.factor-list{display:flex;flex-direction:column;gap:9px;font-size:12px;color:#b8c9c8}.factor{display:grid;grid-template-columns:110px 1fr 25px;align-items:center;gap:10px}.factor-track{margin:0}.factor strong{font-size:12px;text-align:right}details summary{color:#2ec4b6;cursor:pointer;font-size:12px;margin:12px 0}@media(max-width:600px){.manual-grid{grid-template-columns:1fr}.modal{max-height:85vh}.factor{grid-template-columns:90px 1fr 24px}}
</style>
