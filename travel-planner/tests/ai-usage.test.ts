import { describe, expect, it, vi } from "vitest";
import { aiUsageEntry, logAiUsage } from "../src/server/ai-usage";

const event = { id: "request-1", mode: "assist", stage: "inference", provider: "gateway",
  model: "gemini-3.1-flash-lite", atUtc: "2026-10-05T00:00:00.000Z", result: "provider-returned" };

describe("metadata-only AI accounting", () => {
  it("keeps an unreturned call charge-unknown and does not mistake a reservation for a bill", () => {
    const entry = aiUsageEntry({ ...event, result: "sent-charge-unknown", dailyReservationAfterMicrousd: 270000 });
    expect(entry.estimatedTokenUsd).toBeNull();
    expect(entry.completeCostUpperBound).toBe(false);
    expect(entry.dailyReservationAfterMicrousd).toBe(270000);
  });

  it("estimates known token rates while clearly marking incomplete cost", () => {
    const entry = aiUsageEntry({ ...event, usage: { promptTokens: 1000, outputTokens: 200 } });
    expect(entry.estimatedTokenUsd).toBe(0.00055);
    expect(entry.completeCostUpperBound).toBe(false);
    expect(entry.usage.totalTokens).toBeNull();
  });

  it("logs only structured metadata and rejects invalid token counts", () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    logAiUsage({ ...event, usage: { promptTokens: -1, outputTokens: Number.NaN } });
    expect(log).toHaveBeenCalledOnce();
    const [, entry] = log.mock.calls[0];
    expect(Object.keys(entry as object).sort()).toEqual([
      "atUtc", "completeCostUpperBound", "estimated", "estimatedTokenUsd", "id", "mode", "model",
      "pricingBasis", "provider", "result", "schemaVersion", "stage", "usage",
    ]);
    expect((entry as ReturnType<typeof aiUsageEntry>).estimatedTokenUsd).toBeNull();
    log.mockRestore();
  });
});
