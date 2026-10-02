import { test, expect } from "@playwright/test";
test("synthetic Tokyo map selection/zoom and multicity year-boundary visual evidence", async ({
  page,
}, info) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto("/travel-planner/");
  await page.getByRole("button", { name: "載入示範", exact: true }).click();
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-07");
  await page.getByRole("button", { name: "地圖", exact: true }).click();
  await expect(page.locator(".map-pin")).toHaveCount(2);
  const marker = page.locator(".leaflet-marker-icon").first();
  const before = await marker.getAttribute("style");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(marker).not.toHaveAttribute("style", before!);
  await marker.click();
  await expect(
    page
      .getByRole("article", { name: "淺草寺", exact: true })
      .filter({ has: page.getByText("上午", { exact: true }) }),
  ).toHaveClass(/selected/);
  await page.screenshot({
    path: `docs/evidence/${info.project.name}-tokyo.png`,
    fullPage: true,
  });
  await page
    .getByLabel("選擇旅程")
    .selectOption({ label: "京都／大阪／名古屋 · 跨年示範" });
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2031-01-01");
  await expect(
    page.getByRole("heading", {
      name: "京都／大阪／名古屋 · 跨年示範",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/evidence/${info.project.name}-multicity.png`,
    fullPage: true,
  });
  if (info.project.name === "desktop") {
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".print-only")).toBeVisible();
    await expect(page.locator(".workspace")).toBeHidden();
    await page.screenshot({
      path: "docs/evidence/desktop-print.png",
      fullPage: true,
    });
  }
});
