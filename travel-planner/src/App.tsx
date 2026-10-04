import { useEffect, useRef, useState } from "react";
import { ZodError } from "zod";
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
  dayCity,
  localToday,
  ordered,
  parseMaps,
  safeUrl,
  mapsPlace,
  navigation,
  delayFlexible,
  overlaps,
  shrinkTripPlan,
  effectiveItem,
  otherZone,
  instant,
  validateImport,
  validateSchedule,
  remapImport,
  extendImportedTrips,
  categories,
} from "./model";
import type { RecordData, Trip, Place, Item, Task } from "./model";
import { calendar, dueReminders, fixedZoneNotice, itemTime, taskTime } from "./calendar";
import { demos } from "./demo";
import { Modal, TripForm, PlaceForm, ItemForm, TaskForm } from "./Forms";
import type { ReminderDraft } from "./Forms";
import { TravelMap } from "./Map";
import { PlaceSearch } from "./PlaceSearch";
import { ImportFlow } from "./ImportFlow";
import { TravelerAssistant } from "./TravelerAssistant";
import { TripBackground } from "./TripBackground";
import { assistantActionAlreadyApplied, assistantDraftIds, assistantItemId, assertAssistantDraftTrip, assertAssistantMutationAllowed } from "./assistant-actions";
import type { AssistantAction } from "./server/gemini";
import { fillPlaceFromPhoton, searchPhoton } from "./place-search";
import type { PhotonPlace } from "./place-search";
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
  if (e instanceof ZodError) {
    const field: Record<string, string> = { name: "名稱", title: "事項", day: "日期", beforeMinutes: "提前提醒" };
    return e.issues.map((issue) => `${field[String(issue.path[0])] ?? "欄位"}格式或長度不正確，請修改後重試。`).join(" ");
  }
  return e instanceof Error ? e.message : String(e);
}
const timezoneChoices = (() => {
  try { return ["UTC", ...Intl.supportedValuesOf("timeZone")]; }
  catch { return ["UTC", "Asia/Tokyo", "Pacific/Honolulu", "America/Los_Angeles"]; }
})();
export default function App() {
  const localModeKey = "ysu-travel-planner-local-mode-v1";
  const resumeLocalMode = () => {
    try { return sessionStorage.getItem(localModeKey) === "1"; } catch { return false; }
  };
  const [user, su] = useState<string | null>(null),
    [demo, sd] = useState(!configured || resumeLocalMode()),
    [store, ss] = useState<PlannerStore | null>(null),
    [loading, sl] = useState(true),
    [, redraw] = useState(0),
    [tripId, st] = useState<string | null>(null),
    [day, sy] = useState(""),
    [tab, sb] = useState<Tab>("today"),
    [multi, sm] = useState(true),
    [viewMode, sview] = useState<"view" | "edit">("view"),
    [mapVisible, smapVisible] = useState(() => {
      try { return localStorage.getItem("travel-planner-map-visible") !== "false"; }
      catch { return true; }
    }),
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
    [importFlow, sif] = useState(false),
    [reminders, srem] = useState(false),
    [explore, sx] = useState(false),
    [assistantOpen, sas] = useState(false),
    [assistantChoice, sacChoice] = useState<{ action: AssistantAction; requestId: string; places: PhotonPlace[] } | null>(null),
    [help, shelp] = useState(false),
    [loginOpen, slo] = useState(false),
    [loginError, sle] = useState(""),
    [recoveryDays, srecoveryDays] = useState<Record<string, string>>({}),
    [loginBusy, slb] = useState(false),
    [logoutOpen, slogout] = useState(false),
    [localExitOpen, sexit] = useState(false),
    [email, sem] = useState(""),
    [password, spw] = useState(""),
    [aiQuery, saq] = useState(""),
    [aiArea, saai] = useState(""),
    [aiAreaEdited, saaiEdited] = useState(false),
    [aiCategory, sac] = useState(""),
    [budget, sbudget] = useState(""),
    [walk, swalk] = useState(""),
    [child, schild] = useState(false),
    [suggestions, sg] = useState<Suggestion[]>([]),
    [aiBusy, sbusy] = useState(false);
  const file = useRef<HTMLInputElement>(null),
    activeStore = useRef<PlannerStore | null>(null),
    recovery = useRef(new Map<string, Snapshot>()),
    ack = useRef(new Set<string>()),
    assistantDone = useRef(new Map<string, number>());
  const attempt = async (fn: () => Promise<unknown>, success?: string): Promise<boolean> => {
    ser("");
    try {
      await fn();
      if (success) sn(success);
      return true;
    } catch (e) {
      ser(message(e));
      return false;
    }
  };
  const enterLocalMode = () => {
    try { sessionStorage.setItem(localModeKey, "1"); } catch { /* usable until this page closes */ }
    sd(true);
    sle("");
    slo(false);
  };
  useEffect(
    () =>
      watchAuth((id) => {
        su(id);
        if (id) {
          try { sessionStorage.removeItem(localModeKey); } catch { /* storage unavailable */ }
          sd(false);
        }
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
  const rawItems = records.filter(
    (r) => r.kind === "item" && r.tripId === trip?.id,
  ) as Item[];
  const items = trip ? rawItems.map((item) => effectiveItem(trip, item)) : rawItems;
  const projectedRecords = trip ? records.map((record) => record.kind === "item" && record.tripId === trip.id
    ? effectiveItem(trip, record) : record) : records;
  const tasks = records.filter(
    (r) => r.kind === "task" && r.tripId === trip?.id,
  ) as Task[];
  const dateList = trip ? days(trip) : [];
  const overlapByItem = overlaps(items);
  const outsideItems = trip
    ? rawItems.filter((i) => i.day && (i.day < trip.start || i.day > trip.end) && !(trip.detachedItemIds ?? []).includes(i.id))
    : [];
  const today = trip ? (dateList.find((date) => localToday(dayCity(trip, date).timezone) === date) ?? "") : "";
  const activeDay = dateList.includes(day)
    ? day
    : route && trip && route[1] === trip.id && dateList.includes(route[2])
      ? route[2]
      : dateList.includes(today)
        ? today
        : (dateList[0] ?? "");
  useEffect(() => { saaiEdited(false); saai(""); }, [trip?.id]);
  useEffect(() => {
    if (!aiAreaEdited && trip) saai(dayCity(trip, activeDay).name || trip.cities);
  }, [trip?.id, trip?.dayCities, trip?.cities, activeDay, aiAreaEdited]);
  useEffect(() => {
    try { localStorage.setItem("travel-planner-map-visible", String(mapVisible)); }
    catch { /* storage may be unavailable */ }
  }, [mapVisible]);
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
    try { sessionStorage.removeItem(localModeKey); } catch { /* storage unavailable */ }
    activeStore.current = null; // explicit logout already chose how to handle pending work
    ss(null);
    await logout();
    su(null);
    if (demo) sd(false);
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
  async function addLocated(found: PhotonPlace, d: string | null) {
    if (!trip || !store) throw new Error("請先選擇旅程");
    const place = fillPlaceFromPhoton(blankPlace(store.owner, trip.id, found.name), found);
    await edit("搜尋地點並安排", [place, blankItem(store.owner, trip, place.id, d, maxOrder(d))]);
    sn(d ? `已將 ${found.name} 加入 ${d}；地圖已同步。` : `已將 ${found.name} 加入候選。`);
  }
  async function move(i: Item, d: string, index?: number) {
    if (d === i.day && index === undefined && i.status !== "candidate") {
      sn("這項安排已在所選日期。");
      return;
    }
    const target = ordered(items, d).filter((x) => x.id !== i.id);
    const moved = { ...i, day: d, status: i.status === "candidate" ? "planned" as const : i.status };
    target.splice(index ?? target.length, 0, moved);
    await edit(
      "移動／排序行程",
      target.map((x, n) => ({ ...x, order: n })),
    );
    if (d !== i.day) sy(d);
    sn(d !== i.day ? `已移到 ${d}；可復原。` : "排序已更新；可復原。");
  }
  async function delayAfter(i: Item) {
    const result = delayFlexible(items.filter((x) => x.day === i.day), i.order);
    if (result.conflicts.length)
      throw new Error(result.conflicts.map((conflict) => conflict.replace(/([0-9a-f-]{36})/g,
        (id) => pFor(items.find((row) => row.id === id)!)?.name ?? id)).join("；") + "。尚未套用延後。");
    if (!result.updates.length) { sn("後續沒有可延後的彈性時間"); return; }
    await edit("後續彈性行程延後 30 分鐘", result.updates);
    sn("已延後 30 分鐘；固定預約不變");
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
    if (copies.length > 450)
      throw new Error(`此旅程有 ${copies.length} 筆資料，超過一次安全複製上限 450 筆；原旅程未變更。可先匯出 JSON 備份。`);
    await edit("複製旅程", copies);
    chooseTrip(copies.find((r) => r.kind === "trip")!.id);
  }
  async function saveTrip(t: Trip) {
    const previous = records.find((record) => record.id === t.id);
    if (previous?.kind === "trip" && (t.start > previous.start || t.end < previous.end) && !store?.isRemoteReady())
      throw new Error("請等雲端旅程載入完成後再縮短日期；草稿與既有安排仍保留。");
    const planned = previous?.kind === "trip" ? shrinkTripPlan(previous, t, rawItems)
      : { trip: { ...t, backgroundRequested: true }, items: [], affected: 0 };
    await edit("儲存旅程與待定安排", [planned.trip, ...planned.items]);
    chooseTrip(t.id);
    sn(planned.affected ? `已更新日期；${planned.affected} 項安排移入待定。原預約與截止提醒未更改，請確認是否改期；可復原。` : "旅程日期與城市已更新。");
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
  async function saveTask(t: Task, drafts: ReminderDraft[], baseline: Extract<RecordData, { kind: "reminder" }>[]) {
    validateSchedule(t);
    const existing = records.filter(
      (r) => r.kind === "reminder" && r.targetId === t.id,
    ) as Extract<RecordData, { kind: "reminder" }>[];
    const changes: RecordData[] = [];
    for (const base of baseline) {
      const draft = drafts.find((d) => d.id === base.id);
      const changed = !draft || draft.beforeMinutes !== base.beforeMinutes || draft.enabled !== base.enabled;
      if (!changed) continue;
      const current = existing.find((r) => r.id === base.id);
      if (!current || current.revision !== base.revision)
        throw new Error("提醒已在其他分頁或裝置變更；待辦草稿仍保留，請重新開啟後再修改提醒。");
      changes.push(draft
        ? { ...current, beforeMinutes: draft.beforeMinutes, enabled: draft.enabled }
        : { ...current, deleted: true });
    }
    for (const draft of drafts.filter((d) => d.id === null))
      changes.push({
        ...baseRecord(store!.owner),
        kind: "reminder",
        tripId: t.tripId,
        targetId: t.id,
        beforeMinutes: draft.beforeMinutes,
        enabled: draft.enabled,
      });
    const removed = new Set(changes.filter((r) => r.kind === "reminder" && r.deleted).map((r) => r.id));
    if ((!t.date || !t.time) &&
      (existing.some((r) => !r.deleted && !removed.has(r.id)) ||
        changes.some((r) => r.kind === "reminder" && !r.deleted)))
      throw new Error("此待辦仍有提醒；請重新開啟確認，或明確刪除所有提醒後再移除日期與時間。");
    await edit("儲存待辦", [t, ...changes]);
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
      reminderList = dueReminders(projectedRecords, trip, Temporal.Now.instant(), (e) =>
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
          projectedRecords,
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
        const response = await fetch(import.meta.env.VITE_AI_ENDPOINT || "/travel-planner/api/ai", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            mode: "explore",
            requestId: crypto.randomUUID(),
            tripId: trip.id,
            query: aiQuery,
            selectedDay: activeDay,
            city: aiArea || currentCity?.name || trip.cities,
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
  const actionFingerprint = (action: AssistantAction) => JSON.stringify({ trip: trip?.id, kind: action.kind,
    name: action.name?.trim().toLocaleLowerCase(), itemId: action.itemId, day: action.day, time: action.time, period: action.period });
  async function applyAssistantPlace(found: PhotonPlace, action: AssistantAction, requestId: string) {
    if (!trip || !store) throw new Error("請先選擇旅程");
    const fingerprint = actionFingerprint(action);
    const stableId = await assistantItemId(fingerprint, found.lat, found.lng);
    if (records.some((record) => record.id === stableId))
      return "這筆旅伴指令先前已處理，未重複新增；如需再次安排可手動新增。";
    if ((assistantDone.current.get(fingerprint) ?? 0) > Date.now() - 120000)
      return "這筆指令剛執行過，未重複新增；可使用復原。";
    const targetDay = action.day ?? null;
    if (targetDay && !dateList.includes(targetDay)) throw new Error("指令日期不在旅程內；請先確認日期");
    if (items.some((existing) => existing.day === targetDay && existing.time === (action.time ?? null) &&
      pFor(existing)?.lat === found.lat && pFor(existing)?.lng === found.lng))
      return "這個地點與時刻已在行程中，未重複新增。";
    const place = fillPlaceFromPhoton(blankPlace(store.owner, trip.id, found.name), found);
    const item = { ...blankItem(store.owner, trip, place.id, targetDay, maxOrder(targetDay)), id: stableId,
      ...(action.time ? { timeMode: "flexible" as const, time: action.time } : {}),
      ...(action.period ? { period: action.period } : {}),
      departureZone: targetDay ? dayCity(trip, targetDay).timezone : trip.timezone };
    await edit(`旅伴新增 ${requestId}`, [place, item]);
    assistantDone.current.set(fingerprint, Date.now());
    sacChoice(null); if (targetDay) sy(targetDay);
    si(item.id);
    sn(`旅伴已加入 ${targetDay ?? "待定"}：${found.name}；可復原。`);
    return `已加入 ${targetDay ?? "待定"}：${found.name}。地點來自 ${found.source.split(" · ")[0]}；時間是可調整安排，並非已訂位。`;
  }
  async function executeAssistant(action: AssistantAction, requestId: string): Promise<string> {
    if (!trip || !store) throw new Error("請先選擇旅程");
    if (["clarify", "draft", "suggest"].includes(action.kind)) return action.message;
    if (action.kind === "add") {
      if (!action.name?.trim()) throw new Error("尚未取得清楚地點名稱，請補充一個名稱");
      const found = await searchPhoton(action.name, dayCity(trip, action.day ?? activeDay).name);
      const exact = found.filter((place) => place.name.toLocaleLowerCase() === action.name!.trim().toLocaleLowerCase());
      if (exact.length === 1) return applyAssistantPlace(exact[0], action, requestId);
      if (!found.length) throw new Error("找不到可核對的位置，請用地點搜尋手動選擇；指令與行程未變更");
      sacChoice({ action, requestId, places: found });
      return "找到多個可能地點。請選擇正確位置後才會加入；原行程尚未變更。";
    }
    if (action.kind === "undo") {
      if (!store.snapshot.undo) return "目前沒有可安全復原的操作。";
      await store.undo(); sn("已復原最近一次操作"); return "已復原最近一次操作。";
    }
    const item = items.find((row) => row.id === action.itemId);
    if (!item) throw new Error("找不到要修改的行程；請先選取卡片再重試");
    const fingerprint = actionFingerprint(action);
    if (assistantActionAlreadyApplied(item, action))
      return "這項變更已在目前行程中，未重複寫入；原復原紀錄仍保留。";
    assertAssistantMutationAllowed(item, action);
    if (action.kind === "move") {
      if (!action.day || !dateList.includes(action.day)) throw new Error("請指定旅程內的目的日期");
      await move(item, action.day);
    } else if (action.kind === "candidate") {
      await edit(`旅伴移到待定 ${requestId}`, [{ ...item, status: "candidate" }]);
      sn("已移到待定；原日期與預約資訊仍保留，可復原。");
    } else if (action.kind === "edit_time") {
      if (!action.time) throw new Error("請提供明確時刻");
      await edit(`旅伴改時間 ${requestId}`, [{ ...item, timeMode: "flexible", time: action.time,
        ...(action.period ? { period: action.period } : {}) }]);
      sn("時間已更新為可調整安排；可復原。");
    } else throw new Error("這類指令尚需手動確認");
    assistantDone.current.set(fingerprint, Date.now());
    return action.message;
  }
  async function applyAssistantDraft(action: AssistantAction, expectedTripId: string): Promise<string> {
    if (!trip || !store || action.kind !== "draft" || !action.draftItems?.length)
      throw new Error("草案不完整，未寫入行程");
    assertAssistantDraftTrip(expectedTripId, trip.id);
    if (action.draftItems.length > 20 || action.draftItems.some((row) => !dateList.includes(row.day)))
      throw new Error("草案含旅程外日期或超過 20 項；請先調整旅程日期，原行程未變更");
    const fingerprint = JSON.stringify({ tripId: trip.id, rows: action.draftItems });
    const { ids, alreadyAdded } = await assistantDraftIds(fingerprint, action.draftItems.length, store.snapshot.records);
    if (alreadyAdded)
      return "這份草案已加入過，未重複新增；可使用復原或手動調整。";
    const nextOrder = new Map<string, number>();
    const updates: RecordData[] = [];
    for (const [index, row] of action.draftItems.entries()) {
      const place = { ...blankPlace(store.owner, trip.id, row.name),
        notes: "旅伴草案；地點、營業與預約尚未查證", source: "Gemini 草案（未查證）" };
      const order = nextOrder.get(row.day) ?? maxOrder(row.day);
      nextOrder.set(row.day, order + 1);
      const item = { ...blankItem(store.owner, trip, place.id, row.day, order), id: ids[index],
        timeMode: row.time ? "flexible" as const : row.period ? "period" as const : "sequence" as const,
        time: row.time ?? null, period: row.period ?? "上午" as const,
        notes: row.notes ?? "", departureZone: dayCity(trip, row.day).timezone };
      updates.push(place, item);
    }
    await edit("確認旅伴草案", updates);
    sy(action.draftItems[0].day);
    sn(`已將 ${action.draftItems.length} 項草案加入行程；地點尚未查證，可復原。`);
    return `已加入 ${action.draftItems.length} 項；地點未定位且預約未確認。`;
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
  const currentCity = trip ? dayCity(trip, activeDay) : null;
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
  const nextChoices = next
    ? [next, ...todayItems.filter((item) => item.id !== next.id && overlapByItem.get(next.id)?.includes(item.id))]
    : [];
  const cards = (i: Item, index: number, candidate = false) => {
    const p = pFor(i);
    if (!p) return null;
    return (
      <article
        id={`item-${i.id}`}
        key={i.id}
        className={`item ${selected === i.id ? "selected" : ""} ${i.status}`}
        onDragStart={(e) => {
          if (!(e.target as HTMLElement).closest(".drag-handle")) {
            e.preventDefault();
            return;
          }
          e.dataTransfer.setData("text/travel-item", i.id);
        }}
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
          onClick={() => selectItem(i)}
        >
          {!candidate && <span className="ordinal">{index + 1}</span>}
          {p.name}
        </button>
        {i.day && <p className="item-date">安排日期：<strong>{i.day}</strong></p>}
        {i.day && trip && fixedZoneNotice(i, dayCity(trip, i.day).timezone) &&
          <p className="item-date">{fixedZoneNotice(i, dayCity(trip, i.day).timezone)}</p>}
        {i.candidateOrigin && <p className="item-date">原安排：{i.candidateOrigin.day} · {i.candidateOrigin.reason === "trip-range" ? "因旅程日期縮短移入待定" : "待定"}</p>}
        {(overlapByItem.get(i.id)?.length ?? 0) > 0 && <p className={`overlap-note ${i.timeMode === "fixed" ? "fixed" : ""}`}>
          與 {overlapByItem.get(i.id)!.map((id) => pFor(items.find((row) => row.id === id))?.name ?? "其他安排").join("、")} 時間重疊；可保留為備案。
        </p>}
        {!candidate && (
          <span
            className="drag-handle desktop-only"
            draggable
            aria-label={`拖曳${p.name}`}
            title="拖曳排序或移到其他日期"
          >↕</span>
        )}
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
              disabled={dateList.length < 2 && !candidate}
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
          {dateList.length < 2 && !candidate && (
            <span className="small">目前只有一天，可先延長旅程。</span>
          )}
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
                onClick={() => void attempt(() => delayAfter(i))}
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
          ) : demo && configured ? (
            <button disabled={!store || loading} onClick={() => sexit(true)}>離開本機模式</button>
          ) : configured ? (
            <button onClick={() => slo(true)}>私人登入</button>
          ) : (
            <span className="small">本機模式</span>
          )}
        </div>
      </header>
      <main className={viewMode === "view" ? "view-mode" : "edit-mode"}>
        {trip && <TripBackground trip={trip} enabled={!demo && !!user && !!auth?.currentUser}
          cloudReady={!!store?.isRemoteReady() && !store.snapshot.pending.length}
          token={async () => { if (!auth?.currentUser) throw new Error("登入已失效"); return auth.currentUser.getIdToken(); }} />}
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
                        schemaVersion: 2,
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
          {timezoneChoices.map((z) => (
            <option key={z}>{z}</option>
          ))}
        </datalist>
        {notice && (
          <div className="notice status-toast" role="status">
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
              {c.reason === "oversize"
                ? "舊版操作超過 450 筆雲端限制，未送出；本機資料完整保留。請先下載備份，再選遠端版本清除這批未同步資料，其他無關編輯可繼續同步。"
                : c.reason === "legacy"
                  ? "升級前的離線操作缺少旅程日期保護，已暫停送出。本機資料仍保留；先下載兩份備份，再確認是否重新同步。"
                  : c.reason === "policy"
                    ? "正式雲端規則拒絕這批操作。已保留本機修改並暫停此批；請下載備份，再選擇遠端版本。其他無關編輯可繼續同步。"
                  : "其他裝置修改了同一項目。本機與遠端內容均保留；以下選擇會影響這批移動／排序／刪除。"}
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
              使用遠端版本（捨棄此批本機修改）
            </button>
            {c.reason !== "oversize" && c.reason !== "policy" && (() => {
              const item = c.operation.changes.map((change) => change.after).find((r) => r.kind === "item");
              if (!item || item.kind !== "item") return null;
              const latestTrip = c.remote.find((r) => r.kind === "trip" && r.id === item.tripId) ?? records.find((r) => r.kind === "trip" && r.id === item.tripId);
              return latestTrip?.kind === "trip" ? <label>
                衝突復原日期（僅在原日期超出新範圍時套用）
                <select aria-label="衝突復原日期" value={recoveryDays[c.operation.id] ?? ""} onChange={(e) => srecoveryDays({ ...recoveryDays, [c.operation.id]: e.target.value })}>
                  <option value="">保留原日期</option>
                  {days(latestTrip).map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </label> : null;
            })()}
            {c.reason !== "oversize" && c.reason !== "policy" && <button
              onClick={() =>
                void attempt(() => store.resolve(c.operation.id, "local", recoveryDays[c.operation.id]))
              }
            >
              保留本機版本並重新同步
            </button>}
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
                <button className="primary" onClick={enterLocalMode}>
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
            <div className="trip-overview">
            <section className={`trip-toolbar ${trip ? "has-trip" : ""}`}>
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
              <button onClick={() => sif(true)}>從檔案建立旅程</button>
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
            {trip && (
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
                   <details className="trip-operations">
                    <summary>旅程操作</summary>
                    <div className="actions">
                      <div className="mobile-trip-create">
                        <button className="primary" onClick={() => se({ type: "trip", value: blankTrip(store.owner) })}>新增旅程</button>
                        <button onClick={() => sif(true)}>從檔案建立旅程</button>
                        <button onClick={() => void attempt(() => edit("載入合成示範", demos(store.owner)), "已加入兩份合成示範")}>載入示範</button>
                        <label className="check"><input type="checkbox" checked={archived} onChange={(event) => { sh(event.target.checked); st(null); }} />看封存</label>
                      </div>
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
                                    schemaVersion: 2,
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
                          <button onClick={() => sif(true)}>
                            CSV／XLSX／PDF／圖片匯入
                          </button>
                          <button
                            onClick={() => {
                              try {
                                download(
                                  "travel-planner.ics",
                                  calendar(projectedRecords, trip),
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
            )}
            </div>
            {trip ? (
              <>
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
                        <option key={d} value={d}>
                          {d}
                          {d === today ? " · 今天" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span className="active-city">目前 {activeDay} · {currentCity?.assigned ? currentCity.name : "城市未指定"} · {currentCity?.timezone}</span>
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
                  <div className="desktop-only mode-switch" aria-label="查看或編輯模式">
                    <button aria-pressed={viewMode === "view"} onClick={() => sview("view")}>查看</button>
                    <button aria-pressed={viewMode === "edit"} onClick={() => sview("edit")}>編輯</button>
                  </div>
                  <button className="desktop-only-button" aria-expanded={mapVisible} onClick={() => smapVisible((value) => !value)}>{mapVisible ? "收合地圖" : "顯示地圖"}</button>
                  <button className="desktop-only-button" aria-pressed={tab === "candidates"} onClick={() => sb(tab === "candidates" ? "today" : "candidates")}>候選 ({items.filter((item) => item.status === "candidate").length})</button>
                  <button className="desktop-only-button" aria-pressed={tab === "tasks"} onClick={() => sb(tab === "tasks" ? "today" : "tasks")}>待辦</button>
                  <button className="primary" disabled={demo || !user} onClick={() => sas(true)}>旅伴助手</button>
                  <details className="menu toolbar-more"><summary>更多</summary><div className="actions">
                    <button onClick={() => srem(true)}>提醒中心</button>
                    <button onClick={() => sx(true)}>探索地點</button>
                  </div></details>
                </section>
                {tab === "today" && (
                  <section className="next-stop">
                    <div>
                      <strong>
                        {next
                          ? nextChoices.length > 1 ? "下一站有多個可選安排" : "下一站"
                          : trip.demo
                            ? "示範日期行程"
                            : today === activeDay
                              ? "今天行程"
                              : "所選日期行程"}
                      </strong>
                      <span>
                        {nextChoices.length > 1 ? nextChoices.map((item) => pFor(item)?.name).filter(Boolean).join("／") : next ? pFor(next)?.name : "依自己的步調調整安排"}
                      </span>
                    </div>
                    {nextChoices.map((item) => pFor(item) && <a key={item.id} className="primary" target="_blank" rel="noreferrer" href={navigation(pFor(item)!)}>導航 {pFor(item)!.name} ↗</a>)}
                  </section>
                )}
                <div
                  className={`workspace ${mapVisible ? "" : "no-map"}`}
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
                            <span className="day-city">{trip.dayCities?.[d]?.name ?? "城市未指定"}</span>
                          </button>
                          <QuickAdd
                            onAdd={(name) => attempt(() => addName(name, d))}
                            cityHint={dayCity(trip, d).name}
                            onPick={(found) => attempt(() => addLocated(found, d))}
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
                    {outsideItems.length > 0 && (
                      <section className="error outside-items" role="alert">
                        <h3>有 {outsideItems.length} 項安排在旅程日期之外</h3>
                        <p>資料仍保留且包含於 JSON 匯出。請確認旅程日期或逐項移回正確日期。</p>
                        {outsideItems.map((item) => (
                          <div key={item.id} className="item-actions">
                            <strong>{pFor(item)?.name ?? "地點待恢復"} · {item.day}</strong>
                            <label>移到旅程內
                              <select aria-label={`${pFor(item)?.name ?? item.id}復原日期`} value="" onChange={(e) => {
                                if (e.target.value) void attempt(() => move(item, e.target.value));
                              }}>
                                <option value="">選擇日期</option>
                                {dateList.map((d) => <option key={d} value={d}>{d}</option>)}
                              </select>
                            </label>
                          </div>
                        ))}
                      </section>
                    )}
                  </section>
                  {(tab === "map" || (tab === "today" && mapVisible)) && (
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
                        city={currentCity}
                        showDay={mapFilter === "all"}
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
                        cityHint={currentCity?.name ?? ""}
                        onPick={(found) => attempt(() => addLocated(found, null))}
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
                        const linkedItem = t.itemId ? items.find((item) => item.id === t.itemId) : undefined;
                        const reservationMismatch = !!linkedItem && !!t.date && !!t.time && t.type !== "出發提醒" &&
                          (linkedItem.status === "candidate" ||
                            (t.type === "活動提醒" && !!linkedItem.day &&
                              (linkedItem.day !== t.date || linkedItem.time !== t.time || linkedItem.departureZone !== t.timezone)));
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
                                {pFor(linkedItem)
                                  ?.name ?? "安排已刪除"}
                              </p>
                            )}
                            {reservationMismatch && <div className="reservation-warning" role="status">
                              <strong>原預約與目前安排不同，請確認改期或取消。</strong>
                              <p>原日期與提醒仍保留；移入待定不代表店家已更改預約。處理狀態：{t.reservationResolution ?? "待確認改期"}。</p>
                              <div className="actions">{(["保留原預約", "已處理", "已取消"] as const).map((choice) => <button key={choice} disabled={t.reservationResolution === choice} onClick={() => void attempt(() => edit("記錄預約處理結果", [{ ...t, reservationResolution: choice }]))}>{choice}</button>)}</div>
                            </div>}
                            {linkedItem?.status === "candidate" && t.type === "出發提醒" && <p className="notice">安排目前待定；一般出發提醒已暫停。</p>}
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
      {viewMode === "view" && selectedItem && selectedPlace && trip && (
        <Modal title={selectedPlace.name} onClose={() => si(null)} wide>
          <p className="detail-date">{selectedItem.day ?? "待定"} · {itemTime(selectedItem)} · {selectedItem.status === "candidate" ? "候選" : selectedItem.status === "done" ? "完成" : selectedItem.status === "skipped" ? "跳過" : "已排定"}</p>
          {selectedItem.day && fixedZoneNotice(selectedItem, dayCity(trip, selectedItem.day).timezone) &&
            <p className="notice">{fixedZoneNotice(selectedItem, dayCity(trip, selectedItem.day).timezone)}</p>}
          {selectedPlace.originalName && <p>{selectedPlace.originalName}</p>}
          <p>{selectedPlace.address || selectedPlace.city || "地址待補充"}</p>
          {selectedItem.candidateOrigin && <p className="notice">原安排 {selectedItem.candidateOrigin.day}；因縮短旅程移入待定。原時間與內容仍保留。</p>}
          {selectedItem.notes && <p>{selectedItem.notes}</p>}
          {selectedPlace.notes && <p>{selectedPlace.notes}</p>}
          {(overlapByItem.get(selectedItem.id)?.length ?? 0) > 0 && <p className="overlap-note">與其他安排時間重疊，可保留為備案。</p>}
          <div className="actions">
            <a className="primary" href={navigation(selectedPlace)} target="_blank" rel="noreferrer">導航 ↗</a>
            <a href={mapsPlace(selectedPlace)} target="_blank" rel="noreferrer">地圖 ↗</a>
            <button onClick={() => { se({ type: "item", value: selectedItem }); si(null); }}>編輯安排</button>
            <button onClick={() => { se({ type: "place", value: selectedPlace }); si(null); }}>編輯地點</button>
            {selectedItem.day && <button onClick={() => void attempt(() => delayAfter(selectedItem))}>後續彈性延後 30 分</button>}
            {replace && selectedItem.status === "candidate" && <button className="primary" onClick={() => void attempt(async () => { await replaceItem(selectedItem, replace); si(null); })}>替換「{pFor(replace)?.name}」</button>}
            {selectedItem.status !== "candidate" && <button onClick={() => { sr(selectedItem); si(null); sb("candidates"); }}>用候選替換</button>}
            {selectedItem.status !== "candidate" && <button onClick={() => void attempt(async () => { await edit("改成候選", [{ ...selectedItem, status: "candidate", day: null }]); si(null); })}>移到待定</button>}
            {selectedItem.status !== "candidate" && <button onClick={() => void attempt(async () => { await edit("標記完成", [{ ...selectedItem, status: "done" }]); si(null); })}>完成</button>}
            {selectedItem.status !== "candidate" && <button onClick={() => void attempt(async () => { await edit("跳過安排", [{ ...selectedItem, status: "skipped" }]); si(null); })}>跳過</button>}
          </div>
          <label className="detail-move">移到某日 · 目前 {selectedItem.day ?? "待定"}
            <select aria-label={`${selectedPlace.name}詳細移到某日`} value="" onChange={(event) => {
              if (event.target.value) void attempt(async () => { await move(selectedItem, event.target.value); si(null); });
            }}>
              <option value="">選擇日期</option>
              {dateList.map((date) => <option key={date} value={date}>{date}</option>)}
            </select>
          </label>
          {dateList.length === 1 && <p className="hint">目前只有一天，可先延長旅程。</p>}
          <button onClick={() => si(null)}>關閉詳細資訊</button>
        </Modal>
      )}
      {editor?.type === "trip" && (
        <TripForm
          trip={editor.value}
          items={items}
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
          reminders={records.filter((r): r is Extract<RecordData, { kind: "reminder" }> => r.kind === "reminder" && r.targetId === editor.value.id)}
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
          {imported.some((r) => r.kind === "item" && r.day && imported.some((t) => t.kind === "trip" && t.id === r.tripId && (r.day! < t.start || r.day! > t.end))) &&
            <p className="error">來源有旅程日期之外的安排。匯入時會明確延伸新旅程的起訖日期，保留每項原日期；超過 120 天的資料會拒絕匯入，來源 JSON 不變。</p>}
          <button
            className="primary"
            onClick={() =>
              void attempt(async () => {
                const data = extendImportedTrips(remapImport(imported, store!.owner));
                if (data.length > 450)
                  throw new Error("一次匯入最多 450 筆，請按旅程分開匯入");
                await edit("匯入旅程副本", data);
                simp(null);
                chooseTrip(data.find((r) => r.kind === "trip")!.id);
              }, "已匯入新旅程")
            }
          >
            匯入為新旅程（必要時延伸日期）
          </button>
        </Modal>
      )}
      {importFlow && store && <ImportFlow owner={store.owner} currentTrip={trip} records={records}
        token={!demo && auth?.currentUser ? () => auth!.currentUser!.getIdToken() : undefined}
        onClose={() => sif(false)} onApply={async (updates) => {
          await edit("檔案匯入", updates);
          const created = updates.find((row): row is Trip => row.kind === "trip");
          if (created) chooseTrip(created.id);
          sn(`已匯入 ${updates.filter((row) => row.kind === "item").length} 項；請核對預約與未定位地點。`);
        }} />}
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
                  calendar(projectedRecords, trip),
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
                value={aiArea}
                onChange={(e) => { saai(e.target.value); saaiEdited(true); }}
                placeholder="地區"
              />
            </label>
            <button type="button" onClick={() => { saai(dayCity(trip, activeDay).name || trip.cities); saaiEdited(false); }}>依當日城市</button>
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
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([aiArea || trip.cities, aiQuery, aiCategory].join(" "))}`}
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
      {assistantOpen && trip && user && !demo && <TravelerAssistant key={trip.id} tripId={trip.id} selectedDay={activeDay}
        city={currentCity?.name || trip.cities} selectedItem={selectedItem && pFor(selectedItem) ? { id: selectedItem.id, name: pFor(selectedItem)!.name } : undefined}
        token={async () => { if (!auth?.currentUser) throw new Error("登入已失效"); return auth.currentUser.getIdToken(); }}
        onAction={executeAssistant} onDraft={applyAssistantDraft} onClose={() => sas(false)} />}
      {assistantChoice && <Modal title="選擇地點" onClose={() => sacChoice(null)}>
        <p>請確認要加入的實際地點；尚未變更行程。</p>
        {assistantChoice.places.map((place) => <button key={place.source} onClick={() => void attempt(async () => {
          await applyAssistantPlace(place, assistantChoice.action, assistantChoice.requestId);
        })}>{place.name} · {place.city} · {place.address}</button>)}
      </Modal>}
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
      {localExitOpen && demo && configured && store && !loading && (
        <Modal title="離開本機模式" onClose={() => sexit(false)}>
          <p>離開會清除此瀏覽器的本機旅程。若要保留資料，請先下載 JSON 備份。</p>
          <button onClick={() => download("travel-planner-local-backup.json", JSON.stringify({
            schemaVersion: 2,
            exportedAt: new Date().toISOString(),
            records: store.snapshot.records,
          }, null, 2), "application/json")}>下載本機備份</button>
          <button className="danger" onClick={() => void attempt(async () => {
            await signOutNow();
            sexit(false);
          }, "已離開本機模式並清除本機資料")}>清除並離開</button>
          <button onClick={() => sexit(false)}>繼續使用</button>
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
                    schemaVersion: 2,
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
        <Modal title="私人登入" onClose={() => { slo(false); sle(""); }}>
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
          {loginError && <p role="alert" className="error">{loginError}</p>}
          <button
            disabled={!configured || loginBusy}
            className="primary"
            onClick={() => {
              sle("");
              slb(true);
              void (async () => {
                try {
                await login(email, password);
                spw("");
                slo(false);
                sd(false);
                } catch (e) {
                  const code = (e as { code?: string })?.code;
                  sle(code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request"
                    ? "登入視窗已關閉或取消。可重試，或先使用本機模式。"
                    : code === "auth/network-request-failed"
                      ? "登入連線失敗。請確認網路及瀏覽器的憑證警告後重試；也可先使用本機模式。"
                      : `登入未完成：${message(e)}。可重試或使用本機模式。`);
                } finally {
                  slb(false);
                }
              })();
            }}
          >
            {loginBusy ? "登入中…" : emulator ? "測試登入" : "Google 登入／重試"}
          </button>
          <button type="button" onClick={() => { slo(false); sle(""); }}>取消</button>
          <button onClick={enterLocalMode}>
            使用本機模式
          </button>
        </Modal>
      )}
    </>
  );
}
function QuickAdd({ onAdd, onPick, cityHint }: {
  onAdd: (name: string) => Promise<boolean>;
  onPick: (found: PhotonPlace) => Promise<boolean>;
  cityHint: string;
}) {
  const [name, sn] = useState(""),
    [busy, sb] = useState(false);
  return <>
    <form
      className="quick-add"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || busy) return;
        sb(true);
        try {
          if (await onAdd(name)) sn("");
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
    <PlaceSearch query={name} cityHint={cityHint} onPick={(found) => {
      if (busy) return;
      sb(true);
      void onPick(found).then((ok) => { if (ok) sn(""); }).finally(() => sb(false));
    }} />
  </>;
}
