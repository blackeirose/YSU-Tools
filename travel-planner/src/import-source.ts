import { Temporal } from "@js-temporal/polyfill";

export type ImportRow = {
  source: string;
  dateText: string;
  name: string;
  city: string;
  time: string;
  candidate: boolean;
  notes: string;
};
export type ImportSection = { label: string; rows: ImportRow[]; warning?: string };
export type ParsedSource = { digest: string; filename: string; sections: ImportSection[] };
const LIMIT = 8_000_000;
const clean = (v: unknown) => String(v ?? "").trim();
const datePattern = /(?:\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}[-/.]\d{1,2}\b)/;

export function csvCells(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
    } else field += char;
  }
  if (quoted) throw new Error("CSV 引號未關閉，來源未匯入");
  row.push(field);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

const headings: Record<string, string[]> = {
  dateText: ["日期", "date", "day", "日付"],
  name: ["地點", "名稱", "行程", "活動", "place", "name", "activity", "spot", "店名"],
  city: ["城市", "city", "都市"],
  time: ["時間", "time", "時刻"],
  candidate: ["待定", "候選", "備案", "candidate", "optional"],
  notes: ["備註", "說明", "notes", "memo", "description"],
};
const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, "");
function headerIndex(cells: string[]) {
  return Object.fromEntries(Object.entries(headings).map(([field, aliases]) =>
    [field, cells.findIndex((cell) => aliases.includes(normalize(cell)))]));
}
export function rowsFromGrid(grid: unknown[][], label: string): ImportRow[] {
  const first = grid.findIndex((cells) => cells.some((value) => clean(value)));
  if (first < 0) return [];
  const indices = headerIndex(grid[first].map(clean));
  const hasHeader = indices.name >= 0 || indices.dateText >= 0;
  const start = hasHeader ? first + 1 : first;
  const result: ImportRow[] = [];
  let lastDate = "";
  for (let index = start; index < grid.length; index++) {
    const cells = grid[index].map(clean);
    if (!cells.some(Boolean)) continue;
    const get = (field: string) => indices[field] >= 0 ? cells[indices[field]] ?? "" : "";
    const raw = cells.join(" ").trim();
    const dateText = (hasHeader ? get("dateText") : raw.match(datePattern)?.[0] ?? "") || lastDate;
    if (dateText) lastDate = dateText;
    const name = hasHeader ? get("name") : raw.replace(datePattern, "").trim();
    if (!name || /^\d{1,2}[:：]\d{2}$/.test(name)) continue;
    if (result.length >= 150) throw new Error(`${label} 超過 150 筆可辨識行程，請分檔匯入；沒有匯入任何部分資料。`);
    if (name.length > 200 || get("city").length > 200 || get("notes").length > 2000)
      throw new Error(`${label} 第 ${index + 1} 列文字過長，請先拆分或縮短；沒有匯入任何部分資料。`);
    const time = get("time") || raw.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/)?.[0] || "";
    const candidateText = get("candidate") || raw;
    result.push({
      source: `${label} · ${index + 1}`,
      dateText,
      name,
      city: get("city"),
      time: time ? time.padStart(5, "0") : "",
      candidate: /(?:待定|候選|備案|optional|candidate|maybe)/i.test(candidateText),
      notes: hasHeader ? get("notes") : "",
    });
  }
  return result;
}

export function resolveDates(rows: ImportRow[], selectedYear: number): (ImportRow & { day: string | null; issue: string })[] {
  if (!Number.isInteger(selectedYear) || selectedYear < 1900 || selectedYear > 2200)
    throw new Error("請選擇正確年份");
  let year = selectedYear, previousMonth = 0;
  return rows.map((row) => {
    if (!row.dateText.trim()) return { ...row, day: null, issue: "未提供日期，將作為待定" };
    const match = row.dateText.trim().match(/^(?:(\d{4})[-/.])?(\d{1,2})[-/.](\d{1,2})$/);
    if (!match) return { ...row, day: null, issue: "日期格式不明，請修正" };
    const explicit = !!match[1], month = Number(match[2]), day = Number(match[3]);
    if (explicit) year = Number(match[1]);
    else if (previousMonth === 12 && month === 1) year++;
    previousMonth = month;
    try {
      const value = Temporal.PlainDate.from({ year, month, day });
      if (value.month !== month || value.day !== day) throw new Error("invalid");
      return { ...row, day: value.toString(), issue: "" };
    } catch { return { ...row, day: null, issue: "日期不存在，請修正" }; }
  });
}

export async function readImportSource(file: File): Promise<ParsedSource> {
  if (file.size > LIMIT) throw new Error("檔案超過 8 MB，請分檔匯入");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const digest = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const extension = file.name.toLowerCase().split(".").at(-1);
  let sections: ImportSection[] = [];
  if (extension === "csv") {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/^\uFEFF/, "");
    sections = [{ label: "CSV", rows: rowsFromGrid(csvCells(text), "CSV") }];
  } else if (extension === "xlsx") {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    if (workbook.worksheets.length > 20) throw new Error("工作簿超過 20 張工作表，請分檔匯入；沒有匯入任何部分資料。");
    sections = workbook.worksheets.map((sheet) => {
      const grid: unknown[][] = [];
      let scanned = 0;
      if (sheet.columnCount > 20) throw new Error(`工作表 ${sheet.name} 超過 20 欄，請分檔匯入；沒有匯入任何部分資料。`);
      sheet.eachRow({ includeEmpty: false }, (row) => {
        if (++scanned > 500 || row.number > 500)
          throw new Error(`工作表 ${sheet.name} 超過 500 列，請分檔匯入；沒有匯入任何部分資料。`);
        const cells: unknown[] = [];
        for (let col = 1; col <= sheet.columnCount; col++) {
          const value = row.getCell(col).value;
          cells.push(value instanceof Date ? value.toISOString().slice(0, 10) :
            typeof value === "object" && value && "text" in value ? value.text :
            typeof value === "object" && value && "result" in value ? value.result : value);
        }
        grid[row.number - 1] = cells;
      });
      return { label: `工作表 ${sheet.name}`, rows: rowsFromGrid(Array.from({ length: grid.length }, (_, index) => grid[index] ?? []), `工作表 ${sheet.name}`) };
    });
  } else if (extension === "pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const loading = pdfjs.getDocument({ data: bytes, useSystemFonts: true });
    const doc = await loading.promise;
    if (doc.numPages > 25) throw new Error("PDF 超過 25 頁，請分檔匯入");
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const text = await page.getTextContent();
      const fragments = text.items.flatMap((item) => "str" in item && "transform" in item
        ? [{ value: item.str, x: item.transform[4], y: item.transform[5] }] : []);
      const grouped = new Map<number, typeof fragments>();
      for (const fragment of fragments) {
        const key = Math.round(fragment.y / 3) * 3;
        grouped.set(key, [...(grouped.get(key) ?? []), fragment]);
      }
      const lines = [...grouped.entries()].sort(([a], [b]) => b - a)
        .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((part) => part.value).join(" ").trim());
      sections.push({ label: `第 ${pageNumber} 頁`, rows: rowsFromGrid(lines.map((line) => [line]), `第 ${pageNumber} 頁`),
        warning: lines.length === 0 ? "此頁沒有可擷取文字，需要視覺辨識。" : undefined });
    }
    await loading.destroy();
  } else if (extension === "png" || extension === "jpg" || extension === "jpeg") {
    sections = [{ label: "圖片", rows: [], warning: "圖片需要 Gemini 視覺辨識；確認資料處理後再送出。" }];
  } else throw new Error("支援 CSV、XLSX、PDF、PNG 與 JPEG");
  return { digest, filename: file.name, sections };
}

export async function visualForGemini(file: File, section: string): Promise<{ mime: "image/png" | "image/jpeg"; base64: string }> {
  let bitmap: ImageBitmap;
  if (file.name.toLowerCase().endsWith(".pdf")) {
    const match = section.match(/^第 (\d+) 頁$/);
    if (!match) throw new Error("請先選擇單一 PDF 頁面");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
    try {
      const doc = await loading.promise;
      const page = await doc.getPage(Number(match[1]));
      const viewport = page.getViewport({ scale: Math.min(1.5, 1200 / page.getViewport({ scale: 1 }).width) });
      const canvas = document.createElement("canvas"); canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
      const context = canvas.getContext("2d"); if (!context) throw new Error("此瀏覽器無法繪製 PDF 預覽");
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      bitmap = await createImageBitmap(canvas);
    } finally { await loading.destroy(); }
  } else bitmap = await createImageBitmap(file);
  try {
    const ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d"); if (!context) throw new Error("此瀏覽器無法準備圖片");
    context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) =>
      result ? resolve(result) : reject(new Error("圖片壓縮失敗")), "image/jpeg", 0.72));
    if (blob.size > 900_000) throw new Error("壓縮後圖片仍超過 900 KB，請裁切或分頁");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = ""; for (const value of bytes) binary += String.fromCharCode(value);
    return { mime: "image/jpeg", base64: btoa(binary) };
  } finally { bitmap.close(); }
}
