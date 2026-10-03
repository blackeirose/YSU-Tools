# /travel-planner/ 隔離 Preview 整合

來源 `blackeirose/YSU-Tools/travel-planner`；正式目標 `https://tools.ycsu.cc/travel-planner/`。不得整站部署此repo或dist。

唯一authority：`blackeirose/social-capture-tool/scripts/shared_host_release.py`，Netlify site `b23018a8-efe1-4086-b7ea-1d9018b2cf40`（ycsu-tools-router）。[PR #21](https://github.com/blackeirose/social-capture-tool/pull/21) 基於accepted `b551947`／live `6abf52a7be775989aeaab09d`，不是舊main的22-file contract。Fresh API確認未連Git/CD，feature push不觸發production。

## 最終成品

[持久 draft Preview](https://6ac045607f1d78183c46e201--ycsu-tools-router.netlify.app/travel-planner/)，deploy `6ac045607f1d78183c46e201`，ready／deploy-preview。
Product source `4cb7fdf71f7c5557f726f079ebc2104dc0b8430a`；authority `61ef93988580b8cde0d608d8cecb3eaaa367eb7e`。

322 files：307既有檔案只允許2個root檔append已審查fragment，其他bytes完全一致。6 functions的exact ZIP、modes/routes/traffic policy/cleanup cron全保留。Manifest SHA256 `4e28fc44c9ac4c2eb706d8a686bd19a0ac20e000fa954e3ce16bfd43db87218e`；immutable目錄 `integration-transfer/planner-candidate-4cb7`。完整receipts在authority。

Firebase僅加入最終精確host，移除被取代試用host，原5個domains不變。preview-v1 merged rules發布並讀回SHA256 `fef400543055eab96ddc493a558d7e0da0b2cc54561fbd9cf66e2daf264fcb68`，既有規則bytes保留。

## 重建與gates

Pinned clean source：`pnpm install --frozen-lockfile`，提供已授權Firebase web config與 `VITE_FIREBASE_NAMESPACE=preview-v1`，執行 `pnpm run build:preview`。TOWER忽略git的設定在 `.private-integration/firebase-preview.env`，build暫時注入後清理，不輸出秘密／提交設定。普通 `pnpm run build` 未設定雲端環境時保持本機demo。

Build metadata記錄source/lock/namespace/base/synthetic-only/AI-disabled。Assembler驗證完整baseline bytes後建立全新目錄，只加入Planner與審查過的root append fragments。Publisher API寫入前檢查source、emulator、independent review、rules applied/readback、所有exact function archives及新鮮live traffic policy。API `tr` wire keys依官方CLI27.10.2正規化，保留觀察值、不以常數猜測。

## 路由與隔離

- base/assets/trip/day在 /travel-planner/；根路徑有／無slash用scoped internal 200 rewrite，避免Netlify slash normalization的301自循環。沒有全站或任意Planner catchall。
- 明確trip/day SPA routes；API disabled JSON404、missing assets404不落入SPA。
- Google使用既有Firebase Auth domain官方popup handler；保留app deep route，不改共享root callback。
- manifest id/start_url/scope、SW registration、Service-Worker-Allowed均 /travel-planner/。SW no-store、API private/no-store、hash assets immutable；API/Firebase/map tiles不快取。
- Accepted inventory無root sw.js/service-worker.js。最終新origin已驗證；正式既有裝置的歷史registrations仍需release檢查。
- Planner未借用兄弟keys/functions，AI disabled，沒有新增function。保留兄弟原有服務不表示Planner使用其技術或資料。

18組remote probes及完整bytes/functions/routes/traffic/cron PASS。真實Owner OAuth與雙origin CRUD PASS；獨立contexts真實雲端、真實雲端離線、實體iPhone仍UNVERIFIED。

## 正式發布與回復

Production仍 `6abf52a7be775989aeaab09d`，無DNS／計費變更。Preview receipt永久 `mode=preview`，不可promotion。正式版需新建適用v1的設定與完整candidate、完成acceptance/fresh review/live baseline gates，最後另外取得Owner production授權。

回復只替換Planner component，保留**當下最新**兄弟artifacts/functions；禁止歷史整站restore。Firestore回復也重讀最新規則、保留期間其他核准更新，只移除Planner fragment及精確preview domain。
