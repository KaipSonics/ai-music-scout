<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSettingsStore } from '../stores/settings';
import { useToast } from '../composables/useToast';
import {crmInvoke as safeInvoke} from '../scout/crm';
import {draftOutreach,SERVICE_LABEL} from '../scout/opportunity';
import {
  ArrowLeft,
  Save,
  ExternalLink,
  Copy,
  Trash2,
  MessageCircle,
  Users,
  FileText,
  Send
} from '@lucide/vue';
import type { ArtistRecord, CRMStatus, HistoryRecord } from '../types/artist';

const route = useRoute();
const router = useRouter();
const store = useSettingsStore();
const toast = useToast();

const openExternal = (url: string) => {
  if (url && url !== '#') safeInvoke('open_url', { url }).catch(e => console.error(e));
};

const artistId = route.params.id as string;
const artist = ref<ArtistRecord | null>(null);
const history = ref<HistoryRecord[]>([]);
const newNote = ref('');
const activeOfferTab = ref<'mixing' | 'arrangement' | 'mastering' | 'production' | 'audit'>('mixing');
const saving=ref(false),loadError=ref('');
const customOfferText = ref('');

const statuses: { id: CRMStatus; name: string }[] = [
  { id: 'Новый', name: 'Новый' },
  { id: 'Изучен', name: 'Изучен' },
  { id: 'Написали', name: 'Написали' },
  { id: 'Ответил', name: 'Ответил' },
  { id: 'Клиент', name: 'Клиент' },
  {id:'Переговоры',name:'Переговоры'},
  {id:'Отложен',name:'Отложен'},
  { id: 'Избранное', name: 'Избранное ⭐' },
  { id: 'Не актуален', name: 'Не актуален' },
];

const loadData = async () => {
  try {
    const artistsList: ArtistRecord[] = await safeInvoke('db_get_artists');
    const found = artistsList.find(a => a.id === artistId);

    if (found) {
      artist.value = found;

      // Auto-update status from 'Новый' to 'Изучен' on first view
      if (artist.value.status === 'Новый') {
        artist.value.status = 'Изучен';
        await safeInvoke('db_update_status', { id: artistId, status: 'Изучен' });
        toast.show('Статус обновлен на "Изучен"', 'info');
      }

      // Load history
      history.value = await safeInvoke('db_get_history', { artistId }) || [];

      // Set initial offer text
      if(artist.value.opportunity){customOfferText.value=draftOutreach(artist.value.opportunity);}else updateOfferPreview();
    }else loadError.value='Карточка не найдена. Вернитесь в CRM.';
  } catch (e: any) {
    loadError.value=String(e);toast.show(`Ошибка загрузки: ${e}`, 'error');
  }
};

onMounted(() => {
  loadData();
});

const updateOfferPreview = () => {
  if (!artist.value) return;
  const name = artist.value.name || 'артист';
  const genre = artist.value.description || 'музыка';

  let rawTemplate = '';
  if (activeOfferTab.value === 'mixing') {
    rawTemplate = store.offerMixingTemplate;
  } else if (activeOfferTab.value === 'arrangement') {
    rawTemplate = store.offerArrangementTemplate;
  } else if(activeOfferTab.value==='production'){rawTemplate=store.offerProductionTemplate;
  }else if(activeOfferTab.value==='audit'){rawTemplate=store.offerAuditTemplate;
  } else {
    rawTemplate = store.offerMasteringTemplate;
  }

  customOfferText.value = rawTemplate
    .replace(/{name}/g, name)
    .replace(/{genre}/g, genre);
};

const setOfferTab = (tab: 'mixing' | 'arrangement' | 'mastering' | 'production' | 'audit') => {
  activeOfferTab.value = tab;
  updateOfferPreview();
};

const saveArtist = async () => {
  if (!artist.value || saving.value) return;saving.value=true;
  try {
    await safeInvoke('db_save_artist', { artist: artist.value });
    toast.show('Данные сохранены', 'success');
  } catch (e: any) {
    toast.show(`Ошибка сохранения: ${e}`, 'error');
  }finally{saving.value=false;}
};

const deleteArtist = async () => {
  if (!artist.value) return;
  if (!confirm(`Удалить "${artist.value.name}" из CRM?`)) return;

  try {
    await safeInvoke('db_delete_artist', { id: artistId });
    toast.show('Артист удален из CRM', 'success');
    router.push('/crm');
  } catch (e: any) {
    toast.show(`Ошибка удаления: ${e}`, 'error');
  }
};

const addHistoryRecord = async () => {
  if (!newNote.value.trim() || !artist.value) return;

  try {
    await safeInvoke('db_save_history', {
      history: {
        artist_id: artistId,
        record_type: 'Заметка',
        content: newNote.value.trim()
      }
    });

    newNote.value = '';
    history.value = await safeInvoke('db_get_history', { artistId }) || [];
    toast.show('Заметка добавлена в историю', 'success');
  } catch (e: any) {
    toast.show(`Ошибка добавления: ${e}`, 'error');
  }
};

const copyOfferToClipboard = async () => {
  if (!customOfferText.value) return;
  try {
    await navigator.clipboard.writeText(customOfferText.value);
    toast.show('Текст предложения скопирован!', 'success');


  } catch (e: any) {
    toast.show('Не удалось скопировать', 'error');
  }
};

const getVkMeUrl = computed(() => {
  if (!artist.value || !artist.value.link) return '#';
  const cleanLink = artist.value.link.replace('https://vk.com/', '').replace('http://vk.com/', '');
  return `https://vk.me/${cleanLink}`;
});

const contactsListParsed = computed(() => {
  if (!artist.value || !artist.value.contacts) return [];
  const lines = artist.value.contacts.split('\n');
  return lines.filter(l => l.trim().length > 0).map(line => {
    let vkUrl = '#';
    const match = line.match(/(https?:\/\/vk\.com\/[^\s]+)/);
    if (match) vkUrl = match[1];

    return { raw: line, vkUrl };
  });
});

const goBack = () => {
  router.push('/crm');
};
</script>

<template>
  <div v-if="loadError" role="alert" class="glass-card">{{loadError}} <router-link to="/crm">В CRM</router-link></div>
  <div v-if="artist" class="artist-page">
    <!-- Top Action Bar -->
    <div class="top-nav flex justify-between items-center mb-6">
      <div class="flex items-center gap-4">
        <button class="btn btn-secondary" @click="goBack" title="Назад к воронке">
          <ArrowLeft :size="18" />
          <span>К ВОРОНКЕ</span>
        </button>

        <div class="flex items-center gap-3">
          <img v-if="artist.avatar" :src="artist.avatar" class="artist-header-avatar" alt="avatar" referrerpolicy="no-referrer" />
          <div>
            <h1 class="header-name">{{ artist.name }}</h1>
            <a href="#" @click.prevent="openExternal(artist.link)" class="text-xs text-muted flex items-center gap-1">
              {{ artist.link }} <ExternalLink :size="12" />
            </a>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
<router-link class="btn btn-secondary" to="/radar">Проверить публикации</router-link>

        <select v-model="artist.status" @change="saveArtist" class="status-select-v2">
          <option v-for="s in statuses" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>

        <button class="btn btn-primary" :disabled="saving" @click="saveArtist">
          <Save :size="18" />
          <span>{{saving?'СОХРАНЕНИЕ…':'СОХРАНИТЬ'}}</span>
        </button>

        <button class="btn btn-danger" @click="deleteArtist" title="Удалить карточку">
          <Trash2 :size="18" />
        </button>
      </div>
    </div>

    <div class="glass-card mb-4" v-if="artist.opportunity"><h2>Коммерческий повод · {{artist.opportunity.kind.toUpperCase()}}</h2><p class="text-sm">{{artist.opportunity.service?SERVICE_LABEL[artist.opportunity.service]:'Потребность в конкретной услуге не подтверждена'}} · Opportunity: {{artist.opportunity.score??'Не проверено'}}</p><details><summary>Источники и причины оценки</summary><p class="text-xs">{{artist.opportunity.reasons.join(' · ')}}</p><div v-for="signal in artist.opportunity.signals" :key="signal.id" class="mb-3 text-xs"><strong>{{new Date(signal.publishedAt).toLocaleDateString('ru-RU')}}</strong><p>{{signal.quote}}</p><button class="btn btn-secondary btn-sm" @click="openExternal(signal.url)">Открыть источник</button></div></details></div>
    <!-- MAIN TWO COLUMN GRID -->
    <div class="artist-grid">
      <!-- LEFT COLUMN: Profile Info & Offer Copier -->
      <div class="flex-col gap-4">
        <!-- Direct Contact & Actions Box -->
        <div class="glass-card direct-contact-box">
          <h2 class="mb-3 flex items-center gap-2">
            <MessageCircle color="var(--primary)" :size="20" />
            Быстрый контакт
          </h2>

          <div class="flex gap-3 mb-4">
            <button class="btn btn-purple flex-1 flex items-center justify-center gap-2" @click="openExternal(getVkMeUrl)">
              <MessageCircle :size="18" />
              <span>НАПИСАТЬ В СООБЩЕСТВО (VK.ME)</span>
            </button>
          </div>

          <!-- Offer Generator Tabs -->
          <div class="offer-copier-container p-3 rounded-lg border border-purple-500/20 bg-purple-950/20">
            <div class="flex justify-between items-center mb-2">
              <div class="flex gap-2">
                <button
                  class="btn btn-xs"
                  :class="activeOfferTab === 'mixing' ? 'btn-purple' : 'btn-secondary'"
                  @click="setOfferTab('mixing')"
                >
                  Сведение
                </button>
                <button
                  class="btn btn-xs"
                  :class="activeOfferTab === 'arrangement' ? 'btn-purple' : 'btn-secondary'"
                  @click="setOfferTab('arrangement')"
                >
                  Аранжировки
                </button>
                <button
                  class="btn btn-xs"
                  :class="activeOfferTab === 'mastering' ? 'btn-purple' : 'btn-secondary'"
                  @click="setOfferTab('mastering')"
                >
                  Stem-мастеринг
                </button>
                <button class="btn btn-xs" :class="activeOfferTab==='production'?'btn-purple':'btn-secondary'" @click="setOfferTab('production')">Продакшн</button><button class="btn btn-xs" :class="activeOfferTab==='audit'?'btn-purple':'btn-secondary'" @click="setOfferTab('audit')">Аудит</button>
              </div>
            </div>

            <textarea
              aria-label="Текст обращения" v-model="customOfferText"
              rows="4"
              class="w-full text-xs p-3 glass-input mb-3"
            ></textarea>

            <button class="btn btn-primary w-full flex items-center justify-center gap-2" @click="copyOfferToClipboard">
              <Copy :size="16" />
              <span>СКОПИРОВАТЬ ПРЕДЛОЖЕНИЕ В БУФЕР</span>
            </button>
          </div>
        </div>

        <div class="glass-card"><h2>Следующий шаг и результат</h2><label class="text-xs">Напоминание<input v-model="artist.follow_up" type="date" aria-label="Напоминание" /></label><label class="text-xs">Сумма оплаченного заказа, ₽<input v-model.number="artist.value_rub" type="number" min="0" aria-label="Сумма заказа" /></label><p class="text-xs text-muted">Оплаченный заказ учитывается при статусе «Клиент». Контакт и ответ отмечайте после фактического общения.</p></div>
        <!-- Profile Info Card -->
        <div class="glass-card">
          <h2 class="mb-3 flex items-center gap-2">
            <Users color="var(--primary)" :size="20" />
            Информация и контакты
          </h2>

          <div class="grid grid-2 gap-3 mb-4">
            <div class="stat-box">
              <div class="text-xs text-muted">Подписчиков</div>
              <div class="font-bold text-lg text-primary">👥 {{ (artist.followers || 0).toLocaleString() }}</div>
            </div>
            <div class="stat-box">
              <div class="text-xs text-muted">Активность стены</div>
              <div class="font-bold text-sm text-success">{{artist.last_activity||'Не проверена'}}</div>
            </div>
          </div>

          <div class="mb-3">
            <label class="block text-xs font-bold text-muted mb-1">Описание / Жанр</label>
            <textarea v-model="artist.description" @change="saveArtist" rows="3" class="text-xs glass-input w-full"></textarea>
          </div>

          <div v-if="contactsListParsed.length > 0">
            <label class="block text-xs font-bold text-muted mb-1">Контакты паблика [VK Контакты]</label>
            <div class="space-y-2">
              <div v-for="(c, idx) in contactsListParsed" :key="idx" class="contact-item flex items-center justify-between text-xs p-2 rounded bg-slate-900/50">
                <span class="text-muted truncate pr-2">{{ c.raw }}</span>
                <button v-if="c.vkUrl !== '#'" class="btn btn-secondary btn-xs flex items-center gap-1" @click="openExternal(c.vkUrl)">
                  <span>ПРОФИЛЬ VK</span>
                  <ExternalLink :size="10" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Communication History & Notes -->
      <div class="glass-card flex-col gap-4">
        <h2 class="flex items-center gap-2">
          <FileText color="var(--primary)" :size="20" />
          История общения и заметки
        </h2>

        <!-- History Timeline -->
        <div class="history-timeline space-y-3 flex-1 overflow-y-auto max-h-72 pr-1">
          <div v-if="history.length === 0" class="text-xs text-muted p-4 text-center border border-dashed border-slate-700 rounded-lg">
            Записей пока нет. Добавьте результат первого контакта или заметку о клиенте.
          </div>

          <div v-for="h in history" :key="h.id" class="history-card p-3 rounded-lg bg-slate-900/60 border border-slate-700/50 text-xs">
            <div class="flex justify-between items-center text-muted mb-1">
              <span class="font-bold text-primary">{{ h.record_type }}</span>
              <span>{{ new Date(h.created_at || Date.now()).toLocaleString() }}</span>
            </div>
            <div class="text-secondary whitespace-pre-wrap">{{ h.content }}</div>
          </div>
        </div>

        <!-- Add Note Box -->
        <div class="add-note-box pt-3 border-t border-slate-800">
          <textarea
            v-model="newNote"
            placeholder="О чем договорились? Отправили демо? Вопросы по прайсу?.."
            rows="3"
            class="text-xs glass-input w-full mb-2"
          ></textarea>
          <button class="btn btn-purple btn-sm w-full flex items-center justify-center gap-2" @click="addHistoryRecord">
            <Send :size="14" />
            <span>ДОБАВИТЬ ЗАПИСЬ</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.artist-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

@media (max-width: 768px) {
  .artist-grid {
    grid-template-columns: 1fr;
  }
}

.artist-header-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--primary);
}

.header-name {
  font-size: 1.6rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.1;
}

.status-select-v2 {
  background: rgba(18, 14, 38, 0.9);
  color: var(--primary);
  border: 1px solid rgba(83, 246, 228, 0.4);
  border-radius: var(--radius-sm);
  padding: 8px 14px;
  font-weight: 700;
  font-size: 0.9rem;
  min-width: 150px;
  cursor: pointer;
  outline: none;
}
.status-select-v2 option {
  background: #0f0c1c;
  color: #ffffff;
}

.ai-eval-box {
  background: rgba(157, 78, 221, 0.12);
  border: 1px solid rgba(157, 78, 221, 0.35);
  padding: 14px 18px;
  border-radius: var(--radius-md);
}

.stat-box {
  background: rgba(10, 8, 24, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 10px 14px;
  border-radius: 8px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
}
@media(max-width:768px){.top-nav,.top-nav>.flex,.offer-copier-container>.flex,.offer-copier-container .flex{flex-wrap:wrap;gap:10px}.header-name{overflow-wrap:anywhere}.artist-page{min-width:0}}
</style>
