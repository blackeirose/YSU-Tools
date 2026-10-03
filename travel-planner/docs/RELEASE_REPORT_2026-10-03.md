# Travel Planner UX / Gemini upgrade — release gate report

Status: **CANDIDATE IN REVIEW. NOT PUBLISHED.** The existing 2026-10-02 production deployment remains the last known good version at `https://tools.ycsu.cc/travel-planner/`. This document describes only the 2026-10-03 upgrade branch; historical Preview or production checks do not validate it.

## Source and protected release boundary

- Product: `blackeirose/YSU-Tools`, isolated `feature/travel-planner-ux-gemini-20261003`. Publisher: `blackeirose/social-capture-tool`, same isolated branch. Final commits/PR heads to be recorded after both branches are committed and pushed.
- Latest checked product release branch `da3b6a0a5d94a27741e0b0caa0a1e02d7352b47c`; publisher release branch `1b39109f5457ff835d40f3ee8ed02e1e7dbca658`; Core main `57a69136b7473718dfcf26311ae801f033696f05`.
- Production Netlify site `ycsu-tools-router` (`b23018a8-efe1-4086-b7ea-1d9018b2cf40`) reported published deploy `6ac0989e1e8fabf48ee75360` during preflight. Recheck immediately before and after any candidate or production action. Never publish Planner `dist` as an entire site. The only publisher is `scripts/shared_host_release.py` in the shared-host repository, assembling the then-latest complete site and exact sibling functions/routes/schedules.
- Planner stays under `/travel-planner/`. The PWA shell is scoped there and excludes private APIs, Firebase data and map tiles. No Supabase, sibling feature edit, DNS change or Tracker/MAIN update is part of this upgrade.

## Implemented locally and evidence

The branch contains compact multi-day work area and mobile Today layout; view/edit separation; daily city/timezone; constrained Photon result selection; Planner-scoped Gemini typed-action and source-checking server adapters; click-to-record short audio UI; guarded XLSX/CSV/PDF/image import; visible detached candidates on date shortening; overlap warnings; and a durable owner-scoped two-panel city background job. All test files use synthetic data. Local `pnpm build` succeeded with 169 Vite modules and 15 scoped PWA shell resources. Unit suite passed 67/67. Exact Netlify function bundle check passed for `travel-ai`, `travel-background`, and `travel-background-read`. Shared-host Planner component tests passed 13/13.

Chromium local browser checks include 1440×900, 1366×768, 390×844, 320×700, real Photon Disney lookup into an itinerary and marker, Honolulu day-city timezone, date shrink/reload/expand, CSV/PDF preview with historical Tokyo page exclusion, failed-file draft protection, prior R2–R9 regressions, map and PWA scope. [1440 screenshot](evidence/upgrade-2026-10-03-1440.png) · [1366](evidence/upgrade-2026-10-03-1366.png) · [390](evidence/upgrade-2026-10-03-390.png) · [320](evidence/upgrade-2026-10-03-320.png). These are synthetic local screenshots; no generated background or paid assistant call is visible. The full run had 52 PASS, 9 mobile skips for desktop-only controls, and one outdated mobile selector; the repaired detail-drawer test passed separately (53 effective executed workflows). A single clean post-commit run is still preferable as final evidence.

## Release gates still open

1. Source-matched Firebase emulator CI and latest complete rules additive merge; real Owner authentication, two independent browser contexts, offline/reconnect, old pending migration and rules enforcement. Local browser tabs and mock tests do not close this gate.
2. Isolated, complete-host Netlify Preview with exact product/publisher SHA and current sibling static/function/route/traffic/schedule hashes. Deep `/travel-planner/` reload, CSP Photon, PWA update and sibling probes must pass there.
3. Actual Netlify AI Gateway text, short audio, sourced exploration and image vision calls, plus a real generated Tokyo background persisted in Blobs and read back across browser contexts. There have been **zero** accepted real paid upgrade calls so far; actual fee/credits cannot be claimed. Confirm model route, service entitlement and conservative pre-call USD estimate before spending within the authorized total US$5 test limit.
4. Independent reviewer must give a source-matched disposition after fixes for Auth/billing abuse, actions/Undo, import/date-shrink data retention, old offline clients, timezones and shared-site isolation. A code review does not equal live or Full Gate PASS.
5. Full Gate browser/accessibility and compatibility gaps: 200% zoom, WebKit when available, real microphone grant/denial, actual physical iPhone and Safari offline remain UNVERIFIED until tested. Lack of a physical iPhone is documented separately; it must not be misrepresented as a simulated mobile test.

The user authorized one production release **only after** all necessary gates pass. If any core integration stays blocked, keep the existing published version and deliver the exact Preview/source evidence with the remaining owner/service action. Do not promote a Preview receipt or call an unverified feature complete.

## Recovery and compatibility

The previous production deploy ID is an identification reference, not a safe whole-site rollback ZIP. Rebuild against the then-current complete sibling baseline, changing only Planner bytes and reviewed Planner function/rule fragments. JSON export includes new optional fields and can be used before accepting new data changes. Old IndexedDB pending/conflicts and Firestore records must not be reset or cleared. If a new client finds an older queued operation, retain a recoverable copy and explicitly resolve it; never silently drop or replay it over newer detached candidate/trip-date state. A rollback to the old UI after new date-shrink metadata is written needs compatibility review before promotion.
