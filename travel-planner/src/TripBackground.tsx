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
export function TripBackground({ trip, enabled, cloudReady, token }: {
  trip: Trip; enabled: boolean; cloudReady: boolean; token: () => Promise<string>;
}) {
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 701px)").matches);
  const [status, setStatus] = useState<Status>({ state: "none" });
  const [images, setImages] = useState<{ top: string; lower: string } | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const autoSent = useRef("");
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
        setStatus(data); setError("");
        if (shouldAutoStartBackground(import.meta.env.VITE_FIREBASE_NAMESPACE, !!trip.backgroundRequested,
          data.state, confirmed, autoSent.current === `${trip.id}:${city?.name}`)) {
          autoSent.current = `${trip.id}:${city?.name}`;
          await authenticated("start", "POST");
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
    try {
      setError("");
      const response = await fetch(`${endpoint}/start?tripId=${encodeURIComponent(trip.id)}`, {
        method: "POST", headers: { Authorization: `Bearer ${await token()}` }, cache: "no-store" });
      if (!response.ok && response.status !== 202) throw new Error("背景重試未開始；請稍後再試");
      setStatus({ state: "running" });
      setRefresh((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "背景重試失敗"); }
  };
  return <>
    {images && <div className="trip-background" aria-hidden="true">
      <img src={images.top} alt="" /><img src={images.lower} alt="" />
    </div>}
    <div className="background-caption" role="status">
      {status.state === "ready" ? `地區背景 · ${status.city || "建立時城市"} · 攝影／紙雕${status.city && city?.name !== status.city ? "（首日城市已更改，原背景保留）" : ""}` :
        !confirmed ? "地區背景：請先設定第一天城市與位置" :
        status.state === "running" ? "地區背景生成中；可以繼續規劃" :
          status.state === "failed" ? `地區背景：${status.error || "暫時失敗"}` : "地區背景尚未生成"}
      {confirmed && cloudReady && (status.state === "none" || status.state === "failed" && status.retryAllowed !== false) &&
        <button type="button" onClick={() => void retry()}>{status.state === "failed" ? "重試" : "生成背景"}</button>}
      {error && <span className="error">{error}</span>}
    </div>
  </>;
}
