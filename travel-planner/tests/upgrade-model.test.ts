import { describe, expect, it } from "vitest";
import {
  assignDayCity,
  baseRecord,
  blankItem,
  blankPlace,
  blankTrip,
  dayCity,
  effectiveItem,
  extendImportedTrips,
  overlaps,
  remapImport,
  shrinkTripPlan,
  tripSchema,
  validateImport,
} from "../src/model";
import { applyOperation, canonical, checkBase, makeOperation } from "../src/storage";
import { calendar, events } from "../src/calendar";

describe("day city and time zone migration", () => {
  it("compares nested daily city values for idempotent cloud acknowledgement", () => {
    expect(canonical({ revision: 2, dayCities: { "2030-01-01": { name: "東京" } } }))
      .not.toBe(canonical({ revision: 2, dayCities: { "2030-01-01": { name: "Honolulu" } } }));
  });
  it("keeps legacy multi-city days unassigned while providing a search fallback", () => {
    const trip = { ...blankTrip("owner"), cities: "東京、京都、大阪" };
    expect(dayCity(trip, trip.start).name).toBe("東京");
    expect(dayCity(trip, trip.start).assigned).toBe(false);
    expect(tripSchema.parse(trip).dayCities).toBeUndefined();
  });

  it("assigns consecutive Honolulu days without using device timezone or guessing coordinates", () => {
    const trip = { ...blankTrip("owner"), start: "2030-12-30", end: "2031-01-04" };
    const updated = assignDayCity(trip, "2030-12-30", "2031-01-01", "Honolulu", "Pacific/Honolulu");
    expect(dayCity(updated, "2031-01-01")).toMatchObject({ name: "Honolulu", timezone: "Pacific/Honolulu", assigned: true, lat: null, lng: null });
    expect(dayCity(updated, "2031-01-02").assigned).toBe(false);
    expect(tripSchema.parse(updated).dayCities?.["2030-12-31"]?.timezone).toBe("Pacific/Honolulu");
  });
});

describe("date range and candidate preservation", () => {
  it("projects excluded stops as candidates without rewriting their stored booking date", () => {
    const trip = { ...blankTrip("owner"), start: "2030-01-01", end: "2030-01-04" };
    const place = blankPlace("owner", trip.id, "Museum");
    const item = { ...blankItem("owner", trip, place.id, "2030-01-04"), timeMode: "fixed" as const, time: "10:00", order: 2 };
    const result = shrinkTripPlan(trip, { ...trip, end: "2030-01-02" }, [item]);
    expect(result.affected).toBe(1);
    expect(result.items).toEqual([]);
    expect(result.trip.detachedItemIds).toContain(item.id);
    expect(effectiveItem(result.trip, item)).toMatchObject({ status: "candidate", day: null, time: "10:00", candidateOrigin: { day: "2030-01-04", order: 2, reason: "trip-range" } });
    expect(item.day).toBe("2030-01-04");
    const imported = validateImport({ schemaVersion: 2, exportedAt: "now", records: [result.trip, place, item] });
    const importedTrip = imported.find((row) => row.kind === "trip")!;
    const importedItem = imported.find((row) => row.kind === "item")!;
    if (importedTrip.kind !== "trip" || importedItem.kind !== "item") throw new Error("invalid import");
    expect(effectiveItem(importedTrip, importedItem).status).toBe("candidate");
    expect(extendImportedTrips(imported).find((row) => row.kind === "trip")).toMatchObject({ end: "2030-01-02" });
    const remapped = remapImport(imported, "owner");
    const copyTrip = remapped.find((row) => row.kind === "trip")!;
    const copyItem = remapped.find((row) => row.kind === "item")!;
    if (copyTrip.kind !== "trip" || copyItem.kind !== "item") throw new Error("invalid copy");
    expect(copyTrip.detachedItemIds).toContain(copyItem.id);
    expect(effectiveItem({ ...result.trip, end: "2030-01-05" }, item).status).toBe("candidate");
  });
  it("shrinks 451 stops with one Trip CAS and rejects stale concurrent writes in either order", () => {
    const trip = { ...blankTrip("owner"), start: "2030-01-01", end: "2030-01-04" };
    const items = Array.from({ length: 451 }, (_, index) => ({
      ...blankItem("owner", trip, crypto.randomUUID(), "2030-01-04"), order: index,
    }));
    const before = [trip, ...items];
    const planned = shrinkTripPlan(trip, { ...trip, end: "2030-01-02" }, items);
    const shrinkOp = makeOperation("shrink", before, [planned.trip], "owner");
    expect(shrinkOp.changes).toHaveLength(1);
    expect(planned.trip.detachedItemIds).toHaveLength(451);
    const add = blankItem("owner", trip, crypto.randomUUID(), "2030-01-04");
    const addOp = makeOperation("add", before, [add], "owner");
    expect(checkBase(applyOperation(before, shrinkOp), addOp)).toBe(false);
    expect(checkBase(applyOperation(before, addOp), shrinkOp)).toBe(false);
  });
  it("retains a linked booking date but pauses departure alarms for a detached stop", () => {
    const trip = { ...blankTrip("owner"), start: "2030-01-01", end: "2030-01-04" };
    const place = blankPlace("owner", trip.id, "Museum");
    const item = { ...blankItem("owner", trip, place.id, "2030-01-04"), timeMode: "fixed" as const, time: "10:00" };
    const next = shrinkTripPlan(trip, { ...trip, end: "2030-01-02" }, [item]).trip;
    const booking = { ...baseRecord("owner"), kind: "task" as const, tripId: trip.id, title: "Museum booking", type: "活動提醒" as const,
      status: "已訂" as const, date: "2030-01-04", time: "10:00", timezone: "Asia/Tokyo", itemId: item.id, url: "", notes: "" };
    const departure = { ...booking, id: crypto.randomUUID(), title: "Leave hotel", type: "出發提醒" as const };
    const own = [next, place, effectiveItem(next, item), booking, departure];
    expect(events(own, next).map((entry) => entry.title)).toEqual(["Museum booking"]);
    expect(calendar(own, next)).toContain(`UID:${booking.id}@travel-planner.ycsu.cc`);
    expect(calendar(own, next)).not.toContain(`UID:${departure.id}@travel-planner.ycsu.cc`);
    expect(item.day).toBe("2030-01-04");
  });
});

describe("overlapping schedules", () => {
  it("reports two and three-way overlap without rejecting it, but not unknown duration", () => {
    const trip = { ...blankTrip("owner"), start: "2030-01-01", end: "2030-01-01" };
    const a = { ...blankItem("owner", trip, crypto.randomUUID(), trip.start), timeMode: "fixed" as const, time: "10:00", duration: 60 };
    const b = { ...a, id: crypto.randomUUID(), timeMode: "flexible" as const, time: "10:30", order: 1 };
    const c = { ...a, id: crypto.randomUUID(), time: "10:45", order: 2 };
    expect(overlaps([a, b, c]).get(a.id)).toEqual([b.id, c.id]);
    expect(overlaps([{ ...a, duration: 0 }, b]).get(a.id)).toBeUndefined();
    expect(overlaps([{ ...a, timeMode: "sequence", time: null }, b]).get(a.id)).toBeUndefined();
  });
  it("uses actual cross-zone arrival for an overnight transport overlap", () => {
    const trip = { ...blankTrip("owner"), start: "2030-01-01", end: "2030-01-02" };
    const flight = { ...blankItem("owner", trip, crypto.randomUUID(), trip.start),
      timeMode: "fixed" as const, time: "22:00", duration: 30,
      departureZone: "Asia/Tokyo", arrivalDay: "2030-01-02", arrivalTime: "03:00", arrivalZone: "Asia/Tokyo" };
    const nextDay = { ...blankItem("owner", trip, crypto.randomUUID(), "2030-01-02"),
      timeMode: "fixed" as const, time: "02:00", duration: 60 };
    expect(overlaps([flight, nextDay]).get(flight.id)).toContain(nextDay.id);
  });
});
