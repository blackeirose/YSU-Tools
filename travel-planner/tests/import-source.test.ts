import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { csvCells, readImportSource, resolveDates, rowsFromGrid } from "../src/import-source";

describe("source-backed import", () => {
  it("parses quoted CSV and cross-year dates without silently choosing the current year", () => {
    const grid = csvCells('日期,地點,城市,備註\r\n12/31,"Tokyo, Museum",東京,"固定預約, 請確認"\r\n1/1,大阪城,大阪,備案\r\n');
    const rows = rowsFromGrid(grid, "CSV");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ name: "Tokyo, Museum", source: "CSV · 2", city: "東京" });
    const dated = resolveDates(rows, 2024);
    expect(dated.map((row) => row.day)).toEqual(["2024-12-31", "2025-01-01"]);
    expect(dated[1].candidate).toBe(true);
  });
  it("keeps distinct XLSX sheets selectable so old Tokyo pages do not enter an Osaka import", async () => {
    const book = new ExcelJS.Workbook();
    const osaka = book.addWorksheet("Osaka current");
    osaka.addRow(["日期", "地點", "城市"]);
    osaka.addRow(["2030-12-30", "大阪城", "大阪"]);
    const old = book.addWorksheet("Tokyo old");
    old.addRow(["日期", "地點", "城市"]);
    old.addRow(["2024-01-03", "舊東京景點", "東京"]);
    const bytes = await book.xlsx.writeBuffer();
    const parsed = await readImportSource(new File([bytes as BlobPart], "sample.xlsx"));
    expect(parsed.sections.map((part) => part.label)).toEqual(["工作表 Osaka current", "工作表 Tokyo old"]);
    expect(parsed.sections[0].rows).toMatchObject([{ name: "大阪城", dateText: "2030-12-30" }]);
    expect(parsed.sections[1].rows).toMatchObject([{ name: "舊東京景點", dateText: "2024-01-03" }]);
  });
  it("leaves missing and invalid dates visible for correction", () => {
    const rows = rowsFromGrid(csvCells("日期,地點\n,未定餐廳\n2/30,錯誤日期\n"), "CSV");
    const parsed = resolveDates(rows, 2030);
    expect(parsed[0]).toMatchObject({ day: null, issue: "未提供日期，將作為待定" });
    expect(parsed[1]).toMatchObject({ day: null, issue: "日期不存在，請修正" });
  });
  it("fails visibly instead of silently dropping the 151st row or long content", () => {
    const grid = [["日期", "地點"], ...Array.from({ length: 151 }, (_, index) => ["2030-01-01", `地點 ${index + 1}`])];
    expect(() => rowsFromGrid(grid, "CSV")).toThrow(/超過 150 筆/);
    expect(() => rowsFromGrid([["日期", "地點"], ["2030-01-01", "長".repeat(201)]], "CSV"))
      .toThrow(/文字過長/);
  });
  it("refuses an oversized XLSX instead of presenting an incomplete preview", async () => {
    const book = new ExcelJS.Workbook();
    for (let i = 0; i < 21; i++) book.addWorksheet(`Sheet ${i + 1}`).addRow(["日期", "地點"]);
    const bytes = await book.xlsx.writeBuffer();
    await expect(readImportSource(new File([bytes as BlobPart], "too-many.xlsx"))).rejects.toThrow(/超過 20 張/);
  });
});
