import { getStore } from "@netlify/blobs";

// This one-time Owner grant starts with this release candidate. It is shared by
// preview and production deploys of the same Netlify site and never resets by
// day, namespace, deploy, or request ID. Missing/corrupt storage fails closed.
const KEY = "ux-gemini-20261005-usd1";
export const TEST_BUDGET_MICROUSD = 1_000_000;
export const aiTestBudgetStore = () => getStore({ name: "travel-planner-ai-test-budget-v1", consistency: "strong" });
type Store = ReturnType<typeof aiTestBudgetStore>;
type Stage = "inference" | "landmarks" | "photo" | "relief";
type Mode = "assist" | "explore" | "vision" | "background";
type Provider = "netlify-gateway" | "google-direct";
type Entry = { id: string; stage: Stage; mode: Mode; upperBoundMicrousd: number; atUtc: string };
type Document = { schemaVersion: 1; campaign: typeof KEY; limitMicrousd: number;
  reservedMicrousd: number; entries: Entry[] };

/** Worst-case admitted request at the provider's published rate on 2026-10-05.
 * Gateway input is limited to 200k tokens; direct Flash-Lite is limited to
 * 1,048,576 input tokens; direct Lite Image to 131,072. Output is explicitly
 * capped at 1,200/2,200 text tokens; the image model has a hard 4,096-token
 * output limit. The image bound
 * prices *every* output token at the $30/M image rate, including any text.
 * Search grounding is intentionally absent: model-chosen query fan-out has
 * no published maximum and cannot fit a hard per-request budget.
 * https://docs.netlify.com/build/ai-gateway/overview/#limitations
 * https://ai.google.dev/gemini-api/docs/pricing
 */
export function callUpperBoundMicrousd(provider: Provider, mode: Mode, stage: Stage,
  hasAudio = false): number {
  const image = stage === "photo" || stage === "relief";
  if (image && mode !== "background" || stage === "landmarks" && mode !== "background" ||
    stage === "inference" && mode === "background") throw new Error("test-budget-call-shape");
  const inputMax = provider === "netlify-gateway" ? 200_000 : image ? 131_072 : 1_048_576;
  const outputMax = image ? 4_096 : mode === "explore" || mode === "vision" ? 2_200 : 1_200;
  const inputRate = hasAudio ? 0.5 : 0.25;
  const outputRate = image ? 30 : 1.5;
  const upper = inputMax * inputRate + outputMax * outputRate; // USD/M tokens => micro-USD
  return Math.ceil(upper / 10_000) * 10_000; // round up to a whole cent
}

function valid(doc: unknown): doc is Document {
  const value = doc as Partial<Document> | null;
  return !!value && value.schemaVersion === 1 && value.campaign === KEY &&
    value.limitMicrousd === TEST_BUDGET_MICROUSD &&
    Number.isSafeInteger(value.reservedMicrousd) && value.reservedMicrousd! >= 0 &&
    value.reservedMicrousd! <= TEST_BUDGET_MICROUSD && Array.isArray(value.entries) &&
    value.entries.every((entry) => entry && /^[0-9a-f-]{36}$/i.test(entry.id) &&
      ["inference", "landmarks", "photo", "relief"].includes(entry.stage) &&
      Number.isSafeInteger(entry.upperBoundMicrousd) && entry.upperBoundMicrousd > 0) &&
    value.entries.reduce((sum, entry) => sum + entry.upperBoundMicrousd, 0) === value.reservedMicrousd;
}

/** Atomic, permanent reservation before any paid request. CAS serializes
 * concurrent Functions; even a timeout or provider failure keeps its bound. */
export async function reserveAiTestBudget(id: string, stage: Stage, mode: Mode,
  provider: Provider, hasAudio = false, store: Store = aiTestBudgetStore()): Promise<{
  upperBoundMicrousd: number; reservedAfterMicrousd: number; remainingMicrousd: number }> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("test-budget-id");
  const upperBoundMicrousd = callUpperBoundMicrousd(provider, mode, stage, hasAudio);
  for (let attempt = 0; attempt < 8; attempt++) {
    const previous = await store.getWithMetadata(KEY, { type: "json", consistency: "strong" });
    if (previous && !valid(previous.data)) throw new Error("test-budget-corrupt");
    const before: Document = previous?.data as Document ?? {
      schemaVersion: 1, campaign: KEY, limitMicrousd: TEST_BUDGET_MICROUSD,
      reservedMicrousd: 0, entries: [],
    };
    if (before.entries.some((entry) => entry.id === id && entry.stage === stage))
      throw new Error("test-budget-duplicate");
    if (before.reservedMicrousd + upperBoundMicrousd > TEST_BUDGET_MICROUSD)
      throw new Error("test-budget-exhausted");
    const after: Document = { ...before, reservedMicrousd: before.reservedMicrousd + upperBoundMicrousd,
      entries: [...before.entries, { id, stage, mode, upperBoundMicrousd, atUtc: new Date().toISOString() }] };
    const write = await store.setJSON(KEY, after, previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true });
    if (write.modified) return { upperBoundMicrousd, reservedAfterMicrousd: after.reservedMicrousd,
      remainingMicrousd: TEST_BUDGET_MICROUSD - after.reservedMicrousd };
  }
  throw new Error("test-budget-concurrent");
}
