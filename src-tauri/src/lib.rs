mod models;
mod db;
mod commands_db;
mod commands_vk;
mod scout_db;
mod scout_vk;
use models::AppState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let conn = db::init_db(app.handle()).expect("Failed to initialize database");
            app.manage(AppState {
                db: Mutex::new(conn),
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // VK
            scout_vk::open_url,
            commands_vk::vk_test_token,
            commands_vk::vk_search,
            commands_vk::vk_get_group,
            commands_vk::vk_get_user,
            commands_vk::vk_get_wall,
            commands_vk::vk_get_members,
            commands_vk::vk_newsfeed_search,
            scout_vk::vk_search_v3,
            scout_vk::vk_get_wall_v3,
            scout_vk::vk_newsfeed_search_v3,
            scout_vk::scout_test_token,
            scout_db::scout_get_records,
            scout_db::scout_save_records,
            // DB - Artists
            commands_db::db_save_artist,
            commands_db::db_get_artists,
            commands_db::db_get_artist,
            commands_db::db_update_status,
            commands_db::db_update_notes,
            commands_db::db_delete_artist,
            // DB - History
            commands_db::db_save_history,
            commands_db::db_get_history,
            // DB - Settings
            commands_db::db_set_setting,
            commands_db::db_get_setting,
            commands_db::db_delete_setting,
            commands_db::db_get_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
