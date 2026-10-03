# Travel Planner v1 production safety — 2026-10-02

This release uses `/travelPlanner/v1/users/{uid}/records/{recordId}` only. The
`preview-v1` namespace and every sibling collection retain their current
rules. The production rules are an additive match inside the current live
Firestore rules; compare the entire live baseline hash immediately before
publishing, and read back the candidate hash afterward. Never replace the
shared rules with the fragment alone.

The owner policy is inherited from the existing `trustedGoogle()` function.
The Item write must include its Trip in the same atomic transaction, with a
new Trip revision; an old client that writes only the Item is rejected. The
server checks the resulting Item day against the resulting Trip range with
`getAfter`. An existing Trip cannot be shortened or tombstoned in v1 because
Firestore rules cannot query all its Items to prove a shrink is safe. The UI
also rejects shortening with a clear explanation. Extension and archive are
available. This restriction is deliberate and must not be removed without an
equivalent server-side invariant and migration plan.

The production build requires a clean committed source, an explicit `v1`
namespace, the existing Firebase web configuration, and no AI endpoint. Its
`version.json` binds the built bytes to the source commit and dependency lock.
The complete-host publisher must use the production acceptance receipt, exact
latest live baseline, all six protected Function ZIPs, preserved traffic rules,
and a fresh Production-context deployment. A synthetic preview receipt cannot
be promoted.

The production client rejects a prohibited Trip shrink/tombstone before it
changes IndexedDB, including Undo. An older pending operation rejected by
the rules is quarantined as a policy conflict with its local version intact;
unrelated queued operations can then continue. Export the local JSON
before resolving a conflict; do not clear site data, overwrite a pending
operation, or delete the v1 namespace. Rolling back the static app does not
roll back Firestore records. Rollback of the host must be assembled from the
*then-current* complete sibling baseline and the prior Planner component;
restoring an old whole-site deploy could erase another tool's later release.

Release gate: source-matched emulator rules and browser tests, independent
review, authorized production domain, observed live rules hash, full host
candidate validation, live probes, and synthetic login/read/write/reload.
Record any unverified real-device behavior separately. AI and background Push
remain disabled for this Owner trial.
