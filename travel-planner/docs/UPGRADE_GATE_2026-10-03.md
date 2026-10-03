# Travel Planner UX / Gemini upgrade — Full Gate

Status: IN PROGRESS. No candidate or production release from this branch is accepted yet.

## F0: verified last known good and protected state

- Canonical Core: `blackeirose/ysu-ai-core` `main` `57a69136b7473718dfcf26311ae801f033696f05`, fetched afresh on 2026-10-03. Read AGENTS, AI_CORE and the nine task-relevant development, UI, architecture, services, workspace, agentic, communication, gate and domain documents.
- Current product release branch: `blackeirose/YSU-Tools` `release/travel-planner-v1-20261002` `da3b6a0a5d94a27741e0b0caa0a1e02d7352b47c` (documentation only since runtime `47a78f8d7fe45d65ca7d99ee757e16b65238093f`). Local isolated branch starts from a verified identical tree, `3a8d4c028fab94bdd30124a1e2794551202b50aa`.
- Current publisher release branch: `blackeirose/social-capture-tool` `release/travel-planner-production-20261002` `1b39109f5457ff835d40f3ee8ed02e1e7dbca658`. Local isolated branch starts from identical tree `54b3a9589de8f24451de5842fdd4232e1c8e3eba`.
- Current Netlify site's reported production deploy is `6ac0989e1e8fabf48ee75360`; existing Planner runtime is V1. No new deploy has been made. Publisher is the complete-host `scripts/shared_host_release.py`, never Planner-only `dist`.
- Local release worktrees were clean before isolation. Existing branches, worktrees, private data and sibling tools must not be reset, cleaned or overwritten.
- Existing JSON, ICS, offline queue, tombstones, revisions and pending conflict recovery are protected behaviors. Existing production Google login / real cloud CRUD remain UNVERIFIED; Preview evidence cannot certify them.

## F1: requirement and evidence trace

| ID | Acceptance target | Risk | Status / evidence |
|---|---|---|---|
| R1 | Compact desktop working area; map collapse, ratio, single/multiday; 1440×900 and 1366×768 | usability | LOCAL PASS: Chromium browser widths and map collapse/restore; [1440](evidence/upgrade-2026-10-03-1440.png), [1366](evidence/upgrade-2026-10-03-1366.png). Remote Preview open. |
| R2 | View/edit separation; drawer, saved-close, 390/320px, 200% zoom and keyboard | usability/data loss | PARTIAL: mobile 390/320 layout and detail-move browser flows; [390](evidence/upgrade-2026-10-03-390.png), [320](evidence/upgrade-2026-10-03-320.png). 200% zoom/physical iPhone UNVERIFIED. |
| R3 | Actual date stays visible after move, sync/Undo feedback | confusion/data loss | LOCAL PASS: desktop mouse/keyboard and mobile detail move/Undo/reload. Real cloud sync OPEN. |
| R4 | Day city/region and IANA zone; batch assignment, legacy ambiguity, DST | temporal/data | LOCAL PASS: Honolulu and DST unit/browser cases; real cross-device propagation OPEN. |
| R5 | Legal external place search/autofill, manual fallback, map sync | service rights/data | LOCAL PASS: real Photon Disney search → item → marker. Preview CSP and service availability OPEN. |
| R6 | Gemini text/short voice, typed actions, budget/owner/idempotency, sourced exploration | paid API/security | CODE PASS / INTEGRATION UNVERIFIED: tests use mocked provider; no real authorized Gemini call, microphone or sourced result accepted yet. |
| R7 | XLSX/CSV/PDF/image import with page/sheet selection, preview and duplicate guard | privacy/data loss | PARTIAL: deterministic XLSX/CSV unit, browser CSV/PDF page exclusion/duplicate/stale-file; real image vision and large import/cloud rollback OPEN. |
| R8 | Date extend/shrink → visible candidate, reservation/reminder retention, Undo and cloud consistency | data loss | LOCAL PASS: unit/browser shrink, reload, expand, candidate retention. Source-matched emulator/old pending OPEN. |
| R9 | Exact overlaps retained with visible alternatives and fixed-time protection | temporal/usability | LOCAL PASS: unit model and browser fixed-time delay; remote acceptance OPEN. |
| R10 | Desktop city background from approved style Skill; one durable generation, cost guard | paid API/privacy | CODE PASS / INTEGRATION UNVERIFIED: two-panel Skill adaptation, mocked job/CAS tests; no real generated/persisted image. |
| GATE | Two-context sync, offline/reconnect, old pending, Auth, JSON/ICS, PWA, sibling hashes/routes, independent review, isolated Preview, prod QA | release | PENDING |

PASS requires changed-risk tests, real browser behavior and source-matched remote evidence. Build-only or mock-only verification does not close an integration row.

Local checkpoint on 2026-10-03: `pnpm typecheck` PASS, `pnpm build` PASS (169 transformed modules, scoped 15-resource PWA shell), `pnpm test` 67/67 PASS, Planner function bundle check PASS (3 exact functions). Publisher component tests 13/13 PASS. Final Chromium run reached 52 PASS, 9 intentional desktop-only mobile skips, one mobile candidate-card test still aimed at a hidden inline action; the corrected real detail-drawer flow passed separately (effective 53/53 executed workflows). The final source-matched build and remote checks remain open. No live AI, Blob, Firebase dual-context, emulator CI or isolated complete-host Preview PASS is claimed.

## F2: boundaries and service findings

- Planner namespace only; no Supabase, sibling writes, DNS, new billing plan, Tracker/MAIN update or company system installation.
- Owner authorizes one full-host production release **after** Preview, real integration, independent review and Full Gate. A failed gate leaves the existing production deployment intact.
- Google Places API results displayed on a map must use a Google Map; they also have storage and attribution restrictions. Planner currently uses Leaflet/OSM. Do not mix Google Places data onto that map. Public OSM Nominatim expressly forbids client autocomplete. Photon upstream documents search-as-you-type and reasonable project use; any chosen integration needs narrow debounce, attribution and real response QA. Sources: [Google Places policies](https://developers.google.com/maps/documentation/places/web-service/policies), [OSMF Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/), [Photon README](https://github.com/komoot/photon/blob/master/README.md).
- Google AI Pro consumer subscription is not presumed to include Gemini API spend. Netlify AI Gateway uses site credits and does not offer a strict AI Gateway dollar cutoff on ordinary plans; the Planner must reserve conservative operation quotas before calls. Sources: [Netlify AI Gateway](https://docs.netlify.com/build/ai-gateway/overview/), [pricing](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/pricing-for-ai-features/), [usage limits](https://docs.netlify.com/build/build-with-ai/manage-ai-for-your-team/manage-ai-features/), [Gemini models](https://ai.google.dev/gemini-api/docs/models), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing).
- Approved style package: Drive folder `YSU-SKILL-021｜攝影 × 精切紙雕雙區海報` v1.0.0, ZIP `YSU-SKILL-021_ysu-photo-paper-diptych_v1.0.0.zip` modified 2026-10-01. Read actual `SKILL.md`, `STYLE_REFERENCE.md`, `QA_CHECKLIST.md`, bilingual prompts and inspected preferred images P08-012 and P08-014. Requires exact 3:4, original target above, precision-paper relief below, 50/50. A single generated concept image alone is not exact compliant output; production background must document its adaptation and cannot claim exact poster layout without two-stage composition.

## F3–F7 checkpoints

- Change model incrementally with optional new fields so old Firestore/IndexedDB/JSON records remain readable. Do not rewrite Owner production records as a migration test.
- Add failing tests around each changed data invariant before repair. Local typecheck/build/unit/browser, source-matched emulator CI for rules, isolated Preview and independent reviewer are required.
- Re-read live complete-host baseline and all Function ZIPs before a candidate. A new Planner Function changes only reviewed Planner manifest/route contracts; all current sibling files, routes, Function modes, traffic rules and schedules remain protected.
- Preserve an exact new source/deploy receipt and then perform limited synthetic production smoke only after the release gates pass. Rollback must reassemble the **then-current** full host and retain private offline pending/conflict data.
