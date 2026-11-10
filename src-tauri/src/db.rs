use rusqlite::{Connection, Result};
use tauri::{AppHandle, Manager};

pub fn init_db(app_handle: &AppHandle) -> Result<Connection> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::path::PathBuf::from("."));
    std::fs::create_dir_all(&app_dir).unwrap_or_default();
    let db_path = app_dir.join("ai_music_scout.db");

    let conn = Connection::open(db_path)?;

    conn.execute_batch("PRAGMA journal_mode=WAL;")?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS artists (
            id          TEXT PRIMARY KEY,
            vk_id       TEXT UNIQUE,
            name        TEXT NOT NULL,
            link        TEXT,
            description TEXT,
            followers   INTEGER DEFAULT 0,
            last_activity TEXT,
            music_links TEXT,
            contacts    TEXT,
            avatar      TEXT,
            raw_data    TEXT,
            status      TEXT DEFAULT 'new',
            notes       TEXT DEFAULT '',
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS history (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            artist_id   TEXT NOT NULL,
            type        TEXT NOT NULL,
            content     TEXT NOT NULL,
            created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(artist_id) REFERENCES artists(id)
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    let migrated: i64 = conn.query_row("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='scout_records'", [], |r|r.get(0))?;
    if migrated == 0 {
        let backup = app_dir.join("ai_music_scout.before-v3.db");
        if !backup.exists() { conn.execute("VACUUM INTO ?1", [backup.to_string_lossy().as_ref()])?; }
        conn.execute_batch(include_str!("../migrations/003_opportunities.sql"))?;
    }
    Ok(conn)
}
