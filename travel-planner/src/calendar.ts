import { Temporal } from "@js-temporal/polyfill";
import { instant } from "./model";
import type { Item, Place, RecordData, Task, Trip } from "./model";
const escape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const stamp = (i: Temporal.Instant) =>
  i.toString({ smallestUnit: "second" }).replace(/[-:]/g, "");
export type Event = {
  id: string;
  title: string;
  start: Temporal.Instant;
  end: Temporal.Instant;
  notes: string;
  location: string;
  before: number[];
};
export function events(
  records: RecordData[],
  trip: Trip,
  onInvalid?: (error: unknown) => void,
): Event[] {
  const own = records.filter(
    (r) => !r.deleted && r.kind !== "trip" && r.tripId === trip.id,
  );
  const list: Event[] = [];
  for (const r of own) {
    try {
      if (
        r.kind === "item" &&
        r.status === "planned" &&
        r.day &&
        r.time &&
        ["fixed", "flexible"].includes(r.timeMode)
      ) {
        const p = own.find((p) => p.id === r.placeId) as Place | undefined;
        const start = instant(r.day, r.time, r.departureZone);
        const end =
          r.arrivalDay && r.arrivalTime
            ? instant(r.arrivalDay, r.arrivalTime, r.arrivalZone)
            : start.add({ minutes: r.duration || 1 });
        if (Temporal.Instant.compare(end, start) <= 0)
          throw new Error(`「${p?.name ?? "交通"}」抵達須晚於出發`);
        list.push({
          id: r.id,
          title: p?.name ?? "行程",
          start,
          end,
          notes: [
            r.notes,
            p?.notes,
            `出發時區 ${r.departureZone}；抵達時區 ${r.arrivalZone}`,
          ]
            .filter(Boolean)
            .join("\n"),
          location: p?.address ?? "",
          before: [],
        });
      }
      if (r.kind === "task" && r.date && r.time && r.status !== "完成" && r.reservationResolution !== "已取消") {
        const linked = r.itemId ? own.find((item) => item.kind === "item" && item.id === r.itemId) as Item | undefined : undefined;
        if (r.type === "出發提醒" && linked?.status === "candidate") continue;
        const start = instant(r.date, r.time, r.timezone);
        list.push({
          id: r.id,
          title: r.title,
          start,
          end: start.add({ minutes: 1 }),
          notes: [r.notes, r.url, `時區 ${r.timezone}`].join("\n"),
          location: "",
          before: [],
        });
      }
    } catch (e) {
      if (onInvalid) onInvalid(e);
      else throw e;
    }
  }
  for (const e of list)
    e.before = own
      .filter((r) => r.kind === "reminder" && r.targetId === e.id && r.enabled)
      .map((r) => (r as { beforeMinutes: number }).beforeMinutes);
  return list;
}
// RFC5545 folding counts UTF-8 bytes, not JavaScript UTF-16 units.
export function fold(line: string) {
  const enc = new TextEncoder();
  const result: string[] = [];
  let part = "";
  for (const c of line) {
    if (enc.encode(part + c).length > 75) {
      result.push(part);
      part = " " + c;
    } else part += c;
  }
  result.push(part);
  return result.join("\r\n");
}
export function calendar(
  records: RecordData[],
  trip: Trip,
  now = Temporal.Now.instant(),
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//YSU//Travel Planner V1//ZH-TW",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(trip.name)}`,
  ];
  for (const e of events(records, trip)) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@travel-planner.ycsu.cc`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${escape(e.title)}`,
      `DESCRIPTION:${escape(e.notes)}`,
      `LOCATION:${escape(e.location)}`,
    );
    for (const before of new Set(e.before))
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escape(e.title)}`,
        `TRIGGER:-PT${before}M`,
        "END:VALARM",
      );
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
export function dueReminders(
  records: RecordData[],
  trip: Trip,
  now = Temporal.Now.instant(),
  onInvalid?: (error: unknown) => void,
) {
  return events(records, trip, onInvalid)
    .flatMap((e) =>
      e.before.map((before) => ({
        event: e,
        at: e.start.subtract({ minutes: before }),
        overdue: Temporal.Instant.compare(now, e.start) > 0,
      })),
    )
    .sort((a, b) => Temporal.Instant.compare(a.at, b.at));
}
export function itemTime(i: Item) {
  return i.timeMode === "sequence"
    ? "依序"
    : i.timeMode === "period"
      ? i.period
      : `${i.time ?? "未設定"}${i.timeMode === "fixed" ? " · 固定預約" : " · 大約"}`;
}
export function taskTime(t: Task) {
  return t.date && t.time
    ? `${t.date} ${t.time} ${t.timezone}`
    : "未設截止時間";
}
