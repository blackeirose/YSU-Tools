import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
async function login(page: Page, email: string) {
  await page.goto("http://127.0.0.1:4174/travel-planner/");
  await page
    .getByRole("button", { name: "私人登入", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  // This field exists ONLY for explicitly configured loopback emulators.
  await expect(dialog.getByLabel("Emulator 測試 Email")).toBeVisible();
  await dialog.getByLabel("Emulator 測試 Email").fill(email);
  await dialog.getByLabel("Emulator 測試密碼").fill("Synthetic-test-only-2030");
  await dialog.getByRole("button", { name: "測試登入", exact: true }).click();
  await expect(page.getByText("已同步", { exact: true })).toBeVisible();
}
async function quick(page: Page, name: string) {
  await page.getByLabel("新增地點名稱或 Maps URL").first().fill(name);
  await page
    .getByRole("button", { name: "新增地點", exact: true })
    .first()
    .click();
  await expect(page.getByRole("article", { name, exact: true })).toBeVisible();
}
async function editing(page: Page) {
  const button = page.getByRole("button", { name: "編輯", exact: true });
  await expect(button).toBeVisible();
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
  await expect(page.locator("main")).toHaveClass(/edit-mode/);
}
async function operations(page: Page) {
  const drawer = page.locator("details.trip-operations");
  if (!(await drawer.evaluate((element) => (element as HTMLDetailsElement).open)))
    await drawer.locator(":scope > summary").click();
}
async function createRangeTrip(page: Page, name: string) {
  await page.getByRole("button", { name: "新增旅程", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("旅程名稱").fill(name);
  await dialog.getByLabel("開始日期").fill("2030-01-01");
  await dialog.getByLabel("結束日期").fill("2030-01-03");
  await dialog.getByLabel("城市", { exact: true }).fill("東京");
  await dialog.getByRole("button", { name: "儲存旅程" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("已同步", { exact: true })).toBeVisible();
  await editing(page);
}
async function shorten(page: Page) {
  await operations(page);
  await page.getByRole("button", { name: "編輯旅程" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("結束日期").fill("2030-01-02");
  await dialog.getByRole("button", { name: "儲存旅程" }).click();
  await expect(dialog).toHaveCount(0);
}
test("configured Preview local mode survives a deep-link reload and clears on sign-out", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto("http://127.0.0.1:4174/travel-planner/");
    await page.getByRole("button", { name: "使用本機模式" }).first().click();
    await page.getByRole("button", { name: "載入示範", exact: true }).click();
    await expect(page.getByRole("heading", { name: "東京 · 合成示範" })).toBeVisible();
    const deep = page.url();
    expect(deep).toContain("/travel-planner/trips/");
    await page.goto(deep);
    await expect(page.getByRole("heading", { name: "東京 · 合成示範" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "東京 · 合成示範" })).toBeVisible();
    await expect(page.getByRole("button", { name: "離開本機模式" })).toBeEnabled();
    await page.getByRole("button", { name: "離開本機模式", exact: true }).click();
    const backupDownload = page.waitForEvent("download");
    await page.getByRole("dialog").getByRole("button", { name: "下載本機備份" }).click();
    const backup = JSON.parse(await readFile((await (await backupDownload).path())!, "utf8"));
    expect(backup.schemaVersion).toBe(2);
    expect(backup.records.some((record: { kind: string }) => record.kind === "trip")).toBe(true);
    await page.getByRole("dialog").getByRole("button", { name: "清除並離開" }).click();
    await expect(page.getByRole("button", { name: "使用本機模式" }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "使用本機模式" }).first()).toBeVisible();
    await page.getByRole("button", { name: "使用本機模式" }).first().click();
    await expect(page.getByRole("heading", { name: "東京 · 合成示範" })).toHaveCount(0);
  } finally { await context.close(); }
});
test("emulator: same-origin upgrade quarantines a synthetic unguarded old pending move without losing later edits", async ({ browser }) => {
  const context = await browser.newContext(), peer = await browser.newContext();
  const page = await context.newPage(), other = await peer.newPage();
  const email = `legacy-${crypto.randomUUID()}@example.test`;
  try {
    await login(page, email);
    await createRangeTrip(page, "Synthetic old-pending upgrade");
    await quick(page, "Legacy move stop");
    await expect(page.getByText("已同步", { exact: true })).toBeVisible();
    await login(other, email);
    await expect(other.getByRole("article", { name: "Legacy move stop" })).toBeVisible();
    await page.close();

    // Load a static file on the *same origin* so no Planner store is running
    // while the pre-guard IndexedDB shape is installed. Never touch a real
    // account or transfer its private browser storage between origins.
    const seed = await context.newPage();
    await seed.goto("http://127.0.0.1:4174/travel-planner/api-unavailable.json");
    await seed.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("ysu-travel-planner-v1", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction("accounts", "readwrite");
          const records = tx.objectStore("accounts");
          const keys = records.getAllKeys();
          keys.onsuccess = () => {
            if (keys.result.length !== 1) { tx.abort(); return; }
            const key = keys.result[0];
            const read = records.get(key);
            read.onsuccess = () => {
              const snapshot = read.result;
              const item = snapshot.records.find((row: { kind: string }) => row.kind === "item");
              if (!item || snapshot.pending.length) { tx.abort(); return; }
              const after = { ...item, day: "2030-01-02", revision: item.revision + 1,
                updatedAt: new Date().toISOString() };
              const legacy = { id: crypto.randomUUID(), label: "old offline move",
                changes: [{ id: item.id, before: item, after }] };
              records.put({ ...snapshot, records: snapshot.records.map((row: { id: string }) =>
                row.id === item.id ? after : row), pending: [legacy], undo: legacy }, key);
            };
          };
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error ?? new Error("synthetic seed aborted"));
        });
      } finally { db.close(); }
    });
    await seed.close();

    const upgraded = await context.newPage();
    await upgraded.goto("http://127.0.0.1:4174/travel-planner/");
    await expect(upgraded.locator(".conflict")).toBeVisible({ timeout: 45000 });
    await expect(upgraded.locator(".conflict")).toContainText("升級前的離線操作");
    const backup = upgraded.waitForEvent("download");
    await upgraded.getByRole("button", { name: "下載兩份備份" }).click();
    const saved = await backup;
    const contents = await readFile((await saved.path())!, "utf8");
    const kept = JSON.parse(contents) as { reason: string; operation: { label: string; changes: {
      id: string; before: { day: string }; after: { day: string } }[] }; remote: { id: string; day: string }[] };
    expect(kept.reason).toBe("legacy");
    expect(kept.operation.label).toBe("old offline move");
    expect(kept.operation.changes[0].before.day).toBe("2030-01-01");
    expect(kept.operation.changes[0].after.day).toBe("2030-01-02");
    expect(kept.remote).toEqual(expect.arrayContaining([expect.objectContaining({
      id: kept.operation.changes[0].id, day: "2030-01-01" })]));
    await upgraded.getByRole("button", { name: /使用遠端版本/ }).click();
    await expect(upgraded.locator(".conflict")).toHaveCount(0);
    await expect(upgraded.locator('[data-day="2030-01-01"]')
      .getByRole("article", { name: "Legacy move stop" })).toBeVisible();
    await upgraded.reload();
    await expect(upgraded.locator('[data-day="2030-01-01"]')
      .getByRole("article", { name: "Legacy move stop" })).toBeVisible();
    await expect(other.locator('[data-day="2030-01-01"]')
      .getByRole("article", { name: "Legacy move stop" })).toBeVisible();
    await editing(upgraded);
    await quick(upgraded, "After legacy recovery");
    await expect(other.getByRole("article", { name: "After legacy recovery" })).toBeVisible({ timeout: 45000 });
  } finally { await Promise.allSettled([context.close(), peer.close()]); }
});
test("emulator: offline reorder versus remote note preserves both versions and later edits", async ({ browser }) => {
  const first = await browser.newContext(), second = await browser.newContext();
  const a = await first.newPage(), b = await second.newPage();
  const email = `sort-${crypto.randomUUID()}@example.test`;
  try {
    await login(a, email);
    await createRangeTrip(a, "Synthetic reorder conflict");
    await quick(a, "First stop");
    await quick(a, "Second stop");
    await expect(a.getByText("已同步", { exact: true })).toBeVisible();
    await login(b, email);
    await editing(b);
    await expect(b.getByRole("article", { name: "Second stop" })).toBeVisible();

    await first.setOffline(true);
    await a.getByRole("button", { name: "Second stop上移", exact: true }).click();
    await expect(a.locator('[data-day="2030-01-01"] article').first())
      .toHaveAttribute("aria-label", "Second stop");
    await a.reload();
    await expect(a.locator('[data-day="2030-01-01"] article').first())
      .toHaveAttribute("aria-label", "Second stop");
    await expect(a.getByText("離線 · 修改待同步", { exact: true })).toBeVisible();

    await b.getByRole("article", { name: "Second stop" })
      .getByRole("button", { name: "時間／備註" }).click();
    await b.getByRole("dialog").getByLabel("這次安排的備註").fill("Remote note retained");
    await b.getByRole("dialog").getByRole("button", { name: "儲存安排" }).click();
    await expect(b.getByRole("dialog")).toHaveCount(0);
    await expect(b.getByRole("article", { name: "Second stop" }))
      .toContainText("Remote note retained");
    await expect(b.getByText("已同步", { exact: true })).toBeVisible();

    await first.setOffline(false);
    await expect(a.locator(".conflict")).toBeVisible({ timeout: 45000 });
    const backup = a.waitForEvent("download");
    await a.getByRole("button", { name: "下載兩份備份" }).click();
    const saved = await backup;
    const versions = JSON.parse(await readFile((await saved.path())!, "utf8")) as {
      operation: { changes: { id: string; before: { order: number }; after: { order: number } }[] };
      remote: { id: string; order: number; notes: string }[];
    };
    const moved = versions.operation.changes.find((change) =>
      change.before.order === 1 && change.after.order === 0);
    expect(moved).toBeDefined();
    expect(versions.remote).toEqual(expect.arrayContaining([expect.objectContaining({
      id: moved!.id, order: 1, notes: "Remote note retained" })]));
    await a.getByRole("button", { name: /使用遠端版本/ }).click();
    await expect(a.locator(".conflict")).toHaveCount(0);
    await a.reload();
    await expect(a.locator('[data-day="2030-01-01"] article').first())
      .toHaveAttribute("aria-label", "First stop");
    await expect(a.getByRole("article", { name: "Second stop" }))
      .toContainText("Remote note retained");

    await editing(a);
    await a.getByRole("button", { name: "Second stop上移", exact: true }).click();
    await expect(b.locator('[data-day="2030-01-01"] article').first())
      .toHaveAttribute("aria-label", "Second stop");
    await expect(b.getByRole("article", { name: "Second stop" }))
      .toContainText("Remote note retained");
  } finally { await Promise.allSettled([first.close(), second.close()]); }
});

test("cloud deep link survives a stale same-origin trip cache until the server confirms the new date", async ({ browser }) => {
  const writer = await browser.newContext(), stale = await browser.newContext();
  const a = await writer.newPage(), b = await stale.newPage();
  const email = `route-${crypto.randomUUID()}@example.test`;
  try {
    await login(a, email);
    await a.getByRole("button", { name: "新增旅程", exact: true }).click();
    let dialog = a.getByRole("dialog");
    await dialog.getByLabel("旅程名稱").fill("Stale deep-link synthetic trip");
    await dialog.getByLabel("開始日期").fill("2030-01-01");
    await dialog.getByLabel("結束日期").fill("2030-01-02");
    await dialog.getByLabel("城市", { exact: true }).fill("東京");
    await dialog.getByRole("button", { name: "儲存旅程" }).click();
    await expect(a.getByText("已同步", { exact: true })).toBeVisible();
    await expect(a).toHaveURL(/\/travel-planner\/trips\/[0-9a-f-]{36}\/day\/2030-01-01/);
    const tripId = a.url().match(/\/trips\/([0-9a-f-]{36})\/day\//)?.[1];
    expect(tripId).toBeTruthy();

    await login(b, email);
    await expect(b.getByRole("heading", { name: "Stale deep-link synthetic trip" })).toBeVisible();
    await b.close(); // Preserve IndexedDB/Auth, but stop this context receiving the extension.

    await operations(a);
    await a.getByRole("button", { name: "編輯旅程" }).click();
    dialog = a.getByRole("dialog");
    await dialog.getByLabel("結束日期").fill("2030-01-03");
    await dialog.getByRole("button", { name: "儲存旅程" }).click();
    await expect(a.getByText("已同步", { exact: true })).toBeVisible();

    const reopened = await stale.newPage();
    const deep = `http://127.0.0.1:4174/travel-planner/trips/${tripId}/day/2030-01-03`;
    await reopened.goto(deep);
    await expect(reopened.getByText("已同步", { exact: true })).toBeVisible();
    await expect(reopened.getByLabel("旅行日期", { exact: true })).toHaveValue("2030-01-03");
    expect(reopened.url()).toBe(deep);

    // A local pending Trip edit can block merging the newer server range.
    // Keep the requested deep link visible until the user resolves the
    // conflict, instead of silently replacing it with the old cached day.
    await stale.setOffline(true);
    await operations(reopened);
    await reopened.getByRole("button", { name: "編輯旅程" }).click();
    dialog = reopened.getByRole("dialog");
    await dialog.getByLabel("結束日期").fill("2030-01-02");
    await dialog.getByLabel("結束日期").press("Tab");
    await dialog.getByRole("button", { name: "儲存旅程" }).click();
    await expect(reopened.getByText(/2030-01-01 — 2030-01-02/)).toBeVisible();
    await expect(reopened.getByText("離線 · 修改待同步", { exact: true })).toBeVisible();
    await reopened.close();
    await operations(a);
    await a.getByRole("button", { name: "編輯旅程" }).click();
    dialog = a.getByRole("dialog");
    await dialog.getByLabel("結束日期").fill("2030-01-04");
    await dialog.getByRole("button", { name: "儲存旅程" }).click();
    await expect(a.getByText("已同步", { exact: true })).toBeVisible();
    await stale.setOffline(false);
    const conflictPage = await stale.newPage();
    const conflictDeep = `http://127.0.0.1:4174/travel-planner/trips/${tripId}/day/2030-01-04`;
    await conflictPage.goto(conflictDeep);
    await expect(conflictPage.locator(".conflict")).toBeVisible({ timeout: 45000 });
    expect(conflictPage.url()).toBe(conflictDeep);
  } finally { await Promise.allSettled([writer.close(), stale.close()]); }
});
test("R1 emulator: login errors stay in dialog, cancellation and retry recover", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = `auth-${crypto.randomUUID()}@example.test`;
  try {
    await login(page, email);
    await page.getByRole("button", { name: "登出", exact: true }).click();
    await page.getByRole("button", { name: "私人登入", exact: true }).first().click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("Emulator 測試 Email").fill(email);
    await dialog.getByLabel("Emulator 測試密碼").fill("Wrong synthetic password");
    await dialog.getByRole("button", { name: "測試登入" }).click();
    await expect(dialog.getByRole("alert")).toContainText("登入未完成");
    await expect(dialog.getByRole("button", { name: "使用本機模式" })).toBeVisible();
    await dialog.getByRole("button", { name: "取消", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "私人登入", exact: true }).first().click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Emulator 測試 Email").fill(email);
    await dialog.getByLabel("Emulator 測試密碼").fill("Synthetic-test-only-2030");
    await dialog.getByRole("button", { name: "測試登入" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText("已同步", { exact: true })).toBeVisible();
  } finally { await context.close(); }
});
test("R7 emulator: offline new item versus trip shortening conflicts in both commit orders", async ({ browser }) => {
  const first = await browser.newContext(), second = await browser.newContext();
  const a = await first.newPage(), b = await second.newPage();
  const email = `range-${crypto.randomUUID()}@example.test`;
  try {
    await login(a, email);
    await createRangeTrip(a, "Range case A");
    await login(b, email);
    await expect(b.getByRole("heading", { name: "Range case A" })).toBeVisible();
    await editing(b);
    await first.setOffline(true);
    await a.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-03");
    await quick(a, "Offline Jan3 new");
    await shorten(b);
    await expect(b.getByText("已同步", { exact: true })).toBeVisible();
    await first.setOffline(false);
    await expect(a.locator(".conflict")).toBeVisible({ timeout: 45000 });
    expect(await a.locator(".conflict").textContent()).toContain("同步衝突");
    const backup = a.waitForEvent("download");
    await a.getByRole("button", { name: "下載兩份備份" }).click();
    await backup;
    await a.getByRole("button", { name: /使用遠端版本/ }).click();
    await expect(a.locator(".conflict")).toHaveCount(0);
    await expect(a.getByRole("article", { name: "Offline Jan3 new" })).toHaveCount(0);

    await createRangeTrip(a, "Range case B");
    await quick(a, "Move into Jan3");
    await expect(a.getByText("已同步", { exact: true })).toBeVisible();
    await b.getByRole("combobox", { name: "選擇旅程" }).selectOption({ label: "Range case B" });
    await expect(b.getByRole("article", { name: "Move into Jan3" })).toBeVisible();
    await second.setOffline(true);
    await shorten(b);
    const rangeItem = a.getByRole("article", { name: "Move into Jan3" });
    await rangeItem.getByRole("button", { name: "Move into Jan3移到某日", exact: true }).click();
    await rangeItem.getByRole("button", { name: "Move into Jan3移到某日 2030-01-03" }).click();
    await expect(a.locator('[data-day="2030-01-03"]').getByRole("article", { name: "Move into Jan3" })).toBeVisible();
    await expect(a.getByText("已同步", { exact: true })).toBeVisible();
    await second.setOffline(false);
    await expect(b.locator(".conflict")).toBeVisible({ timeout: 45000 });
    await b.getByRole("button", { name: "保留本機版本並重新同步" }).click();
    await expect(b.locator(".conflict")).toHaveCount(0);
    await expect(b.getByText("已同步", { exact: true })).toBeVisible();
    await b.getByRole("button", { name: /候選/ }).first().click();
    await expect(b.getByRole("article", { name: "Move into Jan3" })).toContainText("因旅程日期縮短移入待定");
    await expect(b.getByLabel("旅行日期", { exact: true })).not.toContainText("2030-01-03");
  } finally {
    await Promise.allSettled([first.close(), second.close()]);
  }
});
test("emulator: independent same-user contexts synchronize both directions and preserve offline move/delete conflict", async ({
  browser,
}) => {
  const first = await browser.newContext(),
    second = await browser.newContext(),
    third = await browser.newContext();
  const a = await first.newPage(),
    b = await second.newPage(),
    other = await third.newPage();
  const email = `planner-${crypto.randomUUID()}@example.test`;
  try {
    await login(a, email);
    await a.getByRole("button", { name: "新增旅程", exact: true }).click();
    const dialog = a.getByRole("dialog");
    await dialog.getByLabel("旅程名稱").fill("Emulator private trip");
    await dialog.getByLabel("開始日期").fill("2030-01-01");
    await dialog.getByLabel("結束日期").fill("2030-01-03");
    await dialog.getByLabel("城市", { exact: true }).fill("東京");
    await dialog.getByRole("button", { name: "儲存旅程" }).click();
    await expect(a.getByText("已同步", { exact: true })).toBeVisible();
    await editing(a);
    await quick(a, "A to B");
    await expect(a.getByText("已同步", { exact: true })).toBeVisible();
    await login(b, email);
    await editing(b);
    await expect(
      b.getByRole("article", { name: "A to B", exact: true }),
    ).toBeVisible();
    await quick(b, "B to A");
    await expect(
      a.getByRole("article", { name: "B to A", exact: true }),
    ).toBeVisible();
    await editing(a);
    await editing(b);
    // A long-lived draft must not silently overwrite B's already-delivered edit.
    await a
      .getByRole("article", { name: "A to B", exact: true })
      .getByRole("button", { name: "時間／備註" })
      .click();
    await a
      .getByRole("dialog")
      .getByLabel("這次安排的備註")
      .fill("unsaved A draft");
    await b
      .getByRole("article", { name: "A to B", exact: true })
      .getByRole("button", { name: "時間／備註" })
      .click();
    await b
      .getByRole("dialog")
      .getByLabel("這次安排的備註")
      .fill("B newer version");
    await b
      .getByRole("dialog")
      .getByRole("button", { name: "儲存安排" })
      .click();
    await expect(b.getByText("已同步", { exact: true })).toBeVisible();
    await expect(
      a.getByRole("article", { name: "A to B", exact: true }),
    ).toContainText("B newer version");
    await expect(
      a.getByRole("dialog").getByLabel("這次安排的備註"),
    ).toHaveValue("unsaved A draft");
    await a
      .getByRole("dialog")
      .getByRole("button", { name: "儲存安排" })
      .click();
    await expect(a.getByRole("dialog")).toContainText("草稿仍保留");
    await a
      .getByRole("dialog")
      .getByRole("button", { name: "關閉", exact: true })
      .click();
    await a.reload();
    await editing(a);
    await expect(
      a.getByRole("article", { name: "A to B", exact: true }),
    ).toContainText("B newer version");
    await login(other, `other-${crypto.randomUUID()}@example.test`);
    await expect(
      other.getByRole("heading", {
        name: "Emulator private trip",
        exact: true,
      }),
    ).toHaveCount(0);
    await first.setOffline(true);
    const itemToMove = a.getByRole("article", { name: "A to B", exact: true });
    await itemToMove.getByRole("button", { name: "A to B移到某日", exact: true }).click();
    await itemToMove.getByRole("button", { name: "A to B移到某日 2030-01-02" }).click();
    await quick(a, "Offline new record");
    // The built app shell and pending operations must survive an offline reload.
    await a.reload();
    await expect(
      a.getByRole("article", { name: "Offline new record", exact: true }),
    ).toBeVisible();
    const victim = b.getByRole("article", { name: "A to B", exact: true });
    await victim.getByRole("button", { name: "刪除安排", exact: true }).click();
    await expect(victim).toHaveCount(0);
    await expect(b.getByText("已同步", { exact: true })).toBeVisible();
    await first.setOffline(false);
    await expect(a.locator(".conflict")).toBeVisible({ timeout: 45000 });
    const backup = a.waitForEvent("download");
    await a.getByRole("button", { name: "下載兩份備份" }).click();
    const saved = await backup;
    expect(saved.suggestedFilename()).toBe("travel-conflict.json");
    expect(await readFile((await saved.path())!, "utf8")).toContain("Offline new record");
    await a.getByRole("button", { name: /使用遠端版本/ }).click();
    await expect(a.locator(".conflict")).toHaveCount(0);
    await expect(
      a.getByRole("article", { name: "A to B", exact: true }),
    ).toHaveCount(0);
    // Choosing remote explicitly discards the whole dependent local batch;
    // its new stop remains recoverable from the downloaded conflict backup.
    await expect(
      b.getByRole("article", { name: "Offline new record", exact: true }),
    ).toHaveCount(0);
    // A separate offline creation without a competing edit must still sync.
    await expect(a.getByText("已同步", { exact: true })).toBeVisible();
    await a.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-01");
    await first.setOffline(true);
    await quick(a, "Offline independent record");
    await first.setOffline(false);
    await expect(
      b.getByRole("article", { name: "Offline independent record", exact: true }),
    ).toBeVisible({ timeout: 45000 });
    const peerItem = b.getByRole("article", { name: "B to A", exact: true });
    await peerItem.getByRole("button", { name: "B to A移到某日", exact: true }).click();
    await peerItem.getByRole("button", { name: "B to A移到某日 2030-01-02" }).click();
    await expect(
      a
        .locator('[data-day="2030-01-02"]')
        .getByRole("article", { name: "B to A", exact: true }),
    ).toBeVisible();
    await operations(b);
    await b.getByRole("button", { name: "復原", exact: true }).click();
    await expect(
      a
        .locator('[data-day="2030-01-01"]')
        .getByRole("article", { name: "B to A", exact: true }),
    ).toBeVisible();
    // Reordering and delete/Undo propagate as versioned record operations.
    await b.getByRole("button", { name: "B to A上移", exact: true }).click();
    await expect(
      a.locator('[data-day="2030-01-01"] article').first(),
    ).toHaveAttribute("aria-label", "B to A");
    await b
      .getByRole("article", { name: "B to A", exact: true })
      .getByRole("button", { name: "刪除安排", exact: true })
      .click();
    await expect(
      a.getByRole("article", { name: "B to A", exact: true }),
    ).toHaveCount(0);
    await operations(b);
    await b.getByRole("button", { name: "復原", exact: true }).click();
    await expect(
      a.getByRole("article", { name: "B to A", exact: true }),
    ).toBeVisible();
    // Choosing local after a competing offline/online edit is explicit and syncs.
    await first.setOffline(true);
    await editing(a);
    await a
      .getByRole("article", { name: "B to A", exact: true })
      .getByRole("button", { name: "時間／備註" })
      .click();
    await a
      .getByRole("dialog")
      .getByLabel("這次安排的備註")
      .fill("Offline chosen version");
    await a
      .getByRole("dialog")
      .getByRole("button", { name: "儲存安排" })
      .click();
    await expect(a.getByRole("dialog")).toHaveCount(0);
    await expect(
      a.getByRole("article", { name: "B to A", exact: true }),
    ).toContainText("Offline chosen version");
    await expect(
      a.getByText("離線 · 修改待同步", { exact: true }),
    ).toBeVisible();
    await editing(b);
    await b
      .getByRole("article", { name: "B to A", exact: true })
      .getByRole("button", { name: "時間／備註" })
      .click();
    await b
      .getByRole("dialog")
      .getByLabel("這次安排的備註")
      .fill("Competing remote version");
    await b
      .getByRole("dialog")
      .getByRole("button", { name: "儲存安排" })
      .click();
    // Click resolves before the async save/flush: a pre-existing "已同步"
    // badge alone does not prove this edit was applied or acknowledged.
    await expect(b.getByRole("dialog")).toHaveCount(0);
    await expect(
      b.getByRole("article", { name: "B to A", exact: true }),
    ).toContainText("Competing remote version");
    await expect(b.getByText("已同步", { exact: true })).toBeVisible();
    await first.setOffline(false);
    await expect(a.locator(".conflict")).toBeVisible({ timeout: 45000 });
    await a
      .getByRole("button", { name: "保留本機版本並重新同步", exact: true })
      .click();
    await expect(
      b.getByRole("article", { name: "B to A", exact: true }),
    ).toContainText("Offline chosen version");
    await a.setViewportSize({ width: 1440, height: 1000 });
    await a.screenshot({
      path: "test-results/emulator-desktop.png",
      fullPage: true,
    });
    await a.setViewportSize({ width: 390, height: 844 });
    await a.screenshot({
      path: "test-results/emulator-mobile.png",
      fullPage: true,
    });
    await a.getByRole("button", { name: "登出", exact: true }).click();
    await expect(
      a.getByRole("heading", { name: "Emulator private trip", exact: true }),
    ).toHaveCount(0);
    await login(a, email);
    await expect(
      a.getByRole("article", { name: "B to A", exact: true }),
    ).toBeVisible();
    await a.getByRole("button", { name: "登出", exact: true }).click();
    await login(a, `new-owner-${crypto.randomUUID()}@example.test`);
    await expect(
      a.getByRole("article", { name: "B to A", exact: true }),
    ).toHaveCount(0);
  } finally {
    await Promise.allSettled([first.close(), second.close(), third.close()]);
  }
});
