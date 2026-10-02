import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";

export const categories = ["美食", "景點", "住宿", "交通", "其他"] as const;
const id = z.string().uuid();
const date = z.string().refine((v) => {
  try {
    Temporal.PlainDate.from(v);
    return /^\d{4}-\d{2}-\d{2}$/.test(v);
  } catch {
    return false;
  }
}, "日期無效");
export const zone = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "請使用有效 IANA 時區");
const url = z
  .string()
  .max(3000)
  .refine((v) => !v || safeUrl(v) !== "", "只接受 http／https 網址");
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const base = {
  id,
  ownerId: z.string().min(1),
  revision: z.number().int().nonnegative(),
  updatedAt: z.string(),
  deleted: z.boolean().default(false),
};
const common = { tripId: id };
export const tripSchema = z
  .object({
    ...base,
    kind: z.literal("trip"),
    name: z.string().trim().min(1).max(200),
    start: date,
    end: date,
    cities: z.string().max(1000),
    timezone: zone,
    travelers: z.number().int().min(1).max(100),
    archived: z.boolean(),
    demo: z.boolean().default(false),
  })
  .refine(
    (t) =>
      t.end >= t.start &&
      Temporal.PlainDate.from(t.start).until(Temporal.PlainDate.from(t.end))
        .days < 120,
    "結束日須晚於開始日，且旅程最多 120 天",
  );
export const placeSchema = z
  .object({
    ...base,
    ...common,
    kind: z.literal("place"),
    name: z.string().trim().min(1).max(200),
    originalName: z.string().max(200),
    city: z.string().max(200),
    area: z.string().max(200),
    category: z.enum(categories),
    address: z.string().max(2000),
    url,
    mapsUrl: url,
    notes: z.string().max(10000),
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),
    source: z.string().max(3000),
  })
  .refine((p) => (p.lat === null) === (p.lng === null), "經緯度必須一起填寫");
export const itemSchema = z
  .object({
    ...base,
    ...common,
    kind: z.literal("item"),
    placeId: id,
    day: date.nullable(),
    order: z.number().finite(),
    status: z.enum(["planned", "candidate", "done", "skipped"]),
    timeMode: z.enum(["sequence", "period", "flexible", "fixed"]),
    period: z.enum(["上午", "下午", "晚上"]),
    time: clock.nullable(),
    duration: z.number().int().min(0).max(1440),
    transport: z.enum(["步行", "大眾運輸", "開車", "其他"]),
    travelMinutes: z.number().int().min(0).max(2880).nullable(),
    buffer: z.number().int().min(0).max(1440),
    departureZone: zone,
    arrivalDay: date.nullable(),
    arrivalTime: clock.nullable(),
    arrivalZone: zone,
    travelers: z.number().int().min(1).max(100).nullable(),
    notes: z.string().max(10000),
  })
  .refine(
    (i) =>
      (!["flexible", "fixed"].includes(i.timeMode) || !!i.time) &&
      (i.status !== "planned" || !!i.day) &&
      !!i.arrivalDay === !!i.arrivalTime,
    "排定項目需要日期；預約與彈性時間需要時刻；抵達日期與時間需一起填",
  );
export const taskSchema = z
  .object({
    ...base,
    ...common,
    kind: z.literal("task"),
    title: z.string().trim().min(1).max(300),
    type: z.enum([
      "訂票開放",
      "訂位",
      "付款截止",
      "取消截止",
      "準備",
      "活動提醒",
      "出發提醒",
    ]),
    status: z.enum(["待訂", "已訂", "待確認", "完成"]),
    date: date.nullable(),
    time: clock.nullable(),
    timezone: zone,
    itemId: id.nullable(),
    url,
    notes: z.string().max(10000),
  })
  .refine((t) => !!t.date === !!t.time, "提醒日期與時間需一起填");
export const reminderSchema = z.object({
  ...base,
  ...common,
  kind: z.literal("reminder"),
  targetId: id,
  beforeMinutes: z.number().int().min(0).max(525600),
  enabled: z.boolean(),
});
export const recordSchema = z.union([
  tripSchema,
  placeSchema,
  itemSchema,
  taskSchema,
  reminderSchema,
]);
export type Trip = z.infer<typeof tripSchema>;
export type Place = z.infer<typeof placeSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Reminder = z.infer<typeof reminderSchema>;
export type RecordData = Trip | Place | Item | Task | Reminder;
export function validateSchedule(r: Item | Task) {
  try {
    if (r.kind === "task") {
      if (r.date && r.time) instant(r.date, r.time, r.timezone);
    } else if (r.day && r.time && ["fixed", "flexible"].includes(r.timeMode)) {
      const start = instant(r.day, r.time, r.departureZone);
      if (
        r.arrivalDay &&
        r.arrivalTime &&
        Temporal.Instant.compare(
          instant(r.arrivalDay, r.arrivalTime, r.arrivalZone),
          start,
        ) <= 0
      )
        throw new Error("抵達需晚於出發");
    } else if (r.arrivalDay || r.arrivalTime)
      throw new Error("抵達時間需要完整出發日期與時間");
  } catch (e) {
    throw new Error(
      `時間無法使用：${e instanceof Error && e.message.includes("抵達") ? e.message : "此時區時間不存在或有夏令時間歧義，請調整時間／時區"}`,
    );
  }
}
export type Kind = RecordData["kind"];
export const uid = () => crypto.randomUUID();
export const baseRecord = (ownerId: string) => ({
  id: uid(),
  ownerId,
  revision: 0,
  updatedAt: new Date().toISOString(),
  deleted: false,
});
export function safeUrl(v: string) {
  try {
    const u = new URL(v);
    return ["https:", "http:"].includes(u.protocol) ? u.href : "";
  } catch {
    return "";
  }
}
export function days(t: Pick<Trip, "start" | "end">) {
  const result: string[] = [];
  let d = Temporal.PlainDate.from(t.start);
  const end = Temporal.PlainDate.from(t.end);
  while (Temporal.PlainDate.compare(d, end) <= 0 && result.length < 120) {
    result.push(d.toString());
    d = d.add({ days: 1 });
  }
  return result;
}
export function localToday(timezone: string, now = Temporal.Now.instant()) {
  return now.toZonedDateTimeISO(timezone).toPlainDate().toString();
}
export function instant(day: string, time: string, timezone: string) {
  return Temporal.PlainDateTime.from(`${day}T${time}`)
    .toZonedDateTime(timezone, { disambiguation: "reject" })
    .toInstant();
}
export function otherZone(
  day: string,
  time: string,
  source: string,
  target: string,
) {
  try {
    return instant(day, time, source)
      .toZonedDateTimeISO(target)
      .toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "時刻不存在或因夏令時間重複，請調整";
  }
}
export function blankTrip(ownerId: string): Trip {
  const d = localToday("Asia/Tokyo");
  return {
    ...baseRecord(ownerId),
    kind: "trip",
    name: "新旅程",
    start: d,
    end: d,
    cities: "",
    timezone: "Asia/Tokyo",
    travelers: 1,
    archived: false,
    demo: false,
  };
}
export function blankPlace(ownerId: string, tripId: string, name = ""): Place {
  return {
    ...baseRecord(ownerId),
    kind: "place",
    tripId,
    name,
    originalName: "",
    city: "",
    area: "",
    category: "景點",
    address: "",
    url: "",
    mapsUrl: "",
    notes: "",
    lat: null,
    lng: null,
    source: "",
  };
}
export function blankItem(
  ownerId: string,
  trip: Trip,
  placeId: string,
  day: string | null,
  order = 0,
): Item {
  return {
    ...baseRecord(ownerId),
    kind: "item",
    tripId: trip.id,
    placeId,
    day,
    order,
    status: day ? "planned" : "candidate",
    timeMode: "sequence",
    period: "上午",
    time: null,
    duration: 60,
    transport: "步行",
    travelMinutes: null,
    buffer: 0,
    departureZone: trip.timezone,
    arrivalDay: null,
    arrivalTime: null,
    arrivalZone: trip.timezone,
    travelers: null,
    notes: "",
  };
}
export function mapsQuery(p: Place) {
  return p.lat !== null && p.lng !== null
    ? `${p.lat},${p.lng}`
    : [p.name, p.address, p.city].filter(Boolean).join(" ");
}
export function mapsPlace(p: Place) {
  return (
    safeUrl(p.mapsUrl) ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery(p))}`
  );
}
export function navigation(p: Place, mode = "walking", from?: Place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapsQuery(p))}&travelmode=${mode}${from ? `&origin=${encodeURIComponent(mapsQuery(from))}` : ""}`;
}
export function parseMaps(value: string): Partial<Place> {
  const link = safeUrl(value);
  if (!link) return {};
  const u = new URL(link);
  if (!/(^|\.)(google\.[a-z.]+|goo\.gl|maps\.app\.goo\.gl)$/.test(u.hostname))
    return {};
  const result: Partial<Place> = { mapsUrl: link };
  // @lat,lng is a viewport, not a place. Only explicit place coordinates/query pairs qualify.
  const pair = u.searchParams.get("query") || u.searchParams.get("q");
  const match =
    pair?.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/) ||
    u.pathname.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (match) {
    const lat = Number(match[1]),
      lng = Number(match[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180)
      Object.assign(result, { lat, lng });
  }
  const name = u.pathname.match(/\/place\/([^/]+)/)?.[1];
  if (name) {
    try {
      result.name = decodeURIComponent(name.replace(/\+/g, " "));
    } catch {
      /* preserve link */
    }
  }
  return result;
}
export function ordered(items: Item[], day?: string) {
  return items
    .filter(
      (i) =>
        !i.deleted &&
        (day === undefined || i.day === day) &&
        i.status !== "candidate",
    )
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
export function delayFlexible(
  items: Item[],
  startOrder: number,
  minutes = 30,
): { updates: Item[]; conflicts: string[] } {
  const updates: Item[] = [];
  const conflicts: string[] = [];
  for (const item of items.filter(
    (i) =>
      !i.deleted &&
      i.status === "planned" &&
      i.order >= startOrder &&
      i.timeMode === "flexible" &&
      i.day &&
      i.time,
  )) {
    const old = Temporal.PlainDateTime.from(`${item.day}T${item.time}`);
    const next = old.add({ minutes });
    if (next.toPlainDate().toString() !== item.day) {
      conflicts.push(`${item.id}: 延後會跨日，請手動移動`);
      continue;
    }
    let start: Temporal.Instant;
    try {
      start = instant(
        item.day!,
        next.toPlainTime().toString().slice(0, 5),
        item.departureZone,
      );
    } catch {
      conflicts.push(`${item.id}: 夏令時間歧義`);
      continue;
    }
    const end = start.add({
      minutes: item.duration + item.buffer + (item.travelMinutes ?? 0),
    });
    for (const fixed of items.filter(
      (i) =>
        i.day === item.day &&
        i.status === "planned" &&
        !i.deleted &&
        i.timeMode === "fixed" &&
        i.time,
    )) {
      try {
        const fs = instant(fixed.day!, fixed.time!, fixed.departureZone);
        const fe = fs.add({ minutes: fixed.duration + fixed.buffer });
        if (
          Temporal.Instant.compare(start, fe) < 0 &&
          Temporal.Instant.compare(end, fs) > 0
        )
          conflicts.push(`${item.id}: 與固定預約 ${fixed.id} 重疊`);
      } catch {
        conflicts.push(`${fixed.id}: 固定預約時刻無效`);
      }
    }
    updates.push({ ...item, time: next.toPlainTime().toString().slice(0, 5) });
  }
  return { updates, conflicts };
}
export const exportSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  records: z.array(recordSchema).max(15000),
});
export function validateImport(input: unknown) {
  const data = exportSchema.parse(input);
  const alive = data.records.filter((r) => !r.deleted);
  const byId = new Map(alive.map((r) => [r.id, r]));
  if (byId.size !== alive.length) throw new Error("資料 ID 重複");
  for (const r of alive) {
    if (r.kind !== "trip" && byId.get(r.tripId)?.kind !== "trip")
      throw new Error("項目缺少旅程");
    if (r.kind === "item") {
      const p = byId.get(r.placeId);
      const t = byId.get(r.tripId) as Trip;
      if (
        p?.kind !== "place" ||
        p.tripId !== r.tripId ||
        (r.day && (r.day < t.start || r.day > t.end))
      )
        throw new Error("行程地點／日期不一致");
      if (r.day && r.time && ["fixed", "flexible"].includes(r.timeMode)) {
        const start = instant(r.day, r.time, r.departureZone);
        if (r.arrivalDay && r.arrivalTime) {
          const arrival = instant(r.arrivalDay, r.arrivalTime, r.arrivalZone);
          if (arrival.epochMilliseconds <= start.epochMilliseconds)
            throw new Error("抵達必須晚於出發");
        }
      }
    }
    if (r.kind === "task" && r.date && r.time)
      instant(r.date, r.time, r.timezone);
    if (r.kind === "task" && r.itemId) {
      const i = byId.get(r.itemId);
      if (i?.kind !== "item" || i.tripId !== r.tripId)
        throw new Error("待辦行程連結無效");
    }
    if (r.kind === "reminder") {
      const target = byId.get(r.targetId);
      if (
        !target ||
        !["item", "task"].includes(target.kind) ||
        (target as Item | Task).tripId !== r.tripId
      )
        throw new Error("提醒連結無效");
    }
  }
  return alive;
}
export function remapImport(records: RecordData[], ownerId: string) {
  const mapping = new Map(records.map((r) => [r.id, uid()]));
  return records.map((r) => {
    const copy = { ...r, ...baseRecord(ownerId), id: mapping.get(r.id)! };
    if (copy.kind !== "trip") copy.tripId = mapping.get(copy.tripId)!;
    if (copy.kind === "item") copy.placeId = mapping.get(copy.placeId)!;
    if (copy.kind === "task" && copy.itemId)
      copy.itemId = mapping.get(copy.itemId)!;
    if (copy.kind === "reminder") copy.targetId = mapping.get(copy.targetId)!;
    return copy;
  });
}
