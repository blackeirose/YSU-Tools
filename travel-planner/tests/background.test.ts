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
function httpFor(options: { owner?: string; city?: boolean; integerCoordinates?: boolean; failSecond?: boolean } = {}) {
  let images = 0, quota = 0;
  const http = (async (url: string | URL | Request, init?: RequestInit) => {
    const target = String(url);
    if (target.includes("accounts:lookup")) return Response.json({ users: [{ localId: options.owner ?? "owner" }] });
    if (target.includes("/records/")) return Response.json({ fields: {
      ownerId: { stringValue: "owner" }, kind: { stringValue: "trip" }, deleted: { booleanValue: false },
      start: { stringValue: "2030-01-01" }, dayCities: { mapValue: { fields: {
        "2030-01-01": { mapValue: { fields: options.city === false ? {} : {
          name: { stringValue: "東京" }, timezone: { stringValue: "Asia/Tokyo" },
          lat: options.integerCoordinates ? { integerValue: "35" } : { doubleValue: 35.6 },
          lng: options.integerCoordinates ? { integerValue: "139" } : { doubleValue: 139.7 },
        } } },
      } } },
    } });
    if (target.includes("/aiUsage/")) {
      if (init?.method === "PATCH") { quota++; return Response.json({}); }
      return new Response("", { status: 404 });
    }
    if (target.includes("/v1beta/models/gemini-3.1-flash-lite-image:generateContent")) {
      const body = JSON.parse(String(init?.body)) as { generationConfig: { responseModalities: string[]; responseFormat: { image: { aspectRatio: string; imageSize: string } } } };
      expect(body.generationConfig).toEqual({ responseModalities: ["IMAGE"], responseFormat: { image: { aspectRatio: "3:2", imageSize: "1K" } } });
      images++;
      if (options.failSecond && images === 2) return new Response("", { status: 500 });
      return Response.json({ candidates: [{ content: { parts: [{ inlineData: {
        mimeType: "image/jpeg", data: Buffer.alloc(1200, 7).toString("base64") } }] } }] });
    }
    throw new Error(`Unexpected outbound request: ${target}`);
  }) as typeof fetch;
  return { http, counts: () => ({ images, quota }) };
}

describe("owner-only persistent background generation", () => {
  it("requires the authenticated owner and confirmed first-day city before paid calls", async () => {
    const store = new MemoryStore();
    const fake = httpFor({ owner: "other" });
    expect((await startBackground(request(), env, fake.http, store as unknown as ReturnType<typeof backgroundStore>)).status).toBe(403);
    expect(fake.counts()).toEqual({ images: 0, quota: 0 });
    const noCity = httpFor({ city: false });
    expect((await startBackground(request(), env, noCity.http, store as unknown as ReturnType<typeof backgroundStore>)).status).toBe(409);
    expect(noCity.counts()).toEqual({ images: 0, quota: 0 });
  });
  it("persists both panels, reads them privately and does not regenerate on duplicate start", async () => {
    const store = new MemoryStore(), fake = httpFor();
    const provided = store as unknown as ReturnType<typeof backgroundStore>;
    expect((await startBackground(request(), env, fake.http, provided)).status).toBe(200);
    expect(fake.counts()).toEqual({ images: 2, quota: 1 });
    expect((await startBackground(request(), env, fake.http, provided)).status).toBe(200);
    expect(fake.counts()).toEqual({ images: 2, quota: 1 });
    const statusRequest = new Request(`https://tools.ycsu.cc/travel-planner/api/background/status?tripId=${tripId}`,
      { headers: { Authorization: "Bearer owner" } });
    expect((await (await readBackground(statusRequest, env, fake.http, provided)).json()).state).toBe("ready");
    const image = await readBackground(new Request(`${statusRequest.url}&part=top`, { headers: statusRequest.headers }), env, fake.http, provided);
    expect(image.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await image.arrayBuffer()).byteLength).toBe(1200);
  });
  it("a failed lower panel can retry once without paying to regenerate the preserved upper panel", async () => {
    const store = new MemoryStore(), fake = httpFor({ failSecond: true });
    const provided = store as unknown as ReturnType<typeof backgroundStore>;
    expect((await startBackground(request(), env, fake.http, provided)).status).toBe(502);
    expect((await startBackground(request(), env, fake.http, provided)).status).toBe(200);
    expect(fake.counts()).toEqual({ images: 3, quota: 2 });
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
    expect(changed.counts()).toEqual({ images: 0, quota: 0 });
  });
});
