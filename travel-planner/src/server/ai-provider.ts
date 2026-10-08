type Env = (key: string) => string | undefined;
export type AiProvider = { name: "netlify-gateway" | "google-direct"; base: string; key: string };

/** Planner-only credential selection. A sibling product's generic Gemini key is never read. */
export function aiProvider(env: Env): AiProvider | null {
  if (env("TRAVEL_PLANNER_AI_ENABLED") !== "true") return null;
  if (env("TRAVEL_PLANNER_GEMINI_PROVIDER") === "google-direct") {
    const key = env("TRAVEL_PLANNER_GOOGLE_GEMINI_API_KEY");
    return key ? { name: "google-direct", base: "https://generativelanguage.googleapis.com", key } : null;
  }
  if (env("TRAVEL_PLANNER_GEMINI_PROVIDER") && env("TRAVEL_PLANNER_GEMINI_PROVIDER") !== "netlify-gateway") return null;
  const base = env("NETLIFY_AI_GATEWAY_URL"), key = env("NETLIFY_AI_GATEWAY_KEY");
  try {
    if (base && key && new URL(base).protocol === "https:")
      return { name: "netlify-gateway", base: base.replace(/\/$/, ""), key };
  } catch { /* fail closed */ }
  return null;
}

export function modelUrl(provider: AiProvider, model: string): string {
  return `${provider.base}/v1beta/models/${model}:generateContent`;
}
