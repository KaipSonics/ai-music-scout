use crate::models::AppState;
use crate::models::Artist;
use crate::models::HistoryRecord;
use uuid::Uuid;

// ─── Artists ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_save_artist(
    state: tauri::State<AppState>,
    mut artist: Artist,
) -> Result<String, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    if artist.id.is_empty() {
        artist.id = Uuid::new_v4().to_string();
    }

    conn.execute(
        "INSERT OR REPLACE INTO artists
            (id, vk_id, name, link, description, followers, last_activity,
             music_links, contacts, avatar, raw_data, status, notes, updated_at)
         VALUES
            (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, CURRENT_TIMESTAMP)",
        rusqlite::params![
            &artist.id,
            &artist.vk_id,
            &artist.name,
            &artist.link,
            &artist.description,
            &artist.followers,
            &artist.last_activity,
            &artist.music_links,
            &artist.contacts,
            &artist.avatar,
            &artist.raw_data,
            &artist.status,
            &artist.notes,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(artist.id)
}

#[tauri::command]
pub fn db_get_artists(
    state: tauri::State<AppState>,
    status_filter: Option<String>,
) -> Result<Vec<Artist>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let sql = if let Some(ref s) = status_filter {
        if s.is_empty() {
            "SELECT id, vk_id, name, link, description, followers, last_activity, \
             music_links, contacts, avatar, raw_data, status, notes, created_at, updated_at \
             FROM artists ORDER BY updated_at DESC".to_string()
        } else {
            format!(
                "SELECT id, vk_id, name, link, description, followers, last_activity, \
                 music_links, contacts, avatar, raw_data, status, notes, created_at, updated_at \
                 FROM artists WHERE status = '{}' ORDER BY updated_at DESC",
                s.replace('\'', "''")
            )
        }
    } else {
        "SELECT id, vk_id, name, link, description, followers, last_activity, \
         music_links, contacts, avatar, raw_data, status, notes, created_at, updated_at \
         FROM artists ORDER BY updated_at DESC".to_string()
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let artists = stmt
        .query_map([], |row| {
            Ok(Artist {
                id: row.get(0)?,
                vk_id: row.get(1)?,
                name: row.get(2)?,
                link: row.get(3)?,
                description: row.get(4)?,
                followers: row.get(5)?,
                last_activity: row.get(6)?,
                music_links: row.get(7)?,
                contacts: row.get(8)?,
                avatar: row.get(9)?,
                raw_data: row.get(10)?,
                status: row.get(11)?,
                notes: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(artists)
}

#[tauri::command]
pub fn db_get_artist(
    state: tauri::State<AppState>,
    id: String,
) -> Result<Option<Artist>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, vk_id, name, link, description, followers, last_activity, \
             music_links, contacts, avatar, raw_data, status, notes, created_at, updated_at \
             FROM artists WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(rusqlite::params![&id], |row| {
            Ok(Artist {
                id: row.get(0)?,
                vk_id: row.get(1)?,
                name: row.get(2)?,
                link: row.get(3)?,
                description: row.get(4)?,
                followers: row.get(5)?,
                last_activity: row.get(6)?,
                music_links: row.get(7)?,
                contacts: row.get(8)?,
                avatar: row.get(9)?,
                raw_data: row.get(10)?,
                status: row.get(11)?,
                notes: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })
        .map_err(|e| e.to_string())?;

    if let Some(row) = rows.next() {
        Ok(Some(row.map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn db_update_status(
    state: tauri::State<AppState>,
    id: String,
    status: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE artists SET status = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        rusqlite::params![&status, &id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_update_notes(
    state: tauri::State<AppState>,
    id: String,
    notes: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE artists SET notes = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        rusqlite::params![&notes, &id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_delete_artist(
    state: tauri::State<AppState>,
    id: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM history WHERE artist_id = ?1", rusqlite::params![&id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM artists WHERE id = ?1", rusqlite::params![&id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── History ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_save_history(
    state: tauri::State<AppState>,
    history: HistoryRecord,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO history (artist_id, type, content) VALUES (?1, ?2, ?3)",
        rusqlite::params![&history.artist_id, &history.record_type, &history.content],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_get_history(
    state: tauri::State<AppState>,
    artist_id: String,
) -> Result<Vec<HistoryRecord>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, artist_id, type, content, created_at \
             FROM history WHERE artist_id = ?1 ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let records = stmt
        .query_map(rusqlite::params![&artist_id], |row| {
            Ok(HistoryRecord {
                id: row.get(0)?,
                artist_id: row.get(1)?,
                record_type: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(records)
}

// ─── Settings ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn db_set_setting(
    state: tauri::State<AppState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        rusqlite::params![&key, &value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn db_get_setting(
    state: tauri::State<AppState>,
    key: String,
) -> Result<Option<String>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;

    let mut rows = stmt
        .query_map(rusqlite::params![&key], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;

    if let Some(row) = rows.next() {
        Ok(Some(row.map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn db_get_stats(state: tauri::State<AppState>) -> Result<serde_json::Value, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;

    let total: i64 = conn
        .query_row("SELECT COUNT(*) FROM artists", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let by_status: Vec<(String, i64)> = {
        let mut stmt = conn
            .prepare("SELECT status, COUNT(*) FROM artists GROUP BY status")
            .map_err(|e| e.to_string())?;
        let iter = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
            .map_err(|e| e.to_string())?;
        iter.collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?
    };

    let status_map: serde_json::Map<String, serde_json::Value> = by_status
        .into_iter()
        .map(|(k, v)| (k, serde_json::Value::Number(v.into())))
        .collect();

    Ok(serde_json::json!({
        "total": total,
        "by_status": status_map
    }))
}
