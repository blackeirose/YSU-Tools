import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ZodError } from "zod";
import {
  assignDayCity,
  categories,
  cityTimezoneHint,
  dayCity,
  days,
  parseMaps,
  tripSchema,
  placeSchema,
  itemSchema,
  taskSchema,
  instant,
} from "./model";
import type { Trip, Place, Item, Task, Reminder, DayCity } from "./model";
import { PlaceSearch } from "./PlaceSearch";
import { fillPlaceFromPhoton } from "./place-search";
import { cityConfirmed, cityFromSearch } from './city';
export type ReminderDraft = { id: string | null; beforeMinutes: number; enabled: boolean };
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "drawer" : ""}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button onClick={onClose} aria-label="關閉">
          ✕
        </button>
      </header>
      {children}
    </dialog>
  );
}
function ErrorText({ value }: { value: string }) {
  return value ? (
    <p role="alert" className="error">
      {value}
    </p>
  ) : null;
}
function formMessage(error: unknown) {
  if (error instanceof ZodError)
    return error.issues.map((issue) => `${String(issue.path.at(-1) ?? "欄位")}需要修正`).join("、");
  return error instanceof Error ? error.message : "無法儲存，請重試";
}
function validation(fn: () => unknown, set: (e: string) => void) {
  try {
    fn();
  } catch (e) {
    set(formMessage(e));
  }
}
export function TripForm({
  trip,
  items = [],
  onSave,
  onClose,
}: {
  trip: Trip;
  items?: Item[];
  onSave: (t: Trip) => Promise<void>;
  onClose: () => void;
}) {
  const [t, set] = useState(trip),
    [error, se] = useState("");
  const [cityFrom, setCityFrom] = useState(trip.start);
  const [cityTo, setCityTo] = useState(trip.end);
  const [cityName, setCityName] = useState("");
  const [cityZone, setCityZone] = useState(trip.timezone);
  const [cityLocation, setCityLocation] = useState<Pick<DayCity, "lat" | "lng" | "source" | "region">>();
  const [firstCity, setFirstCity] = useState<DayCity | undefined>(trip.dayCities?.[trip.start]);
  const [firstCityEdited, setFirstCityEdited] = useState(false);
  const formDays = (() => { try { return days(t); } catch { return []; } })();
  const outsideCount = items.filter((item) => !item.deleted && item.day && (item.day < t.start || item.day > t.end)).length;
  return (
    <Modal title="旅程設定" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          validation(() => tripSchema.parse(t), se);
          try {
            let prepared = tripSchema.parse(t);
            if (firstCityEdited && firstCity) {
              prepared = assignDayCity(prepared, prepared.start, trip.revision === 0 ? prepared.end : prepared.start,
                firstCity.name, t.timezone, { ...firstCity });
              prepared.backgroundRequested = true;
              prepared.backgroundVersion = 2;
            } else if (firstCityEdited && prepared.cities.trim() && !/[、,，;；]/.test(prepared.cities)) {
              prepared = assignDayCity(prepared, prepared.start, prepared.start, prepared.cities.trim(), prepared.timezone);
            }
            if (!Object.keys(prepared.dayCities ?? {}).length && prepared.cities.trim() &&
              !/[、,，;；]/.test(prepared.cities) && cityTimezoneHint(prepared.cities)) {
              prepared = assignDayCity(prepared, prepared.start, prepared.end, prepared.cities.trim(), prepared.timezone);
            }
            await onSave(prepared);
            onClose();
          } catch (e) {
            se(formMessage(e));
          }
        }}
      >
        <label>
          旅程名稱
          <input
            autoFocus
            required
            value={t.name}
            onChange={(e) => set({ ...t, name: e.target.value })}
          />
        </label>
        <div className="fields">
          <label>
            開始日期
            <input
              required
              type="date"
              value={t.start}
              onChange={(e) => { set({ ...t, start: e.target.value }); setCityFrom(e.target.value); }}
            />
          </label>
          <label>
            結束日期
            <input
              required
              type="date"
              value={t.end}
              onChange={(e) => { set({ ...t, end: e.target.value }); setCityTo(e.target.value); }}
            />
          </label>
        </div>
        {outsideCount > 0 && <p className="notice" role="status">
          縮短日期後，{outsideCount} 項範圍外安排會移到「待定」，保留原日期、時間與預約資訊，可復原。
        </p>}
        <label>
          城市
          <input
            value={t.cities}
            placeholder="東京、京都、大阪"
            onChange={(e) => {
              const cities = e.target.value;
              const hint = cityTimezoneHint(cities);
              setFirstCity(undefined); setFirstCityEdited(true);
              set({ ...t, cities, timezone: hint ?? t.timezone });
            }}
          />
        </label>
        {!cityConfirmed(firstCity) && !/[、,，;；]/.test(t.cities) && <PlaceSearch query={t.cities} cityHint="" mode="city" onPick={(found) => {
          const city = cityFromSearch(found);
          setFirstCity(city); setFirstCityEdited(true);
          set({ ...t, cities: found.name, timezone: city.timezone });
        }} />}
        {firstCity?.sourceId ? <p className="hint">已確認 {firstCity.name} · {firstCity.country || firstCity.region} · {firstCity.timezone || '請在下方選擇 IANA 時區'}。儲存並同步後會自動準備桌機背景。</p>
          : <p className="hint">可先儲存文字並安排旅程；選取城市結果後會確認地區與時區，再自動準備桌機背景。</p>}
        <div className="fields">
          <label>
            目的地時區
            <input
              required
              list="zones"
              value={t.timezone}
              onChange={(e) => { set({ ...t, timezone: e.target.value }); if (firstCity) { setFirstCity({ ...firstCity, timezone: e.target.value }); setFirstCityEdited(true); } }}
            />
          </label>
          <label>
            同行人數
            <input
              type="number"
              min="1"
              max="100"
              value={t.travelers}
              onChange={(e) => set({ ...t, travelers: Number(e.target.value) })}
            />
          </label>
        </div>
        <fieldset className="city-assignment">
          <legend>每日城市與時區</legend>
          <p className="hint">舊旅程的多個城市尚未分配日期。可一次設定連續幾天；不確定位置時不會猜座標。</p>
          {items.some((item) => !item.deleted && item.timeMode === "fixed") &&
            <p className="notice">修改旅程或每日城市時區不會換算既有固定預約；卡片會保留並標示原預約時區，請核對真實預約與跨時區交通。</p>}
          <div className="fields">
            <label>從哪一天<input type="date" value={cityFrom} min={t.start} max={t.end} onChange={(e) => setCityFrom(e.target.value)} /></label>
            <label>到哪一天<input type="date" value={cityTo} min={t.start} max={t.end} onChange={(e) => setCityTo(e.target.value)} /></label>
          </div>
          <div className="fields">
            <label>主要城市<input list="planner-cities" value={cityName} onChange={(e) => {
              const name = e.target.value;
              setCityName(name);
              setCityLocation(undefined);
              const hint = cityTimezoneHint(name);
              setCityZone(hint ?? "");
            }} placeholder="例如 東京、Honolulu" /></label>
            <label>目的地時區<input list="zones" value={cityZone} onChange={(e) => setCityZone(e.target.value)} /></label>
          </div>
          <PlaceSearch query={cityName} cityHint="" mode="city" onPick={(found) => {
            setCityName(found.name);
            setCityLocation({ lat: found.lat, lng: found.lng, region: found.city, source: found.source });
            setCityZone(cityTimezoneHint(found.name) ?? "");
          }} />
          {cityLocation?.lat != null && <p className="hint">已選擇實際城市位置；請確認 IANA 時區再套用。</p>}
          <datalist id="planner-cities">{["東京", "大阪", "京都", "名古屋", "台北", "Honolulu", "Los Angeles", "San Francisco"].map((name) => <option key={name} value={name} />)}</datalist>
          <button type="button" onClick={() => {
            try { set(assignDayCity(t, cityFrom, cityTo, cityName, cityZone, cityLocation)); se(""); }
            catch (error) { se(formMessage(error)); }
          }}>套用到所選日期</button>
          <div className="city-days">{formDays.map((date) => {
            const city = dayCity(t, date);
            return <span key={date}>{date.slice(5)} · {city.assigned ? `${city.name} · ${city.timezone}` : "城市未指定"}</span>;
          })}</div>
        </fieldset>
        <ErrorText value={error} />
        <footer>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary">儲存旅程</button>
        </footer>
      </form>
    </Modal>
  );
}
export function PlaceForm({
  place,
  onSave,
  onClose,
  onPin,
}: {
  place: Place;
  onSave: (p: Place) => Promise<void>;
  onClose: () => void;
  onPin?: () => void;
}) {
  const [p, set] = useState(place),
    [error, se] = useState("");
  const [lookup, setLookup] = useState("");
  return (
    <Modal title="地點資料" onClose={onClose} wide>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSave(placeSchema.parse(p));
            onClose();
          } catch (e) {
            se(formMessage(e));
          }
        }}
      >
        <label>搜尋地點位置
          <input value={lookup} onChange={(e) => setLookup(e.target.value)} placeholder="輸入至少 3 字；例如 Tokyo Disney" />
        </label>
        <PlaceSearch query={lookup} cityHint={p.city} onPick={(found) => {
          if (p.revision > 0 && !window.confirm("選取後會更新名稱、地址、分類與座標；你手動填的備註與原文名稱會保留。要套用嗎？")) return;
          set(fillPlaceFromPhoton(p, found));
          setLookup("");
        }} />
        <label>
          名稱
          <input
            autoFocus
            required
            value={p.name}
            onChange={(e) => set({ ...p, name: e.target.value })}
          />
        </label>
        <label>
          Google Maps 連結
          <input
            type="url"
            value={p.mapsUrl}
            onChange={(e) => {
              const mapsUrl = e.target.value;
              const parsed = parseMaps(mapsUrl);
              set({
                ...p,
                ...parsed,
                name: p.name || parsed.name || "",
                mapsUrl,
              });
            }}
          />
        </label>
        <p className="hint">
          短網址或無法定位的連結會保留。地圖視窗中心不當作地點座標。
        </p>
        <label>
          原文名稱
          <input
            value={p.originalName}
            onChange={(e) => set({ ...p, originalName: e.target.value })}
          />
        </label>
        <div className="fields">
          <label>
            城市
            <input
              value={p.city}
              onChange={(e) => set({ ...p, city: e.target.value })}
            />
          </label>
          <label>
            區域
            <input
              value={p.area}
              onChange={(e) => set({ ...p, area: e.target.value })}
            />
          </label>
        </div>
        <label>
          分類
          <select
            value={p.category}
            onChange={(e) =>
              set({ ...p, category: e.target.value as Place["category"] })
            }
          >
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          地址
          <textarea
            value={p.address}
            onChange={(e) => set({ ...p, address: e.target.value })}
          />
        </label>
        <div className="fields">
          <label>
            緯度
            <input
              type="number"
              step="any"
              min="-90"
              max="90"
              value={p.lat ?? ""}
              onChange={(e) =>
                set({
                  ...p,
                  lat: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            經度
            <input
              type="number"
              step="any"
              min="-180"
              max="180"
              value={p.lng ?? ""}
              onChange={(e) =>
                set({
                  ...p,
                  lng: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
        </div>
        {onPin && (
          <button type="button" onClick={onPin}>
            在地圖上選位置（先儲存其他變更）
          </button>
        )}
        <label>
          網址
          <input
            type="url"
            value={p.url}
            onChange={(e) => set({ ...p, url: e.target.value })}
          />
        </label>
        <label>
          備註
          <textarea
            rows={3}
            value={p.notes}
            onChange={(e) => set({ ...p, notes: e.target.value })}
          />
        </label>
        <label>
          來源／查詢時間
          <input
            value={p.source}
            onChange={(e) => set({ ...p, source: e.target.value })}
          />
        </label>
        <ErrorText value={error} />
        <footer>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary">儲存地點</button>
        </footer>
      </form>
    </Modal>
  );
}
export function ItemForm({
  item,
  trip,
  place,
  onSave,
  onClose,
}: {
  item: Item;
  trip: Trip;
  place: Place;
  onSave: (i: Item, remind: number | null) => Promise<void>;
  onClose: () => void;
}) {
  const [i, set] = useState(item),
    [error, se] = useState(""),
    [remind, sr] = useState<string>("");
  return (
    <Modal title={place.name} onClose={onClose} wide>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const v = itemSchema.parse(i);
            if (v.day && v.time && ["fixed", "flexible"].includes(v.timeMode))
              instant(v.day, v.time, v.departureZone);
            if (v.arrivalDay && v.arrivalTime) {
              const arrival = instant(
                v.arrivalDay,
                v.arrivalTime,
                v.arrivalZone,
              );
              if (
                v.day &&
                v.time &&
                arrival.epochMilliseconds <=
                  instant(v.day, v.time, v.departureZone).epochMilliseconds
              )
                throw new Error("抵達必須晚於出發");
            }
            await onSave(v, remind === "" ? null : Number(remind));
            onClose();
          } catch (e) {
            se(formMessage(e));
          }
        }}
      >
        <p className="hint">地點資訊可重複使用；以下只影響這次安排。</p>
        <div className="fields">
          <label>
            日期
            <select
              value={i.day ?? ""}
              onChange={(e) =>
                set({
                  ...i,
                  day: e.target.value || null,
                  status: e.target.value ? i.status : "candidate",
                })
              }
            >
              <option value="">未排定</option>
              {days(trip).map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label>
            狀態
            <select
              value={i.status}
              onChange={(e) =>
                set({ ...i, status: e.target.value as Item["status"] })
              }
            >
              <option value="planned">已排定</option>
              <option value="candidate">候選</option>
              <option value="done">完成</option>
              <option value="skipped">跳過</option>
            </select>
          </label>
        </div>
        <label>
          時間方式
          <select
            value={i.timeMode}
            onChange={(e) =>
              set({ ...i, timeMode: e.target.value as Item["timeMode"] })
            }
          >
            <option value="sequence">只有順序</option>
            <option value="period">上午／下午／晚上</option>
            <option value="flexible">大約／可調整時間</option>
            <option value="fixed">固定預約</option>
          </select>
        </label>
        {i.timeMode === "period" ? (
          <label>
            時段
            <select
              value={i.period}
              onChange={(e) =>
                set({ ...i, period: e.target.value as Item["period"] })
              }
            >
              <option>上午</option>
              <option>下午</option>
              <option>晚上</option>
            </select>
          </label>
        ) : (
          ["flexible", "fixed"].includes(i.timeMode) && (
            <label>
              當地時間
              <input
                required
                type="time"
                value={i.time ?? ""}
                onChange={(e) => set({ ...i, time: e.target.value || null })}
              />
            </label>
          )
        )}
        <div className="fields">
          <label>
            停留（分鐘）
            <input
              type="number"
              min="0"
              max="1440"
              value={i.duration}
              onChange={(e) => set({ ...i, duration: Number(e.target.value) })}
            />
          </label>
          <label>
            緩衝（分鐘）
            <input
              type="number"
              min="0"
              max="1440"
              value={i.buffer}
              onChange={(e) => set({ ...i, buffer: Number(e.target.value) })}
            />
          </label>
        </div>
        <div className="fields">
          <label>
            移動方式
            <select
              value={i.transport}
              onChange={(e) =>
                set({ ...i, transport: e.target.value as Item["transport"] })
              }
            >
              <option>步行</option>
              <option>大眾運輸</option>
              <option>開車</option>
              <option>其他</option>
            </select>
          </label>
          <label>
            手動交通分鐘
            <input
              type="number"
              min="0"
              max="2880"
              value={i.travelMinutes ?? ""}
              onChange={(e) =>
                set({
                  ...i,
                  travelMinutes:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
        </div>
        <details>
          <summary>跨時區交通、提醒與同行人數</summary>
          <label>
            出發時區
            <input
              list="zones"
              value={i.departureZone}
              onChange={(e) => set({ ...i, departureZone: e.target.value })}
            />
          </label>
          <div className="fields">
            <label>
              抵達日期
              <input
                type="date"
                value={i.arrivalDay ?? ""}
                onChange={(e) =>
                  set({ ...i, arrivalDay: e.target.value || null })
                }
              />
            </label>
            <label>
              抵達時間
              <input
                type="time"
                value={i.arrivalTime ?? ""}
                onChange={(e) =>
                  set({ ...i, arrivalTime: e.target.value || null })
                }
              />
            </label>
          </div>
          <label>
            抵達時區
            <input
              list="zones"
              value={i.arrivalZone}
              onChange={(e) => set({ ...i, arrivalZone: e.target.value })}
            />
          </label>
          <label>
            同行人數（留白沿用旅程）
            <input
              type="number"
              min="1"
              max="100"
              value={i.travelers ?? ""}
              onChange={(e) =>
                set({
                  ...i,
                  travelers:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            新增提前提醒（分鐘，需設定日期時間）
            <input
              type="number"
              min="0"
              max="525600"
              value={remind}
              onChange={(e) => sr(e.target.value)}
            />
          </label>
        </details>
        <label>
          這次安排的備註
          <textarea
            rows={3}
            value={i.notes}
            onChange={(e) => set({ ...i, notes: e.target.value })}
          />
        </label>
        <ErrorText value={error} />
        <footer>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary">儲存安排</button>
        </footer>
      </form>
    </Modal>
  );
}
export function TaskForm({
  task,
  items,
  places,
  reminders,
  onSave,
  onClose,
}: {
  task: Task;
  items: Item[];
  places: Place[];
  reminders: Reminder[];
  onSave: (t: Task, drafts: ReminderDraft[], baseline: Reminder[]) => Promise<void>;
  onClose: () => void;
}) {
  const [t, set] = useState(task),
    [baseline] = useState(reminders),
    [drafts, sd] = useState<ReminderDraft[]>(
      baseline.map((r) => ({ id: r.id, beforeMinutes: r.beforeMinutes, enabled: r.enabled })),
    ),
    [error, se] = useState("");
  return (
    <Modal title="待辦／預約" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const v = taskSchema.parse(t);
            if (v.date && v.time) instant(v.date, v.time, v.timezone);
            await onSave(v, drafts, baseline);
            onClose();
          } catch (e) {
            se(formMessage(e));
          }
        }}
      >
        <label>
          事項
          <input
            autoFocus
            required
            value={t.title}
            onChange={(e) => set({ ...t, title: e.target.value })}
          />
        </label>
        <div className="fields">
          <label>
            類型
            <select
              value={t.type}
              onChange={(e) =>
                set({ ...t, type: e.target.value as Task["type"] })
              }
            >
              {[
                "訂票開放",
                "訂位",
                "付款截止",
                "取消截止",
                "準備",
                "活動提醒",
                "出發提醒",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            狀態
            <select
              value={t.status}
              onChange={(e) =>
                set({ ...t, status: e.target.value as Task["status"] })
              }
            >
              {["待訂", "已訂", "待確認", "完成"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="fields">
          <label>
            截止日期
            <input
              type="date"
              value={t.date ?? ""}
              onChange={(e) => set({ ...t, date: e.target.value || null })}
            />
          </label>
          <label>
            時間
            <input
              type="time"
              value={t.time ?? ""}
              onChange={(e) => set({ ...t, time: e.target.value || null })}
            />
          </label>
        </div>
        <label>
          事項時區
          <input
            required
            list="zones"
            value={t.timezone}
            onChange={(e) => set({ ...t, timezone: e.target.value })}
          />
        </label>
        <div className="reminder-editor">
          <p>提前提醒</p>
          {drafts.map((draft, n) => (
            <div className="fields" key={draft.id ?? `new-${n}`}>
              <label>
                提前提醒（分鐘）
                <input
                  type="number"
                  min="0"
                  max="525600"
                  value={draft.beforeMinutes}
                  onChange={(e) => sd(drafts.map((d, index) => index === n ? { ...d, beforeMinutes: Number(e.target.value) } : d))}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.enabled}
                  onChange={(e) => sd(drafts.map((d, index) => index === n ? { ...d, enabled: e.target.checked } : d))}
                />
                啟用
              </label>
              <button type="button" onClick={() => sd(drafts.filter((_, index) => index !== n))}>刪除此提醒</button>
            </div>
          ))}
          <button type="button" onClick={() => sd([...drafts, { id: null, beforeMinutes: 60, enabled: true }])}>新增提前提醒</button>
        </div>
        <label>
          連結行程
          <select
            value={t.itemId ?? ""}
            onChange={(e) => set({ ...t, itemId: e.target.value || null })}
          >
            <option value="">獨立事項</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.day ?? "候選"} ·{" "}
                {places.find((p) => p.id === i.placeId)?.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          來源網址
          <input
            type="url"
            value={t.url}
            onChange={(e) => set({ ...t, url: e.target.value })}
          />
        </label>
        <label>
          備註
          <textarea
            value={t.notes}
            onChange={(e) => set({ ...t, notes: e.target.value })}
          />
        </label>
        <ErrorText value={error} />
        <footer>
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button className="primary">儲存待辦</button>
        </footer>
      </form>
    </Modal>
  );
}
