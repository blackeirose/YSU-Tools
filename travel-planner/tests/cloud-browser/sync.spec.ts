import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
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
      .getByLabel("移動到指定日期")
      .selectOption("2030-01-02");
    await quick(a, "Offline new record");
    const victim = b.getByRole("article", { name: "A to B", exact: true });
    await victim.getByRole("button", { name: "刪除安排", exact: true }).click();
    await expect(victim).toHaveCount(0);
    await expect(b.getByText("已同步", { exact: true })).toBeVisible();
    await first.setOffline(false);
    await expect(a.locator(".conflict")).toBeVisible({ timeout: 45000 });
    const backup = a.waitForEvent("download");
    await a.getByRole("button", { name: "下載兩份備份" }).click();
    expect((await backup).suggestedFilename()).toBe("travel-conflict.json");
    await a.getByRole("button", { name: "使用遠端版本" }).click();
    await expect(a.locator(".conflict")).toHaveCount(0);
    await expect(
      a.getByRole("article", { name: "A to B", exact: true }),
    ).toHaveCount(0);
    await expect(
      b.getByRole("article", { name: "Offline new record", exact: true }),
    ).toBeVisible({ timeout: 45000 });
    await a.getByRole("button", { name: "登出", exact: true }).click();
    await expect(
      a.getByRole("heading", { name: "Emulator private trip", exact: true }),
    ).toHaveCount(0);
    await login(a, `new-owner-${crypto.randomUUID()}@example.test`);
    await expect(
      a.getByRole("article", { name: "B to A", exact: true }),
    ).toHaveCount(0);
  } finally {
    await first.close();
    await second.close();
    await third.close();
  }
});
