<script setup lang="ts">
import {computed,onMounted,ref} from 'vue';
import {loadRecords,summarize,type LeadRecord} from '../scout/persistence';
const records=ref<LeadRecord[]>([]),error=ref('');
onMounted(async()=>{try{records.value=await loadRecords()}catch(e){error.value=String(e)}});
const info=computed(()=>summarize(records.value));
const replyRate=computed(()=>info.value.contacted?Math.round(100*info.value.replies/info.value.contacted):null);
const closeRate=computed(()=>info.value.contacted?Math.round(100*info.value.wins/info.value.contacted):null);
const pipeline=computed(()=>[
  {name:'Новые',count:records.value.filter(x=>x.status==='new').length},
  {name:'Изучены',count:records.value.filter(x=>x.status==='reviewed').length},
  {name:'Написали',count:info.value.contacted},
  {name:'Ответили',count:info.value.replies},
  {name:'Переговоры',count:info.value.negotiating},
  {name:'Клиенты',count:info.value.wins},
]);
const max=computed(()=>Math.max(1,...pipeline.value.map(x=>x.count)));
const upcoming=computed(()=>records.value.filter(r=>r.followUpAt&&r.status!=='won'&&r.status!=='lost').sort((a,b)=>(a.followUpAt||'').localeCompare(b.followUpAt||'')).slice(0,10));
</script>
<template>
<section class="page scout-page"><div class="page-heading"><div class="heading"><p class="eyebrow">ASV PRODUCTION / PERFORMANCE</p><h1>Результаты <span class="accent">по фактам.</span></h1><p>Только события и суммы, которые вы отметили в CRM. Без придуманных конверсий.</p></div></div><div v-if="error" class="warning">{{error}}</div>
<div class="kpi-grid"><div class="kpi"><div class="kpi-label">В базе · Hot {{info.hot}} / Growth {{info.growth}}</div><strong>{{info.total}}</strong><small>Артисты и проекты</small></div><div class="kpi"><div class="kpi-label">Ответили</div><strong>{{info.replies}}</strong><small>{{replyRate===null?'Нет данных':replyRate+'% от контактов'}}</small></div><div class="kpi"><div class="kpi-label">Заказы</div><strong>{{info.wins}}</strong><small>{{closeRate===null?'Нет данных':closeRate+'% от контактов'}}</small></div><div class="kpi"><div class="kpi-label">Выручка</div><strong>{{info.revenue.toLocaleString('ru-RU')}} ₽</strong><small>Введено вручную</small></div></div>
<div class="detail-grid"><div class="panel"><div class="panel-header"><h2>Воронка</h2><span class="panel-sub">Наблюдаемые события</span></div><div v-for="s in pipeline" :key="s.name" class="funnel-row"><div class="space"><strong>{{s.name}}</strong><span>{{s.count}}</span></div><div class="track"><div :style="{width:100*s.count/max+'%'}"></div></div></div><p class="muted-note mt">«Написали» включает все последующие статусы. Показатели зависят от ручной дисциплины ведения CRM. Маленькая выборка не позволяет прогнозировать конверсию.</p></div><div class="panel"><div class="panel-header"><h2>Следующие контакты</h2><span class="panel-sub">{{upcoming.length}} ближайших</span></div><div v-if="!upcoming.length" class="empty" style="padding:32px"><strong>Напоминаний пока нет</strong><p>В карточке CRM можно назначить дату следующего контакта.</p></div><div v-for="r in upcoming" :key="r.id" class="reminder"><div><strong>{{r.opportunity.candidate.name}}</strong><small>{{r.status}}</small></div><div :class="{'overdue':(r.followUpAt||'')<new Date().toISOString().slice(0,10)}">{{new Date(r.followUpAt||'').toLocaleDateString('ru-RU')}}</div></div><p class="muted-note mt">Напоминания показываются в приложении при открытии. Автоматические push-уведомления не подключены.</p></div></div>
</section>
</template>
<style scoped>.funnel-row{margin:21px 0}.funnel-row .space{font-size:13px;color:#b1c9c9}.track{height:8px;border-radius:5px;background:#21333a;margin-top:10px;overflow:hidden}.track div{height:100%;background:#2ec4b6;border-radius:5px}.reminder{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #25383c;padding:13px 0;gap:10px;font-size:13px}.reminder strong{display:block}.reminder small{color:#7f999e}.overdue{color:#f4a48b}</style>
