# Verification — original UX engine rewrite (2026-11-10)

## Local execution

- npm test: 16 classifier/scoring checks, 17 regression cases, 9 engine/backend/CRM cases, plus real SQLite migration/backup/idempotence/rollback validation. Backend tests exercise real localhost HTTP with mocked upstream VK.
- TypeScript and production builds for web and desktop frontend executed during development. CI rechecks the final revision.
- npm audit: 0 vulnerabilities at the last local audit.
- Local Chromium launch remains blocked by environment sockets and cargo is unavailable. Native and real Chromium checks therefore run in GitHub Actions; see the latest checks on PR #1 for final revision results.

## Browser acceptance scenarios supplied to CI

Desktop 1440×1000 and mobile 390×844:

1. Original three-section navigation, original kanban/list, demo isolation, evidence expansion and editable draft.
2. MOCK VK end-to-end: configure session → search Hot/Growth → source popup → explicit CRM save → original artist card → manual contact popup → reply/negotiation/paid order → note and reminder → reload → JSON export. No messages are sent by the app; external pages are mocked in this test.
3. MOCK invalid-token error, cancellation of a slow request and empty results without fictional leads.
4. Paired original/final Search, CRM and Settings screenshots at identical viewports. The baseline is checked out from the specified original commit; its historical embedded credential is removed in the isolated test fixture before serving. Network calls from comparison pages are blocked.

Screenshots and failure traces are retained in the scout-ui-results Actions artifact. Tests do not constitute a live VK test.

## VK schema audit

Official primary schema reviewed: https://github.com/VKCOM/vk-api-schema (`newsfeed/methods.json`, `wall/methods.json`, `groups/methods.json`). Declared token types: newsfeed.search and wall.get — user/service; groups.search — user; groups.getById — user/group/service. groups.search does not supply arbitrary extended profile fields, so profiles are enriched through groups.getById. Extended posts/profiles/groups and both array/object group responses are normalized. Direct developer documentation pages were unavailable to the browsing environment. Schema support is not a guarantee of present permissions for a particular VK application/token or API version.

No authorized VK token was provided: live discovery, real method access for a specific token, and actual browser VK CORS are unverified. The optional API server is implemented and tested locally but has not been production-deployed. Windows/macOS packaged installers are untested. Do not merge or deploy without the owner's confirmation.
