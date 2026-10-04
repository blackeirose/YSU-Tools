# Travel Planner V1 — 隔離試用交付

> **最新 UX/Gemini 隔離交接（2026-10-03 17:35 PDT）：** 可試用 [完整站 Preview](https://6ac19dbe1e7f0157bfeef08e--ycsu-tools-router.netlify.app/travel-planner/) `6ac19dbe1e7f0157bfeef08e`，產品 [Draft PR #3](https://github.com/blackeirose/YSU-Tools/pull/3) runtime `5f68efc`，publisher [Draft PR #23](https://github.com/blackeirose/social-capture-tool/pull/23) head `b7d4724`。用「本機模式」與「載入示範」可操作東京／跨年合成旅程；此模式**不跨裝置**。產品及完整站 CI、82 unit、55 Chromium browser、75 publisher tests、Preview-only rules readback、九 Functions 與兄弟工具保留驗證皆通過。Google popup 在 TOWER 未完成，所以真正 Owner 雲端同步、Gemini、圖片保存未驗收；Full Gate NOT PASS，**不發布正式版**。正式站仍是 `6ac0989e1e8fabf48ee75360`。新版 `v1` 付費 AI 必須先補受審查的 production `aiRequests` 規則與實測。參考 [Gate](UPGRADE_GATE_2026-10-03.md) 與 [release report](RELEASE_REPORT_2026-10-03.md)；下方舊草稿僅為歷史。

> **2026-10-03 UX/Gemini 升級交接（本檔下方 V1 歷史段落保留）：** [本輪隔離 Preview](https://6ac1921df800e63bc4e905cb--ycsu-tools-router.netlify.app/travel-planner/) 已 ready；產品 runtime `42cf4cbe95cfdcc40f9cec2322f9afa9a8763c66` / [Draft PR #3](https://github.com/blackeirose/YSU-Tools/pull/3)，共用站 authority `f438e47de8c83de192ffaef609d19ae4189a3875` / [Draft PR #23](https://github.com/blackeirose/social-capture-tool/pull/23)。Owner 可用合成東京示範在本機模式試切日期、移日／Undo、地圖、匯入預覽；本機模式不跨裝置。產品與發布 CI、完整站隔離、Preview rules/hostname 和本機操作通過；真人 Preview 登入、Gemini 文字／音訊／視覺、真實背景生成／跨裝置、真實雲端離線仍 UNVERIFIED。Full Gate 未通過；本輪沒有 production deploy。正式站維持 `6ac0989e1e8fabf48ee75360`。詳見 [最新報告](RELEASE_REPORT_2026-10-03.md) 與 [Gate](UPGRADE_GATE_2026-10-03.md)；舊 Preview 不能驗收本輪。

> **New upgrade in progress, 2026-10-03:** `feature/travel-planner-ux-gemini-20261003` is an isolated UX/Gemini candidate. This file retains V1 release history below. For this new source, use [Full Gate](UPGRADE_GATE_2026-10-03.md) and [upgrade report](RELEASE_REPORT_2026-10-03.md). No 2026-10-03 upgrade Preview or production deploy has been made, and the local development URL is not a persistent Preview. The 2026-10-02 production deployment remains live. Do not use prior V1 Preview or emulator PASS as proof that Gemini, background images, import vision or the new cloud rules work.

> **Current release, 2026-10-02 PDT:** [Travel Planner is now live at tools.ycsu.cc/travel-planner/](PRODUCTION_RELEASE_REPORT_2026-10-02.md), deploy `6ac0989e1e8fabf48ee75360`. Production cloud login/sync and physical iPhone remain unverified. The Preview-only and “no production deploy” statements below are historical checkpoints, not the current release state.

**最新 R1–R9 修復版隔離 Preview 可用本機合成資料試用；此新 origin 的 Google 雲端登入尚未驗證／授權。沒有 production deploy。**

- [最新修復版 Preview](https://6ac08433dbc4b56d7f3160d1--ycsu-tools-router.netlify.app/travel-planner/)：deploy `6ac08433dbc4b56d7f3160d1`，產品 source `380ae4aa56c5266f590a5ecf299f6ea0b4cc9986`，發布 authority source `d9ddbd37fcdad555549e93467bf822855b99a694`。從「使用本機模式」載入合成東京／跨年示範，可測移日／Undo、提醒與 ICS、深層網址刷新、備份並離開。遠端 Chrome 桌機與 390px 模擬手機已實測；實體 iPhone 未測。
- [來源對應 emulator CI](https://github.com/blackeirose/YSU-Tools/actions/runs/37096453816) PASS：38 unit、2 rules、4 獨立 context 流程。獨立原始碼 reviewer 對提醒、跨記錄、佇列與本機退出載入門檻複核 PASS；不代表實機或正式雲端驗收。
- 新 draft origin 未加入 Firebase Authorized Domains；需要另行精確授權才可在**此新網址**測 Google 雲端同步。Owner 受影響 Chrome 的憑證錯誤亦需分開由裝置／IT 查明。AI／背景 Push 未啟用。正式站 production ID 前後均為 `6abf52a7be775989aeaab09d`。完整 R1–R9 與回復見 [驗證紀錄](REVIEW_R1_R9_2026-10-02.md)。

以下原始 V1 交接與連結屬**歷史里程碑**；舊 Preview 不能驗收本輪修復。

- [開啟隔離 Preview](https://6ac045607f1d78183c46e201--ycsu-tools-router.netlify.app/travel-planner/)：使用既有 Owner Google 帳號登入，或選明確標示的本機模式。只供合成測試資料。
- 產品 [PR #1](https://github.com/blackeirose/YSU-Tools/pull/1)，branch `feature/travel-planner-v1`；Preview source `4cb7fdf71f7c5557f726f079ebc2104dc0b8430a`。
- 發布 authority [PR #21](https://github.com/blackeirose/social-capture-tool/pull/21)，branch `feature/travel-planner-preview`；candidate authority `61ef93988580b8cde0d608d8cecb3eaaa367eb7e`，基於 accepted `b551947`。
- Core main `57a69136b7473718dfcf26311ae801f033696f05`。正式目標仍為 `https://tools.ycsu.cc/travel-planner/`，本輪沒有發布到此路徑。後續文件 commit 不改變 Preview 成品。

## 可用操作

旅程新增／編輯／複製／封存、最少名稱新增地點、多日並排行程與真實可縮放地圖、候選搜尋／加入／替換、拖曳與手機移日／排序、Undo、固定預約保護的彈性延後、待辦與提醒中心、ICS VALARM、JSON 預覽匯入／匯出、列印、離線下載與衝突恢復。東京及京都／大阪／名古屋示範均為合成資料。

## 真實狀態

| 範圍 | 結果與界線 |
|---|---|
| 雲端同步 | 真實 Google 登入、全新 Preview origin 從 Firestore 讀回旅程、新增旅程／地點、反向新增、跨日移動、Undo、刷新保留均 PASS。同一 Edge 的兩個不同 origin，各自獨立本機資料庫；不是兩個獨立 browser contexts 或實體裝置。 |
| 存取控制 | 既有個人 Firebase 專案，僅 owner-only preview-v1；原規則 bytes 保留，發布讀回 hash 相同。只新增最終精確 Preview domain，已移除被取代 draft domain。正式 v1 尚未開放。 |
| 離線／衝突 | 本機及 emulator 讀寫、reload、重連、跨日／排序／刪除衝突與雙向版本選擇 PASS；真實雲端離線重連 UNVERIFIED。無離線底圖。意外 session loss 的 recovery 留原分頁記憶體，關閉前依警示備份。 |
| AI | 尚未啟用；Maps 搜尋可用。UI、server adapter、驗證及錯誤處理完成，未借用兄弟 key，未部署 AI function。 |
| 提醒 | 提醒中心、前景提醒、穩定 UID／VALARM 的 ICS 可用；行事曆匯入為快照。背景 Web Push 未啟用，無授權 scheduler。 |
| 手機／PWA | 實際查看 390px／1440px；scope 限 /travel-planner/。WebKit、實體 iPhone 安裝、Safari 離線、鎖屏推播 UNVERIFIED。 |

## 驗證與隔離

Typecheck／build、27 unit tests、18 本機 Chrome 流程 PASS。Public emulator [run 37079696570](https://github.com/blackeirose/YSU-Tools/actions/runs/37079696570) PASS：兩項 rules tests、兩個獨立 contexts 雙向／權限／離線衝突。共享完整規則私有 [run 37064250499](https://github.com/blackeirose/social-capture-tool/actions/runs/37064250499) PASS。Authority 本機 69 tests：68 PASS／1 既有 skip。獨立 reviewer 風險審查 PASS。

最終 draft 的 322 static files、6 exact function archives、routes／modes／traffic policy／cleanup cron 驗證 PASS；307 個原有檔案受保護，僅共享 root headers／redirects 作已核准 append。18組遠端 probes 含兄弟工具、Planner 有／無尾斜線、deep routes、assets／PWA、API／missing-asset 404。正式 deploy 仍為 `6abf52a7be775989aeaab09d`。沒有整站部署 YSU-Tools，沒有使用 Supabase。

Immutable candidate：`C:/Users/YSU/Codex_Tower/integration-transfer/planner-candidate-4cb7`；manifest SHA256 `4e28fc44c9ac4c2eb706d8a686bd19a0ac20e000fa954e3ce16bfd43db87218e`。可重建程式、鎖檔、整合程式、receipts 在兩個 PR；兄弟 artifacts 在既有私有 release。詳見 [VALIDATION](VALIDATION.md)、[發布與回復](RELEASE_INTEGRATION.md)、[獨立 review](INDEPENDENT_REVIEW.md)。

[最終桌機](evidence/preview-final-desktop.png)／[手機](evidence/preview-final-mobile.png) 是 Preview 的本機模式；[雲端畫面](evidence/preview-cloud.png) 顯示實際同步。

## 剩餘最少 Owner 事項

1. 在另一台裝置／瀏覽器開啟上方 Preview，以既有 Owner 帳號登入試用。若 Google 要求 2FA，由本人完成；不必重做 TOWER Netlify CLI 登入。實體 iPhone 安裝／Safari 離線需在裝置上驗證。
2. 若要啟用 AI，另指定 Planner 專用服務／模型與額度，秘密經既有安全設定入口寫入，不貼聊天。若要背景 Push，另指定授權 scheduler／subscription backend。這兩項不阻擋目前試用。

## 正式發布與回復

本 draft 是 synthetic preview，publisher 禁止 promotion。正式版需另建 v1 owner rules／設定、完成真實跨裝置與離線 acceptance、fresh baseline／完整站 gates，最後另取得 production 授權。DNS、計費、正式資料、MAIN／Tracker 均未變更。

回復只替換 Planner component 並搭配**當下最新**兄弟 artifacts/functions，不能歷史整站 restore。Firestore 回復先重讀最新規則，保留期間其他核准更新，只移除 Planner fragment；不得蓋回舊整份規則。Preview domain 也只移除該精確 host。

## 2026-10-02 R1–R9 修復輪（以上舊 Preview 與驗證數字不代表本輪）

獨立審查後的修復、重現和剩餘邊界詳見 [R1–R9 驗證紀錄](REVIEW_R1_R9_2026-10-02.md)。原 Preview `6ac045607f1d78183c46e201` 是舊產品 source `4cb7fdf`，不能用來驗收本輪。此輪的新 Preview、emulator、獨立 reviewer 和最終 SHAs 必須以新證據填入；不得沿用上面的 PASS。正式 published deploy 在本輪 preflight 重新讀得 `6abf52a7be775989aeaab09d`，尚未發送任何 production 發布。

本輪完整站 draft 的實際瀏覽器試用另發現 configured Preview 的本機模式無法在深層網址刷新後恢復，已補同分頁模式記憶與登出／Auth 清除；replacement Preview 及 source-matched CI 結果以 authority 最終收據為準。不要把先前成功的 HTTP route probe 取代實際 browser reload 驗證。
