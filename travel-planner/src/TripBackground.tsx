import { useEffect, useRef, useState } from 'react';
import type { Trip, DayCity } from './model';
import { cityConfirmed, cityFromSearch } from './city';
import { PlaceSearch } from './PlaceSearch';

type State = 'none' | 'running' | 'ready' | 'failed';
type Status = { state: State; error?: string; city?: string; retryAllowed?: boolean;
  legacy?: boolean; imagePart?: 'top' | 'poster'; startedAt?: string };
const endpoint = '/travel-planner/api/background';
export function shouldAutoStartBackground(namespace: string | undefined, requested: boolean,
  state: State, confirmed: boolean, alreadySent: boolean, version?: number) {
  return ['v1', 'preview-v1'].includes(namespace ?? '') && version === 2 && requested &&
    state === 'none' && confirmed && !alreadySent;
}
export function shouldPollAcceptedBackground(state: State, acceptedAt: number, now: number) {
  return state === 'none' && acceptedAt > 0 && now - acceptedAt < 120000;
}
export function TripBackground({ trip, enabled, cloudReady, token, onConfirmCity }: {
  trip: Trip; enabled: boolean; cloudReady: boolean; token: () => Promise<string>;
  onConfirmCity: (city: DayCity) => Promise<void>;
}) {
  const [desktop, setDesktop] = useState(() => window.matchMedia('(min-width: 701px)').matches);
  const [status, setStatus] = useState<Status>({ state: 'none' });
  const [image, setImage] = useState<{ url: string; part: string } | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [accepted, setAccepted] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [query, setQuery] = useState(trip.dayCities?.[trip.start]?.name || trip.cities.split(/[、,，;；]/)[0]);
  const [selected, setSelected] = useState<DayCity>();
  const autoSent = useRef(false), awaitingResult = useRef(0), loadedPart = useRef('');
  const autoConsidered = useRef(false);
  const activeTripId = useRef(trip.id);
  activeTripId.current = trip.id;
  useEffect(() => () => { activeTripId.current = ''; }, []);
  const city = trip.dayCities?.[trip.start], confirmed = cityConfirmed(city);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 701px)');
    const listener = () => setDesktop(media.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);
  // App keys this component by trip.id. Every async completion is also guarded.
  useEffect(() => {
    if (!desktop || !enabled || !cloudReady) return;
    let cancelled = false, timer: number | undefined;
    async function authenticated(path: string, method = 'GET', part?: string) {
      let credential: string;
      try { credential = await token(); }
      catch (cause) { if (method === 'POST') autoSent.current = false; throw cause; }
      const response = await fetch(`${endpoint}/${path}?tripId=${encodeURIComponent(trip.id)}${part ? `&part=${part}` : ''}`, {
        method, headers: { Authorization: `Bearer ${credential}` }, cache: 'no-store' });
      if (!response.ok) {
        if (method === 'POST') autoSent.current = false;
        const detail = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(detail.error || `背景服務暫時無法使用 (${response.status})`);
      }
      return response;
    }
    async function poll() {
      try {
        const data = await (await authenticated('status')).json() as Status;
        if (cancelled) return;
        if (data.state === 'none' && awaitingResult.current) {
          if (shouldPollAcceptedBackground(data.state, awaitingResult.current, Date.now())) {
            timer = window.setTimeout(() => void poll(), 3000); return;
          }
          setError('伺服器已接收請求，但未確認工作狀態；請稍後重新查詢，不會自動重送付費請求');
          setAccepted(false); return;
        }
        if (data.state !== 'none') { awaitingResult.current = 0; setAccepted(false); }
        setStatus(data); setError('');
        if (data.imagePart && loadedPart.current !== data.imagePart) {
          const blob = await (await authenticated('status', 'GET', data.imagePart)).blob();
          if (cancelled) return;
          loadedPart.current = data.imagePart;
          setImage({ url: URL.createObjectURL(blob), part: data.imagePart });
        }
        if (shouldAutoStartBackground(import.meta.env.VITE_FIREBASE_NAMESPACE, !!trip.backgroundRequested,
          data.state, confirmed, autoConsidered.current, trip.backgroundVersion)) {
          autoConsidered.current = true; autoSent.current = true;
          await authenticated('start', 'POST');
          if (activeTripId.current !== trip.id) return;
          awaitingResult.current = Date.now();
          if (cancelled) return;
          setAccepted(true);
          timer = window.setTimeout(() => void poll(), 3000);
        } else if (data.state === 'running') {
          if (data.startedAt && Date.now() - Date.parse(data.startedAt) > 20 * 60_000)
            setError('工作結果尚未確認；不會重複扣費。請重新查詢或聯絡維護者。');
          else timer = window.setTimeout(() => void poll(), 5000);
        }
      } catch (cause) { if (!cancelled) { setAccepted(false); setError(cause instanceof Error ? cause.message : '背景載入失敗'); } }
    }
    void poll();
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
  }, [trip.id, trip.backgroundRequested, trip.backgroundVersion, city?.name, confirmed, desktop, enabled, cloudReady, refresh]);
  useEffect(() => () => { if (image) URL.revokeObjectURL(image.url); }, [image]);
  if (!desktop) return null;
  const start = async (upgrade = false) => {
    const id = trip.id;
    let dispatched = false;
    try {
      setError(''); autoSent.current = true;
      const credential = await token();
      if (activeTripId.current !== id) return;
      dispatched = true;
      const response = await fetch(`${endpoint}/start?tripId=${encodeURIComponent(id)}${upgrade ? '&upgrade=1' : ''}`, {
        method: 'POST', headers: { Authorization: `Bearer ${credential}` }, cache: 'no-store' });
      if (activeTripId.current !== id) return;
      if (!response.ok) { dispatched = false; throw new Error('背景請求未被接受；行程與舊圖片仍保留，可再試'); }
      awaitingResult.current = Date.now(); setAccepted(true); setRefresh((v) => v + 1);
    } catch (cause) {
      if (activeTripId.current === id) {
        if (!dispatched) autoSent.current = false;
        setError(dispatched ? '請求結果未知；請重新查詢，不會自動重送付費請求' : cause instanceof Error ? cause.message : '背景請求失敗');
      }
    }
  };
  const saveCity = async () => {
    if (!selected) return;
    const id = trip.id;
    try { await onConfirmCity(selected); if (activeTripId.current === id) { setConfirming(false); setError(''); } }
    catch (cause) { if (activeTripId.current === id) setError(cause instanceof Error ? cause.message : '城市尚未保存，可重試'); }
  };
  return <>
    {image && <div className={`trip-background${status.legacy ? ' legacy-background' : ''}`} aria-hidden="true">
      <img src={image.url} alt="" onError={() => { loadedPart.current = ''; setImage(null); setError('背景圖片無法顯示；行程仍可正常使用'); }} />
    </div>}
    <div className="background-caption" role="status">
      {!enabled ? '桌機城市 AI 背景需私人登入；本機行程仍可使用' :
        !cloudReady ? '地區背景：等待旅程同步；可以繼續規劃' :
        accepted ? '背景請求已接收，等待伺服器確認工作' :
        status.state === 'running' ? '地區背景生成中；可以繼續規劃' :
        status.state === 'failed' ? `背景生成失敗：${status.error || '請重新查詢'}${image ? '；舊圖保留' : ''}` :
        status.state === 'ready' ? status.legacy ? `地區背景 · ${status.city} · 舊版攝影素材（尚未更新風格）` :
          `地區背景 · ${status.city} · 攝影 × 精切紙雕${image ? '' : ' · 正在讀取圖片'}` :
        !confirmed ? `地區背景：等待確認 ${city?.name || trip.cities || '第一城市'}` : '地區背景尚未生成'}
      {enabled && !confirmed && <button type="button" onClick={() => setConfirming((v) => !v)}>確認第一城市</button>}
      {enabled && confirmed && cloudReady && !accepted && (status.state === 'none' && !autoSent.current || status.state === 'failed' && status.retryAllowed !== false) &&
        <button type="button" onClick={() => void start(!!status.legacy)}>{status.state === 'failed' ? '重試背景' : '生成背景'}</button>}
      {enabled && confirmed && cloudReady && status.legacy && status.state === 'ready' && !accepted &&
        <button type="button" onClick={() => { if (window.confirm('更新為一張完整橫向背景將使用 AI 額度；成功保存後才切換，失敗保留舊圖片。要更新嗎？')) void start(true); }}>更新背景風格</button>}
      {error && <><span className="error">{error}</span><button type="button" onClick={() => { loadedPart.current = ''; setRefresh((v) => v + 1); }}>重新查詢</button></>}
    </div>
    {confirming && <section className="inline-city-confirm" aria-label="確認第一城市">
      <label>第一城市<input value={query} onChange={(e) => { setQuery(e.target.value); setSelected(undefined); }} /></label>
      {!selected && <PlaceSearch query={query} cityHint="" mode="city" onPick={(found) => setSelected(cityFromSearch(found))} />}
      {selected && <><p>{selected.name} · {selected.country || selected.region}</p>
        <label>IANA 時區<input value={selected.timezone} onChange={(e) => setSelected({ ...selected, timezone: e.target.value })} placeholder="例如 Asia/Tokyo" /></label>
        <button type="button" onClick={() => void saveCity()}>確認城市並儲存</button></>}
      <button type="button" onClick={() => setConfirming(false)}>稍後確認，繼續規劃</button>
    </section>}
  </>;
}
