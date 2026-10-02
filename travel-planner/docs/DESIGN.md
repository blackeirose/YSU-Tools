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
