import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  categories,
  days,
  parseMaps,
  tripSchema,
  placeSchema,
  itemSchema,
  taskSchema,
  instant,
} from "./model";
import type { Trip, Place, Item, Task, Reminder } from "./model";
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
function validation(fn: () => unknown, set: (e: string) => void) {
  try {
    fn();
  } catch (e) {
    set(e instanceof Error ? e.message : "無法儲存");
  }
}
export function TripForm({
  trip,
  onSave,
  onClose,
}: {
  trip: Trip;
  onSave: (t: Trip) => Promise<void>;
  onClose: () => void;
}) {
  const [t, set] = useState(trip),
    [error, se] = useState("");
  return (
    <Modal title="旅程設定" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          validation(() => tripSchema.parse(t), se);
          try {
            await onSave(tripSchema.parse(t));
            onClose();
          } catch (e) {
            se(String(e));
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
              onChange={(e) => set({ ...t, start: e.target.value })}
            />
          </label>
          <label>
            結束日期
            <input
              required
              type="date"
              value={t.end}
              onChange={(e) => set({ ...t, end: e.target.value })}
            />
          </label>
        </div>
        <label>
          城市
          <input
            value={t.cities}
            placeholder="東京、京都、大阪"
            onChange={(e) => set({ ...t, cities: e.target.value })}
          />
        </label>
        <div className="fields">
          <label>
            目的地時區
            <input
              required
              list="zones"
              value={t.timezone}
              onChange={(e) => set({ ...t, timezone: e.target.value })}
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
  return (
    <Modal title="地點資料" onClose={onClose} wide>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSave(placeSchema.parse(p));
            onClose();
          } catch (e) {
            se(String(e));
          }
        }}
      >
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
            se(String(e));
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
            se(String(e));
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
