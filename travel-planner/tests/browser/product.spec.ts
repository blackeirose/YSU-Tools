async function operations(page: import("@playwright/test").Page) {
  const ops = page.locator("details.trip-operations");
  if (
    (await ops.count()) &&
    !(await ops.evaluate((e) => (e as HTMLDetailsElement).open))
  )
    await ops.locator(":scope > summary").click();
}
import { test, expect } from "@playwright/test";
test.beforeEach(({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});
test("real trip deep link restores selected day and scoped PWA excludes private/network caches", async ({
  page,
  context,
}) => {
  await demo(page);
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-08");
  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+\/day\/2030-01-08$/);
  const url = page.url();
  await page.goto(url);
  await page.reload();
  await expect(page.getByLabel("旅行日期", { exact: true })).toHaveValue(
    "2030-01-08",
  );
  const manifest = await (
    await page.request.get("/travel-planner/manifest.webmanifest")
  ).json();
  expect([manifest.id, manifest.start_url, manifest.scope]).toEqual([
    "/travel-planner/",
    "/travel-planner/",
    "/travel-planner/",
  ]);
  const scope = await page.evaluate(
    async () => (await navigator.serviceWorker.ready).scope,
  );
  expect(scope).toBe("http://127.0.0.1:4173/travel-planner/");
  const urls = await page.evaluate(async () =>
    (
      await Promise.all(
        (await caches.keys())
          .filter((k) => k.startsWith("ysu-travel-planner-shell-"))
          .map(async (k) =>
            (await (await caches.open(k)).keys()).map((r) => r.url),
          ),
      )
    ).flat(),
  );
  expect(urls.length).toBeGreaterThan(5);
  expect(
    urls.every(
      (u) =>
        u.startsWith("http://127.0.0.1:4173/travel-planner/") &&
        !/api|googleapis|openstreetmap/.test(u),
    ),
  ).toBe(true);
  const isolated = await context.browser()!.newContext();
  const other = await isolated.newPage();
  await other
    .goto("/travel-planner/", { waitUntil: "load" })
    .catch(async () => other.goto("http://127.0.0.1:4173/travel-planner/"));
  await expect(
    other.getByRole("heading", { name: "東京 · 合成示範", exact: true }),
  ).toHaveCount(0);
  await isolated.close();
});
test("same local account tabs serialize changes; desktop drag supports cross-day movement", async ({
  page,
  context,
}, info) => {
  await demo(page);
  const second = await context.newPage();
  await second.goto("/travel-planner/");
  await expect(
    second.getByRole("heading", { name: "東京 · 合成示範", exact: true }),
  ).toBeVisible();
  await second
    .getByLabel("新增地點名稱或 Maps URL")
    .first()
    .fill("Second tab place");
  await second
    .getByRole("button", { name: "新增地點", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("article", { name: "Second tab place", exact: true }),
  ).toBeVisible();
  if (info.project.name === "desktop") {
    const card = page.getByRole("article", {
      name: "Second tab place",
      exact: true,
    });
    const target = page.locator('[data-day="2030-01-07"]');
    await card.dragTo(target.locator(".day-heading"), {
      sourcePosition: { x: 8, y: 8 },
      targetPosition: { x: 8, y: 8 },
    });
    await expect(
      target.getByRole("article", { name: "Second tab place", exact: true }),
    ).toBeVisible();
  }
  await second.close();
});
test("DST gap is rejected visibly and a corrected task remains usable", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("button", { name: "待辦", exact: true }).click();
  await page.getByRole("button", { name: "新增待辦" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("事項", { exact: true }).fill("DST validation");
  await dialog.getByLabel("截止日期").fill("2026-03-08");
  await dialog.getByLabel("時間", { exact: true }).fill("02:30");
  await dialog.getByLabel("事項時區").fill("America/Los_Angeles");
  await dialog.getByRole("button", { name: "儲存待辦" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByLabel("時間", { exact: true }).fill("10:00");
  await dialog.getByRole("button", { name: "儲存待辦" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("DST validation", { exact: true })).toBeVisible();
});
async function ready(page: import("@playwright/test").Page) {
  await page.goto("/travel-planner/");
  await expect(page.getByText("本機已儲存 · 不跨裝置")).toBeVisible();
}
async function demo(page: import("@playwright/test").Page) {
  await ready(page);
  await page.getByRole("button", { name: "載入示範", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "東京 · 合成示範", exact: true }),
  ).toBeVisible();
}
test("new trip → minimal place → manual location → same marker, persistence and offline reload", async ({
  page,
  context,
}, info) => {
  await ready(page);
  await page.getByRole("button", { name: "新增旅程", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("旅程名稱").fill("Browser test trip");
  await dialog.getByLabel("開始日期").fill("2030-01-01");
  await dialog.getByLabel("結束日期").fill("2030-01-03");
  await dialog.getByRole("button", { name: "儲存旅程" }).click();
  await expect(dialog).toHaveCount(0);
  await operations(page);
  await page
    .getByLabel("新增地點名稱或 Maps URL")
    .first()
    .fill("Duplicate name");
  await page
    .getByRole("button", { name: "新增地點", exact: true })
    .first()
    .click();
  const card = page.getByRole("article", {
    name: "Duplicate name",
    exact: true,
  });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "地點", exact: true }).click();
  await dialog.getByLabel("緯度", { exact: true }).fill("35.7148");
  await dialog.getByLabel("經度", { exact: true }).fill("139.7967");
  await dialog.getByLabel("地址", { exact: true }).fill("Synthetic address");
  await dialog.getByRole("button", { name: "儲存地點" }).click();
  await page.getByRole("button", { name: "地圖", exact: true }).click();
  await expect(page.locator(".map-pin")).toHaveCount(1);
  await page.locator(".map-pin").click();
  await expect(
    page.getByRole("article", { name: "Duplicate name", exact: true }),
  ).toHaveClass(/selected/);
  await page.getByRole("button", { name: "下載行程", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("article", { name: "Duplicate name", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("article", { name: "Duplicate name", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("新增地點名稱或 Maps URL")
    .first()
    .fill("Offline added");
  await page
    .getByRole("button", { name: "新增地點", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("article", { name: "Offline added", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.reload();
  await expect(
    page.getByRole("article", { name: "Offline added", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `docs/evidence/${info.project.name}-trip.png`,
    fullPage: true,
  });
});
test("cross-day move, replacement preserves original, undo survives reload", async ({
  page,
}) => {
  await demo(page);
  await operations(page);
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-07");
  const temple = page
    .getByRole("article", { name: "淺草寺", exact: true })
    .filter({ has: page.getByText("上午", { exact: true }) });
  await temple.getByLabel("淺草寺移到某日").selectOption("2030-01-09");
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-09");
  await expect(
    page.getByRole("article", { name: "淺草寺", exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await operations(page);
  await page.getByRole("button", { name: "復原", exact: true }).click();
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-07");
  const active = page
    .locator(".active-day")
    .getByRole("article", { name: "淺草寺", exact: true });
  await active.locator("summary").click();
  await active.getByRole("button", { name: "用候選替換" }).click();
  const lunch = page.getByRole("article", {
    name: "親子午餐候選（未查證）",
    exact: true,
  });
  await lunch.getByRole("button", { name: "替換「淺草寺」" }).click();
  await expect(
    page
      .locator(".active-day")
      .getByRole("article", { name: "親子午餐候選（未查證）", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /候選 \(/ }).click();
  await expect(
    page.getByRole("article", { name: "淺草寺", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "復原", exact: true }).click();
  await page.getByRole("button", { name: "今天", exact: true }).click();
  await expect(
    page
      .locator(".active-day")
      .getByRole("article", { name: "淺草寺", exact: true }),
  ).toBeVisible();
});
test("fixed appointments stay fixed, tasks, calendar and import preview", async ({
  page,
}) => {
  await demo(page);
  await operations(page);
  await page.getByLabel("旅行日期", { exact: true }).selectOption("2030-01-07");
  const fixed = page
    .locator(".active-day")
    .getByRole("article", { name: "東京國立博物館", exact: true });
  await expect(fixed.getByText("13:00 · 固定預約")).toBeVisible();
  await fixed.locator("summary").click();
  await fixed.getByRole("button", { name: "後續彈性延後 30 分" }).click();
  await expect(fixed.getByText("13:00 · 固定預約")).toBeVisible();
  await page.getByRole("button", { name: "待辦", exact: true }).click();
  await page.getByRole("button", { name: "新增待辦" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("事項", { exact: true }).fill("Synthetic deadline");
  await dialog.getByLabel("截止日期").fill("2030-01-01");
  await dialog.getByLabel("時間", { exact: true }).fill("10:00");
  await dialog.getByRole("button", { name: "儲存待辦" }).click();
  await expect(
    page.getByText("Synthetic deadline", { exact: true }),
  ).toBeVisible();
  await page.locator("summary").filter({ hasText: "匯出／匯入" }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "日曆 .ics" }).click();
  const result = await downloading;
  expect(result.suggestedFilename()).toBe("travel-planner.ics");
  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 匯出" }).click();
  const json = await jsonDownload;
  const path = await json.path();
  await page.locator("input[type=file]").setInputFiles(path!);
  await expect(
    page
      .getByRole("dialog")
      .getByText("會建立新的 ID 與旅程副本，不覆寫現有資料。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "匯入為新旅程" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.getByLabel("選擇旅程").locator("option").count()).toBe(3);
});
test("subpath deep URL refresh, disabled AI, map failure and 390/1440 layout", async ({
  page,
}, info) => {
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.goto("/travel-planner/trips/example/day/2030-01-01");
  await expect(
    page.getByRole("heading", { name: "Travel Planner", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "載入示範", exact: true }).click();
  await page.getByRole("button", { name: "探索地點" }).click();
  await expect(
    page.getByRole("button", { name: "AI 探索", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "關閉", exact: true }).click();
  await page.getByRole("button", { name: "地圖", exact: true }).click();
  await expect(
    page.getByText("底圖暫時無法載入；行程及已知位置仍可使用。"),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
  await page.screenshot({
    path: `docs/evidence/${info.project.name}-map.png`,
    fullPage: true,
  });
  expect(await page.getByText("現在應前往").count()).toBe(0);
});
