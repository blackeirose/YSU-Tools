# Travel Planner UX/Gemini — current handoff

> **目前交接（2026-10-07 04:19 UTC）：Full Gate NOT PASS，新版尚未正式發布。** [最新 Gate 五筆 AI 對帳與整批額度表](UPGRADE_GATE_2026-10-03.md)：同一 campaign 12 筆保守預留 US$1.20／已授權 US$2.00，剩餘 US$0.80；確認實際 Netlify 帳單金額仍未知。舊 `4ccd802` Preview 的文字 provider HTTP 200 但產品操作未被接受、vision HTTP 400 未留錯誤 body；東京背景三階段 HTTP 200，私有上／下圖 Blob 存在且同源刷新可讀，不能冒稱新版跨 context PASS。新版 `3c97b2d`／完整站 [Preview `6ac584df1801b9eafb089249`](https://6ac584df1801b9eafb089249--ycsu-tools-router.netlify.app/travel-planner/) 的 CI 已過、正式站仍為 `6ac2c370d1409615f07878bd`。必要剩餘 Preview／正式 smoke／一次有理由的圖片重試上界 US$1.31；比現有 headroom 多 US$0.51，最多另增 US$0.60 是待決提案，**未獲本次訊息授權**，每日 US$1 不變。舊成功背景的 provider 證據沿用，不因換網址額外探索性生成；新版獨立 Blob／輪詢及 production `v1` 仍須真實驗證。最終 hostname Firebase 確認、獨立 context 真離線衝突、200% zoom、真人麥克風及必要 AI 尚未 PASS。保留所有帳本、Owner 私人 pending/conflicts 和兄弟工具，不更新 MAIN／Tracker。\n\n

---

> **歷史交接（2026-10-06 23:45 UTC）：Full Gate NOT PASS，新版未正式發布。** 現行可重建產品來源為 [PR #3 commit `3c97b2d`](https://github.com/blackeirose/YSU-Tools/commit/3c97b2df1b425a98732df9fe5d066ef3097b1841)，[來源一致 CI 37545390444](https://github.com/blackeirose/YSU-Tools/actions/runs/37545390444) PASS，完整站 [Preview `6ac584df1801b9eafb089249`](https://6ac584df1801b9eafb089249--ycsu-tools-router.netlify.app/travel-planner/) 遠端隔離驗證 PASS。發布 authority 為 PR #23 `9ef2756` 的精確 tree，正式 deploy 仍為 `6ac2c370d1409615f07878bd`。舊登入 Preview 的 `FG 054ce24` 合成旅程新增四筆編輯／移日／排序／刪除衝突項目並刷新讀回；這只是 Remote 前準備，並非新來源真實離線 PASS。Firebase 新精確 hostname 尚需當下確認。AI campaign 目前 US$1.20／US$2.00 保守預留，實際費用未知；整批剩餘上界 US$1.31，另增最多 US$0.60 僅為待批准提案，每日 US$1 未變。真實雙 context 離線、文字／音訊／vision／私有背景及 200% zoom 仍須驗收。不要發布或改 MAIN／Tracker；詳見[最新 Gate](UPGRADE_GATE_2026-10-03.md)及[單次 Remote 手冊](REMOTE_FINAL_GATE_RUNBOOK_2026-10-06.md)。

---
> **歷史交接（2026-10-06 21:36 UTC）：Full Gate NOT PASS，新版未正式發布。** 產品 runtime [commit `4ccd802`](https://github.com/blackeirose/YSU-Tools/commit/4ccd80297c8c2ac297a80ed2777a0ba2b2ecd62b) 已在[完整站隔離 Preview `6ac56a1df33fad04f496bf40`](https://6ac56a1df33fad04f496bf40--ycsu-tools-router.netlify.app/travel-planner/)，[來源一致 CI 37534792620](https://github.com/blackeirose/YSU-Tools/actions/runs/37534792620) 通過，獨立來源複審無剩餘 P1/P2。發布 authority `87a1277` tree 核對完成；從正式 `6ac2c370d1409615f07878bd` 保留 322 檔／六兄弟 Functions，驗證 326 檔／九 Functions；正式站未改。Owner 核准同一 AI campaign 累計 US$2、每日 US$1 不變；舊 US$0.66 預留及未知費用保留，尚無新付費呼叫。精確新 hostname 仍待 Firebase 操作當下核准；真實雙 context 離線衝突、AI／私有雙片背景與 200% zoom 未 PASS。舊 Preview 登入和線上同步不作新版驗收。見[最新 Gate](UPGRADE_GATE_2026-10-03.md)與[單次 Remote 手冊](REMOTE_FINAL_GATE_RUNBOOK_2026-10-06.md)。

---

# Travel Planner V1 — 隔離試用交付

n\n> **歷史交接（2026-10-06 11:50 UTC）：Full Gate NOT PASS，新版未正式發布。** 產品 [PR #3](https://github.com/blackeirose/YSU-Tools/pull/3) 已加入**尚未部署**的 Planner 專屬預算防護：campaign key 遺失時 fail closed、未來 Owner 明確增額的同一 CAS 留下 grant 紀錄，以及每 UTC 日 US$1 的最壞情況上限。當前程式授權 cap 仍是 US$1，未新增付費呼叫。隔離完整站 [Preview `6ac487b0af93e64fa83bd095`](https://6ac487b0af93e64fa83bd095--ycsu-tools-router.netlify.app/travel-planner/) 仍跑舊的本機標記 `be5384b`／GitHub 同 tree `a11fae8c`，不是新 PR HEAD；詳見[候選來源雜湊對照](CANDIDATE_PROVENANCE_2026-10-06.md)。[CI 37418271635](https://github.com/blackeirose/YSU-Tools/actions/runs/37418271635) 只涵蓋該舊 runtime。新預算碼本機 typecheck 與 47 個受影響測試通過；獨立 reviewer 找到並複核修正每日上界 P1，在限縮來源範圍無剩餘 P1/P2，並非 live Gate PASS。Netlify campaign 即時讀回保守預留 US$0.66／可用 US$0.34；Firebase UTC 10/06 日額估值 US$0.36；實際帳單未知。剩餘整批上界 US$1.31，另增最多 US$1 仍待 Owner 決定。正式 deploy 最後讀回仍為 `6ac2c370d1409615f07878bd`；發布 authority [PR #23](https://github.com/blackeirose/social-capture-tool/pull/23) 無變更。新候選需在額度決定後以 GitHub 可取得來源建置、再處理唯一精確 Firebase hostname 和一次 Remote；真實離線衝突、文字／語音／vision／雙片私有背景仍未通過。**不得將舊 Preview 或作者自查宣稱為發布資格。** 最新分項見[Upgrade Gate](UPGRADE_GATE_2026-10-03.md)。

> **歷史交接（2026-10-06 05:35 UTC）：Full Gate NOT PASS，新版未正式發布。** 新的[完整站隔離 Preview](https://6ac487b0af93e64fa83bd095--ycsu-tools-router.netlify.app/travel-planner/) deploy `6ac487b0af93e64fa83bd095`、產品 runtime `be5384b454531b5e7777fda0365f245f94466d04`，與產品 PR #3 的程式來源 commit `a11fae8c035f42cb4e3c981c5dbc5b30f6a98414` tree 相同；後續 commit 只改文件。[來源對應 CI 37418271635](https://github.com/blackeirose/YSU-Tools/actions/runs/37418271635) 通過；canonical 完整站驗證通過 326 static／九個 Functions、UMS 與兄弟路由、深層網址、PWA scope、匿名 API 401。新 Preview 本機合成東京示範的深層網址刷新通過，**雲端登入與付費 AI 尚未在此精確 hostname 驗收**；需依 Computer Use 規則於操作當下確認新增該網域並讀回。舊已登入 Preview `6ac46a5f1273483233b160e0` 的 Chrome 與獨立 Codex context 保留三筆合成衝突項目，等待 Chrome 單分頁 Offline／Online 與恢復測試，並未宣稱離線 PASS。背景兩次 HTTP 400 的 provider body 未留，根因不能還原；新的白名單診斷、同版 400 阻止盲重試、部分圖片保存及 135 unit／獨立來源審查通過，但真實圖片／私有 Blob 仍未通過。Netlify Blobs campaign 於本輪讀回保守預留 US$0.66、剩餘 US$0.34；整批必要新呼叫上界 US$1.31，建議一次另增最多 US$1.00，**尚未授權**且每日 US$1 不變，實際費用未知。本輪未付費呼叫、未改兄弟工具／共用規則／Owner 私人資料；最近正式 deploy `6ac2c370d1409615f07878bd`。完整費用表與 Gate 見[目前 Gate](UPGRADE_GATE_2026-10-03.md)。以下皆為歷史交接。

> **目前交接（2026-10-06 05:10 UTC）：Full Gate NOT PASS，production 未更新。** 已從 Netlify 兩個部署的 Function 日誌定位背景圖片 HTTP 400：`bbdb17dc-3339-466d-a549-89f17e26a554`（2026-10-05 23:38 UTC）及 `e4e909e7-265b-4a0e-8b9b-9025d69507fb`（2026-10-06 03:06 UTC）均在 `photo`；地標成功、`relief` 未送。舊 response body 未留存，根因不可還原，現版 `imageConfig.aspectRatio=3:2` 只有官方契約與 mock 驗證。此本機修正將後續錯誤只記錄白名單欄位與有效 token 數，對同版 400 阻止再次付費請求，並保留已產出的第一片。typecheck、Vite build、135 unit PASS；獨立來源 reviewer 指出的用量 metadata 缺口已修、17 個受影響測試重跑 PASS。**程式修正已在產品 PR #3 commit `23b7ea6e1a8f203b5296b1d976ea91caa6a7c2c5`；尚待此來源的 CI 與新 Preview，不可當成目前 Preview 功能。** 仍可登入的完整站[隔離 Preview](https://6ac46a5f1273483233b160e0--ycsu-tools-router.netlify.app/travel-planner/) 維持 `6ac46a5f1273483233b160e0`／產品 runtime `58fd9d3a91f4f1c6514baa55dea01d05d42ed08a`；最近讀回 production `6ac2c370d1409615f07878bd`。Netlify Blobs 於 2026-10-06 05:10 UTC 讀回新增 US$1 campaign 保守預留 US$0.66、剩餘 US$0.34；實際費用未知。必要整批測試含 Preview 文字／語音／圖片匯入／完整兩片背景、正式文字與背景 smoke、一次圖片重試，保守上界 US$1.31，尚差 US$0.97；**建議一次增加最多 US$1.00，但尚未獲批准且不得送出付費請求**。真實單分頁離線衝突、200% 縮放、真人麥克風、成功私有 Blob／正式 AI 仍未驗收。兩個獨立登入 contexts 已讀回三筆新建合成衝突項目；精確 Remote 步驟與逐項費用見[目前 Gate](UPGRADE_GATE_2026-10-03.md)。不清除 Owner 私人資料，不更新 MAIN／Tracker，不發布新版。以下均為歷史交接。

> **歷史交接（2026-10-06 03:32 UTC）：Full Gate NOT PASS；新版未正式發布。** 目前完整站[隔離 Preview](https://6ac46a5f1273483233b160e0--ycsu-tools-router.netlify.app/travel-planner/) deploy `6ac46a5f1273483233b160e0` 鎖定產品 runtime `58fd9d3a91f4f1c6514baa55dea01d05d42ed08a`；[CI 37408729366](https://github.com/blackeirose/YSU-Tools/actions/runs/37408729366) 通過，獨立 reviewer 對最後背景請求／付費防護的限縮來源審查無 P1/P2。以正式 baseline `6ac2c370d1409615f07878bd` 組裝，完整站遠端驗證 326 檔、九個 Functions 與兄弟路由，正式 deploy 保持不變。Owner 核准的精確 Firebase hostname 已查重、新增並讀回；Chrome 與獨立 Codex context 登入同一合成旅程，新增、移日、Undo、深層刷新和反向雲端讀回通過。背景現在只在按下「生成背景」後執行，刷新登入不會在新 Preview 重複付費。前兩次真實圖片服務均 HTTP 400，最終 3:2 請求尚無成功圖片／私有 Blob 證據。新增 US$1 AI 測試額度保守預留 US$0.66、剩餘 US$0.34；歷史與兩次 HTTP 400 的實際費用未知。真實單分頁離線衝突、語音、圖片匯入、背景、200% 縮放及實體 iPhone/Safari 未完成，**不可發布**。兩個 contexts 已準備合成旅程等待 Remote 的單分頁 Offline/Online 操作；不得清除任何 Owner 真實舊 origin pending/conflicts。詳見[目前 Gate](UPGRADE_GATE_2026-10-03.md)。以下為歷史交接紀錄，不代表目前版本。

> **Current 21:18 UTC checkpoint — Full Gate NOT PASS.** [New complete-site Preview](https://6ac412e3c5002ab9e6196bbf--ycsu-tools-router.netlify.app/travel-planner/) deploy `6ac412e3c5002ab9e6196bbf` runs product runtime `ae0d42b57187ae529199ec64c72943c940b7d445`. Exact-source local validation passed 123 unit, 9 Firestore rules and 7 Chrome emulator browser cases; live Preview pointer-only date move/Undo/refresh and synthetic local-mode layouts at 1440/1366/390/320px passed. Canonical shared-host validation retained 326 files and nine Functions; production stayed `6ac2c370d1409615f07878bd`. The new Preview hostname is absent from Firebase Authorized Domains, so this runtime's authenticated cloud/offline and paid AI modes remain unaccepted. Existing Oct 4–5 conservative reservations total US$1.21, but actual Planner cost and cumulative US$5 upper bound remain unknown. GitHub Actions runner acquisition failed before steps; local PASS must not be called hosted CI PASS. No paid call, production promotion, shared-rule change, sibling change, MAIN/Tracker update or Owner private-data cleanup occurred. Preserve all prior origin pending/conflicts; prior 06:36 cloud evidence belongs to the older authorized runtime `ac2f023e`. A real old-shell (`ac2f023e`) to new-shell (`ae0d42`) same-origin synthetic local upgrade passed after closing the old client: old Planner cache removed, sibling cache and trip data preserved. Ordinary Photon place search also passed in local Preview; neither is live cloud-offline or paid AI source proof. See the [current Gate](UPGRADE_GATE_2026-10-03.md).

> **最新實測（2026-10-05 06:36 UTC）：** 同一合成安排在 Codex IAB 與 Windows Chrome 同時開啟編輯，IAB 先存 A，Chrome 的舊版本 B 儲存被明確拒絕且草稿保留；Chrome 重開最新版本後手動合併 A｜B，IAB 已獨立讀回兩段完整備註並顯示「已同步」。此為**線上同項衝突可恢復 PASS**，真實瀏覽器離線回連及移日／排序／刪除衝突仍未驗證。新 Preview、runtime 和正式站版本沿用下述 06:26 UTC 狀態；Full Gate NOT PASS，未發布新版。

> **最新實測（2026-10-05 06:26 UTC）：** 新 Preview 精確 hostname 已加入 Firebase Authorized Domains 並讀回。[完整站隔離 Preview](https://6ac33f299da97d91b71b4b61--ycsu-tools-router.netlify.app/travel-planner/) 的產品 runtime `ac2f023e`，已在 Codex IAB 與 Windows Chrome 兩個獨立 contexts 正常登入 Owner 帳號並顯示「已同步」。合成項目雙向新增、跨日移動／Undo、日期縮短使兩筆固定安排移至待定／Undo 恢復、原時區與付款／取消截止保留、深層刷新均有實際雲端讀回。舊 Preview 日期縮短 Undo 的失敗已在新來源修復並重測；滑鼠原生選單展開未取得可靠畫面，日期選取是點擊後以鍵盤完成。真實離線回連／同項衝突、付費 AI 各模式與私有 Blob、200% 縮放及實體 iPhone 仍未驗收。**Full Gate NOT PASS；正式站未發布新版。** 以下 06:13 UTC「目前」段落為較早 checkpoint，勿當最新狀態。

> **目前交接（2026-10-05 06:13 UTC）：** [新完整站隔離 Preview](https://6ac33f299da97d91b71b4b61--ycsu-tools-router.netlify.app/travel-planner/) `6ac33f299da97d91b71b4b61` 對應產品 runtime `ac2f023e2f3c27e7b1370c2a33a3737ced7fda7e`、[Draft PR #3](https://github.com/blackeirose/YSU-Tools/pull/3)。[CI 37270788373](https://github.com/blackeirose/YSU-Tools/actions/runs/37270788373) 通過 115 unit／9 rules／7 emulator browser、typecheck 與 build；獨立 reviewer 對 AI 選取目標防護及資料／發布隔離給出**限縮來源審查 PASS**。完整站遠端驗證 326 檔／9 Functions，兄弟工具、路由與排程保留；正式站仍為 `6ac2c370d1409615f07878bd`，未部署新版。本機合成示範可在新 Preview 試日期、地圖、深層網址刷新、390／320px 手機版；本機模式**不跨裝置**。新 hostname 尚未加入 Firebase Authorized Domains，故新來源的雲端離線衝突、音訊、圖片辨識、背景生成／私有 Blob 仍未完成真實驗收；Full Gate **NOT PASS**。本輪只需先授權該精確 hostname，勿貼密碼或 token；不清除任何舊 origin 私人 pending／conflicts。10/5 UTC 保守 AI 預留 US$0.27，實際費用未知。下列舊「目前」段落皆為歷史 checkpoint。

> **排序衝突補測（2026-10-05 04:28 UTC）：** [CI 37263447650](https://github.com/blackeirose/YSU-Tools/actions/runs/37263447650) 於測試來源 `e28df073` 通過 typecheck、build、108 unit、8 rules、7 emulator browser。新增合成雙 context 離線排序／刷新、同項遠端備註、同 ID 雙版本備份、明確採用遠端及再排序後備註保留。獨立 reviewer 複核修緊的斷言；**只屬 emulator 源碼與操作證據**，不等於目前 Preview 的真人登入／雲端離線驗收。Preview runtime 仍為 `5e9880d`，Full Gate 未通過，正式站未發布新版。


> **Emulator 補測（2026-10-05 04:21 UTC）：** [CI 37262976480](https://github.com/blackeirose/YSU-Tools/actions/runs/37262976480) 於測試／文件 HEAD `b588ac7c` 通過 typecheck、build、108 unit、8 rules、6 emulator browser。新增第六個案例在**相同 origin**植入合成舊版 pending，驗證隔離衝突、下載含本機／遠端版本的備份、採用遠端版本後刷新及另一 context 後續同步。未碰 Owner 舊 origin 私人資料，也未實跑舊版 app／SW 或證明舊移日自動重播；這些不得標 PASS。Preview runtime 仍為 `5e9880d`，Full Gate 未通過，正式站未發布新版。


> **接續審核（2026-10-05 04:15 UTC）：** 產品 runtime `5e9880d`、完整站隔離 [Preview `6ac2d52a8b3b09627e4a347b`](https://6ac2d52a8b3b09627e4a347b--ycsu-tools-router.netlify.app/travel-planner/) 與正式站 `6ac2c370d1409615f07878bd` 均未改。精確新 Auth 網域查重後仍不存在，已請求 Computer Use 操作當下確認；舊 Preview 的雙 context 證據不能移作新版。新版正常瀏覽器的 Photon 搜尋回傳結果，TOWER 直連 403 不能證明 Function 受阻，Function 來源核對仍待實測。57 項聚焦 storage／Gemini／背景／PWA 測試通過，但為 mock／unit。UTC 10/5 的 Preview 額度文件尚未建立；10/4 US$0.94 是保守預留非帳單，團隊模型 credits 無法歸屬 Planner。雲端離線衝突、付費 AI／Blob、200% 與實體 iPhone 尚未驗收，**Full Gate NOT PASS，沒有升級版正式發布**。保留舊 origin 私人資料和新版 UMS baseline。


> **最新交接（2026-10-04 15:50 PDT）：** 新版產品 runtime `5e9880d` 的完整站隔離 [Preview](https://6ac2d52a8b3b09627e4a347b--ycsu-tools-router.netlify.app/travel-planner/)（deploy `6ac2d52a8b3b09627e4a347b`）已從當時正式站 `6ac2c370d1409615f07878bd` 組裝並通過遠端完整站／兄弟工具／9 Functions 驗證。CI [37238970637](https://github.com/blackeirose/YSU-Tools/actions/runs/37238970637) 通過 108 單元、8 rules、5 emulator browser 及 build/typecheck；獨立 reviewer 只對合成 Preview 的 Auth、離線佇列、相依修正、額度／去重、發布隔離給予限定 PASS。新版實際 1440／390／320px、本機新增／刷新、地圖、深層網址及 PWA 舊 shell 清理均通過。Firebase 現行規則全文唯讀雜湊 `41a93ced…` 與已審核 preview-v1 相同，未修改規則。此新版 hostname 的 Auth 精確網域仍待操作當下確認，因此舊 Preview 的雙 context 登入／同步 PASS 不可移作新版證據。付費 AI 與真實雲端離線／衝突未驗收，**Full Gate 未通過，正式站未發布新版**。今天 US$0.94 是保守預留，不是實際費用；真實 Planner 費用與 US$5 累計額度尚待核對。回復時保留私人 IndexedDB pending/conflict，正式組裝須重抓當時最新完整站，不可回灌舊站檔。


> **最新交接（2026-10-04 09:50 PDT）：** Owner 明確授權的精確新 Preview 網域已加入 Firebase Authorized Domains，Console 表格列讀回。此 [完整站隔離 Preview](https://6ac201713f7da5f9d3f390d5--ycsu-tools-router.netlify.app/travel-planner/) / deploy `6ac201713f7da5f9d3f390d5` / 產品 runtime `4b1c67b5e1fa8e28ed99fb0276fdeb1bf82af458` 現已在 Chrome 與獨立 IAB 兩個 browser contexts 正常 Owner 登入並顯示「已同步」；IAB 第一次連線失敗後按重試成功。新合成旅程及兩筆合成地點雙向新增、對側讀取、雙邊刷新保留通過。原生日期欄位的自動化 `fill()` 未觸發 React 事件；鍵盤操作後重繪保留，暫存表單已取消，不能以此判定產品日期缺陷。Netlify 正式 current deploy 讀回仍為 `6ac0989e1e8fabf48ee75360`。**Full Gate NOT PASS，未發布升級版**：付費 AI／背景 Blob、真正離線回連與舊 pending 恢復、200% zoom、實體 iPhone 仍未驗收。保留舊 origin 私人離線資料；本輪不更新 MAIN／Tracker。下方 00:45「尚未授權新網域」是歷史狀態，已由本段取代。詳見 [Gate](UPGRADE_GATE_2026-10-03.md) 與 [報告](RELEASE_REPORT_2026-10-03.md)。


> **最新交接（2026-10-04 00:45 PDT）：** [新隔離完整站 Preview](https://6ac201713f7da5f9d3f390d5--ycsu-tools-router.netlify.app/travel-planner/) `6ac201713f7da5f9d3f390d5` 對應產品 runtime `4b1c67b5e1fa8e28ed99fb0276fdeb1bf82af458`；其後 `8a10020` 只修正乾淨 browser context 的測試前置。發布 [CI 37185745756](https://github.com/blackeirose/social-capture-tool/actions/runs/37185745756) PASS，完整站遠端驗證 326 檔／9 Functions、兄弟路由與共用排程／流量規則保留、Planner PWA 範圍及匿名 API 401。1280px「更多→提醒中心」的實際滑鼠點擊、390/320px 首屏及深層網址刷新通過；102 unit PASS，browser 聚焦回歸 14 PASS，另 2 項跨分頁案例修正測試入口後 PASS。這個新主機尚未加入 Firebase Authorized Domains，**新 Preview 的雲端登入／同步／離線未驗證**；舊 Preview 的真人 Owner 同步證據不能替代新來源驗收。付費 AI／背景 Blob 因保守每日額度與先前實測缺口仍未通過。Full Gate **NOT PASS**，正式站 deploy 仍是 `6ac0989e1e8fabf48ee75360`；不更新 MAIN／Tracker，不清除舊 origin 的離線 pending/conflicts。詳見 [Gate](UPGRADE_GATE_2026-10-03.md) 與 [報告](RELEASE_REPORT_2026-10-03.md)。


> **前次交接（2026-10-04 00:00 PDT）：** [完整站 Owner Preview](https://6ac1f354869e054bf09986c9--ycsu-tools-router.netlify.app/travel-planner/) 仍是產品 runtime `d6e3a6e73d871ae2590cc6de7c33177cd8eda8d3`。產品 [CI](https://github.com/blackeirose/YSU-Tools/actions/runs/37182864577) 與修正版本釘選後的發布 [CI](https://github.com/blackeirose/social-capture-tool/actions/runs/37184360443) 均通過。真人 Owner 雙 context 合成資料新增／修改、跨日移動／Undo／刷新、旅程縮短→原日期可見的待定→Undo／刷新已驗證；真正雲端離線重連與舊 pending 恢復仍未驗證。Firebase Console 最新規則畫面已見 Planner 正式 `v1` 用量與 `aiRequests` 區塊，先前「v1 缺失」已過時，但發布前仍須完整規則差異及讀回。付費 Explore／語音／圖片辨識／背景與 Blob 未達真實驗收，保守每日額度目前阻擋重試。Full Gate **NOT PASS**，正式站仍為 `6ac0989e1e8fabf48ee75360`；本輪沒有 production deploy，也沒有更新 MAIN／Tracker。保留所有舊 origin 離線 pending/conflicts。

> **目前交接（2026-10-03 23:40 PDT）：** [最新完整站 Preview](https://6ac1f354869e054bf09986c9--ycsu-tools-router.netlify.app/travel-planner/) `6ac1f354869e054bf09986c9` 使用精確產品 runtime `d6e3a6e73d871ae2590cc6de7c33177cd8eda8d3` / [Draft PR #3](https://github.com/blackeirose/YSU-Tools/pull/3)，發布 authority 程式 commit `08ce504428baa9a91c685b8a0d077558c1858c5d` / [Draft PR #23](https://github.com/blackeirose/social-capture-tool/pull/23)。產品 [來源對應 CI](https://github.com/blackeirose/YSU-Tools/actions/runs/37182864577) 與完整站遠端驗證通過。Chrome 與獨立 in-app browser 的 Owner Google 登入均達「已同步」；合成行程雙向新增／修改與深層網址刷新保留已實測，390/320px 首屏有可見行程。AI 探索／背景在更早 Preview 失敗，本輪因保守每日額度停止付費重試；語音、圖片辨識、真實背景 Blob、雲端離線重連、200% 縮放及實體 iPhone尚未驗收。Full Gate **NOT PASS**，正式站仍是 `6ac0989e1e8fabf48ee75360`，沒有 production deploy。勿提升 Preview 或清除任何舊 origin 的離線 pending；詳見 [Gate](UPGRADE_GATE_2026-10-03.md) 與 [最新報告](RELEASE_REPORT_2026-10-03.md)。以下較早的「最新／目前」段落均為歷史紀錄。

> **歷史 UX/Gemini 隔離交接（2026-10-03 17:35 PDT）：** 可試用 [完整站 Preview](https://6ac19dbe1e7f0157bfeef08e--ycsu-tools-router.netlify.app/travel-planner/) `6ac19dbe1e7f0157bfeef08e`，產品 [Draft PR #3](https://github.com/blackeirose/YSU-Tools/pull/3) runtime `5f68efc`，publisher [Draft PR #23](https://github.com/blackeirose/social-capture-tool/pull/23) head `b7d4724`。用「本機模式」與「載入示範」可操作東京／跨年合成旅程；此模式**不跨裝置**。產品及完整站 CI、82 unit、55 Chromium browser、75 publisher tests、Preview-only rules readback、九 Functions 與兄弟工具保留驗證皆通過。Google popup 在 TOWER 未完成，所以真正 Owner 雲端同步、Gemini、圖片保存未驗收；Full Gate NOT PASS，**不發布正式版**。正式站仍是 `6ac0989e1e8fabf48ee75360`。新版 `v1` 付費 AI 必須先補受審查的 production `aiRequests` 規則與實測。參考 [Gate](UPGRADE_GATE_2026-10-03.md) 與 [release report](RELEASE_REPORT_2026-10-03.md)；下方舊草稿僅為歷史。

> **歷史 2026-10-03 UX/Gemini 升級交接（本檔下方 V1 歷史段落保留）：** [本輪隔離 Preview](https://6ac1921df800e63bc4e905cb--ycsu-tools-router.netlify.app/travel-planner/) 已 ready；產品 runtime `42cf4cbe95cfdcc40f9cec2322f9afa9a8763c66` / [Draft PR #3](https://github.com/blackeirose/YSU-Tools/pull/3)，共用站 authority `f438e47de8c83de192ffaef609d19ae4189a3875` / [Draft PR #23](https://github.com/blackeirose/social-capture-tool/pull/23)。Owner 可用合成東京示範在本機模式試切日期、移日／Undo、地圖、匯入預覽；本機模式不跨裝置。產品與發布 CI、完整站隔離、Preview rules/hostname 和本機操作通過；真人 Preview 登入、Gemini 文字／音訊／視覺、真實背景生成／跨裝置、真實雲端離線仍 UNVERIFIED。Full Gate 未通過；本輪沒有 production deploy。正式站維持 `6ac0989e1e8fabf48ee75360`。詳見 [最新報告](RELEASE_REPORT_2026-10-03.md) 與 [Gate](UPGRADE_GATE_2026-10-03.md)；舊 Preview 不能驗收本輪。

> **Historical upgrade checkpoint, 2026-10-03:** `feature/travel-planner-ux-gemini-20261003` is an isolated UX/Gemini candidate. This file retains V1 release history below. For this new source, use [Full Gate](UPGRADE_GATE_2026-10-03.md) and [upgrade report](RELEASE_REPORT_2026-10-03.md). No 2026-10-03 upgrade Preview or production deploy has been made, and the local development URL is not a persistent Preview. The 2026-10-02 production deployment remains live. Do not use prior V1 Preview or emulator PASS as proof that Gemini, background images, import vision or the new cloud rules work.

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

> **16:00 PDT 補充：** 新版同一 draft 的合成本機操作實測：東京旅程延長至 1/10、縮至 1/7 時 1/8 行程帶原日期進待定、固定預約 13:00 Asia/Tokyo 保留、Undo 後刷新保留；新增的付款與取消截止也刷新保留。這不是雲端離線驗收。現用 Photon 地點來源在 TOWER 第一筆唯讀東京查詢回 HTTP 403；未降低來源驗證，也未改走其他端點。受管理環境的語音合成聲音無法選取，真實音訊／麥克風未驗證。


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

