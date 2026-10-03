# 外部服務與資料保護

## Firebase：隔離 Preview 已啟用；正式 v1 尚未開放

Owner 已授權既有個人 Firebase 專案的最小 Planner 範圍。合併規則保留原有 bytes，經完整 emulator／獨立 review 後已發布並讀回相同 hash。最終精確 Preview domain 已加入，原5個domain保留，被取代的試用domain已移除。真實 Owner Google 登入、雲端 CRUD／刷新、兩個 Edge origins 雙向同步 PASS；獨立 browser contexts 僅 emulator PASS，實體裝置及真實雲端 offline 尚 UNVERIFIED。詳見 VALIDATION.md。

將 `.env.example` 複製為 git 忽略的 `.env.local`，只填獲授權的獨立 Firebase web 公開設定。Google Auth 必須已啟用、網域授權和費用條件已確認；不由本任務自動開通。Firebase web API key 是公開 client configuration；任何真正秘密都不能放 VITE_*。不將 UMS project 當作可任意使用的共用後端。

Google 使用 popup 回登入頁，路由維持 `/travel-planner/trips/{uuid}/day/{date}`。Firebase 預設 auth helper 是 project 的 `https://<auth-domain>/__/auth/handler`，由 Firebase 管理，不在共享站新增 `/__/auth` catchall，也不擅自代理它。啟用前查核 OAuth authorized origin／redirect 設定與當前官方要求；正式域與隔離 preview 各別驗證。Auth 切換／登出清理本機帳號資料、pending、conflicts、UI selection；不快取私人 API。未同步時登出提供完整備份、重試或明確捨棄，避免暗中遺失。

本次 namespace 為 `travelPlanner/preview-v1/users/{uid}/records/{uuid}`，只供合成試用；正式 `v1` 尚未開放。設定由 `VITE_FIREBASE_NAMESPACE` 指定，本機 queue identity 同時包含 project、namespace、UID。預覽規則重用既有 verified-Google Owner policy，限制 ownerId/id/kind/revision/tombstone，拒絕未登入、其他 user 及 physical delete。`firestore.rules` 是獨立 emulator 規則，不能直接部署取代既有專案整份規則；使用已核對最新 baseline 的 additive merge。

同步按 record transaction CAS，500 筆 Firebase transaction 限制內，本工具單次匯入最多 450 records；大檔不會靜默部分匯入。離線操作、原始 before、最新 local after、conflict remote 持久化。跨日移動／排序／刪除以同一 operation 原子提交。衝突關聯操作合併保留 earliest base/latest intent。Resolve 重新讀取遠端，讀取失敗不丟 conflict；保留本機也重新 CAS，若遠端再次變更仍提示衝突。Undo 先驗原 after 仍等於目前資料，拒絕覆寫 intervening edit。每次不是覆寫整份雲端旅程。

本機 IndexedDB 裝置儲存不是加密 vault；使用個人可信任瀏覽器帳號。登出會清理該帳號的私人 app 資料；本機示範需自行匯出／清除網站資料。Browser quota/private mode/企業策略可能禁用 IndexedDB/Web Locks，錯誤會阻止假成功儲存。

### Emulator 重現（需既有授權 runtime）

TOWER 沒有可用 Java，沒有安裝 JVM 或繞過公司限制。以下只能在已有合法 Java21+、Firebase CLI 的隔離測試環境執行：

```sh
firebase emulators:start --project demo-ysu-travel-planner --only auth,firestore
pnpm test:rules
# 獨立 frontend terminal；只連 loopback demo project
VITE_USE_EMULATORS=true pnpm dev --port 4174
```

Windows 用既有 shell 的環境變數語法。`firebase.json` 只綁 127.0.0.1，無 hosting/deploy 指令。已透過手動 GitHub Actions 的 demo project 執行，最終 run 37079696570 PASS：兩個獨立 browser contexts 同帳號雙向編輯、離線後另一端移日／排序／刪除、重連選 local/remote、登出／其他 user。`tests/cloud-browser` 是專用流程，不能用本機 demo 雙分頁取代跨裝置證據。

## AI：介面與 server boundary 已完成；未啟用

Frontend `VITE_AI_ENDPOINT=/travel-planner/api/explore` 只在登入且 server 已獲授權時設定。Netlify function 需要 server-only 設定：

| 設定                               | 用途                                                             |
| ---------------------------------- | ---------------------------------------------------------------- |
| TRAVEL_PLANNER_OPENAI_KEY          | 探索專用 secret，只在 function runtime                           |
| TRAVEL_PLANNER_AI_MODEL            | Owner 確認的當前可用 Responses/web_search/structured output 模型 |
| TRAVEL_PLANNER_FIREBASE_PROJECT_ID | 同一獲授權私人 project                                           |
| TRAVEL_PLANNER_FIREBASE_WEB_KEY    | token lookup 用 web configuration                                |
| TRAVEL_PLANNER_AI_OWNER_UID        | V1 私人 Owner allowlist                                          |

不在 repo/對話貼秘密。API 先驗 Firebase token、Owner allowlist、Firestore trip ownership，再送使用者探索條件；不傳訂單資訊、不寫 itinerary、不訂位。Response store=false，限制輸入8KB、文字長度與 max_output_tokens；來源需真正在搜尋輸出中，卡片固定標示尚未定位／待確認。網路／Auth／模型錯誤不影響主要行程。尚無可靠營業／空位／路線資料，所以不提供即時宣稱。

啟用前必須查核當前模型與帳號可用性、私密資料政策、Owner 額度／費用及持久 rate limiting；現在沒有自動新增付費服務，也沒有真實 AI request。單一 Owner allowlist 和前端 busy 不是持久費用上限。

官方介面查核來源：[Responses web search](https://developers.openai.com/api/docs/guides/tools-web-search)、[Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)。沒有沿用未核對舊模型名稱。

## 地圖：真實 Leaflet，網路可失敗

預設 [OSM standard tiles policy](https://operations.osmfoundation.org/policies/tiles/)，保留可見 OpenStreetMap attribution 和 browser Referer，不大量下載、不預載離線 tiles、不公共 geocoding autocomplete。正常瀏覽器 HTTP cache 遵守伺服器 cache headers，SW 不存 tiles。公開 default tile 是 best-effort 且可能限制流量，正式流量前評估獲授權合適 provider，不能保證 SLA。VITE_MAP_TILE_URL/VITE_MAP_ATTRIBUTION 可填合法 provider 的公開設定。

Maps URL 搜尋、步行／大眾運輸／開車導航不需 Google API key。短網址只保留，不請求追蹤或猜測座標；未定位有文字提示和手動落點。虛線代表行程順序，不是道路路線，交通分鐘只保留手動值或顯示未估算。

## 提醒／離線

提醒中心、逾期／到期、app 開啟中提醒、ICS VALARM 可用。背景推播無 backend/scheduler，未啟用，不用 setTimeout 冒充。日曆是快照，UID 不變但重新匯入行為依 calendar client，通知取決於使用者行事曆。時間用目的地 IANA timezone，SF/Honolulu 補充換算，cross-zone departure/arrival；DST 歧義與不存在時間拒絕保存。

下載 = app shell ready + 本機持久 records，離線地址／備註／行程／可恢復修改；不保證離線底圖，也不代表跨裝置同步。PWA iPhone 加主畫面指引已提供，實體安裝、鎖屏背景提醒均 UNVERIFIED。未啟用 Web Push 時不請求 notification subscription 權限。
