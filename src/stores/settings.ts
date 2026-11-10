import { defineStore } from 'pinia';
import { ref } from 'vue';
import { testToken } from '../scout/vk';
import { safeInvoke } from '../utils/tauriBridge';

export const useSettingsStore = defineStore('settings', () => {
  const vkToken = ref('');
  const isTokenValid = ref<boolean | null>(null);
  const tokenUserName = ref('');

  const aiApiKey = ref('');
  const aiBaseUrl = ref('https://openrouter.ai/api/v1');
  const aiModel = ref('google/gemini-2.0-flash-exp:free');

  const offerMixingTemplate = ref('Привет, {name}! Наша команда ASV Production увидела ваш проект. Занимаемся профессиональным сведением и мастерингом (12 000 ₽) для независимых артистов. Готовы помочь обсудить задачу по сведению и мастерингу!');
  const offerArrangementTemplate = ref('Привет, {name}! Наша команда ASV Production увидела ваш проект. Пишем авторские аранжировки и биты «под ключ» (15 000 ₽). Будем рады поработать над вашими совместными релизами!');
  const offerMasteringTemplate = ref('Здравствуйте, {name}! Наша команда ASV Production делает stem-мастеринг (5 000 ₽). С удовольствием подготовим ваши треки к публикации!');

  const loadSettings = async () => {
    try {
      // Remove insecure credentials left by older versions. Re-enter for this session.
      await safeInvoke('db_delete_setting', { key: 'vk_token' });
      const mixing = await safeInvoke('db_get_setting', { key: 'offer_mixing' });
      if (mixing && !/послуш|скидкой|радио-уров|премиальн/i.test(mixing)) offerMixingTemplate.value = mixing;
      
      const arrangement = await safeInvoke('db_get_setting', { key: 'offer_arrangement' });
      if (arrangement && !/послуш|подач/i.test(arrangement)) offerArrangementTemplate.value = arrangement;
      
      const mastering = await safeInvoke('db_get_setting', { key: 'offer_mastering' });
      if (mastering && !/послуш|бесплатно|LUFS/i.test(mastering)) offerMasteringTemplate.value = mastering;

      if (vkToken.value) {
        try {
          const userName = await testToken(vkToken.value);
          isTokenValid.value = true;
          tokenUserName.value = userName;
        } catch (e) {
          isTokenValid.value = false;
        }
      } else {
        isTokenValid.value = null;
      }
    } catch (e) {
      console.warn('Could not load settings:', e);
    }
  };

  const saveVkToken = async (token: string) => {
    vkToken.value = token.trim();
    isTokenValid.value = null; tokenUserName.value = '';
    await safeInvoke('db_delete_setting', { key: 'vk_token' });
    if (token) {
      try {
        const userName = await testToken(token);
        isTokenValid.value = true;
        tokenUserName.value = userName;
      } catch (e) {
        isTokenValid.value = false;
      }
    } else {
      isTokenValid.value = null;
    }
  };

  const saveSettings = async (
    token: string, 
    mixing: string, 
    arrangement: string, 
    mastering: string
  ) => {
    await saveVkToken(token);
    offerMixingTemplate.value = mixing;
    offerArrangementTemplate.value = arrangement;
    offerMasteringTemplate.value = mastering;
    await safeInvoke('db_set_setting', { key: 'offer_mixing', value: mixing });
    await safeInvoke('db_set_setting', { key: 'offer_arrangement', value: arrangement });
    await safeInvoke('db_set_setting', { key: 'offer_mastering', value: mastering });
  };


  let preferences: Record<string, unknown> = {};
  try { preferences = JSON.parse(localStorage.getItem('asv_scout_v3_preferences') || '{}') || {}; } catch {}
  const mode = ref<'both'|'hot'|'growth'>(['both','hot','growth'].includes(String(preferences.mode)) ? preferences.mode as 'both'|'hot'|'growth' : 'both');
  const maxGroups = ref(Math.max(1, Math.min(30, Number(preferences.maxGroups)||12)));
  const maxQueries = ref(Math.max(1, Math.min(8, Number(preferences.maxQueries)||4)));
  const extraKeywords = ref(String(preferences.extraKeywords||''));
  const checking = ref(false), connectionError = ref('');
  const persist = () => localStorage.setItem('asv_scout_v3_preferences', JSON.stringify({mode:mode.value,maxGroups:maxGroups.value,maxQueries:maxQueries.value,extraKeywords:extraKeywords.value}));
  const saveToken = (token:string) => { vkToken.value=token.trim(); isTokenValid.value=null; tokenUserName.value=''; connectionError.value=''; };
  async function verifyToken() {
    checking.value=true; connectionError.value=''; tokenUserName.value=''; isTokenValid.value=null;
    try { tokenUserName.value=await testToken(vkToken.value); isTokenValid.value=true; }
    catch { connectionError.value='Не удалось проверить VK. Проверьте токен, сеть и права приложения.'; isTokenValid.value=false; }
    finally {checking.value=false;}
  }

  return {
    mode,maxGroups,maxQueries,extraKeywords,persist,saveToken,verifyToken,checking,connectionError,tokenUser:tokenUserName,
    vkToken,
    isTokenValid,
    tokenUserName,
    aiApiKey,
    aiBaseUrl,
    aiModel,
    offerMixingTemplate,
    offerArrangementTemplate,
    offerMasteringTemplate,
    loadSettings,
    saveVkToken,
    saveSettings
  };
});
