import { useEffect, useState } from "react";
import { searchPhoton } from "./place-search";
import type { PhotonPlace } from "./place-search";

export function PlaceSearch({ query, cityHint, onPick, mode = "place" }: {
  query: string;
  cityHint: string;
  onPick: (place: PhotonPlace) => void;
  mode?: "place" | "city";
}) {
  const [results, setResults] = useState<PhotonPlace[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [broaden, setBroaden] = useState(false);
  const [retry, setRetry] = useState(0);
  const minimum = mode === "city" ? 2 : 3;
  useEffect(() => {
    const term = query.trim();
    if (term.length < minimum || /^https?:\/\//i.test(term)) {
      setResults([]);
      setError("");
      return;
    }
    let active = true;
    setBusy(true);
    const timer = window.setTimeout(() => {
      void searchPhoton(term, cityHint, broaden, fetch, mode === "city" ? "city" : undefined)
        .then((places) => { if (active) { setResults(places); setError(places.length ? "" : "沒有查到可靠地點；可保留手動輸入或搜尋其他城市。"); } })
        .catch((reason) => { if (active) { setResults([]); setError(reason instanceof Error ? reason.message : "外部搜尋暫時無法使用"); } })
        .finally(() => { if (active) setBusy(false); });
    }, 1000);
    return () => { active = false; window.clearTimeout(timer); };
  }, [query, cityHint, broaden, mode, minimum, retry]);
  if (query.trim().length < minimum || /^https?:\/\//i.test(query.trim())) return null;
  return <div className="place-results" aria-live="polite">
    <div className="place-results-head"><strong>{mode === "city" ? "城市位置搜尋" : "外部地點搜尋"} · {broaden ? "全區" : cityHint ? `優先 ${cityHint}` : "全區"}</strong>
      {!!cityHint && <button type="button" onClick={() => setBroaden((value) => !value)}>{broaden ? `優先 ${cityHint}` : "搜尋其他城市"}</button>}
    </div>
    {busy && <p>搜尋中…</p>}
    {error && !busy && <p className="hint">{error} <button type="button" onClick={() => setRetry((v) => v + 1)}>重試搜尋</button></p>}
    {!busy && results.map((found) => <button type="button" className="place-result" key={`${found.source}:${found.name}`} onClick={() => onPick(found)}>
      <strong>{found.name}</strong><span>{found.city || "城市待確認"} · {found.address || "地址未提供"}</span>
    </button>)}
    <p className="search-attribution">地點資料 © OpenStreetMap contributors · Photon；選取後可自行修正。搜尋文字會送至 Photon。</p>
  </div>;
}
