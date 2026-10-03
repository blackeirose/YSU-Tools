import { describe, expect, it } from "vitest";
import { assistantActionAlreadyApplied, assistantItemId } from "../src/assistant-actions";
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
});
