# 驗證紀錄 — 最終隔離 Preview

> **2026-10-03 17:35 PDT 更新：** 最新完整站 [Preview `6ac19dbe1e7f0157bfeef08e`](https://6ac19dbe1e7f0157bfeef08e--ycsu-tools-router.netlify.app/travel-planner/) 取代下方舊 draft。產品 `5f68efc`、publisher PR head `b7d4724`；[產品 emulator CI](https://github.com/blackeirose/YSU-Tools/actions/runs/37164213423)、[共用站合併 rules / 75 測試 CI](https://github.com/blackeirose/social-capture-tool/actions/runs/37164496703) PASS。本機 82 單元測試、Chromium 55 PASS／9 個有意跳過、publisher 75 PASS／1 skip；完整站遠端 validate PASS（326 static、九 Functions、六兄弟 Function 保留、路由、排程、traffic、PWA）。Preview Firebase 規則發布後重新整理讀回 SHA256 `b54ab8328edd8d88c28eb0ba7bf03fd44aff7171c0043231751c07fd676bc9c5`，只新增精確 Preview Auth hostname。實際 Preview 本機模式於 1440px 點 1/7 卡片後看見同日第 1／2 地圖標記，390／320px 無橫向溢出，深層 URL 可直接開啟。TOWER 的 Google popup 仍未完成；真實雲端雙 context、Gemini/Blob、iPhone 均 UNVERIFIED。正式 deploy `6ac0989e1e8fabf48ee75360` 未改。下方數值為歷史紀錄。

> **2026-10-03 升級版最新證據：** [隔離完整站 Preview](https://6ac1921df800e63bc4e905cb--ycsu-tools-router.netlify.app/travel-planner/) deploy `6ac1921df800e63bc4e905cb`，產品 runtime `42cf4cbe95cfdcc40f9cec2322f9afa9a8763c66`；[產品 CI 37162263860](https://github.com/blackeirose/YSU-Tools/actions/runs/37162263860) PASS（79 unit 與 emulator/browser integration），[發布 CI 37162294923](https://github.com/blackeirose/social-capture-tool/actions/runs/37162294923) PASS（合併 rules 與 75 tests）。完整站遠端 validate PASS：326 static、九個 Functions，六個兄弟 Function 保留。新版 390px 真實 Preview 本機模式移日／Undo／刷新、1440px 行程與地圖標記、深層網址刷新通過；已檢查 Firebase Preview rules 與精確授權 hostname。匿名 AI/background API 401；真人 Google popup 未完成，雲端雙 context、真實 Gemini/圖片/Blob 仍 UNVERIFIED。以下舊 V1 與開發初期的數字均不是本輪驗收；以 [升級 Full Gate](UPGRADE_GATE_2026-10-03.md) 為準。正式 deploy 仍為 `6ac0989e1e8fabf48ee75360`。

> **2026-10-03 UX / Gemini upgrade checkpoint:** The V1 results below are historical and do not certify this new branch. The [current Full Gate](UPGRADE_GATE_2026-10-03.md) and [upgrade release report](RELEASE_REPORT_2026-10-03.md) track source-matched evidence. Local current-branch evidence: typecheck/build PASS, 67 unit tests PASS, three exact Netlify function bundles PASS, publisher component tests 13/13 PASS. Chromium full run: 52 PASS, 9 desktop-only controls intentionally skipped on mobile, one stale mobile inline-action selector; the corrected detail-drawer flow then passed individually, yielding 53 covered executed workflows. All screens linked there use synthetic local data. Real Gemini, image/Blob, Firebase dual-context, emulator CI and remote complete-host Preview are still UNVERIFIED.

已驗證 source：`4cb7fdf71f7c5557f726f079ebc2104dc0b8430a`。後續文件 commit 不改變成品；Planner 測試資料全為合成。

| 檢查 | 實際結果 |
|---|---|
| TypeScript strict／build | PASS frontend/server、本機及 preview；PWA scope /travel-planner/ |
| Unit | 27 PASS：12 model/time/calendar/import、10 IndexedDB/CAS/recovery、5 server trust boundary |
| 本機 Chrome | 18 PASS，1440×1000 / 390×844 各9，含新增不同年份旅程與既有日期保護 |
| Public emulator | [37079696570](https://github.com/blackeirose/YSU-Tools/actions/runs/37079696570) PASS，source 4cb7；2 rules tests／兩個獨立 contexts |
| 完整共享 rules | 私有 [37064250499](https://github.com/blackeirose/social-capture-tool/actions/runs/37064250499) PASS，後續規則未變 |
| Authority 本機契約 | 69 tests：68 PASS / 1 既有 skip |
| 完整遠端 draft | PASS：322 files、6 exact functions、traffic/routes/modes/cron、18組 probes |
| 真實 Owner Google OAuth | PASS：最終精確 host、官方 popup、刷新後仍讀回 |
| 真實 Firestore 雙向操作 | PASS，雙 origin：新增旅程／地點、反向新增、跨日移動、Undo、全新 origin／reload 讀回 |
| 真實不同 browser contexts／裝置 | UNVERIFIED；双 origin 同屬 Edge，不能等同跨裝置 |
| 獨立 code review | PASS，見 INDEPENDENT_REVIEW.md；不是 live acceptance |

## 核心與離線覆蓋

本機流程包括：旅程→place→marker、候選替換保留原項、drag／手機移日、Undo／reload、固定預約延後保護、DST表單、ICS跨年／跨日／出發抵達不同時區、JSON預覽匯入、離線讀寫重載、deep route、map錯誤、AI disabled、private-cache排除、真實底圖與列印。

Emulator 兩個獨立 contexts 包括 A→B、B→A、refresh、relogin、其他 user 無法讀取、離線跨日移動／新增及 offline reload、遠端刪除同項的衝突、雙版本備份、採遠端／本機版本、排序／刪除 Undo。Stale drawer 不覆寫新版本；network flush 不阻塞本機修改；session loss 保留同 owner recovery。

## 最終網站實測

[最終 draft](https://6ac045607f1d78183c46e201--ycsu-tools-router.netlify.app/travel-planner/) 在空白 origin cache 登入後讀回原有兩份合成示範。建立2031-02-01–02旅程，name-only未定位地點正常保存，無猜測座標。另一個已登入舊 draft origin 收到新增；反向新增抵達最終 origin。跨日移動／Undo均同步，deep route reload後保留。測試旅程最後封存（可恢復），畫面回到已同步。

兩個 Edge origins 各有 IndexedDB／快取，舊 draft 同步程式相同。**這不是獨立 browser contexts 的真實雲端測試。** IAB 的正常 Google popup 未完成登入，未探查 cookies/tokens 或重建 profile；改以本機模式檢視最終網站。真實雲端 offline/reconnect 尚未測到。

實際 viewport 390×844／1440×1000，DOM client width 375／1425（扣除 scrollbar），無頁面橫向溢出。真實 OSM 256px圖磚載入。最終新 origin worker/manifest scope、deep route直開／刷新 PASS；不宣稱所有既有用戶歷史 root worker 均已查核。

## 發現與修正

- 獨立 reviewer 發現的 stale draft revision、network flush state lock、recovery舊記憶體、CA traffic policy常數覆寫均修正並複核。
- 第一 draft 的 Netlify 尾斜線301自循環改為 scoped internal 200 rewrite，補root/deep兩種slash probes；最終 PASS，兄弟 fragments保留。
- 新增旅程誤套當前旅程日期限制：guard依被編輯 trip ID取items，新增與既有日期保護的兩尺寸regression PASS。
- 4410 emulator run 37079229933 曾因test未等保存完成就重連失敗；trace顯示誤讀 B 之前的已同步狀態。4cb7先等drawer關閉、內容與離線狀態套用、遠端已同步才重連，37079696570 PASS。這項修正未改app同步邏輯，未抹去失敗紀錄。

## 證據

- [最終 emulator JSON](evidence/emulator-acceptance.json)、[桌機](evidence/emulator-desktop.png)、[手機 viewport](evidence/emulator-mobile.png)
- [最終 Preview 桌機](evidence/preview-final-desktop.png)／[手機](evidence/preview-final-mobile.png)：本機模式，標示不跨裝置
- [雲端已同步](evidence/preview-cloud.png)：最終 Preview 實際 Edge viewport，不作1440px聲稱
- [Preview acceptance摘要](evidence/preview-acceptance.json)；完整host verification/receipt在私有authority PR #21
- Emulator artifact 11257524498 SHA256 `b6e4e30cecdc393aaae03ca2ce07a479f6023b335923e67d7e7f62c48453f7e6`

## 未啟用／未驗證

AI真實來源流程、服務／模型與持久rate limit未啟用。Web Push scheduler／subscription backend／取消重排未啟用；前景提醒與ICS不等同背景通知。WebKit、實體iPhone安裝、Safari離線、鎖屏通知均 **UNVERIFIED**。未安裝公司設備系統runtime。Build保留上游Zod註解及Firebase約542KB chunk warnings。
