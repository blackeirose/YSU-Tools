import { test, expect } from "@playwright/test";

function syntheticPdf(pages: string[]): Buffer {
  const objects: string[] = [];
  const pageRefs: number[] = [];
  const fontId = 3 + pages.length * 2;
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("");
  pages.forEach((line, index) => {
    const pageId = 3 + index * 2, contentsId = pageId + 1;
    pageRefs.push(pageId);
    const escaped = line.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
    const stream = `BT /F1 18 Tf 40 700 Td (${escaped}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentsId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageRefs.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let content = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(content)); content += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(content);
  content += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) content += `${String(offset).padStart(10, "0")} 00000 n \n`;
  content += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(content);
}

test("CSV creates a trip from the empty state and a repeated import is rejected", async ({ page }) => {
  await page.goto("/travel-planner/");
  await expect(page.getByText("本機已儲存 · 不跨裝置")).toBeVisible();
  await page.getByRole("button", { name: "從檔案建立旅程" }).click();
  const dialog = page.getByRole("dialog");
  const csv = "日期,地點,城市,備註\n2030-12-30,Osaka Castle,大阪,合成資料\n2030-12-31,待定餐廳,大阪,備案\n";
  await dialog.locator('input[type="file"]').setInputFiles({ name: "synthetic.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(dialog.getByLabel("CSV · 2 名稱")).toHaveValue("Osaka Castle");
  await expect(dialog.getByLabel("目的地 IANA 時區")).toHaveValue("Asia/Tokyo");
  await dialog.getByRole("button", { name: "確認匯入 2 項" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "synthetic", exact: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "Osaka Castle" })).toBeVisible();
  if ((await page.viewportSize())!.width <= 700) await page.locator("details.trip-operations > summary").click();
  await page.getByRole("button", { name: "從檔案建立旅程" }).click();
  await dialog.locator('input[type="file"]').setInputFiles({ name: "synthetic.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await dialog.getByRole("button", { name: "確認匯入 2 項" }).click();
  await expect(dialog.getByRole("alert")).toContainText("已匯入");
  await page.reload();
  await expect(page.getByRole("article", { name: "Osaka Castle" })).toHaveCount(1);
});

test("PDF page selection excludes a historical Tokyo page from a new Osaka trip", async ({ page }) => {
  await page.goto("/travel-planner/");
  await expect(page.getByText("本機已儲存 · 不跨裝置")).toBeVisible();
  await page.getByRole("button", { name: "從檔案建立旅程" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('input[type="file"]').setInputFiles({ name: "synthetic-mixed.pdf", mimeType: "application/pdf",
    buffer: syntheticPdf(["2030-12-30 Osaka Castle", "2024-01-03 Old Tokyo stop"]) });
  await expect(dialog.getByText("2 個工作表／頁面")).toBeVisible();
  await dialog.getByRole("checkbox", { name: /第 1 頁/ }).check();
  await expect(dialog.getByLabel("第 1 頁 · 1 名稱")).toHaveValue("Osaka Castle");
  await expect(dialog.getByText("Old Tokyo stop")).toHaveCount(0);
  await dialog.getByLabel("目的地 IANA 時區").fill("Asia/Tokyo");
  await dialog.getByRole("button", { name: "確認匯入 1 項" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("article", { name: "Osaka Castle" })).toBeVisible();
  await expect(page.getByText("Old Tokyo stop")).toHaveCount(0);
});

test("a failed second file cannot accidentally import the previously previewed file", async ({ page }) => {
  await page.goto("/travel-planner/");
  await page.getByRole("button", { name: "從檔案建立旅程" }).click();
  const dialog = page.getByRole("dialog"), file = dialog.locator('input[type="file"]');
  await file.setInputFiles({ name: "first.csv", mimeType: "text/csv",
    buffer: Buffer.from("日期,地點,城市\n2030-01-01,First place,東京\n") });
  await expect(dialog.getByRole("button", { name: "確認匯入 1 項" })).toBeEnabled();
  await file.setInputFiles({ name: "broken.csv", mimeType: "text/csv",
    buffer: Buffer.from('日期,地點\n2030-01-01,"unfinished\n') });
  await expect(dialog.getByRole("alert")).toContainText("引號未關閉");
  await expect(dialog.getByRole("button", { name: /確認匯入/ })).toHaveCount(0);
  await expect(dialog.getByText("First place")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "first", exact: true })).toHaveCount(0);
});
