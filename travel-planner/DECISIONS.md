## Current background-flow repair — 2026-10-08 UTC

Owner rejected the previous background visual acceptance: two cropped city panoramas repeat vertically, and plain-text new-trip cities never resolve for automatic generation. The previous publication remains production `6ac71868831c850e6b4e185c` / runtime `c1f648e770751a94eeb8d73d213cf70be33b3e1e`; it is NOT acceptance of the requested new-trip background flow.

Current repair uses one complete 16:9 city artwork (explicit horizontal photo-left / precision-paper-right adaptation of YSU-SKILL-021 v1.0.0), an integrated Photon city selector with actual identity/region/coordinates/IANA zone, persistent namespace/owner-separated `poster-v2` jobs and explicit v2 intent. Old private top/lower images are retained without automatic replacement; compatibility displays the old photograph with a legacy label, not a claim that its paper style was repaired. User-triggered upgrade changes display only after the new poster saves successfully. New Preview backgrounds persist across alias deploys; old deploy-scoped Preview images are not silently migrated or regenerated. Production legacy site-scoped images remain readable.

Preflight: canonical Core main `57a69136b7473718dfcf26311ae801f033696f05` read remotely; product parent `4cff8279328f0e8762084f94854f0b4ae9b38796`, authority remote `4912b011ad6dbb17d3e004557a1eadc936cf8e0f`. Clean isolated feature branch preserves siblings. Git auto deployment remains disabled. No shared rules, DNS, providers, services or budget caps changed.

Source review found and repairs cover same-name city/country confusion, city save/navigation races, rejected-start recovery and stale-job accounting. A saved poster after worker crash is reconciled without provider calls; unknown timed-out jobs retain reservations and fail closed pending receipt review. Same-revision HTTP400 is not retried.

Local: typecheck/build PASS; 37 focused unit tests and 2 new-trip browser tests PASS (mocked city failure/choices explicitly fixture-only). Live Photon Osaka selection brought Japan / Asia/Tokyo in the actual local form. Real fresh-UI Osaka generation, independent image/UI review and production release are still PENDING; no paid call has been made by this repair yet.

Budget readback: 29 requests / USD2.85 conservative reservations, NOT actual billing; same `ux-gemini-20261005-usd1` caps USD5.20 total / USD2.00 UTC-day. Remaining USD2.35. Plan maximum USD0.66 = Preview landmarks0.06+poster0.18, production same0.24, one evidence-based poster retry0.18. Existing stages/entries/grants are preserved; the photo accounting stage now covers one whole artwork. Actual bill remains unknown. Unchanged audio/vision/explore/sync evidence and exact Owner offline/200%-zoom/human-mic waiver retain their original source boundaries.

Recovery: retain v2 private objects and intent/data fields, ledger and all pending/conflicts. Prefer a forward Planner-only fix. Any older-code recovery must preserve these new optional fields before editing; reassemble from then-current complete-host baseline, never restore an old whole site.

---

## Historical evidence (the previous visual acceptance was rejected by Owner)

# Decisions

## Current desktop visual release — 2026-10-08 UTC

**Published and visually accepted for Owner review.** [Production](https://tools.ycsu.cc/travel-planner/) is deploy `6ac71868831c850e6b4e185c`, executable [`c1f648e770751a94eeb8d73d213cf70be33b3e1e`](https://github.com/blackeirose/YSU-Tools/commit/c1f648e770751a94eeb8d73d213cf70be33b3e1e), namespace `v1`. [Fixed review](https://travel-planner-review--ycsu-tools-router.netlify.app/travel-planner/) is isolated `preview-v1`, immutable deploy `6ac715f6143c29a26492bcae`, same executable source. Documentation-only commits do not replace either runtime.

Desktop now uses the main workspace for the photography / precision paper-cut pair, with translucent day columns, cards and compact controls; the map remains opaque and clear. Mobile remains solid and does not load desktop background images. A missing first-city position has a nearby setup action; a saved-image failure has a read-only reload action. Existing synthetic private images were reused, with **zero new paid requests**. Actual production 1440×900, 1366×768 and 390×844 views, map open/closed, details, normal refresh, and independent-context move/Undo/readback passed. Independent `/root/desktop_visual_review` source review and actual screenshot review are recorded separately.

Typecheck, production build, **19 background unit + 9 focused browser tests** passed. Prior [CI 37698621712](https://github.com/blackeirose/YSU-Tools/actions/runs/37698621712) is inherited only for unchanged Auth/sync/rules/server paths; it is not a new CI run on this visual commit. Full Gate remains PASS_WITH_OWNER_WAIVER: true single-tab offline/reconnect, actual 200% zoom and human microphone stay UNVERIFIED; physical iPhone/Safari and measured scroll FPS are also UNVERIFIED. No waiver was expanded.

Canonical full-host release retained 307 protected static files and six sibling Functions (326 files / nine Functions total), routes, traffic, headers and schedules. No DNS, Auth provider/rules, sibling product, MAIN or Tracker changes. The AI ledger remains **28 reservations / US$2.79 conservative reserve**, cumulative ceiling US$5.20 and UTC-day ceiling US$2.00; actual provider billing is unknown. See [release evidence and Planner-only recovery](docs/PRODUCTION_RELEASE_2026-10-07.md).

---

## Historical production checkpoint — 2026-10-07

Owner approved cumulative US$5.20 and daily US$2.00 for the *same* durable AI campaign, plus production release after the necessary Gate. Final source [`92f63409df27f2c306141f0c51931163bc25876d`](https://github.com/blackeirose/YSU-Tools/commit/92f63409df27f2c306141f0c51931163bc25876d), [CI `37698621712`](https://github.com/blackeirose/YSU-Tools/actions/runs/37698621712), final complete-host deploy `6ac6d1ec1b7c7996e20be0f8` and postrelease synthetic browser/AI/private Blob smoke pass. The exact waiver `owner-2026-10-07-skip-remote-offline-zoom-voice` permits only real single-tab offline/reconnect, 200% zoom and human microphone UNVERIFIED; it does not turn emulator or synthetic WAV evidence into those checks. Physical iPhone/Safari also remain UNVERIFIED. Preserve private pending/conflicts, `v1` records, all AI reservations and sibling tools in any recovery. The previous `cb4c17f` runtime has an obsolete US$2.60 source cap and would fail paid AI closed against the US$2.79 live ledger; use a reviewed budget-compatible Planner-only repair from the then-current whole-site baseline, never a historical whole-site rollback. [Gate](docs/UPGRADE_GATE_2026-10-03.md) and [release record](docs/PRODUCTION_RELEASE_2026-10-07.md) are authoritative for this release. No Supabase, DNS, shared permission, MAIN or Tracker change.

---

## Historical Full Gate decision — 2026-10-07 20:55 UTC

Keep exact runtime [`cb4c17fa8d6f859632e8a7305881b75a207aa920`](https://github.com/blackeirose/YSU-Tools/commit/cb4c17fa8d6f859632e8a7305881b75a207aa920) at the fixed [review URL](https://travel-planner-review--ycsu-tools-router.netlify.app/travel-planner/), immutable draft `6ac6b032f314895534a99288`. [CI `37683065371`](https://github.com/blackeirose/YSU-Tools/actions/runs/37683065371), focused independent audio-source review and complete-host isolation pass. The preceding real audio request reached the provider but failed the selected-card action; only the correction's source and emulator paths have passed. Do not mark audio PASS or publish until a real action, explicit confirmation, persistence, second-context readback and Undo pass. The same campaign retains 21 entries / US$2.03 conservative reservation against current US$2.60 cumulative and US$1.00 UTC-day caps; the whole remaining bounded test batch needs US$0.59. Additional spend above the current cap is not approved yet; preserve every reservation and unknown charge. Owner's exact waiver is limited to single-tab offline, true 200% zoom and human microphone UNVERIFIED, with iPhone/Safari separately UNVERIFIED. Production stays `6ac2c370d1409615f07878bd`. Local production-v1 assembly is preparation, not publication. Once remaining Gate and budget pass, reread the latest full-site baseline and release Planner-only through the canonical publisher, then test production. Never promote the draft or restore stale whole-site artifacts; preserve siblings, private pending/conflicts and campaign. No Supabase, DNS, security expansion, MAIN or Tracker change.


---

## Historical checkpoints below

## Historical decisions below

## Current Full Gate decision — 2026-10-07 06:50 UTC

Keep [runtime `601cb065`](https://github.com/blackeirose/YSU-Tools/commit/601cb065365425b705e86d2292787247a24d4fe3) on isolated canonical complete-host [Preview `6ac5eb36716fa0a41443535b`](https://6ac5eb36716fa0a41443535b--ycsu-tools-router.netlify.app/travel-planner/); [CI 37582701804](https://github.com/blackeirose/YSU-Tools/actions/runs/37582701804), scoped source review and remote complete-host validation pass. Production remains `6ac2c370d1409615f07878bd` and **Full Gate remains NOT PASS**. The earlier live vision request failed HTTP 400/`INVALID_ARGUMENT` with no field-level message; its US$0.06 reservation remains counted. Current campaign ledger is 13 entries/US$1.26 conservative reserved against the Owner-approved US$2.60 cumulative cap, with US$1.00 UTC daily cap unchanged and actual billing unknown. New vision request format has not yet passed a live provider call. Authorize only the new exact Firebase Preview hostname after action-time confirmation, then test live cloud conflicts, AI/private Blob and real zoom. Conditional production release remains authorized only after necessary Preview Gate passes, through the reviewed complete-host publisher and a freshly read baseline; no sibling, private data or budget reset.

---

## Historical Full Gate decision — 2026-10-07 UTC

Keep executable [product `4c62bec6e50a56164c5ab85246869d1171bb358f`](https://github.com/blackeirose/YSU-Tools/commit/4c62bec6e50a56164c5ab85246869d1171bb358f) on canonical isolated complete-host [Preview `6ac5ce500adc8a3a5baff6fd`](https://6ac5ce500adc8a3a5baff6fd--ycsu-tools-router.netlify.app/travel-planner/), with source-matched [CI 37571986648](https://github.com/blackeirose/YSU-Tools/actions/runs/37571986648) and focused source review passed. Production deploy remains `6ac2c370d1409615f07878bd` at latest readback; this is not a fixed release baseline. **Full Gate NOT PASS** until the exact Firebase hostname is approved and read back, final-host Auth and two independent contexts work, real single-tab offline conflict recovery is observed, necessary current AI/private Blob flows pass, and true zoom is checked. Old-host evidence retains only its documented scope.

Owner approved the same campaign cumulative ceiling of US$2.60 (an additional US$0.60); the UTC daily ceiling remains US$1.00. Preserve 12 existing reservations/US$1.20 and all unknown costs. Source records the second grant atomically at first new reservation; current live ledger still records US$2.00 and no new paid call was sent for this grant. The remaining whole-batch reservation bound is US$1.31, so schedule Preview and production smoke across UTC days if required. Do not reset the ledger, create a second campaign, spend above either cap, or call the reservation amount a provider bill. Conditional production authorization is valid **after** Preview Full Gate; then fetch the latest complete-host baseline and replace only Planner through `social-capture-tool/scripts/shared_host_release.py`, preserving siblings, private pending/conflicts and budget history. Do not use Supabase in Planner, expand shared security, change DNS, or update MAIN/Tracker.

---
## Historical Full Gate decision — 2026-10-06 23:45 UTC

Keep executable commit `3c97b2d` at isolated complete-host Preview `6ac584df1801b9eafb089249`; production remains `6ac2c370d1409615f07878bd`. Source-matched CI and focused source review pass, but exact-host Auth, real two-context offline conflict recovery, paid AI/private Blob and true zoom do not yet pass. Do not treat the old hostname approval or old background success as new-host acceptance. Preserve all existing campaign reservations and unknown costs; with US$1.20 of US$2.00 conservatively reserved and a US$1.31 whole-batch bound, hold further paid calls until the requested incremental grant is decided. Daily US$1 remains unchanged. Conditional production authorization remains subject to the existing Full Gate; use the canonical complete-host publisher and current baseline if the Gate later passes. No Supabase, sibling edit, shared security expansion or MAIN/Tracker update.

---

## Historical Full Gate decision — 2026-10-06 21:36 UTC

Keep exact runtime `4ccd80297c8c2ac297a80ed2777a0ba2b2ecd62b` on isolated complete-host draft `6ac56a1df33fad04f496bf40` pending live Preview Gate. Source CI/review and complete-host preservation pass but do not replace exact-host Auth, real offline conflicts, bounded AI/private Blob or true 200% zoom. Owner approved same-campaign US$2 cumulative cap, US$1/day unchanged; grant history and old entries are preserved atomically on first new successful reservation. Background zero-provider-call budget denial no longer consumes the final retry. No new paid call or production release occurred. Preserve latest siblings, old-origin pending/conflicts and private data; no Supabase, DNS, shared-security expansion, MAIN or Tracker update. After Preview Full Gate, re-read current baseline and publish Planner-only, then run reserved production smoke.

---

## Historical Full Gate decision — 2026-10-06 03:32 UTC

Keep product runtime `58fd9d3a91f4f1c6514baa55dea01d05d42ed08a` on isolated complete-host draft `6ac46a5f1273483233b160e0`. Exact-source CI, narrow independent source review, current-baseline complete-host preservation, exact-host Firebase Auth and live synthetic online two-context add/move/Undo/refresh pass. Preview background requires an explicit click, preventing repeated paid auto generation on a fresh draft. The image endpoint's prior HTTP 400 and final request shape have no successful generated-image/Blob proof. Per-tab live offline conflict, voice, vision, true 200% zoom and production AI smoke remain outside the necessary Full Gate. New cumulative US$1 campaign has US$0.66 reserved, US$0.34 remaining; actual total and prior costs are unknown. **Do not deploy the upgrade to production, promote the synthetic draft, broaden shared permissions, raise/reset the cap, alter sibling tools, use Supabase in Planner, or update MAIN/Tracker.** Preserve published production `6ac2c370d1409615f07878bd`, newest UMS and all private old-origin pending/conflicts. A future eligible release must read a fresh complete-host baseline and replace only Planner through the canonical publisher.

## Historical decisions below

## Historical 21:18 UTC decision — 2026-10-05

Keep product `ae0d42b57187ae529199ec64c72943c940b7d445` at isolated complete-site draft `6ac412e3c5002ab9e6196bbf`. The new date picker pointer path, 1440/390/320px local Preview UI and exact-source emulator regressions passed; the new hostname is not an Authorized Domain, paid AI cumulative cost remains unbounded, and genuine new-runtime cloud offline/AI/Blob/200% zoom gates have not passed. **Do not publish the upgrade to production** or promote the draft. Preserve production `6ac2c370d1409615f07878bd`, its newer UMS and all sibling files/Functions/traffic/schedule; preserve every private pending/conflict on old origins. Future candidates must use the then-current complete production baseline. No shared rule widening, cap change, Supabase in Planner, DNS, MAIN or Tracker change.

## Current-draft cloud gate decision — 2026-10-05 06:26 UTC

Accept normal same-account, two-browser-context cloud add, cross-day move/Undo, date shrink-to-candidates/Undo, fixed booking and deadline retention, and deep-route reload as **live PASS** on exact runtime `ac2f023e` / draft `6ac33f299da97d91b71b4b61`. The single exact Firebase hostname was authorized and verified; no sibling domain, provider or rule changed. Do not promote: true live offline reconnect with same-record move/reorder/delete conflicts, paid audio/vision/Explore/background/private Blob, cost attribution, 200% zoom, Safari and physical iPhone are not accepted. Older source-review/emulator evidence remains valid only in its stated scope. Preserve the existing production baseline and all private pending/conflicts; no MAIN/Tracker update.

## Full Gate hold — 2026-10-05 06:13 UTC

Keep product runtime `ac2f023e2f3c27e7b1370c2a33a3737ced7fda7e` at immutable full-site draft `6ac33f299da97d91b71b4b61`; do not promote it. Its new exact hostname is not yet a Firebase Authorized Domain. Source-matched CI and independent source review pass, but current-host cloud offline/conflict, real audio/vision/background/Blob and budget attribution are not accepted. An older authorized draft yielded real synthetic text action/Undo and cited Explore cards, but its runtime is `5e9880d` and cannot certify this build. UTC Oct 5 Planner usage reserves US$0.27, plus Oct 4 US$0.94; these are conservative reservations, not billed spend. Actual cost and unknown request outcomes remain separate. Keep US$1/day and US$5 cumulative limits, existing rules, current production `6ac2c370d1409615f07878bd`, sibling tools and private offline state unchanged. No MAIN/Tracker update.

## Reorder conflict gate decision — 2026-10-05 04:28 UTC

Accept [CI 37263447650](https://github.com/blackeirose/YSU-Tools/actions/runs/37263447650) as synthetic emulator evidence for same-item offline reorder versus online edit conflict, explicit backup/recovery and subsequent sync. Reviewer `/root/full_gate_review` found the strengthened same-ID and final-note assertions adequate for that narrow claim. It does not establish new-Preview live Auth/offline behavior, paid AI/Blob or Full Gate; no production release.


## Emulator gate decision — 2026-10-05 04:21 UTC

Accept [CI 37262976480](https://github.com/blackeirose/YSU-Tools/actions/runs/37262976480) as a narrow same-origin **synthetic** legacy-pending regression: 108 unit, 8 rules and 6 emulator browser tests passed on test/docs HEAD `b588ac7c`. Keep live old-origin Owner data untouched. This does not satisfy new Preview cloud/paid Full Gate or authorize production release; the deployed app remains runtime `5e9880d`.


## Release decision — 2026-10-05 04:15 UTC

Hold the upgraded Planner at the isolated draft `6ac2d52a8b3b09627e4a347b`; do not publish or promote it while new-host cloud offline/conflict and paid modalities/Blob remain unaccepted. Keep production `6ac2c370d1409615f07878bd` and its newer UMS release intact. The precise Firebase Auth domain is Owner-authorized but still absent pending Computer Use operation-time confirmation. Today's UTC quota document was absent at read time; yesterday's US$0.94 remains only a reservation. Netlify team AI credits do not establish all Planner costs, so do not reset usage, increase caps, or treat unknown requests as free. Normal browser Photon search succeeds, but server-side source verification remains unknown; keep source validation strict. Fifty-seven focused mock/unit tests pass but do not waive Full Gate.


## Release decision — 2026-10-04 15:50 PDT

Keep PR #3 and the new complete-host draft `6ac2d52a8b3b09627e4a347b` isolated. Production is independently observed at `6ac2c370d1409615f07878bd` and contains a newer sibling UMS release; no older baseline may replace it. Runtime source `5e9880d` passed CI and narrow independent synthetic Preview review, and the currently deployed shared rules hash matches the reviewed preview-v1 merge. The Full Gate is NOT PASS until exact-host Auth, live cloud offline/conflicts, paid AI modalities/Blob, attributable budget evidence and source-matched review pass. Conservative US$0.94 quota reservation is not a bill. Conditional release authorization does not waive the Gate. No production promotion, shared-policy widening, paid cap reset or MAIN/Tracker update is permitted.


## Updated release decision — 2026-10-03 17:35 PDT

Use draft `6ac19dbe1e7f0157bfeef08e` / product `5f68efc` for synthetic Owner review. Two independent source reviews closed the paid-request replay, fixed-booking assistant mutation and fixed-zone disclosure findings for Preview scope. The new immutable request reservation rule is applied only to `travelPlanner/preview-v1`; production `v1` has no corresponding rule. Paid AI in production must remain disabled until a separately reviewed `v1` rule and real authenticated acceptance pass. Do not promote this draft, modify siblings, clear offline pending data or change MAIN/Tracker. Production Netlify deploy remains `6ac0989e1e8fabf48ee75360`.

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
