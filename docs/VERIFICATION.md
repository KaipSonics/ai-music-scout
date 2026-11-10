# Verification (2026-11-10)

Actual local checks:

- `npm ci --ignore-scripts`: passed (97 original dependencies installed). Playwright added with npm; lockfile updated.
- `npm test`: passed, 16 detector/scoring checks + 17 regression tests; SQLite migration/backup/idempotence/preservation/transaction-rollback test passed with real Python sqlite3.
- `npm run typecheck`: passed.
- `npm run build`: passed, Vite production web bundle built.
- `npm run build:desktop`: passed, frontend bundle with relative asset paths for Tauri (not a native Rust build).
- `cargo check --manifest-path src-tauri/Cargo.toml`: attempted, unavailable (`cargo: command not found`). Not a passing native check.
- Playwright desktop (1440×1000) and mobile (390×844): attempted, all four stopped before execution because the environment prohibited Chromium's process socket. Cloud browser could not reach the isolated local server. No visual pass or screenshots claimed locally.
- Live VK: not run; no authorized token was supplied. API error/invalid envelope/network/rate-limit tests use explicit fixtures, never represented as live responses.

GitHub Actions is configured to run Node checks, real Chromium UI scenarios and Linux Tauri `cargo check --locked`. Its results must be read from the feature commit/PR; this document does not predeclare those jobs successful. No native Windows/macOS build or packaged application install has been tested locally.

Coverage includes direct service needs, no demand, stale/future posts, reposts/ads/canceled requests, author mismatch, audience independence, scoring sum, safe outreach, disabled obsolete AI, malformed JSON, missing token/network and VK error codes, empty results, stable deduplication, concurrent browser writes, notes/status/history/revenue, loss after reply, recheck downgrade, expiry, corrupt CRM, import non-overwrite, legacy namespaces and SQLite backup/rollback.

GitHub publication: initial branch creation was rejected with HTTP 403 because the Connector was authorized but not installed. After the owner installed it, creation of `feature/scout-3-work-integration` was confirmed. Remote CI results must be checked on the PR; the local results above do not predeclare remote checks successful.
