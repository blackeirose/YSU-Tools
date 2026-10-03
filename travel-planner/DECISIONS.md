# Decisions

## LOCKED — User instruction, 2026-10-02

- New product lives in `blackeirose/YSU-Tools/travel-planner` on an isolated feature branch. Preserve every existing root/sibling file.
- No Supabase in any role. Firebase Auth + Firestore is the intended optional private synchronization path, with explicit authorized project configuration and owner rules.
- Intended route is `/travel-planner/`; no alternative production domain, DNS changes, MAIN/Tracker registration, production deploy or merge to publishing branches in this task.
- Desktop parallel days and mobile Today support manual planning. AI cannot modify the itinerary, book or send messages automatically.
- Missing AI/cloud/push resources do not block core local product implementation. Report integration-specific blockers honestly.

## IMPLEMENTED — Product choices

- React/TypeScript/Vite for the new frontend; IndexedDB local demo rather than a static mock. No existing application was rebuilt.
- Cloud writes use record revision compare-and-swap, atomic operation batches and tombstones. Offline conflicts preserve local intent and latest remote alternative; explicit choice, no last-write-wins entire-trip overwrite.
- Undo rejects intervening modifications. JSON imports validate and preview, then assign new IDs; never silently replace existing trips.
- IANA timezones via Temporal, reject ambiguous/nonexistent DST wall times. UTC ICS timestamps represent actual instants, stable UID per original entity, alarms and cross-zone arrival. Calendar import is a snapshot.
- Leaflet + OSM ordinary interactive tiles with attribution, no public autocomplete and no offline/bulk prefetch. Unknown coordinates remain null; Maps viewport center is not treated as place location.
- Optional AI server function uses current Responses API web search documentation, explicit model configuration and cited-source validation. Without settings the UI is disabled, no fake suggestions.
- Background Web Push is not implemented without an authorized scheduler/subscription backend. Foreground reminders are explicitly described as app-open only.
- Shared-host assembly must go through the existing release authority. The continuation explicitly authorizes its isolated feature branch and a complete draft preview, preserving all latest accepted neighboring bytes/functions/routes/traffic/cron. Planner-only dist upload, production promotion and publishing-branch merges remain prohibited.

## CONTINUATION — Cloud preview authorization, 2026-10-02

- Dedicated `preview-v1` reuses the existing personal Firebase project and verified-Google Owner helper. The minimal additive rules were tested against the complete shared baseline, independently reviewed, then applied and read back with the same hash. No production `v1` or sibling access was added.
- Manual demo-only GitHub Actions provides Java/emulators without installing a JVM on the managed workstation. It uses no production Firebase/Netlify credential.
- Shared-host baseline is the latest accepted release, not obsolete default main. Exact retained static/function artifacts are required. Unknown CA traffic policy blocks draft creation before any upload.
- Active Auto-review handles eligible sandbox requests; it does not remove network, filesystem, company or browser confirmation boundaries. Do not ask again for already-authorized routine work. Record technical login/tool barriers separately from authorization.

Reconsider implementation details only within user scope and current canonical rules. Changing locked boundaries requires explicit Owner instruction.

## OWNER AUTHORIZATION — production URL and registration, 2026-10-02 21:41 PDT

Owner explicitly requested:「我需要發佈到YCSU上  這樣我才方便測試   發布後並且要更新到TRACKER和MAIN上」

This supersedes the earlier no-production and no-MAIN/Tracker task holds for this release only. The authorized destination remains https://tools.ycsu.cc/travel-planner/. After the production entry is verified, update the Travel Planner records in Tracker and MAIN to the actually verified status. No further generic "may I publish / update the registries?" confirmation is needed.

This is release authorization, not evidence of release or a waiver of data-protection and complete-host validation gates. It does not authorize direct promotion of synthetic preview receipts, DNS/billing changes, broader access, disabling TLS verification, sibling changes, deleting user data, or enabling AI/background Push. Prepare a production-appropriate candidate with separate data scope and the required R7 server enforcement; changes must stay within Planner and preserve shared Owner/sibling policies. Surface a concrete diff if completing this requires broader shared-policy changes.

Canonical execution and environment limits: docs/PRODUCTION_RELEASE_HANDOFF_2026-10-02.md. This branch records authorization/preparation only; it has not been deployed and is not a new LKG.
