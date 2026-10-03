# YSU Travel Planner 獨立審查結案

日期：2026-10-02。審查方式：獨立唯讀程式碼與回歸測試檢視；沒有修改實作、部署或重新執行整套測試。

**結果：PASS（以下指定程式碼審查範圍）。** 產品 revision `c97589fe`；共享發布 authority revision `ac875468`。Canonical Core 入口與必要 Gate／服務／工作流程規則已核對。

已修正並複核的四項 findings：

1. **Stale drawer 草稿覆寫：RESOLVED。** `makeOperation` 檢查原 revision；過時草稿拒絕保存。Undo 與使用者明確選擇的 rebase 各自使用已驗證基準，不以任意最新 revision 繞過草稿檢查。
2. **網路持鎖阻塞離線保存：RESOLVED。** 網路等待使用 sync lock；state lock 限制於短時間讀寫。成功回覆重新讀最新 pending，只移除已確認 operation，保留等待期間新增操作。已檢視 stalled commit 回歸測試。
3. **Session recovery 原子性：RESOLVED。** `clearWithRecovery` 在同一 state lock 內讀取最新持久快照並清理，避免尚未收到 BroadcastChannel 的操作遺失。恢復驗證 owner，預覽／正式 namespace 與 project 分隔本機 cache。已檢視 stale broadcast 與不同 owner 拒絕恢復測試。記憶體 recovery 仍依賴該分頁存活，不能視為永久備份。
4. **CA traffic policy 被常數重建：RESOLVED。** Planner draft 精確保留 inventory 的 `traffic_rules`／`trafficRules`；CA 欄位缺少或矛盾時建立 draft 前阻擋。驗證比較 baseline、candidate 與 receipt 三者。已檢視 missing／ambiguous／custom policy 測試。

PASS scope 亦包括已閱 preview-v1 最小 Firebase rules 合併、兄弟規則保留、完整站點 baseline 檔案保護、/travel-planner/ scoped fragments、manifest／SW scope，以及 preview 不可 promotion 的防護。此審查範圍未發現剩餘重大程式碼問題。

驗證界線：作者提供產品 27 unit PASS、authority 66 PASS／1 原有 skip，以及產品 emulator run `37063922214` PASS（rules 與獨立 contexts）。這些是作者／CI 證據，非本審查另行重跑。作者回報 preview rules 已套用並刷新讀回 hash 相符；本報告不將此回報轉稱獨立 live acceptance。

本報告不宣稱 production acceptance、正式部署、live Google 登入／跨裝置驗收、實體 iPhone 安裝／鎖屏推播通過，也不構成 production deploy 或 merge 授權。後續影響上述範圍的實作變更須重新驗證。

補充：已唯讀複核 prepare_static 在重新確認 baseline 後、建立 draft 的 API POST 前使用 SCRATCH.mkdir(parents=True,exist_ok=True)。此本機恢復性修正適當，先行建立 receipt 目錄，不改變發布模式或權限；此小範圍程式碼審查 PASS。


## 附錄：Netlify live inventory `tr` wire mapping 複核

2026-10-02 獨立唯讀複核最新 `traffic_wire`／`traffic_rules` 與針對性測試，並對照已安裝官方 Netlify CLI 27.10.2 `utils/deploy/hash-fns.js` 的 trafficRulesConfig。

結果：**PASS（此修正範圍）**。只將 `rateLimitConfig`、`windowLimit`、`windowSize` 轉為 API wire snake_case；值、algorithm、aggregate 與未知欄位保持，deepcopy 不修改 inventory。接受 `tr`／`trafficRules`／`traffic_rules`，正規化後若 aliases 矛盾即拒絕，不補預設節流政策。新增測試包含自訂 37／90、未知欄位、alias 與內層鍵衝突及來源不變。

已閱非秘密 `planner-live-observed.json`：目前 ca-ai／ca-jev 的 `tr` 均包含 20／60、sliding_window、ip＋domain；此修正可保留該政策並供 baseline／candidate／receipt 比較。

本 finding 已解決；就已審查的程式碼邊界，可繼續已獲 Owner 授權的隔離 draft 建立，仍須通過來源／rules receipt、最新 baseline、所有兄弟 function archives 及既有完整站點檢查。此結論不是 production promotion 授權，也不是 draft 上線後驗收 PASS。

## 附錄：Planner root slash redirect loop 修正

2026-10-02，基準 authority HEAD `2d27128`，唯讀複核三檔未提交差異。**PASS（路由修正程式碼審查）**：只將 Planner root 的 slash-only 301 改為 `/travel-planner /travel-planner/index.html 200`。官方 Netlify redirect-options 說明 trailing slash 在規則比對前正規化，因此加入斜線的自我 redirect 可造成 loop；此次 rewrite 移除該 loop 原因。來源：https://docs.netlify.com/manage/routing/redirects/redirect-options/ 。

兄弟工具原始根 `_redirects`／`_headers` 無 diff。Planner fragment 僅包含 root 與精確 trip/day rewrites，API 保持專用 404，沒有 `/travel-planner/*` SPA catchall，缺少 assets 不會由新增規則回傳 index HTML。probe 增加 root 無 slash 與深層有 slash，回歸測試拒絕正規化後相同來源／目的地的 3xx。

作者回報 8 focused tests PASS；本審查不重跑整套測試。原 draft `6ac03db455a8943bd400a584` root loop 尚未由此報告宣稱恢復：需建立更新後隔離 draft，實際驗證兩種 root／deep URL、重新整理、API 404、missing asset 404 與兄弟保留。無 production 部署或 promotion 授權。

## 附錄：新增旅程日期不受目前選取旅程限制

2026-10-02，獨立唯讀複核 `App.tsx`／`tests/browser/product.spec.ts` 兩檔差異。**PASS（此修正程式碼審查）**。`saveTrip(t)` 現在從存活 records 中只驗證 `kind === item && tripId === t.id` 的安排，避免新旅程被目前選取示範的日期誤擋；修改既有旅程時，排除其既有安排的日期範圍仍拒絕。

新增 browser regression 分別驗證載入東京示範後建立不同年份旅程成功，以及編輯原示範排除既有安排仍顯示錯誤／日期不變。修改範圍精簡，未改動 Auth、同步或共享發布控制。

本報告未將新測試標為已執行 PASS。重建後新 source 仍需既定 emulator Gate 與更新隔離 preview 驗收；舊 preview 的 Google 登入／保存／刷新成果不等於新 revision 的最終驗收。

## 附錄：4410 emulator 失敗 trace 與 4cb7 時序修正

獨立唯讀檢視 4410 trace 與 cloud-browser 測試順序：B 的儲存操作尚未完成，測試讀到前次「已同步」便讓 A 恢復連線。A 隨即同步，B 的 revision 7 Commit 同期遭 emulator 回覆 permission-denied。此證據支持測試時序競態，沒有證明資料遺失；非 ConflictError 的錯誤路徑保留 pending，不能稱為該次保存成功。

4cb7 修正增加 A 離線新備註可見，以及 B dialog 關閉／新備註可見／已同步後，才恢復 A 連線。**PASS（針對測試時序的獨立複核）**，不擴大程式碼修改範圍。並行 CAS 若收到 permission-denied 的分類與重試仍可作後續針對性驗證，不應混同真正未授權存取，也不應繞過 rules。

作者提供最終 source `4cb7fdf71f7c5557f726f079ebc2104dc0b8430a`，emulator run `37079696570` PASS（27 unit、rules、獨立 browser contexts）。新 draft `6ac045607f1d78183c46e201` 的 full-host 322 files／6 functions／traffic／cron／18 probes PASS。這些是作者及 CI 證據，本 reviewer 未再次執行。

作者實際 preview QA：Owner Google 登入、新 origin 讀回既有雲端合成示範、建立新旅程／最少地點成功；同 Edge 不同 origin、獨立 IndexedDB／Auth state，實際 Firestore 雙向新增／移日／Undo 成功。此項實際測試不得寫成兩個獨立 browser contexts：後者只有 emulator 已驗證。實體 iPhone、WebKit、實際雲端離線恢復仍 UNVERIFIED。此附錄未授權 production，也未將未驗證項目標 PASS。
