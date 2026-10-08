import { describe, expect, it, vi } from "vitest";
vi.mock("../src/server/ai-ledger", () => ({
  beginAiUsage: vi.fn(async () => ({ key: "synthetic", etag: "synthetic" })),
  finishAiUsage: vi.fn(async () => {}),
}));
vi.mock("../src/server/ai-test-budget", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/server/ai-test-budget")>(),
  reserveAiTestBudget: vi.fn(async () => ({ upperBoundMicrousd: 180_000, reservedAfterMicrousd: 180_000,
    remainingMicrousd: 820_000 })),
}));
import { readBackground, startBackground, backgroundStore, landmarkInSelectedCity } from "../src/server/background";
import { beginAiUsage, finishAiUsage } from "../src/server/ai-ledger";
import { reserveAiTestBudget } from "../src/server/ai-test-budget";
import { shouldAutoStartBackground, shouldPollAcceptedBackground } from "../src/TripBackground";

const tripId = "00000000-0000-4000-8000-000000000001";
const request = (token = "owner") => new Request(`https://tools.ycsu.cc/travel-planner/api/background/start?tripId=${tripId}`,
  { method: "POST", headers: { Authorization: `Bearer ${token}` } });
const env = (name: string) => ({ TRAVEL_PLANNER_AI_ENABLED: "true", TRAVEL_PLANNER_FIREBASE_PROJECT_ID: "ysu-ums",
  TRAVEL_PLANNER_FIREBASE_WEB_KEY: "public", TRAVEL_PLANNER_AI_OWNER_UID: "owner",
  TRAVEL_PLANNER_FIREBASE_NAMESPACE: "preview-v1", GOOGLE_GEMINI_BASE_URL: "https://gateway.example",
  NETLIFY_AI_GATEWAY_URL: "https://gateway.example", GEMINI_API_KEY: "gateway-key", NETLIFY_AI_GATEWAY_KEY: "gateway-key" } as Record<string, string>)[name];

class MemoryStore {
  values = new Map<string, { data: unknown; etag: string; metadata: Record<string, unknown> }>();
  index = 0;
  async getWithMetadata(key: string) { return this.values.get(key) ?? null; }
  async setJSON(key: string, data: unknown, options?: { onlyIfNew?: boolean; onlyIfMatch?: string }) {
    return this.set(key, data, options);
  }
  async set(key: string, data: unknown, options?: { onlyIfNew?: boolean; onlyIfMatch?: string; metadata?: Record<string, unknown> }) {
    const previous = this.values.get(key);
    if (options?.onlyIfNew && previous || options?.onlyIfMatch && previous?.etag !== options.onlyIfMatch)
      return { modified: false };
    const etag = `"${++this.index}"`;
    this.values.set(key, { data, etag, metadata: options?.metadata ?? {} });
    return { modified: true, etag };
  }
}
function httpFor(options: { owner?: string; city?: boolean; cityName?: string; integerCoordinates?: boolean; failSecond?: boolean;
  unsourced?: boolean; wrongCity?: boolean; crossCityTitle?: boolean; oneInvalidAmongFour?: boolean;
  bilingualLandmark?: boolean; failPhoto400?: boolean; failSecond400?: boolean; failPhoto500?: boolean; identityOnly?: boolean } = {}) {
  let images = 0, quota = 0, landmarks = 0, locations = 0;
  const prompts: string[] = [];
  const http = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    if (target.includes("accounts:lookup")) return Response.json({ users: [{ localId: options.owner ?? "owner" }] });
    if (target.includes("/records/")) return Response.json({ fields: {
      ownerId: { stringValue: "owner" }, kind: { stringValue: "trip" }, deleted: { booleanValue: false },
      start: { stringValue: "2030-01-01" }, dayCities: { mapValue: { fields: {
        "2030-01-01": { mapValue: { fields: options.city === false ? {} : {
          name: { stringValue: options.cityName ?? "東京" }, timezone: { stringValue: "Asia/Tokyo" },
          countryCode: { stringValue: "JP" }, region: { stringValue: "Tokyo" },
          sourceId: { stringValue: "https://www.openstreetmap.org/relation/1" },
          lat: options.identityOnly ? {} : options.integerCoordinates ? { integerValue: "35" } : { doubleValue: 35.6 },
          lng: options.identityOnly ? {} : options.integerCoordinates ? { integerValue: "139" } : { doubleValue: 139.7 },
        } } },
      } } },
    } });
    if (target.includes("/aiUsage/")) {
      if (init?.method === "PATCH") { quota++; return Response.json({}); }
      return new Response("", { status: 404 });
    }
    if (target.includes("/v1beta/models/gemini-3.1-flash-lite:generateContent")) {
      landmarks++;
      const body = JSON.parse(String(init?.body));
      expect(body.generationConfig.responseJsonSchema.properties.landmarks.maxItems).toBe(8);
      const names = [options.crossCityTitle || options.oneInvalidAmongFour ? "大阪城" : "東京塔",
        "淺草寺", "東京車站", ...(options.oneInvalidAmongFour ? ["東京塔"] : [])];
      const entries = names.map((name, index) => ({ name,
        searchName: options.bilingualLandmark && index === 0 ? "Tokyo Tower" : name,
        sourceUrl: `https://example.org/tokyo-${index}`,
        sourceTitle: `${options.wrongCity ? "大阪" : "東京"}・${name}` }));
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ landmarks: entries }) }] },
        groundingMetadata: { groundingChunks: entries.map((entry) => ({ web: {
          uri: options.unsourced ? "https://other.example/" : entry.sourceUrl, title: entry.sourceTitle } })) } }] });
    }
    if (target.startsWith("https://photon.komoot.io/api/")) {
      locations++;
      const query = new URL(target).searchParams.get("q") ?? "";
      const name = options.bilingualLandmark && query.includes("Tokyo Tower") ? "Tokyo Tower"
        : ["大阪城", "東京塔", "淺草寺", "東京車站"].find((candidate) => query.includes(candidate)) ?? "";
      const served = options.bilingualLandmark && query.includes("東京塔") ? "別的地點" : name;
      return Response.json({ features: [{ geometry: { coordinates: [139.7, 35.6] }, properties: {
        name: served, city: "Minato", state: name === "大阪城" ? "大阪" : "Tokyo", country: "日本", countrycode: "JP",
        osm_type: "N", osm_id: 100 + locations, osm_value: "attraction",
      } }] });
    }
    if (target.includes("/v1beta/models/gemini-3.1-flash-lite-image:generateContent")) {
      const body = JSON.parse(String(init?.body)) as { contents: { parts: { text?: string }[] }[]; generationConfig?: unknown };
      expect(body.generationConfig).toEqual({ imageConfig: { aspectRatio: "16:9" } });
      prompts.push(body.contents[0].parts[0].text ?? "");
      images++;
      if (options.failPhoto500 && images === 1) return new Response("", { status: 500 });
      if (options.failPhoto400 && images === 1) return Response.json({ usageMetadata: {
        promptTokenCount: 246, candidatesTokenCount: 0, totalTokenCount: 246 }, error: {
        code: 400, status: "INVALID_ARGUMENT",
        message: 'Invalid JSON payload received. Unknown name "responseFormat" at generationConfig. Private itinerary: secret-note',
      } }, { status: 400 });
      if (options.failSecond400 && images === 2) return Response.json({ error: {
        code: 400, status: "INVALID_ARGUMENT", message: 'Unknown name "imageConfig" at generationConfig',
      } }, { status: 400 });
      if (options.failSecond && images === 2) return new Response("", { status: 500 });
      return Response.json({ candidates: [{ content: { parts: [{ inlineData: {
        mimeType: "image/jpeg", data: Buffer.alloc(1200, 7).toString("base64") } }] } }] });
    }
    throw new Error(`Unexpected outbound request: ${target}`);
  }) as typeof fetch;
  return { http, counts: () => ({ images, quota, landmarks }), locations: () => locations, prompts };
}


const prefix = `preview-v1/owner/${tripId}`;
const key = `${prefix}/poster-v2/job`;
const provided = (store: MemoryStore) => store as unknown as ReturnType<typeof backgroundStore>;
const statusReq = (part = '') => new Request(`https://tools.ycsu.cc/travel-planner/api/background/status?tripId=${tripId}${part ? `&part=${part}` : ''}`,
  { headers: { Authorization: 'Bearer owner' } });
const readyLegacy = async (store: MemoryStore) => {
  await store.setJSON(`${prefix}/job`, { state: 'ready', city: '東京', attempts: 1 });
  await store.set(`${prefix}/top`, Buffer.alloc(1200, 4).buffer, { metadata: { mime: 'image/jpeg' } });
  await store.set(`${prefix}/lower`, Buffer.alloc(1200, 5).buffer, { metadata: { mime: 'image/jpeg' } });
};
describe('persistent single-poster background', () => {
  it('stores one complete artwork; concurrent starts and later refresh never duplicate model calls', async () => {
    const store = new MemoryStore(), fake = httpFor();
    await Promise.all([startBackground(request(), env, fake.http, provided(store)), startBackground(request(), env, fake.http, provided(store))]);
    expect(fake.counts()).toEqual({ images: 1, quota: 1, landmarks: 1 });
    expect(fake.prompts[0]).toContain('ONE complete 16:9');
    expect(fake.prompts[0]).toContain('EXACT OBJECT PLACEMENT');
    expect(fake.prompts[0]).toContain('Never place any landmark on both sides');
    expect(fake.prompts[0]).toContain('Do NOT make a before/after comparison');
    expect(fake.prompts[0]).toContain('東京塔');
    expect((await startBackground(request(), env, fake.http, provided(store))).status).toBe(200);
    const status = await (await readBackground(statusReq(), env, fake.http, provided(store))).json();
    expect(status).toMatchObject({ state: 'ready', imagePart: 'poster', legacy: false });
    expect(status.landmarks).toHaveLength(3);
    const image = await readBackground(statusReq('poster'), env, fake.http, provided(store));
    expect(image.headers.get('Cache-Control')).toBe('private, no-store');
    expect((await image.arrayBuffer()).byteLength).toBe(1200);
    expect(fake.counts().images).toBe(1);
  });
  it('can use a verified city identity without unnecessary precise coordinates', async () => {
    const store = new MemoryStore(), fake = httpFor({ identityOnly: true });
    expect((await startBackground(request(), env, fake.http, provided(store))).status).toBe(200);
  });
  it('rejects unsigned/other owners and missing cities before paying or reading private images', async () => {
    const store = new MemoryStore(), fake = httpFor({ owner: 'other' });
    expect((await startBackground(request(''), env, fake.http, provided(store))).status).toBe(401);
    expect((await startBackground(request(), env, fake.http, provided(store))).status).toBe(403);
    expect((await readBackground(statusReq('poster'), env, fake.http, provided(store))).status).toBe(403);
    const absent = httpFor({ city: false });
    expect((await startBackground(request(), env, absent.http, provided(store))).status).toBe(409);
    expect(fake.counts().images + absent.counts().images).toBe(0);
  });
  it('keeps old image bytes and requires an explicit upgrade, then switches only after success', async () => {
    const store = new MemoryStore(), fake = httpFor(); await readyLegacy(store);
    const before = [...store.values.entries()];
    expect((await startBackground(request(), env, fake.http, provided(store))).status).toBe(200);
    expect(fake.counts().images).toBe(0);
    expect(await (await readBackground(statusReq(), env, fake.http, provided(store))).json()).toMatchObject({ legacy: true, imagePart: 'top' });
    const upgrade = new Request(request().url + '&upgrade=1', { method: 'POST', headers: request().headers });
    expect((await startBackground(upgrade, env, fake.http, provided(store))).status).toBe(200);
    for (const [path, value] of before) expect(store.values.get(path)).toEqual(value);
    expect(await (await readBackground(statusReq(), env, fake.http, provided(store))).json()).toMatchObject({ legacy: false, imagePart: 'poster' });
    expect((await readBackground(statusReq('lower'), env, fake.http, provided(store))).status).toBe(200);
  });
  it('a failed upgrade keeps legacy imagery usable and cannot repeat a provider 400', async () => {
    const store = new MemoryStore(), fake = httpFor({ failPhoto400: true }); await readyLegacy(store);
    const upgrade = new Request(request().url + '&upgrade=1', { method: 'POST', headers: request().headers });
    expect((await startBackground(upgrade, env, fake.http, provided(store))).status).toBe(502);
    expect(await (await readBackground(statusReq(), env, fake.http, provided(store))).json()).toMatchObject({ state: 'failed', legacy: true, imagePart: 'top', retryAllowed: false });
    expect((await startBackground(upgrade, env, fake.http, provided(store))).status).toBe(409);
    expect(fake.counts().images).toBe(1);
    const event = vi.mocked(finishAiUsage).mock.calls.map(([, event]) => event).find((event) => event.httpStatus === 400);
    expect(event).toMatchObject({ providerErrorStatus: 'INVALID_ARGUMENT', providerErrorCategory: 'unknown-field', providerErrorField: 'responseFormat' });
    expect(JSON.stringify(event)).not.toContain('secret-note');
  });
  it('retains verified landmarks and original city for a justified image-stage retry', async () => {
    const store = new MemoryStore(), fake = httpFor({ failPhoto500: true });
    expect((await startBackground(request(), env, fake.http, provided(store))).status).toBe(502);
    const changed = httpFor({ cityName: '大阪' });
    expect((await startBackground(request(), env, changed.http, provided(store))).status).toBe(200);
    expect(changed.counts()).toEqual({ images: 1, quota: 1, landmarks: 0 });
    expect(changed.prompts[0]).toContain('東京');
    expect(changed.prompts[0]).not.toContain('大阪');
  });
  it('does not pay if the request receipt cannot be persisted', async () => {
    vi.mocked(beginAiUsage).mockRejectedValueOnce(new Error('ledger-unavailable'));
    const store = new MemoryStore(), fake = httpFor();
    expect((await startBackground(request(), env, fake.http, provided(store))).status).toBe(502);
    expect(fake.counts()).toEqual({ images: 0, quota: 1, landmarks: 0 });
  });
  it('does not exhaust paid attempts on budget refusal or alter existing reservations', async () => {
    const store = new MemoryStore(), fake = httpFor();
    vi.mocked(reserveAiTestBudget).mockRejectedValueOnce(new Error('test-budget-daily-limit'));
    expect((await startBackground(request(), env, fake.http, provided(store))).status).toBe(502);
    expect((store.values.get(key)?.data as {attempts: number}).attempts).toBe(0);
    expect(fake.counts().images).toBe(0);
    expect((await startBackground(request(), env, fake.http, provided(store))).status).toBe(200);
  });
  it('never restarts an expired unknown worker and retains its stored fragments', async () => {
    const store = new MemoryStore(), fake = httpFor();
    await store.setJSON(key, { state: 'running', attempts: 1, startedAt: '2020-01-01T00:00:00Z' });
    expect((await startBackground(request(), env, fake.http, provided(store))).status).toBe(409);
    expect(fake.counts()).toEqual({ images: 0, quota: 0, landmarks: 0 });
  });
  it('continues private reads after city data is cleared, without generation', async () => {
    const store = new MemoryStore(), fake = httpFor();
    await startBackground(request(), env, fake.http, provided(store));
    const cleared = httpFor({ city: false });
    expect((await readBackground(statusReq('poster'), env, cleared.http, provided(store))).status).toBe(200);
    expect(cleared.counts().images).toBe(0);
  });
  it('checks independent exact OSM places and rejects outside-city model suggestions', async () => {
    const store = new MemoryStore(), fake = httpFor({ crossCityTitle: true });
    expect((await startBackground(request(), env, fake.http, provided(store))).status).toBe(502);
    expect(fake.counts()).toEqual({ images: 0, quota: 1, landmarks: 1 });
  });
  it('keeps three valid landmarks when a fourth candidate is outside the requested city', async () => {
    const store = new MemoryStore(), fake = httpFor({ oneInvalidAmongFour: true });
    expect((await startBackground(request(), env, fake.http, provided(store))).status).toBe(200);
    expect(fake.prompts[0]).not.toContain('大阪城');
  });
  it('verifies bilingual candidates through their exact English OSM name', async () => {
    const store = new MemoryStore(), fake = httpFor({ bilingualLandmark: true });
    expect((await startBackground(request(), env, fake.http, provided(store))).status).toBe(200);
    const state = await (await readBackground(statusReq(), env, fake.http, provided(store))).json();
    expect(state.landmarks[0].name).toBe('Tokyo Tower');
  });
  it('polls an accepted job for a bounded interval without issuing a second start', () => {
    expect(shouldPollAcceptedBackground('none', 1000, 4000)).toBe(true);
    expect(shouldPollAcceptedBackground('none', 1000, 121000)).toBe(false);
    expect(shouldAutoStartBackground('preview-v1', true, 'none', true, false, 2)).toBe(true);
    expect(shouldAutoStartBackground('v1', true, 'none', true, false)).toBe(false);
  });
});

it('rejects a same-name city in another country or distant region', async () => {
  const { parsePhoton } = await import('../src/place-search');
  const place = parsePhoton({ features: [{ geometry: { coordinates: [2.35,48.86] }, properties: {
    name: 'Museum', city: 'Paris', countrycode: 'FR', osm_type: 'N', osm_id: 1 } }] })[0];
  expect(landmarkInSelectedCity(place, { name: 'Paris', countryCode: 'US', region: 'Texas', lat: 33.66, lng: -95.56 })).toBe(false);
  expect(landmarkInSelectedCity({ ...place, countryCode: 'US' }, { name: 'Paris', countryCode: 'US', region: 'Texas', lat: 33.66, lng: -95.56 })).toBe(false);
});

it('reconciles saved poster bytes after a crash without another reservation', async () => {
  const store = new MemoryStore(), fake = httpFor();
  await store.setJSON(key, { state: 'running', attempts: 1, startedAt: '2020-01-01T00:00:00Z', city: '東京' });
  await store.set(`${prefix}/poster-v2/poster`, Buffer.alloc(1200, 4).buffer, { metadata: { mime: 'image/jpeg' } });
  expect((await startBackground(request(), env, fake.http, provided(store))).status).toBe(200);
  expect(fake.counts()).toEqual({ images: 0, quota: 0, landmarks: 0 });
  expect(await (await readBackground(statusReq(), env, fake.http, provided(store))).json()).toMatchObject({ state: 'ready', imagePart: 'poster' });
});
