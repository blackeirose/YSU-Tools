# 驗證紀錄 — 最終隔離 Preview

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
