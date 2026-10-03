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
async function createRangeTrip(page: Page, name: string) {
  await page.getByRole("button", { name: "新增旅程", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("旅程名稱").fill(name);
  await dialog.getByLabel("開始日期").fill("2030-01-01");
  await dialog.getByLabel("結束日期").fill("2030-01-03");
  await dialog.getByRole("button", { name: "儲存旅程" }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.getByText("已同步", { exact: true })).toBeVisible();
}
async function shorten(page: Page) {
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
    await page.getByRole("button", { name: "離開本機模式", exact: true }).click();
    const backupDownload = page.waitForEvent("download");
    await page.getByRole("dialog").getByRole("button", { name: "下載本機備份" }).click();
    const backup = JSON.parse(await readFile((await (await backupDownload).path())!, "utf8"));
    expect(backup.schemaVersion).toBe(1);
    expect(backup.records.some((record: { kind: string }) => record.kind === "trip")).toBe(true);
    await page.getByRole("dialog").getByRole("button", { name: "清除並離開" }).click();
    await expect(page.getByRole("button", { name: "使用本機模式" }).first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", { name: "使用本機模式" }).first()).toBeVisible();
    await page.getByRole("button", { name: "使用本機模式" }).first().click();
    await expect(page.getByRole("heading", { name: "東京 · 合成示範" })).toHaveCount(0);
  } finally { await context.close(); }
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
    await a.getByRole("article", { name: "Move into Jan3" })
      .getByRole("combobox", { name: "Move into Jan3移到某日" }).selectOption("2030-01-03");
    await expect(a.getByText("已同步", { exact: true })).toBeVisible();
    await second.setOffline(false);
    await expect(b.locator(".conflict")).toBeVisible({ timeout: 45000 });
    await b.getByRole("button", { name: "保留本機版本並重新同步" }).click();
    await expect(b.locator(".error.banner")).toContainText("其他裝置已有安排");
    await expect(b.locator(".conflict")).toBeVisible();
    await b.getByRole("button", { name: /使用遠端版本/ }).click();
    await expect(b.getByRole("article", { name: "Move into Jan3" })).toBeVisible();
    await expect(b.getByLabel("旅行日期", { exact: true })).toContainText("2030-01-03");
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
    await dialog.getByRole("button", { name: "儲存旅程" }).click();
    await quick(a, "A to B");
    await expect(a.getByText("已同步", { exact: true })).toBeVisible();
    await login(b, email);
    await expect(
      b.getByRole("article", { name: "A to B", exact: true }),
    ).toBeVisible();
    await quick(b, "B to A");
    await expect(
      a.getByRole("article", { name: "B to A", exact: true }),
    ).toBeVisible();
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
    await a
      .getByRole("article", { name: "A to B", exact: true })
      .getByRole("combobox", { name: "A to B移到某日", exact: true })
      .selectOption("2030-01-02");
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
    await b
      .getByRole("article", { name: "B to A", exact: true })
      .getByRole("combobox", { name: "B to A移到某日", exact: true })
      .selectOption("2030-01-02");
    await expect(
      a
        .locator('[data-day="2030-01-02"]')
        .getByRole("article", { name: "B to A", exact: true }),
    ).toBeVisible();
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
    await b.getByRole("button", { name: "復原", exact: true }).click();
    await expect(
      a.getByRole("article", { name: "B to A", exact: true }),
    ).toBeVisible();
    // Choosing local after a competing offline/online edit is explicit and syncs.
    await first.setOffline(true);
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
