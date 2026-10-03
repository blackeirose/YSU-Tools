import { useMemo, useRef, useState } from "react";
import { Modal } from "./Forms";
import { blankItem, blankPlace, blankTrip, cityTimezoneHint, tripSchema, zone } from "./model";
import type { RecordData, Trip } from "./model";
import { readImportSource, resolveDates, visualForGemini } from "./import-source";
import type { ImportRow, ParsedSource } from "./import-source";

export function ImportFlow({ owner, currentTrip, records, token, onClose, onApply }: {
  owner: string;
  currentTrip?: Trip;
  records: RecordData[];
  token?: () => Promise<string>;
  onClose: () => void;
  onApply: (records: RecordData[]) => Promise<void>;
}) {
  const [source, setSource] = useState<ParsedSource | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [edits, setEdits] = useState<Record<string, ImportRow>>({});
  const [year, setYear] = useState("");
  const [tripName, setTripName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [target, setTarget] = useState<"new" | "append">("new");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const sourceFile = useRef<File | null>(null);
  const loadSequence = useRef(0);
  const selectedRows = useMemo(() => source?.sections
    .filter((section) => selected.includes(section.label))
    .flatMap((section) => section.rows.map((row) => edits[row.source] ?? row)) ?? [], [source, selected, edits]);
  const needsYear = selectedRows.some((row) => /^\d{1,2}[-/.]\d{1,2}$/.test(row.dateText.trim()));
  const resolved = useMemo(() => {
    if (needsYear && !year) return [];
    try { return resolveDates(selectedRows, Number(year || 2000)); }
    catch { return []; }
  }, [selectedRows, needsYear, year]);
  const update = (row: ImportRow, key: keyof ImportRow, value: string | boolean) =>
    setEdits((current) => ({ ...current, [row.source]: { ...row, [key]: value } }));
  async function openFile(file: File) {
    const sequence = ++loadSequence.current;
    sourceFile.current = null;
    setSource(null); setSelected([]); setEdits({}); setConsent(false);
    setError(""); setBusy(true);
    try {
      const parsed = await readImportSource(file);
      if (sequence !== loadSequence.current) return;
      sourceFile.current = file;
      setSource(parsed); setSelected(parsed.sections.length === 1 ? [parsed.sections[0].label] : []);
      setEdits({}); setYear(""); setTripName(file.name.replace(/\.[^.]+$/, ""));
      const city = parsed.sections.flatMap((part) => part.rows).find((row) => row.city)?.city ?? "";
      setTimezone(cityTimezoneHint(city) ?? "");
    } catch (e) { if (sequence === loadSequence.current) setError(e instanceof Error ? e.message : "檔案無法讀取"); }
    finally { if (sequence === loadSequence.current) setBusy(false); }
  }
  async function recognize() {
    setBusy(true); setError("");
    try {
      if (!source || !sourceFile.current || selected.length !== 1 || !consent || !token)
        throw new Error("請選擇單一頁面、勾選資料處理確認並以私人帳號登入");
      const image = await visualForGemini(sourceFile.current, selected[0]);
      const response = await fetch("/travel-planner/api/ai", { method: "POST", headers: {
        "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ mode: "vision", tripId: currentTrip?.id, requestId: crypto.randomUUID(),
          query: `辨識 ${selected[0]} 的可見旅行安排；不猜缺失資訊。`, image }) });
      const data = await response.json() as { rows?: (Omit<ImportRow, "source"> & { uncertain?: boolean })[]; warnings?: string[]; error?: string };
      if (!response.ok || !data.rows) throw new Error(data.error || "視覺辨識暫時失敗");
      setSource({ ...source, sections: source.sections.map((section) => section.label !== selected[0] ? section : {
        ...section, rows: data.rows!.map((row, index) => ({ ...row,
          source: `${section.label} · 視覺 ${index + 1}`,
          notes: `${row.notes}${row.uncertain ? "；需確認辨識結果" : ""}` })),
        warning: data.warnings?.join("；") }) });
      setEdits({});
    } catch (e) { setError(e instanceof Error ? e.message : "視覺辨識失敗；原檔未變更"); }
    finally { setBusy(false); }
  }
  async function apply() {
    setError(""); setBusy(true);
    try {
      if (!source || !resolved.length) throw new Error("請選擇至少一頁或工作表，並確認日期");
      if (needsYear && !year) throw new Error("來源缺少年份，請先指定歷史年份");
      const invalid = resolved.find((row) => row.issue && row.issue !== "未提供日期，將作為待定");
      if (invalid) throw new Error(`${invalid.source}：${invalid.issue}`);
      if (source.sections.some((section) => selected.includes(section.label) && section.warning && !section.rows.length))
        throw new Error("所選頁面尚無可用資料；圖片或掃描頁須完成視覺辨識後再匯入");
      const key = `source-sha256:${source.digest}`;
      const duplicate = resolved.find((entry) => records.some((record) => record.kind === "place" &&
        record.source === `${key};${entry.source}`));
      if (duplicate) throw new Error(`${duplicate.source} 已匯入；請取消該頁／工作表後重試，避免重複`);
      const dated = resolved.flatMap((row) => row.day ? [row.day] : []);
      if (!dated.length && target === "new") throw new Error("新旅程至少要有一個確認日期；未定項目可以留空");
      let trip: Trip;
      if (target === "append") {
        if (!currentTrip) throw new Error("請先選擇現有旅程");
        trip = currentTrip;
        if (dated.some((day) => day < trip.start || day > trip.end))
          throw new Error("來源日期超出此旅程；請先延長旅程，或匯入為新旅程");
      } else {
        const cities = [...new Set(resolved.map((row) => row.city.trim()).filter(Boolean))];
        const orderedDates = [...dated].sort();
        trip = tripSchema.parse({ ...blankTrip(owner), name: tripName.trim(),
          start: orderedDates[0], end: orderedDates.at(-1),
          cities: cities.join("、"), timezone: zone.parse(timezone), importSource: source.digest });
      }
      const updates: RecordData[] = target === "new" ? [trip] : [];
      for (const [index, row] of resolved.entries()) {
        const place = { ...blankPlace(owner, trip.id, row.name.trim()), city: row.city.trim(),
          notes: `${row.notes}\n來源：${row.source}`.trim(), source: `${key};${row.source}` };
        const item = { ...blankItem(owner, trip, place.id, row.day, index),
          status: (row.candidate || !row.day ? "candidate" : "planned") as "candidate" | "planned",
          timeMode: row.time ? "flexible" as const : "sequence" as const,
          time: row.time || null, notes: `匯入來源：${row.source}` };
        updates.push(place, item);
      }
      if (updates.length + (target === "append" ? 1 : 0) > 450)
        throw new Error("本次匯入超過安全批次上限，請分頁或工作表匯入");
      await onApply(updates);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "匯入失敗，預覽仍保留"); }
    finally { setBusy(false); }
  }
  return <Modal title="從檔案建立行程" onClose={onClose} wide>
    <p className="hint">CSV／XLSX 先在此裝置解析；PDF 擷取可選頁面的文字。圖片與掃描 PDF 需要另行確認送往 Gemini，目前不會自動上傳。來源資料可能包含私人訂單，請先檢查。</p>
    <input ref={fileRef} type="file" disabled={busy} accept=".csv,.xlsx,.pdf,.png,.jpg,.jpeg" onChange={(event) => {
      const file = event.target.files?.[0]; if (file) void openFile(file); event.target.value = "";
    }} />
    {source && <>
      <p>{source.filename} · {source.sections.length} 個工作表／頁面。請只選本次旅程的來源。</p>
      <div className="import-sections">{source.sections.map((section) =>
        <label className="check" key={section.label}><input type="checkbox" checked={selected.includes(section.label)} onChange={(event) =>
          setSelected((current) => event.target.checked ? [...current, section.label] : current.filter((part) => part !== section.label))} />
          {section.label} · {section.rows.length} 項 {section.warning && <span className="warning">{section.warning}</span>}</label>)}</div>
      {(source.filename.toLowerCase().endsWith(".pdf") || /\.(?:png|jpe?g)$/i.test(source.filename)) && <div className="notice">
        <label className="check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
          我確認所選頁面／圖片可送至 Gemini 進行辨識；可能包含私人行程與訂單，請先遮蔽不必要資訊。</label>
        <button disabled={busy || !consent || selected.length !== 1 || !token} onClick={() => void recognize()}>辨識所選單一頁／圖片</button>
        {!token && <p>視覺辨識需要私人登入；離線仍可匯入已擷取的文字。</p>}
      </div>}
      {needsYear && <label>缺少年份，請指定來源開始年份<input type="number" min="1900" max="2200" value={year} onChange={(event) => setYear(event.target.value)} placeholder="例如 2024；跨年會依順序延至次年" /></label>}
      <div className="fields"><label>匯入位置<select value={target} onChange={(event) => setTarget(event.target.value as "new" | "append")}>
        <option value="new">建立新旅程</option>{currentTrip && <option value="append">加入目前旅程（不覆寫）</option>}
      </select></label>{target === "new" && <><label>旅程名稱<input value={tripName} onChange={(event) => setTripName(event.target.value)} /></label>
        <label>目的地 IANA 時區<input required value={timezone} onChange={(event) => setTimezone(event.target.value)} placeholder="例如 Asia/Tokyo" /></label></>}</div>
      <p className="hint">以下是可修正預覽；沒有日期的列會加入待定。有精確時間的列仍視為可調整，請在匯入後確認預約，不會擅自標成已訂。</p>
      <div className="import-preview">{selectedRows.map((row, index) => {
        const date = resolved[index];
        return <div className="import-row" key={row.source}>
          <small>{row.source} · {date?.day ?? date?.issue ?? "待確認"}</small>
          <input aria-label={`${row.source} 日期`} value={row.dateText} onChange={(event) => update(row, "dateText", event.target.value)} placeholder="YYYY-MM-DD 或 M/D" />
          <input aria-label={`${row.source} 名稱`} value={row.name} onChange={(event) => update(row, "name", event.target.value)} />
          <input aria-label={`${row.source} 城市`} value={row.city} onChange={(event) => update(row, "city", event.target.value)} placeholder="城市" />
          <input aria-label={`${row.source} 時間`} value={row.time} onChange={(event) => update(row, "time", event.target.value)} placeholder="HH:mm" />
          <label className="check"><input type="checkbox" checked={row.candidate} onChange={(event) => update(row, "candidate", event.target.checked)} />待定</label>
        </div>;
      })}</div>
      <button className="primary" disabled={busy || !selectedRows.length || (needsYear && !year)} onClick={() => void apply()}>{busy ? "處理中…" : `確認匯入 ${selectedRows.length} 項`}</button>
    </>}
    {error && <p role="alert" className="error">{error}</p>}
  </Modal>;
}
