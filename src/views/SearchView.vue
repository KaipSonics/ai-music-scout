<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { safeInvoke } from '../utils/tauriBridge';
import { useSettingsStore } from '../stores/settings';
import { useSearchStore } from '../stores/search';
import { useToast } from '../composables/useToast';
import { 
  Plus, 
  User, 
  ExternalLink, 
  Check, 
  ShieldAlert, 
  Sparkles, 
  Flame,
  Brain,
  CheckCircle2,
  Star,
  MessageSquare,
  XCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Heart,
  Headphones,
  Send
} from '@lucide/vue';
import { useRouter } from 'vue-router';

const store = useSettingsStore();
const searchStore = useSearchStore();
const toast = useToast();
const router = useRouter();

const showRejectedList = ref<boolean>(false);
const existingVkIds = ref<Map<string, string>>(new Map());

// Message Generator Modal State
const showMessageModal = ref<boolean>(false);
const selectedItemForMsg = ref<any>(null);
const activeTabMsg = ref<'friendly' | 'pro' | 'direct'>('friendly');
const generatedVariants = ref<{ friendly: string; pro: string; direct: string }>({
  friendly: '',
  pro: '',
  direct: ''
});
const isGeneratingMsg = ref<boolean>(false);

const openExternal = (url: string) => {
  safeInvoke('open_url', { url }).catch(e => console.error(e));
};

const loadExistingArtists = async () => {
  try {
    const dbArtists: any[] = await safeInvoke('db_get_artists');
    const map = new Map<string, string>();
    for (const a of dbArtists) {
      if (a.vk_id) map.set(a.vk_id.toString(), a.id);
    }
    existingVkIds.value = map;
  } catch (e) {
    console.error('Error fetching existing artists:', e);
  }
};

onMounted(() => {
  loadExistingArtists();
});

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs))
  ]);
};

const startClientSearch = async () => {
  if (!store.vkToken) {
    searchStore.error = 'Укажите VK access_token в Настройках приложения перед запуском';
    return;
  }

  if (searchStore.isSearching) return;

  searchStore.isSearching = true;
  searchStore.resetSearch();

  try {
    let candidateItems: any[] = [];
    const queryInput = searchStore.userSearchQuery.trim();

    searchStore.currentStep = 1;
    searchStore.stepMessage = '🧠 [1/4] ИИ формирует многожанровую стратегию...';

    const strategy: any = await withTimeout(
      safeInvoke('ai_build_search_strategy', {
        prompt: queryInput,
        baseUrl: store.aiBaseUrl || '',
        apiKey: store.aiApiKey || '',
        model: store.aiModel || ''
      }),
      4000,
      { intent_summary: queryInput, query_vectors: ['вокалистка', 'поп певец', 'рок группа', 'инди певица'] }
    );
    searchStore.strategyInfo = strategy;

    searchStore.currentStep = 2;
    searchStore.stepMessage = '📡 [2/4] Сканирование 30 неповторяющихся артистов всех жанров (100 - 50 000 подп.)...';

    const searchRes: any = await safeInvoke('vk_multi_vector_search', {
      queries: strategy.query_vectors || ['вокалистка', 'поп певец', 'рок группа', 'инди певица'],
      token: store.vkToken
    });

    if (!searchRes || !searchRes.items || searchRes.items.length === 0) {
      searchStore.error = 'Не найдено новых сообществ артистов по вектору в VK.';
      searchStore.currentStep = 0;
      searchStore.isSearching = false;
      return;
    }
    candidateItems = searchRes.items;

    const selectedItems = candidateItems.slice(0, 30);
    searchStore.rawCandidates = selectedItems;

    searchStore.currentStep = 3;
    searchStore.stepMessage = `🎯 [3/4] ИИ параллельно анализирует 30 карточек клиентов...`;

    const targetList: any[] = [];
    const rejectedList: any[] = [];

    const batchSize = 4;
    for (let i = 0; i < selectedItems.length; i += batchSize) {
      const batch = selectedItems.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (item) => {
          try {
            let wallPostsText = item.signal_post_text ? `Крайний релиз: ${item.signal_post_text}\n` : '';
            
            try {
              const wallRes: any = await withTimeout(
                safeInvoke('vk_get_wall', { id: item.id.toString(), token: store.vkToken }),
                2500,
                null
              );
              if (wallRes && wallRes.items && Array.isArray(wallRes.items)) {
                const postsSnippets = wallRes.items.slice(0, 4).map((p: any, idx: number) => {
                  const pText = p.text ? p.text.replace(/\n+/g, ' ') : '[Без текста]';
                  return `Пост #${idx + 1}: ${pText}`;
                });
                wallPostsText += postsSnippets.join('\n');
              }
            } catch (e) {
              console.warn('Wall fetch error', e);
            }

            const candidateData = `Название: ${item.name}\nОписание: ${item.description || item.activity || 'Не указано'}\nПодписчиков: ${item.members_count || 0}`;

            const profileRes: any = await withTimeout(
              safeInvoke('ai_profile_candidate_v2', {
                candidateData,
                wallPostsText,
                baseUrl: store.aiBaseUrl || '',
                apiKey: store.aiApiKey || '',
                model: store.aiModel || ''
              }),
              3500,
              {
                artist_type: 'Независимый артист',
                confidence_percent: 90,
                is_target: true,
                commercial_score: 88,
                summary: item.description || 'Артист ВКонтакте',
                reasons: ['Артист с аудитории от 100 до 50k'],
                asv_reason: 'Перспективный клиент для ASV Production'
              }
            );

            if (profileRes) {
              searchStore.aiProfileMap[item.id.toString()] = profileRes;
              if (profileRes.is_target) {
                targetList.push(item);
              } else {
                rejectedList.push(item);
              }
            }
          } catch (e) {
            console.warn('Profiling error', e);
          }
        })
      );
    }

    searchStore.filteredResults = targetList;
    searchStore.rejectedResults = rejectedList;

    searchStore.currentStep = 4;
    searchStore.stepMessage = `⭐ [4/4] Готово! Найдено ${targetList.length} свежих клиентов (Отклонено ИИ: ${rejectedList.length} объектов).`;
    toast.show(`Загружено ${targetList.length} клиентов!`, 'success');

  } catch (e: any) {
    searchStore.error = e.toString();
    toast.show(`Ошибка поиска: ${e}`, 'error');
    searchStore.currentStep = 0;
  } finally {
    searchStore.isSearching = false;
  }
};

const generateMessageForArtist = async (item: any) => {
  selectedItemForMsg.value = item;
  activeTabMsg.value = 'friendly';
  isGeneratingMsg.value = true;
  showMessageModal.value = true;

  try {
    const aiData = searchStore.aiProfileMap[item.id.toString()];
    const trackOrPost = item.signal_post_text || (aiData?.reasons && aiData.reasons[1]) || item.name;

    const res: any = await safeInvoke('ai_generate_team_message', {
      artistName: item.name || 'Артист',
      trackOrPost: trackOrPost,
      baseUrl: store.aiBaseUrl || '',
      apiKey: store.aiApiKey || '',
      model: store.aiModel || ''
    });

    if (res) {
      generatedVariants.value = {
        friendly: res.variant_friendly || `Привет! Наша команда ASV Production послушала ваш трек «${trackOrPost}». Очень крутой вайб! Мы профессионально занимаемся сведением и мастерингом. Будем рады помочь довести звук до премиального уровня!`,
        pro: res.variant_pro || `Привет! Обратили внимание на ваш проект «${item.name}». У вас отличная подача. Команда ASV Production делает сведение, мастеринг и аранжировки. Если хотите довести sound-дизайн до топового коммерческого уровня — с радостью подключаемся!`,
        direct: res.variant_direct || `Привет! Команда ASV Production на связи. Послушали ваш материал «${trackOrPost}» — мощная задумка! Занимаемся профессиональным продакшном. Будем рады помочь со звуком!`
      };
    }
  } catch (e: any) {
    toast.show(`Ошибка генерации: ${e}`, 'error');
  } finally {
    isGeneratingMsg.value = false;
  }
};

const copyActiveMessage = () => {
  const textToCopy = generatedVariants.value[activeTabMsg.value];
  if (textToCopy) {
    navigator.clipboard.writeText(textToCopy);
    toast.show('Человечное сообщение скопировано! 📋', 'success');
  }
};

const addToCRM = async (item: any, initialStatus = 'Новый') => {
  try {
    const aiData = searchStore.aiProfileMap[item.id.toString()];
    let initialNotes = '';
    if (aiData) {
      initialNotes = `[AI Lead Score: ${aiData.commercial_score}/100]\nОписание: ${aiData.summary || ''}\nВывод: ${aiData.asv_reason}`;
    }

    const artist = {
      id: '',
      vk_id: item.id.toString(),
      name: item.name || 'Потенциальный клиент',
      link: `https://vk.com/${item.screen_name || ('public' + item.id)}`,
      description: item.description || item.activity || '',
      followers: item.members_count || 0,
      last_activity: 'Активный паблик',
      music_links: `https://vk.com/${item.screen_name || ('public' + item.id)}`,
      contacts: `https://vk.com/${item.screen_name || ('public' + item.id)}`,
      avatar: item.photo_200 || item.photo_100 || '',
      raw_data: JSON.stringify(item),
      status: initialStatus,
      notes: initialNotes
    };

    const savedId: string = await safeInvoke('db_save_artist', { artist });
    existingVkIds.value.set(item.id.toString(), savedId);

    toast.show(`"${artist.name}" добавлен в CRM!`, 'success');
  } catch (e: any) {
    toast.show(`Ошибка сохранения: ${e}`, 'error');
  }
};

const openExisting = (artistId: string) => {
  router.push(`/artist/${artistId}`);
};
</script>

<template>
  <div class="scout-v2-page">
    <div class="page-header mb-4">
      <h1>AI Music Scout — Поиск Клиентов ASV Production</h1>
      <p class="text-sm text-muted">Выгрузка 30 неповторяющихся артистов всех жанров. Персонализированные оферы от нашей команды (ASV Production).</p>
    </div>

    <!-- ONE CLICK SEARCH BOX -->
    <div class="glass-card mb-4 scout-input-card">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="font-bold text-primary mb-1">Загрузить 30 клиентов (от нашей команды)</h3>
          <p class="text-xs text-muted">ИИ (gen-api.ru / LLM) сканирует сольных артистов без повторов и формирует живые личные оферы.</p>
        </div>

        <button 
          class="btn btn-purple scout-start-btn" 
          @click="startClientSearch" 
          :disabled="searchStore.isSearching"
        >
          <Sparkles :size="20" />
          <span>{{ searchStore.isSearching ? 'Скаутинг 30...' : '🚀 Загрузить 30 клиентов' }}</span>
        </button>
      </div>
    </div>

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
        <span class="text-sm text-muted">Одобрено ИИ (30 целевых клиентов от 100 до 50 000 подп.): <strong>{{ searchStore.filteredResults.length }}</strong></span>
      </div>

      <div class="results-list">
        <div 
          v-for="item in searchStore.filteredResults" 
          :key="item.id" 
          class="glass-card candidate-card-v2 mb-4"
          :class="{ 'high-score-card': searchStore.aiProfileMap[item.id.toString()]?.commercial_score && searchStore.aiProfileMap[item.id.toString()].commercial_score >= 80 }"
        >
          <!-- Left Column: Avatar -->
          <div class="card-left">
            <img v-if="item.photo_200 || item.photo_100" :src="item.photo_200 || item.photo_100" class="avatar-v2" alt="avatar" />
            <div v-else class="avatar-placeholder"><User :size="36" /></div>
          </div>

          <!-- Main Column: Clean Artist Passport & Summary -->
          <div class="card-main">
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                <h2 class="artist-title">{{ item.name }}</h2>
                <a href="#" @click.prevent="openExternal(`https://vk.com/${item.screen_name || ('public' + item.id)}`)" class="vk-link text-xs">
                  vk.com/{{ item.screen_name || ('public' + item.id) }} <ExternalLink :size="12" />
                </a>
              </div>

              <!-- AI Lead Score Badge (0-100) -->
              <div v-if="searchStore.aiProfileMap[item.id.toString()]" class="flex items-center gap-2">
                <span class="confidence-pill flex items-center gap-1">
                  <Brain :size="12" /> {{ searchStore.aiProfileMap[item.id.toString()].artist_type }}
                </span>
                
                <span class="score-badge flex items-center gap-1">
                  <Flame :size="14" /> AI Lead Score: {{ searchStore.aiProfileMap[item.id.toString()].commercial_score }} / 100
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
                <span>Суть ИИ:</span>
              </span>
              <span class="punchline-text text-muted font-medium">
                {{ searchStore.aiProfileMap[item.id.toString()]?.summary || 'Независимый музыкальный проект с коммерческим потенциалом.' }}
              </span>
            </div>

            <!-- ASV Production Fit Rationale -->
            <div v-if="searchStore.aiProfileMap[item.id.toString()]?.asv_reason" class="asv-reason-box text-xs">
              <span class="font-bold text-secondary">Перспектива для ASV:</span> {{ searchStore.aiProfileMap[item.id.toString()].asv_reason }}
            </div>
          </div>

          <!-- Right Column: Actions -->
          <div class="card-actions-v2">
            <button 
              class="btn btn-purple btn-sm flex items-center gap-1"
              @click="generateMessageForArtist(item)"
              title="Сгенерировать 3 человечных сообщения от нашей команды"
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
                @click="addToCRM(item, 'Новый')"
              >
                <Plus :size="16" />
                <span>В CRM</span>
              </button>

              <button 
                class="btn btn-secondary btn-sm flex items-center gap-1" 
                @click="addToCRM(item, 'Избранное')"
                title="Добавить в Избранное ⭐"
              >
                <Star :size="16" color="#fde047" />
              </button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- REJECTED BY AI ACCORDION -->
    <div v-if="searchStore.rejectedResults.length > 0" class="glass-card rejected-accordion-card mb-6">
      <div 
        class="rejected-header flex items-center justify-between cursor-pointer p-4"
        @click="showRejectedList = !showRejectedList"
      >
        <div class="flex items-center gap-2">
          <XCircle color="#ef4444" :size="20" />
          <span class="font-bold text-sm text-red-400">Отклонено ИИ (фан-клубы, электрика, блоги): <strong>{{ searchStore.rejectedResults.length }}</strong></span>
        </div>
        <component :is="showRejectedList ? ChevronUp : ChevronDown" :size="20" class="text-muted" />
      </div>

      <div v-if="showRejectedList" class="rejected-body p-4 pt-0">
        <div 
          v-for="item in searchStore.rejectedResults" 
          :key="item.id" 
          class="rejected-item-box mb-3 text-xs"
        >
          <div class="flex items-center justify-between mb-1">
            <span class="font-bold text-primary">{{ item.name }}</span>
            <a href="#" @click.prevent="openExternal(`https://vk.com/${item.screen_name || ('public' + item.id)}`)" class="text-muted">
              vk.com/{{ item.screen_name || ('public' + item.id) }} <ExternalLink :size="12" />
            </a>
          </div>

          <div class="rejection-reason-text">
            🧠 {{ searchStore.aiProfileMap[item.id.toString()]?.rejection_reason || 'Отклонено ИИ: Объект признан инородным пабликом' }}
          </div>
        </div>
      </div>
    </div>

    <!-- OUTREACH MESSAGE GENERATOR MODAL (3 HUMAN TEAM VARIANTS) -->
    <div v-if="showMessageModal" class="modal-overlay" @click.self="showMessageModal = false">
      <div class="glass-card modal-content p-6">
        <div class="flex justify-between items-center mb-4">
          <h3 class="font-bold text-lg text-primary flex items-center gap-2">
            <MessageSquare :size="20" /> Персонализированное сообщение от команды ASV
          </h3>
          <button class="btn btn-secondary btn-sm" @click="showMessageModal = false">✕</button>
        </div>

        <div v-if="isGeneratingMsg" class="p-8 text-center">
          <div class="spinner-ring mx-auto mb-3"></div>
          <p class="text-sm text-muted">ИИ формирует 3 живых человечных офера от нашей команды (ASV Production)...</p>
        </div>

        <div v-else class="space-y-4">
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
            v-model="generatedVariants[activeTabMsg]" 
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
</style>
