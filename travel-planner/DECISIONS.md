# Decisions

## Release decision — 2026-10-03

The new complete-host Preview is a synthetic `deploy-preview` at `6ac1921df800e63bc4e905cb`. Its Firebase hostname authorization and `preview-v1` Owner rules are confined to this Planner test scope. Product and publisher CI, independent source reviews and protected-host validation pass, but TOWER's normal Google popup did not complete. Anonymous Planner Function 401s verify entry/auth rejection, **not** real Gemini execution. The Owner's conditional production authorization has not become an unconditional promotion: retain the current `6ac0989e1e8fabf48ee75360` production deploy until authenticated cloud, paid assistant/vision/background and data recovery gates are verified. Continue to keep Planner free of Supabase and leave sibling tools, DNS, MAIN and Tracker unchanged for this upgrade.

## SUPERSEDING UPGRADE DECISIONS — 2026-10-03

- This upgrade replaces the older blanket statement below that AI cannot modify an itinerary. The Owner now permits clear, single-item voice or text instructions to yield **typed actions**; the app validates ownership, record revision, date, fixed booking and Undo before applying them. Vague requests, large batches, imports and complete drafts need a preview/confirmation. AI never books, pays, sends messages or acts without the user's instruction.
- The product stays at `/travel-planner/` on the existing Firebase Auth/Firestore architecture. Isolated feature work may be released once the **Full Gate** passes; the current production release is the last known good until then. No direct Planner-dist deployment, DNS change, sibling overwrite, Supabase in Planner or Tracker/MAIN update belongs to this upgrade.
- Daily cities are optional additive fields on Trip. First-day confirmed city and location identify a trip background. Date shortening retains out-of-range items as detached candidates and preserves original scheduling/reservation metadata; expanding dates does not silently restore them.
- Photon provides constrained external location lookup with debounce and source attribution. Public Nominatim is not used as unbounded autocomplete and Google Places data is not plotted on Leaflet.
- Gemini text/vision and image generation run only through owner-scoped Planner functions, server-side credentials and pre-call quotas. A quota in counts is a conservative guard, not a proven US-dollar cutoff; pricing and actual Gateway route must be checked before paid Preview or production enablement. Durable backgrounds use Planner-only Blob keys and a two-panel adaptation of Owner Skill YSU-SKILL-021 v1.0.0. No generated result is claimed until a real call and storage/readback pass.
- Source-matched emulator, authentic Preview, independent review and complete-host preservation are release gates. Local Chromium viewport tests or same-context tabs do not substitute for real dual-context cloud/offline verification or a physical iPhone.

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
