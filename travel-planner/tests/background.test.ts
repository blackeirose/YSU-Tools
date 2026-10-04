import { describe, expect, it } from "vitest";
import { readBackground, startBackground, backgroundStore } from "../src/server/background";

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
  bilingualLandmark?: boolean } = {}) {
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
          lat: options.integerCoordinates ? { integerValue: "35" } : { doubleValue: 35.6 },
          lng: options.integerCoordinates ? { integerValue: "139" } : { doubleValue: 139.7 },
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
        name: served, city: "Minato", state: name === "大阪城" ? "大阪" : "Tokyo", country: "日本",
        osm_type: "N", osm_id: 100 + locations, osm_value: "attraction",
      } }] });
    }
    if (target.includes("/v1beta/models/gemini-3.1-flash-lite-image:generateContent")) {
      const body = JSON.parse(String(init?.body)) as { contents: { parts: { text?: string }[] }[]; generationConfig: { responseModalities: string[]; responseFormat: { image: { aspectRatio: string; imageSize: string } } } };
      expect(body.generationConfig).toEqual({ responseModalities: ["IMAGE"], responseFormat: { image: { aspectRatio: "3:2", imageSize: "1K" } } });
      prompts.push(body.contents[0].parts[0].text ?? "");
      images++;
      if (options.failSecond && images === 2) return new Response("", { status: 500 });
      return Response.json({ candidates: [{ content: { parts: [{ inlineData: {
        mimeType: "image/jpeg", data: Buffer.alloc(1200, 7).toString("base64") } }] } }] });
    }
    throw new Error(`Unexpected outbound request: ${target}`);
  }) as typeof fetch;
  return { http, counts: () => ({ images, quota, landmarks }), locations: () => locations, prompts };
}

describe("owner-only persistent background generation", () => {
  it("returns 401 before service-availability checks and makes no paid call", async () => {
    const store = new MemoryStore() as unknown as ReturnType<typeof backgroundStore>;
    const unavailable = () => undefined;
    let calls = 0;
    const http = (async () => { calls++; throw new Error("should not call external services"); }) as typeof fetch;
    const anonymousStart = new Request(`https://preview.test/travel-planner/api/background/start?tripId=${tripId}`,
      { method: "POST" });
    const anonymousRead = new Request(`https://preview.test/travel-planner/api/background/status?tripId=${tripId}`);
    expect((await startBackground(anonymousStart, unavailable, http, store)).status).toBe(401);
    expect((await readBackground(anonymousRead, unavailable, http, store)).status).toBe(401);
    expect((await startBackground(request(), unavailable, http, store)).status).toBe(503);
    expect(calls).toBe(0);
  });
  it("requires the authenticated owner and confirmed first-day city before paid calls", async () => {
    const store = new MemoryStore();
    const fake = httpFor({ owner: "other" });
    expect((await startBackground(request(), env, fake.http, store as unknown as ReturnType<typeof backgroundStore>)).status).toBe(403);
    expect(fake.counts()).toEqual({ images: 0, quota: 0, landmarks: 0 });
    const noCity = httpFor({ city: false });
    expect((await startBackground(request(), env, noCity.http, store as unknown as ReturnType<typeof backgroundStore>)).status).toBe(409);
    expect(noCity.counts()).toEqual({ images: 0, quota: 0, landmarks: 0 });
  });
  it("persists both panels, reads them privately and does not regenerate on duplicate start", async () => {
    const store = new MemoryStore(), fake = httpFor();
    const provided = store as unknown as ReturnType<typeof backgroundStore>;
    expect((await startBackground(request(), env, fake.http, provided)).status).toBe(200);
    expect(fake.counts()).toEqual({ images: 2, quota: 1, landmarks: 1 });
    expect((await startBackground(request(), env, fake.http, provided)).status).toBe(200);
    expect(fake.counts()).toEqual({ images: 2, quota: 1, landmarks: 1 });
    expect(fake.prompts[0]).toContain("東京塔");
    expect(fake.locations()).toBe(3);
    const statusRequest = new Request(`https://tools.ycsu.cc/travel-planner/api/background/status?tripId=${tripId}`,
      { headers: { Authorization: "Bearer owner" } });
    const status = await (await readBackground(statusRequest, env, fake.http, provided)).json();
    expect(status.state).toBe("ready");
    expect(status.landmarks).toHaveLength(3);
    expect(status.landmarks[0]).toEqual({ name: "東京塔", sourceUrl: "https://www.openstreetmap.org/node/101",
      sourceTitle: "OpenStreetMap / Photon", locationSourceUrl: "https://www.openstreetmap.org/node/101" });
    const image = await readBackground(new Request(`${statusRequest.url}&part=top`, { headers: statusRequest.headers }), env, fake.http, provided);
    expect(image.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await image.arrayBuffer()).byteLength).toBe(1200);
  });
  it("a failed lower panel can retry once without paying to regenerate the preserved upper panel", async () => {
    const store = new MemoryStore(), fake = httpFor({ failSecond: true });
    const provided = store as unknown as ReturnType<typeof backgroundStore>;
    expect((await startBackground(request(), env, fake.http, provided)).status).toBe(502);
    expect((await startBackground(request(), env, fake.http, provided)).status).toBe(200);
    expect(fake.counts()).toEqual({ images: 3, quota: 2, landmarks: 1 });
  });
  it("quota refusals make no paid call and do not exhaust background retries, including an old job", async () => {
    const store = new MemoryStore(), fake = httpFor();
    const provided = store as unknown as ReturnType<typeof backgroundStore>;
    const exhausted = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("/aiUsage/") && init?.method !== "PATCH")
        return Response.json({ fields: { reservedMicrousd: { integerValue: "990000" } },
          updateTime: "2030-01-01T00:00:00Z" });
      return fake.http(url, init);
    }) as typeof fetch;
    expect((await startBackground(request(), env, exhausted, provided)).status).toBe(429);
    expect((await startBackground(request(), env, exhausted, provided)).status).toBe(429);
    expect(fake.counts()).toEqual({ images: 0, quota: 0, landmarks: 0 });
    const key = `preview-v1/owner/${tripId}/job`;
    expect((store.values.get(key)?.data as { attempts: number }).attempts).toBe(0);
    expect((await startBackground(request(), env, fake.http, provided)).status).toBe(200);
    expect(fake.counts()).toEqual({ images: 2, quota: 1, landmarks: 1 });

    const old = new MemoryStore(), oldProvided = old as unknown as ReturnType<typeof backgroundStore>;
    await old.setJSON(key, { state: "failed", attempts: 2, city: "東京", startedAt: "2030-01-01T00:00:00Z",
      updatedAt: "2030-01-01T00:00:00Z", error: "今日用量已滿或無法安全預留" });
    const resumed = httpFor();
    expect((await startBackground(request(), env, resumed.http, oldProvided)).status).toBe(200);
    expect(resumed.counts()).toEqual({ images: 2, quota: 1, landmarks: 1 });
  });
  it("resumes an expired running job from its durable upper panel after a worker crash", async () => {
    const store = new MemoryStore(), provided = store as unknown as ReturnType<typeof backgroundStore>;
    const prefix = `preview-v1/owner/${tripId}`;
    await store.setJSON(`${prefix}/job`, { state: "running", attempts: 1, attemptAccountingVersion: 2,
      city: "東京", startedAt: "2020-01-01T00:00:00Z", updatedAt: "2020-01-01T00:00:00Z",
      landmarks: [{ name: "東京塔", sourceUrl: "https://www.openstreetmap.org/node/1",
        sourceTitle: "OpenStreetMap / Photon", locationSourceUrl: "https://www.openstreetmap.org/node/1" }] });
    await store.set(`${prefix}/top`, Buffer.alloc(1200, 7).buffer, { metadata: { mime: "image/jpeg" } });
    const fake = httpFor();
    expect((await startBackground(request(), env, fake.http, provided)).status).toBe(200);
    expect(fake.counts()).toEqual({ images: 1, quota: 1, landmarks: 0 });
    expect((store.values.get(`${prefix}/job`)?.data as { state: string }).state).toBe("ready");
  });
  it("a failed lower panel keeps the original city after the first-day city changes", async () => {
    const store = new MemoryStore(), tokyo = httpFor({ failSecond: true });
    const provided = store as unknown as ReturnType<typeof backgroundStore>;
    expect((await startBackground(request(), env, tokyo.http, provided)).status).toBe(502);
    const osaka = httpFor({ cityName: "大阪" });
    expect((await startBackground(request(), env, osaka.http, provided)).status).toBe(200);
    expect(osaka.prompts).toHaveLength(1);
    expect(osaka.prompts[0]).toContain("東京");
    expect(osaka.prompts[0]).not.toContain("大阪");
    const state = await readBackground(new Request(`https://tools.ycsu.cc/travel-planner/api/background/status?tripId=${tripId}`,
      { headers: { Authorization: "Bearer owner" } }), env, osaka.http, provided);
    expect(await state.json()).toMatchObject({ state: "ready", city: "東京" });
  });
  it("accepts integer Firestore coordinates and retains the original poster when first-day city is later cleared", async () => {
    const store = new MemoryStore();
    const original = httpFor({ integerCoordinates: true });
    const provided = store as unknown as ReturnType<typeof backgroundStore>;
    expect((await startBackground(request(), env, original.http, provided)).status).toBe(200);
    const changed = httpFor({ city: false });
    const statusRequest = new Request(`https://tools.ycsu.cc/travel-planner/api/background/status?tripId=${tripId}`,
      { headers: { Authorization: "Bearer owner" } });
    const status = await readBackground(statusRequest, env, changed.http, provided);
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({ state: "ready", city: "東京" });
    expect(changed.counts()).toEqual({ images: 0, quota: 0, landmarks: 0 });
  });
  it("uses independent place-specific OSM citations when search URLs are not grounded", async () => {
    const store = new MemoryStore(), fake = httpFor({ unsourced: true });
    const provided = store as unknown as ReturnType<typeof backgroundStore>;
    expect((await startBackground(request(), env, fake.http, provided)).status).toBe(200);
    expect(fake.counts()).toEqual({ images: 2, quota: 1, landmarks: 1 });
    const status = await readBackground(new Request(`https://tools.ycsu.cc/travel-planner/api/background/status?tripId=${tripId}`,
      { headers: { Authorization: "Bearer owner" } }), env, fake.http, provided);
    expect((await status.json()).landmarks[0]).toMatchObject({
      sourceUrl: "https://www.openstreetmap.org/node/101", sourceTitle: "OpenStreetMap / Photon" });
  });
  it("does not treat a search title as location proof when OSM verifies the city", async () => {
    const store = new MemoryStore(), fake = httpFor({ wrongCity: true });
    expect((await startBackground(request(), env, fake.http, store as unknown as ReturnType<typeof backgroundStore>)).status).toBe(200);
    expect(fake.counts()).toEqual({ images: 2, quota: 1, landmarks: 1 });
  });
  it("rejects a title mentioning Tokyo and Osaka Castle when the independent place is in Osaka", async () => {
    const store = new MemoryStore(), fake = httpFor({ crossCityTitle: true });
    expect((await startBackground(request(), env, fake.http, store as unknown as ReturnType<typeof backgroundStore>)).status).toBe(502);
    expect(fake.counts()).toEqual({ images: 0, quota: 1, landmarks: 1 });
    expect(fake.locations()).toBe(3);
  });
  it("uses three independently verified landmarks when one of four model names is out of city", async () => {
    const store = new MemoryStore(), fake = httpFor({ oneInvalidAmongFour: true });
    const response = await startBackground(request(), env, fake.http, store as unknown as ReturnType<typeof backgroundStore>);
    expect(response.status).toBe(200);
    expect(fake.counts()).toEqual({ images: 2, quota: 1, landmarks: 1 });
    expect(fake.locations()).toBe(4);
    expect(fake.prompts[0]).not.toContain("大阪城");
    expect(fake.prompts[0]).toContain("東京塔");
  });
  it("verifies a bilingual landmark using the model's exact English search name and OSM city", async () => {
    const store = new MemoryStore(), fake = httpFor({ bilingualLandmark: true });
    const response = await startBackground(request(), env, fake.http, store as unknown as ReturnType<typeof backgroundStore>);
    expect(response.status).toBe(200);
    const status = await readBackground(new Request(`https://tools.ycsu.cc/travel-planner/api/background/status?tripId=${tripId}`,
      { headers: { Authorization: "Bearer owner" } }), env, fake.http, store as unknown as ReturnType<typeof backgroundStore>);
    expect((await status.json()).landmarks[0].name).toBe("Tokyo Tower");
  });
});
