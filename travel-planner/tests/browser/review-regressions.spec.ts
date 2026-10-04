import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function demo(page: Page) {
  await page.goto("/travel-planner/");
  await page.getByRole("button", { name: "使用本機模式", exact: true }).click();
  await expect(page.getByText("本機已儲存 · 不跨裝置")).toBeVisible();
  await page.getByRole("button", { name: "載入示範", exact: true }).click();
  await expect(page.getByRole("heading", { name: "東京 · 合成示範", exact: true })).toBeVisible();
}

async function operations(page: Page) {
  const d = page.locator("details.trip-operations");
  if (!(await d.evaluate((el) => (el as HTMLDetailsElement).open)))
    await d.locator(":scope > summary").click();
}

test("wrapped More menu keeps Reminder Center reachable at 1280px", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "The wrapped desktop toolbar is the risk surface");
  await page.setViewportSize({ width: 1280, height: 720 });
  await demo(page);
  await page.locator("details.toolbar-more > summary").click();
  const reminder = page.getByRole("button", { name: "提醒中心", exact: true });
  const box = await reminder.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(1280);
  await reminder.click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "提醒中心" })).toBeVisible();
});

test("R2 mouse and keyboard open card date selector, move, undo and refresh", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Mobile move is exercised through the detail drawer in product.spec.ts");
  await demo(page);
  await page.getByRole("button", { name: "編輯", exact: true }).click();
  await operations(page);
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-07");
  const card = page.getByRole("article", { name: "淺草寺", exact: true }).first();
  const select = card.getByRole("combobox", { name: "淺草寺移到某日" });
  await page.getByRole("button", { name: "關閉訊息" }).click();
  await select.click();
  await expect(select).toBeFocused();
  await select.press("End");
  await select.press("Enter");
  await expect(page.locator(".notice")).toContainText("2030-01-09");
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-09");
  await expect(page.locator('[data-day="2030-01-09"]').getByRole("article", { name: "淺草寺", exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "復原", exact: true }).click();
  await expect(page.locator(".notice")).toContainText("已復原最近一次操作");
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-07");
  await expect(page.locator('[data-day="2030-01-07"]').getByRole("article", { name: "淺草寺", exact: true }).first()).toBeVisible();
  await page.reload();
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-07");
  await expect(page.locator('[data-day="2030-01-07"]').getByRole("article", { name: "淺草寺", exact: true }).first()).toBeVisible();
});
test("R2 single-day trip explains why its move control has no other date", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Desktop inline control; mobile uses the detail drawer");
  await page.goto("/travel-planner/");
  await page.getByRole("button", { name: "使用本機模式", exact: true }).click();
  await page.getByRole("button", { name: "新增旅程", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("旅程名稱").fill("One-day synthetic");
  await dialog.getByLabel("開始日期").fill("2030-01-01");
  await dialog.getByLabel("結束日期").fill("2030-01-01");
  await dialog.getByRole("button", { name: "儲存旅程" }).click();
  await page.getByRole("button", { name: "編輯", exact: true }).click();
  const input = page.getByLabel("新增地點名稱或 Maps URL").first();
  await input.fill("Only stop");
  await page.getByRole("button", { name: "新增地點", exact: true }).first().click();
  const card = page.getByRole("article", { name: "Only stop" });
  await expect(card.getByRole("combobox", { name: "Only stop移到某日" })).toBeDisabled();
  await expect(card).toContainText("目前只有一天，可先延長旅程");
});

test("R3 editing task note preserves existing reminder minutes", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", { name: "待辦", exact: true }).click();
  await page.getByRole("button", { name: "新增待辦" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("事項", { exact: true }).fill("Museum booking synthetic");
  await dialog.getByLabel("截止日期").fill("2030-01-07");
  await dialog.getByLabel("時間", { exact: true }).fill("10:00");
  await dialog.getByRole("button", { name: "新增提前提醒" }).click();
  await dialog.getByLabel("提前提醒（分鐘）").fill("1440");
  await dialog.getByRole("button", { name: "儲存待辦" }).click();
  await expect(dialog).toHaveCount(0);
  const task = page.locator("article.task").filter({ hasText: "Museum booking synthetic" });
  await task.getByRole("button", { name: "編輯", exact: true }).click();
  await expect(dialog.getByLabel("提前提醒（分鐘）")).toHaveValue("1440");
  await dialog.getByLabel("備註", { exact: true }).fill("Only a note changed");
  await dialog.getByRole("button", { name: "儲存待辦" }).click();
  await task.getByRole("button", { name: "編輯", exact: true }).click();
  await expect(dialog.getByLabel("提前提醒（分鐘）")).toHaveValue("1440");
  await dialog.getByRole("button", { name: "關閉", exact: true }).click();
  await page.locator("details.toolbar-more > summary").click();
  await page.getByRole("button", { name: "提醒中心" }).click();
  const reminderCenter = page.getByRole("dialog");
  await expect(reminderCenter.getByText("Museum booking synthetic").first()).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await reminderCenter.getByRole("button", { name: "匯出日曆與 VALARM" }).click();
  const ics = await readFile((await (await downloaded).path())!, "utf8");
  expect(ics).toContain("TRIGGER:-PT1440M");
  expect(ics).toContain("Museum booking synthetic");
});

test("R3 disabled and multiple reminders survive note edits; explicit changes persist", async ({ page }) => {
  await demo(page);
  await page.getByRole("button", { name: "待辦", exact: true }).click();
  await page.getByRole("button", { name: "新增待辦" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("事項", { exact: true }).fill("Two reminders synthetic");
  await dialog.getByLabel("截止日期").fill("2030-01-07");
  await dialog.getByLabel("時間", { exact: true }).fill("10:00");
  await dialog.getByRole("button", { name: "新增提前提醒" }).click();
  await dialog.getByLabel("提前提醒（分鐘）").fill("1440");
  await dialog.getByRole("button", { name: "新增提前提醒" }).click();
  await dialog.getByLabel("提前提醒（分鐘）").nth(1).fill("30");
  await dialog.getByLabel("啟用", { exact: true }).first().uncheck();
  await dialog.getByRole("button", { name: "儲存待辦" }).click();
  const task = page.locator("article.task").filter({ hasText: "Two reminders synthetic" });
  await task.getByRole("button", { name: "編輯", exact: true }).click();
  await expect(dialog.getByLabel("提前提醒（分鐘）")).toHaveCount(2);
  await expect(dialog.getByLabel("啟用", { exact: true }).first()).not.toBeChecked();
  await dialog.getByLabel("備註", { exact: true }).fill("Note only");
  await dialog.getByRole("button", { name: "儲存待辦" }).click();
  await task.getByRole("button", { name: "編輯", exact: true }).click();
  await expect(dialog.getByLabel("提前提醒（分鐘）").first()).toHaveValue("1440");
  await expect(dialog.getByLabel("提前提醒（分鐘）").nth(1)).toHaveValue("30");
  await expect(dialog.getByLabel("啟用", { exact: true }).first()).not.toBeChecked();
  await dialog.getByLabel("提前提醒（分鐘）").nth(1).fill("45");
  await dialog.getByRole("button", { name: "刪除此提醒" }).first().click();
  await dialog.getByRole("button", { name: "儲存待辦" }).click();
  await task.getByRole("button", { name: "編輯", exact: true }).click();
  await expect(dialog.getByLabel("提前提醒（分鐘）")).toHaveCount(1);
  await expect(dialog.getByLabel("提前提醒（分鐘）")).toHaveValue("45");
  await dialog.getByLabel("截止日期").fill("");
  await dialog.getByLabel("時間", { exact: true }).fill("");
  await dialog.getByRole("button", { name: "儲存待辦" }).click();
  await expect(dialog.getByText(/仍有提醒/)).toBeVisible();
  await expect(dialog.getByLabel("提前提醒（分鐘）")).toHaveValue("45");
  await dialog.getByRole("button", { name: "刪除此提醒" }).click();
  await dialog.getByRole("button", { name: "儲存待辦" }).click();
  await task.getByRole("button", { name: "編輯", exact: true }).click();
  await expect(dialog.getByLabel("提前提醒（分鐘）")).toHaveCount(0);
  await expect(dialog.getByLabel("截止日期")).toBeEmpty();
});
test("R3 another tab toggles a reminder while an older task editor saves only notes", async ({ page, context }) => {
  await demo(page);
  await page.getByRole("button", { name: "待辦", exact: true }).click();
  await page.getByRole("button", { name: "新增待辦" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("事項", { exact: true }).fill("Concurrent reminder synthetic");
  await dialog.getByLabel("截止日期").fill("2030-01-07");
  await dialog.getByLabel("時間", { exact: true }).fill("10:00");
  await dialog.getByRole("button", { name: "新增提前提醒" }).click();
  await dialog.getByLabel("提前提醒（分鐘）").fill("1440");
  await dialog.getByRole("button", { name: "儲存待辦" }).click();
  const other = await context.newPage();
  try {
    await other.goto("/travel-planner/");
    await other.getByRole("button", { name: "使用本機模式", exact: true }).click();
    await expect(other.getByRole("heading", { name: "東京 · 合成示範" })).toBeVisible();
    const task = page.locator("article.task").filter({ hasText: "Concurrent reminder synthetic" });
    await task.getByRole("button", { name: "編輯", exact: true }).click();
    await dialog.getByLabel("備註", { exact: true }).fill("A note only");
    await other.locator("details.toolbar-more > summary").click();
    await other.getByRole("button", { name: "提醒中心" }).click();
    const row = other.getByRole("dialog").locator(".saved-result").filter({ hasText: "Concurrent reminder synthetic" });
    await row.getByRole("button", { name: "停用" }).click();
    await expect(row.getByRole("button", { name: "啟用" })).toBeVisible();
    await dialog.getByRole("button", { name: "儲存待辦" }).click();
    await task.getByRole("button", { name: "編輯", exact: true }).click();
    await expect(dialog.getByLabel("提前提醒（分鐘）")).toHaveValue("1440");
    await expect(dialog.getByLabel("啟用", { exact: true })).not.toBeChecked();
    const staleNote = dialog.locator("textarea");
    await expect(staleNote).toHaveAccessibleName("備註");
    await staleNote.fill("stale second note");
    await other.getByRole("dialog").getByRole("button", { name: "關閉", exact: true }).click();
    await other.getByRole("button", { name: "待辦", exact: true }).click();
    await other.locator("article.task").filter({ hasText: "Concurrent reminder synthetic" })
      .getByRole("button", { name: "編輯", exact: true }).click();
    const otherDialog = other.getByRole("dialog");
    await otherDialog.getByRole("button", { name: "新增提前提醒" }).click();
    await otherDialog.getByLabel("提前提醒（分鐘）").nth(1).fill("30");
    await otherDialog.getByRole("button", { name: "儲存待辦" }).click();
    await dialog.getByRole("button", { name: "儲存待辦" }).click();
    await expect(dialog.getByText(/草稿仍保留/)).toBeVisible();
    await dialog.getByRole("button", { name: "關閉", exact: true }).click();
    await task.getByRole("button", { name: "編輯", exact: true }).click();
    await expect(dialog.getByLabel("提前提醒（分鐘）")).toHaveCount(2);
  } finally { await other.close(); }
});

test("R4 choosing another day's card selects its daily map marker", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Multi-day map interaction is desktop-only");
  await demo(page);
  await page.getByLabel("地圖範圍").selectOption("day");
  await page.getByRole("button", { name: "東京國立博物館", exact: false }).first().click();
  await expect(page.getByLabel("旅行日期", { exact: true })).toHaveValue("2030-01-07");
  await expect(page.locator(".map-pin[aria-label*='東京國立博物館']")).toBeVisible();
});

test("R5 invalid quick-add retains draft and succeeds after correction", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Mobile quick-add is covered in product.spec.ts");
  await demo(page);
  await page.getByRole("button", { name: "編輯", exact: true }).click();
  const input = page.getByLabel("新增地點名稱或 Maps URL").first();
  await input.fill("長".repeat(201));
  await page.getByRole("button", { name: "新增地點", exact: true }).first().click();
  await expect(page.getByRole("alert")).toContainText("名稱");
  await expect(input).toHaveValue("長".repeat(201));
  await input.fill("修正地點");
  await page.getByRole("button", { name: "新增地點", exact: true }).first().click();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("article", { name: "修正地點", exact: true })).toBeVisible();
});
test("R5 simulated one-time IndexedDB write failure keeps the quick-add draft", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Desktop inline quick-add injection");
  await demo(page);
  await page.getByRole("button", { name: "編輯", exact: true }).click();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    let fail = true;
    IDBObjectStore.prototype.put = function (...args) {
      if (fail) { fail = false; throw new DOMException("synthetic write failure", "AbortError"); }
      return original.apply(this, args);
    };
  });
  const input = page.getByLabel("新增地點名稱或 Maps URL").first();
  await input.fill("Retryable synthetic place");
  await page.getByRole("button", { name: "新增地點", exact: true }).first().click();
  await expect(page.getByRole("alert")).toContainText(/synthetic write failure|AbortError/);
  await expect(input).toHaveValue("Retryable synthetic place");
  await page.getByRole("button", { name: "新增地點", exact: true }).first().click();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("article", { name: "Retryable synthetic place" })).toBeVisible();
});

test("R6 ordering a completed item preserves done after undo and refresh", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Mobile status and move are exercised through detail drawer");
  await demo(page);
  await page.getByRole("button", { name: "編輯", exact: true }).click();
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-07");
  const card = page.getByRole("article", { name: "淺草寺", exact: true }).first();
  await card.getByText("調整安排", { exact: true }).click();
  await card.getByRole("button", { name: "完成", exact: true }).click();
  await expect(card).toHaveClass(/done/);
  await card.getByRole("button", { name: "淺草寺下移", exact: true }).click();
  await expect(card).toHaveClass(/done/);
  await page.reload();
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-07");
  await expect(page.getByRole("article", { name: "淺草寺", exact: true }).first()).toHaveClass(/done/);
});
test("R6 skipped item retains status across date move and undo", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Mobile date move is covered in product.spec.ts");
  await demo(page);
  await page.getByRole("button", { name: "編輯", exact: true }).click();
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-07");
  const card = page.locator('[data-day="2030-01-07"]').getByRole("article", { name: "淺草寺", exact: true });
  await card.getByText("調整安排", { exact: true }).click();
  await card.getByRole("button", { name: "跳過", exact: true }).click();
  await expect(card).toHaveClass(/skipped/);
  await card.getByRole("combobox", { name: "淺草寺移到某日" }).selectOption("2030-01-09");
  const moved = page.locator('[data-day="2030-01-09"]').getByRole("article", { name: "淺草寺", exact: true });
  await expect(moved).toHaveClass(/skipped/);
  await operations(page);
  await page.getByRole("button", { name: "復原", exact: true }).click();
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-07");
  await expect(card).toHaveClass(/skipped/);
  await page.reload();
  await expect(page.locator('[data-day="2030-01-07"]').getByRole("article", { name: "淺草寺", exact: true })).toHaveClass(/skipped/);
});
test("R6 replaced candidate can be scheduled again on its original date", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Mobile candidate replacement is covered in product.spec.ts");
  await demo(page);
  await page.getByRole("button", { name: "編輯", exact: true }).click();
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-07");
  const temple = page.locator('[data-day="2030-01-07"]').getByRole("article", { name: "淺草寺", exact: true });
  await temple.getByText("調整安排", { exact: true }).click();
  await temple.getByRole("button", { name: "用候選替換" }).click();
  await page.getByRole("article", { name: "親子午餐候選（未查證）", exact: true })
    .getByRole("button", { name: "替換「淺草寺」" }).click();
  await page.getByRole("button", { name: /候選 \(/ }).click();
  const replaced = page.getByRole("article", { name: "淺草寺", exact: true }).last();
  await replaced.getByRole("combobox", { name: "淺草寺移到某日" }).selectOption("2030-01-07");
  await page.getByRole("button", { name: /候選 \(/ }).click();
  await expect(page.locator('[data-day="2030-01-07"]').getByRole("article", { name: "淺草寺", exact: true })).toBeVisible();
});
test("R9 map keeps a missing-coordinate first stop in numbering and labels each date", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Desktop map-and-board simultaneous view");
  await demo(page);
  await page.getByRole("button", { name: "編輯", exact: true }).click();
  const first = page.locator('[data-day="2030-01-07"]').getByRole("article", { name: "淺草寺", exact: true });
  await first.getByRole("combobox", { name: "淺草寺移到某日" }).selectOption("2030-01-06");
  await page.getByLabel("地圖範圍").selectOption("all");
  const marker = page.locator('.map-pin[aria-label="淺草寺 2030-01-06 第 2 站"]');
  await expect(marker).toBeVisible();
  await expect(marker).toContainText("01-06 · 2");
  await expect(page.locator('.map-pin[aria-label="淺草寺 2030-01-08 第 1 站"]')).toBeVisible();
  await expect(page.locator('.map-pin[aria-label*="淺草住宿"]')).toHaveCount(0);
});

