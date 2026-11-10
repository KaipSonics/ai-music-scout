<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Settings, Search, Users, CheckCircle2, AlertCircle, AlertTriangle } from '@lucide/vue';
import { useSettingsStore } from './stores/settings';
import { useToast } from './composables/useToast';
import { crmInvoke as safeInvoke } from './scout/crm';

const route = useRoute();
const settingsStore = useSettingsStore();
const { toasts,show } = useToast();

const artistCount = ref(0);

const navItems = [
  { name: 'Поиск', path: '/search', icon: Search },
  { name: 'Воронка (CRM)', path: '/crm', icon: Users },
  { name: 'Настройки', path: '/settings', icon: Settings },
];

const updateStats = async () => {
  try {
    const stats: any = await safeInvoke('db_get_stats');
    if (stats && typeof stats.total === 'number') {
      artistCount.value = stats.total;
    }
  } catch (e) {
    console.warn('Failed to fetch DB stats:', e);
  }
};

onMounted(async () => {
  try{await settingsStore.loadSettings();}catch(e){show('Ошибка загрузки настроек: '+String(e),'error');}
  await updateStats();
});

watch(() => route.path, () => {
  updateStats();
});
</script>

<template>
  <div class="layout">
    <!-- Desktop Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="brand-logo-container">
          <div class="asv-dune-title">ASV</div>
          <div class="asv-syncopate-sub">PRODUCTION</div>
        </div>
      </div>

      <!-- Token Status Indicator -->
      <div class="token-status-card mt-4 mb-4">
        <div class="flex items-center justify-between text-xs text-muted mb-1">
          <span>VK API Токен</span>
          <span v-if="settingsStore.isTokenValid === true" class="flex items-center gap-1 text-success font-bold">
            <CheckCircle2 :size="12" /> {{ settingsStore.tokenUserName || 'Активен' }}
          </span>
          <span v-else-if="settingsStore.isTokenValid === false" class="flex items-center gap-1 text-amber-400 font-bold">
            <AlertTriangle :size="12" /> Ошибка проверки
          </span>
          <span v-else class="flex items-center gap-1 text-danger font-bold">
            <AlertCircle :size="12" /> Не указан
          </span>
        </div>
        <div class="token-hint text-xs text-muted">
          {{ settingsStore.isTokenValid === true ? 'Токен проверен; доступ методов проверяется при поиске' : 'Авторизуйтесь в Настройках' }}
        </div>
      </div>

      <!-- Navigation Links -->
      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-link"
          :class="{ active: route.path.startsWith(item.path) }"
        >
          <div class="flex items-center gap-3">
            <component :is="item.icon" :size="20" />
            <span>{{ item.name }}</span>
          </div>

          <span v-if="item.path === '/crm' && artistCount > 0" class="nav-badge">
            {{ artistCount }}
          </span>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <div class="app-version text-xs text-muted">ASV Scout 3.0 (ASV Production)</div>
        <div class="text-xs text-muted">Direct VK API • SQLite</div>
      </div>
    </aside>

    <!-- Main Workspace -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- iPhone 16 Pro Max Bottom Navigation Bar -->
    <nav class="mobile-bottom-nav">
      <router-link
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="mobile-nav-item"
        :class="{ active: route.path.startsWith(item.path) }"
      >
        <component :is="item.icon" :size="22" />
        <span>{{ item.name }}</span>
        <span v-if="item.path === '/crm' && artistCount > 0" class="mobile-badge">
          {{ artistCount }}
        </span>
      </router-link>
    </nav>

    <!-- Floating Toast Notifications -->
    <div class="toast-container">
      <div v-for="toast in toasts" :key="toast.id" class="toast">
        <CheckCircle2 v-if="toast.type === 'success'" :size="18" color="var(--primary)" />
        <AlertCircle v-else :size="18" color="var(--danger)" />
        <span>{{ toast.message }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pin-lock-screen {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at center, rgba(30, 18, 50, 0.95), rgba(10, 8, 20, 1));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.lock-box {
  background: rgba(18, 14, 38, 0.9);
  border: 1px solid rgba(157, 78, 221, 0.4);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.8);
}

.lock-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(83, 246, 228, 0.15);
  border: 1px solid rgba(83, 246, 228, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.sidebar-header {
  padding-bottom: 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  text-align: center;
}

.brand-logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px 0;
}

.asv-dune-title {
  font-family: 'Dune Rise', sans-serif;
  font-size: 2.8rem;
  color: #53f6e4;
  line-height: 1;
  letter-spacing: 0.22em;
  text-indent: 0.22em;
  text-shadow: 0 0 16px rgba(83, 246, 228, 0.65), 0 0 32px rgba(83, 246, 228, 0.35);
  margin-bottom: 2px;
}

.asv-syncopate-sub {
  font-family: 'Syncopate', sans-serif;
  font-size: 0.68rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.32em;
  text-indent: 0.32em;
  opacity: 0.95;
}

.token-status-card {
  background: rgba(15, 12, 28, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 10px 14px;
  border-radius: var(--radius-sm);
}

.text-success { color: var(--success); }
.text-danger { color: var(--danger); }

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.nav-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-decoration: none;
  font-weight: 600;
  font-family: 'Rajdhani', sans-serif;
  font-size: 1.1rem;
  transition: all 0.2s ease;
  text-transform: uppercase;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
}

.nav-link.active {
  background: rgba(98, 225, 216, 0.12);
  color: var(--primary);
  border-left: 3px solid var(--primary);
}

.nav-badge {
  background: rgba(98, 225, 216, 0.2);
  color: var(--primary);
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 700;
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  text-align: center;
}

.mobile-bottom-nav {
  display: none;
}

@media (max-width: 768px) {
  .sidebar {
    display: none;
  }

  .mobile-bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: rgba(18, 14, 38, 0.95);
    backdrop-filter: blur(16px);
    border-top: 1px solid rgba(157, 78, 221, 0.3);
    padding: 10px 16px;
    padding-bottom: calc(10px + env(safe-area-inset-bottom));
    justify-content: space-around;
    align-items: center;
    z-index: 999;
  }

  .mobile-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    color: var(--text-muted);
    text-decoration: none;
    font-size: 0.75rem;
    font-weight: 600;
    position: relative;
  }

  .mobile-nav-item.active {
    color: var(--primary);
  }

  .mobile-badge {
    position: absolute;
    top: -4px;
    right: 8px;
    background: #ef4444;
    color: #ffffff;
    font-size: 0.65rem;
    padding: 1px 6px;
    border-radius: 10px;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
