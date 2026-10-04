import { describe, expect, it } from "vitest";
import { assistantActionAlreadyApplied, assistantDraftIds, assistantItemId, assertAssistantDraftTrip, assertAssistantMutationAllowed, assertAssistantTargetDay } from "../src/assistant-actions";
import { blankItem, blankTrip } from "../src/model";

describe("assistant action replay", () => {
  const trip = { ...blankTrip("owner"), start: "2030-01-01", end: "2030-01-03" };
  const item = blankItem("owner", trip, crypto.randomUUID(), "2030-01-01");

  it("uses a stable ID for a repeated add on another browser context", async () => {
    const fingerprint = JSON.stringify({ trip: trip.id, kind: "add", name: "東京迪士尼樂園", day: "2030-01-01", time: "09:00" });
    const first = await assistantItemId(fingerprint, 35.6329, 139.8804);
    const repeated = await assistantItemId(fingerprint, 35.6329, 139.8804);
    expect(first).toBe(repeated);
    expect(first).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    expect(await assistantItemId(fingerprint, 35.6329, 139.8805)).not.toBe(first);
  });

  it("rejects already-applied move, candidate and time edits after a reload without replacing Undo", () => {
    expect(assistantActionAlreadyApplied(item, { kind: "move", message: "", day: "2030-01-01" })).toBe(true);
    expect(assistantActionAlreadyApplied(item, { kind: "move", message: "", day: "2030-01-02" })).toBe(false);
    const candidate = { ...item, status: "candidate" as const };
    expect(assistantActionAlreadyApplied(candidate, { kind: "candidate", message: "" })).toBe(true);
    expect(assistantActionAlreadyApplied(item, { kind: "candidate", message: "" })).toBe(false);
    const timed = { ...item, timeMode: "flexible" as const, time: "09:00" };
    expect(assistantActionAlreadyApplied(timed, { kind: "edit_time", message: "", time: "09:00" })).toBe(true);
    expect(assistantActionAlreadyApplied(timed, { kind: "edit_time", message: "", time: "10:00" })).toBe(false);
  });
  it("keeps fixed reservations out of all automatic assistant schedule mutations", () => {
    const fixed = { ...item, timeMode: "fixed" as const, time: "13:00" };
    expect(() => assertAssistantMutationAllowed(fixed, { kind: "move", message: "", day: "2030-01-02" })).toThrow("固定預約");
    expect(() => assertAssistantMutationAllowed(fixed, { kind: "candidate", message: "" })).toThrow("固定預約");
    expect(() => assertAssistantMutationAllowed(fixed, { kind: "edit_time", message: "", time: "14:00" })).toThrow("固定預約");
    expect(() => assertAssistantMutationAllowed(item, { kind: "move", message: "", day: "2030-01-02" })).not.toThrow();
  });
  it("does not change a different day's item when a relative-date action passed server validation", () => {
    expect(() => assertAssistantTargetDay(item, { kind: "edit_time", message: "明天改時", day: "2030-01-02", time: "09:00" })).toThrow("2030-01-02");
    expect(() => assertAssistantTargetDay(item, { kind: "candidate", message: "明天待定", day: "2030-01-02" })).toThrow("2030-01-02");
    expect(() => assertAssistantTargetDay(item, { kind: "move", message: "移去明天", day: "2030-01-02" })).not.toThrow();
    expect(() => assertAssistantTargetDay(item, { kind: "edit_time", message: "今天改時", day: "2030-01-01", time: "09:00" })).not.toThrow();
  });
  it("binds a confirmed draft to its originating trip and reuses IDs only after an Undo tombstone", async () => {
    expect(() => assertAssistantDraftTrip(trip.id, crypto.randomUUID())).toThrow("旅程已切換");
    expect(() => assertAssistantDraftTrip(trip.id, trip.id)).not.toThrow();
    const fingerprint = JSON.stringify({ tripId: trip.id, rows: [{ day: "2030-01-01", name: "甲" }] });
    const first = await assistantDraftIds(fingerprint, 1, []);
    expect(first.alreadyAdded).toBe(false);
    const live = { ...item, id: first.ids[0], revision: 1 };
    expect((await assistantDraftIds(fingerprint, 1, [live])).alreadyAdded).toBe(true);
    const redo = await assistantDraftIds(fingerprint, 1, [{ ...live, revision: 2, deleted: true }]);
    expect(redo.alreadyAdded).toBe(false);
    expect(redo.ids[0]).not.toBe(first.ids[0]);
    expect((await assistantDraftIds(fingerprint, 1, [{ ...live, deleted: true }, { ...live, id: redo.ids[0], revision: 1 }])).alreadyAdded).toBe(true);
  });
});
