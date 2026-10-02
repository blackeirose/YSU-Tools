# /travel-planner/ 隔離 Preview 整合

產品來源：`blackeirose/YSU-Tools/travel-planner`；正式目標 `https://tools.ycsu.cc/travel-planner/`。不得整站部署此 repo 或 dist。

唯一發布 authority：`blackeirose/social-capture-tool/scripts/shared_host_release.py`，site `b23018a8-efe1-4086-b7ea-1d9018b2cf40`（ycsu-tools-router）。本輪 Owner 已授權隔離 feature branch、完整 draft 與最小 Planner 規則；production 仍未授權。

Authority [PR #21](https://github.com/blackeirose/social-capture-tool/pull/21) 基於 accepted `b551947`／live `6abf52a7be775989aeaab09d`，保留307 static files、6 functions、所有routes/modes/cleanup cron。不能使用舊 main 的22-file contract。正式 artifacts 由既有私有 release 取回並驗證，每個 function ZIP 的 hash 全數相符。

## 可重建及不可變 candidate

`pnpm install --frozen-lockfile` → 設定已授權的公開 Firebase web config、`VITE_FIREBASE_NAMESPACE=preview-v1` → 在 clean source 執行 `pnpm run build:preview`。忽略 git 的 TOWER config 在 `.private-integration/firebase-preview.env`，只供 preview build 程序載入環境，避免預設本機 demo 被切成雲端。不要輸出設定值或提交此檔。

Build 寫入 source SHA、lock SHA256、namespace、base、synthetic-only、AI-disabled metadata。正式發行不可沿用 preview namespace。

`travel_planner_component.assemble()` 先驗證完整 baseline 的每個 byte，建立不存在的新目錄，加入 Planner 並只 append 經審查的 root header/redirect fragments。既有 root source 保持原樣。已組出 source c97589fe 的322-file candidate；manifest SHA256 `4d18c3395f9a8c3c258863f09ea5c0a1bab23ecfa64763c496b04531b23c2013`，仍在本機。

## 路由／安全契約

- base、assets、trip/day 路由都是 `/travel-planner/`。
- redirect 僅無斜線 canonicalization、API disabled JSON 404、明確 trip/day route；沒有全站／Planner catchall。
- Google 使用既有 Firebase Auth domain 的官方 popup handler；app 保留原有 trip/day route，不把 Firebase callback 改寫進共享 root。
- manifest id/start_url/scope、registration 與 Service-Worker-Allowed 均 `/travel-planner/`。worker no-store；API private/no-store；hash assets immutable；私人 API／地圖 tiles 不快取。
- Root `sw.js`／`service-worker.js` 不在 accepted static inventory；Preview 新 origin 與正式歷史 registration 需分别驗證。
- 沒有 Planner AI 授權所以不新增function；已有兄弟functions保持原ZIP，不以其實作或keys供Planner使用。

## 建立 draft 前尚待 gates

正常 Netlify CLI 登入後，重新取得當前 live baseline、完整 function inventory與實際 traffic rules；若 API 沒有回傳 protected CA traffic policy，publisher 必須停止，不能以常數補寫。現有 retained inventory 刻意只記 function signature，沒有 traffic field，所以還不是這項 live gate 的證據。

Firebase 合併 rules 已套用且刷新後讀回相同 hash（fef400543055eab96ddc493a558d7e0da0b2cc54561fbd9cf66e2daf264fcb68）；精確 Preview authorized host 待 draft ID。完整規則已通過私有 Actions emulator；rollback 是未改動的原規則。Preview acceptance receipt 必須包含matching source、emulator／independent-review PASS、rulesApplied與observed hash。未符合時 publisher在API寫入前拒絕。

由authority建立 `draft:true` 完整candidate，驗證首頁／深層直開刷新、assets/manifest/icons、OAuth、獨立context雙向及離線衝突、API不落SPA、所有兄弟probes與functions/cron。禁止以臨時devserver URL冒充持久Preview。

## 正式發布／回復

Preview receipt的 `mode=preview` 無法 promotion；本輪沒有執行任何production呼叫。正式版需另建適用v1資料範圍的候選、全套適用gates，最後另外取得Owner production授權。

回復只能替換Planner component並保留當下最新兄弟artifacts。不得歷史整站restore。共用Firebase rules回復前也要核對是否有其他已核准更新，不能回蓋兄弟規則。
