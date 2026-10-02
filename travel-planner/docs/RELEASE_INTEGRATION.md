# /travel-planner/ 發布準備 — 不含發布授權

來源 `blackeirose/YSU-Tools/travel-planner`；此 repo 的 CNAME 並不代表其擁有共享站完整 router／部署權。

已查明共享 site：`ycsu-tools-router` / `b23018a8-efe1-4086-b7ea-1d9018b2cf40` / tools.ycsu.cc。唯一 supported 完整站點發布流程是 [social-capture-tool SHARED_HOST_RELEASE](https://github.com/blackeirose/social-capture-tool/blob/7f51fee20ff704ae15fb621fca4cc9c6bae064b7/docs/SHARED_HOST_RELEASE.md)，腳本 `scripts/shared_host_release.py`，contract `deploy/shared-host/contract.json`。Capture 三 functions 的 routes/modes/cleanup cron、UMS、Fire Pump、Plumbing proxy 及全部鄰近檔案 hash 必須保留。該 contract 尚未登錄本 component，需要 Owner 另授權的 authority repo 整合審查；本任務不改它。

## 可重建 component

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm stage
```

產生忽略 git 的 `artifacts/component-<hash>/travel-planner/` 與 component-manifest.json 的每檔 SHA256。以 source commit、lockfile 和 build 重建；唯一成果在 git 原始碼，無臨時 ZIP 依賴。`dist`／component 不是完整站點，禁止 `netlify deploy --prod --dir dist` 或將此 repo 直接連接共享站。未建立任何新 site／替代網域。

## 待 authority 審查的局部整合

1. 從當前 live accepted 完整 artifact 加入 `travel-planner/`，其他 component bytes、function digests/routes/modes/cron 不變；新增 component source provenance/required files/probes 到 authority contract。
2. 只增加以下 scoped redirect fragment，確認精確 API function route 先匹配，避免 catchall 吞掉 API；不得加 root `/*` rewrite：

```text
/travel-planner          /travel-planner/             301
/travel-planner/trips/*  /travel-planner/index.html    200
```

Browser route `/travel-planner/trips/{uuid}/day/{YYYY-MM-DD}` 恢復選定旅程／日期；assets 絕對 prefix `/travel-planner/assets/`。未知深層 trip route 提供 app shell 後回既有可用旅程。API function path 精確 `/travel-planner/api/explore`，不使用 catchall；只能在授權設定後加進完整 function contract，不影響 Capture。

3. scoped header 建議：HTML/manifest/sw.js `Cache-Control: no-cache`，hashed assets `public,max-age=31536000,immutable`；API `private,no-store`（function 本身已有）；保留共享其他 headers。SW script 不設定更寬 Service-Worker-Allowed；其預設及註冊 scope 均 `/travel-planner/`。
4. manifest `id/start_url/scope=/travel-planner/`、icons 同 prefix。SW static allowlist + content-hashed cache，只清理 `ysu-travel-planner-shell-*`，不攔截兄弟路徑、不快取私人 API/tiles。更新在舊 tabs 關閉後接管，避免編輯中強制 reload。
5. 在 authority 的隔離完整站 preview 驗證同子路徑、深層直開與重新整理、Auth popup 回到原 route、API ownership、現有全部 neighbor probes/functions/cron。

目前無已確認安全可寫的隔離 preview；不建立替代正式網域。已完成本機同子路徑驗證。公開 web reader 無法存取 root/sw.js/service-worker.js，不能宣稱已完整排除 live 根 SW；發布前需由可讀 live artifact＋瀏覽器 registration inventory 查核。已讀 authority redirect contract，沒有通用 SPA catchall。這個 live root SW 查核是發布 gate，不阻止本機產品。

## 授權後 production gate

Owner 另行明確授權正式部署後，使用該 authority：最新 baseline／完整 component hashes／所有 Capture functions／route header 契約／approved credentials、不可有待完成 acceptance 或未知 functions。先建完整 immutable candidate，再 authority validate，逐項 live acceptance，最後才 promotion；本文件不授權執行任何 publish。

## 回復

本次未發布，現有 production LKG 未改。若未來需要回退 Travel Planner，從前一個已驗證的 source commit 重建它，合成最新其他 components 與最新 Capture functions，走同一 authority gate。不可還原歷史整站 deployment 覆蓋較新的兄弟工具。匯出 JSON 帶 schemaVersion 可保留私人資料；資料 schema 改版需另作版本遷移審查。
