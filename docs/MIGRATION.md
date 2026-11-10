# Safe data migration and recovery

The existing application identifier and `ai_music_scout.db` filename are preserved. On first v3 initialization, SQLite `VACUUM INTO` makes `ai_music_scout.before-v3.db` in the application data directory, including committed WAL data. If backup creation fails, initialization fails without running the v3 migration. Existing backup is never overwritten.

`src-tauri/migrations/003_opportunities.sql` adds only the `scout_records` table/index. Existing artists, history and settings are preserved. Writes of v3 records use a single SQLite transaction; invalid input rolls the transaction back. No database is dropped. Source text and event histories live within the versioned JSON record body. Browser v3 uses a separate localStorage key and retains the preceding raw snapshot in `asv_scout_v3_records_backup`; quota/write failures surface to the operator.

Use CRM → JSON before upgrades. CSV is for viewing and includes spreadsheet formula escaping. JSON import merges new identities and leaves existing records unchanged, preserving newer notes/status/history. Corrupt input stops instead of silently filtering or overwriting data. Duplicate scans preserve notes and statuses.

“Import old CRM” works in web and Tauri. It preserves legacy status, notes and interaction history, and distinguishes `group:42` from `user:42`. If a custom URL/legacy raw record cannot establish account type, the record is left untouched in Archive CRM rather than guessed. Imported records start without commercial evidence/score.

For rollback: close all app instances; copy the current database and its WAL/SHM files as an additional backup. Restore `ai_music_scout.before-v3.db` as `ai_music_scout.db` only after archiving the current files, or run the previous application against a copy. Old records remain in the current database and old versions ignore the extra table. Restoring the pre-v3 backup loses v3-only changes, so export them first. Browser rollback can leave all v3 keys intact; old CRM remains under its old key. Clearing browser storage deletes local data.

Older versions stored a VK token unencrypted. v3 removes the old active setting during load, stores the new token only in memory, and does not silently reuse the old credential. Old backups may still contain the old token; revoke it and protect backups. No credential values should be posted to GitHub.
