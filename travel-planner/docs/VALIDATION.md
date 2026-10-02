# 驗證紀錄 — 2026-10-02 接續輪

已驗證程式碼：`c97589fe24ead39765530a9968d4e4fc6aac3bfb`。本文件之後的文件／證據 commit 不改變該 candidate。所有測試資料為合成。

| 檢查 | 結果 |
|---|---|
| TypeScript strict | PASS，frontend／server |
| Unit | **27 PASS**：12 model/time/calendar/import、10 IndexedDB/CAS/recovery、5 server trust boundary |
| 本機 Vite build／PWA | PASS；static shell only，scope `/travel-planner/` |
| 本機 Chrome | **16 PASS**（desktop 1440×1000 / mobile 390×844 各8） |
| Public emulator | [37063922214](https://github.com/blackeirose/YSU-Tools/actions/runs/37063922214) PASS：兩項 rules tests、獨立 browser contexts 完整同步流程 |
| 真正共用規則合併版 | 私有 [37064250499](https://github.com/blackeirose/social-capture-tool/actions/runs/37064250499) PASS，在 demo project 執行完整候選規則 |
| 共享發布契約 | 67 tests：**66 PASS / 1 原有 skip**，本機及 Actions 一致 |
| artifacts | accepted baseline 307 files byte-identical；6 exact function ZIP SHA256 相符 |
| 完整本機 candidate | 322 files，source/lock/manifest/PWA namespace／保留檔案檢查 PASS；**未部署** |
| 獨立 code review | **PASS**，下列四項修正複核；不是 live UI／雲端 acceptance |

Emulator 兩個獨立 contexts 實测 A→B、B→A、新增／修改、refresh、relogin、不同 user 看不到旅程、離線跨日移動＋新增後 offline reload、遠端刪除同項後衝突、下載雙份 backup、採遠端版本、採本機版本、排序、刪除與 Undo。stale drawer 草稿遇已送達的新版本不覆寫；草稿仍可複製。

本機 16 流程包含：旅程→place→marker、候選替換保留原項、drag／mobile移日、Undo／reload、固定時間延後保護、DST表單、ICS、JSON預覽匯入、離線讀寫重載、深層route直接載入、map錯誤、AI disabled、manifest/SW/private-cache排除、真實底圖、印刷與合成示範。原23-test紀錄已由27-test版本取代。

## 獨立 reviewer

`review_travel_risks` 為工具支援的只讀獨立 reviewer。發現並複核：
1. stale drawer revision 被覆寫 → revision 防護及 browser regression；
2. flush 持 state lock 等待網路 → 分開 sync/state locks、ack 重讀最新 queue、deferred network regression；
3. recovery 從過時記憶體取資料 → 同一 state lock 讀盤、保存 recovery、清理，delayed-broadcast regression；
4. 共享站 CA traffic policy 可能被常數覆蓋 → 精確保存觀察值、缺少／矛盾即阻擋、baseline/candidate/receipt 三方比較。

以上 RESOLVED，最終 code review PASS。作者沒有把自查當獨立 review。

## 證據

- [emulator 結果 JSON](evidence/emulator-acceptance.json)
- [emulator 桌機](evidence/emulator-desktop.png)
- [emulator 手機 viewport](evidence/emulator-mobile.png)
- [桌機合成東京](evidence/desktop-tokyo.png)、[手機合成東京](evidence/mobile-tokyo.png)
- [跨年多城市](evidence/desktop-multicity.png)、[列印](evidence/desktop-print.png)

畫面已實際開啟查看。Emulator screenshot 是 browser resize，不等於實體裝置；本機套件另以獨立 mobile context 執行。

## 尚未驗證／外部條件

- 真實 Google OAuth／Auth refresh、實際 Firebase project 的雙向／離線同步：**UNVERIFIED**，Preview host 尚未建立；合併規則已發布並刷新讀回相同 hash。不能用 emulator 取代真實 OAuth／同步。
- Netlify draft／deep route／真實 headers／全兄弟 probes：**BLOCKED**，TOWER 無正常 Netlify CLI 登入；不是 production 授權阻擋。
- 已核對的 retained inventory 沒有 root `sw.js`／`service-worker.js`；既有使用者歷史註冊及新 Preview runtime 仍需瀏覽器實測，不能宣稱全球無 root worker。
- 真實 AI／來源成功流程、持久 rate limit：**未啟用**；需 Planner 特定資源與額度。沒有發送真實付費 AI 請求。
- Web Push scheduler／取消重排／鎖屏：未實作／未啟用；前景提醒與 ICS 可用。
- WebKit、實體 iPhone 安裝、Safari 離線、通知：**UNVERIFIED**，未在公司設備安裝 runtime。
- Build 保留上游 Zod 註解與 Firebase chunk 約542KB warning，未隱藏門檻。
