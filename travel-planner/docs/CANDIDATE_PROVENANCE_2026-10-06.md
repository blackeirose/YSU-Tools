# Travel Planner 候選版本來源對照（2026-10-06）

> 目前是隔離 Preview 候選；Full Gate 未通過，production 未更新。這份記錄只處理版本可重建性與未驗收範圍；最新操作結果以 [Upgrade Gate](UPGRADE_GATE_2026-10-03.md) 為準。

| 項目 | 已讀回結果 |
| --- | --- |
| Core canonical | `blackeirose/ysu-ai-core` main `57a69136b7473718dfcf26311ae801f033696f05` |
| 產品 PR | [YSU-Tools #3](https://github.com/blackeirose/YSU-Tools/pull/3)，branch `feature/travel-planner-ux-gemini-20261003`，本次查核 HEAD `68a8dc62645b4494d03761b73c561e409f52cb22` |
| GitHub 可取得的執行程式來源 | [`a11fae8c035f42cb4e3c981c5dbc5b30f6a98414`](https://github.com/blackeirose/YSU-Tools/commit/a11fae8c035f42cb4e3c981c5dbc5b30f6a98414)，tree `fa21c696cdd7f677dbcb2c545b375675773e50aa` |
| 後續文件差異 | `a11fae8c`→`68a8dc6` 只修改 `travel-planner/docs/HANDOFF.md`、`travel-planner/docs/UPGRADE_GATE_2026-10-03.md`，未修改程式／lockfile／建置設定 |
| 產品 CI | [run 37418271635](https://github.com/blackeirose/YSU-Tools/actions/runs/37418271635)，關聯 `a11fae8c`，completed/success；frozen install、typecheck、build、135 unit、rules 與 Chromium emulator contexts |
| 發布 authority | [social-capture-tool #23](https://github.com/blackeirose/social-capture-tool/pull/23)，本次查核 HEAD `87a1277effa0c841d44acf579bfd84b6c1813288` |
| 完整站 Preview | [deploy `6ac487b0af93e64fa83bd095`](https://6ac487b0af93e64fa83bd095--ycsu-tools-router.netlify.app/travel-planner/)，Netlify state ready、context deploy-preview、published_at null；精確 hostname `6ac487b0af93e64fa83bd095--ycsu-tools-router.netlify.app` |
| Preview namespace | `preview-v1`，synthetic-only；目前 hostname 尚未加入 Firebase Authorized Domains，不能據此宣稱該版雲端登入 PASS |
| 正式站 | 本次 Netlify project 讀回 published deploy 仍為 `6ac2c370d1409615f07878bd`；正式站未更新 |

## `be5384b` 與 GitHub 來源的關係

Preview 的 `/travel-planner/version.json` 與 Netlify deploy title 標記 `be5384b454531b5e7777fda0365f245f94466d04`。這是建置時使用的**本機 commit**，GitHub 對此 SHA 回覆「No commit found」；它不是可供遠端 checkout 的 canonical commit。其本機 Git tree 為 `fa21c696cdd7f677dbcb2c545b375675773e50aa`，與 GitHub Git commit API 讀回的 `a11fae8c` tree **完全相同**。因此執行程式應以 GitHub `a11fae8c` 重建，並把 `be5384b` 僅視為既有產物內的本機標記。未來若因預算授權修改 runtime，須改用可在 GitHub 取得的 commit 建立新候選，不能繼續沿用此標記。

**位元組重建限制：** `scripts/build-preview.mjs` 以 `git rev-parse HEAD` 寫入 `version.json`，`build-sw.mjs` 再以該版本產物生成 service worker；`build-functions.mjs` 的 manifest 也帶來源 commit。因此直接 checkout `a11fae8c` 重建時，版本標記與依賴它的產物雜湊會和現有 `be5384b` Preview 不同。tree 相等與 19/19 已建成檔案對照證明**程式內容來源對應**，但不能把該 Preview 說成可由遠端 commit 原封不動位元組重建。下一個最終候選應在遠端 commit 可取得後，使用其 SHA 建置並核對新產物。

從 GitHub `a11fae8c` 讀取的 `pnpm-lock.yaml`、`package.json`、`vite.config.ts`、三個 `scripts/build-*.mjs`、`src/server/background.ts`、`src/server/ai-test-budget.ts`、`src/TripBackground.tsx`、兩個 Netlify Function 入口、`public/manifest.webmanifest`、`src/App.tsx`，共 13 個 blob SHA，均與本機 `be5384b` tree 中同一路徑相等。本機 lockfile SHA-256 `3c450d86ec61cc13cdd640fb2b802d068f86b927f8c6886756f4545f93cf14a9` 與 `dist/version.json` 的 `lockHash` 相同。建置命令在 `travel-planner/package.json`：`build:preview` 使用 `scripts/build-preview.mjs`，另有 `build:functions` 和 `build-sw.mjs`。

Canonical 完整站組裝清單 `.scratch/shared-host-candidate.json` 鎖定上述 Preview deploy 與本機 source 標記；其中 19 個 `/travel-planner/` 靜態檔的**原始檔 SHA-1**與本機 `dist` 逐檔對照為 19/19 相等、0 mismatch。代表性雜湊：`index.html` `d6e0fe749fc8a817d66d53a69c9e7e0a8133cc76`、`assets/index-BzD7dfkl.js` `9e4fbd9ed8c0a2b0134df04dd54a3295ab2dccaa`、`version.json` `3cc4913ee4c48a4d5d0ba0c2c2212852844c6f1a`、`sw.js` `53faf63d3575f62f7e79a7f07511babd79fb8ae7`。三個 Planner Function SHA-256：`travel-ai` `3b61135eeb763f94be95e6e70d2865fbbde150eb950f02da398f9382b0c2550f`、`travel-background` `83c3dd9d22aae5fc52ba6c541bb296ba962a88734291b22ad7cbf9869dfc8536`、`travel-background-read` `0804d3ae9382603905393a2acdc6406970ba44d8cead37c0f2330355d379f2b3`。發布器 validator 對 deploy `6ac487...` 回報 326 靜態檔、九個 Functions、完整站隔離 PASS；這是產物／路由驗證，**不代替真人雲端離線、付費模型或私有 Blob 驗收**。

## 剩餘 Gate 與額度

同一 campaign `ux-gemini-20261005-usd1` 於 2026-10-06 UTC 從 Netlify Blobs 讀回 `limitMicrousd=1,000,000`、`reservedMicrousd=660,000`、七筆保留項，剩餘 **US$0.34**。兩次 photo HTTP 400 的實際費用未知，保守預留不可刪除。必要剩餘 Preview 文字／語音／vision／兩片背景，加上正式站文字／背景 smoke 與一個有理由的圖片重試，依目前官方費率、程式輸入／輸出上限合計新保守上界 **US$1.31**；Explore 的舊有效證據可按 Gate 說明沿用。額外最多 US$1.00 仍是**提案，尚未核准**，每日 US$1 上限也未變。正式 AI 測試必須等額度決定與即時 daily/campaign ledger 讀回。

此 Preview 尚需精確 hostname 的 Firebase Authorized Domains 查重、當下確認與讀回，兩個獨立 context 在**同一最終候選**登入；再完成真實單分頁 Offline/Online 衝突、200% Chrome zoom、必要真人麥克風，以及文字／語音／vision／背景私有 Blob 驗收。若額度變更需要新的 runtime，先完成程式、CI、完整站 Preview，再針對新的精確 hostname 安排一次 Remote；不得將舊 `6ac46...` 或本候選的測試結果冒稱新 runtime PASS。生產發布以必要 Preview Full Gate 通過為前提，且須從當時最新完整站 baseline 重新組裝。
