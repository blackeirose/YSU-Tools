import { describe, expect, it } from "vitest";
import { callUpperBoundMicrousd, reserveAiTestBudget, TEST_BUDGET_MICROUSD,
  type aiTestBudgetStore } from "../src/server/ai-test-budget";

type Store = ReturnType<typeof aiTestBudgetStore>;
function memoryStore() {
  let value: unknown = null, etag = 0;
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
  it("serializes parallel calls and refuses a call that cannot fit", async () => {
    const { store, read } = memoryStore();
    const results = await Promise.all(Array.from({ length: 7 }, (_, n) =>
      reserveAiTestBudget(id(n + 1), "photo", "background", "netlify-gateway", false, store)
        .then(() => "accepted", () => "rejected")));
    expect(results.filter((result) => result === "accepted")).toHaveLength(5);
    expect((read() as { reservedMicrousd: number }).reservedMicrousd).toBe(900_000);
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
  });
});
