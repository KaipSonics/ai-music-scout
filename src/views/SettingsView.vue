<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { useToast } from '../composables/useToast';
import { 
  Key, 
  Save, 
  ShieldCheck, 
  FileCode, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  ExternalLink as LinkIcon, 
  UserCheck, 
  Sparkles, 
  CheckCircle2
} from '@lucide/vue';
import { safeInvoke } from '../utils/tauriBridge';

const store = useSettingsStore();
const toast = useToast();

const rawInputToken = ref('');

const mixingTemplate = ref(store.offerMixingTemplate);
const arrangementTemplate = ref(store.offerArrangementTemplate);
const masteringTemplate = ref(store.offerMasteringTemplate);

const showToken = ref(false);
const testingToken = ref(false);

const tokenTestSuccess = ref<boolean | null>(null);
const verifiedUserName = ref('');
const errorMessage = ref('');

const openExternal = (url: string) => {
  safeInvoke('open_url', { url }).catch(e => console.error(e));
};

// Robust VK Access Token parser for mobile & desktop URLs (m.vk.com, blank.html, etc.)
const extractCleanToken = (input: string): string => {
  let str = input.trim();
  if (str.includes('access_token=')) {
    const match = str.match(/access_token=([^&]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }
  return str;
};

onMounted(async () => {
  await store.loadSettings();
  rawInputToken.value = store.vkToken;

  mixingTemplate.value = store.offerMixingTemplate;
  arrangementTemplate.value = store.offerArrangementTemplate;
  masteringTemplate.value = store.offerMasteringTemplate;
});

watch(rawInputToken, (newVal) => {
  const cleaned = extractCleanToken(newVal);
  if (cleaned !== newVal) {
    rawInputToken.value = cleaned;
    toast.show('Access Token автоматически извлечен из ссылки!', 'success');
  }
});

const saveAll = async () => {
  const clean = extractCleanToken(rawInputToken.value);
  rawInputToken.value = clean;

  await store.saveSettings(
    clean,
    mixingTemplate.value,
    arrangementTemplate.value,
    masteringTemplate.value
  );
  toast.show('Все настройки сохранены!', 'success');
};

const testVkToken = async () => {
  const clean = extractCleanToken(rawInputToken.value);
  rawInputToken.value = clean;

  if (!clean) {
    toast.show('Введите access_token перед проверкой', 'error');
    return;
  }

  testingToken.value = true;
  tokenTestSuccess.value = null;
  verifiedUserName.value = '';
  errorMessage.value = '';

  try {
    const res: string = await safeInvoke('vk_test_token', { token: clean });
    tokenTestSuccess.value = true;
    verifiedUserName.value = res;
    toast.show(`Подключено: ${res}`, 'success');
    await store.saveVkToken(clean);
  } catch (e: any) {
    tokenTestSuccess.value = false;
    const errStr = e.toString();
    errorMessage.value = errStr;
    toast.show(`Ошибка: ${errorMessage.value}`, 'error');
  } finally {
    testingToken.value = false;
  }
};

const oauthLinkAdmin = 'https://oauth.vk.com/authorize?client_id=6287487&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=friends,photos,audio,video,docs,notes,pages,status,wall,groups,messages,offline&response_type=token&v=5.131';
</script>

<template>
  <div class="settings-page">
    <div class="page-header mb-6">
      <h1>Настройки CRM & ИИ ASV Production</h1>
      <p class="text-sm text-muted">
        Встроенный Бесплатный ИИ зашит в программу по умолчанию. Настройте авторизацию VK для скаутинга.
      </p>
    </div>

    <div class="settings-grid">
      <!-- LEFT COLUMN: VK Token & Built-in AI Info -->
      <div class="flex-col gap-4">
        <!-- VK Authorization Box (Highlighted for Mobile) -->
        <div class="glass-card flex-col gap-3 highlight-vk-box">
          <h2 class="flex items-center gap-2">
            <Key color="var(--primary)" :size="20" />
            1. Авторизация ВКонтакте
          </h2>

          <div class="instructions-box text-xs text-muted">
            <div class="flex flex-col gap-2">
              <button class="btn btn-purple btn-lg flex items-center justify-between font-bold" @click="openExternal(oauthLinkAdmin)">
                <span>🔑 ПОЛУЧИТЬ ТОКЕН VK (VK ADMIN — 1 КЛИК)</span>
                <LinkIcon :size="16" />
              </button>
              <p class="text-xs text-muted mt-1">
                Нажмите синюю кнопку выше ➔ разрешите доступ ➔ скопируйте всю ссылку из браузера и вставьте в поле ниже:
              </p>
            </div>
          </div>

          <div class="token-input-box">
            <label class="block text-xs font-bold text-muted mb-1">Вставьте скопированную ссылку или access_token:</label>
            <div class="relative flex items-center mb-2">
              <input 
                v-model="rawInputToken" 
                :type="showToken ? 'text' : 'password'" 
                placeholder="https://oauth.vk.com/blank.html#access_token=..." 
                style="padding-right: 40px;"
              />
              <button 
                type="button"
                class="eye-toggle-btn"
                @click="showToken = !showToken"
                title="Показать/скрыть токен"
              >
                <Eye v-if="!showToken" :size="16" />
                <EyeOff v-else :size="16" />
              </button>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button class="btn btn-secondary btn-sm flex-1" @click="testVkToken" :disabled="testingToken">
              <ShieldCheck :size="16" />
              <span>{{ testingToken ? 'Проверяем...' : 'ПРОВЕРИТЬ VK ТОКЕН' }}</span>
            </button>

            <span v-if="tokenTestSuccess === true" class="text-xs font-bold flex items-center gap-1 text-success">
              <UserCheck :size="14" /> {{ verifiedUserName || 'Подключено' }}
            </span>
          </div>

          <div v-if="errorMessage" class="error-details text-xs p-3 rounded bg-danger-light text-danger flex items-start gap-2">
            <AlertTriangle :size="16" class="mt-1 flex-shrink-0" />
            <div>{{ errorMessage }}</div>
          </div>
        </div>

        <!-- Built-in AI Info Box (Zero Config) -->
        <div class="glass-card flex-col gap-3 highlight-ai-box">
          <div class="flex items-center justify-between">
            <h2 class="flex items-center gap-2">
              <Sparkles color="var(--primary)" :size="20" />
              2. ИИ-Движок (Автономный Бесплатный ИИ)
            </h2>
            <span class="badge-ru flex items-center gap-1 text-xs">
              <CheckCircle2 :size="12" /> Активен по умолчанию
            </span>
          </div>

          <div class="instructions-box text-xs text-muted">
            <p>
              В программу зашит постоянный бесплатный ИИ-движок (OpenRouter / Gemini 2.0 Flash). Отбор артистов, отсев чужих пабликов и генератор 3 вариантов оферов от вашей команды работают автоматически без покупки ключей!
            </p>
          </div>
        </div>

        <button class="btn btn-primary btn-lg" @click="saveAll">
          <Save :size="18" />
          Сохранить все настройки
        </button>
      </div>

      <!-- RIGHT COLUMN: Offer Templates Editor (Commercial Only, No Free Tests!) -->
      <div class="glass-card flex-col gap-4">
        <h2 class="flex items-center gap-2">
          <FileCode color="var(--primary)" :size="20" />
          Шаблоны коммерческих предложений
        </h2>

        <p class="text-xs text-muted mb-2">
          Эти шаблоны подставляются в модуль скоринга и быстрого копирования предложением от имени ASV Production. 
          Теги: <code>{name}</code> — название группы/артиста, <code>{genre}</code> — описание/жанр.
        </p>

        <!-- Template 1: Mixing & Mastering -->
        <div class="template-editor-box mb-3">
          <label class="text-xs font-bold text-primary block mb-1">1. Сведение и мастеринг (12 000 ₽)</label>
          <textarea v-model="mixingTemplate" rows="4" class="text-xs"></textarea>
        </div>

        <!-- Template 2: Arrangements -->
        <div class="template-editor-box mb-3">
          <label class="text-xs font-bold text-primary block mb-1">2. Аранжировка и Продакшн (15 000 ₽)</label>
          <textarea v-model="arrangementTemplate" rows="4" class="text-xs"></textarea>
        </div>

        <!-- Template 3: Mastering -->
        <div class="template-editor-box mb-3">
          <label class="text-xs font-bold text-primary block mb-1">3. Мастеринг под стриминги (5 000 ₽)</label>
          <textarea v-model="masteringTemplate" rows="4" class="text-xs"></textarea>
        </div>

        <button class="btn btn-primary mt-auto" @click="saveAll">
          <Save :size="18" />
          Сохранить все шаблоны
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

@media (max-width: 768px) {
  .settings-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}

.highlight-vk-box {
  border-color: rgba(157, 78, 221, 0.4);
  background: rgba(26, 18, 50, 0.8);
}

.highlight-ai-box {
  border-color: rgba(98, 225, 216, 0.3);
  background: rgba(14, 22, 38, 0.7);
}

.badge-ru {
  background: rgba(98, 225, 216, 0.2);
  color: var(--primary);
  border: 1px solid rgba(98, 225, 216, 0.4);
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 700;
}

.relative {
  position: relative;
}

.eye-toggle-btn {
  position: absolute;
  right: 12px;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.eye-toggle-btn:hover {
  color: var(--primary);
}

.instructions-box {
  background: rgba(10, 8, 20, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  padding: 14px;
  line-height: 1.5;
}

.text-success {
  color: var(--success);
}

.bg-danger-light {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.template-editor-box textarea {
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);
  line-height: 1.4;
}
</style>
