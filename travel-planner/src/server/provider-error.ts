import type { AiUsageEvent } from "./ai-usage";

/** Keep only bounded, allowlisted provider diagnostics. Raw errors may echo private input. */
export async function providerErrorDiagnostic(response: Response): Promise<Pick<AiUsageEvent,
  "providerErrorStatus" | "providerErrorCategory" | "providerErrorField" | "usage">> {
  let body = "";
  try {
    const reader = response.body?.getReader();
    if (!reader) return { providerErrorCategory: "unclassified" };
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8192) { await reader.cancel(); return { providerErrorCategory: "unclassified" }; }
      chunks.push(value);
    }
    const merged = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
    body = new TextDecoder().decode(merged);
  } catch { return { providerErrorCategory: "unclassified" }; }
  let parsed: unknown;
  try { parsed = JSON.parse(body); }
  catch { return { providerErrorCategory: "unclassified" }; }
  const payload = parsed as { error?: unknown; usageMetadata?: unknown } | null;
  const rawUsage = payload?.usageMetadata;
  const count = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
  const usage = rawUsage && typeof rawUsage === "object" ? {
    promptTokens: count((rawUsage as Record<string, unknown>).promptTokenCount),
    outputTokens: count((rawUsage as Record<string, unknown>).candidatesTokenCount),
    totalTokens: count((rawUsage as Record<string, unknown>).totalTokenCount),
  } : undefined;
  const error = payload?.error;
  if (!error || typeof error !== "object") return { providerErrorCategory: "unclassified", usage };
  const object = error as { status?: unknown; message?: unknown };
  const allowedStatuses = ["INVALID_ARGUMENT", "FAILED_PRECONDITION", "NOT_FOUND",
    "PERMISSION_DENIED", "RESOURCE_EXHAUSTED", "UNAVAILABLE", "INTERNAL"] as const;
  const providerErrorStatus = allowedStatuses.find((status) => status === object.status);
  const message = typeof object.message === "string" ? object.message.slice(0, 8192) : "";
  const allowedFields = ["responseFormat", "responseJsonSchema", "responseSchema", "imageConfig", "responseModalities",
    "candidateCount", "maxOutputTokens", "imageSize", "inlineData", "mimeType", "model"] as const;
  const providerErrorField = allowedFields.find((field) =>
    new RegExp(`(?:unknown (?:name|field)|invalid field) ["']?${field}["']?`, "i").test(message));
  const providerErrorCategory = /unknown (?:name|field)|invalid json payload/i.test(message) && providerErrorField ? "unknown-field"
    : /(?:unsupported|invalid).{0,40}modali/i.test(message) ? "unsupported-modality"
      : /(?:model.{0,40}(?:not found|unsupported)|(?:not found|unsupported).{0,40}model)/i.test(message) ? "unsupported-model"
        : /(?:invalid|unsupported).{0,40}aspect.?ratio/i.test(message) ? "invalid-aspect-ratio"
          : /quota|rate limit/i.test(message) ? "quota" : "unclassified";
  return { providerErrorStatus, providerErrorCategory, providerErrorField, usage };
}
