# Travel Planner V1 — 接續交付（2026-10-02）

**核心與 emulator 同步可驗收；已產生完整本機共享站 candidate，但持久 Netlify Preview 與真實 Owner OAuth 尚未啟用。沒有 production deploy。**

- 產品 [PR #1](https://github.com/blackeirose/YSU-Tools/pull/1)，branch `feature/travel-planner-v1`；已驗證程式碼／candidate source `c97589fe24ead39765530a9968d4e4fc6aac3bfb`。
- 發布 authority [PR #21](https://github.com/blackeirose/social-capture-tool/pull/21)，branch `feature/travel-planner-preview`，程式碼 `ac8754680150dc4ac36f43cebd56009aa21c1688`，以最新 accepted `b551947` 為基準。不是過時 main。
- Core main `57a69136b7473718dfcf26311ae801f033696f05`。正式路徑固定 `https://tools.ycsu.cc/travel-planner/`。
- 完整本機 candidate：`C:/Users/YSU/Codex_Tower/integration-transfer/planner-candidate-c97589fe`；322 static files，manifest SHA256 `4d18c3395f9a8c3c258863f09ea5c0a1bab23ecfa64763c496b04531b23c2013`。不是已部署 Preview。
- 307 個既有 static bytes 與 6 個 function ZIP 全部核對正式 baseline 雜湊。來源保留在私有 release `ca-space-recovery-2026-10-01`，本機副本在 `integration-transfer/planner-retained-baseline`；不靠臨時 ZIP 作唯一成果。

## 實際狀態

| 範圍 | 已完成／界線 |
|---|---|
| 核心 | 多日行程、真實地圖、候選替換、移動排序 Undo、固定預約保護、待辦、ICS、JSON、列印、合成東京與跨年多城市示範 |
| 同步 | Firebase Auth／Firestore adapter；兩個獨立 context 的雙向、refresh/relogin、離線重載重連、跨日／排序／刪除 Undo、雙向衝突選擇均在 emulator PASS |
| 資料保護 | stale draft 拒絕覆寫；網路同步不占本機編輯鎖；session loss 原子保存 recovery；project＋namespace＋UID 分開本機 queue |
| Firebase 真實專案 | 已找到適合的既有個人 project；private `preview-v1` 合併規則已通過完整 emulator 與獨立 review。規則已發布且刷新讀回 hash 相符；authorized host 尚未新增，正式 v1 不可存取 |
| 離線 | Chrome local／emulator 讀寫、重載與重連 PASS；無離線底圖；記憶體 session recovery 必須留在該分頁，強制關閉可能失去它，有警示及原帳號備份 |
| AI | 未啟用。普通 Maps 搜尋可用。現有兄弟 keys 不借用；本 candidate 不新增 AI function |
| 提醒 | 提醒中心、前景提醒、ICS VALARM 可用；背景 Web Push 未啟用 |
| Preview | 完整本機 candidate 已組成；Netlify draft 尚無 URL，不能從手機跨網路試用 |
| iPhone | 真機安裝、Safari 離線、鎖屏通知 UNVERIFIED；Chrome 390px 不等於 iPhone |

## 已驗證

27 unit tests、16 本機 Chrome 流程（1440／390）、typecheck／build PASS。Public emulator [run 37063922214](https://github.com/blackeirose/YSU-Tools/actions/runs/37063922214) PASS，含 owner/anonymous/other-user 與 trusted-Google preview 規則及兩個獨立 contexts。Private authority [run 37064250499](https://github.com/blackeirose/social-capture-tool/actions/runs/37064250499) 完整合併 rules PASS，authority 66 PASS／1 既有 skip。獨立 reviewer 已複核資料遺失與 traffic-policy 修正 PASS（程式碼審查，非 live acceptance）。

## 剩餘最少 Owner 介入

1. **在 TOWER 完成既有 Netlify 帳號的正常 CLI 登入／授權**。CLI account config 不存在、管理頁目前登出；connector 只有不適用本任務的直接 deploy 操作，不能代替完整 draft upload。不要在聊天貼 token。之後由 agent 查 live traffic policy、重新核對 baseline、建立 draft、驗證完整站與精確 preview host。
2. **Firebase 最小合併規則已依既有授權完成**，無須再核准同一動作。取得 draft ID 後只加入其精確 Preview host；不使用網域 wildcard，不改兄弟存取。完整差異／rollback 在私有 authority PR #21。
3. Preview 建立後，若 Google 要求本人驗證，再於原生登入畫面完成。agent 繼續 live OAuth、獨立 contexts、雙向／離線及兄弟 probes；不要求 Owner 代跑可自動完成的 QA。

AI／Push 可後補：AI 需 Planner 專用服務／模型與測試額度、server key、owner、project/namespace 及持久 rate limit；既有安全設定入口接收秘密。Push 需授權 scheduler／subscription backend。本輪不以兩者阻擋同步 Preview。

## 正式發布與回復

目前正式站仍是 `6abf52a7be775989aeaab09d`，僅新增已授權 Preview rules；未改兄弟規則、DNS、計費、正式資料、MAIN／Tracker。這份 candidate 是 synthetic preview，authority 明確禁止 promotion。正式版要另建 `v1` 資料／來源相符的完整 candidate、fresh review／live acceptance，最後才另請 production 授權。

Firestore 回復使用「修改前當下再次讀取」的規則基準；若其他工具期間有更新，重新合併，不能蓋回旧整份規則。產品回復只重建前一 Planner component，搭配最新兄弟 artifacts/functions，禁止歷史整站 restore。
