import { describe, expect, it, vi } from "vitest";
import { aiLedgerStore, beginAiUsage, finishAiUsage } from "../src/server/ai-ledger";

const event = { id: "00000000-0000-4000-8000-000000000001", mode: "assist", stage: "inference",
  provider: "netlify-gateway", model: "gemini-3.1-flash-lite",
  atUtc: "2026-10-05T00:00:00.000Z", result: "sent-charge-unknown" };

function ledger(failWrite = false) {
  const rows = new Map<string, { data: unknown; etag: string }>();
  let next = 0;
  const store = { setJSON: async (key: string, data: unknown,
    options: { onlyIfNew?: boolean; onlyIfMatch?: string }) => {
    if (failWrite) throw new Error("storage-unavailable");
    const before = rows.get(key);
    if ((options.onlyIfNew && before) || (options.onlyIfMatch && before?.etag !== options.onlyIfMatch))
      return { modified: false };
    const etag = String(++next);
    rows.set(key, { data, etag });
    return { modified: true, etag };
  } } as unknown as ReturnType<typeof aiLedgerStore>;
  return { store, rows };
}

describe("durable, private AI call ledger", () => {
  it("persists sent before the provider and then records a response with the same request/stage", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const { store, rows } = ledger();
    const receipt = await beginAiUsage("preview-v1", "owner", event, store);
    const row = rows.get(receipt.key)?.data as { result: string };
    expect(receipt.key).toBe(`preview-v1/owner/${event.id}/inference`);
    expect(row.result).toBe("sent-charge-unknown");
    await finishAiUsage(receipt, { ...event, result: "provider-returned", httpStatus: 200,
      usage: { promptTokens: 100, outputTokens: 10 } });
    expect((rows.get(receipt.key)?.data as { result: string }).result).toBe("provider-returned");
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  it("fails closed on a missing ledger and never reuses an existing sent stage", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(beginAiUsage("preview-v1", "owner", event, ledger(true).store)).rejects.toThrow("storage-unavailable");
    const { store } = ledger();
    await beginAiUsage("preview-v1", "owner", event, store);
    await expect(beginAiUsage("preview-v1", "owner", event, store)).rejects.toThrow("duplicate");
    expect(log).toHaveBeenCalledTimes(1);
    log.mockRestore();
  });

  it("keeps an unresolved sent record when the response update is refused", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { store, rows } = ledger();
    const receipt = await beginAiUsage("preview-v1", "owner", event, store);
    await finishAiUsage({ ...receipt, etag: "stale" }, { ...event, result: "provider-returned" });
    expect((rows.get(receipt.key)?.data as { result: string }).result).toBe("sent-charge-unknown");
    expect(warn).toHaveBeenCalledOnce();
    log.mockRestore(); warn.mockRestore();
  });
});
