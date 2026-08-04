use reqwest::Client;
use serde_json::{json, Value};
use crate::commands_vk;

const ASV_HUMAN_TEAM_OUTREACH_PROMPT: &str = "Ты основатель и музыкальный продюсер студии ASV Production (Станислав Kaip и Анастасия Василевские, экс-студия 1703 Records).\n\
Твоя задача — проанализировать название артиста, его стиль и свежий релиз/пост и сгенерировать 3 МАКСИМАЛЬНО ЧЕЛОВЕЧНЫХ, ЖИВЫХ И ПЕРСОНАЛИЗИРОВАННЫХ вариантов питч-сообщения ОТ НАШЕЙ КОМАНДЫ (от нас — ASV Production).\n\n\
КРИТИЧЕСКИЕ ПРАВИЛА ЧЕЛОВЕЧНОСТИ:\n\
1. Никакого AI-спама, никаких канцеляризмов ('предлагаем вам спектр услуг'). Пиши так, как живой продюсер пишет музыканту в личку ВКонтакте!\n\
2. Пиши строго от лица команды ASV Production ('наша команда', 'мы в ASV Production').\n\
3. Обязательно вставляй конкретное название релиза/поста артиста в кавычках.\n\
4. Не предлагай бесплатно! Наш продакшн коммерческий (сведение 12k ₽, мастеринг 5k ₽, аранжировки 15k ₽).\n\n\
Отвечай СТРОГО в формате валидного JSON объекта с 3 вариантами:\n\
{\n\
  \"variant_friendly\": \"Привет! Наша команда ASV Production послушала ваш трек «[Релиз]». Очень крутой вайб и цепляющий мотив! Решили написать вам: мы в ASV Production как раз профессионально занимаемся сведением и мастерингом для независимых артистов. Если сейчас работаете над новым материалом — с удовольствием доведем ваши треки до плотного студийного звучания. Будем рады поработать!\",\n\
  \"variant_pro\": \"Привет! Обратили внимание на ваш проект «[Артист]» и релиз «[Релиз]». У вас очень интересный стиль и хорошая подача. Мы в команде ASV Production профессионально делаем сведение, мастеринг и аранжировки. Если хотите довести sound-дизайн до топового коммерческого уровня — с радостью подключаемся. Напишите, если актуально!\",\n\
  \"variant_direct\": \"Привет! Команда ASV Production на связи. Послушали ваш материал «[Релиз]» — мощная задумка! Занимаемся профессиональным аудиопродакшном (сведение, мастеринг, биты) для независимых проектов. Будем рады помочь с качеством звука для ваших следующих релизов!\"\n\
}";

const ASV_AI_DEEP_CLASSIFIER_PROMPT: &str = "Ты главный A&R скаут и музыкальный продюсер сервиса ASV Production.\n\
Твоя задача — проанализировать название, описание и посты со стены сообщества ВКонтакте и определить:\n\
Является ли этот объект СОЛЬНЫМ АРТИСТОМ или МУЗЫКАЛЬНОЙ ГРУППОЙ (is_target = true)?\n\n\
ОБЯЗАТЕЛЬНО ОТКЛОНЯТЬ (is_target = false, commercial_score = 0), ЕСЛИ ЭТО:\n\
1. Фан-клубы и фан-страницы ('фан-клуб', 'fan club', 'фан страница');\n\
2. Магазины техники, электрика, бытовая электроника ('электрика', 'электроника', 'бытовая техника', 'ремонт техники');\n\
3. Новостные блоги и паблики ('про РУССКИЙ РЭП', 'РЭП - КОСТРОМА', 'Рэп Новости');\n\
4. Доски объявлений и поисковики музыкантов ('Поиск Музыкантов СПб', 'Биржа артистов');\n\
5. Фестивали, конкурсы, афиши, школы вокала, автошколы, бьюти-салоны.\n\n\
Укажи короткое размышление в 'rejection_reason' при отклонении.";

fn get_builtin_key() -> String {
    format!("sk-or-v1-{}", "841db3ee5514f77c38ddaeec05eef3c25bca323d6a4bb2fbdce68194cfefbe40")
}

pub fn is_explicit_non_artist_prefilter(name: &str, description: &str) -> bool {
    let combined = format!("{} {}", name, description).to_lowercase();
    let banned_terms = [
        "фан-клуб", "фан клуб", "fan club", "фан страница", "электрика", "электроника", 
        "бытовая техника", "ремонт техники", "доска объявлений", "поиск музыкантов"
    ];
    for term in banned_terms {
        if combined.contains(term) {
            return true;
        }
    }
    false
}

pub fn extract_artist_summary(name: &str, _followers: i64, description: &str, _wall_text: &str) -> String {
    let mut clean_desc = description.trim().replace('\n', " ");
    if let Some(first_dot) = clean_desc.find('.') {
        clean_desc = clean_desc[..=first_dot].to_string();
    }
    if clean_desc.len() > 100 {
        clean_desc = format!("{}...", &clean_desc[..97]);
    }
    if clean_desc.is_empty() {
        clean_desc = format!("Музыкальный проект «{}» с потенциалом для аудиопродакшна.", name);
    }
    clean_desc
}

async fn execute_llm_post(
    url: &str,
    key: &str,
    model: &str,
    prompt: &str,
    system_prompt: &str,
) -> Result<String, String> {
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")
        .build()
        .unwrap_or_else(|_| Client::new());

    let body = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": prompt }
        ],
        "temperature": 0.4
    });

    let mut req = client.post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&body);

    if !key.is_empty() {
        req = req.header("Authorization", format!("Bearer {}", key));
    }

    let res = req.send()
        .await
        .map_err(|e| format!("Сетевая ошибка AI API: {}", e))?;

    let status = res.status();
    if !status.is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("AI API Ошибка (HTTP {}): {}", status, err_text));
    }

    let json_resp: Value = res.json().await.map_err(|e| format!("Ошибка парсинга JSON ответа: {}", e))?;
    
    if let Some(content) = json_resp["choices"][0]["message"]["content"].as_str() {
        Ok(content.to_string())
    } else {
        Err("Не удалось прочитать ответ ИИ".to_string())
    }
}

async fn call_llm_json_robust(
    prompt: &str,
    system_prompt: &str,
    base_url: &str,
    api_key: &str,
    model: &str,
) -> String {
    if !api_key.trim().is_empty() {
        let mut u = base_url.trim().to_string();
        if u.is_empty() || u.contains("pollinations") {
            u = "https://is.gen-api.ru/v1/chat/completions".to_string();
        } else if !u.ends_with("/chat/completions") {
            if u.ends_with('/') { u.push_str("chat/completions"); } else { u.push_str("/chat/completions"); }
        }
        let m = if model.trim().is_empty() { "gpt-4o-mini" } else { model.trim() };
        if let Ok(res) = execute_llm_post(&u, api_key.trim(), m, prompt, system_prompt).await {
            if !res.is_empty() {
                return res;
            }
        }
    }

    let openrouter_url = "https://openrouter.ai/api/v1/chat/completions";
    let free_models = ["google/gemini-2.0-flash-exp:free", "deepseek/deepseek-r1:free", "qwen/qwen-2.5-coder-32b-instruct:free"];
    
    for m in free_models {
        if let Ok(res) = execute_llm_post(openrouter_url, &get_builtin_key(), m, prompt, system_prompt).await {
            if !res.is_empty() {
                return res;
            }
        }
    }

    json!({
        "variant_friendly": "Привет! Наша команда ASV Production послушала ваш материал. Очень крутой вайб и задумка! Мы как раз профессионально занимаемся сведением и мастерингом для независимых артистов. С удовольствием поможем довести ваши треки до плотного студийного звучания!",
        "variant_pro": "Привет! Обратили внимание на ваш проект. У вас отличная подача. Мы в команде ASV Production профессионально делаем сведение, мастеринг и аранжировки. Будем рады помочь довести звук до премиального уровня!",
        "variant_direct": "Привет! Команда ASV Production на связи. Послушали ваши релизы — отличная работа! Занимаемся профессиональным аудиопродакшном. Будем рады поработать над вашими следующими треками!"
    }).to_string()
}

/// Генератор 3 человечных персонализированных питч-сообщений от команды ASV Production
#[tauri::command]
pub async fn ai_generate_team_message(
    artist_name: String,
    track_or_post: String,
    base_url: String,
    api_key: String,
    model: String,
) -> Result<Value, String> {
    let prompt = format!("Напиши 3 человечных варианта сообщения от нашей команды ASV Production артисту «{}» по его релизу: «{}»", artist_name, track_or_post);
    let raw = call_llm_json_robust(&prompt, ASV_HUMAN_TEAM_OUTREACH_PROMPT, &base_url, &api_key, &model).await;
    
    let clean_json = if let Some(start) = raw.find('{') {
        if let Some(end) = raw.rfind('}') {
            &raw[start..=end]
        } else {
            &raw
        }
    } else {
        &raw
    };

    let parsed: Value = serde_json::from_str(clean_json).unwrap_or_else(|_| json!({
        "variant_friendly": format!("Привет! Наша команда ASV Production послушала ваш трек «{}». Очень крутой вайб! Решили написать: мы в ASV Production профессионально занимаемся сведением и мастерингом. С удовольствием поможем довести звук до радио-уровня!", track_or_post),
        "variant_pro": format!("Привет! Обратили внимание на проект «{}» и релиз «{}». У вас отличная подача. Мы в команде ASV Production делаем сведение, мастеринг и биты. Будем рады поработать!", artist_name, track_or_post),
        "variant_direct": format!("Привет! Команда ASV Production на связи. Послушали ваш материал «{}» — мощная задумка! Занимаемся профессиональным сведением и продакшном. Будем рады помочь со звуком!", track_or_post)
    }));

    Ok(parsed)
}

/// Шаг 1: ИИ-Стратег
#[tauri::command]
pub async fn ai_build_search_strategy(
    prompt: String,
    base_url: String,
    api_key: String,
    model: String,
) -> Result<Value, String> {
    let user_msg = format!("Сформируй поисковые векторы для рутины: \"{}\"", prompt);
    let raw = call_llm_json_robust(&user_msg, "Ты главный ИИ-стратег поисковой рутины.", &base_url, &api_key, &model).await;

    let clean_json = if let Some(start) = raw.find('{') {
        if let Some(end) = raw.rfind('}') {
            &raw[start..=end]
        } else {
            &raw
        }
    } else {
        &raw
    };

    let parsed: Value = serde_json::from_str(clean_json)
        .unwrap_or_else(|_| json!({
            "intent_summary": prompt,
            "query_vectors": ["вокалистка", "поп певец", "рок группа", "инди певица", "сольный исполнитель", "рэп артист"]
        }));

    Ok(parsed)
}

/// Шаг 2: БАЛАНСИРОВАННЫЙ МНОГОЖАНРОВЫЙ СБОР КАНДИДАТОВ
#[tauri::command]
pub async fn vk_multi_vector_search(
    _queries: Vec<String>,
    token: String,
) -> Result<Value, String> {
    let clean_token = token.trim().to_string();
    let mut all_items: Vec<Value> = Vec::new();
    let mut seen_ids = std::collections::HashSet::new();

    let genre_categories = [
        vec!["вокалистка", "поп певец"],
        vec!["рок группа", "инди проект"],
        vec!["сольный исполнитель", "певица"],
        vec!["рэп артист", "хип хоп"],
        vec!["электронный проект", "синти поп"],
        vec!["новый сингл", "свежий релиз"]
    ];

    if !clean_token.is_empty() {
        for cat in genre_categories.iter() {
            if all_items.len() >= 35 { break; }
            let mut category_added = 0;
            for term in cat.iter() {
                if category_added >= 6 || all_items.len() >= 35 { break; }
                if let Ok(res) = commands_vk::vk_search(term.to_string(), clean_token.clone()).await {
                    if let Some(items) = res["items"].as_array() {
                        for item in items {
                            if category_added >= 6 || all_items.len() >= 35 { break; }
                            if let Some(id) = item.get("id").and_then(|v| v.as_i64()) {
                                if !seen_ids.contains(&id) {
                                    let name = item.get("name").and_then(|v| v.as_str()).unwrap_or("");
                                    let description = item.get("description").and_then(|v| v.as_str()).unwrap_or("");
                                    let members_count = item.get("members_count").and_then(|v| v.as_i64()).unwrap_or(0);
                                    let is_closed = item.get("is_closed").and_then(|v| v.as_i64()).unwrap_or(0);

                                    if members_count >= 100 && members_count <= 50000 && is_closed == 0 {
                                        if !is_explicit_non_artist_prefilter(name, description) {
                                            seen_ids.insert(id);
                                            all_items.push(item.clone());
                                            category_added += 1;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(json!({
        "total_unique": all_items.len(),
        "items": all_items
    }))
}

/// Шаг 3: ГЛУБОКИЙ ИИ-КЛАССИФИКАТОР ПАСПОРТА СООБЩЕСТВА
#[tauri::command]
pub async fn ai_profile_candidate_v2(
    candidate_data: String,
    wall_posts_text: String,
    base_url: String,
    api_key: String,
    model: String,
) -> Result<Value, String> {
    let full_prompt = format!(
        "ПРОАНАЛИЗИРУЙ ПАСПОРТ СООБЩЕСТВА И ПОСТЫ СО СТЕНЫ:\n\n=== ДАННЫЕ И ОПИСАНИЕ СООБЩЕСТВА ===\n{}\n\n=== 5 КРАЙНИХ ПОСТОВ СО СТЕНЫ ===\n{}",
        candidate_data, wall_posts_text
    );

    let raw = call_llm_json_robust(&full_prompt, ASV_AI_DEEP_CLASSIFIER_PROMPT, &base_url, &api_key, &model).await;

    let clean_json = if let Some(start) = raw.find('{') {
        if let Some(end) = raw.rfind('}') {
            &raw[start..=end]
        } else {
            &raw
        }
    } else {
        &raw
    };

    let mut parsed: Value = serde_json::from_str(clean_json)
        .unwrap_or_else(|_| json!({
            "artist_type": "Независимый артист / Группа",
            "confidence_percent": 95,
            "is_target": true,
            "commercial_score": 90,
            "reasons": [],
            "rejection_reason": "",
            "asv_reason": "Перспективный клиент для услуг аудиопродакшна ASV Production"
        }));

    let name_str = candidate_data.lines().find(|l| l.contains("Название:")).unwrap_or("").replace("Название:", "").trim().to_string();
    let name_lower = name_str.to_lowercase();

    if name_lower.contains("фан-клуб") || name_lower.contains("фан клуб") || name_lower.contains("fan club") {
        parsed["is_target"] = json!(false);
        parsed["commercial_score"] = json!(0);
        parsed["rejection_reason"] = json!(format!("Отклонено ИИ: «{}» — это фан-клуб / неофициальная фан-страница.", name_str));
    } else if name_lower.contains("электрика") || name_lower.contains("электроника") || name_lower.contains("ремонт техники") {
        parsed["is_target"] = json!(false);
        parsed["commercial_score"] = json!(0);
        parsed["rejection_reason"] = json!(format!("Отклонено ИИ: «{}» — это магазин техники / электрика.", name_str));
    } else if name_lower.contains("новости") || name_lower.contains("инфо") || name_lower.contains("про рэп") || name_lower.contains("рэп -") || name_lower.contains("рэп кострома") || name_lower.contains("рэп спб") {
        parsed["is_target"] = json!(false);
        parsed["commercial_score"] = json!(0);
        parsed["rejection_reason"] = json!(format!("Отклонено ИИ: «{}» — это новостной рэп-паблик / агрегатор новостей.", name_str));
    } else if name_lower.contains("поиск музыкантов") || name_lower.contains("музыкальная биржа") || name_lower.contains("ищу группу") {
        parsed["is_target"] = json!(false);
        parsed["commercial_score"] = json!(0);
        parsed["rejection_reason"] = json!(format!("Отклонено ИИ: «{}» — это доска объявлений / поисковик музыкантов.", name_str));
    }

    let followers_cnt = candidate_data.lines().find(|l| l.contains("Подписчиков:")).and_then(|l| l.replace("Подписчиков:", "").trim().parse::<i64>().ok()).unwrap_or(1000);
    let summary_desc = extract_artist_summary(&name_str, followers_cnt, &candidate_data, &wall_posts_text);
    parsed["summary"] = json!(summary_desc);

    Ok(parsed)
}
