import { useEffect, useRef, useState } from "react";
import { Temporal } from "@js-temporal/polyfill";
import { PlannerStore } from "./storage";
import type { Snapshot } from "./storage";
import {
  configured,
  emulator,
  watchAuth,
  storageScope,
  previewCloud,
  login,
  logout,
  cloudRemote,
  auth,
} from "./firebase";
import {
  baseRecord,
  blankTrip,
  blankPlace,
  blankItem,
  days,
  localToday,
  ordered,
  parseMaps,
  safeUrl,
  mapsPlace,
  navigation,
  delayFlexible,
  otherZone,
  instant,
  validateImport,
  validateSchedule,
  remapImport,
  categories,
} from "./model";
import type { RecordData, Trip, Place, Item, Task } from "./model";
import { calendar, dueReminders, itemTime, taskTime } from "./calendar";
import { demos } from "./demo";
import { Modal, TripForm, PlaceForm, ItemForm, TaskForm } from "./Forms";
import { TravelMap } from "./Map";
import "./style.css";
type Tab = "today" | "map" | "candidates" | "tasks";
type Editor =
  | { type: "trip"; value: Trip }
  | { type: "place"; value: Place }
  | { type: "item"; value: Item }
  | { type: "task"; value: Task }
  | null;
type Suggestion = {
  name: string;
  originalName: string;
  location: string;
  reason: string;
  sourceUrls: string[];
  checkedAt: string;
  pending: string[];
};
const download = (name: string, text: string, type: string) => {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function message(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}
export default function App() {
  const [user, su] = useState<string | null>(null),
    [demo, sd] = useState(!configured),
    [store, ss] = useState<PlannerStore | null>(null),
    [loading, sl] = useState(true),
    [, redraw] = useState(0),
    [tripId, st] = useState<string | null>(null),
    [day, sy] = useState(""),
    [tab, sb] = useState<Tab>("today"),
    [multi, sm] = useState(true),
    [selected, si] = useState<string | null>(null),
    [editor, se] = useState<Editor>(null),
    [notice, sn] = useState(""),
    [error, ser] = useState(""),
    [search, sq] = useState(""),
    [city, sc] = useState(""),
    [category, sk] = useState(""),
    [area, sa] = useState(""),
    [replace, sr] = useState<Item | null>(null),
    [pin, sp] = useState<string | null>(null),
    [mapFilter, sf] = useState("day"),
    [ratio, sz] = useState(43),
    [archived, sh] = useState(false),
    [imported, simp] = useState<RecordData[] | null>(null),
    [reminders, srem] = useState(false),
    [explore, sx] = useState(false),
    [help, shelp] = useState(false),
    [loginOpen, slo] = useState(false),
    [logoutOpen, slogout] = useState(false),
    [email, sem] = useState(""),
    [password, spw] = useState(""),
    [aiQuery, saq] = useState(""),
    [aiCategory, sac] = useState(""),
    [budget, sbudget] = useState(""),
    [walk, swalk] = useState(""),
    [child, schild] = useState(false),
    [suggestions, sg] = useState<Suggestion[]>([]),
    [aiBusy, sbusy] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    activeStore = useRef<PlannerStore | null>(null),
    recovery = useRef(new Map<string, Snapshot>()),
    ack = useRef(new Set<string>());
  const attempt = async (fn: () => Promise<unknown>, success?: string) => {
    ser("");
    try {
      await fn();
      if (success) sn(success);
    } catch (e) {
      ser(message(e));
    }
  };
  useEffect(
    () =>
      watchAuth((id) => {
        su(id);
        if (id) sd(false);
      }),
    [],
  );
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (recovery.current.size) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, []);
  useEffect(() => {
    let cancelled = false;
    let unsub: undefined | (() => void);
    sl(true);
    const old = activeStore.current;
    activeStore.current = null;
    ss(null);
    st(null);
    si(null);
    se(null);
    ack.current.clear();
    sg([]);
    void (async () => {
      try {
        if (old) {
          if (old.owner !== "local-demo") {
            // External logout/session loss must not silently discard pending work.
            // Private disk cache is cleared; recovery stays only in this tab's memory
            // and can be restored/exported only after the same UID authenticates.
            const saved = await old.clearWithRecovery();
            if (saved) recovery.current.set(old.owner, saved);
          } else old.close();
        }
        if (cancelled) return;
        if (!demo && !user) {
          sl(false);
          return;
        }
        const current = new PlannerStore(
          demo ? "local-demo" : user!,
          demo ? null : cloudRemote(user!),
          demo ? "" : storageScope,
        );
        activeStore.current = current;
        unsub = current.subscribe(() => {
          if (!cancelled) redraw((n) => n + 1);
        });
        try {
          const saved = !demo && recovery.current.get(user!);
          if (saved) {
            await current.restoreAfterSessionLoss(saved);
            recovery.current.delete(user!);
            sn("已取回此分頁暫存的未同步修改，正在重新核對雲端版本。");
          }
          await current.init();
          if (cancelled) {
            current.close();
            return;
          }
          ss(current);
        } catch (e) {
          ser(`本機儲存無法啟用：${message(e)}，資料尚未儲存。`);
        }
        sl(false);
      } catch (e) {
        ser(`本機資料清理失敗，請保留此裝置並重試：${message(e)}`);
        sl(false);
      }
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [user, demo]);
  const records = store?.snapshot.records.filter((r) => !r.deleted) ?? [];
  const trips = records.filter((r) => r.kind === "trip") as Trip[];
  const visibleTrips = trips.filter((t) => t.archived === archived);
  const route = window.location.pathname.match(
    /^\/travel-planner\/trips\/([0-9a-f-]{36})\/day\/(\d{4}-\d{2}-\d{2})\/?$/,
  );
  const trip =
    visibleTrips.find((t) => t.id === (tripId ?? route?.[1])) ??
    visibleTrips[0];
  const places = records.filter(
    (r) => r.kind === "place" && r.tripId === trip?.id,
  ) as Place[];
  const items = records.filter(
    (r) => r.kind === "item" && r.tripId === trip?.id,
  ) as Item[];
  const tasks = records.filter(
    (r) => r.kind === "task" && r.tripId === trip?.id,
  ) as Task[];
  const dateList = trip ? days(trip) : [];
  const today = trip ? localToday(trip.timezone) : "";
  const activeDay = dateList.includes(day)
    ? day
    : route && trip && route[1] === trip.id && dateList.includes(route[2])
      ? route[2]
      : dateList.includes(today)
        ? today
        : (dateList[0] ?? "");
  useEffect(() => {
    if (trip && activeDay)
      window.history.replaceState(
        null,
        "",
        `/travel-planner/trips/${trip.id}/day/${activeDay}`,
      );
  }, [trip?.id, activeDay]);
  useEffect(() => {
    const pop = () => {
      const path = window.location.pathname.match(
        /^\/travel-planner\/trips\/([0-9a-f-]{36})\/day\/(\d{4}-\d{2}-\d{2})\/?$/,
      );
      st(path?.[1] ?? null);
      sy(path?.[2] ?? "");
      si(null);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const chooseTrip = (id: string) => {
    st(id);
    sy("");
    si(null);
    sr(null);
    sq("");
    sc("");
    sa("");
  };
  const pFor = (i: Item | undefined) =>
    i ? places.find((p) => p.id === i.placeId) : undefined;
  const edit = async (label: string, updates: RecordData[], undo = true) => {
    if (!store) throw new Error("資料尚未載入");
    await store.edit(label, updates, undo);
  };
  async function signOutNow() {
    const current = activeStore.current;
    if (current) await current.clear();
    activeStore.current = null; // explicit logout already chose how to handle pending work
    ss(null);
    await logout();
    su(null);
    slogout(false);
  }
  async function prepareLogout() {
    if (
      store &&
      (store.snapshot.pending.length || store.snapshot.conflicts.length)
    ) {
      slogout(true);
      return;
    }
    await signOutNow();
  }
  async function downloadTrip() {
    if (!trip || !store) return;
    if (!("serviceWorker" in navigator))
      throw new Error(
        "此瀏覽器不支援離線 app；資料已在本機儲存，可匯出 JSON 備份。",
      );
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("離線 app 尚未就緒，請保持連線後重試下載。")),
          10000,
        ),
      ),
    ]);
    await store.download(trip.id);
  }
  const selectItem = (i: Item) => {
    si(i.id);
    if (i.day) sy(i.day);
    if (i.status === "candidate") sb("candidates");
    else sb("today");
    setTimeout(
      () =>
        document
          .getElementById(`item-${i.id}`)
          ?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
      50,
    );
  };
  const maxOrder = (d: string | null) =>
    Math.max(
      -1,
      ...items
        .filter((i) => i.day === d && i.status !== "candidate")
        .map((i) => i.order),
    ) + 1;
  async function addName(name: string, d: string | null) {
    if (!trip || !name.trim() || !store) return;
    const parsed = parseMaps(name);
    const p = {
      ...blankPlace(
        store.owner,
        trip.id,
        safeUrl(name) ? parsed.name || "待命名地點" : name.trim(),
      ),
      ...parsed,
    };
    await edit("新增地點與安排", [
      p,
      blankItem(store.owner, trip, p.id, d, maxOrder(d)),
    ]);
    sn(d ? "已加入當日行程" : "已存成候選");
  }
  async function move(i: Item, d: string, index?: number) {
    const target = ordered(items, d).filter((x) => x.id !== i.id);
    const moved = { ...i, day: d, status: "planned" as const };
    target.splice(index ?? target.length, 0, moved);
    await edit(
      "移動／排序行程",
      target.map((x, n) => ({ ...x, order: n })),
    );
  }
  async function reorder(i: Item, delta: number) {
    if (!i.day) return;
    const list = ordered(items, i.day);
    const index = list.findIndex((x) => x.id === i.id);
    await move(i, i.day, Math.max(0, Math.min(list.length - 1, index + delta)));
  }
  async function deleteItem(i: Item) {
    const linked = records.filter(
      (r) => r.kind === "reminder" && r.targetId === i.id,
    );
    const linkedTasks = tasks
      .filter((t) => t.itemId === i.id)
      .map((t) => ({ ...t, itemId: null }));
    await edit("刪除安排", [
      { ...i, deleted: true },
      ...linked.map((r) => ({ ...r, deleted: true })),
      ...linkedTasks,
    ]);
  }
  async function replaceItem(candidate: Item, target: Item) {
    await edit("候選替換", [
      {
        ...candidate,
        day: target.day,
        order: target.order,
        status: "planned",
        timeMode: target.timeMode,
        time: target.time,
        period: target.period,
        departureZone: target.departureZone,
      },
      { ...target, status: "candidate" },
    ]);
    sr(null);
    sb("today");
    sy(target.day ?? activeDay);
    sn("已替換；原安排保留在候選清單，提醒仍跟隨原項目。");
  }
  async function duplicateTrip(t: Trip) {
    const own = records.filter(
      (r) => r.id === t.id || (r.kind !== "trip" && r.tripId === t.id),
    );
    const copies = remapImport(own, store!.owner).map((r) =>
      r.kind === "trip"
        ? { ...r, name: `${r.name} · 副本`, archived: false }
        : r,
    );
    await edit("複製旅程", copies);
    chooseTrip(copies.find((r) => r.kind === "trip")!.id);
  }
  async function saveTrip(t: Trip) {
    const outside = records.filter(
      (i) =>
        i.kind === "item" &&
        i.tripId === t.id &&
        i.day &&
        (i.day < t.start || i.day > t.end),
    );
    if (outside.length)
      throw new Error("新日期範圍會排除既有安排；請先移動這些項目。");
    await edit("儲存旅程", [t]);
    chooseTrip(t.id);
  }
  async function saveItem(i: Item, before: number | null) {
    validateSchedule(i);
    const updates: RecordData[] = [i];
    if (before !== null) {
      if (!i.day || !i.time || !["fixed", "flexible"].includes(i.timeMode))
        throw new Error("提醒需要可換算的日期與時間");
      updates.push({
        ...baseRecord(store!.owner),
        kind: "reminder",
        tripId: i.tripId,
        targetId: i.id,
        beforeMinutes: before,
        enabled: true,
      });
    }
    await edit("儲存安排", updates);
  }
  async function saveTask(t: Task, before: number) {
    validateSchedule(t);
    const reminders = records.filter(
      (r) => r.kind === "reminder" && r.targetId === t.id,
    );
    await edit("儲存待辦", [
      t,
      ...reminders.map((r) => ({ ...r, deleted: true })),
      ...(t.date && t.time
        ? [
            {
              ...baseRecord(store!.owner),
              kind: "reminder" as const,
              tripId: t.tripId,
              targetId: t.id,
              beforeMinutes: before,
              enabled: true,
            },
          ]
        : []),
    ]);
  }
  const newTask = () =>
    se({
      type: "task",
      value: {
        ...baseRecord(store!.owner),
        kind: "task",
        tripId: trip!.id,
        title: "",
        type: "準備",
        status: "待確認",
        date: null,
        time: null,
        timezone: trip!.timezone,
        itemId: null,
        url: "",
        notes: "",
      },
    });
  let reminderList: ReturnType<typeof dueReminders> = [];
  const reminderErrors: string[] = [];
  try {
    if (trip)
      reminderList = dueReminders(records, trip, Temporal.Now.instant(), (e) =>
        reminderErrors.push(message(e)),
      );
  } catch {
    /* invalid event reports on calendar export */
  }
  useEffect(() => {
    if (!trip) return;
    const tick = () => {
      try {
        for (const r of dueReminders(
          records,
          trip,
          Temporal.Now.instant(),
          () => {},
        )) {
          const key = `${r.event.id}:${r.at.toString()}`;
          const now = Temporal.Now.instant();
          if (
            Temporal.Instant.compare(now, r.at) >= 0 &&
            Temporal.Instant.compare(now, r.event.end) < 0 &&
            !ack.current.has(key)
          ) {
            ack.current.add(key);
            sn(`提醒：${r.event.title}（僅 app 開啟中）`);
          }
        }
      } catch {
        /* export exposes temporal validation */
      }
    };
    tick();
    const timer = setInterval(tick, 30000);
    return () => clearInterval(timer);
  }, [store?.snapshot, trip?.id]);
  async function exploreAI() {
    const currentUser = auth?.currentUser;
    if (!trip || !currentUser) return;
    await attempt(async () => {
      sbusy(true);
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch(import.meta.env.VITE_AI_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tripId: trip.id,
            query: aiQuery,
            area: city || trip.cities,
            category: aiCategory,
            budget,
            walkingRange: walk,
            childFriendly: child,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "探索服務暫時無法使用");
        sg(data.suggestions);
      } finally {
        sbusy(false);
      }
    });
  }
  async function saveSuggestion(s: Suggestion, d: string | null) {
    const p = {
      ...blankPlace(store!.owner, trip!.id, s.name),
      originalName: s.originalName,
      address: s.location,
      notes: `${s.reason}\n待確認：${s.pending.join("、")}`,
      url: s.sourceUrls[0] ?? "",
      source: `${s.sourceUrls.join(" ")}；查詢 ${s.checkedAt}`,
    };
    await edit("加入探索候選", [
      p,
      blankItem(store!.owner, trip!, p.id, d, maxOrder(d)),
    ]);
    sn("建議已儲存；尚未定位與查證");
  }
  const filteredCandidates = items
    .filter((i) => i.status === "candidate")
    .filter((i) => {
      const p = pFor(i);
      return (
        p &&
        (!city || p.city.includes(city)) &&
        (!area || p.area.includes(area)) &&
        (!category || p.category === category) &&
        [p.name, p.originalName, p.address, p.notes, p.city, p.area]
          .join(" ")
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase())
      );
    });
  const savedResults = search
    ? places.filter((p) =>
        [p.name, p.originalName, p.address, p.city, p.area]
          .join(" ")
          .toLocaleLowerCase()
          .includes(search.toLocaleLowerCase()),
      )
    : [];
  const shownDays = multi ? dateList : dateList.filter((d) => d === activeDay);
  const mapItems = (
    mapFilter === "all"
      ? items
      : mapFilter === "candidates"
        ? items.filter((i) => i.status === "candidate")
        : items.filter((i) => i.day === activeDay)
  ).sort(
    (a, b) => (a.day ?? "").localeCompare(b.day ?? "") || a.order - b.order,
  );
  const selectedItem = items.find((i) => i.id === selected),
    selectedPlace = selectedItem ? pFor(selectedItem) : undefined;
  const todayItems = ordered(items, activeDay).filter(
    (i) => i.status === "planned",
  );
  const next =
    today === activeDay && !trip?.demo
      ? todayItems.find((i) => {
          if (!i.time) return true;
          try {
            return (
              instant(i.day!, i.time, i.departureZone).add({
                minutes: i.duration,
              }).epochMilliseconds >= Date.now()
            );
          } catch {
            return false;
          }
        })
      : undefined;
  const cards = (i: Item, index: number, candidate = false) => {
    const p = pFor(i);
    if (!p) return null;
    return (
      <article
        id={`item-${i.id}`}
        key={i.id}
        className={`item ${selected === i.id ? "selected" : ""} ${i.status}`}
        draggable={!candidate}
        onDragStart={(e) => e.dataTransfer.setData("text/travel-item", i.id)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const moving = items.find(
            (x) => x.id === e.dataTransfer.getData("text/travel-item"),
          );
          if (moving && i.day) void attempt(() => move(moving, i.day!, index));
        }}
        aria-label={p.name}
      >
        <div className="item-top">
          <span className={`category cat-${categories.indexOf(p.category)}`}>
            {p.category}
          </span>
          <span>{candidate ? "候選" : itemTime(i)}</span>
          {i.status === "done" && <strong>完成</strong>}
          {i.status === "skipped" && <strong>跳過</strong>}
        </div>
        <button
          className="item-title"
          onClick={() => {
            si(i.id);
          }}
        >
          {!candidate && <span className="ordinal">{index + 1}</span>}
          {p.name}
        </button>
        {p.originalName && <p className="original">{p.originalName}</p>}
        <p className="small">
          {p.address || p.city || "地址待補充"} ·{" "}
          {p.lat === null ? "未定位" : "已定位"}
        </p>
        {i.notes && <p className="item-notes">{i.notes}</p>}
        <div className="item-actions">
          <button onClick={() => se({ type: "item", value: i })}>
            時間／備註
          </button>
          <button onClick={() => se({ type: "place", value: p })}>地點</button>
          <a href={mapsPlace(p)} target="_blank" rel="noreferrer">
            地圖 ↗
          </a>
        </div>
        <div className="item-actions">
          <label className="compact-label">
            {candidate ? "加入" : "移到"}
            <select
              aria-label={`${p.name}移到某日`}
              value=""
              onChange={(e) => {
                if (e.target.value)
                  void attempt(() =>
                    replace ? replaceItem(i, replace) : move(i, e.target.value),
                  );
              }}
            >
              <option value="">選擇日期</option>
              {dateList.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          {!candidate && (
            <>
              <button
                aria-label={`${p.name}上移`}
                onClick={() => void attempt(() => reorder(i, -1))}
              >
                ↑
              </button>
              <button
                aria-label={`${p.name}下移`}
                onClick={() => void attempt(() => reorder(i, 1))}
              >
                ↓
              </button>
            </>
          )}
        </div>
        {candidate ? (
          <>
            {replace && (
              <button
                className="primary full"
                onClick={() => void attempt(() => replaceItem(i, replace))}
              >
                替換「{pFor(replace)?.name}」
              </button>
            )}
          </>
        ) : (
          <details>
            <summary>調整安排</summary>
            <div className="actions">
              <button
                onClick={() =>
                  void attempt(() =>
                    edit("改成候選", [{ ...i, status: "candidate" }]),
                  )
                }
              >
                改為候選
              </button>
              <button
                onClick={() => {
                  sr(i);
                  sb("candidates");
                }}
              >
                用候選替換
              </button>
              <button
                onClick={() =>
                  void attempt(() =>
                    edit("標記完成", [{ ...i, status: "done" }]),
                  )
                }
              >
                完成
              </button>
              <button
                onClick={() =>
                  void attempt(() =>
                    edit("跳過安排", [{ ...i, status: "skipped" }]),
                  )
                }
              >
                跳過
              </button>
              <button
                onClick={() =>
                  void attempt(async () => {
                    const result = delayFlexible(
                      items.filter((x) => x.day === i.day),
                      i.order,
                    );
                    if (result.conflicts.length)
                      throw new Error(
                        result.conflicts
                          .map((c) =>
                            c.replace(
                              /([0-9a-f-]{36})/g,
                              (id) =>
                                pFor(items.find((x) => x.id === id)!)?.name ??
                                id,
                            ),
                          )
                          .join("；") + "。尚未套用延後。",
                      );
                    if (!result.updates.length) {
                      sn("後續沒有可延後的彈性時間");
                      return;
                    }
                    await edit("後續彈性行程延後 30 分鐘", result.updates);
                    sn("已延後 30 分鐘；固定預約不變");
                  })
                }
              >
                後續彈性延後 30 分
              </button>
            </div>
          </details>
        )}
        <button
          className="quiet danger"
          onClick={() =>
            void attempt(() => deleteItem(i), "已刪除安排；可復原")
          }
        >
          刪除安排
        </button>
        {!candidate && (
          <p className="transport">
            ↓ {i.transport} ·{" "}
            {i.travelMinutes === null
              ? "交通未估算"
              : `${i.travelMinutes} 分鐘（手動）`}
            {i.buffer ? ` · 緩衝 ${i.buffer} 分` : ""}
          </p>
        )}
      </article>
    );
  };
  return (
    <>
      <header className="app-header">
        <div>
          <p className="eyebrow">YSU TOOLS</p>
          <h1>Travel Planner</h1>
        </div>
        <div className="header-actions">
          <span className="sync" role="status">
            {store?.status ?? (loading ? "載入中" : "尚未登入")}
          </span>
          <button onClick={() => shelp(true)}>說明</button>
          {user && !demo ? (
            <button
              onClick={() =>
                void attempt(async () => {
                  await prepareLogout();
                }, "已登出並清除私人本機資料")
              }
            >
              登出
            </button>
          ) : configured ? (
            <button onClick={() => slo(true)}>私人登入</button>
          ) : (
            <span className="small">本機模式</span>
          )}
        </div>
      </header>
      <main>
        {recovery.current.size > 0 && (
          <div className="error banner" role="alert">
            登入狀態已變更。有未同步修改暫存在此分頁，請先不要重新整理或關閉；重新登入原帳號即可復原。其他帳號無法存取這份暫存。
            {user && recovery.current.has(user) && (
              <button
                onClick={() =>
                  download(
                    "travel-planner-session-recovery.json",
                    JSON.stringify(
                      {
                        schemaVersion: 1,
                        recovery: recovery.current.get(user),
                      },
                      null,
                      2,
                    ),
                    "application/json",
                  )
                }
              >
                下載原帳號復原備份
              </button>
            )}
          </div>
        )}
        {user && previewCloud && (
          <p className="notice">
            隔離試用環境 · 請使用合成測試資料；與正式旅程分開保存。
          </p>
        )}
        <datalist id="zones">
          {[
            "Asia/Tokyo",
            "America/Los_Angeles",
            "Pacific/Honolulu",
            "Asia/Taipei",
            "Europe/London",
            "America/New_York",
          ].map((z) => (
            <option key={z}>{z}</option>
          ))}
        </datalist>
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button onClick={() => sn("")} aria-label="關閉訊息">
              ✕
            </button>
          </div>
        )}
        {error && (
          <div role="alert" className="error banner">
            {error}
            <button onClick={() => ser("")}>關閉</button>
          </div>
        )}
        {store?.error && (
          <div className="error banner">
            {store.error}
            <button onClick={() => void store.flush()}>重試同步</button>
          </div>
        )}
        {store?.snapshot.conflicts.map((c) => (
          <section key={c.operation.id} className="conflict">
            <h2>同步衝突 · {c.operation.label}</h2>
            <p>
              其他裝置修改了同一項目。本機與遠端內容均保留；以下選擇會影響這批移動／排序／刪除。
            </p>
            <details>
              <summary>查看兩份內容</summary>
              <div className="fields">
                <pre>
                  {JSON.stringify(
                    c.operation.changes.map((x) => x.after),
                    null,
                    2,
                  )}
                </pre>
                <pre>{JSON.stringify(c.remote, null, 2)}</pre>
              </div>
            </details>
            <button
              onClick={() =>
                void attempt(() => store.resolve(c.operation.id, "remote"))
              }
            >
              使用遠端版本
            </button>
            <button
              onClick={() =>
                void attempt(() => store.resolve(c.operation.id, "local"))
              }
            >
              保留本機版本並重新同步
            </button>
            <button
              onClick={() =>
                download(
                  "travel-conflict.json",
                  JSON.stringify(c, null, 2),
                  "application/json",
                )
              }
            >
              下載兩份備份
            </button>
          </section>
        ))}
        {!store ? (
          <section className="empty">
            <h2>{loading ? "載入資料…" : "開始規劃私人旅程"}</h2>
            <p>登入後可同步自己的旅程；本機模式只保存在這個瀏覽器。</p>
            {!loading && (
              <>
                <button className="primary" onClick={() => sd(true)}>
                  使用本機模式
                </button>
                {configured && (
                  <button onClick={() => slo(true)}>登入同步</button>
                )}
              </>
            )}
          </section>
        ) : (
          <>
            <section className="trip-toolbar">
              <label>
                旅程
                <select
                  aria-label="選擇旅程"
                  value={trip?.id ?? ""}
                  onChange={(e) => chooseTrip(e.target.value)}
                >
                  {visibleTrips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="primary"
                onClick={() =>
                  se({ type: "trip", value: blankTrip(store.owner) })
                }
              >
                新增旅程
              </button>
              <button
                onClick={() =>
                  void attempt(
                    () => edit("載入合成示範", demos(store.owner)),
                    "已加入兩份合成示範",
                  )
                }
              >
                載入示範
              </button>
              <label className="check">
                <input
                  type="checkbox"
                  checked={archived}
                  onChange={(e) => {
                    sh(e.target.checked);
                    st(null);
                  }}
                />
                看封存
              </label>
            </section>
            {trip ? (
              <>
                <section className="trip-summary">
                  <div>
                    <h2>{trip.name}</h2>
                    <p>
                      {trip.start} — {trip.end} · {trip.cities || "城市待補充"}{" "}
                      · {trip.travelers} 位 · {trip.timezone}
                    </p>
                    {trip.demo && (
                      <p className="demo-label">
                        合成示範 · 不代表目前預約、營業或訂票資訊
                      </p>
                    )}
                  </div>
                  <details
                    className="trip-operations"
                    open={window.matchMedia("(min-width:701px)").matches}
                  >
                    <summary>旅程操作</summary>
                    <div className="actions">
                      <button onClick={() => se({ type: "trip", value: trip })}>
                        編輯旅程
                      </button>
                      <button
                        onClick={() => void attempt(() => duplicateTrip(trip))}
                      >
                        複製
                      </button>
                      <button
                        onClick={() =>
                          void attempt(() =>
                            edit("封存旅程", [
                              { ...trip, archived: !trip.archived },
                            ]),
                          )
                        }
                      >
                        {trip.archived ? "取消封存" : "封存"}
                      </button>
                      <button
                        disabled={!store.snapshot.undo}
                        onClick={() =>
                          void attempt(() => store.undo(), "已復原最近一次操作")
                        }
                      >
                        復原
                      </button>
                      <button
                        onClick={() =>
                          void attempt(
                            () => downloadTrip(),
                            "已下載行程、地址與備註；不含底圖",
                          )
                        }
                      >
                        {store.snapshot.downloaded.includes(trip.id)
                          ? "已下載離線"
                          : "下載行程"}
                      </button>
                      <details className="menu">
                        <summary>匯出／匯入</summary>
                        <div className="actions">
                          <button
                            onClick={() =>
                              download(
                                "travel-planner.json",
                                JSON.stringify(
                                  {
                                    schemaVersion: 1,
                                    exportedAt: new Date().toISOString(),
                                    records: records.filter(
                                      (r) =>
                                        r.id === trip.id ||
                                        (r.kind !== "trip" &&
                                          r.tripId === trip.id),
                                    ),
                                  },
                                  null,
                                  2,
                                ),
                                "application/json",
                              )
                            }
                          >
                            JSON 匯出
                          </button>
                          <button onClick={() => file.current?.click()}>
                            JSON 匯入
                          </button>
                          <button
                            onClick={() => {
                              try {
                                download(
                                  "travel-planner.ics",
                                  calendar(records, trip),
                                  "text/calendar",
                                );
                                sn(
                                  "日曆是快照，之後修改不會自動同步；通知依行事曆設定。",
                                );
                              } catch (e) {
                                ser(message(e));
                              }
                            }}
                          >
                            日曆 .ics
                          </button>
                          <button onClick={() => window.print()}>
                            列印／存 PDF
                          </button>
                        </div>
                      </details>
                    </div>
                  </details>
                </section>
                <input
                  hidden
                  ref={file}
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      void attempt(async () => {
                        if (f.size > 10_000_000)
                          throw new Error("檔案超過 10 MB");
                        simp(validateImport(JSON.parse(await f.text())));
                      });
                    e.target.value = "";
                  }}
                />
                <section className="date-toolbar">
                  <label>
                    旅行日期
                    <select
                      aria-label="旅行日期"
                      value={activeDay}
                      onChange={(e) => {
                        sy(e.target.value);
                        si(null);
                      }}
                    >
                      {dateList.map((d) => (
                        <option key={d}>
                          {d}
                          {d === today ? " · 今天" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() =>
                      sy(dateList.includes(today) ? today : dateList[0])
                    }
                  >
                    今天／起始日
                  </button>
                  <div className="desktop-only">
                    <button aria-pressed={!multi} onClick={() => sm(false)}>
                      只看當天
                    </button>
                    <button aria-pressed={multi} onClick={() => sm(true)}>
                      多日總覽
                    </button>
                  </div>
                  <button onClick={() => srem(true)}>提醒中心</button>
                  <button onClick={() => sx(true)}>探索地點</button>
                </section>
                {tab === "today" && (
                  <section className="next-stop">
                    <div>
                      <strong>
                        {next
                          ? "下一站"
                          : trip.demo
                            ? "示範日期行程"
                            : today === activeDay
                              ? "今天行程"
                              : "所選日期行程"}
                      </strong>
                      <span>
                        {next ? pFor(next)?.name : "依自己的步調調整安排"}
                      </span>
                    </div>
                    {next && pFor(next) && (
                      <a
                        className="primary"
                        target="_blank"
                        rel="noreferrer"
                        href={navigation(pFor(next)!)}
                      >
                        導航 ↗
                      </a>
                    )}
                  </section>
                )}
                <div
                  className="workspace"
                  style={{ "--map-size": `${ratio}%` } as React.CSSProperties}
                >
                  <section
                    className={`plan-panel ${tab !== "today" ? "mobile-hidden" : ""} ${tab === "candidates" || tab === "tasks" ? "desktop-hidden" : ""}`}
                  >
                    <div className="day-board">
                      {shownDays.map((d) => (
                        <section
                          key={d}
                          data-day={d}
                          className={`day-column ${d !== activeDay ? "mobile-hidden" : ""} ${d === activeDay ? "active-day" : ""}`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const moving = items.find(
                              (x) =>
                                x.id ===
                                e.dataTransfer.getData("text/travel-item"),
                            );
                            if (moving) void attempt(() => move(moving, d));
                          }}
                        >
                          <button className="day-heading" onClick={() => sy(d)}>
                            <strong>{d.slice(5)}</strong>
                            <span>
                              {new Intl.DateTimeFormat("zh-TW", {
                                weekday: "short",
                                timeZone: "UTC",
                              }).format(new Date(`${d}T12:00:00Z`))}
                            </span>
                            <span>{d === today ? "今天" : ""}</span>
                          </button>
                          <QuickAdd
                            onAdd={(name) => attempt(() => addName(name, d))}
                          />
                          {ordered(items, d).map((i, n) => cards(i, n))}
                          {!ordered(items, d).length && (
                            <p className="empty-day">
                              尚無行程。輸入名稱即可新增，也可拖入其他日的安排。
                            </p>
                          )}
                        </section>
                      ))}
                    </div>
                  </section>
                  {(tab === "today" || tab === "map") && (
                    <section
                      className={`map-panel ${tab !== "map" ? "mobile-hidden" : ""}`}
                    >
                      <div className="map-tools">
                        <label>
                          地圖範圍
                          <select
                            value={mapFilter}
                            onChange={(e) => sf(e.target.value)}
                          >
                            <option value="day">所選當日</option>
                            <option value="all">全旅程</option>
                            <option value="candidates">候選</option>
                          </select>
                        </label>
                        <label className="desktop-only">
                          面板比例
                          <input
                            type="range"
                            min="25"
                            max="65"
                            value={ratio}
                            onChange={(e) => sz(Number(e.target.value))}
                          />
                        </label>
                      </div>
                      <TravelMap
                        places={places}
                        items={mapItems}
                        selected={selected}
                        onSelect={selectItem}
                        pin={pin}
                        onPin={(id, lat, lng) => {
                          const p = places.find((p) => p.id === id);
                          if (p)
                            void attempt(async () => {
                              await edit("修正地圖位置", [{ ...p, lat, lng }]);
                              sp(null);
                              sn("地點位置已更新");
                            });
                        }}
                      />
                      {pin && (
                        <button onClick={() => sp(null)}>取消落點</button>
                      )}
                      {selectedPlace && selectedItem && (
                        <div className="map-detail">
                          <h3>{selectedPlace.name}</h3>
                          <p>{selectedPlace.address || "地址待補充"}</p>
                          <button
                            onClick={() =>
                              se({ type: "item", value: selectedItem })
                            }
                          >
                            編輯安排
                          </button>
                          <button
                            onClick={() =>
                              se({ type: "place", value: selectedPlace })
                            }
                          >
                            編輯位置
                          </button>
                          {(
                            [
                              ["walking", "步行"],
                              ["transit", "大眾運輸"],
                              ["driving", "開車"],
                            ] as const
                          ).map(([mode, label]) => (
                            <a
                              key={mode}
                              href={navigation(selectedPlace, mode)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {label}導航 ↗
                            </a>
                          ))}
                        </div>
                      )}
                    </section>
                  )}
                  {tab === "candidates" && (
                    <section className="list-panel">
                      <h2>
                        {replace
                          ? `替換「${pFor(replace)?.name}」`
                          : "候選與備案"}
                      </h2>
                      {replace && (
                        <button onClick={() => sr(null)}>取消替換</button>
                      )}
                      <QuickAdd
                        onAdd={(name) => attempt(() => addName(name, null))}
                      />
                      <div className="filters">
                        <label>
                          我的已存地點搜尋
                          <input
                            value={search}
                            onChange={(e) => sq(e.target.value)}
                            placeholder="名稱、地址、備註"
                          />
                        </label>
                        <label>
                          城市
                          <input
                            value={city}
                            onChange={(e) => sc(e.target.value)}
                          />
                        </label>
                        <label>
                          區域
                          <input
                            value={area}
                            onChange={(e) => sa(e.target.value)}
                          />
                        </label>
                        <label>
                          類別
                          <select
                            value={category}
                            onChange={(e) => sk(e.target.value)}
                          >
                            <option value="">全部</option>
                            {categories.map((c) => (
                              <option key={c}>{c}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <a
                        target="_blank"
                        rel="noreferrer"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([city || trip.cities, search].join(" "))}`}
                      >
                        外部 Google Maps 搜尋 ↗
                      </a>
                      <p className="hint">
                        外部結果請複製名稱／連結回來新增；沒有查證營業或交通時間。
                      </p>
                      {savedResults.length > 0 && (
                        <details>
                          <summary>所有已存地點結果（可重複安排）</summary>
                          {savedResults.map((p) => (
                            <div className="saved-result" key={p.id}>
                              <strong>{p.name}</strong>
                              <button
                                onClick={() =>
                                  void attempt(() =>
                                    edit("再次安排已存地點", [
                                      blankItem(
                                        store.owner,
                                        trip,
                                        p.id,
                                        activeDay,
                                        maxOrder(activeDay),
                                      ),
                                    ]),
                                  )
                                }
                              >
                                加入 {activeDay.slice(5)}
                              </button>
                              <button
                                onClick={() =>
                                  void attempt(() =>
                                    edit("再次加入候選", [
                                      blankItem(store.owner, trip, p.id, null),
                                    ]),
                                  )
                                }
                              >
                                存成候選
                              </button>
                            </div>
                          ))}
                        </details>
                      )}
                      <div className="candidate-grid">
                        {filteredCandidates.map((i, n) => cards(i, n, true))}
                      </div>
                      {!filteredCandidates.length && (
                        <p>沒有符合的候選地點。先用名稱新增，稍後補位置。</p>
                      )}
                    </section>
                  )}
                  {tab === "tasks" && (
                    <section className="list-panel">
                      <div className="section-heading">
                        <h2>行前待辦與預約</h2>
                        <button className="primary" onClick={newTask}>
                          新增待辦
                        </button>
                      </div>
                      <p className="hint">
                        固定活動、出發提醒屬旅途中；訂票、付款、準備事項屬行前。未查交通時，不判斷必須何時出發。
                      </p>
                      {tasks.map((t) => {
                        let late = false,
                          soon = false;
                        try {
                          if (t.date && t.time) {
                            const ms =
                              instant(t.date, t.time, t.timezone)
                                .epochMilliseconds - Date.now();
                            late = ms < 0 && t.status !== "完成";
                            soon =
                              ms >= 0 &&
                              ms <= 7 * 86400000 &&
                              t.status !== "完成";
                          }
                        } catch {}
                        return (
                          <article className="task" key={t.id}>
                            <div>
                              <span className="category">{t.type}</span>
                              <strong>{t.title}</strong>
                              <span
                                className={
                                  late ? "error" : soon ? "warning" : ""
                                }
                              >
                                {late ? "逾期" : soon ? "即將到期" : t.status}
                              </span>
                            </div>
                            <p>{taskTime(t)}</p>
                            {t.date && t.time && (
                              <p className="small">
                                San Francisco：
                                {otherZone(
                                  t.date,
                                  t.time,
                                  t.timezone,
                                  "America/Los_Angeles",
                                )}
                                <br />
                                Honolulu：
                                {otherZone(
                                  t.date,
                                  t.time,
                                  t.timezone,
                                  "Pacific/Honolulu",
                                )}
                              </p>
                            )}
                            <p>{t.notes}</p>
                            {t.itemId && (
                              <p>
                                連結：
                                {pFor(items.find((i) => i.id === t.itemId)!)
                                  ?.name ?? "安排已刪除"}
                              </p>
                            )}
                            <div className="actions">
                              <button
                                onClick={() => se({ type: "task", value: t })}
                              >
                                編輯
                              </button>
                              <button
                                onClick={() =>
                                  void attempt(() =>
                                    edit("完成待辦", [
                                      {
                                        ...t,
                                        status:
                                          t.status === "完成"
                                            ? "待確認"
                                            : "完成",
                                      },
                                    ]),
                                  )
                                }
                              >
                                {t.status === "完成" ? "恢復待確認" : "完成"}
                              </button>
                              {safeUrl(t.url) && (
                                <a
                                  href={safeUrl(t.url)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  來源 ↗
                                </a>
                              )}
                              <button
                                onClick={() =>
                                  void attempt(() =>
                                    edit("刪除待辦", [
                                      { ...t, deleted: true },
                                      ...records
                                        .filter(
                                          (r) =>
                                            r.kind === "reminder" &&
                                            r.targetId === t.id,
                                        )
                                        .map((r) => ({ ...r, deleted: true })),
                                    ]),
                                  )
                                }
                              >
                                刪除
                              </button>
                            </div>
                          </article>
                        );
                      })}
                      {!tasks.length && (
                        <p>尚無待辦；可獨立新增，也可連結安排。</p>
                      )}
                    </section>
                  )}
                </div>
                <nav className="bottom-nav" aria-label="主要導覽">
                  {(
                    [
                      ["today", "今天"],
                      ["map", "地圖"],
                      ["candidates", "候選"],
                      ["tasks", "待辦"],
                    ] as [Tab, string][]
                  ).map(([t, label]) => (
                    <button
                      key={t}
                      aria-current={tab === t ? "page" : undefined}
                      onClick={() => sb(t)}
                    >
                      {label}
                      {t === "candidates"
                        ? ` (${items.filter((i) => i.status === "candidate").length})`
                        : ""}
                    </button>
                  ))}
                </nav>
                <section className="print-only">
                  <h2>{trip.name} · 列印行程</h2>
                  {dateList.map((d) => (
                    <section key={d}>
                      <h3>{d}</h3>
                      {ordered(items, d).map((i, n) => (
                        <p key={i.id}>
                          {n + 1}. {pFor(i)?.name}／{pFor(i)?.originalName} ·{" "}
                          {itemTime(i)} · {pFor(i)?.address}
                          <br />
                          {i.notes} {pFor(i)?.notes}
                          <br />
                          交通：
                          {i.travelMinutes === null
                            ? "未估算"
                            : `${i.travelMinutes} 分鐘（手動）`}
                        </p>
                      ))}
                    </section>
                  ))}
                  <h3>候選</h3>
                  {items
                    .filter((i) => i.status === "candidate")
                    .map((i) => (
                      <p key={i.id}>
                        {pFor(i)?.name} · {pFor(i)?.address}
                      </p>
                    ))}
                  <h3>待辦</h3>
                  {tasks.map((t) => (
                    <p key={t.id}>
                      {t.title} · {t.status} · {taskTime(t)}
                    </p>
                  ))}
                </section>
              </>
            ) : (
              <section className="empty">
                <h2>從空白旅程開始</h2>
                <p>新增旅程，或載入兩份合成示範看看多日行程、候選和待辦。</p>
              </section>
            )}
          </>
        )}
      </main>
      {editor?.type === "trip" && (
        <TripForm
          trip={editor.value}
          onClose={() => se(null)}
          onSave={saveTrip}
        />
      )}
      {editor?.type === "place" && (
        <PlaceForm
          place={editor.value}
          onClose={() => se(null)}
          onSave={(p) => edit("儲存地點", [p])}
          onPin={() => {
            sp(editor.value.id);
            se(null);
            sb("map");
            sf("all");
            sn("點一下地圖設定這個地點的位置");
          }}
        />
      )}
      {editor?.type === "item" && trip && pFor(editor.value) && (
        <ItemForm
          item={editor.value}
          trip={trip}
          place={pFor(editor.value)!}
          onClose={() => se(null)}
          onSave={saveItem}
        />
      )}
      {editor?.type === "task" && (
        <TaskForm
          task={editor.value}
          items={items}
          places={places}
          onClose={() => se(null)}
          onSave={saveTask}
        />
      )}
      {imported && (
        <Modal title="匯入預覽" onClose={() => simp(null)}>
          <p>
            {imported.filter((r) => r.kind === "trip").length} 個旅程、
            {imported.filter((r) => r.kind === "place").length} 個地點、
            {imported.filter((r) => r.kind === "item").length} 次安排。
          </p>
          <p>會建立新的 ID 與旅程副本，不覆寫現有資料。</p>
          <button
            className="primary"
            onClick={() =>
              void attempt(async () => {
                const data = remapImport(imported, store!.owner);
                if (data.length > 450)
                  throw new Error("一次匯入最多 450 筆，請按旅程分開匯入");
                await edit("匯入旅程副本", data);
                simp(null);
                chooseTrip(data.find((r) => r.kind === "trip")!.id);
              }, "已匯入新旅程")
            }
          >
            匯入為新旅程
          </button>
        </Modal>
      )}
      {reminders && trip && (
        <Modal title="提醒中心" onClose={() => srem(false)}>
          <p>
            App 開啟中會顯示提醒。背景推播尚未啟用：缺少已授權的排程／推播後端。
          </p>
          <p>日曆匯入是快照，後續修改不自動同步；實際通知依你的行事曆設定。</p>
          <button
            onClick={() => {
              try {
                download(
                  "travel-planner.ics",
                  calendar(records, trip),
                  "text/calendar",
                );
              } catch (e) {
                ser(message(e));
              }
            }}
          >
            匯出日曆與 VALARM
          </button>
          {reminderErrors.length > 0 && (
            <p role="alert">
              部分提醒時間無效，請修正對應行程或待辦：
              {reminderErrors.join("；")}
            </p>
          )}
          {reminderList.map((r, n) => (
            <article className="task" key={`${r.event.id}-${n}`}>
              <strong>{r.event.title}</strong>
              <p>
                {r.at
                  .toZonedDateTimeISO(trip.timezone)
                  .toLocaleString("zh-TW", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}{" "}
                ·{" "}
                {r.overdue
                  ? "逾期"
                  : r.at.epochMilliseconds - Date.now() < 7 * 86400000
                    ? "即將提醒"
                    : "已排提醒"}
              </p>
            </article>
          ))}
          <h3>管理提醒</h3>
          {records
            .filter((r) => r.kind === "reminder" && r.tripId === trip.id)
            .map(
              (r) =>
                r.kind === "reminder" && (
                  <div className="saved-result" key={r.id}>
                    <span>
                      {tasks.find((t) => t.id === r.targetId)?.title ??
                        pFor(items.find((i) => i.id === r.targetId)!)?.name ??
                        "原安排"}{" "}
                      · 提前 {r.beforeMinutes} 分鐘
                    </span>
                    <button
                      onClick={() =>
                        void attempt(() =>
                          edit("切換提醒", [{ ...r, enabled: !r.enabled }]),
                        )
                      }
                    >
                      {r.enabled ? "停用" : "啟用"}
                    </button>
                    <button
                      onClick={() =>
                        void attempt(() =>
                          edit("刪除提醒", [{ ...r, deleted: true }]),
                        )
                      }
                    >
                      刪除
                    </button>
                  </div>
                ),
            )}
        </Modal>
      )}
      {explore && trip && (
        <Modal title="探索地點" onClose={() => sx(false)} wide>
          <label>
            想找什麼？
            <textarea
              value={aiQuery}
              onChange={(e) => saq(e.target.value)}
              placeholder="例如：淺草附近適合帶小孩的午餐"
            />
          </label>
          <div className="fields">
            <label>
              地區
              <input
                value={city}
                onChange={(e) => sc(e.target.value)}
                placeholder={trip.cities}
              />
            </label>
            <label>
              類別
              <input
                value={aiCategory}
                onChange={(e) => sac(e.target.value)}
                placeholder="美食、建築、雨天活動"
              />
            </label>
            <label>
              預算
              <input value={budget} onChange={(e) => sbudget(e.target.value)} />
            </label>
            <label>
              步行範圍
              <input
                value={walk}
                onChange={(e) => swalk(e.target.value)}
                placeholder="使用者偏好，非交通估算"
              />
            </label>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={child}
              onChange={(e) => schild(e.target.checked)}
            />
            親子需求
          </label>
          <a
            target="_blank"
            rel="noreferrer"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([city || trip.cities, aiQuery, aiCategory].join(" "))}`}
          >
            普通 Maps 搜尋 ↗
          </a>
          <p className="hint">
            AI{" "}
            {!import.meta.env.VITE_AI_ENDPOINT
              ? "尚未啟用：未設定已授權的服務。"
              : demo
                ? "需要私人登入。"
                : "使用已設定的探索服務。"}
            不會自行修改行程或訂票訂位。
          </p>
          <button
            className="primary"
            disabled={
              aiBusy ||
              !import.meta.env.VITE_AI_ENDPOINT ||
              demo ||
              !user ||
              !aiQuery.trim()
            }
            onClick={() => void exploreAI()}
          >
            {aiBusy ? "查詢中…" : "AI 探索"}
          </button>
          {suggestions.map((s, n) => (
            <article className="task" key={n}>
              <h3>
                {s.name} · {s.originalName}
              </h3>
              <p>{s.location} · 尚未定位</p>
              <p>{s.reason}</p>
              <p>待確認：{s.pending.join("、")}</p>
              <p>查詢：{s.checkedAt}</p>
              {s.sourceUrls.filter(safeUrl).map((url) => (
                <p key={url}>
                  <a target="_blank" rel="noreferrer" href={safeUrl(url)}>
                    來源 ↗
                  </a>
                </p>
              ))}
              <button
                onClick={() => void attempt(() => saveSuggestion(s, null))}
              >
                存成候選
              </button>
              <button
                onClick={() => void attempt(() => saveSuggestion(s, activeDay))}
              >
                加入 {activeDay.slice(5)}
              </button>
            </article>
          ))}
        </Modal>
      )}
      {help && (
        <Modal title="使用與安裝說明" onClose={() => shelp(false)}>
          <p>
            桌機以多日並排規劃；手機從「今天」看所選日期，底部切換地圖、候選、待辦。
          </p>
          <p>
            只需地點名稱即可保存。拖曳跨日，也可用「移到」和上下移。刪除／替換／移動後可按「復原」。
          </p>
          <p>
            本機模式只保存於這個瀏覽器，不具跨裝置同步。登入同步需獨立 Firebase
            設定與 owner rules；此版本未使用 Supabase。
          </p>
          <p>
            下載行程後可離線讀寫地址、備註與安排；地圖底圖不下載。同步衝突先保存兩份，再由你選擇；登出清除私人本機資料。
          </p>
          <p>
            Android／桌機：瀏覽器選單 → 安裝應用程式。iPhone：Safari 分享 →
            加入主畫面。實體 iPhone 安裝與鎖屏推播尚未驗證。
          </p>
          <p>
            背景推播尚未啟用，App 提醒只在開啟中顯示。請使用 .ics
            行事曆提醒；匯入是快照。
          </p>
          <a
            target="_blank"
            rel="noreferrer"
            href="https://www.openstreetmap.org/fixthemap"
          >
            回報底圖問題 ↗
          </a>
        </Modal>
      )}
      {logoutOpen && store && (
        <Modal title="還有未同步資料" onClose={() => slogout(false)}>
          <p>
            尚有 {store.snapshot.pending.length} 筆操作與{" "}
            {store.snapshot.conflicts.length}{" "}
            組衝突。登出會清理此帳號的私人本機資料；請先備份或完成同步。
          </p>
          <button
            onClick={() =>
              download(
                "travel-planner-recovery.json",
                JSON.stringify(
                  {
                    schemaVersion: 1,
                    exportedAt: new Date().toISOString(),
                    records: store.snapshot.records,
                    recovery: {
                      pending: store.snapshot.pending,
                      conflicts: store.snapshot.conflicts,
                    },
                  },
                  null,
                  2,
                ),
                "application/json",
              )
            }
          >
            匯出完整復原備份
          </button>
          <button
            onClick={() =>
              void attempt(async () => {
                await store.flush();
                if (
                  !store.snapshot.pending.length &&
                  !store.snapshot.conflicts.length
                )
                  await signOutNow();
                else
                  throw new Error("資料尚未同步完成，請處理衝突或保留此裝置。");
              })
            }
          >
            重試同步並登出
          </button>
          <button onClick={() => void attempt(signOutNow)}>
            捨棄此裝置未同步修改並登出
          </button>
          <button onClick={() => slogout(false)}>繼續保留</button>
        </Modal>
      )}
      {loginOpen && (
        <Modal title="私人登入" onClose={() => slo(false)}>
          <p>
            {configured
              ? "登入只存取自己的 Travel Planner namespace；不會修改兄弟工具。"
              : "Firebase 尚未設定，目前可使用完整本機模式。"}
          </p>
          {emulator && (
            <>
              <label>
                Emulator 測試 Email
                <input value={email} onChange={(e) => sem(e.target.value)} />
              </label>
              <label>
                Emulator 測試密碼
                <input
                  type="password"
                  value={password}
                  onChange={(e) => spw(e.target.value)}
                />
              </label>
            </>
          )}
          <button
            disabled={!configured}
            className="primary"
            onClick={() =>
              void attempt(async () => {
                await login(email, password);
                spw("");
                slo(false);
                sd(false);
              })
            }
          >
            {emulator ? "測試登入" : "Google 登入"}
          </button>
          <button
            onClick={() => {
              sd(true);
              slo(false);
            }}
          >
            使用本機模式
          </button>
        </Modal>
      )}
    </>
  );
}
function QuickAdd({ onAdd }: { onAdd: (name: string) => Promise<unknown> }) {
  const [name, sn] = useState(""),
    [busy, sb] = useState(false);
  return (
    <form
      className="quick-add"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        sb(true);
        try {
          await onAdd(name);
          sn("");
        } finally {
          sb(false);
        }
      }}
    >
      <input
        aria-label="新增地點名稱或 Maps URL"
        value={name}
        onChange={(e) => sn(e.target.value)}
        placeholder="地點名稱或 Maps URL"
      />
      <button aria-label="新增地點" disabled={busy || !name.trim()}>
        {busy ? "…" : "＋"}
      </button>
    </form>
  );
}
