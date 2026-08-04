use std::sync::Mutex;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

pub struct AppState {
    pub db: Mutex<Connection>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Artist {
    pub id: String,
    pub vk_id: String,
    pub name: String,
    pub link: String,
    pub description: String,
    pub followers: i64,
    pub last_activity: String,
    pub music_links: String,
    pub contacts: String,
    pub avatar: String,
    pub raw_data: String,
    pub status: String,
    pub notes: String,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoryRecord {
    pub id: Option<i64>,
    pub artist_id: String,
    pub record_type: String,
    pub content: String,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VkGroup {
    pub id: i64,
    pub name: String,
    pub screen_name: String,
    pub description: Option<String>,
    pub members_count: Option<i64>,
    pub photo_200: Option<String>,
    pub site: Option<String>,
    pub activity: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VkPost {
    pub id: i64,
    pub text: String,
    pub date: i64,
    pub attachments: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiRequest {
    pub artist_data: String,
    pub openai_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiOfferRequest {
    pub artist_data: String,
    pub offer_type: String,
    pub openai_key: String,
}
