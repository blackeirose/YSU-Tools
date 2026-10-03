import { test, expect } from "@playwright/test";

for (const [width, height] of [[1440, 900], [1366, 768], [390, 844], [320, 700]]) {
  test(`upgrade workspace remains usable at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/travel-planner/");
    await expect(page.getByText("本機已儲存 · 不跨裝置")).toBeVisible();
    await page.getByRole("button", { name: "載入示範", exact: true }).click();
    await expect(page.getByRole("heading", { name: "東京 · 合成示範", exact: true })).toBeVisible();
    await expect(page.getByLabel("旅行日期", { exact: true })).toBeVisible();
    await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-07");
    await expect(page.getByRole("article", { name: "淺草寺", exact: true }).first()).toBeVisible();
    const metrics = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
      workTop: document.querySelector(".workspace")?.getBoundingClientRect().top,
      workHeight: document.querySelector(".workspace")?.getBoundingClientRect().height,
    }));
    expect(metrics.scroll).toBeLessThanOrEqual(metrics.viewport + 1);
    if (width >= 1366) {
      expect(metrics.workTop).toBeLessThan(height * 0.35);
      await expect(page.getByRole("button", { name: "收合地圖" })).toBeVisible();
      await page.getByRole("button", { name: "收合地圖" }).click();
      await expect(page.locator(".workspace")).toHaveClass(/no-map/);
      await page.getByRole("button", { name: "顯示地圖" }).click();
      await expect(page.locator(".workspace")).not.toHaveClass(/no-map/);
    }
    const dismiss = page.getByRole("button", { name: "關閉訊息" });
    if (await dismiss.isVisible()) await dismiss.click();
    await page.screenshot({ path: `test-results/upgrade-${width}.png`, fullPage: false });
  });
}

test("real Photon Disney result can become a mapped itinerary item", async ({ page }, info) => {
  await page.goto("/travel-planner/");
  await expect(page.getByText("本機已儲存 · 不跨裝置")).toBeVisible();
  await page.getByRole("button", { name: "載入示範", exact: true }).click();
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-07");
  const singleDay = page.getByRole("button", { name: "只看當天" });
  if (await singleDay.isVisible()) await singleDay.click();
  await page.locator('[data-day="2030-01-07"]').getByLabel("新增地點名稱或 Maps URL").fill("DISNEY");
  await expect(page.getByRole("button", { name: /Tokyo Disneyland/ }).first()).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /Tokyo Disneyland/ }).first().click();
  await expect(page.getByRole("article", { name: "Tokyo Disneyland", exact: true })).toBeVisible();
  if (info.project.name === "mobile")
    await page.getByRole("navigation", { name: "主要導覽" }).getByRole("button", { name: "地圖" }).click();
  await expect(page.locator(".map-pin")).toHaveCount(3);
});

test("a new Honolulu trip assigns its first city and IANA zone across its days", async ({ page }) => {
  await page.goto("/travel-planner/");
  await expect(page.getByText("本機已儲存 · 不跨裝置")).toBeVisible();
  await page.getByRole("button", { name: "新增旅程", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("旅程名稱").fill("Honolulu synthetic");
  await dialog.getByLabel("開始日期").fill("2030-12-30");
  await dialog.getByLabel("結束日期").fill("2031-01-02");
  await dialog.getByLabel("城市", { exact: true }).fill("Honolulu");
  await expect(dialog.getByLabel("目的地時區").first()).toHaveValue("Pacific/Honolulu");
  await dialog.getByRole("button", { name: "儲存旅程" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-day="2030-12-30"] .day-city')).toHaveText("Honolulu");
  await expect(page.locator('[data-day="2031-01-02"] .day-city')).toHaveText("Honolulu");
  await page.reload();
  await expect(page.locator(".active-city")).toContainText("Pacific/Honolulu");
});

test("date shrink keeps excluded stops as candidates across reload and expansion", async ({ page }) => {
  await page.goto("/travel-planner/");
  await expect(page.getByText("本機已儲存 · 不跨裝置")).toBeVisible();
  await page.getByRole("button", { name: "載入示範", exact: true }).click();
  const operations = page.locator("details.trip-operations");
  await operations.locator(":scope > summary").click();
  await operations.getByRole("button", { name: "編輯旅程" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("結束日期").fill("2030-01-07");
  await expect(dialog.getByRole("status")).toContainText("範圍外安排");
  await dialog.getByRole("button", { name: "儲存旅程" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: /候選 \(/ }).click();
  await expect(page.getByText("因旅程日期縮短移入待定").first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /候選 \(/ }).click();
  await expect(page.getByText("因旅程日期縮短移入待定").first()).toBeVisible();
  await operations.locator(":scope > summary").click();
  await operations.getByRole("button", { name: "編輯旅程" }).click();
  await dialog.getByLabel("結束日期").fill("2030-01-09");
  await dialog.getByRole("button", { name: "儲存旅程" }).click();
  await expect(page.getByText("因旅程日期縮短移入待定").first()).toBeVisible();
});
