# Travel Planner 正式發布與登錄交接 — 2026-10-02

## 目前結果

**已授權、尚未發布。** 本文件與同 branch 的 DECISIONS／PROJECT_CONTEXT 是發布準備，不是部署收據或新的 LKG。

Owner 於 2026-10-02 21:41 PDT 明確要求：
> 我需要發佈到YCSU上  這樣我才方便測試   發布後並且要更新到TRACKER和MAIN上

正式目標固定 https://tools.ycsu.cc/travel-planner/ 。使用者希望方便以電腦及手機測試。原先「不得 production／不得登錄 MAIN、Tracker」的任務限制，僅就這次發布與登錄已被最新授權取代。無須再詢問一般發布許可；資料保護、兄弟工具保留及驗證條件仍適用。

## 已實際核對

- canonical Core：main，57a69136b7473718dfcf26311ae801f033696f05；已遠端讀取 AGENTS 1.7、AI_CORE 1.4、Services、Development Workflow、Communication、Gate、Domain Registry。
- 產品：blackeirose/YSU-Tools，feature/travel-planner-v1，86aded9c8df36229b3ed3655511f6d07c195ae92。
- 修復 Preview 程式：380ae4aa56c5266f590a5ecf299f6ea0b4cc9986。
- 發布 authority：blackeirose/social-capture-tool，feature/travel-planner-preview，e438c0360a247b5f7810467abd5bf831a4491d17；組裝來源 d9ddbd37fcdad555549e93467bf822855b99a694。
- 修復 Preview：6ac08433dbc4b56d7f3160d1；其 exact hostname 尚未列入 Firebase Authorized Domains，不能用舊 Preview 的登入驗證替代。
- GitHub Actions 37096453816：completed/success，head_sha 與 380ae4aa 完全一致。CI 記錄與本輪重跑是不同概念，本輪沒有重跑。
- Netlify connector 本次 live read：site b23018a8-efe1-4086-b7ea-1d9018b2cf40，ycsu-tools-router，primary https://tools.ycsu.cc；current ready deploy 6abf52a7be775989aeaab09d。
- 產品 package.json 目前為 1.0.0。這是 package 版本，不代表正式穩定版或認證。
- 已修正本 branch PROJECT_CONTEXT 的新舊 Preview 混淆；其他歷史文件需在正式收尾時以實際結果更新。

## 這個 Cloud Work 的真實執行阻擋

此環境不是 TOWER，無法讀取 TOWER 的 C: 工作目錄、既有 CLI 登入或私人整合檔案。

- git／node／npm／pnpm 可用；netlify／gh CLI 不在 PATH。
- NETLIFY_AUTH_TOKEN、NETLIFY_TOKEN、GITHUB_TOKEN、GH_TOKEN、FIREBASE_TOKEN、GOOGLE_APPLICATION_CREDENTIALS 環境設定均未提供；僅檢查存在與否，沒有讀取或輸出秘密。
- 沒有 Firebase 管理 connector。
- Netlify connector 可讀 project/deploy；其 deploy-site 介面沒有完整 candidate／exact function ZIP／canonical publisher receipt 輸入，不能代替 shared_host_release.py 所需發布流程。因此未呼叫該寫入操作或直接 promote draft。
- Cloud Work 並未取得或驗證當前六個受保護 Function ZIP；TOWER 前輪已使用的本機／私有發布物件仍須由具備存取權的執行環境重新確認。
- MAIN 管理金鑰 REGISTRY_API_KEY 未提供。Supabase connector 的必要唯讀 SQL 可用；這與 Planner 後端無關，不將 Supabase 加入 Planner。

這是執行能力／既有憑證的限制，不是再次要求 Owner 批准同一發布。不要把秘密貼在聊天，亦不要為這次交接擴大帳號權限、調整公司政策或架設新的發布服務。

## TOWER 接續順序

1. 重新檢查 canonical、兩個 repo 當前 HEAD 與本機未提交成果。讀取本 release branch 的授權與狀態修正；保留其他代理成果。產品 runtime 仍是 380ae4aa，這個 branch 只新增文件。
2. 確認 TOWER 的既有 Netlify／Firebase／MAIN 管理存取仍有效。若缺少，只列具體缺項，不重複要求總體發布授權。
3. 完成 Planner 專屬 production v1 資料範圍及 R7 伺服端一致性保護。不得讓舊 client 用不帶 Trip dependency 的寫入繞過。保留 owner 限制、兄弟 collections、資料及現有 preview-v1。
4. 現有 preview receipt 永久 preview-only；不可改 receipt 值、刪掉安全檢查或直接 promotion。需在 authority 中建立真正可審查、可驗證的 production candidate 流程。任何必要 shared-rule 修改須限定 Planner；若無法保持既有安全邊界，先提供確切 diff 與影響，不能擴張成一般 shared-policy 授權。
5. v1 規則先以既有授權 emulator／CI 驗證：未登入／異 user／old client 拒絕、新 client 合法操作、兩提交順序、離線回連、復原與 pending 升級。保留 rollback/recovery。若需獨立審查，使用 Core Gate Full 的聚焦範圍。
6. 核對正式 tools.ycsu.cc 是否已是既有 Firebase Authorized Domain；不要為測試方便改共用 Auth 網域或關閉 TLS。若必要的專屬 domain 設定超出既有授權，提出最小明確變更。Owner Chrome 的 NET::ERR_CERT_AUTHORITY_INVALID 是獨立問題，不假稱已解決。
7. 從發布當時最新 live baseline 組裝完整共用站，保留全部兄弟 files／六個 exact Functions／routes／traffic policy／cron。遵守 scripts/shared_host_release.py；不部署 Planner dist 覆蓋整站、不還原歷史整站。
8. 本機與適用隔離 candidate 驗證後批次正式發布。這次 Owner 已批准發布，無須完成後再次問是否可以。
9. 正式入口驗證 root／深層網址與刷新、assets、PWA scope、手機版、登入與基本寫讀／刷新；雲端離線及雙裝置各自記錄。可用合成資料驗證，不動既有私人行程。AI／背景 Push 維持停用。
10. 正式入口驗證成功後才更新 Tracker／MAIN，並重新獨立讀回。若僅部分功能通過，標示「已發布・Owner 測試中」，不要稱 Production 完整驗收或 YCSU Certified。

## Tracker／MAIN 預備登錄

已讀取 YCSU-Platform 的 AGENTS、PROJECT_CONTEXT、DECISIONS、REGISTRY_OPERATIONS，以及 Tracker 的 AGENTS、PROJECT_CONTEXT、DECISIONS。正式登錄時需再次讀最新資料，避免重複及覆寫並行更新。

本次唯讀查核：
- public.product_registry 查 travel／旅行 名稱與 slug：沒有符合紀錄。
- public.tracker_items 查 travel／旅行／旅遊：只找到 **Travel Live View**，id ec117303-dbdc-495f-9188-12b0fce1a945。它是公眾攝影機／天氣的另一個 Future 構想，**不是 Travel Planner，不得拿來改名或覆寫**。
- 尚未對任何 Tracker／MAIN runtime row 寫入；遵守 Owner「發布後」的順序。

正式驗證後建議 MAIN metadata（依最終實際結果調整）：
- slug: travel-planner；name: YSU Travel Planner；shortName: Travel Planner。
- description: 私人多日旅行規劃工具，整合行程與地圖、候選地點、待辦提醒及資料匯出。
- platformLayer: Product；maturity: Internal Alpha。
- deployment: Internal；visibility: Private；operationalStatus: Live（僅於正式入口驗證後）。
- mainUrl: https://tools.ycsu.cc/travel-planner/；plannedUrl: null。
- version: 使用實際發布 package 值；versionSource: package，除非另有已驗證 tag／release。
- certification: Not Certified；featured: false。
- statusNote: 已發布供 Owner 測試；逐項記錄真實雲端同步、離線、實體 iPhone 的驗收狀態；AI／背景 Push 未啟用。
- GitHub／Docs／Tracker URLs 依已確認來源填寫，不洩漏私人旅行或確認碼。
- 使用既有 registry-ops 管理介面；不可放寬 RLS、把管理金鑰放前端或透過重新部署 MAIN 來代替資料登錄。
- 如果已存在同 slug，僅 patch 必要欄位；保持排序／lifecycle／其他項目。

Tracker：
- 重新檢索確認沒有同一產品，再新增 Travel Planner；若已存在，更新該 ID。
- 狀態 Active、readiness 表明已發布待 Owner 實測，連結正式入口、產品 PR 與正式發布紀錄。
- current_state、next_step 明示可用功能與未驗證事項。
- 不填假完成百分比／工時；保留既有值，新增預設若必填則註明未估算。
- 使用既有授權管理連線；不更改 Tasks schema／RLS，不更動 Skills catalog。
- 登錄後分別讀回 id／url／version／status／notes，確認不重複、未改無關項目。

## 收尾要求

交付實際 production deploy ID、產品與 authority SHA、正式連結、驗證結果、MAIN／Tracker 的實際 row ID 與讀回結果。明確區分已提交、已部署、已驗證及仍待 Owner 實機測試。更新 HANDOFF／RELEASE_INTEGRATION／PROJECT_CONTEXT 的現況，保留歷史標籤。回復只替換 Planner、保留當下最新兄弟工具與私人 pending／conflict recovery。
