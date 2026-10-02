# YSU Travel Planner

Private personal travel planning application. Traditional Chinese UI with original place names; desktop parallel days plus interactive map, mobile Today/map/candidates/tasks. Official intended route: `https://tools.ycsu.cc/travel-planner/`.

Source is `blackeirose/YSU-Tools/travel-planner`, initially a new product. React/TypeScript/Vite, Leaflet, Temporal, IndexedDB. Every model has stable UUID, revision and tombstone. Trip, Place, ItineraryItem, Task/Reservation and Reminder are separate records; one place supports multiple arrangements.

Local demo is fully usable with IndexedDB, clearly labeled without cross-device synchronization. Synthetic Tokyo 2030 and Kyoto/Osaka/Nagoya 2030–2031 examples contain no private PDF order data. Their dates and claims are demonstration data, not current travel facts. No PDF attachments were available; implementation follows the user-provided usage summary.

Cloud adapter uses Firebase Auth and Firestore only when explicit configuration is supplied. Isolated namespace: `travelPlanner/v1/users/{uid}/records/{id}`. Transactions compare revisions and write changed records only. Offline operation batches and conflict alternatives persist locally; conflict resolution is explicit. Firestore uses memory cache so account-local IndexedDB can be cleared on logout. Web Locks and BroadcastChannel serialize same-account edits in local tabs. Browser must support Web Locks, IndexedDB and secure context. Unsynchronized logout provides backup/retry/explicit-discard choices.

Current standalone candidate Firestore rules are owner-only; never overwrite a sibling project's rules with this file. Existing UMS Firebase project is not implicitly authorized for Travel Planner. Live configuration, actual emulator security tests and independent-context cloud synchronization remain external validation gates.

PWA manifest id/start_url/scope and SW scope are `/travel-planner/`. Only generated static shell resources are cached. API responses, Firebase requests and map tiles are excluded; offline maps are not promised. App foreground reminders and ICS VALARM work independently of background push. There is no push scheduler enabled.

Optional Netlify exploration function authenticates Firebase ID token and trip ownership, then uses explicitly configured OpenAI Responses web search. No default model/key is assumed. Owner UID allowlist, actual cited URL validation, server query timestamp, unlocated/unverified cards, no automatic itinerary writes. Remains disabled without authorized settings; ordinary Maps search stays usable.

Shared hosting owner is Netlify `ycsu-tools-router`, site `b23018a8-efe1-4086-b7ea-1d9018b2cf40`. Sole complete-site release authority is `blackeirose/social-capture-tool:scripts/shared_host_release.py`. Its present contract has no travel-planner component. This repo is not connected or deployed to the shared site. See docs/RELEASE_INTEGRATION.md.

Current acceptance and external blockers are in docs/VALIDATION.md and docs/HANDOFF.md; production has not changed.
