# 最終候選的單次 Remote 驗收手冊（2026-10-06 準備稿）

> 此手冊是**待執行步驟**，不是通過證據。當前候選產品 runtime [`3c97b2df1b425a98732df9fe5d066ef3097b1841`](https://github.com/blackeirose/YSU-Tools/commit/3c97b2df1b425a98732df9fe5d066ef3097b1841)、來源一致 [CI 37545390444](https://github.com/blackeirose/YSU-Tools/actions/runs/37545390444) 與完整站 [Preview `6ac584df1801b9eafb089249`](https://6ac584df1801b9eafb089249--ycsu-tools-router.netlify.app/travel-planner/) 已驗證。精確 hostname `6ac584df1801b9eafb089249--ycsu-tools-router.netlify.app` 尚待 Firebase Authorized Domains 的**此網域專屬**操作當下確認、查重、加入及讀回；舊 `6ac56...` 核准不能代用。四筆合成衝突項目已在同一 `preview-v1` namespace 經舊授權 Preview 建立並刷新讀回；尚未做真實離線測試。Owner 已批准 campaign 累計上限 US$2.00、每日 US$1.00 不變，但整批剩餘保守上界 US$1.31 大於帳本剩餘 US$0.80；追加額度僅為待批准提案。若額度變更造成新 runtime，本手冊的候選 URL 與 CI 必須先更新再讓 Owner Remote。

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
