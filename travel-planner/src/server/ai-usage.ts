/** Metadata-only AI accounting. A sent call without a later result stays charge-unknown. */
export type AiUsage = { promptTokens: number | null; outputTokens: number | null; totalTokens?: number | null };
export type AiUsageEvent = {
  id: string;
  mode: string;
  stage: string;
  provider: string;
  model: string;
  atUtc: string;
  result: string;
  httpStatus?: number;
  providerErrorStatus?: "INVALID_ARGUMENT" | "FAILED_PRECONDITION" | "NOT_FOUND" |
    "PERMISSION_DENIED" | "RESOURCE_EXHAUSTED" | "UNAVAILABLE" | "INTERNAL";
  providerErrorCategory?: "unknown-field" | "unsupported-modality" | "unsupported-model" |
    "invalid-aspect-ratio" | "quota" | "unclassified";
  providerErrorField?: "responseFormat" | "responseJsonSchema" | "responseSchema" | "imageConfig" |
    "responseModalities" | "candidateCount" | "maxOutputTokens" | "imageSize" |
    "inlineData" | "mimeType" | "model";
  dailyReservationAfterMicrousd?: number;
  testBudgetReservedAfterMicrousd?: number;
  usage?: AiUsage;
  hasAudio?: boolean;
};

const googlePricing = "https://ai.google.dev/gemini-api/docs/pricing";
const netlifyPricing = "https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/pricing-for-ai-features/";
const tokenRate = (model: string, hasAudio: boolean) => model === "gemini-3.1-flash-lite-image"
  ? { input: 0.25, output: 30 }
  : model === "gemini-3.1-flash-lite"
    ? { input: hasAudio ? 0.5 : 0.25, output: 1.5 }
    : null;
const safeCount = (value: number | null | undefined) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;

export function aiUsageEntry(event: AiUsageEvent) {
  const rate = tokenRate(event.model, !!event.hasAudio);
  const input = safeCount(event.usage?.promptTokens);
  const output = safeCount(event.usage?.outputTokens);
  // Search fan-out, mixed audio tokens, image output details and Gateway billing
  // may be absent. This estimate is NEVER a complete cost or budget upper bound.
  const estimatedTokenUsd = rate && input !== null && output !== null
    ? Number(((input * rate.input + output * rate.output) / 1_000_000).toFixed(8)) : null;
  return { schemaVersion: 1, id: event.id, mode: event.mode, stage: event.stage,
    provider: event.provider, model: event.model, atUtc: event.atUtc, result: event.result,
    ...(event.httpStatus === undefined ? {} : { httpStatus: event.httpStatus }),
    ...(event.providerErrorStatus ? { providerErrorStatus: event.providerErrorStatus } : {}),
    ...(event.providerErrorCategory ? { providerErrorCategory: event.providerErrorCategory } : {}),
    ...(event.providerErrorField ? { providerErrorField: event.providerErrorField } : {}),
    ...(event.dailyReservationAfterMicrousd === undefined ? {} :
      { dailyReservationAfterMicrousd: event.dailyReservationAfterMicrousd }),
    ...(event.testBudgetReservedAfterMicrousd === undefined ? {} :
      { testBudgetReservedAfterMicrousd: event.testBudgetReservedAfterMicrousd }),
    usage: { promptTokens: input, outputTokens: output, totalTokens: safeCount(event.usage?.totalTokens) },
    estimatedTokenUsd, estimated: estimatedTokenUsd !== null, completeCostUpperBound: false,
    pricingBasis: { asOf: "2026-10-05", googlePricing, netlifyPricing, netlifyCreditsPerUsd: 180 },
  };
}

export function logAiUsage(event: AiUsageEvent) {
  console.info("travel-planner-ai-usage", aiUsageEntry(event));
}
