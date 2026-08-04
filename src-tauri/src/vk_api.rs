use reqwest::Client;
use serde_json::Value;
use std::collections::HashMap;

const VK_API_VERSION: &str = "5.131";

#[tauri::command]
pub async fn vk_search(query: String, token: String) -> Result<Value, String> {
    let client = Client::new();
    let url = "https://api.vk.com/method/groups.search";
    
    let mut params = HashMap::new();
    params.insert("q", query);
    params.insert("access_token", token);
    params.insert("v", VK_API_VERSION.to_string());
    params.insert("count", "50".to_string());

    let res = client.get(url)
        .query(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(json)
}

#[tauri::command]
pub async fn vk_get_group(id: String, token: String) -> Result<Value, String> {
    let client = Client::new();
    let url = "https://api.vk.com/method/groups.getById";
    
    let mut params = HashMap::new();
    params.insert("group_id", id);
    params.insert("access_token", token);
    params.insert("v", VK_API_VERSION.to_string());
    params.insert("fields", "description,members_count,links,contacts,activity,site".to_string());

    let res = client.get(url)
        .query(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(json)
}

#[tauri::command]
pub async fn vk_get_wall(id: String, token: String) -> Result<Value, String> {
    let client = Client::new();
    let url = "https://api.vk.com/method/wall.get";
    
    // id should be negative for groups, but the user provides the raw ID. 
    // We assume if it's a group, we prepend a minus sign.
    // In VK API, owner_id = -group_id.
    let owner_id = if id.starts_with('-') { id } else { format!("-{}", id) };
    
    let mut params = HashMap::new();
    params.insert("owner_id", owner_id);
    params.insert("access_token", token);
    params.insert("v", VK_API_VERSION.to_string());
    params.insert("count", "10".to_string());

    let res = client.get(url)
        .query(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let json: Value = res.json().await.map_err(|e| e.to_string())?;
    Ok(json)
}
