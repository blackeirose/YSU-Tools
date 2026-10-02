# Handoff — Travel Planner V1

**可驗收本機產品與可審查程式碼已完成。正式雲端整合尚未全面完成，沒有 production deploy。**

Repo `blackeirose/YSU-Tools`，隔離 branch `feature/travel-planner-v1`；開發只新增 `travel-planner/`。根 README.md/CNAME、Core、Tracker/MAIN、兄弟工具與正式私人資料未改。Canonical Core與repo baseline詳 docs/PREFLIGHT.md。

主要操作：旅程新增/編輯/複製/封存、多日並排、手機Today、最少名稱新增、地點後補及手動落點、真實Leaflet、時間/手動交通、候選/替換、拖曳或日期/上下移、Undo、安全延後、待辦/提醒/ICS、JSON預覽匯入/匯出、列印、PWA與離線修改。東京與跨年京都/大阪/名古屋合成示範可載入。

實際驗證：typecheck/build/component stage、23 unit tests、16 Chrome browser flows（1440/390）及print media通過。四項獨立程式碼審查問題修正並複核。詳 docs/VALIDATION.md、docs/evidence/。

本機可用 `pnpm install --frozen-lockfile && pnpm build && pnpm preview --port 4173`（依使用shell拆成各指令）。`http://127.0.0.1:4173/travel-planner/` 為暫時本機server，不是持久preview；沒有新增Netlify site/替代正式域。

## 各整合真實狀態

| 功能         | 狀態                                                                           |
| ------------ | ------------------------------------------------------------------------------ |
| 核心本機操作 | 可用，IndexedDB持久化                                                          |
| 離線         | Chrome本機讀寫／刷新／重連保留PASS；無離線底圖                                 |
| 跨裝置       | Firebase adapter/rules/測試備妥，未啟用；不宣稱本機demo能同步                  |
| AI           | 面板、server-only介面、Auth/ownership/來源驗證及錯誤測試完成；實際畫面尚未啟用 |
| 提醒         | 提醒中心、app開啟中提醒、ICS VALARM可用；背景push未啟用                        |
| 正式發布     | 只備妥 component、hashes與scoped整合說明；authority尚未加入Planner，未部署     |

## 真實外部阻擋與最少 Owner 事項（集中一次）

1. **Firebase／真正同步驗收**：指定已授權可用的Planner Firebase project或核准獨立namespace/rules合併的既有project，確認Google Auth/authorized domains。透過既有安全設定介面配置公開web設定，不在對話貼secrets。還需既有、已授權Java21+/Firebase CLI隔離測試環境執行rules與獨立context套件；不能在DLR TOWER擅自裝Java、改安全政策或拿production代替。已備 `firebase.json`、owner rules、`pnpm test:rules`、`playwright.cloud.config.ts`。
2. **共享發布整合**：另授權 `blackeirose/social-capture-tool` 的sole authority新增本component及必要精確route/header/function契約，保留全部鄰居hash及Capture functions/cron。確認可安全使用的完整站隔離preview與live根SW registration inventory。現在authority contract沒有Planner，所以無法合法直接發布本folder。正式production promotion仍另行明確授權。
3. **若啟用AI**：用安全server設定介面提供已授權key、當前可用模型、Owner UID，確認額度與持久rate limit。UI在此之前disabled，普通Maps搜尋可用。沒有付費方案或任意舊模型假設。
4. **若需要背景推播**：提供已授權scheduler/push resources後，再實作subscription、取消重排、dedupe、失效subscription清理與實際通知驗收。沒有後端時仍可用ICS，不把foregroundtimer當push。實體iPhone加入主畫面與鎖屏效果需要Owner/可操作裝置驗證；目前UNVERIFIED。

上述只影響各integration；其他開發、錯誤處理、測試與handoff已完成。請不要要求把秘密貼進聊天或繞過公司管理限制。

## 發布前條件與回復

先補真實Firebase/security/sync驗證、授權範圍內AI/push的相應驗證，再shared完整candidate/neighbor regression/同子路徑preview及Auth回呼。官方路徑固定 `/travel-planner/`，沒有root catchall。詳 docs/RELEASE_INTEGRATION.md。

本次production未動，原LKG維持。Source rollback可回初始main或revert feature；後續若已部署，僅重建上一個驗證Planner component並保留最新兄弟components/functions，經sole authority發布。禁止歷史整站restore覆蓋新兄弟工具。JSON匯出與conflict雙份backup供私人資料復原。
