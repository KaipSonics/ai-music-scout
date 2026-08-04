use reqwest::Client;
use serde_json::Value;

const VK_API_VERSION: &str = "5.131";
const USER_AGENT: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

fn vk_api_url(method: &str) -> String {
    format!("https://api.vk.com/method/{}", method)
}

fn sanitize_token(token: &str) -> String {
    let t = token.trim();
    if let Some(pos) = t.find("access_token=") {
        let after = &t[pos + "access_token=".len()..];
        let end = after.find('&').unwrap_or(after.len());
        return after[..end].to_string();
    }
    t.to_string()
}

fn create_client() -> Client {
    Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .unwrap_or_else(|_| Client::new())
}

/// Открыть любую внешнюю ссылку в браузере по умолчанию
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Проверить токен пользователя через users.get
#[tauri::command]
pub async fn vk_test_token(token: String) -> Result<String, String> {
    let client = create_client();
    let clean_token = sanitize_token(&token);

    if clean_token.is_empty() {
        return Err("Токен пуст".to_string());
    }

    let resp = client
        .get(vk_api_url("users.get"))
        .query(&[
            ("access_token", clean_token.as_str()),
            ("v", VK_API_VERSION),
        ])
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let json: Value = resp.json().await.map_err(|e| format!("JSON parse error: {}", e))?;

    if let Some(err) = json.get("error") {
        let code = err.get("error_code").and_then(|v| v.as_i64()).unwrap_or(0);
        let msg = err.get("error_msg").and_then(|v| v.as_str()).unwrap_or("unknown");
        return Err(format!("VK API Error (Код {}): {}", code, msg));
    }

    if let Some(users) = json["response"].as_array() {
        if let Some(first) = users.first() {
            let first_name = first.get("first_name").and_then(|v| v.as_str()).unwrap_or("");
            let last_name = first.get("last_name").and_then(|v| v.as_str()).unwrap_or("");
            let id = first.get("id").and_then(|v| v.as_i64()).unwrap_or(0);
            return Ok(format!("{} {} (ID: {})", first_name, last_name, id));
        }
    }

    Ok("Токен валиден!".to_string())
}

/// Поиск сообществ ВКонтакте с поддержкой смещения (offset)
#[tauri::command]
pub async fn vk_search(query: String, token: String) -> Result<Value, String> {
    let client = create_client();
    let clean_token = sanitize_token(&token);
    
    // Generate a random offset between 0 and 60 for non-repeating results
    let offset_val = (std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis() % 50) as u32;

    let resp = client
        .get(vk_api_url("groups.search"))
        .query(&[
            ("q", query.as_str()),
            ("type", "group"),
            ("count", "50"),
            ("offset", &offset_val.to_string()),
            ("fields", "description,members_count,site,activity,status,contacts,links,cover,photo_200"),
            ("access_token", clean_token.as_str()),
            ("v", VK_API_VERSION),
        ])
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let json: Value = resp.json().await.map_err(|e| format!("JSON parse error: {}", e))?;

    if let Some(err) = json.get("error") {
        let code = err.get("error_code").and_then(|v| v.as_i64()).unwrap_or(0);
        let msg = err.get("error_msg").and_then(|v| v.as_str()).unwrap_or("unknown");
        return Err(format!("VK API Error (Код {}): {}", code, msg));
    }

    Ok(json["response"].clone())
}

/// Получить данные группы по ID или screen_name
#[tauri::command]
pub async fn vk_get_group(id: String, token: String) -> Result<Value, String> {
    let client = create_client();
    let clean_token = sanitize_token(&token);

    let resp = client
        .get(vk_api_url("groups.getById"))
        .query(&[
            ("group_id", id.as_str()),
            ("fields", "description,members_count,site,activity,status,contacts,links,cover,photo_200"),
            ("access_token", clean_token.as_str()),
            ("v", VK_API_VERSION),
        ])
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let json: Value = resp.json().await.map_err(|e| format!("JSON parse error: {}", e))?;

    if let Some(err) = json.get("error") {
        let code = err.get("error_code").and_then(|v| v.as_i64()).unwrap_or(0);
        let msg = err.get("error_msg").and_then(|v| v.as_str()).unwrap_or("unknown");
        return Err(format!("VK API Error (Код {}): {}", code, msg));
    }

    let groups = json["response"]["groups"].as_array()
        .or_else(|| json["response"].as_array());

    if let Some(arr) = groups {
        if let Some(first) = arr.first() {
            return Ok(first.clone());
        }
    }

    Ok(json["response"].clone())
}

/// Получить последние посты со стены группы
#[tauri::command]
pub async fn vk_get_wall(id: String, token: String) -> Result<Value, String> {
    let client = create_client();
    let clean_token = sanitize_token(&token);

    let owner_id = if id.starts_with('-') {
        id.clone()
    } else {
        format!("-{}", id)
    };

    let resp = client
        .get(vk_api_url("wall.get"))
        .query(&[
            ("owner_id", owner_id.as_str()),
            ("count", "20"),
            ("filter", "owner"),
            ("access_token", clean_token.as_str()),
            ("v", VK_API_VERSION),
        ])
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let json: Value = resp.json().await.map_err(|e| format!("JSON parse error: {}", e))?;

    if let Some(err) = json.get("error") {
        let code = err.get("error_code").and_then(|v| v.as_i64()).unwrap_or(0);
        let msg = err.get("error_msg").and_then(|v| v.as_str()).unwrap_or("unknown");
        return Err(format!("VK API Error (Код {}): {}", code, msg));
    }

    Ok(json["response"].clone())
}

/// Получить количество участников группы
#[tauri::command]
pub async fn vk_get_members(id: String, token: String) -> Result<Value, String> {
    let client = create_client();
    let clean_token = sanitize_token(&token);

    let resp = client
        .get(vk_api_url("groups.getMembers"))
        .query(&[
            ("group_id", id.as_str()),
            ("count", "0"),
            ("access_token", clean_token.as_str()),
            ("v", VK_API_VERSION),
        ])
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let json: Value = resp.json().await.map_err(|e| format!("JSON parse error: {}", e))?;

    if let Some(err) = json.get("error") {
        let code = err.get("error_code").and_then(|v| v.as_i64()).unwrap_or(0);
        let msg = err.get("error_msg").and_then(|v| v.as_str()).unwrap_or("unknown");
        return Err(format!("VK API Error (Код {}): {}", code, msg));
    }

    Ok(json["response"].clone())
}

/// Поиск свежих постов в ленте новостей VK (newsfeed.search)
#[tauri::command]
pub async fn vk_newsfeed_search(query: String, token: String) -> Result<Value, String> {
    let client = create_client();
    let clean_token = sanitize_token(&token);

    let resp = client
        .get(vk_api_url("newsfeed.search"))
        .query(&[
            ("q", query.as_str()),
            ("count", "50"),
            ("access_token", clean_token.as_str()),
            ("v", VK_API_VERSION),
        ])
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let json: Value = resp.json().await.map_err(|e| format!("JSON parse error: {}", e))?;

    if let Some(err) = json.get("error") {
        let code = err.get("error_code").and_then(|v| v.as_i64()).unwrap_or(0);
        let msg = err.get("error_msg").and_then(|v| v.as_str()).unwrap_or("unknown");
        return Err(format!("VK API Error (Код {}): {}", code, msg));
    }

    Ok(json["response"].clone())
}

/// Получить данные профиля пользователя VK (users.get)
#[tauri::command]
pub async fn vk_get_user(id: String, token: String) -> Result<Value, String> {
    let client = create_client();
    let clean_token = sanitize_token(&token);

    let resp = client
        .get(vk_api_url("users.get"))
        .query(&[
            ("user_ids", id.as_str()),
            ("fields", "photo_200,city,domain,status,about,activities,interests"),
            ("access_token", clean_token.as_str()),
            ("v", VK_API_VERSION),
        ])
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    let json: Value = resp.json().await.map_err(|e| format!("JSON parse error: {}", e))?;

    if let Some(err) = json.get("error") {
        let code = err.get("error_code").and_then(|v| v.as_i64()).unwrap_or(0);
        let msg = err.get("error_msg").and_then(|v| v.as_str()).unwrap_or("unknown");
        return Err(format!("VK API Error (Код {}): {}", code, msg));
    }

    if let Some(arr) = json["response"].as_array() {
        if let Some(first) = arr.first() {
            return Ok(first.clone());
        }
    }

    Ok(json["response"].clone())
}
