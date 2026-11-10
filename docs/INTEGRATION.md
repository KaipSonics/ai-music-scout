# Architecture: original Scout UX, rewritten engine

UI reference: upstream Scout 2.0 at `700cad8709b76f07414048fce1b0c869f207d4ea`. All three original pages, shell, navigation, CRM kanban/list, fonts, icons and scoped component styling are retained. Old false AI/free-key promises and unsafe OAuth shortcut are replaced with truthful labels in the same controls. Hot/Growth and expandable evidence fit inside original search cards; no separate radar dashboard or second CRM remains.

Layers:

- `views/*` and original styles: familiar Vue screens and user actions.
- `stores/search.ts`: one cancellable session, explicit states, filters and ephemeral results. Saving is an explicit user action.
- `scout/discovery.ts`: bounded sequential official queries, owner enrichment, fallback to community walls, attribution and diagnostics. Caller cancellation propagates to fetch/delays; late replies do not replace current results. Native HTTP completes or times out after caller cancellation but cannot mutate UI/CRM.
- `scout/opportunity.ts`: pure evidence validation, relevance, need, freshness, service fit, confidence and deterministic priority. Cyrillic service boundaries, duplicate input, ads, reposts, resolved requests and unrelated live-sound jobs are handled conservatively. Third-party/unknown authors are unscored. No LLM output is accepted as evidence.
- `scout/vk.ts`, `network.ts`: normalized browser/backend/native transport, token type selection, abort/timeout/redacted errors. Profile IDs must match the post owner.
- `scout/persistence.ts`: canonical v3 JSON records, transactional SQLite adapter, browser locks/backup, preserved events and stale-evidence re-evaluation. Profile edits are stored separately from observed API metadata.
- `scout/crm.ts`: original artist-model compatibility adapter. Existing SQLite/localStorage artists remain accessible beside v3 records in the same board/profile. No automatic destructive conversion.
- `server/app.mjs`: authenticated fixed-method VK relay and static hosting. See SERVER.md.

No auto-messages, no runtime bundled API credentials. Opportunity score = round(need×.35 + timing×.25 + fit×.20 + activity×.10 + contact×.10). Subscribers do not contribute. Evidence reliability is separate from priority and shown alongside source quotes, owner/author/date and factors. Hot precedes Growth. An API-attributed post is not proof of real-world identity or a calibrated purchase probability.

Search uses deterministic first pages with bounded limits. Deep pagination, multi-order accounting, background push and shared server-side CRM are not implemented. Official permissions and actual VK availability constrain results; no scraping or platform bypass is used.
