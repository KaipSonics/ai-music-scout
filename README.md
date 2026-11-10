# ASV Scout 3.0

Internal opportunity radar for ASV Production. Finds explicit studio-service requests (Hot) and active music projects (Growth), shows source evidence and transparent scores, and tracks manual outreach in a local CRM.

## Run in a browser

Node.js 24 LTS and npm are required. Python 3 is used by SQLite tests.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite (default `http://localhost:5173/ai-music-scout/`). Use **Demo** to inspect four explicitly fictional leads with no token and no CRM writes. Settings → enter your own authorized VK token → check token → choose Hot/Growth → run radar. Manual post entry is available without API access and always stays unverified/unscored.

VK methods depend on your application's permissions, token type, platform rules and availability. The app shows errors rather than turning them into empty success or demo results. A passed token check only verifies `users.get`. Browser CORS can block VK even with a valid token; Tauri uses a native HTTPS transport. Live VK access has not been verified without an authorized token.

## Desktop: Windows, Linux, macOS

Install a current stable Rust toolchain and [Tauri platform prerequisites](https://v2.tauri.app/start/prerequisites/), then:

```sh
npm ci
npm run tauri dev
# Production packages for the current operating system:
npm run tauri build
```

The original application identifier and SQLite location are retained. Cross-platform bundle targets are enabled; packaging must run on the target OS with its native dependencies. No macOS-only start script is required. Development port is 5173; Vite base remains compatible with the existing GitHub Pages deployment.

## Workflow

- Radar: evidence/source/author/date, Hot/Growth filters, handled toggle, priority/recent sort and editable personal-message drafts. Open VK and send manually.
- CRM: statuses, notes, follow-up date, amount, retained event history, JSON import/export and CSV export.
- Analytics: leads, contact attempts, replies, negotiations, current paid orders/revenue and observed conversions. Small samples do not predict future conversion.
- Archive CRM: original board and artist profiles. Import old contacts into Scout without deleting their original data. Ambiguous user/group identities remain in the archive.

ASV services: mixing + mastering 12,000 ₽; stem mastering 5,000 ₽; instrumental 15,000 ₽; full production from 35,000 ₽; audit 4,000 ₽. Only explicit service needs receive a specific recommendation. No audio-listening claims are generated.

## Checks

```sh
npm test
npm run typecheck
npm run build
npx playwright install --with-deps chromium
npm run test:ui
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

See [actual verification results](docs/VERIFICATION.md), [integration decisions](docs/INTEGRATION.md), [migration/recovery](docs/MIGRATION.md) and [credential rotation](docs/SECURITY.md). The feature PR must be reviewed before merging; no deployment to main is part of this integration.
