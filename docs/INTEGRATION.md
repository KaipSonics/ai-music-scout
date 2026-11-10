# Integration audit and architecture

Base: `700cad8709b76f07414048fce1b0c869f207d4ea` on upstream main.
The handoff ZIP was inspected as a separate reference implementation. It was not copied over the project.

Preserved: Vue/Pinia/Tauri project, application identifier, database filename, original `artists/history/settings`, original Dune Rise assets and icons, legacy CRM board, JSON transfer, artist profile and history routes. `/search` now uses the evidence-first radar; `/legacy-crm` retains the previous CRM. One router is used by main.ts.

Reused and adapted from handoff: opportunity model, sequential discovery, radar, CRM and analytics layouts. Added strict author matching, no scoring of manual evidence, stale-score expiry, identity-safe legacy import, concurrency-safe browser updates and real persistence tests.

Removed obsolete AI search/profiling command implementations with fabricated positive fallbacks. Legacy artist profiles link to the radar instead of showing obsolete AI controls; old AI command calls fail explicitly. No paid AI service is necessary. Legacy editable templates remain available to artist profiles. Outreach never claims audio was heard.

Shared business logic lives in `src/scout`: both browser and Tauri call the same TypeScript classifier, validator and scorer. The desktop Rust layer only transports VK requests and persists records. Calls are sequential, bounded (up to 12 Hot phrases, 6 Growth phrases and 50 walls, UI defaults 4/4/12), throttled by 370 ms and timeout-bound. No random offsets, scraping, proxy bypass or automatic messages.

## Evidence and priority

A direct request requires an original, non-advertising, non-canceled post under 30 days old. Growth signals use original release posts under 60 days or at least three distinct original posts under 45 days with musical context. Source owner AND author must equal the candidate owner. Unknown authors remain unscored Watch records. News/repost communities are excluded conservatively. Language matching is heuristic, not proof of identity or independence.

`source_only` means VK returned an original attributed post; it does not establish real-world identity or purchase intent. Manual text stays `needs_review`, with a null score. Quotes, source owner, author, publication/capture times and links are inspectable in the card.

Opportunity score = round(need×.35 + timing×.25 + fit×.20 + activity×.10 + contact×.10). No subscriber contribution. Factors are shown in the card. This score is a prioritization rule, not a purchase probability. Handled statuses are hidden by default. Hot leads with attributed API evidence sort before Growth. Existing evidence expires on load; a successful canceled/no-signal wall recheck removes the previous priority. A failure never creates a lead.

## Persistence

See [MIGRATION.md](MIGRATION.md). CRM history is retained rather than truncated; note changes retain text, status and amount changes are journaled. Contact/reply counters survive a later Lost status. Revenue includes current Won records only. One record represents an artist/project and its current opportunity, not multiple independent orders; multiple-order accounting is out of scope. Notifications are in-app reminders, not background push.

## Honest limitations

No authorized VK token was available in development, so live discovery is not certified. `users.get` validation does not grant/validate `newsfeed.search` or `wall.get` permissions. Browser CORS may prevent direct API calls; use Tauri where permitted by VK. Do not expose tokens via URLs or share them in issue reports. Desktop multi-process editing is not synchronized; use one instance. A shared authenticated server is not implemented.
