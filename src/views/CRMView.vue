<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { invoke } from '@tauri-apps/api/core';
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
  Users
} from '@lucide/vue';
import type { ArtistRecord, CRMStatus } from '../types/artist';
import { useToast } from '../composables/useToast';

const router = useRouter();
const toast = useToast();

const openExternal = (url: string) => {
  if (url && url !== '#') invoke('open_url', { url }).catch(e => console.error(e));
};

const artists = ref<ArtistRecord[]>([]);
const loading = ref(true);
const searchQuery = ref('');
const activeView = ref<'board' | 'list'>('board');

// 7 CRM Status Columns as specified in the updated plan
const columns: { id: CRMStatus; name: string; icon: any; class: string }[] = [
  { id: 'Новый', name: 'Новый', icon: UserPlus, class: 'status-new' },
  { id: 'Изучен', name: 'Изучен', icon: Eye, class: 'status-inspected' },
  { id: 'Написали', name: 'Написали', icon: Send, class: 'status-contacted' },
  { id: 'Ответил', name: 'Ответил', icon: MessageSquare, class: 'status-replied' },
  { id: 'Клиент', name: 'Клиент', icon: CheckCircle, class: 'status-client' },
  { id: 'Избранное', name: 'Избранное', icon: Star, class: 'status-favorite' },
  { id: 'Не актуален', name: 'Не актуален', icon: XCircle, class: 'status-rejected' },
];

const loadArtists = async () => {
  loading.value = true;
  try {
    const res: any = await invoke('db_get_artists');
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

const filteredArtists = computed(() => {
  if (!searchQuery.value.trim()) return artists.value;
  const q = searchQuery.value.toLowerCase().trim();
  return artists.value.filter(a => 
    a.name.toLowerCase().includes(q) || 
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

const changeStatus = async (artist: ArtistRecord, newStatus: CRMStatus, event: Event) => {
  event.stopPropagation();
  try {
    await invoke('db_update_status', { id: artist.id, status: newStatus });
    artist.status = newStatus;
    toast.show(`Статус изменен на "${newStatus}"`, 'success');
  } catch (e) {
    toast.show(`Ошибка изменения статуса: ${e}`, 'error');
  }
};

// Generate direct VK message URL (vk.me/screen_name or vk.me/public12345)
const getVkMeUrl = (link: string, vk_id: string) => {
  if (link && link.includes('vk.com/')) {
    const parts = link.split('vk.com/');
    if (parts[1]) return `https://vk.me/${parts[1]}`;
  }
  return `https://vk.me/public${vk_id}`;
};
</script>

<template>
  <div class="crm-page">
    <!-- Header Controls -->
    <div class="crm-header flex justify-between items-center mb-6">
      <div>
        <h1>Воронка контактов (CRM)</h1>
        <p class="text-sm text-muted">Управление базой артистов, отслеживание статусов переписки и клиентских заказов</p>
      </div>

      <div class="flex items-center gap-4">
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
              <img v-if="artist.avatar" :src="artist.avatar" class="card-avatar" alt="avatar" />
              <div v-else class="card-avatar-placeholder">
                <Users :size="18" />
              </div>
              <div class="card-title-area">
                <div class="card-name text-sm font-bold">{{ artist.name }}</div>
                <div v-if="artist.followers" class="text-xs text-muted">👥 {{ artist.followers.toLocaleString() }}</div>
              </div>
            </div>

            <!-- Description / Notes excerpt -->
            <div v-if="artist.description" class="card-excerpt text-xs text-muted mb-3">
              {{ artist.description.length > 70 ? artist.description.substring(0, 70) + '...' : artist.description }}
            </div>

            <!-- Bottom Actions Bar -->
            <div class="card-bottom flex justify-between items-center" @click.stop>
              <!-- Direct VK Message Link -->
              <a 
                href="#" 
                @click.prevent="openExternal(getVkMeUrl(artist.link, artist.vk_id))" 
                class="direct-msg-link flex items-center gap-1 text-xs"
                title="Написать в VK (vk.me)"
              >
                <MessageCircle :size="14" />
                <span>Написать</span>
              </a>

              <!-- Status Selector Dropdown -->
              <select 
                :value="artist.status" 
                @change="changeStatus(artist, ($event.target as HTMLSelectElement).value as CRMStatus, $event)"
                class="mini-status-select text-xs"
              >
                <option v-for="c in columns" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- LIST VIEW -->
    <div v-else-if="activeView === 'list'" class="list-view glass-card">
      <table class="crm-table">
        <thead>
          <tr>
            <th>Артист / Группа</th>
            <th>Подписчики</th>
            <th>Статус</th>
            <th>Последняя активность</th>
            <th>Контакты</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="artist in filteredArtists" :key="artist.id" @click="openArtist(artist.id)" class="table-row">
            <td class="flex items-center gap-3">
              <img v-if="artist.avatar" :src="artist.avatar" class="table-avatar" alt="avatar" />
              <div>
                <strong class="block text-sm">{{ artist.name }}</strong>
                <a href="#" @click.stop.prevent="openExternal(artist.link)" class="text-xs text-muted flex items-center gap-1">
                  {{ artist.link }} <ExternalLink :size="10" />
                </a>
              </div>
            </td>

            <td class="text-sm text-secondary">
              {{ artist.followers ? artist.followers.toLocaleString() : '—' }}
            </td>

            <td>
              <select 
                :value="artist.status" 
                @click.stop
                @change="changeStatus(artist, ($event.target as HTMLSelectElement).value as CRMStatus, $event)"
                class="mini-status-select text-xs"
              >
                <option v-for="c in columns" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </td>

            <td class="text-xs text-muted">
              {{ artist.last_activity || '—' }}
            </td>

            <td class="text-xs text-muted max-w-xs">
              {{ artist.contacts ? (artist.contacts.length > 40 ? artist.contacts.substring(0, 40) + '...' : artist.contacts) : '—' }}
            </td>

            <td @click.stop>
              <div class="flex items-center gap-2">
                <button 
                  class="btn btn-secondary btn-sm"
                  @click="openExternal(getVkMeUrl(artist.link, artist.vk_id))"
                >
                  <MessageCircle :size="14" />
                  <span>Сообщение</span>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.crm-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 56px);
}

.search-box {
  position: relative;
  width: 220px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-muted);
}

.search-input {
  padding-left: 36px !important;
}

.view-switch {
  display: flex;
  background: rgba(10, 8, 20, 0.8);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  padding: 3px;
}

.switch-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.switch-btn.active {
  background: var(--primary);
  color: #05040a;
}

/* KANBAN BOARD STYLES */
.kanban-board {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  flex: 1;
  padding-bottom: 14px;
}

.kanban-col {
  flex: 0 0 260px;
  display: flex;
  flex-direction: column;
  background: rgba(12, 10, 24, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
  height: 100%;
}

.kanban-col-header {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.col-count {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-secondary);
}

.kanban-cards-area {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  flex: 1;
}

.empty-column-placeholder {
  text-align: center;
  padding: 30px 10px;
  border: 1px dashed rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
}

.kanban-card {
  padding: 14px;
  cursor: pointer;
  border-radius: var(--radius-sm);
  background: rgba(22, 18, 42, 0.75);
}

.kanban-card:hover {
  transform: translateY(-2px);
}

.card-avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  object-fit: cover;
}

.card-avatar-placeholder {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.card-name {
  color: var(--text-primary);
  line-height: 1.3;
}

.card-excerpt {
  line-height: 1.4;
}

.direct-msg-link {
  color: var(--primary);
  text-decoration: none;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(98, 225, 216, 0.1);
  transition: all 0.2s ease;
}

.direct-msg-link:hover {
  background: rgba(98, 225, 216, 0.25);
}

.mini-status-select {
  width: auto;
  padding: 4px 8px;
  border-radius: 6px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

/* LIST TABLE STYLES */
.crm-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.crm-table th {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--text-muted);
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.crm-table td {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.table-row:hover {
  background: rgba(98, 225, 216, 0.04);
  cursor: pointer;
}

.table-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.max-w-xs {
  max-width: 200px;
}
</style>
