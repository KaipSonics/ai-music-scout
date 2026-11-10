<script setup lang="ts">
import {ref,onMounted} from 'vue';
import {useSearchStore} from '../stores/search';
import {useToast} from '../composables/useToast';
import {useRouter} from 'vue-router';
import {allArtists,identity,saveOpportunity} from '../scout/crm';
import {openExternal as openLink} from '../utils/tauriBridge';
import {draftOutreach,SERVICE_LABEL,type Opportunity} from '../scout/opportunity';
import {Plus,User,ExternalLink,Check,ShieldAlert,Sparkles,Flame,Brain,CheckCircle2,Star,MessageSquare,Copy,Heart,Headphones,Send} from '@lucide/vue';
const searchStore=useSearchStore(),toast=useToast(),router=useRouter();
const existingVkIds=ref(new Map<string,string>()),saving=ref(new Set<string>());
const showMessageModal=ref(false),selectedItemForMsg=ref<{name:string}|null>(null),activeTabMsg=ref<'friendly'|'pro'|'direct'>('friendly');
const generatedVariants=ref({friendly:'',pro:'',direct:''});const expanded=ref(new Set<string>());
async function openExternal(url:string){try{await openLink(url);}catch(e){toast.show(String(e),'error');}}
async function loadExisting(){try{existingVkIds.value=new Map((await allArtists()).map(a=>[identity(a)||a.id,a.id]));}catch(e){toast.show(String(e),'error');}}onMounted(loadExisting);
async function startClientSearch(){await searchStore.start();await loadExisting();}
function toggleEvidence(id:string){const next=new Set(expanded.value);if(next.has(id))next.delete(id);else next.add(id);expanded.value=next;}
function generateMessageForArtist(item:{name:string;opportunity:Opportunity}){
 selectedItemForMsg.value=item;const draft=draftOutreach(item.opportunity);
 generatedVariants.value={friendly:draft,pro:draft.replace('Привет,','Здравствуйте,').replace('Подскажите,','Уточните, пожалуйста,'),direct:draft.replace('Мы ASV Production — команда музыкального продакшна.','ASV Production на связи.')};showMessageModal.value=true;
}
async function copyActiveMessage(){try{await navigator.clipboard.writeText(generatedVariants.value[activeTabMsg.value]);toast.show('Черновик скопирован. Отправка — вручную.','success');}catch{toast.show('Буфер недоступен. Выделите и скопируйте текст вручную.','error');}}
async function addToCRM(item:{id:string;opportunity:Opportunity},status:'Новый'|'Избранное'='Новый'){
 if(saving.value.has(item.id))return;saving.value.add(item.id);
 try{const id=await saveOpportunity(item.opportunity,status);existingVkIds.value.set(item.id,id);toast.show('Артист сохранён в CRM','success');}catch(e){toast.show(String(e),'error');}finally{saving.value.delete(item.id);}
}
function openExisting(id:string){router.push('/artist/'+encodeURIComponent(id));}
</script>

<template>
  <div class="scout-v2-page">
    <div class="page-header mb-4">
      <h1>AI Music Scout — Поиск Клиентов ASV Production</h1>
      <p class="text-sm text-muted">Hot / Growth: проверяемые музыкальные проекты и реальные коммерческие потребности.</p>
    </div>

    <!-- ONE CLICK SEARCH BOX -->
    <div class="glass-card mb-4 scout-input-card">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold text-primary mb-1">Найти клиентов для ASV Production</h3>
          <p class="text-xs text-muted">Поиск оригинальных публикаций, проверка профилей и потребностей. Сохраняйте выбранных артистов в CRM.</p>
        </div>

        <button
          class="btn btn-purple scout-start-btn"
          @click="startClientSearch"
          :disabled="searchStore.isSearching"
        >
          <Sparkles :size="20" />
          <span>{{ searchStore.isSearching ? 'Поиск выполняется...' : '🚀 Найти клиентов' }}</span>
        </button>
      </div>
    </div>

    <div class="glass-card mb-4 flex items-center gap-3 search-controls">
      <input type="text" class="glass-input" v-model="searchStore.userSearchQuery" placeholder="Жанры или проекты через запятую" aria-label="Жанры или проекты" :disabled="searchStore.isSearching" />
      <select v-model="searchStore.filter" aria-label="Фильтр возможностей"><option value="all">Hot + Growth</option><option value="hot">Hot — актуальный запрос</option><option value="growth">Growth — развитие</option></select>
      <button class="btn btn-secondary" :disabled="searchStore.isSearching" @click="searchStore.showDemo">{{searchStore.demo?'Закрыть демо':'Демо'}}</button>
      <button v-if="searchStore.isSearching" class="btn btn-danger" @click="searchStore.cancel">Отменить поиск</button>
    </div>
    <div v-if="searchStore.demo" class="alert-box mb-4" role="status">ДЕМО: артисты и публикации вымышлены. Запись в CRM и внешние ссылки отключены.</div>
    <div v-if="searchStore.state==='cancelled' || searchStore.state==='empty'" class="glass-card mb-4" role="status">{{searchStore.stepMessage}}</div>
    <details v-if="searchStore.report" class="glass-card mb-4"><summary>Диагностика поиска</summary><p class="text-sm">Публикаций: {{searchStore.report.postCount}} · Исключено: {{searchStore.report.rejected}} · Недостаточно данных: {{searchStore.report.unverified}}</p><p v-for="(failure,i) in searchStore.report.failures" :key="i" class="text-xs text-danger">{{failure}}</p></details>
    <!-- Interactive Stepper Progress Display -->
    <div v-if="searchStore.currentStep > 0" class="glass-card mb-4 stepper-card">
      <div class="flex items-center gap-3 mb-2">
        <div class="spinner-ring" v-if="searchStore.currentStep < 4"></div>
        <CheckCircle2 v-else color="var(--success)" :size="24" />
        <span class="font-bold text-sm text-primary">{{ searchStore.stepMessage }}</span>
      </div>
    </div>

    <!-- Error Alert -->
    <div v-if="searchStore.error" class="alert-box error-alert mb-4">
      <ShieldAlert :size="20" />
      <span>{{ searchStore.error }}</span>
    </div>

    <!-- Target Results Grid -->
    <div v-if="searchStore.filteredResults.length > 0" class="results-container mb-6">
      <div class="results-header mb-4 flex justify-between items-center">
        <span class="text-sm text-muted">Подтверждённые возможности: <strong>{{ searchStore.filteredResults.length }}</strong></span>
      </div>

      <div class="results-list">
        <div
          v-for="item in searchStore.filteredResults"
          :key="item.id"
          class="glass-card candidate-card-v2 mb-4"
          :class="{ 'high-score-card': searchStore.evidenceMap[item.id.toString()]?.commercial_score && (searchStore.evidenceMap[item.id.toString()].commercial_score??0) >= 80 }"
        >
          <!-- Left Column: Avatar -->
          <div class="card-left">
            <img v-if="item.photo_200 || item.photo_100" :src="item.photo_200 || item.photo_100" class="avatar-v2" alt="avatar" referrerpolicy="no-referrer" />
            <div v-else class="avatar-placeholder"><User :size="36" /></div>
          </div>

          <!-- Main Column: Clean Artist Passport & Summary -->
          <div class="card-main">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <h2 class="artist-title">{{ item.name }}</h2>
                <a href="#" @click.prevent="!searchStore.demo && openExternal(item.opportunity.candidate.profileUrl)" class="vk-link text-xs">
                  vk.com/{{ item.screen_name || ('public' + item.id) }} <ExternalLink :size="12" />
                </a>
              </div>

              <!-- AI Lead Score Badge (0-100) -->
              <div v-if="searchStore.evidenceMap[item.id.toString()]" class="flex items-center gap-2">
                <span class="confidence-pill flex items-center gap-1">
                  <Brain :size="12" /> {{ searchStore.evidenceMap[item.id.toString()].artist_type }}
                </span>

                <span class="score-badge flex items-center gap-1">
                  <Flame :size="14" /> Opportunity: {{ searchStore.evidenceMap[item.id.toString()].commercial_score }} / 100
                </span>
              </div>
            </div>

            <!-- Followers Meta & City -->
            <div class="meta-line text-xs text-muted flex items-center gap-3 mb-2">
              <span class="font-bold text-primary">
                📊 {{ (item.members_count || 0).toLocaleString() }} подписчиков
              </span>
              <span v-if="item.city?.title" class="city-tag">
                📍 {{ item.city.title }}
              </span>
            </div>

            <!-- ULTRA-AESTHETIC SINGLE SENTENCE AI HIGHLIGHT -->
            <div class="ai-punchline-box text-xs mb-2 flex items-center gap-2">
              <span class="ai-sparkle-pill flex items-center gap-1 font-bold">
                <Sparkles :size="13" color="#53f6e4" />
                <span>Сигнал:</span>
              </span>
              <span class="punchline-text text-muted font-medium">
                {{ searchStore.evidenceMap[item.id.toString()]?.summary || 'Недостаточно данных для оценки.' }}
              </span>
            </div>

            <div class="text-xs mb-2" v-if="item.opportunity.service">{{SERVICE_LABEL[item.opportunity.service]}}</div>
            <button class="btn btn-secondary btn-sm mb-2" @click="toggleEvidence(item.id)">Публикации и оценка</button>
            <div v-if="expanded.has(item.id)" class="evidence-panel text-xs">
              <p>Релевантность: {{item.opportunity.assessment?.music==='supported'?'Музыкальный контекст подтверждён':'Не проверено'}} · Данные: {{searchStore.demo?'Демо':item.opportunity.confidence==='source_only'?'Оригинальная публикация из VK':'Нужна проверка'}}</p>
              <article v-for="signal in item.opportunity.signals" :key="signal.id" class="mb-3"><strong>{{new Date(signal.publishedAt).toLocaleDateString('ru-RU')}} · {{signal.description}}</strong><p>{{signal.quote}}</p><p>Владелец: {{signal.sourceOwnerId}} · Автор: {{signal.authorId??'неизвестен'}}</p><button class="btn btn-secondary btn-sm" :disabled="searchStore.demo" @click="openExternal(signal.url)">Открыть источник</button></article>
              <p v-if="item.opportunity.factors">Факторы (0–100): потребность {{item.opportunity.factors.need}} × 0,35; актуальность {{item.opportunity.factors.timing}} × 0,25; услуги {{item.opportunity.factors.fit}} × 0,20; активность {{item.opportunity.factors.activity}} × 0,10; контакт {{item.opportunity.factors.contact}} × 0,10. Балл не является вероятностью заказа.</p>
            </div>
            <!-- ASV Production Fit Rationale -->
            <div v-if="searchStore.evidenceMap[item.id.toString()]?.asv_reason" class="asv-reason-box text-xs">
              <span class="font-bold text-secondary">Перспектива для ASV:</span> {{ searchStore.evidenceMap[item.id.toString()].asv_reason }}
            </div>
          </div>

          <!-- Right Column: Actions -->
          <div class="card-actions-v2">
            <button
              class="btn btn-purple btn-sm flex items-center gap-1"
              @click="generateMessageForArtist(item)"
              title="Сгенерировать черновики от нашей команды"
            >
              <MessageSquare :size="15" />
              <span>Сообщение</span>
            </button>

            <button
              v-if="existingVkIds.has(item.id.toString())"
              class="btn btn-secondary btn-sm flex items-center gap-1"
              @click="openExisting(existingVkIds.get(item.id.toString())!)"
            >
              <Check :size="16" color="var(--success)" />
              <span>В CRM</span>
            </button>

            <template v-else>
              <button
                class="btn btn-primary btn-sm flex items-center gap-1"
                :disabled="searchStore.demo || saving.has(item.id)" @click="addToCRM(item, 'Новый')"
              >
                <Plus :size="16" />
                <span>В CRM</span>
              </button>

              <button
                class="btn btn-secondary btn-sm flex items-center gap-1"
                :disabled="searchStore.demo || saving.has(item.id)" @click="addToCRM(item, 'Избранное')"
                title="Добавить в Избранное ⭐"
              >
                <Star :size="16" color="#fde047" />
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- OUTREACH MESSAGE GENERATOR MODAL (3 HUMAN TEAM VARIANTS) -->
    <div v-if="showMessageModal" class="modal-overlay" @click.self="showMessageModal = false">
      <div class="glass-card modal-content p-6" role="dialog" aria-modal="true" aria-label="Черновик обращения">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-bold text-lg text-primary flex items-center gap-2">
            <MessageSquare :size="20" /> Черновик обращения от команды ASV
          </h3>
          <button class="btn btn-secondary btn-sm" @click="showMessageModal = false">✕</button>
        </div>

        <div class="space-y-4">
          <div class="text-xs text-muted">Кому: <strong>{{ selectedItemForMsg?.name }}</strong> (от нашей команды)</div>

          <!-- 3 HUMAN TONES TABS -->
          <div class="flex gap-2 mb-2 border-b border-purple-500/20 pb-2">
            <button
              class="btn btn-sm text-xs flex items-center gap-1"
              :class="activeTabMsg === 'friendly' ? 'btn-purple' : 'btn-secondary'"
              @click="activeTabMsg = 'friendly'"
            >
              <Heart :size="14" /> 🤝 Искренний / Дружеский
            </button>

            <button
              class="btn btn-sm text-xs flex items-center gap-1"
              :class="activeTabMsg === 'pro' ? 'btn-purple' : 'btn-secondary'"
              @click="activeTabMsg = 'pro'"
            >
              <Headphones :size="14" /> 🎧 Студийный / Стилистический
            </button>

            <button
              class="btn btn-sm text-xs flex items-center gap-1"
              :class="activeTabMsg === 'direct' ? 'btn-purple' : 'btn-secondary'"
              @click="activeTabMsg = 'direct'"
            >
              <Send :size="14" /> 🚀 Прямой / Лаконичный
            </button>
          </div>

          <textarea
            aria-label="Текст обращения" v-model="generatedVariants[activeTabMsg]"
            rows="6"
            class="w-full text-sm p-3 glass-input border border-purple-500/30 rounded-lg"
          ></textarea>

          <div class="flex justify-end gap-3">
            <button class="btn btn-secondary" @click="showMessageModal = false">Закрыть</button>
            <button class="btn btn-purple flex items-center gap-2" @click="copyActiveMessage">
              <Copy :size="16" />
              <span>Скопировать выбранный вариант</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scout-v2-page {
  display: flex;
  flex-direction: column;
}

.scout-input-card {
  background: rgba(18, 14, 38, 0.8);
  border: 1px solid rgba(157, 78, 221, 0.3);
  padding: 20px 24px;
}

.scout-start-btn {
  min-width: 220px;
  box-shadow: 0 4px 18px rgba(157, 78, 221, 0.4);
  font-size: 1.05rem;
}

.stepper-card {
  background: rgba(12, 10, 26, 0.9);
  border: 1px solid rgba(98, 225, 216, 0.3);
}

.spinner-ring {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(98, 225, 216, 0.2);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.candidate-card-v2 {
  display: flex;
  gap: 20px;
  padding: 20px;
}

.high-score-card {
  border-color: rgba(157, 78, 221, 0.4);
  background: rgba(28, 20, 48, 0.8);
}

.avatar-v2 {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--glass-border);
}

.avatar-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.card-main {
  flex: 1;
}

.artist-title {
  font-size: 1.4rem;
  font-weight: 700;
}

.confidence-pill {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-secondary);
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
}

.score-badge {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.4);
  padding: 4px 12px;
  border-radius: 14px;
  font-weight: 800;
  font-size: 0.9rem;
}

.ai-punchline-box {
  background: rgba(10, 8, 24, 0.7);
  border: 1px solid rgba(83, 246, 228, 0.25);
  border-radius: 8px;
  padding: 8px 12px;
  backdrop-filter: blur(8px);
}

.ai-sparkle-pill {
  background: rgba(83, 246, 228, 0.12);
  color: #53f6e4;
  padding: 2px 8px;
  border-radius: 12px;
  white-space: nowrap;
}

.punchline-text {
  line-height: 1.35;
  color: rgba(255, 255, 255, 0.85);
}

.asv-reason-box {
  background: rgba(157, 78, 221, 0.1);
  border-left: 3px solid #c084fc;
  padding: 6px 12px;
  border-radius: 0 8px 8px 0;
}

.card-actions-v2 {
  display: flex;
  flex-direction: column;
  gap: 8px;
  justify-content: center;
}

.rejected-accordion-card {
  background: rgba(20, 10, 15, 0.6);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.rejected-item-box {
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-left: 3px solid #ef4444;
  padding: 10px 12px;
  border-radius: 4px;
}

.rejection-reason-text {
  color: #fca5a5;
  font-size: 0.85rem;
  line-height: 1.3;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  width: 90%;
  max-width: 640px;
  background: rgba(18, 14, 38, 0.95);
  border: 1px solid rgba(157, 78, 221, 0.4);
}
.search-controls{flex-wrap:wrap}.search-controls input{flex:1;min-width:190px}.search-controls select{width:auto}.evidence-panel{padding:12px;border:1px solid var(--glass-border);border-radius:8px;line-height:1.6;overflow-wrap:anywhere}@media(max-width:768px){.scout-input-card>.flex,.card-main>.flex{flex-wrap:wrap;gap:12px}.search-controls input{flex:1 1 100%;width:100%}.search-controls select,.search-controls>.btn{flex:1;min-width:0;width:auto}.scout-start-btn{width:100%}.modal-content{max-height:85vh;overflow:auto}.modal-content .flex{flex-wrap:wrap}}
.vk-link{color:var(--primary);text-decoration:none}.search-controls input{padding:12px;min-height:44px}
</style>
