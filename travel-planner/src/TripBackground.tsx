import { useEffect, useRef, useState } from "react";
import type { Trip } from "./model";

type State = "none" | "running" | "ready" | "failed";
type Status = { state: State; attempts?: number; error?: string; city?: string; retryAllowed?: boolean };
const endpoint = "/travel-planner/api/background";
// Draft deploys have separate private Blob stores. A new immutable Preview must
// not silently repeat paid generation for a trip requested on an older deploy.
export function shouldAutoStartBackground(namespace: string | undefined, requested: boolean,
  state: State, confirmed: boolean, alreadySent: boolean) {
  return namespace === "v1" && requested && state === "none" && confirmed && !alreadySent;
}
export function shouldPollAcceptedBackground(state: State, acceptedAt: number, now: number) {
  return state === "none" && acceptedAt > 0 && now - acceptedAt < 120000;
}
export function TripBackground({ trip, enabled, cloudReady, token, onConfigureCity }: {
  trip: Trip; enabled: boolean; cloudReady: boolean; token: () => Promise<string>; onConfigureCity: () => void;
}) {
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 701px)").matches);
  const [status, setStatus] = useState<Status>({ state: "none" });
  const [images, setImages] = useState<{ top: string; lower: string } | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const autoSent = useRef("");
  const awaitingResult = useRef(0);
  const activeTripId = useRef(trip.id);
  activeTripId.current = trip.id;
  const city = trip.dayCities?.[trip.start];
  const confirmed = !!(city?.name && city.timezone && Number.isFinite(city.lat) && Number.isFinite(city.lng));
  useEffect(() => {
    const media = window.matchMedia("(min-width: 701px)");
    const listener = () => setDesktop(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);
  useEffect(() => {
    setStatus({ state: "none" }); setImages(null); setError(""); autoSent.current = "";
    awaitingResult.current = 0;
  }, [trip.id]);
  useEffect(() => {
    if (!desktop || !enabled || !cloudReady) return;
    let cancelled = false;
    let timer: number | undefined;
    async function authenticated(path: string, method = "GET", part?: "top" | "lower") {
      const response = await fetch(`${endpoint}/${path}?tripId=${encodeURIComponent(trip.id)}${part ? `&part=${part}` : ""}`, {
        method, headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store" });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(detail.error || `背景服務暫時無法使用 (${response.status})`);
      }
      return response;
    }
    async function poll() {
      try {
        const data = await (await authenticated("status")).json() as Status;
        if (cancelled) return;
        // A just-accepted start can briefly read as "none" from Blob storage.
        // Keep polling the existing job; never start a second paid request.
        if (data.state === "none" && awaitingResult.current) {
          if (shouldPollAcceptedBackground(data.state, awaitingResult.current, Date.now())) {
            setStatus({ state: "running" });
            timer = window.setTimeout(() => void poll(), 3000);
            return;
          }
          setStatus({ state: "running" });
          setError("背景工作狀態尚未更新；請稍後刷新確認，勿重複生成");
          return;
        } else if (data.state !== "running") awaitingResult.current = 0;
        setStatus(data); setError("");
        if (shouldAutoStartBackground(import.meta.env.VITE_FIREBASE_NAMESPACE, !!trip.backgroundRequested,
          data.state, confirmed, autoSent.current === `${trip.id}:${city?.name}`)) {
          autoSent.current = `${trip.id}:${city?.name}`;
          await authenticated("start", "POST");
          if (cancelled || activeTripId.current !== trip.id) return;
          awaitingResult.current = Date.now();
          timer = window.setTimeout(() => void poll(), 3000);
        } else if (data.state === "running") timer = window.setTimeout(() => void poll(), 12000);
        else if (data.state === "ready") {
          const top = await (await authenticated("status", "GET", "top")).blob();
          const lower = await (await authenticated("status", "GET", "lower")).blob();
          if (!cancelled) setImages({ top: URL.createObjectURL(top), lower: URL.createObjectURL(lower) });
        }
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "背景載入失敗"); }
    }
    void poll();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [trip.id, trip.backgroundRequested, city?.name, city?.lat, city?.lng, confirmed, desktop, enabled, cloudReady, refresh]);
  useEffect(() => () => {
    if (images) { URL.revokeObjectURL(images.top); URL.revokeObjectURL(images.lower); }
  }, [images]);
  if (!desktop || !enabled) return null;
  const retry = async () => {
    const requestedTripId = trip.id;
    try {
      setError("");
      const response = await fetch(`${endpoint}/start?tripId=${encodeURIComponent(trip.id)}`, {
        method: "POST", headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store" });
      if (activeTripId.current !== requestedTripId) return;
      if (!response.ok && response.status !== 202) throw new Error("背景重試未開始；請稍後再試");
      awaitingResult.current = Date.now();
      setStatus({ state: "running" });
      setRefresh((value) => value + 1);
    } catch (cause) {
      if (activeTripId.current === requestedTripId)
        setError(cause instanceof Error ? cause.message : "背景重試失敗");
    }
  };
  return <>
    {images && <div className="trip-background" aria-hidden="true">
      <img src={images.top} alt="" onError={() => { setImages(null); setError("背景圖片無法顯示；行程仍可正常使用"); }} />
      <img src={images.lower} alt="" onError={() => { setImages(null); setError("背景圖片無法顯示；行程仍可正常使用"); }} />
    </div>}
    <div className="background-caption" role="status">
      {status.state === "ready" ? images ? `地區背景 · ${status.city || "建立時城市"} · 攝影／紙雕${status.city && city?.name !== status.city ? "（首日城市已更改，原背景保留）" : ""}` : error ? "背景已保存，圖片讀取失敗" : "背景已保存，正在讀取圖片" :
        !confirmed ? "地區背景：請先設定第一天城市與位置" :
        status.state === "running" ? "地區背景生成中；可以繼續規劃" :
          status.state === "failed" ? `地區背景：${status.error || "暫時失敗"}` : "地區背景尚未生成"}
      {confirmed && cloudReady && (status.state === "none" || status.state === "failed" && status.retryAllowed !== false) &&
        <button type="button" onClick={() => void retry()}>{status.state === "failed" ? "重試" : "生成背景"}</button>}
      {error && <span className="error">{error}</span>}
      {!confirmed && <button type="button" onClick={onConfigureCity}>設定首日城市</button>}
      {error && status.state === "ready" && <button type="button" onClick={() => { setError(""); setRefresh((value) => value + 1); }}>重新載入圖片</button>}
    </div>
  </>;
}
