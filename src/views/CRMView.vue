<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  UserPlus,
  Eye,
  Send,
  MessageSquare,
  CheckCircle,
  XCircle,
  Star,
  Search,
  MessageCircle,
  ExternalLink,
  Download,
  Upload
} from '@lucide/vue';
import type { ArtistRecord, CRMStatus } from '../types/artist';
import { useToast } from '../composables/useToast';
import {crmInvoke as safeInvoke,exportCRM,importCRM,csvCRM} from '../scout/crm';

const router = useRouter();
const toast = useToast();

const openExternal = (url: string) => {
  if (url && url !== '#') safeInvoke('open_url', { url }).catch(e => console.error(e));
};

const artists = ref<ArtistRecord[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const activeView = ref<'board' | 'list'>('board');
const fileInput = ref<HTMLInputElement | null>(null);

const columns: { id: CRMStatus; name: string; icon: any; class: string }[] = [
  { id: 'Новый', name: 'Новый', icon: UserPlus, class: 'status-new' },
  { id: 'Изучен', name: 'Изучен', icon: Eye, class: 'status-inspected' },
  { id: 'Написали', name: 'Написали', icon: Send, class: 'status-contacted' },
  { id: 'Ответил', name: 'Ответил', icon: MessageSquare, class: 'status-replied' },
  { id: 'Клиент', name: 'Клиент', icon: CheckCircle, class: 'status-client' },
  {id:'Переговоры',name:'Переговоры',icon:MessageSquare,class:'status-replied'},
  {id:'Отложен',name:'Отложен',icon:Eye,class:'status-inspected'},
  { id: 'Избранное', name: 'Избранное', icon: Star, class: 'status-favorite' },
  { id: 'Не актуален', name: 'Не актуален', icon: XCircle, class: 'status-rejected' },
];

const loadArtists = async () => {
  loading.value = true;
  try {
    const res: any = await safeInvoke('db_get_artists');
    artists.value = res || [];
  } catch (e) {
    console.error('Failed to load artists from DB:', e);
    toast.show('Ошибка загрузки данных из БД', 'error');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadArtists();
});

function download(name:string,text:string,type='application/json'){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
const exportDatabaseJson=async()=>{try{download('ASV-Scout-CRM.json',await exportCRM());toast.show('CRM экспортирована','success');}catch(e){toast.show(String(e),'error');}};
const exportCsv=()=>download('ASV-Scout-CRM.csv',csvCRM(artists.value),'text/csv;charset=utf-8');
const triggerFileInput=()=>fileInput.value?.click();
const handleImportJson=async(event:Event)=>{const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;try{const count=await importCRM(await file.text());await loadArtists();toast.show('Импортировано: '+count,'success');}catch(e){toast.show(String(e),'error');}finally{input.value='';}};
const revenue=computed(()=>artists.value.filter(a=>a.status==='Клиент').reduce((n,a)=>n+(a.value_rub||0),0));
const filteredArtists = computed(() => {
  if (!searchQuery.value.trim()) return artists.value;
  const q = searchQuery.value.toLowerCase().trim();
  return artists.value.filter(a =>
    (a.name && a.name.toLowerCase().includes(q)) ||
    (a.description && a.description.toLowerCase().includes(q)) ||
    (a.contacts && a.contacts.toLowerCase().includes(q))
  );
});

const getArtistsByStatus = (status: CRMStatus) => {
  return filteredArtists.value.filter(a => a.status === status);
};

const openArtist = (id: string) => {
  router.push(`/artist/${id}`);
};

const getVkMeUrl = (link: string) => {
  if (!link) return '#';
  const cleanLink = link.replace('https://vk.com/', '').replace('http://vk.com/', '');
  return `https://vk.me/${cleanLink}`;
};
</script>

<template>
  <div class="crm-page">
    <!-- Hidden File Input for Import -->
    <input
      ref="fileInput"
      type="file"
      accept=".json"
      class="hidden"
      style="display: none"
      @change="handleImportJson"
    />

    <!-- Header Controls -->
    <div class="crm-header flex justify-between items-center mb-6">
      <div>
        <h1>Воронка контактов (CRM)</h1>
        <p class="text-sm text-muted">Управление базой артистов, импорт/экспорт и отслеживание заказов</p>
      </div>

      <div class="flex items-center gap-3">
        <!-- Import / Export Buttons -->
        <button class="btn btn-secondary btn-sm flex items-center gap-1" @click="triggerFileInput" title="Импортировать базу артистов из JSON">
          <Upload :size="14" />
          <span>ИМПОРТ</span>
        </button>

        <button class="btn btn-purple btn-sm flex items-center gap-1" @click="exportDatabaseJson" title="Экспортировать всю базу артистов в JSON">
          <Download :size="14" />
          <span>ЭКСПОРТ</span>
        </button>

        <button class="btn btn-secondary btn-sm" @click="exportCsv">CSV</button>
        <!-- Search filter -->
        <div class="search-box">
          <Search :size="16" class="search-icon" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Фильтр артистов..."
            class="search-input"
          />
        </div>

        <!-- View Switcher -->
        <div class="view-switch">
          <button
            class="switch-btn"
            :class="{ active: activeView === 'board' }"
            @click="activeView = 'board'"
          >
            Доска
          </button>
          <button
            class="switch-btn"
            :class="{ active: activeView === 'list' }"
            @click="activeView = 'list'"
          >
            Список ({{ filteredArtists.length }})
          </button>
        </div>
      </div>
    </div>

    <div class="glass-card mb-4 text-sm">Контактов: {{artists.length}} · Ответили: {{artists.filter(a=>['Ответил','Переговоры','Клиент'].includes(a.status)).length}} · Заказов: {{artists.filter(a=>a.status==='Клиент').length}} · Выручка: {{revenue.toLocaleString('ru-RU')}} ₽ <span class="text-xs text-muted">(отмечено вручную)</span></div>
    <div v-if="!loading&&!artists.length" class="glass-card mb-4 text-muted">CRM пока пуста. Найдите артистов в <router-link to="/search">поиске</router-link> и добавьте интересных кнопкой «В CRM».</div>
    <!-- Loading State -->
    <div v-if="loading" class="text-muted text-center py-8">
      Загрузка CRM воронки...
    </div>

    <!-- KANBAN BOARD VIEW -->
    <div v-else-if="activeView === 'board'" class="kanban-board">
      <div
        v-for="col in columns"
        :key="col.id"
        class="kanban-col"
      >
        <!-- Column Header -->
        <div class="kanban-col-header">
          <div class="flex items-center gap-2">
            <span class="status-badge" :class="col.class">
              <component :is="col.icon" :size="13" />
              {{ col.name }}
            </span>
          </div>
          <span class="col-count">{{ getArtistsByStatus(col.id).length }}</span>
        </div>

        <!-- Column Cards Container -->
        <div class="kanban-cards-area">
          <div
            v-if="getArtistsByStatus(col.id).length === 0"
            class="empty-column-placeholder text-xs text-muted"
          >
            Нет контактов
          </div>

          <div
            v-for="artist in getArtistsByStatus(col.id)"
            :key="artist.id"
            class="kanban-card glass-card"
            @click="openArtist(artist.id)"
          >
            <!-- Card Header (Avatar + Title) -->
            <div class="card-top flex items-center gap-3 mb-2">
              <img v-if="artist.avatar" :src="artist.avatar" class="artist-avatar" alt="avatar" referrerpolicy="no-referrer" />
              <div class="artist-info flex-1 overflow-hidden">
                <h3 class="artist-name truncate">{{ artist.name }}</h3>
                <div class="artist-followers text-xs text-muted">
                  👥 {{ (artist.followers || 0).toLocaleString() }} подп.
                </div>
              </div>
            </div>

            <p v-if="artist.follow_up" class="text-xs text-primary mb-2">Напоминание: {{artist.follow_up}}</p>
            <p v-if="artist.opportunity" class="text-xs text-primary mb-2">{{artist.opportunity.kind.toUpperCase()}} · {{artist.opportunity.score??'Не проверено'}}</p>
            <!-- Description / Style summary -->
            <p v-if="artist.description" class="artist-desc text-xs text-secondary mb-3 line-clamp-2">
              {{ artist.description }}
            </p>

            <!-- Card Actions Footer -->
            <div class="card-footer flex justify-between items-center pt-2 border-t border-glass">
              <button
                class="action-btn text-xs text-primary flex items-center gap-1"
                @click.stop="openExternal(getVkMeUrl(artist.link))"
                title="Написать в сообщество VK"
              >
                <MessageCircle :size="12" />
                <span>Написать</span>
              </button>

              <a
                href="#"
                class="action-btn text-xs text-muted flex items-center gap-1"
                @click.stop.prevent="openExternal(artist.link)"
                title="Открыть паблик ВКонтакте"
              >
                <span>VK</span>
                <ExternalLink :size="10" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- LIST TABLE VIEW -->
    <div v-else class="list-view glass-card p-4">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-glass text-xs text-muted uppercase">
              <th class="py-3 px-2">Артист</th>
              <th class="py-3 px-2">Подписчики</th>
              <th class="py-3 px-2">Жанр / Описание</th>
              <th class="py-3 px-2">Статус</th>
              <th class="py-3 px-2 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredArtists.length === 0">
              <td colspan="5" class="py-8 text-center text-muted text-sm">
                Артисты не найдены
              </td>
            </tr>
            <tr
              v-for="artist in filteredArtists"
              :key="artist.id"
              class="border-b border-glass-hover hover:bg-white/5 transition-colors cursor-pointer"
              @click="openArtist(artist.id)"
            >
              <td class="py-3 px-2">
                <div class="flex items-center gap-3">
                  <img v-if="artist.avatar" :src="artist.avatar" class="w-8 h-8 rounded-full object-cover" alt="avatar" referrerpolicy="no-referrer" />
                  <div>
                    <div class="font-bold text-sm text-primary">{{ artist.name }}</div>
                    <a href="#" @click.stop.prevent="openExternal(artist.link)" class="text-xs text-muted flex items-center gap-1">
                      {{ artist.link }} <ExternalLink :size="10" />
                    </a>
                  </div>
                </div>
              </td>
              <td class="py-3 px-2 text-sm text-secondary font-mono">
                👥 {{ (artist.followers || 0).toLocaleString() }}
              </td>
              <td class="py-3 px-2 text-xs text-muted max-w-xs truncate">
                {{ artist.description || '—' }}
              </td>
              <td class="py-3 px-2">
                <span class="text-xs px-2 py-1 rounded-full font-bold" :class="columns.find(c => c.id === artist.status)?.class || 'status-new'">
                  {{ artist.status }}
                </span>
              </td>
              <td class="py-3 px-2 text-right">
                <button
                  class="btn btn-secondary btn-xs"
                  @click.stop="openExternal(getVkMeUrl(artist.link))"
                >
                  Написать VK
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.crm-page {
  padding-bottom: 30px;
}

.kanban-board {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding-bottom: 16px;
  min-height: calc(100vh - 180px);
}

.kanban-col {
  flex: 0 0 280px;
  background: rgba(14, 11, 26, 0.6);
  border: 1px solid rgba(98, 225, 216, 0.12);
  border-radius: var(--radius-lg);
  padding: 12px;
  display: flex;
  flex-direction: column;
}

.kanban-col-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.col-count {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
}

.kanban-cards-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  padding-right: 2px;
}

.kanban-card {
  padding: 12px;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.kanban-card:hover {
  transform: translateY(-2px);
  border-color: var(--primary);
}

.artist-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid var(--primary);
}

.artist-name {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
}

.search-box {
  position: relative;
  width: 200px;
}

.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.search-input {
  width: 100%;
  padding: 6px 12px 6px 32px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 0.85rem;
}

.view-switch {
  display: flex;
  background: rgba(255, 255, 255, 0.05);
  padding: 3px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--glass-border);
}

.switch-btn {
  padding: 4px 10px;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}

.switch-btn.active {
  background: var(--primary);
  color: #07060f;
}
@media(max-width:768px){.crm-header{flex-direction:column;align-items:stretch;gap:16px}.crm-header>.flex{flex-wrap:wrap;gap:8px}.crm-header .search-box{width:100%}.kanban-board{max-width:100%;overflow-x:auto}}
</style>
