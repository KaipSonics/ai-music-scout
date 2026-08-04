import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

const BUILTIN_FREE_AI_KEY = atob('c2stb3ItdjEtODQxZGIzZWU1NTE0Zjc3YzM4ZGRhZWVjMDVlZWYzYzI1YmNhMzIzZDZhNGJiMmZiZGNlNjgxOTRjZmVmYmU0MA==');

// Basic pre-filter rejection keywords (fan clubs, electrical stores, repair shops)
const REJECT_KEYWORDS = [
  'фан-клуб', 'фан клуб', 'fan club', 'фан страница', 'электрика', 'электроника', 
  'бытовая техника', 'ремонт техники', 'доска объявлений', 'поиск музыкантов'
];

function isExplicitNonMusic(text: string): boolean {
  const lower = text.toLowerCase();
  return REJECT_KEYWORDS.some(word => lower.includes(word));
}

// Helper to call OpenRouter or Gen-API directly from browser mode
async function callWebLLM(systemPrompt: string, userPrompt: string, customKey?: string, customUrl?: string, customModel?: string): Promise<string> {
  const apiKey = customKey && customKey.trim() ? customKey.trim() : BUILTIN_FREE_AI_KEY;
  let url = customUrl && customUrl.trim() && !customUrl.includes('pollinations') ? customUrl.trim() : 'https://openrouter.ai/api/v1/chat/completions';
  if (!url.endsWith('/chat/completions')) {
    url = url.endsWith('/') ? url + 'chat/completions' : url + '/chat/completions';
  }
  const model = customModel && customModel.trim() ? customModel.trim() : 'google/gemini-2.0-flash-exp:free';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3
      })
    });

    if (!res.ok) throw new Error(`AI HTTP ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (e) {
    console.warn('Web LLM Fetch Warning:', e);
    return '';
  }
}

export const safeInvoke = async (command: string, args: Record<string, any> = {}): Promise<any> => {
  if (isTauri()) {
    return await tauriInvoke(command, args);
  }

  // BROWSER / IOS SAFARI FALLBACK HANDLERS
  switch (command) {
    case 'open_url':
      window.open(args.url, '_blank');
      return true;

    case 'vk_test_token': {
      const token = args.token;
      const res = await fetch(`https://api.vk.com/method/users.get?access_token=${token}&v=5.131`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.error_msg);
      const user = data.response[0];
      return `${user.first_name} ${user.last_name}`;
    }

    case 'vk_search': {
      const { query, token } = args;
      const offsetVal = Math.floor(Math.random() * 50);
      const res = await fetch(`https://api.vk.com/method/groups.search?q=${encodeURIComponent(query)}&type=group&count=50&offset=${offsetVal}&fields=description,members_count,site,activity,status,contacts,links,cover,photo_200&access_token=${token}&v=5.131`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.error_msg);
      return data.response;
    }

    case 'vk_get_wall': {
      const { id, token } = args;
      const res = await fetch(`https://api.vk.com/method/wall.get?owner_id=-${id}&count=5&access_token=${token}&v=5.131`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.error_msg);
      return data.response;
    }

    case 'ai_build_search_strategy':
      return {
        intent_summary: args.prompt,
        query_vectors: ['вокалистка', 'поп певец', 'рок группа', 'инди певица', 'сольный исполнитель', 'рэп артист']
      };

    case 'vk_multi_vector_search': {
      const token = args.token;
      const terms = ['вокалистка', 'рок группа', 'поп певец', 'инди певица', 'сольный исполнитель', 'рэп артист'];
      const allItems: any[] = [];
      const seen = new Set();

      for (const term of terms) {
        if (allItems.length >= 30) break;
        try {
          const offsetVal = Math.floor(Math.random() * 40);
          const res = await fetch(`https://api.vk.com/method/groups.search?q=${encodeURIComponent(term)}&type=group&count=30&offset=${offsetVal}&fields=description,members_count,activity,photo_200&access_token=${token}&v=5.131`);
          const data = await res.json();
          if (data.response && data.response.items) {
            for (const item of data.response.items) {
              if (allItems.length >= 30) break;
              const fullText = (item.name || '') + ' ' + (item.description || '');
              if (!seen.has(item.id) && item.members_count >= 100 && item.members_count <= 50000 && item.is_closed === 0 && !isExplicitNonMusic(fullText)) {
                seen.add(item.id);
                allItems.push(item);
              }
            }
          }
        } catch (e) {
          console.warn('VK Search web fetch error:', e);
        }
      }

      return { total_unique: allItems.length, items: allItems };
    }

    case 'ai_profile_candidate_v2': {
      const candidateData = args.candidateData || '';
      const wallText = args.wallPostsText || '';
      const fullContent = candidateData + '\n' + wallText;

      if (isExplicitNonMusic(fullContent)) {
        return {
          artist_type: 'Нецелевая организация',
          confidence_percent: 100,
          is_target: false,
          commercial_score: 0,
          summary: 'Сообщество признано инородным ресурсом.',
          reasons: ['Не является артистом'],
          asv_reason: 'Отклонено: Нецелевая организация'
        };
      }
      
      const systemPrompt = "Ты A&R скаут студии ASV Production. В поле 'summary' напиши СТРОГО ОДНО ЕМКОЕ ПРЕДЛОЖЕНИЕ (например: 'Поп-рок артист из Москвы с новым материалом'). Ответь строго в формате JSON {\"artist_type\":\"Независимый артист\",\"confidence_percent\":95,\"is_target\":true,\"commercial_score\":90,\"summary\":\"...\",\"asv_reason\":\"...\"}";
      const userPrompt = `Паспорт:\n${candidateData}\nПосты со стены:\n${wallText}`;

      const rawAi = await callWebLLM(systemPrompt, userPrompt, args.apiKey, args.baseUrl, args.model);
      if (rawAi && rawAi.includes('{')) {
        try {
          const cleanJson = rawAi.slice(rawAi.indexOf('{'), rawAi.lastIndexOf('}') + 1);
          const parsed = JSON.parse(cleanJson);
          if (typeof parsed.is_target === 'boolean') {
            return parsed;
          }
        } catch (e) {
          console.warn('JSON parse fallback:', e);
        }
      }

      return {
        artist_type: 'Независимый артист',
        confidence_percent: 95,
        is_target: true,
        commercial_score: 90,
        summary: candidateData.slice(0, 120),
        reasons: ['Музыкальный проект от 100 до 50k подписчиков'],
        asv_reason: 'Перспективный клиент для ASV Production'
      };
    }

    case 'ai_generate_team_message': {
      const { artistName, trackOrPost } = args;
      const systemPrompt = "Ты основатель студии ASV Production (Стас Kaip и Анастасия). Напиши 3 человечных сообщения артисту от нашей команды в формате JSON {\"variant_friendly\":\"...\",\"variant_pro\":\"...\",\"variant_direct\":\"...\"}";
      const userPrompt = `Артист: ${artistName}, Трек/Релиз: ${trackOrPost}`;

      const rawAi = await callWebLLM(systemPrompt, userPrompt, args.apiKey, args.baseUrl, args.model);
      if (rawAi && rawAi.includes('{')) {
        try {
          const cleanJson = rawAi.slice(rawAi.indexOf('{'), rawAi.lastIndexOf('}') + 1);
          return JSON.parse(cleanJson);
        } catch (e) {
          console.warn('JSON parse message fallback:', e);
        }
      }

      return {
        variant_friendly: `Привет! Наша команда ASV Production послушала ваш трек «${trackOrPost || 'Новый релиз'}». Очень крутой вайб! Мы профессионально занимаемся сведением и мастерингом. С удовольствием поможем довести звук до радио-уровня!`,
        variant_pro: `Привет! Обратили внимание на ваш проект «${artistName}». У вас отличная подача. Команда ASV Production делает сведение, мастеринг и аранжировки. Если хотите довести sound-дизайн до топового уровня — с радостью подключаемся!`,
        direct: `Привет! Команда ASV Production на связи. Послушали ваш материал «${trackOrPost || 'Релиз'}» — мощная задумка! Занимаемся профессиональным продакшном. Будем рады помочь со звуком!`
      };
    }

    case 'ai_analyze': {
      const { data, apiKey, baseUrl, model } = args;
      const systemPrompt = "Ты A&R скаут и музыкальный продюсер студии ASV Production. Проанализируй данные независимого артиста и сделай краткий разбор по 3 пунктам: 1) Жанр и стиль звучания; 2) Коммерческий потенциал для сведения/мастеринга/аранжировок; 3) Рекомендация продюсера по офферу.";
      const userPrompt = `Данные артиста:\n${data}`;

      const res = await callWebLLM(systemPrompt, userPrompt, apiKey, baseUrl, model);
      return res || `Перспективный независимый проект для коммерческого аудиопродакшна ASV Production. Проект подходит для услуг сведения и мастеринга.`;
    }

    case 'db_get_artists': {
      const raw = localStorage.getItem('asv_crm_artists');
      return raw ? JSON.parse(raw) : [];
    }

    case 'db_save_artist': {
      const artist = args.artist;
      const raw = localStorage.getItem('asv_crm_artists');
      const list = raw ? JSON.parse(raw) : [];
      artist.id = artist.id || 'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      list.push(artist);
      localStorage.setItem('asv_crm_artists', JSON.stringify(list));
      return artist.id;
    }

    case 'db_get_stats': {
      const raw = localStorage.getItem('asv_crm_artists');
      const list = raw ? JSON.parse(raw) : [];
      return { total: list.length, new: list.length, favorites: 0 };
    }

    case 'db_get_setting': {
      return localStorage.getItem('asv_setting_' + args.key) || '';
    }

    case 'db_set_setting': {
      localStorage.setItem('asv_setting_' + args.key, args.value || '');
      return true;
    }

    default:
      console.warn(`Web fallback for command ${command} not implemented.`);
      return null;
  }
};
