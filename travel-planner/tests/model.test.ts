import { describe, it, expect } from "vitest";
import {
  blankTrip,
  blankPlace,
  blankItem,
  days,
  instant,
  otherZone,
  parseMaps,
  delayFlexible,
  validateImport,
  remapImport,
  tripSchema,
  placeSchema,
  validateSchedule,
  dailySequence,
  extendImportedTrips,
} from "../src/model";
import { calendar, fold } from "../src/calendar";
import { demos } from "../src/demo";
describe("travel and geography", () => {
  it("keeps daily marker numbers when an earlier stop has no coordinates or another date repeats the place", () => {
    const t = { ...blankTrip("a"), start: "2030-01-01", end: "2030-01-02" };
    const p = blankPlace("a", t.id, "同名");
    const first = blankItem("a", t, p.id, t.start, 0);
    const second = blankItem("a", t, p.id, t.start, 1);
    const nextDay = blankItem("a", t, p.id, t.end, 0);
    const candidate = blankItem("a", t, p.id, null);
    const skipped = { ...blankItem("a", t, p.id, t.end, 1), status: "skipped" as const };
    const n = dailySequence([first, second, nextDay, candidate, skipped]);
    expect([...n.values()]).toEqual([1, 2, 1, 2]);
    expect(n.has(candidate.id)).toBe(false);
  });
  it("preserves out-of-range legacy import dates by explicit trip extension", () => {
    const t = { ...blankTrip("a"), start: "2030-01-01", end: "2030-01-02" };
    const p = blankPlace("a", t.id, "legacy");
    const i = blankItem("a", t, p.id, "2030-01-03");
    const source = { schemaVersion: 1, exportedAt: new Date().toISOString(), records: [t, p, i] };
    expect(validateImport(source)).toHaveLength(3);
    const fixed = extendImportedTrips(source.records);
    expect(fixed.find((r) => r.kind === "trip")).toMatchObject({ start: t.start, end: i.day });
    expect(fixed.find((r) => r.kind === "item")).toMatchObject({ day: i.day });
  });
  it("supports year boundary, blank trips and unknown coordinates", () => {
    const t = { ...blankTrip("a"), start: "2030-12-31", end: "2031-01-02" };
    expect(days(t)).toEqual(["2030-12-31", "2031-01-01", "2031-01-02"]);
    expect(blankPlace("a", t.id, "同名")).toMatchObject({
      lat: null,
      lng: null,
    });
    expect(tripSchema.safeParse({ ...t, end: "2030-01-01" }).success).toBe(
      false,
    );
  });
  it("retains short URLs, only parses explicit place coordinates, never viewport centers", () => {
    expect(parseMaps("https://maps.app.goo.gl/abc")).toEqual({
      mapsUrl: "https://maps.app.goo.gl/abc",
    });
    expect(
      parseMaps("https://www.google.com/maps/@35.1,139.2,12z").lat,
    ).toBeUndefined();
    expect(
      parseMaps("https://www.google.com/maps/search/?api=1&query=35.1,139.2"),
    ).toMatchObject({ lat: 35.1, lng: 139.2 });
    expect(parseMaps("javascript:alert(1)")).toEqual({});
    expect(parseMaps("https://evil.test/?q=0,0")).toEqual({});
  });
  it("rejects partial/out-of-range coordinates and unsafe URLs", () => {
    const p = blankPlace("a", crypto.randomUUID(), "name");
    expect(placeSchema.safeParse({ ...p, lat: 35 }).success).toBe(false);
    expect(placeSchema.safeParse({ ...p, lat: 99, lng: 0 }).success).toBe(
      false,
    );
    expect(
      placeSchema.safeParse({ ...p, url: "javascript:alert(1)" }).success,
    ).toBe(false);
  });
  it("separates repeated place arrangements and preserves manually entered travel values", () => {
    const t = blankTrip("a"),
      p = blankPlace("a", t.id, "同名");
    const a = { ...blankItem("a", t, p.id, t.start), travelMinutes: 37 },
      b = blankItem("a", t, p.id, t.start);
    expect(a.id).not.toBe(b.id);
    expect(a.placeId).toBe(b.placeId);
    expect(a.travelMinutes).toBe(37);
  });
});
describe("time and calendars", () => {
  it("calendar instants cover DST summer/winter and year-crossing arrival", () => {
    const t = { ...blankTrip("a"), start: "2026-01-01", end: "2026-01-01" },
      p = blankPlace("a", crypto.randomUUID(), "Calendar example");
    p.tripId = t.id;
    const base = {
      ...blankItem("a", t, p.id, t.start),
      timeMode: "fixed" as const,
      time: "10:00",
      departureZone: "America/Los_Angeles",
    };
    expect(calendar([t, p, base], t)).toContain("DTSTART:20260101T180000Z");
    expect(calendar([t, p, { ...base, day: "2026-07-01" }], t)).toContain(
      "DTSTART:20260701T170000Z",
    );
    const cross = calendar(
      [
        t,
        p,
        {
          ...base,
          day: "2030-12-31",
          time: "15:00",
          arrivalDay: "2031-01-01",
          arrivalTime: "10:00",
          arrivalZone: "Asia/Tokyo",
        },
      ],
      t,
    );
    expect(cross).toContain("DTSTART:20301231T230000Z");
    expect(cross).toContain("DTEND:20310101T010000Z");
  });
  it("rejects schedule DST gaps/ambiguities and backwards arrival before persistence", () => {
    const t = blankTrip("owner");
    const i = {
      ...blankItem("owner", t, crypto.randomUUID(), "2026-03-08"),
      timeMode: "fixed" as const,
      time: "02:30",
      departureZone: "America/Los_Angeles",
    };
    expect(() => validateSchedule(i)).toThrow("時間無法使用");
    expect(() =>
      validateSchedule({ ...i, day: "2026-11-01", time: "01:30" }),
    ).toThrow();
    expect(() =>
      validateSchedule({
        ...i,
        day: "2030-01-01",
        time: "12:00",
        arrivalDay: "2030-01-01",
        arrivalTime: "11:00",
        arrivalZone: "America/Los_Angeles",
      }),
    ).toThrow("抵達");
  });
  it("keeps a detached cross-day candidate's times without treating it as a current departure", () => {
    const trip = blankTrip("owner");
    const flight = { ...blankItem("owner", trip, crypto.randomUUID(), null),
      status: "candidate" as const, timeMode: "fixed" as const, time: "23:00",
      arrivalDay: "2030-01-04", arrivalTime: "02:00", departureZone: "Asia/Tokyo", arrivalZone: "Asia/Tokyo" };
    expect(() => validateSchedule(flight)).not.toThrow();
    expect(() => validateSchedule({ ...flight, day: "2030-01-04" })).toThrow("抵達");
  });
  it("uses IANA DST and rejects missing/ambiguous local times", () => {
    expect(() =>
      instant("2026-03-08", "02:30", "America/Los_Angeles"),
    ).toThrow();
    expect(() =>
      instant("2026-11-01", "01:30", "America/Los_Angeles"),
    ).toThrow();
    expect(
      instant("2026-07-01", "10:00", "America/Los_Angeles").toString(),
    ).toBe("2026-07-01T17:00:00Z");
    expect(
      instant("2026-01-01", "10:00", "America/Los_Angeles").toString(),
    ).toBe("2026-01-01T18:00:00Z");
    expect(
      otherZone("2030-01-01", "10:00", "Asia/Tokyo", "Pacific/Honolulu"),
    ).toContain("12");
  });
  it("delays flexible items only, reports fixed conflicts and day overflow", () => {
    const t = { ...blankTrip("a"), start: "2030-01-01", end: "2030-01-01" };
    const flex = {
      ...blankItem("a", t, crypto.randomUUID(), t.start),
      timeMode: "flexible" as const,
      time: "12:00",
      duration: 60,
    };
    const fixed = {
      ...flex,
      id: crypto.randomUUID(),
      timeMode: "fixed" as const,
      time: "13:00",
      order: 1,
    };
    const result = delayFlexible([flex, fixed], 0);
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].time).toBe("12:30");
    expect(fixed.time).toBe("13:00");
    expect(result.conflicts).toHaveLength(1);
    expect(delayFlexible([{ ...flex, time: "23:50" }], 0).updates).toHaveLength(
      0,
    );
  });
  it("exports stable UID, UTC instants, cross-zone arrival and alarms", () => {
    const data = demos("a");
    const t = data.find((r) => r.kind === "trip")!;
    if (t.kind !== "trip") throw 0;
    const text = calendar(data, t);
    expect(text).toContain("BEGIN:VALARM");
    expect(text).toContain("TRIGGER:-PT30M");
    expect(text).toContain("DTSTART:20300107T040000Z");
    expect(text.match(/UID:.+/g)).toEqual(calendar(data, t).match(/UID:.+/g));
    const p = blankPlace("a", t.id, "Flight");
    const i = {
      ...blankItem("a", t, p.id, "2030-01-08"),
      timeMode: "fixed" as const,
      time: "22:00",
      departureZone: "Asia/Tokyo",
      arrivalDay: "2030-01-08",
      arrivalTime: "15:00",
      arrivalZone: "America/Los_Angeles",
    };
    const flight = calendar([t, p, i], t);
    expect(flight).toContain("DTSTART:20300108T130000Z");
    expect(flight).toContain("DTEND:20300108T230000Z");
  });
  it("folds UTF-8 calendar lines under 75 bytes, escapes delimiters", () => {
    const line = fold("DESCRIPTION:" + "繁體中文;,\n".repeat(20));
    for (const part of line.split("\r\n"))
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
  });
});
describe("portable data", () => {
  it("validates both synthetic trips and imports new IDs without overwriting", () => {
    const data = demos("local-demo");
    expect(
      validateImport({ schemaVersion: 1, exportedAt: "now", records: data }),
    ).toHaveLength(data.length);
    const copy = remapImport(data, "owner");
    expect(copy.every((r) => r.ownerId === "owner")).toBe(true);
    expect(copy.some((r) => data.some((d) => d.id === r.id))).toBe(false);
    expect(
      validateImport({ schemaVersion: 1, exportedAt: "now", records: copy }),
    ).toHaveLength(copy.length);
  });
  it("rejects schema versions, duplicate IDs, foreign place references and out-of-range days", () => {
    const data = demos("a");
    expect(() =>
      validateImport({ schemaVersion: 3, exportedAt: "now", records: data }),
    ).toThrow();
    expect(() =>
      validateImport({
        schemaVersion: 1,
        exportedAt: "now",
        records: [...data, data[0]],
      }),
    ).toThrow();
    const broken = data.map((r) =>
      r.kind === "item" ? { ...r, placeId: crypto.randomUUID() } : r,
    );
    expect(() =>
      validateImport({ schemaVersion: 1, exportedAt: "now", records: broken }),
    ).toThrow();
  });
});
