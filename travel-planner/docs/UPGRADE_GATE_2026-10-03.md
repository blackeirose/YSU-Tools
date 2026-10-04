# Travel Planner UX / Gemini upgrade — Full Gate

## Current decision — 2026-10-03 23:40 PDT

**Full Gate NOT PASS. Keep production deploy `6ac0989e1e8fabf48ee75360`.** The latest source-matched [isolated complete-host Preview](https://6ac1f354869e054bf09986c9--ycsu-tools-router.netlify.app/travel-planner/) is Netlify `6ac1f354869e054bf09986c9`, product runtime `d6e3a6e73d871ae2590cc6de7c33177cd8eda8d3` on [Draft PR #3](https://github.com/blackeirose/YSU-Tools/pull/3), publisher remote `08ce504428baa9a91c685b8a0d077558c1858c5d` on [Draft PR #23](https://github.com/blackeirose/social-capture-tool/pull/23). [Product source-matched CI 37182864577](https://github.com/blackeirose/YSU-Tools/actions/runs/37182864577) passed typecheck, tests, build and Auth/rules/two-context emulator; publisher local suite passed 75 tests with one existing skip. Complete-host remote validation passed 326 static files, nine Functions with six retained siblings, protected routes, traffic and schedule, scoped PWA, and anonymous AI/background 401. Baseline production was re-read before assembly and remained unchanged after draft validation.

The exact Preview hostname was added to Firebase Authorized Domains and read back. In two independent browser contexts (Chrome and Codex in-app browser), normal Owner Google popup login reached `已同步`: IAB added a synthetic item, Chrome received it; Chrome edited its note, IAB received it, and direct deep-URL refresh retained the item. A prior isolated Preview verified a real Gemini text action with explicit disambiguation and user confirmation. The **current** `d6e3a6e` Preview has not passed paid AI acceptance: earlier Explore returned `建議來源無法核對`, background landmark verification failed, and the present conservative daily reservation limit now refuses further generation. The bilingual name fallback and false-alias protection pass 27 focused tests and independent source review, but live sourced Explore, voice, vision, generated panels, Blob cross-context readback and real cloud offline/reconnect remain **UNVERIFIED**. 390/320px cloud views showed an itinerary without horizontal overflow; true 200% browser zoom and physical iPhone remain **UNVERIFIED**.

The current API provider is Netlify AI Gateway; Google AI Pro credit offset has not been verified. The Planner server reserves a conservative US$1/day estimate before paid inference, which is not a provider bill hard cap. Do not increase that ceiling to turn a failed test green. Production `v1` rules must be freshly compared, applied and read back only after the missing live checks pass. The publisher now rejects a production receipt without a source-matched Full Gate claim, but this receipt is self-reported; an operator must verify the actual evidence and Preview deploy/source independently. Preview receipts remain ineligible for promotion. Preserve the old-origin IndexedDB pending/conflicts; never clear site data or restore a historical whole-site artifact to recover.

| Area | Current disposition |
|---|---|
| R1 desktop workspace | Preview board/map and 1440px inspected; PASS within browser scope. |
| R2 mobile/editing | 390/320px first item visible, no horizontal overflow; actual 200% zoom and physical iPhone UNVERIFIED. |
| R3 move/date feedback | Earlier live Preview move/Undo and current cross-day card selection passed; no new regression observed. |
| R4 zones | Source/unit/DST coverage PASS; full live cross-city reservation QA UNVERIFIED. |
| R5 search/map | Real Photon selection and map link passed on an earlier Preview; latest no-coordinate quick add and deep refresh passed. |
| R6 Gemini | Real typed action passed on earlier Preview; latest sourced Explore/audio and end-to-end error recovery NOT PASS/UNVERIFIED. |
| R7 import | Local CSV/PDF and schema tests PASS; real image vision and full cloud rollback UNVERIFIED. |
| R8 shrink/pending | Emulator/source preservation PASS; real cloud offline reconnect and old-origin pending recovery UNVERIFIED. |
| R9 overlaps | Local model/browser fixed-time protection PASS; current live overlap QA UNVERIFIED. |
| R10 background | Source/mock and independent landmark checks PASS; prior real attempt failed, current quota blocks retry; generated Blob NOT PASS. |

The sections below are historical checkpoints; their statements about zero paid calls or unavailable Owner login do not describe this current Preview.

## Historical source-matched checkpoint — 2026-10-03 17:35 PDT

- Product `5f68efc8459f471c7862443a4c3c5853d908fa1f` / [Draft PR #3](https://github.com/blackeirose/YSU-Tools/pull/3); [emulator CI 37164213423](https://github.com/blackeirose/YSU-Tools/actions/runs/37164213423) PASS. Publisher `b7d47248953240e14e570fb941390336cfaa80d6` / [Draft PR #23](https://github.com/blackeirose/social-capture-tool/pull/23); [merged-rule CI 37164496703](https://github.com/blackeirose/social-capture-tool/actions/runs/37164496703) PASS. Local 82 unit PASS, Chromium 55 PASS / 9 intentional skips at desktop/mobile, publisher 75 PASS / 1 skip.
- [Complete-host synthetic Preview](https://6ac19dbe1e7f0157bfeef08e--ycsu-tools-router.netlify.app/travel-planner/) `6ac19dbe1e7f0157bfeef08e` ready; canonical remote validation PASS for 326 static, nine Functions, six exact siblings, routes, schedules, traffic, PWA and anonymous AI/background 401. Baseline and post-draft production deploy `6ac0989e1e8fabf48ee75360` unchanged.
- Firebase live shared rules were reread before append at `af4473b0...`; only Planner `preview-v1/aiRequests` was appended; console publish/reload/readback equals reviewed full candidate SHA256 `b54ab8328edd8d88c28eb0ba7bf03fd44aff7171c0043231751c07fd676bc9c5`. Only this exact Preview hostname was added to Auth domains.
- Two independent read-only source reviewers found no remaining P1/P2 in request dedupe, fixed booking mutation guard, stored zone/ICS, and complete-host isolation for **synthetic Preview scope**. They did not independently test live Auth or paid Gemini. The mobile first screen still has substantial trip/date chrome; real-device usability remains open.
- Real Preview Google popup in TOWER remained pending; affected Chrome's earlier Firebase-handler certificate privacy error has no proven cause. Authenticated Owner dual contexts, cloud offline/reconnect, actual paid Gemini/vision/voice/background and Blob readback remain UNVERIFIED. Confirmed paid upgrade calls: zero. Production `v1` has no `aiRequests` rule; production AI must remain disabled until reviewed/applied and live integration verified. Full Gate **NOT PASS**; Preview permanently ineligible for promotion.

The earlier `42cf4cb` checkpoint below remains as history and is superseded by this section. Keep private IndexedDB pending/conflicts and reassemble only Planner against the then-current complete host for recovery.

Status: ISOLATED PREVIEW READY FOR SYNTHETIC LOCAL TRIAL; FULL GATE NOT PASS. Production remains the 2026-10-02 release.

## Historical source-matched checkpoint — 2026-10-03

- Product runtime source: `blackeirose/YSU-Tools` Draft [PR #3](https://github.com/blackeirose/YSU-Tools/pull/3), remote commit `42cf4cbe95cfdcc40f9cec2322f9afa9a8763c66` (same runtime tree as local `f04b2d0`). [CI 37162263860](https://github.com/blackeirose/YSU-Tools/actions/runs/37162263860) PASS: 79 unit tests and source-matched Firebase emulator/browser integration.
- Publisher source: `blackeirose/social-capture-tool` Draft [PR #23](https://github.com/blackeirose/social-capture-tool/pull/23), remote commit `f438e47de8c83de192ffaef609d19ae4189a3875` (same publisher tree as local `d4f71c2`). [CI 37162294923](https://github.com/blackeirose/social-capture-tool/actions/runs/37162294923) PASS: merged rules and 75 publisher tests.
- Complete-host [isolated Preview](https://6ac1921df800e63bc4e905cb--ycsu-tools-router.netlify.app/travel-planner/): deploy `6ac1921df800e63bc4e905cb`, `ready`, `deploy-preview`, 326 static files and nine functions (six retained sibling functions plus three Planner-only functions). Canonical remote `validate` PASS for source hashes, protected sibling bytes, routes, schedules, traffic and scoped PWA. Anonymous Planner AI/background routes return 401 after the function loads. This proves loading and the unauthenticated boundary, not a Gemini call.
- Preview-only Firebase rules for `preview-v1` were additively published and read back at SHA256 `af4473b0dbc319bdb4a703a89c3e2e5714c5991d581609f7f68227188c71f470`. The exact Preview hostname alone was added to Firebase Authorized Domains. Production `v1` and sibling permissions were not changed. The production Netlify deploy was re-read after Preview validation as `6ac0989e1e8fabf48ee75360`.
- In the current Preview, synthetic local Tokyo opened at a direct deep URL and survived refresh. A 390×844 browser viewport moved the 1/7 item to 1/8, showed destination-day feedback, undid it and retained the original item after refresh. At 1440×900, the day board and two ordered markers appeared; document width 1425 equaled client width 1425. Local mode explicitly states it does not sync across devices. These checks do not establish real cloud sync.
- Independent reviewers `/root/review_travel_risks` and `/root/review_upgrade_risks` separately reviewed the R7 denied-write retry and self-contained Function packaging respectively, then marked their **source scopes** PASS/no remaining P1/P2. They did not approve the overall Full Gate or a live authenticated AI result.
- Google popup sign-in on this Preview did not complete in the TOWER in-app browser or Chrome attempt; no credential extraction or TLS bypass was used. Owner's earlier Windows Chrome certificate error is a separate observed condition, with root cause unproven. Real Preview Owner cloud CRUD, two independent browser contexts, real Gemini text/audio/vision, durable generated background and cross-device image readback remain UNVERIFIED. Actual paid upgrade API calls: zero confirmed; actual charges/credit offsets unknown.

The older F0/F1 local checkpoint below is retained as development history. Where it says Preview, emulator CI or rule application was still open, this latest checkpoint supersedes that status. Production release is gated on the remaining real integration and Full Gate checks; do not promote this synthetic Preview.

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

