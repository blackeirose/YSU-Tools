import { useRef, useState } from "react";
import { Modal } from "./Forms";
import type { AssistantAction } from "./server/gemini";

type Result = { action?: AssistantAction; transcript?: string; quota?: { used: number; limit: number }; error?: string };
export type AssistantRequestContext = { tripId: string; selectedItemId?: string };
export function TravelerAssistant({ tripId, selectedDay, city, selectedItem, token, onAction, onDraft, onClose }: {
  tripId: string; selectedDay: string; city: string; selectedItem?: { id: string; name: string };
  token: () => Promise<string>;
  onAction: (action: AssistantAction, requestId: string, context: AssistantRequestContext) => Promise<string>;
  onDraft: (action: AssistantAction, expectedTripId: string) => Promise<string>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [transcript, setTranscript] = useState("");
  const [usage, setUsage] = useState("");
  const [draft, setDraft] = useState<{ action: AssistantAction; tripId: string } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const inFlight = useRef(false);
  const cancelled = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const stopMedia = () => { stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; recorder.current = null; setRecording(false); };
  const submit = async (audio?: { mime: "audio/webm" | "audio/mp4" | "audio/wav"; base64: string }) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(""); setResult(""); setDraft(null);
    const requestId = crypto.randomUUID();
    const context = { tripId, selectedItemId: selectedItem?.id };
    try {
      const currentController = new AbortController(); controller.current = currentController;
      if (!navigator.onLine) throw new Error("Gemini 需要網路；已下載行程仍可查看與手動編輯");
      const response = await fetch("/travel-planner/api/ai", { method: "POST", headers: {
        "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
        body: JSON.stringify({ mode: "assist", tripId, requestId,
          query: query.trim() || "請理解這段語音並只依明確語意提出操作", selectedDay, city, selectedItem, audio }),
        signal: currentController.signal });
      if (cancelled.current) return;
      const data = await response.json() as Result;
      if (cancelled.current) return;
      if (!response.ok || !data.action) throw new Error(data.error || "Gemini 沒有回傳可用結果");
      setTranscript(data.transcript ?? "");
      if (data.quota) setUsage(`今日助手 ${data.quota.used}／${data.quota.limit} 次`);
      if (data.action.kind === "draft") {
        setDraft({ action: data.action, tripId });
        setResult("請逐項核對日期與名稱，確認後才會一次加入；地點、營業與預約尚未查證。");
        return;
      }
      const message = await onAction(data.action, requestId, context);
      setResult(message || data.action.message);
      if (["add", "move", "edit_time", "candidate", "undo"].includes(data.action.kind)) setQuery("");
    } catch (e) { if (!cancelled.current) setError(e instanceof Error ? e.message : "助手暫時無法使用；輸入仍保留"); }
    finally { controller.current = null; inFlight.current = false; if (!cancelled.current) setBusy(false); }
  };
  const confirmDraft = async () => {
    if (!draft || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      if (draft.tripId !== tripId) throw new Error("旅程已切換；請在目前旅程重新提出草案");
      const message = await onDraft(draft.action, draft.tripId);
      if (!cancelled.current) { setResult(message); setDraft(null); setQuery(""); }
    } catch (e) { if (!cancelled.current) setError(e instanceof Error ? e.message : "草案未加入；預覽仍保留"); }
    finally { inFlight.current = false; if (!cancelled.current) setBusy(false); }
  };
  const startRecording = async () => {
    if (recorder.current) { recorder.current.stop(); return; }
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error("此瀏覽器沒有可用的點擊錄音功能，仍可打字");
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = mic;
      const mime = (["audio/webm", "audio/mp4", "audio/wav"] as const).find((candidate) => MediaRecorder.isTypeSupported(candidate));
      if (!mime) throw new Error("此瀏覽器的錄音格式暫不支援，仍可打字");
      const media = new MediaRecorder(mic, { mimeType: mime });
      const chunks: BlobPart[] = [];
      media.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      media.onstop = () => { void (async () => {
        try {
          if (cancelled.current) { stopMedia(); return; }
          const blob = new Blob(chunks, { type: mime });
          if (blob.size > 200_000) throw new Error("語音超過 200 KB，請用較短語句");
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let binary = ""; for (const value of bytes) binary += String.fromCharCode(value);
          stopMedia();
          if (!cancelled.current) await submit({ mime, base64: btoa(binary) });
        } catch (e) { stopMedia(); setError(e instanceof Error ? e.message : "錄音未送出"); }
      })(); };
      recorder.current = media; media.start(); setRecording(true);
      window.setTimeout(() => { if (media.state === "recording") media.stop(); }, 15000);
    } catch (e) { stopMedia(); setError(e instanceof Error ? e.message : "無法取得麥克風；仍可打字"); }
  };
  return <Modal title="旅伴助手" onClose={() => {
    cancelled.current = true; controller.current?.abort();
    if (recorder.current?.state === "recording") recorder.current.stop();
    stopMedia(); onClose();
  }} wide>
    <p className="hint">一句話新增、移日或詢問。明確單筆指令才會變更行程；草案與建議先預覽。語音只在點擊後錄製，最長 15 秒；原始音訊不保存在裝置。</p>
    <label>你想做什麼？<textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：在畫面這一天上午九點加入東京迪士尼樂園" /></label>
    <div className="actions"><button className="primary" disabled={busy || recording || !query.trim()} onClick={() => void submit()}>{busy ? "理解中…" : "送出指令"}</button>
      <button type="button" disabled={busy} aria-label={recording ? "停止錄音並送出" : "開始錄音"} onClick={() => void startRecording()}>{recording ? "停止並送出" : "🎙 點擊錄音"}</button></div>
    <p className="hint">畫面日期：{selectedDay} · 地區：{city || "未指定"}。離線時請使用手動操作；助手不會在恢復連線後自動送出。</p>
    {transcript && <p>辨識內容：{transcript}</p>}
    {draft?.action.draftItems && <section aria-label="旅伴草案預覽" className="import-preview">
      {draft.action.draftItems.map((row, index) => <article className="import-row" key={`${row.day}-${index}`}>
        <strong>{row.day} · {row.name}</strong>
        <p>{row.time ?? row.period ?? "依順序"}{row.notes ? ` · ${row.notes}` : ""}</p>
      </article>)}
      <p className="hint">確認後會以一次操作加入 {draft.action.draftItems.length} 項，並保留復原。草案不代表真實訂位或已定位。</p>
      <div className="actions"><button className="primary" disabled={busy} onClick={() => void confirmDraft()}>確認並加入整份草案</button>
        <button disabled={busy} onClick={() => setDraft(null)}>放棄草案</button></div>
    </section>}
    {result && <p role="status" className="notice">{result}</p>}
    {usage && <p className="hint">{usage}；用量預留後即使服務失敗也計入，避免超額。</p>}
    {error && <p role="alert" className="error">{error}</p>}
  </Modal>;
}
