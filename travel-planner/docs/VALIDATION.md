# V1 驗證記錄 — 2026-10-02

狀態：**本機產品可驗收／原始碼可審查；正式整合未完成**。沒有 production deploy、merge、DNS、Firebase rules 部署或付費服務變更。測試資料皆合成。

## 實際執行

| 驗證                       | 結果／界線                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| TypeScript strict `tsc -b` | PASS，包含 frontend 與 Netlify function                                                    |
| Vitest                     | **23 PASS**，12 model/time/calendar/import、6 IndexedDB/CAS/recovery、5 server boundary    |
| Vite build + SW generator  | PASS；12 static shell resources；manifest/SW scope `/travel-planner/`                      |
| Component stage            | PASS；`component-cd917d5238bbaddb`；每檔 SHA256，可由 source/lockfile 重建                 |
| Playwright 已安裝 Chrome   | **16 PASS**（桌機8、手機8）；另重跑2項視覺／列印測試 PASS                                  |
| 桌機／手機                 | 實際查看 1440×1000、390×844 screenshots；無橫向 viewport 溢出                              |
| 列印 CSS                   | Chrome print media 檢查 PASS，互動面板隱藏、簡潔行程顯示                                   |
| 真實地圖                   | Leaflet zoom／marker 選擇 PASS；Chrome 載入 OSM 底圖，attribution 可見；另測全圖磚失敗提示 |
| Independent reviewer       | 四項 findings 修正後唯讀複核 RESOLVED／程式碼審查通過，未發現新重大缺陷                    |
| Emulator 測試檔            | 規則測試與獨立 browser context 同步測試已備妥；後者 CLI `--list` 成功載入，**尚未執行**    |

Build 有 Firebase chunk 541.61KB 的效能 warning，以及上游 Zod pure-comment annotation warning；不影響 build 成功。未藉調高門檻隱藏 warning。後續若實測啟動速度不符需求，再按服務載入拆分；未宣稱測過慢速實體手機。

## 需求與證據

| 範圍           | 實作／測試                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 旅程與每日規劃 | 新增、編輯、複製、封存；跨年、多城市、多住宿、同行人數；空白起步；新旅程主流程實測                                                                              |
| 最少名稱／位置 | 新增名稱、後補地址/座標、marker同步；short Maps URL保留、viewport不當座標、missing/partial/unsafe位置回歸測試                                                   |
| 時間           | sequence/period/flexible/fixed；手動交通分鐘保留；固定預約不移動、衝突不套用延後；DST 表單拒絕後可正常修正                                                      |
| 調整           | desktop native拖曳跨日、mobile日期/上下移、候選替換保留原項、Undo刷新後仍有效；瀏覽器實測                                                                       |
| 候選與搜尋     | 未排定/單日候選、城市/區域/分類、已存地點可再安排，Maps外部入口；AIdisabled仍有普通搜尋                                                                         |
| 桌機／手機     | 多日並排、當日切換、map ratio/selection、drawer dialogs、Today與底部導覽；合成示範不顯示現在應前往                                                              |
| 地圖服務故障   | abort全部tiles後可讀行程、顯示錯誤；無座標不生成marker；marker與行程雙向選取、zoom實測                                                                          |
| AI             | server Auth/Owner/trip查核、未設定503、來源必須實際搜尋出現、API失敗回復等 mock tests；真實請求未啟用                                                           |
| 待辦／提醒     | 狀態、deadline、overdue/soon、SF/Honolulu、foreground提醒、停用/刪除、ICS VALARM；task新增與calendar download實測                                               |
| 時區／ICS      | Stable UID、UTC instants、SF夏冬DST、gap/ambiguous拒絕、跨年、不同出發/抵達時區、UTF8 folding；unit PASS                                                        |
| 本機離線       | 下載後 offline reload讀寫，再online reload仍保留；Chrome桌機/手機context實測                                                                                    |
| 雲端衝突模型   | 模拟 Remote CAS＋fake-indexeddb測跨日/排序/刪除base、離線改動、conflict alternatives、最新remote重讀、read失敗、Undo intervening edit；**不是Firebase整合PASS** |
| JSON／列印     | schemaVersion/reference驗證、new IDs、preview不覆寫、browser export/import副本；print media可見驗證                                                             |
| 路由／PWA      | 有效 trip/day深層直開刷新還原、manifest三scope、SW registrationscope、cache僅自己的static resources、獨立localcontext沒有同步資料                               |
| 私人資料隔離   | code review owner rules/namespace/server ownership與logout清理；真实anonymous/不同user規則還需emulator，不能宣稱PASS                                            |

## 關鍵畫面

- [桌機東京並排行程＋真實底圖](evidence/desktop-tokyo.png)
- [手機東京](evidence/mobile-tokyo.png)
- [桌機跨年多城市](evidence/desktop-multicity.png)
- [手機跨年多城市](evidence/mobile-multicity.png)
- [列印版](evidence/desktop-print.png)
- [手機新旅程與離線新增保留](evidence/mobile-trip.png)
- [桌機圖磚故障仍可操作](evidence/desktop-map.png)
- [手機地圖故障提示](evidence/mobile-map.png)

畫面由自動化實際 Chrome 取得並人工查看，不是 mockup。手機 viewport/Chrome 測試不等於實體 iPhone 或 WebKit。

## 獨立審查記錄

唯讀 reviewer `review_travel_risks` 聚焦 Auth／同步／時區／資料遺失／SW；不是作者自查。初輪 finding：Undo覆寫後續變更、採用過時remote快照、時區保護缺口、SW只hash檔名。修正後 reviewer 確認：lock內revision＋canonical payload比對；resolve先重讀；統一保存前時間驗證且提醒逐項容錯；SW內容hash。四項 **RESOLVED（code review）**。相關 IndexedDB/時區回歸與 browser DST測試通過。Reviewer明確保留 Firebase live/emulator、跨裝置與 iPhone UNVERIFIED。

## UNVERIFIED / BLOCKED

Firebase rules實際執行、真正兩個獨立browser context同帳號雙向同步／離線衝突、OAuth production/preview回呼：**BLOCKED**（沒有授權Planner project；TOWER無既有Java emulator runtime）。Local雙分頁PASS不能替代跨裝置。

真實 AI模型/key/搜尋回傳／Netlify部署runtime：**BLOCKED**（沒有獲授權設定）；只有UI、function、錯誤處理、mock boundary tests。Web Push訂閱／scheduler／取消重排／去重失效清理：**BLOCKED**（沒有已授權排程後端，未偽造背景推播）。

共享 authority contract加入Planner、完整站隔離preview、live root SW inventory、production路由及刷新：**BLOCKED／UNVERIFIED**（發布整合範圍另需授權）；本機同prefix驗證已完成。公開reader與Node HTTPS probe無法存取根SW，不將不存在的查核寫PASS。

WebKit、實體iPhone安裝/離線/鎖屏推播：**UNVERIFIED**。未下載額外瀏覽器或安裝系統runtime。
