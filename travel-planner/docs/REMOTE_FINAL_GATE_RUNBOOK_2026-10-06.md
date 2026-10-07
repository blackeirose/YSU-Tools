# 最終候選的單次 Remote 驗收手冊（2026-10-06 準備稿）

> **目前準備狀態（2026-10-07 13:00 UTC；仍非真離線 PASS）：** 固定 [Planner 測試入口](https://travel-planner-review--ycsu-tools-router.netlify.app/travel-planner/) 對應 draft `6ac63fadf5def9047a6c4eb0`、產品 runtime [`91a05e4`](https://github.com/blackeirose/YSU-Tools/commit/91a05e4364816a29693103746057ab5b442f1958)、[CI 37622619838](https://github.com/blackeirose/YSU-Tools/actions/runs/37622619838)。Firebase 已查重並只授權此固定 hostname，IAB 已正常登入、讀取 `FG 054ce24` 合成旅程並顯示 `已同步`。四筆衝突測試項目仍在 2030-01-06、備份在 `.private-integration/synthetic-fg-conflict-backup-20261007.json`（本機私有，不提交）。另一個 IAB 分頁不等於獨立 context；目前 Computer Use 庫存沒有可控制的 Chrome extension。因此 Owner Remote 只需先在 Windows Chrome 開啟下述固定深層網址並正常登入，待兩邊 `已同步` 後做單頁 Offline→Online、200% 縮放及真人麥克風，agent 完成所有資料操作、判讀及恢復。當前 vision 及背景在 IAB 真實成功、刷新保留；跨 context 私有 Blob 讀回仍待 Chrome。Campaign 20 筆／US$1.92 保守預留、US$2.60 累計上限、UTC 每日 US$1.00，實際帳單未知；真人語音的預估上界可容納在目前剩餘授權內，尚未預留或發送。

**Chrome A 精確網址：** https://travel-planner-review--ycsu-tools-router.netlify.app/travel-planner/trips/634adbf2-25f5-4c79-b15b-61ac5053270b/day/2030-01-06 。**IAB B** 已在同一網址。Owner 先正常登入 Chrome A 並保持分頁；不要清除任一瀏覽器儲存、不要關閉整台 TOWER 網路。Agent 看到兩個 contexts 同帳號、同四筆合成項目、`已同步` 並完成初始讀回後，才會請 Owner 把 **Chrome A 的 DevTools → Network 單頁**切成 Offline。完成 A 離線編輯／刷新及 B 在線衝突後，agent 才通知切回 Online。資料恢復與雙向刷新完成後，Owner 將 Chrome 設真正 200% Zoom、由 agent 檢視操作，再還原 100%；最後依頁面提示授權麥克風說合成短句。這些是一次 Remote 的順序，不能先把單一 IAB 的測試記成雙 context PASS。

---

## 歷史準備稿（舊不可變候選，勿再要求其 Firebase 網域）

> **目前準備狀態（2026-10-07 06:50 UTC；仍非驗收 PASS）：** 最終候選現為 runtime [`601cb065`](https://github.com/blackeirose/YSU-Tools/commit/601cb065365425b705e86d2292787247a24d4fe3)、[CI 37582701804](https://github.com/blackeirose/YSU-Tools/actions/runs/37582701804) 及完整站 [Preview `6ac5eb36716fa0a41443535b`](https://6ac5eb36716fa0a41443535b--ycsu-tools-router.netlify.app/travel-planner/)。精確 hostname `6ac5eb36716fa0a41443535b--ycsu-tools-router.netlify.app` 已查重，仍待 Firebase 操作當下確認、加入及讀回。Chrome 擴充功能現可讀取舊版登入分頁，最終候選的獨立 context 尚未登入。以下 Remote 只在新候選兩個 context 都已登入、合成旅程與備份讀回後執行；舊 `6ac5ce...` 不可充當新版驗收。Chrome 工具目前未提供單分頁 Offline 或瀏覽器真實 Zoom 控制，所以保留 Owner 最少的 Offline/Online、200% 與真人麥克風操作；資料操作和結果判讀仍由 agent 負責。舊版圖片匯入 HTTP 400／`INVALID_ARGUMENT` 的 US$0.06 預留保留；目前 campaign 13 筆／US$1.26 保守預留，實際帳單未知。

---

> **歷史準備稿：**

> 此手冊是**待執行步驟**，不是通過證據。最終候選產品 runtime [`4c62bec6e50a56164c5ab85246869d1171bb358f`](https://github.com/blackeirose/YSU-Tools/commit/4c62bec6e50a56164c5ab85246869d1171bb358f)、來源一致 [CI 37571986648](https://github.com/blackeirose/YSU-Tools/actions/runs/37571986648) 與完整站 [Preview `6ac5ce500adc8a3a5baff6fd`](https://6ac5ce500adc8a3a5baff6fd--ycsu-tools-router.netlify.app/travel-planner/) 已驗證。精確 hostname `6ac5ce500adc8a3a5baff6fd--ycsu-tools-router.netlify.app` 已查重、尚待 Firebase Authorized Domains 的**此網域專屬**操作當下確認、加入及讀回。四筆合成衝突項目已在同一 `preview-v1` namespace 的舊授權 Preview 建立並刷新讀回；最終版仍須登入與真離線測試。Owner 已批准同一 campaign 再增最多 US$0.60、累計 US$2.60、每日 US$1.00 不變；線上帳本仍有 12 筆／US$1.20 保守預留，第二 grant 將隨首次新呼叫原子記錄。Chrome 原生控制目前回報 Access is denied；若仍無法使用，Owner 只需依下表操作單頁 Offline／Online、200% zoom 與真人麥克風，agent 負責資料與判讀。

## Agent 在 Remote 前完成

1. 對最終候選核對 `/travel-planner/version.json`、Function digests、PWA scope、完整站兄弟工具與正式 deploy 不變。只使用 `preview-v1` 的合成旅程 `FG 054ce24`；不要清除 Owner 舊 origin 的 IndexedDB pending/conflicts。
2. 在 **Chrome context A** 與 **Codex in-app browser context B** 各自正常登入同一帳號，打開該旅程同一天，確認兩邊 `已同步`。兩個 context 是獨立瀏覽器儲存，不以同一瀏覽器兩個 tab 代替。
3. 核對或新建四筆明確標為「合成」的可操作項目，分別供備註編輯、跨日移動、排序、刪除衝突；每筆先在 B 讀回。另備份旅程 JSON，以免驗收操作留下難辨認狀態。檢查固定預約、原時區與付款／取消截止在同旅程中可讀。
4. 記下各項初始 day、order、status、note、revision 與待同步數；保留 B 在線。只在此時請 Owner 進入 Remote，不讓 Owner 自己找分頁或設計資料。

## Owner 唯一必要操作與 agent 觀察

| 時點 | Owner 在 TOWER 做的事 | Agent 完成與判讀 |
| --- | --- | --- |
| 1 | 將**目前最終候選的 Chrome A 單一分頁**在 DevTools → Network 設為 **Offline**，回覆「A 已離線」。不要關閉整台網路。 | 在 A 以合成資料做新增／編輯／移日／排序，刷新 A，確認待同步及每個本機值仍可見；B 保持在線並對相同項目做另一版本編輯、移日、排序或刪除，讀回 B 已同步。分別記錄四種衝突的來源、值、時間。 |
| 2 | Agent 明確通知「離線資料和 B 衝突已備妥」後，把 Chrome A 同一分頁切回 **Online**。 | A 回連須顯示可理解的衝突，兩版本及備份可取得；逐一恢復／合併，保留備註、日期、排序、固定預約與截止。確認 A 可繼續同步，B 獨立讀回一致；兩邊刷新再驗證。任何靜默覆寫為 FAIL。 |
| 3 | Agent 宣布資料測試完成後，將 Chrome 目前分頁透過瀏覽器選單設 **200% Zoom**；測完再回 **100%**。 | Agent 以實際 Chrome 縮放讀回或畫面證據驗證桌機操作與無關鍵控制項遮蔽。窄 viewport、CSS scale 或 DevTools device emulation 不能代替。 |
| 4 | 僅在額度／來源符合 Gate 後，允許該 Preview 麥克風並說出預先顯示的合成短句，例如「把合成書店移到十月七日下午」。 | Agent 檢查送出音訊、辨識文字、歧義提示或正確草稿、明確確認後保存、另一 context 讀回與 Undo。真人麥克風與先前合成音訊測試分開記錄。若需瀏覽器 permission，依平台當下確認。 |

## 固定判讀與界線

- 背景生成、文字、vision、Explore 的付費或非付費 Gate 由 agent 在已核准預算內依 [Upgrade Gate](UPGRADE_GATE_2026-10-03.md) 執行，不交給 Owner 點擊試錯。舊 Explore 有來源卡片若相關執行程式未變，可在新候選只做保存與同步回歸。
- 同 origin 合成舊 pending 升級已有 emulator 證據；若無安全可用的真實舊 pending，不碰 Owner 的私人資料，也不把跨 Preview origin 當成同 origin 升級。
- 真實 iPhone 安裝／Safari／鎖屏或真人裝置通知若未由 Owner 實測，標 **UNVERIFIED**；不以 390px viewport 或桌機麥克風冒稱。
- 任一測試 FAIL 先保留兩版本與備份，修復後批次建立最少的新 Preview 並只重驗受影響範圍。若涉及新 hostname，再依 Computer Use 操作當下確認精確網域。
- 全程不改 DNS、兄弟工具、正式私人資料、共用安全規則；正式發布需 Preview Full Gate 與獨立審查先通過。
