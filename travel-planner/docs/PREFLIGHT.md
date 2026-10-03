# Initial preflight / Gate Full record — 2026-10-02

Historical first-pass observations below are superseded where stated by the continuation record at the end.

## Remote canonical sources

Canonical `blackeirose/ysu-ai-core`, default branch `main`, fetched revision **57a69136b7473718dfcf26311ae801f033696f05**. Actual remote reads (not a stale local clone): AGENTS.md 1.7, AI_CORE.md 1.4, docs/ARCHITECTURE.md, SERVICES.md, DEVELOPMENT_WORKFLOW.md, WORKSPACE_STANDARD.md, COMMUNICATION_STANDARD.md, DOMAIN_REGISTRY.md, GATE_STANDARD.md and SMALL_PROJECT_UI_STANDARD.md 1.0. Root entry/Core re-read at pinned revision during final verification. The user prohibition on Supabase overrides the Core service default.

Target `blackeirose/YSU-Tools`, remote default `main`, baseline **c6898cb39f89a77eb8569eb1537ad838cb7428cb**. Initial tracked files were README.md and CNAME; no AGENTS.md, PROJECT_CONTEXT.md, DECISIONS.md, package, deployment, Auth, storage or workflow existed. Initial git status was clean. Feature branch `feature/travel-planner-v1` was created only after remote/default/status checks and explicit user authorization. New project instructions live inside its own directory; root files stay byte-identical.

Release authority inspected at `blackeirose/social-capture-tool` main **7f51fee20ff704ae15fb621fca4cc9c6bae064b7**: AGENTS.md, project context/decisions and shared-host release docs/script/contract. Live Netlify read-only connector confirms site `b23018a8-efe1-4086-b7ea-1d9018b2cf40`, `ycsu-tools-router`, custom URL tools.ycsu.cc. Current contract includes Capture/UMS/Fire Pump, plus preserved Plumbing proxy; no Travel Planner component. Core Domain Registry's tools entry is older than this authoritative release record. No Core or host registry was modified.

GitHub connector reports push/admin access for YSU-Tools. Baseline has no GitHub Actions or Netlify configuration. Shared release authority records no linked Git/CD for the shared site; live connector confirms domain/site but does not expose all hook/build settings. No new CD, deployment hooks, Pages workflow, linked site or production publishing branch was added. Feature push must remain source-only; production must use reviewed complete-site authority integration.

## Managed-machine / credentials

TOWER is a DLR-managed AzureAD/domain/MDM Windows device. Existing bundled Git, Node24, pnpm, Python, installed Chrome/Edge were used. PowerShell is constrained; no attempts to change language/security policy. Project-scoped package installs/build/test writes were reviewed under managed sandbox escalation. No administrator elevation, system software install, WSL/Docker, firewall/registry/service or restart. Existing JVM/Java command was unavailable; Firebase emulator runtime is blocked rather than installing Java or substituting production.

No authorized Travel Planner Firebase project, AI key/model or push scheduler is configured. The known UMS Firebase project has its own owner namespace/rules; no permission to modify or reuse its security settings was inferred. No secrets copied into git/logs or requested through chat.

## Scope and recoverability

Goal: usable V1 and reviewable source/build/tests/docs, with truthful per-integration readiness. Gate Full: persistent data, auth/sync, timezone, SW and shared-host risk. No-Touch: root README/CNAME, Core/Tracker/MAIN, sibling sources/data, shared security/routing, DNS, paid resources, production.

Initial LKG is untouched main baseline above and unchanged live shared deployment. Local product validation does not establish a new production LKG. Rollback before release is discard/revert this isolated feature; after eventual authorized release, rebuild previous Travel Planner component against latest neighboring components through sole release authority. Never restore an old entire shared-site deploy.

External reference PDFs were not available. Used the complete usage summary; no claim to read attachments and no private order/confirmation data in synthetic demos.

## Continuation observations — 2026-10-02

No restart or replacement of existing work. Owner subsequently authorized Firebase preview integration and the existing release authority's isolated branch. Latest accepted authority is b55194709a2ab1f777c4a70310a072d40b313ceb, live deploy 6abf52a7be775989aeaab09d, with 307 static files and six Functions. The old default-main contract above is historical only.

Existing personal Firebase rules were read through its normal console session and matched SHA256 6a7ca7ebcf1f844996a7a9f1d8f63b72b3ead8e32d97c55f47465eef60f5359f. Additive synthetic preview rules passed full merged emulator tests and independent review; published at 15:51 PDT and read back after refresh as fef400543055eab96ddc493a558d7e0da0b2cc54561fbd9cf66e2daf264fcb68. All baseline rule bytes and sibling permissions are preserved. No production v1 data or permission was introduced.

The missing local JVM is resolved for validation through the explicitly authorized manual GitHub Actions demo emulator, not a machine install. Active runtime permissions explicitly report approvals_reviewer=auto_review. Sandbox Git ownership/network errors are technical boundary requests, not missing Owner scope. GitHub connector remains authenticated; Netlify browser login/CLI authentication is separate. See APPROVALS.md.

Current browser runtime connects to Edge; previous Chrome binding is unavailable. Firebase's existing Google session works in Edge. No browser profile was reset, no credential store inspected and no company policy changed.

## Final continuation outcome (supersedes earlier pending-service notes)

Owner completed official Netlify login/CLI authorization. Effective auto_review remained active; no global policy or managed-device settings changed. Fresh site API shows no linked Git/CD. Final isolated draft 6ac045607f1d78183c46e201 is ready and passed complete-host checks; production remains 6abf52a7be775989aeaab09d. Only its exact Firebase domain is newly authorized; original five domains and sibling rule bytes remain. Real Owner OAuth/cloud CRUD and bidirectional Edge dual-origin sync passed. Independent-browser/device live sync, actual cloud offline, WebKit and physical iPhone remain UNVERIFIED. Source 4cb7fdf71f7c5557f726f079ebc2104dc0b8430a; see HANDOFF.md and VALIDATION.md for retained evidence. No additional production authority is implied.
