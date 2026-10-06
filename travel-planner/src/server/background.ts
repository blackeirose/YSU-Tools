import { getDeployStore, getStore } from "@netlify/blobs";
import { z } from "zod";
import { gatewayReady, reserveQuota } from "./gemini";
import { BACKGROUND_STYLE_VERSION, photoPrompt, reliefPrompt } from "./background-style";
import { aiProvider, modelUrl } from "./ai-provider";
import { beginAiUsage, finishAiUsage } from "./ai-ledger";
import type { AiUsageEvent } from "./ai-usage";
import { reserveAiTestBudget } from "./ai-test-budget";
import { placeInCity, searchPhoton } from "../place-search";

type Env = (name: string) => string | undefined;
type Http = typeof fetch;
type Accounting = { id: string; ownerId: string; namespace: string; dailyReservationAfterMicrousd: number;
  providerAttempted: boolean };
type Landmark = { name: string; sourceUrl: string; sourceTitle: string; locationSourceUrl: string };
type Job = { state: "running" | "ready" | "failed"; attempts: number; city: string; startedAt: string;
  updatedAt: string; error?: string; model?: string; styleVersion?: string; landmarks?: Landmark[];
  attemptAccountingVersion?: 2; requestId?: string; blockedRequestRevision?: number };
// A provider 400 must not send the identical paid request again. Bump only
// after reviewing and changing the image request contract in a later release.
const IMAGE_REQUEST_REVISION = 1;
const json = (code: number, body: unknown) => new Response(JSON.stringify(body), { status: code,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
const input = z.object({ tripId: z.string().uuid() });
const STORE = "travel-planner-background-v1";
const QUOTA_ERROR = "今日用量已滿或無法安全預留";
export const backgroundStore = (env: Env) => env("TRAVEL_PLANNER_FIREBASE_NAMESPACE") === "preview-v1"
  ? getDeployStore({ name: STORE, consistency: "strong" })
  : getStore({ name: STORE, consistency: "strong" });
const keyFor = (namespace: string, uid: string, tripId: string) => `${namespace}/${uid}/${tripId}`;

export async function ownerTrip(req: Request, env: Env, http: Http = fetch, requireCity = true) {
  const token = req.headers.get("Authorization")?.match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];
  if (!token) return { error: json(401, { error: "請先私人登入" }) } as const;
  const project = env("TRAVEL_PLANNER_FIREBASE_PROJECT_ID"), webKey = env("TRAVEL_PLANNER_FIREBASE_WEB_KEY"),
    ownerId = env("TRAVEL_PLANNER_AI_OWNER_UID"), namespace = env("TRAVEL_PLANNER_FIREBASE_NAMESPACE");
  if (!project || !webKey || !ownerId || !["v1", "preview-v1"].includes(namespace ?? ""))
    return { error: json(503, { error: "Planner 服務設定不完整" }) } as const;
  const tripId = new URL(req.url).searchParams.get("tripId");
  const parsed = input.safeParse({ tripId });
  if (!parsed.success) return { error: json(400, { error: "旅程識別不正確" }) } as const;
  const account = await http(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(webKey)}`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }), signal: AbortSignal.timeout(8000) });
  if (!account.ok) return { error: json(401, { error: "登入已失效" }) } as const;
  const identity = await account.json() as { users?: { localId: string }[] };
  if (identity.users?.[0]?.localId !== ownerId) return { error: json(403, { error: "此帳號沒有背景圖片權限" }) } as const;
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(project)}/databases/(default)/documents/travelPlanner/${namespace}/users/${encodeURIComponent(ownerId)}`;
  const read = await http(`${base}/records/${parsed.data.tripId}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
  if (!read.ok) return { error: json(403, { error: "無法讀取此私人旅程" }) } as const;
  const record = await read.json() as { fields?: Record<string, { stringValue?: string; booleanValue?: boolean; mapValue?: { fields?: Record<string, { mapValue?: { fields?: Record<string, { stringValue?: string; doubleValue?: number; integerValue?: string }> } }> } }> };
  if (record.fields?.ownerId?.stringValue !== ownerId || record.fields?.kind?.stringValue !== "trip" || record.fields?.deleted?.booleanValue)
    return { error: json(403, { error: "旅程 ownership 不符" }) } as const;
  const start = record.fields?.start?.stringValue ?? "";
  const dayCity = record.fields?.dayCities?.mapValue?.fields?.[start]?.mapValue?.fields;
  const city = dayCity?.name?.stringValue?.trim() ?? "";
  const coordinate = (value: { doubleValue?: number; integerValue?: string } | undefined) =>
    value?.doubleValue ?? (value?.integerValue === undefined ? NaN : Number(value.integerValue));
  const latitude = coordinate(dayCity?.lat), longitude = coordinate(dayCity?.lng);
  // Only a city that the owner explicitly assigned to the first day is used.
  if (requireCity && (!city || city.length > 100 || !dayCity?.timezone?.stringValue ||
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180))
    return { error: json(409, { error: "請先確認旅程第一天的城市與位置，才能生成代表背景" }) } as const;
  return { value: { key: keyFor(namespace!, ownerId, parsed.data.tripId), city, token, base, uid: ownerId } } as const;
}

type Store = ReturnType<typeof backgroundStore>;
async function readJob(store: Store, key: string) {
  return store.getWithMetadata(`${key}/job`, { type: "json", consistency: "strong" }) as Promise<{ data: Job; etag: string } | null>;
}
function safeImage(raw: unknown): { mime: "image/jpeg" | "image/png"; data: Uint8Array } {
  const value = raw as { candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string } }[] } }[] };
  const image = value.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
  if (!image?.data || !["image/jpeg", "image/png"].includes(image.mimeType ?? "")) throw new Error("image-output");
  const data = Uint8Array.from(Buffer.from(image.data, "base64"));
  if (data.length < 1000 || data.length > 3_000_000) throw new Error("image-size");
  return { mime: image.mimeType as "image/jpeg" | "image/png", data };
}
async function providerErrorDiagnostic(response: Response): Promise<Pick<AiUsageEvent,
  "providerErrorStatus" | "providerErrorCategory" | "providerErrorField" | "usage">> {
  // Never persist or log the raw provider body: it can echo a private prompt.
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
  const allowedFields = ["responseFormat", "imageConfig", "responseModalities",
    "candidateCount", "maxOutputTokens", "imageSize", "model"] as const;
  const providerErrorField = allowedFields.find((field) =>
    new RegExp(`(?:unknown (?:name|field)|invalid field) ["']?${field}["']?`, "i").test(message));
  const providerErrorCategory = /unknown (?:name|field)|invalid json payload/i.test(message) && providerErrorField ? "unknown-field"
    : /(?:unsupported|invalid).{0,40}modali/i.test(message) ? "unsupported-modality"
      : /(?:model.{0,40}(?:not found|unsupported)|(?:not found|unsupported).{0,40}model)/i.test(message) ? "unsupported-model"
        : /(?:invalid|unsupported).{0,40}aspect.?ratio/i.test(message) ? "invalid-aspect-ratio"
          : /quota|rate limit/i.test(message) ? "quota" : "unclassified";
  return { providerErrorStatus, providerErrorCategory, providerErrorField, usage };
}
async function generate(http: Http, env: Env, prompt: string, accounting: Accounting,
  stage: "photo" | "relief",
  reference?: { mime: string; data: Uint8Array }) {
  const provider = aiProvider(env)!;
  const trace = { id: accounting.id, mode: "background", stage, provider: provider.name,
    model: "gemini-3.1-flash-lite-image", atUtc: new Date().toISOString(),
    dailyReservationAfterMicrousd: accounting.dailyReservationAfterMicrousd };
  const testBudget = await reserveAiTestBudget(accounting.id, stage, "background", provider.name);
  const parts = [{ text: prompt }, ...(reference ? [{ inlineData: {
    mimeType: reference.mime, data: Buffer.from(reference.data).toString("base64") } }] : [])];
  // Keep the two panels at the documented 3:2 ratio. Leave the size and
  // modalities at model defaults while the gateway's prior 400 is unresolved.
  const body = { contents: [{ role: "user", parts }],
    generationConfig: { imageConfig: { aspectRatio: "3:2" } } };
  const receipt = await beginAiUsage(accounting.namespace, accounting.ownerId,
    { ...trace, testBudgetReservedAfterMicrousd: testBudget.reservedAfterMicrousd, result: "sent-charge-unknown" });
  accounting.providerAttempted = true;
  const response = await http(modelUrl(provider, "gemini-3.1-flash-lite-image"),
    { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": provider.key },
      body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  if (!response.ok) {
    const diagnostic = await providerErrorDiagnostic(response);
    await finishAiUsage(receipt, { ...trace, testBudgetReservedAfterMicrousd: testBudget.reservedAfterMicrousd, atUtc: new Date().toISOString(),
      result: "http-error-charge-unknown", httpStatus: response.status, ...diagnostic });
    throw new Error(`image-service-${response.status}`);
  }
  const output = await response.json() as { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }; candidates?: unknown[] };
  await finishAiUsage(receipt, { ...trace, testBudgetReservedAfterMicrousd: testBudget.reservedAfterMicrousd,
    atUtc: new Date().toISOString(), result: "provider-returned", httpStatus: response.status,
    usage: { promptTokens: output.usageMetadata?.promptTokenCount ?? null,
      outputTokens: output.usageMetadata?.candidatesTokenCount ?? null } });
  return safeImage(output);
}

async function groundedLandmarks(http: Http, env: Env, city: string, accounting: Accounting): Promise<Landmark[]> {
  const provider = aiProvider(env)!;
  const trace = { id: accounting.id, mode: "background", stage: "landmarks", provider: provider.name,
    model: "gemini-3.1-flash-lite", atUtc: new Date().toISOString(),
    dailyReservationAfterMicrousd: accounting.dailyReservationAfterMicrousd };
  const testBudget = await reserveAiTestBudget(accounting.id, "landmarks", "background", provider.name);
  const body = { systemInstruction: { parts: [{ text: "Propose 5–8 possible distinctive landmarks in the specified city from general knowledge. Return JSON only: {landmarks:[{name,searchName}]}. name is the local display name; searchName is the landmark's common English OpenStreetMap name, or the same name if no English form is known. These are unverified candidates: the server independently checks exact names and city against OpenStreetMap/Photon and uses only 3–4 verified landmarks before image generation. Omit uncertain names; never invent sources or coordinates." }] },
    contents: [{ role: "user", parts: [{ text: JSON.stringify({ city }) }] }],
    generationConfig: { responseMimeType: "application/json", responseJsonSchema: { type: "object",
      properties: { landmarks: { type: "array", minItems: 3, maxItems: 8,
        items: { type: "object", properties: { name: { type: "string" }, searchName: { type: "string" } },
          required: ["name", "searchName"] } } },
      required: ["landmarks"] }, candidateCount: 1, maxOutputTokens: 1200 } };
  const receipt = await beginAiUsage(accounting.namespace, accounting.ownerId,
    { ...trace, testBudgetReservedAfterMicrousd: testBudget.reservedAfterMicrousd, result: "sent-charge-unknown" });
  accounting.providerAttempted = true;
  const response = await http(modelUrl(provider, "gemini-3.1-flash-lite"), {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": provider.key },
    body: JSON.stringify(body), signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    await finishAiUsage(receipt, { ...trace, testBudgetReservedAfterMicrousd: testBudget.reservedAfterMicrousd, atUtc: new Date().toISOString(),
      result: "http-error-charge-unknown", httpStatus: response.status });
    throw new Error("landmark-service");
  }
  const output = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } };
  await finishAiUsage(receipt, { ...trace, testBudgetReservedAfterMicrousd: testBudget.reservedAfterMicrousd,
    atUtc: new Date().toISOString(), result: "provider-returned", httpStatus: response.status,
    usage: { promptTokens: output.usageMetadata?.promptTokenCount ?? null,
      outputTokens: output.usageMetadata?.candidatesTokenCount ?? null } });
  const candidate = output.candidates?.[0];
  let parsed: unknown;
  try { parsed = JSON.parse(candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? ""); }
  catch { throw new Error("landmark-output"); }
  const result = z.object({ landmarks: z.array(z.object({ name: z.string().trim().min(2).max(100),
    searchName: z.string().trim().min(2).max(100) })).min(3).max(8) }).safeParse(parsed);
  const normalize = (text: string) => text.normalize("NFKD").toLocaleLowerCase()
    .replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]/gu, "");
  if (!result.success)
    throw new Error("landmark-unverified");
  // Search snippets and titles are not reliable proof of a location. Photon
  // supplies the independent, place-specific OSM source for every landmark.
  const verified: Landmark[] = [];
  const seenNames = new Set<string>();
  const seenPlaces = new Set<string>();
  for (const landmark of result.data.landmarks) {
    if (seenNames.has(normalize(landmark.searchName))) continue;
    seenNames.add(normalize(landmark.searchName));
    let place: Awaited<ReturnType<typeof searchPhoton>>[number] | undefined;
    for (const name of [...new Set([landmark.searchName, landmark.name])]) {
      let places;
      try { places = await searchPhoton(name, city, true, http, undefined, 20); }
      catch { continue; }
      const exact = places.filter((found) => normalize(found.name) === normalize(name) && placeInCity(found, city));
      place = exact.length === 1 ? exact[0] : undefined;
      if (place) break;
    }
    if (!place || seenPlaces.has(place.osmUrl)) continue;
    seenPlaces.add(place.osmUrl);
    verified.push({ name: place.name, sourceUrl: place.osmUrl,
      sourceTitle: "OpenStreetMap / Photon", locationSourceUrl: place.osmUrl });
    if (verified.length === 4) break;
  }
  if (verified.length < 3) throw new Error("landmark-location-unverified");
  return verified;
}

export async function startBackground(req: Request, env: Env, http: Http = fetch, store: Store = backgroundStore(env)) {
  if (req.method !== "POST") return json(405, { error: "只接受 POST" });
  if (!req.headers.get("Authorization")?.match(/^Bearer ([A-Za-z0-9._-]+)$/))
    return json(401, { error: "請先私人登入" });
  if (!gatewayReady(env)) return json(503, { error: "Planner 圖片服務尚未啟用" });
  let owner: Awaited<ReturnType<typeof ownerTrip>>;
  try { owner = await ownerTrip(req, env, http); }
  catch { return json(503, { error: "無法驗證私人旅程，本次未生成圖片" }); }
  if ("error" in owner) return owner.error;
  const { key, city, token, base, uid } = owner.value;
  const now = new Date();
  let previous = await readJob(store, key);
  if (previous?.data.state === "ready") return json(200, { state: "ready", city: previous.data.city,
    originalCityRetained: city !== previous.data.city });
  if (previous?.data.state === "running" && now.getTime() - Date.parse(previous.data.startedAt) < 20 * 60_000)
    return json(202, { state: "running", city: previous.data.city });
  if (previous?.data.state === "failed" && previous.data.blockedRequestRevision === IMAGE_REQUEST_REVISION)
    return json(409, { error: "圖片請求已被服務拒絕；相同版本不會再次送出，行程仍可使用" });
  // Older jobs counted a quota refusal as a generation attempt. It made two
  // zero-provider-call refusals permanently exhaust a trip's retry allowance.
  const paidAttempts = Math.max(0, (previous?.data.attempts ?? 0) -
    (previous?.data.error === QUOTA_ERROR && previous.data.attemptAccountingVersion !== 2 ? 1 : 0));
  if (paidAttempts >= 2)
    return json(409, { error: "背景已重試兩次；原行程仍可使用，請聯絡維護者" });
  // The first panel may already be stored. A retry must use the same city for
  // both panels even when the first-day itinerary has changed meanwhile.
  const renderingCity = previous?.data.city ?? city;
  let job: Job = { state: "running", attempts: paidAttempts + 1, attemptAccountingVersion: 2,
    city: renderingCity, startedAt: now.toISOString(), updatedAt: now.toISOString(), styleVersion: BACKGROUND_STYLE_VERSION,
    landmarks: previous?.data.landmarks, requestId: crypto.randomUUID() };
  const write = await store.setJSON(`${key}/job`, job, previous ? { onlyIfMatch: previous.etag } : { onlyIfNew: true });
  if (!write.modified) return json(202, { state: "running" });
  let jobEtag = write.etag!;
  // Reserve before any paid call. A failure keeps the reservation conservative.
  let dailyReservationAfterMicrousd: number;
  try { dailyReservationAfterMicrousd = (await reserveQuota(http, base, token, uid, "background", now)).reservedMicrousd; }
  catch {
    await store.setJSON(`${key}/job`, { ...job, state: "failed", attempts: paidAttempts,
      error: QUOTA_ERROR }, { onlyIfMatch: jobEtag });
    return json(429, { error: "今日用量已滿或無法安全預留；未呼叫 Gemini" });
  }
  const accounting: Accounting = { id: job.requestId!, ownerId: uid,
    namespace: env("TRAVEL_PLANNER_FIREBASE_NAMESPACE")!, dailyReservationAfterMicrousd,
    providerAttempted: false };
  try {
    if (!job.landmarks) {
      const landmarks = await groundedLandmarks(http, env, renderingCity, accounting);
      job = { ...job, landmarks, updatedAt: new Date().toISOString() };
      const saved = await store.setJSON(`${key}/job`, job, { onlyIfMatch: jobEtag });
      if (!saved.modified) throw new Error("landmark-concurrent");
      jobEtag = saved.etag!;
    }
    const names = job.landmarks!.map((landmark) => landmark.name);
    // Skill 021 adaptation: two independent 3:2 panels. The first output is
    // preserved byte-for-byte; the lower relief uses it only as reference.
    const existingTop = await store.getWithMetadata(`${key}/top`, { type: "arrayBuffer", consistency: "strong" });
    const top = existingTop ? { data: new Uint8Array(existingTop.data), mime: String(existingTop.metadata?.mime ?? "image/jpeg") }
      : await generate(http, env, photoPrompt(renderingCity, names), accounting, "photo");
    if (!existingTop) await store.set(`${key}/top`, Uint8Array.from(top.data).buffer, { metadata: { mime: top.mime }, onlyIfNew: true });
    const existingLower = await store.getWithMetadata(`${key}/lower`, { type: "arrayBuffer", consistency: "strong" });
    if (!existingLower) {
      const lower = await generate(http, env, reliefPrompt(renderingCity, names), accounting, "relief", top);
      await store.set(`${key}/lower`, Uint8Array.from(lower.data).buffer, { metadata: { mime: lower.mime }, onlyIfNew: true });
    }
    const complete: Job = { ...job, state: "ready", updatedAt: new Date().toISOString(), model: "gemini-3.1-flash-lite-image" };
    await store.setJSON(`${key}/job`, complete, { onlyIfMatch: jobEtag });
    return json(200, { state: "ready" });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    const detail = code.startsWith("test-budget-") ? "新增 AI 測試額度不足或無法安全預留；下一個模型呼叫未送出" :
      code.startsWith("landmark-") ? "地標名稱或位置尚未核對；可重試一次" :
      code === "image-service-400" ? "圖片請求被服務拒絕；相同版本不會再次送出" :
      code.startsWith("image-service-") ? "圖片服務拒絕請求；未產出背景，可重試一次" :
      code.startsWith("image-") ? "圖片模型未完成輸出；可重試一次" :
      "圖片服務暫時失敗；可重試一次";
    console.warn("travel-planner-background-failed", { stage: /^[a-z-]+(?:-\d{3})?$/.test(code) ? code : "external" });
    const current = await readJob(store, key);
    if (current?.data.state === "running" && current.data.startedAt === job.startedAt)
      await store.setJSON(`${key}/job`, { ...job, state: "failed",
        attempts: accounting.providerAttempted ? job.attempts : paidAttempts, error: detail,
        ...(code === "image-service-400" ? { blockedRequestRevision: IMAGE_REQUEST_REVISION } : {}) },
      { onlyIfMatch: current.etag });
    return json(502, { error: `${detail}；行程未變更` });
  }
}

export async function readBackground(req: Request, env: Env, http: Http = fetch, store: Store = backgroundStore(env)) {
  if (req.method !== "GET") return json(405, { error: "只接受 GET" });
  let owner: Awaited<ReturnType<typeof ownerTrip>>;
  try { owner = await ownerTrip(req, env, http, false); }
  catch { return json(503, { error: "無法驗證私人旅程" }); }
  if ("error" in owner) return owner.error;
  const { key } = owner.value;
  const job = await readJob(store, key);
  const part = new URL(req.url).searchParams.get("part");
  if (!part) return json(200, job ? { ...job.data,
    retryAllowed: job.data.blockedRequestRevision !== IMAGE_REQUEST_REVISION } : { state: "none" });
  if (!job || job.data.state !== "ready" || !["top", "lower"].includes(part)) return json(404, { error: "圖片尚未備妥" });
  const blob = await store.getWithMetadata(`${key}/${part}`, { type: "arrayBuffer", consistency: "strong" });
  if (!blob) return json(503, { error: "背景檔案暫時無法讀取" });
  const mime = blob.metadata?.mime;
  return new Response(blob.data, { status: 200, headers: { "Content-Type": mime === "image/png" ? "image/png" : "image/jpeg",
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
