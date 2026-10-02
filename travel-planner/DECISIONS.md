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
- Shared-host assembly must go through the existing release authority. This folder prepares static component files and scoped route/header suggestions only; it does not modify that authority or publish the shared host.

Reconsider implementation details only within user scope and current canonical rules. Changing locked boundaries requires explicit Owner instruction.
