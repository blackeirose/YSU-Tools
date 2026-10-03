# UI design record

Applied canonical `SMALL_PROJECT_UI_STANDARD.md` version 1.0 at Core main `57a69136b7473718dfcf26311ae801f033696f05`.

| Semantic token | Value   |
| -------------- | ------- |
| Background     | #F7F6F3 |
| Surface        | #FFFFFF |
| Text           | #202421 |
| Secondary      | #5C635F |
| Accent         | #315C4B |
| Focus          | #245BDB |

Task-first screen, system fonts, restrained whitespace, no advertisement hero. Desktop day columns and persistent map, adjustable proportion; mobile single day list with bottom navigation and collapsed secondary trip actions. Native modal dialog focus management; explicit field labels, focus outlines and 44px primary touch areas. Category colors are accompanied by text, sequence numbers and candidate marks. No reduced desktop table on mobile.

No coordinate guessing, live departure claims, fake AI cards or synthetic-date urgency. Map lines explicitly represent itinerary sequence. Transport estimates are user-entered or unknown. Zoom animation is disabled to avoid Leaflet lifecycle callbacks against removed maps and reduce unnecessary motion.

## 2026-10-03 upgrade

The trip title and frequent actions are compact. At 1440×900 and 1366×768, the multi-day board and resizable map begin in the visible workspace; secondary actions sit in menus. View mode presents cards and a detail drawer, while edit mode exposes inline controls. Mobile keeps one active day, a detail drawer for move/Undo and delay actions, and bottom navigation. Calendar dates remain visible after moving an item. A collapsed map does not delete its selection.

Each date can show its own city and IANA timezone. External Photon search is explicitly separate from saved places and Gemini exploration; unresolved names keep a manual path. Overlapping timed items are allowed with text warnings, including a stronger fixed-reservation warning. Date shortening moves affected plans to visible candidates with original day metadata and leaves actual reservations intact.

The approved `YSU-SKILL-021` v1.0.0 style is adapted into a precise 3:4 desktop backdrop: a photographic upper 3:2 panel and a paper-relief lower 3:2 panel, joined visually at 50/50. The image sits behind readable translucent work panels and does not consume hero height. Mobile does not request the desktop images. The source prompts are versioned in `src/server/background-style.ts`; visual and actual paid-generation acceptance remain separate gates.
