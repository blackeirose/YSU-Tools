import { getStore } from "@netlify/blobs";

// This one-time Owner grant starts with this release candidate. It is shared by
// preview and production deploys of the same Netlify site and never resets by
// day, namespace, deploy, or request ID. Missing/corrupt storage fails closed.
const KEY = "ux-gemini-20261005-usd1";
const INITIAL_LIMIT_MICROUSD = 1_000_000;
export const TEST_BUDGET_MICROUSD = 2_000_000;
const DAILY_TEST_BUDGET_MICROUSD = 1_000_000;
// An incremental grant must change both this cap and the audit label in one
// reviewed source commit. Until then, the existing campaign cannot expand.
const INCREMENTAL_GRANT_LABEL = "Owner approval 2026-10-06: add at most USD 1.00 for remaining Preview acceptance, one justified retry, and post-release smoke; daily USD 1.00 unchanged";
export const aiTestBudgetStore = () => getStore({ name: "travel-planner-ai-test-budget-v1", consistency: "strong" });
type Store = ReturnType<typeof aiTestBudgetStore>;
type Stage = "inference" | "landmarks" | "photo" | "relief";
type Mode = "assist" | "explore" | "vision" | "background";
type Provider = "netlify-gateway" | "google-direct";
type Entry = { id: string; stage: Stage; mode: Mode; upperBoundMicrousd: number; atUtc: string };
type Grant = { fromMicrousd: number; toMicrousd: number; atUtc: string; authorization: string };
type Document = { schemaVersion: 1; campaign: typeof KEY; limitMicrousd: number;
  reservedMicrousd: number; entries: Entry[]; grantHistory?: Grant[] };

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

function valid(doc: unknown, authorizedLimit: number): doc is Document {
  const value = doc as Partial<Document> | null;
  if (!value || !Array.isArray(value.grantHistory ?? [])) return false;
  const lastLimit = (value.grantHistory ?? []).reduce<number>((limit, grant) =>
    limit >= INITIAL_LIMIT_MICROUSD && Number.isSafeInteger(grant.fromMicrousd) &&
    grant.fromMicrousd === limit && Number.isSafeInteger(grant.toMicrousd) &&
    grant.toMicrousd > limit && grant.toMicrousd <= authorizedLimit &&
    typeof grant.authorization === "string" && grant.authorization.length > 0 &&
    typeof grant.atUtc === "string" && !Number.isNaN(Date.parse(grant.atUtc))
      ? grant.toMicrousd : -1, INITIAL_LIMIT_MICROUSD);
  return !!value && value.schemaVersion === 1 && value.campaign === KEY &&
    value.limitMicrousd === lastLimit && value.limitMicrousd <= authorizedLimit &&
    Number.isSafeInteger(value.reservedMicrousd) && value.reservedMicrousd! >= 0 &&
    value.reservedMicrousd! <= value.limitMicrousd && Array.isArray(value.entries) &&
    value.entries.every((entry) => entry && /^[0-9a-f-]{36}$/i.test(entry.id) &&
      ["inference", "landmarks", "photo", "relief"].includes(entry.stage) &&
      Number.isSafeInteger(entry.upperBoundMicrousd) && entry.upperBoundMicrousd > 0 &&
      typeof entry.atUtc === "string" && /^\d{4}-\d\d-\d\dT.*Z$/.test(entry.atUtc) &&
      !Number.isNaN(Date.parse(entry.atUtc))) &&
    value.entries.reduce((sum, entry) => sum + entry.upperBoundMicrousd, 0) === value.reservedMicrousd;
}

/** Pure CAS transition. Raising the cap keeps every old entry and records the
 * Owner grant in the same atomic write as the first post-grant reservation. */
export function nextBudgetDocument(before: unknown, entry: Entry,
  authorizedLimit: number, grantAuthorization: string): Document {
  if (!Number.isSafeInteger(authorizedLimit) || authorizedLimit < INITIAL_LIMIT_MICROUSD ||
    !valid(before, authorizedLimit)) throw new Error("test-budget-corrupt");
  const current = before as Document;
  if (current.entries.some((old) => old.id === entry.id && old.stage === entry.stage))
    throw new Error("test-budget-duplicate");
  if (!/^\d{4}-\d\d-\d\dT.*Z$/.test(entry.atUtc) || Number.isNaN(Date.parse(entry.atUtc)))
    throw new Error("test-budget-date");
  if (current.reservedMicrousd + entry.upperBoundMicrousd > authorizedLimit)
    throw new Error("test-budget-exhausted");
  const day = entry.atUtc.slice(0, 10);
  const dailyReserved = current.entries.reduce((sum, old) =>
    sum + (old.atUtc.slice(0, 10) === day ? old.upperBoundMicrousd : 0), 0);
  if (dailyReserved + entry.upperBoundMicrousd > DAILY_TEST_BUDGET_MICROUSD)
    throw new Error("test-budget-daily-exhausted");
  if (current.limitMicrousd < authorizedLimit && !grantAuthorization.trim())
    throw new Error("test-budget-grant-unapproved");
  const grantHistory = current.limitMicrousd < authorizedLimit
    ? [...current.grantHistory ?? [], { fromMicrousd: current.limitMicrousd,
      toMicrousd: authorizedLimit, atUtc: entry.atUtc, authorization: grantAuthorization }]
    : current.grantHistory;
  return { ...current, limitMicrousd: authorizedLimit, grantHistory,
    reservedMicrousd: current.reservedMicrousd + entry.upperBoundMicrousd,
    entries: [...current.entries, entry] };
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
    // This campaign is already established. A missing store/key must not create
    // a fresh allowance and erase the seven prior reservations.
    if (!previous) throw new Error("test-budget-missing");
    const before = previous.data;
    const after = nextBudgetDocument(before,
      { id, stage, mode, upperBoundMicrousd, atUtc: new Date().toISOString() },
      TEST_BUDGET_MICROUSD, INCREMENTAL_GRANT_LABEL);
    const write = await store.setJSON(KEY, after, { onlyIfMatch: previous.etag });
    if (write.modified) return { upperBoundMicrousd, reservedAfterMicrousd: after.reservedMicrousd,
      remainingMicrousd: TEST_BUDGET_MICROUSD - after.reservedMicrousd };
  }
  throw new Error("test-budget-concurrent");
}

