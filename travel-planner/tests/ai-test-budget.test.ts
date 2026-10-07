import { describe, expect, it } from "vitest";
import { callUpperBoundMicrousd, nextBudgetDocument, reserveAiTestBudget, TEST_BUDGET_MICROUSD,
  type aiTestBudgetStore } from "../src/server/ai-test-budget";

type Store = ReturnType<typeof aiTestBudgetStore>;
function memoryStore() {
  let value: unknown = { schemaVersion: 1, campaign: "ux-gemini-20261005-usd1",
    limitMicrousd: 2_600_000, reservedMicrousd: 0, entries: [],
    grantHistory: [{ fromMicrousd: 1_000_000, toMicrousd: 2_000_000,
      atUtc: "2026-10-06T12:00:00.000Z", authorization: "synthetic first grant" },
    { fromMicrousd: 2_000_000, toMicrousd: 2_600_000,
      atUtc: "2026-10-07T12:00:00.000Z", authorization: "synthetic second grant" }] }, etag = 1;
  const store = {
    getWithMetadata: async () => value === null ? null : { data: value, etag: String(etag) },
    setJSON: async (_key: string, data: unknown, options: { onlyIfNew?: boolean; onlyIfMatch?: string }) => {
      if (options.onlyIfNew && value !== null || options.onlyIfMatch && options.onlyIfMatch !== String(etag))
        return { modified: false };
      value = data; etag++;
      return { modified: true, etag: String(etag) };
    },
  } as unknown as Store;
  return { store, read: () => value, corrupt: (next: unknown) => { value = next; } };
}
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("one-time cross-deploy AI test grant", () => {
  it("uses published worst-case token limits, including audio and both image panels", () => {
    expect(callUpperBoundMicrousd("netlify-gateway", "assist", "inference")).toBe(60_000);
    expect(callUpperBoundMicrousd("netlify-gateway", "assist", "inference", true)).toBe(110_000);
    expect(callUpperBoundMicrousd("netlify-gateway", "vision", "inference")).toBe(60_000);
    expect(callUpperBoundMicrousd("netlify-gateway", "background", "photo")).toBe(180_000);
    expect(callUpperBoundMicrousd("netlify-gateway", "background", "relief")).toBe(180_000);
    expect(callUpperBoundMicrousd("google-direct", "assist", "inference", true)).toBe(530_000);
    expect(() => callUpperBoundMicrousd("netlify-gateway", "assist", "photo")).toThrow();
  });
  it("keeps every reservation across dates, namespaces, and repeated IDs", async () => {
    const { store, read } = memoryStore();
    const first = await reserveAiTestBudget(id(1), "inference", "assist", "netlify-gateway", false, store);
    expect(first.remainingMicrousd).toBe(TEST_BUDGET_MICROUSD - 60_000);
    await expect(reserveAiTestBudget(id(1), "inference", "assist", "netlify-gateway", false, store))
      .rejects.toThrow("duplicate");
    await reserveAiTestBudget(id(1), "landmarks", "background", "netlify-gateway", false, store);
    await reserveAiTestBudget(id(1), "photo", "background", "netlify-gateway", false, store);
    const last = await reserveAiTestBudget(id(1), "relief", "background", "netlify-gateway", false, store);
    expect(last.reservedAfterMicrousd).toBe(480_000);
    expect((read() as { entries: unknown[] }).entries).toHaveLength(4);
  });
  it("records the new 5.20 grant atomically and retains all 21 prior reservations", async () => {
    const { store, read, corrupt } = memoryStore();
    const entries = Array.from({ length: 21 }, (_, index) => ({ id: id(index + 1),
      stage: index < 6 ? "photo" as const : "inference" as const,
      mode: index < 6 ? "background" as const : "assist" as const,
      upperBoundMicrousd: index < 6 ? 180_000 : index === 6 ? 110_000 : 60_000,
      atUtc: index < 4 ? "2026-10-05T12:00:00.000Z"
        : index < 14 ? "2026-10-06T12:00:00.000Z" : "2026-10-07T12:00:00.000Z" }));
    const firstGrant = { fromMicrousd: 1_000_000, toMicrousd: 2_000_000,
      atUtc: "2026-10-06T12:00:00.000Z", authorization: "synthetic first grant" };
    const secondGrant = { fromMicrousd: 2_000_000, toMicrousd: 2_600_000,
      atUtc: "2026-10-07T12:00:00.000Z", authorization: "synthetic second grant" };
    corrupt({ schemaVersion: 1, campaign: "ux-gemini-20261005-usd1",
      limitMicrousd: 2_600_000, reservedMicrousd: 2_030_000, entries,
      grantHistory: [firstGrant, secondGrant] });
    const result = await reserveAiTestBudget(id(22), "inference", "assist", "netlify-gateway", true, store);
    const after = read() as { limitMicrousd: number; reservedMicrousd: number;
      entries: typeof entries; grantHistory: Array<{ fromMicrousd: number; toMicrousd: number;
        authorization: string }> };
    expect(result.reservedAfterMicrousd).toBe(2_140_000);
    expect(after.limitMicrousd).toBe(5_200_000);
    expect(after.entries.slice(0, 21)).toEqual(entries);
    expect(after.grantHistory).toHaveLength(3);
    expect(after.grantHistory[0]).toEqual(firstGrant);
    expect(after.grantHistory[1]).toEqual(secondGrant);
    expect(after.grantHistory[2]).toMatchObject({ fromMicrousd: 2_600_000,
      toMicrousd: 5_200_000, authorization: expect.stringContaining("USD 5.20") });
    expect(() => nextBudgetDocument(after, { id: id(23), stage: "inference", mode: "assist",
      upperBoundMicrousd: 60_000, atUtc: "2026-10-07T12:00:00.000Z" }, 2_600_000, ""))
      .toThrow("corrupt");
    corrupt({ schemaVersion: 1, campaign: "ux-gemini-20261005-usd1",
      limitMicrousd: 2_000_000, reservedMicrousd: 0, entries: [], grantHistory: [firstGrant] });
    await expect(reserveAiTestBudget(id(24), "inference", "assist", "netlify-gateway", false, store))
      .rejects.toThrow("prior-grant-missing");
  });
  it("serializes parallel calls and refuses a call that cannot fit", async () => {
    const { store, read } = memoryStore();
    const results = await Promise.all(Array.from({ length: 7 }, (_, n) =>
      reserveAiTestBudget(id(n + 1), "photo", "background", "netlify-gateway", false, store)
        .then(() => "accepted", () => "rejected")));
    expect(results.filter((result) => result === "accepted")).toHaveLength(7);
    for (let n = 8; n <= 11; n++)
      await reserveAiTestBudget(id(n), "photo", "background", "netlify-gateway", false, store);
    await expect(reserveAiTestBudget(id(12), "photo", "background", "netlify-gateway", false, store))
      .rejects.toThrow("daily-exhausted");
    expect((read() as { reservedMicrousd: number }).reservedMicrousd).toBe(1_980_000);
  });
  it("refuses corrupt or inaccessible storage without refunding any prior call", async () => {
    const { store, corrupt } = memoryStore();
    await reserveAiTestBudget(id(1), "inference", "assist", "netlify-gateway", false, store);
    corrupt({ reservedMicrousd: 0, entries: [] });
    await expect(reserveAiTestBudget(id(2), "inference", "assist", "netlify-gateway", false, store))
      .rejects.toThrow("corrupt");
    const broken = { getWithMetadata: async () => { throw new Error("offline"); } } as unknown as Store;
    await expect(reserveAiTestBudget(id(3), "inference", "assist", "netlify-gateway", false, broken))
      .rejects.toThrow("offline");
    corrupt(null);
    await expect(reserveAiTestBudget(id(4), "inference", "assist", "netlify-gateway", false, store))
      .rejects.toThrow("missing");
  });
  it("prepares a future explicit grant in the same CAS write without losing old reservations", () => {
    const atUtc = "2026-10-06T12:00:00.000Z";
    const entries = [60_000, 180_000, 60_000, 60_000, 60_000, 180_000, 60_000]
      .map((upperBoundMicrousd, index) => ({ id: id(index + 1), stage: "inference" as const,
        mode: "assist" as const, upperBoundMicrousd,
        atUtc: index < 4 ? "2026-10-05T12:00:00.000Z" : atUtc }));
    const old = { schemaVersion: 1 as const, campaign: "ux-gemini-20261005-usd1",
      limitMicrousd: 1_000_000, reservedMicrousd: 660_000, entries };
    const next = { id: id(8), stage: "photo" as const, mode: "background" as const,
      upperBoundMicrousd: 180_000, atUtc };
    expect(() => nextBudgetDocument(old, next, 2_000_000, "")).toThrow("grant-unapproved");
    const granted = nextBudgetDocument(old, next, 2_000_000, "synthetic owner grant");
    expect(granted.limitMicrousd).toBe(2_000_000);
    expect(granted.reservedMicrousd).toBe(840_000);
    expect(granted.entries.slice(0, 7)).toEqual(entries);
    expect(granted.grantHistory).toEqual([{ fromMicrousd: 1_000_000,
      toMicrousd: 2_000_000, atUtc, authorization: "synthetic owner grant" }]);
    expect(() => nextBudgetDocument(granted, { ...next, id: id(9) }, 1_000_000, ""))
      .toThrow("corrupt"); // old runtime fails closed after a new cap is recorded
    expect(() => nextBudgetDocument(granted, next, 2_000_000, "synthetic owner grant"))
      .toThrow("duplicate");
    const continued = nextBudgetDocument(granted, { ...next, id: id(9) }, 2_000_000, "");
    expect(continued.grantHistory).toHaveLength(1);
    expect(continued.reservedMicrousd).toBe(1_020_000);
    expect(() => nextBudgetDocument({ ...granted, grantHistory: [] },
      { ...next, id: id(10) }, 2_000_000, "")).toThrow("corrupt");
  });
  it("keeps the first grant and all entries if a second grant is later authorized", () => {
    const previous = Array.from({ length: 12 }, (_, index) => ({ id: id(index + 1),
      stage: index < 4 ? "photo" as const : "inference" as const,
      mode: index < 4 ? "background" as const : "assist" as const,
      upperBoundMicrousd: index < 4 ? 180_000 : 60_000,
      atUtc: index < 4 ? "2026-10-05T12:00:00.000Z" : "2026-10-06T12:00:00.000Z" }));
    const firstGrant = { fromMicrousd: 1_000_000, toMicrousd: 2_000_000,
      atUtc: "2026-10-06T12:00:00.000Z", authorization: "synthetic first grant" };
    const before = { schemaVersion: 1 as const, campaign: "ux-gemini-20261005-usd1",
      limitMicrousd: 2_000_000, reservedMicrousd: 1_200_000,
      entries: previous, grantHistory: [firstGrant] };
    const next = { id: id(13), stage: "photo" as const, mode: "background" as const,
      upperBoundMicrousd: 180_000, atUtc: "2026-10-07T00:00:00.000Z" };
    expect(() => nextBudgetDocument(before, next, 2_600_000, ""))
      .toThrow("grant-unapproved");
    const after = nextBudgetDocument(before, next, 2_600_000, "synthetic second grant");
    expect(after.entries.slice(0, 12)).toEqual(previous);
    expect(after.reservedMicrousd).toBe(1_380_000);
    expect(after.grantHistory).toEqual([firstGrant, { fromMicrousd: 2_000_000,
      toMicrousd: 2_600_000, atUtc: next.atUtc, authorization: "synthetic second grant" }]);
    expect(() => nextBudgetDocument(after, { ...next, id: id(14) }, 2_000_000, ""))
      .toThrow("corrupt"); // rollback cannot erase or ignore the new grant
  });
  it("applies the published worst-case cap per UTC day even after a campaign grant", () => {
    const dayOne = "2026-10-06T23:59:59.000Z";
    const dayTwo = "2026-10-07T00:00:00.000Z";
    const old = { schemaVersion: 1 as const, campaign: "ux-gemini-20261005-usd1",
      limitMicrousd: 2_600_000, reservedMicrousd: 1_940_000,
      entries: [{ id: id(1), stage: "photo" as const, mode: "background" as const,
        upperBoundMicrousd: 1_940_000, atUtc: dayOne }],
      grantHistory: [{ fromMicrousd: 1_000_000, toMicrousd: 2_000_000,
        atUtc: dayOne, authorization: "synthetic owner grant" },
      { fromMicrousd: 2_000_000, toMicrousd: 2_600_000,
        atUtc: dayOne, authorization: "synthetic second grant" }] };
    const next = { id: id(2), stage: "inference" as const, mode: "assist" as const,
      upperBoundMicrousd: 60_000, atUtc: dayOne };
    const fullDay = nextBudgetDocument(old, next, 2_600_000, "");
    expect(fullDay.reservedMicrousd).toBe(2_000_000);
    expect(() => nextBudgetDocument(fullDay, { ...next, id: id(3) }, 2_600_000, ""))
      .toThrow("daily-exhausted");
    const newDay = nextBudgetDocument(fullDay, { ...next, id: id(4), atUtc: dayTwo },
      2_600_000, "");
    expect(newDay.reservedMicrousd).toBe(2_060_000);
    expect(() => nextBudgetDocument({ ...old, entries: [{ ...old.entries[0], atUtc: "bad" }] },
      next, 2_600_000, "")).toThrow("corrupt");
  });
});


