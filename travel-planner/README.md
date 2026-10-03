# YSU Travel Planner V1

可操作的繁體中文私人旅行規劃工具。預設是「本機示範，不跨裝置同步」；Firebase、AI 和背景推播各自需要獲授權的設定。正式目標為 `/travel-planner/`，目前沒有正式部署。

[隔離 Preview](https://6ac045607f1d78183c46e201--ycsu-tools-router.netlify.app/travel-planner/) 已啟用專用 Firebase preview 範圍，可用既有 Owner Google 帳號試用合成資料。真實雙 origin 同步通過，實體跨裝置及雲端離線驗證仍待完成；詳見 [交接](docs/HANDOFF.md)。AI／背景推播仍未啟用。

## 本機執行

需要既有 Node 22.12+ 與 pnpm。所有指令在此目錄執行，不需要系統管理員權限：

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm preview --port 4173
# 另一個 terminal，使用已安裝 Chrome
pnpm test:e2e
```

開啟 `http://127.0.0.1:4173/travel-planner/`。這是暫時本機伺服器，不是持久 preview。開發模式 `pnpm dev` 不註冊 SW；離線驗證須使用 build + preview。第一次下載需連線等待 app shell 就緒。瀏覽器清除網站資料會刪除本機行程，請定期匯出 JSON。

## 操作

1. 新增旅程，只填名稱和日期即可；可編輯、複製、封存。
2. 每日「名稱或 Maps URL」輸入後按 +。只有名稱也可儲存；未知座標不顯示地圖標記，稍後可編輯或手動落點。
3. 行程卡可編輯時間／交通／備註、移日、上下移、改候選／完成／跳過；桌機另有拖曳。候選可替換指定行程，被替換項目留作候選。旅程操作中的 Undo 支援重新整理後復原最近一步。
4. 選一天或看多天；桌機行程與地圖同時可見。手機底部今天／地圖／候選／待辦。示範與非當日旅程不顯示「現在應前往」。
5. 待辦與提醒中心支援截止時間、狀態、來源及提前提醒，並顯示 San Francisco／Honolulu 換算。匯出 .ics 包含 VALARM，後續修改不自動同步到行事曆，通知取決於行事曆設定。
6. 旅程操作 → 匯出／匯入支援 JSON 預覽與建立副本、列印存 PDF。下載行程後斷網仍可讀寫；底圖需要網路。

旅程、候選、預約範例都是合成資料，未核對目前營業、價格或訂位。過去私人 PDF 未加入此 repo。

## 設定與交接

- [資料、Firebase 與 AI 設定](docs/INTEGRATIONS.md)
- [共享站點整合與回復](docs/RELEASE_INTEGRATION.md)
- [實際驗證與畫面](docs/VALIDATION.md)
- [剩餘阻擋及 Owner 最少事項](docs/HANDOFF.md)
- [範圍、canonical preflight 與 No-Touch](docs/PREFLIGHT.md)

此目錄的 `dist` 只能作完整站點中的 `/travel-planner/` 元件，絕不可單獨部署覆蓋 tools.ycsu.cc。正式部署仍需另行授權。
