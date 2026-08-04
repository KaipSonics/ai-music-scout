import { defineStore } from 'pinia';
import { ref } from 'vue';
import { safeInvoke } from '../utils/tauriBridge';

export const useSettingsStore = defineStore('settings', () => {
  const vkToken = ref('');
  const isTokenValid = ref<boolean | null>(null);
  const tokenUserName = ref('');

  const aiApiKey = ref('');
  const aiBaseUrl = ref('https://openrouter.ai/api/v1');
  const aiModel = ref('google/gemini-2.0-flash-exp:free');

  const offerMixingTemplate = ref('Привет, {name}! Наша команда ASV Production послушала ваш проект. Занимаемся профессиональным сведением и мастерингом (12 000 ₽) для независимых артистов. Готовы помочь довести ваши треки до премиального студийного качества под релиз!');
  const offerArrangementTemplate = ref('Привет, {name}! Наша команда ASV Production обратила внимание на вашу подачу. Пишем авторские аранжировки и биты «под ключ» (15 000 ₽). Будем рады поработать над вашими совместными релизами!');
  const offerMasteringTemplate = ref('Здравствуйте, {name}! Наша команда ASV Production делает финальный мастеринг под стриминговые площадки (Apple Music, VK, Yandex Music) по стандартам -14 LUFS (5 000 ₽). С удовольствием подготовим ваши треки к публикации!');

  const loadSettings = async () => {
    try {
      vkToken.value = await safeInvoke('db_get_setting', { key: 'vk_token' }) || '';
      
      const mixing = await safeInvoke('db_get_setting', { key: 'offer_mixing' });
      if (mixing && !mixing.includes('скидкой')) offerMixingTemplate.value = mixing;
      
      const arrangement = await safeInvoke('db_get_setting', { key: 'offer_arrangement' });
      if (arrangement) offerArrangementTemplate.value = arrangement;
      
      const mastering = await safeInvoke('db_get_setting', { key: 'offer_mastering' });
      if (mastering && !mastering.includes('бесплатно')) offerMasteringTemplate.value = mastering;

      if (vkToken.value) {
        try {
          const userName = await safeInvoke('vk_test_token', { token: vkToken.value });
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
    vkToken.value = token;
    await safeInvoke('db_set_setting', { key: 'vk_token', value: token });
    if (token) {
      try {
        const userName = await safeInvoke('vk_test_token', { token });
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

  return {
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
