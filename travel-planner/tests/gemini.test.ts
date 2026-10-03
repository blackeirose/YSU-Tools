import { describe, expect, it } from "vitest";
import { gatewayReady, geminiHandler, reserveQuota } from "../src/server/gemini";

const vars: Record<string, string> = {
  GOOGLE_GEMINI_BASE_URL: "https://gateway.test/gemini",
  NETLIFY_AI_GATEWAY_URL: "https://gateway.test/",
  GEMINI_API_KEY: "synthetic-gateway-key",
  NETLIFY_AI_GATEWAY_KEY: "synthetic-gateway-key",
  TRAVEL_PLANNER_AI_ENABLED: "true",
  TRAVEL_PLANNER_FIREBASE_PROJECT_ID: "demo-planner",
  TRAVEL_PLANNER_FIREBASE_WEB_KEY: "public-key",
  TRAVEL_PLANNER_AI_OWNER_UID: "owner",
  TRAVEL_PLANNER_FIREBASE_NAMESPACE: "preview-v1",
};
const env = (key: string) => vars[key];
const request = (mode = "assist") => new Request("https://preview.test/travel-planner/api/ai", {
  method: "POST", headers: { Authorization: "Bearer synthetic-token", "Content-Type": "application/json" },
  body: JSON.stringify({ mode, tripId: crypto.randomUUID(), requestId: crypto.randomUUID(), query: "下雨天找室內活動" }),
});
const owner = () => Response.json({ users: [{ localId: "owner" }] });
const trip = () => Response.json({ fields: { ownerId: { stringValue: "owner" }, kind: { stringValue: "trip" },
  name: { stringValue: "合成旅程" } } });

describe("Gemini paid boundary", () => {
  it("returns 401 to anonymous callers even when the Planner gateway is disabled", async () => {
    let calls = 0;
    const http = (async () => { calls++; throw new Error("should not call external services"); }) as typeof fetch;
    const disabled = () => undefined;
    const anonymous = new Request("https://preview.test/travel-planner/api/ai", { method: "POST", body: "{}" });
    expect((await geminiHandler(anonymous, disabled, http)).status).toBe(401);
    expect((await geminiHandler(request(), disabled, http)).status).toBe(503);
    expect(calls).toBe(0);
  });
  it("uses only the explicit site gateway, ignoring sibling-owned Gemini keys", () => {
    expect(gatewayReady(env)).toBe(true);
    expect(gatewayReady((key) => key === "GEMINI_API_KEY" ? "sibling-key" : env(key))).toBe(true);
    expect(gatewayReady((key) => key === "NETLIFY_AI_GATEWAY_URL" ? "http://gateway.test" : env(key))).toBe(false);
    expect(gatewayReady((key) => key === "NETLIFY_AI_GATEWAY_KEY" ? undefined : env(key))).toBe(false);
  });
  it("rejects invalid identity and trip ownership before reserving cost", async () => {
    let calls = 0;
    const denied = async () => { calls++; return Response.json({ users: [{ localId: "other" }] }); };
    expect((await geminiHandler(request(), env, denied as typeof fetch)).status).toBe(403);
    expect(calls).toBe(1);
    calls = 0;
    const wrongTrip = async () => ++calls === 1 ? owner() : Response.json({ fields: { ownerId: { stringValue: "other" }, kind: { stringValue: "trip" } } });
    expect((await geminiHandler(request(), env, wrongTrip as typeof fetch)).status).toBe(403);
    expect(calls).toBe(2);
  });
  it("reserves quota with a precondition before Gemini; rejects a bad result without edits", async () => {
    const calls: { url: string; method: string }[] = [];
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input), method = init?.method ?? "GET";
      calls.push({ url, method });
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiUsage/") && method === "GET") return new Response("", { status: 404 });
      if (url.includes("/aiUsage/") && method === "PATCH") return Response.json({});
      return Response.json({ candidates: [{ content: { parts: [{ text: '{"kind":"add","message":"go","name":"X"}' }] } }] });
    };
    const response = await geminiHandler(request(), env, http as typeof fetch);
    expect(response.status).toBe(200);
    expect(calls.map((call) => call.method)).toEqual(["POST", "GET", "GET", "PATCH", "POST"]);
    expect(calls[3].url).toContain("currentDocument.exists=false");
    expect(calls[4].url).toBe("https://gateway.test/v1beta/models/gemini-3.1-flash-lite:generateContent");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("stops at the daily count and does not call Gemini", async () => {
    let count = 0;
    const http = async () => { count++; return Response.json({ fields: { assistCount: { integerValue: "10" },
      exploreCount: { integerValue: "0" }, visionCount: { integerValue: "0" }, backgroundCount: { integerValue: "0" } }, updateTime: "2030-01-01T00:00:00Z" }); };
    await expect(reserveQuota(http as typeof fetch, "https://firestore.test/users/owner", "token", "owner", "assist"))
      .rejects.toThrow("quota-exhausted");
    expect(count).toBe(1);
  });
  it("rejects model-supplied unsourced exploration cards", async () => {
    const cards = Array.from({ length: 3 }, () => ({ name: "X", originalName: "X", location: "?", reason: "?",
      sourceUrls: ["https://invented.test/"], pending: [] }));
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ suggestions: cards }) }] },
        groundingMetadata: { groundingChunks: [{ web: { uri: "https://real.test/" } }] } }] });
    };
    expect((await geminiHandler(request("explore"), env, http as typeof fetch)).status).toBe(502);
  });
  it("returns a bounded dated draft for explicit confirmation and rejects a prose-only draft", async () => {
    const payloads = [
      { kind: "draft", message: "兩日草案", draftItems: [
        { day: "2030-01-01", name: "淺草寺", period: "上午" },
        { day: "2030-01-02", name: "上野公園", time: "09:00" },
      ] },
      { kind: "draft", message: "請直接加入" },
    ];
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(payloads.shift()) }] } }] });
    };
    const valid = await geminiHandler(request(), env, http as typeof fetch);
    expect(valid.status).toBe(200);
    expect((await valid.json()).action.draftItems).toHaveLength(2);
    const invalid = await geminiHandler(request(), env, http as typeof fetch);
    expect(invalid.status).toBe(502);
  });
});
