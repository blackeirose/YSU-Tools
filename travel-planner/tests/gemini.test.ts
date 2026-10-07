import { describe, expect, it, vi } from "vitest";
vi.mock("../src/server/ai-ledger", () => ({
  beginAiUsage: vi.fn(async () => ({ key: "synthetic", etag: "synthetic" })),
  finishAiUsage: vi.fn(async () => {}),
}));
vi.mock("../src/server/ai-test-budget", async (importOriginal) => ({
  ...await importOriginal<typeof import("../src/server/ai-test-budget")>(),
  reserveAiTestBudget: vi.fn(async () => ({ upperBoundMicrousd: 60_000, reservedAfterMicrousd: 60_000,
    remainingMicrousd: 940_000 })),
}));
import { gatewayReady, geminiHandler, parseAssistantAction, reserveQuota } from "../src/server/gemini";
import { beginAiUsage, finishAiUsage } from "../src/server/ai-ledger";
import { reserveAiTestBudget } from "../src/server/ai-test-budget";

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
const request = (mode = "assist", requestId = crypto.randomUUID(), query = "下雨天找室內活動") => new Request("https://preview.test/travel-planner/api/ai", {
  method: "POST", headers: { Authorization: "Bearer synthetic-token", "Content-Type": "application/json" },
  body: JSON.stringify({ mode, tripId: crypto.randomUUID(), requestId, query }),
});
const owner = () => Response.json({ users: [{ localId: "owner" }] });
const trip = () => Response.json({ fields: { ownerId: { stringValue: "owner" }, kind: { stringValue: "trip" },
  name: { stringValue: "合成旅程" }, start: { stringValue: "2030-01-01" }, end: { stringValue: "2030-01-10" },
  timezone: { stringValue: "Asia/Tokyo" } } });

describe("Gemini paid boundary", () => {
  it("normalizes only empty optional action fields while retaining selected-ID and date validation", () => {
    const id = crypto.randomUUID();
    const action = parseAssistantAction({ kind: "move", message: null, itemId: id, day: "2030-01-02",
      name: "", time: null, period: null, draftItems: null });
    expect(action.success).toBe(true);
    if (action.success) expect(action.data).toMatchObject({ kind: "move", itemId: id,
      day: "2030-01-02", message: "請確認這項旅程操作" });
    expect(parseAssistantAction({ kind: "move", itemId: "wrong-id", day: "2030-01-02" }).success).toBe(false);
    expect(parseAssistantAction({ kind: "move", itemId: id, day: "tomorrow" }).success).toBe(false);
  });
  it("constrains a paid move proposal to the exact selected item in the provider schema", async () => {
    const selectedId = crypto.randomUUID();
    let schema: { properties?: { itemId?: { enum?: string[] } } } = {};
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      schema = JSON.parse(String(init?.body)).generationConfig.responseJsonSchema;
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        kind: "move", message: "移到隔日", itemId: selectedId, day: "2030-01-02", time: null,
      }) }] } }] });
    };
    const response = await geminiHandler(new Request("https://preview.test/travel-planner/api/ai", {
      method: "POST", headers: { Authorization: "Bearer synthetic-token" }, body: JSON.stringify({
        mode: "assist", tripId: crypto.randomUUID(), requestId: crypto.randomUUID(),
        query: "請將所選卡片移到 2030-01-02", selectedDay: "2030-01-01",
        selectedItem: { id: selectedId, name: "合成景點" },
      }),
    }), env, http as typeof fetch);
    expect(response.status).toBe(200);
    expect(schema.properties?.itemId?.enum).toEqual([selectedId]);
    expect((await response.json()).action).toMatchObject({ kind: "move", itemId: selectedId,
      day: "2030-01-02" });
  });
  it("binds an omitted audio action ID to the selected card but rejects a different ID", async () => {
    const selectedId = crypto.randomUUID();
    let proposedItemId: string | null = null;
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        kind: "edit_time", message: "改為上午九點", itemId: proposedItemId,
        day: "2030-01-02", time: "09:00", transcript: "把所選景點改成上午九點",
      }) }] } }] });
    };
    const audioRequest = () => new Request("https://preview.test/travel-planner/api/ai", {
      method: "POST", headers: { Authorization: "Bearer synthetic-token" }, body: JSON.stringify({
        mode: "assist", tripId: crypto.randomUUID(), requestId: crypto.randomUUID(),
        query: "請理解這段語音並只依明確語意提出操作", selectedDay: "2030-01-02",
        selectedItem: { id: selectedId, name: "合成景點" }, audio: { mime: "audio/wav", base64: "UklGRg==" },
      }),
    });
    const bound = await geminiHandler(audioRequest(), env, http as typeof fetch);
    expect(bound.status).toBe(200);
    expect(await bound.json()).toMatchObject({ action: { kind: "edit_time", itemId: selectedId,
      day: "2030-01-02", time: "09:00" }, transcript: "把所選景點改成上午九點",
      confirmationRequired: true });
    proposedItemId = crypto.randomUUID();
    const rejected = await geminiHandler(audioRequest(), env, http as typeof fetch);
    expect(rejected.status).toBe(200);
    expect(await rejected.json()).toMatchObject({ action: { kind: "clarify",
      message: expect.stringContaining("所選卡片") }, transcript: "把所選景點改成上午九點" });
  });
  it("never silently applies an audio action when the transcript names another place", async () => {
    const selectedId = crypto.randomUUID();
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        kind: "edit_time", message: "改為上午九點", itemId: null,
        day: "2030-01-02", time: "09:00", transcript: "把另一家咖啡店改成上午九點",
      }) }] } }] });
    };
    const result = await geminiHandler(new Request("https://preview.test/travel-planner/api/ai", {
      method: "POST", headers: { Authorization: "Bearer synthetic-token" }, body: JSON.stringify({
        mode: "assist", tripId: crypto.randomUUID(), requestId: crypto.randomUUID(),
        query: "請理解這段語音並只依明確語意提出操作", selectedDay: "2030-01-02",
        selectedItem: { id: selectedId, name: "合成景點" }, audio: { mime: "audio/wav", base64: "UklGRg==" },
      }),
    }), env, http as typeof fetch);
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ action: { kind: "edit_time", itemId: selectedId },
      transcript: "把另一家咖啡店改成上午九點", confirmationRequired: true });
  });
  it("sends an audio undo to the current visible Undo control instead of binding stale state", async () => {
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        kind: "undo", message: "復原上一筆", transcript: "復原上一筆",
      }) }] } }] });
    };
    const result = await geminiHandler(new Request("https://preview.test/travel-planner/api/ai", {
      method: "POST", headers: { Authorization: "Bearer synthetic-token" }, body: JSON.stringify({
        mode: "assist", tripId: crypto.randomUUID(), requestId: crypto.randomUUID(),
        query: "請理解這段語音並只依明確語意提出操作", selectedDay: "2030-01-02",
        audio: { mime: "audio/wav", base64: "UklGRg==" },
      }),
    }), env, http as typeof fetch);
    expect(result.status).toBe(200);
    expect(await result.json()).toMatchObject({ action: { kind: "clarify",
      message: expect.stringContaining("復原") }, transcript: "復原上一筆" });
  });
  it("requires an explicit date before proposing any audio add or selected-card mutation", async () => {
    const selectedId = crypto.randomUUID();
    for (const kind of ["add", "move", "edit_time", "candidate"] as const) {
      const http = async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("accounts:lookup")) return owner();
        if (url.includes("/records/")) return trip();
        if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
        if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
        if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
        return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
          kind, message: "操作", name: "合成地點", itemId: selectedId, time: "09:00",
          transcript: "把所選安排改成上午九點",
        }) }] } }] });
      };
      const result = await geminiHandler(new Request("https://preview.test/travel-planner/api/ai", {
        method: "POST", headers: { Authorization: "Bearer synthetic-token" }, body: JSON.stringify({
          mode: "assist", tripId: crypto.randomUUID(), requestId: crypto.randomUUID(),
          query: "請理解這段語音並只依明確語意提出操作", selectedDay: "2030-01-02",
          selectedItem: { id: selectedId, name: "合成景點" }, audio: { mime: "audio/wav", base64: "UklGRg==" },
        }),
      }), env, http as typeof fetch);
      expect(result.status).toBe(200);
      expect(await result.json()).toMatchObject({ action: { kind: "clarify",
        message: expect.stringContaining("明確的旅程日期") }, transcript: "把所選安排改成上午九點" });
    }
  });
  it("keeps a vision HTTP 400 charge-unknown and records only allowlisted provider diagnostics", async () => {
    vi.mocked(finishAiUsage).mockClear();
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      return Response.json({ error: { status: "INVALID_ARGUMENT",
        message: "Unknown name 'responseFormat' at 'generation_config': private fixture text" },
      }, { status: 400 });
    };
    const result = await geminiHandler(new Request("https://preview.test/travel-planner/api/ai", {
      method: "POST", headers: { Authorization: "Bearer synthetic-token" }, body: JSON.stringify({
        mode: "vision", tripId: crypto.randomUUID(), requestId: crypto.randomUUID(), query: "synthetic image",
        image: { mime: "image/png", base64: "AAAA" },
      }),
    }), env, http as typeof fetch);
    expect(result.status).toBe(502);
    const event = vi.mocked(finishAiUsage).mock.lastCall?.[1];
    expect(event).toMatchObject({ result: "http-error-charge-unknown", httpStatus: 400,
      providerErrorStatus: "INVALID_ARGUMENT", providerErrorCategory: "unknown-field",
      providerErrorField: "responseFormat" });
    expect(JSON.stringify(event)).not.toContain("private fixture text");
  });
  it("does not call the provider when the one-time budget cannot reserve", async () => {
    vi.mocked(reserveAiTestBudget).mockRejectedValueOnce(new Error("test-budget-exhausted"));
    let paidCalls = 0;
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      paidCalls++; return Response.json({});
    };
    const response = await geminiHandler(request(), env, http as typeof fetch);
    expect(response.status).toBe(429);
    expect((await response.json()).error).toContain("沒有呼叫 Gemini");
    expect(paidCalls).toBe(0);
  });
  it("never calls the paid provider when the durable sent receipt fails", async () => {
    vi.mocked(beginAiUsage).mockRejectedValueOnce(new Error("ledger-unavailable"));
    let paidCalls = 0;
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      paidCalls++;
      return Response.json({});
    };
    const response = await geminiHandler(request(), env, http as typeof fetch);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("沒有呼叫 Gemini");
    expect(paidCalls).toBe(0);
  });
  it("charges and calls the provider once for concurrent/replayed request IDs, even with a changed payload", async () => {
    const id = crypto.randomUUID();
    let gatewayCalls = 0, quotaWrites = 0;
    const reserved = new Set<string>();
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") {
        const key = url.split("/aiRequests/")[1].split("?")[0];
        if (reserved.has(key)) return new Response("", { status: 412 });
        reserved.add(key);
        return Response.json({});
      }
      if (url.includes("/aiUsage/") && init?.method === "PATCH") { quotaWrites++; return Response.json({}); }
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      gatewayCalls++;
      return Response.json({ candidates: [{ content: { parts: [{ text: '{"kind":"clarify","message":"請確認日期"}' }] } }] });
    };
    const responses = await Promise.all([
      geminiHandler(request("assist", id), env, http as typeof fetch),
      geminiHandler(request("assist", id), env, http as typeof fetch),
    ]);
    expect(responses.map((result) => result.status).sort()).toEqual([200, 409]);
    expect((await geminiHandler(request("assist", id, "另一個要求"), env, http as typeof fetch)).status).toBe(409);
    expect(gatewayCalls).toBe(1);
    expect(quotaWrites).toBe(1);
  });
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
    expect(gatewayReady((key) => ({ ...vars, TRAVEL_PLANNER_GEMINI_PROVIDER: "google-direct",
      TRAVEL_PLANNER_GOOGLE_GEMINI_API_KEY: "planner-only-key", NETLIFY_AI_GATEWAY_KEY: "" } as Record<string, string>)[key])).toBe(true);
    expect(gatewayReady((key) => ({ ...vars, TRAVEL_PLANNER_GEMINI_PROVIDER: "google-direct",
      TRAVEL_PLANNER_GOOGLE_GEMINI_API_KEY: "", GEMINI_API_KEY: "sibling-key" } as Record<string, string>)[key])).toBe(false);
  });
  it("uses a Planner-scoped Google API credential only when explicitly selected", async () => {
    const directEnv = (key: string) => ({ ...vars, TRAVEL_PLANNER_GEMINI_PROVIDER: "google-direct",
      TRAVEL_PLANNER_GOOGLE_GEMINI_API_KEY: "planner-only-key", NETLIFY_AI_GATEWAY_KEY: "", GEMINI_API_KEY: "sibling-key" } as Record<string, string>)[key];
    let endpoint = "", providerKey = "";
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      endpoint = url;
      providerKey = (init?.headers as Record<string, string>)?.["x-goog-api-key"];
      return Response.json({ candidates: [{ content: { parts: [{ text: '{"kind":"clarify","message":"請確認"}' }] } }] });
    };
    const response = await geminiHandler(request(), directEnv, http as typeof fetch);
    expect(response.status).toBe(200);
    expect(endpoint).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent");
    expect(providerKey).toBe("planner-only-key");
    expect((await response.json()).provider).toBe("google-direct");
  });
  it("constrains live assistant JSON to the action contract while retaining server validation", async () => {
    let generationConfig: Record<string, unknown> | undefined;
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      generationConfig = (JSON.parse(String(init?.body)) as { generationConfig: Record<string, unknown> }).generationConfig;
      return Response.json({ candidates: [{ content: { parts: [{ text: '{"kind":"add","name":"測試地點"}' }] } }] });
    };
    const result = await geminiHandler(request(), env, http as typeof fetch);
    expect(result.status).toBe(502); // An invalid provider response still cannot mutate a trip.
    expect(generationConfig?.responseMimeType).toBe("application/json");
    expect(generationConfig?.responseJsonSchema).toMatchObject({
      type: "object", required: ["kind", "message"],
      properties: { kind: { enum: expect.arrayContaining(["add", "clarify"]) },
        draftItems: { items: { required: ["day", "name"] } } },
    });
  });
  it("uses proven JSON MIME for image input and validates complete preview rows", async () => {
    let generationConfig: Record<string, unknown> | undefined;
    let visionInstruction = "";
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      const requestBody = JSON.parse(String(init?.body)) as {
        generationConfig: Record<string, unknown>; systemInstruction: { parts: { text: string }[] } };
      generationConfig = requestBody.generationConfig;
      visionInstruction = requestBody.systemInstruction.parts[0].text;
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ rows: [{
        dateText: "2030-01-02", name: "National Museum of Nature and Science", city: "Tokyo",
        time: "10:00", candidate: false, notes: "", uncertain: false,
      }], warnings: [] }) }] } }] });
    };
    const response = await geminiHandler(new Request("https://preview.test/travel-planner/api/ai", {
      method: "POST", headers: { Authorization: "Bearer synthetic-token" }, body: JSON.stringify({
        mode: "vision", tripId: crypto.randomUUID(), requestId: crypto.randomUUID(),
        query: "Read only visible synthetic itinerary text", image: { mime: "image/png", base64: "AAAA" },
      }),
    }), env, http as typeof fetch);
    expect(response.status).toBe(200);
    expect(generationConfig?.responseJsonSchema).toBeUndefined();
    expect(generationConfig?.responseFormat).toBeUndefined();
    expect(generationConfig?.responseMimeType).toBe("application/json");
    for (const key of ["dateText", "name", "city", "time", "candidate", "notes", "uncertain", "warnings"])
      expect(visionInstruction).toContain(key);
    expect(visionInstruction).toContain("dateText 用空字串");
    expect(visionInstruction).toContain("uncertain 設 true");
  });
  it("rejects incomplete JSON image rows without offering them for import", async () => {
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        rows: [{ dateText: "2030-01-02", name: "合成景點", city: "Tokyo" }], warnings: [],
      }) }] } }] });
    };
    const response = await geminiHandler(new Request("https://preview.test/travel-planner/api/ai", {
      method: "POST", headers: { Authorization: "Bearer synthetic-token" }, body: JSON.stringify({
        mode: "vision", tripId: crypto.randomUUID(), requestId: crypto.randomUUID(),
        query: "Read only visible synthetic itinerary text", image: { mime: "image/png", base64: "AAAA" },
      }),
    }), env, http as typeof fetch);
    expect(response.status).toBe(502);
    expect(await response.json()).not.toHaveProperty("rows");
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
      if (url.includes("/aiRequests/") && method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && method === "GET") return new Response("", { status: 404 });
      if (url.includes("/aiUsage/") && method === "PATCH") return Response.json({});
      return Response.json({ candidates: [{ content: { parts: [{ text: '{"kind":"add","message":"go","name":"X"}' }] } }] });
    };
    const response = await geminiHandler(request(), env, http as typeof fetch);
    expect(response.status).toBe(200);
    expect(calls.map((call) => call.method)).toEqual(["POST", "GET", "PATCH", "GET", "PATCH", "POST"]);
    expect(calls[2].url).toContain("/aiRequests/");
    expect(calls[2].url).toContain("currentDocument.exists=false");
    expect(calls[4].url).toContain("currentDocument.exists=false");
    expect(calls[5].url).toBe("https://gateway.test/v1beta/models/gemini-3.1-flash-lite:generateContent");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("stops at the daily count and does not call Gemini", async () => {
    let count = 0;
    const http = async () => { count++; return Response.json({ fields: { assistCount: { integerValue: "40" },
      exploreCount: { integerValue: "0" }, visionCount: { integerValue: "0" }, backgroundCount: { integerValue: "0" } }, updateTime: "2030-01-01T00:00:00Z" }); };
    await expect(reserveQuota(http as typeof fetch, "https://firestore.test/users/owner", "token", "owner", "assist"))
      .rejects.toThrow("quota-exhausted");
    expect(count).toBe(1);
  });
  it("reserves a shared US$1 daily ceiling before a paid call, including legacy counts", async () => {
    let writes = 0;
    const http = async (_input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "PATCH") { writes++; return Response.json({}); }
      return Response.json({ fields: { assistCount: { integerValue: "10" }, exploreCount: { integerValue: "1" },
        visionCount: { integerValue: "3" }, backgroundCount: { integerValue: "2" } }, updateTime: "2030-01-01T00:00:00Z" });
    };
    await expect(reserveQuota(http as typeof fetch, "https://firestore.test/users/owner", "token", "owner", "explore"))
      .rejects.toThrow("quota-exhausted");
    expect(writes).toBe(0);
  });
  it("uses Firestore update-time CAS so two concurrent paid calls cannot spend the last slot twice", async () => {
    let version = 1;
    let fields = { ownerId: { stringValue: "owner" }, day: { stringValue: "2030-01-01" },
      assistCount: { integerValue: "0" }, exploreCount: { integerValue: "0" },
      visionCount: { integerValue: "0" }, backgroundCount: { integerValue: "0" },
      reservedMicrousd: { integerValue: "900000" } };
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (init?.method !== "PATCH") return Response.json({ fields, updateTime: `v${version}` });
      if (!url.includes(`currentDocument.updateTime=v${version}`)) return new Response("", { status: 412 });
      fields = JSON.parse(String(init.body)).fields;
      version++;
      return Response.json({});
    };
    const results = await Promise.allSettled([0, 1].map(() => reserveQuota(http as typeof fetch,
      "https://firestore.test/users/owner", "token", "owner", "vision", new Date("2030-01-01T12:00:00Z"))));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(fields.reservedMicrousd.integerValue).toBe("970000");
  });
  it("uses the trusted local date and refuses a historical trip's 'today' before reserving cost", async () => {
    let paid = 0;
    const http = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      paid++;
      throw new Error("should not reserve or infer");
    };
    const response = await geminiHandler(request("assist", crypto.randomUUID(), "今天加入午餐"), env,
      http as typeof fetch, new Date("2026-10-03T12:00:00Z"));
    expect(response.status).toBe(200);
    expect((await response.json()).action).toMatchObject({ kind: "clarify" });
    expect(paid).toBe(0);
  });
  it("clarifies unsupported relative days before paid calls", async () => {
    let paid = 0;
    const http = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      paid++;
      throw new Error("should not reserve or infer");
    };
    const response = await geminiHandler(request("assist", crypto.randomUUID(), "後天移到下午"), env,
      http as typeof fetch, new Date("2030-01-01T12:00:00Z"));
    expect(response.status).toBe(200);
    expect((await response.json()).action.kind).toBe("clarify");
    expect(paid).toBe(0);
  });
  it("asks for a selected card before a move instead of spending on an unusable action", async () => {
    let paid = 0;
    const http = async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      paid++;
      throw new Error("should not reserve or infer");
    };
    const response = await geminiHandler(request("assist", crypto.randomUUID(),
      "把 National Museum of Nature and Science 移到 2030-01-02"), env, http as typeof fetch);
    expect(response.status).toBe(200);
    expect((await response.json()).action).toMatchObject({ kind: "clarify",
      message: expect.stringContaining("選取") });
    expect(paid).toBe(0);
  });
  it("rejects a model's different item ID even when one card was selected", async () => {
    const chosen = crypto.randomUUID();
    const body = { mode: "assist", tripId: crypto.randomUUID(), requestId: crypto.randomUUID(),
      query: "把所選安排移到 2030-01-02", selectedDay: "2030-01-01",
      selectedItem: { id: chosen, name: "合成地點甲" } };
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        kind: "move", message: "移動", itemId: crypto.randomUUID(), day: "2030-01-02",
      }) }] } }] });
    };
    const response = await geminiHandler(new Request("https://preview.test/travel-planner/api/ai", {
      method: "POST", headers: { Authorization: "Bearer synthetic-token" }, body: JSON.stringify(body),
    }), env, http as typeof fetch, new Date("2030-01-01T12:00:00Z"));
    expect(response.status).toBe(200);
    expect((await response.json()).action).toMatchObject({ kind: "clarify",
      message: expect.stringContaining("所選卡片") });
  });
  it("refuses a model action that silently uses the selected date instead of destination today", async () => {
    const body = { mode: "assist", tripId: crypto.randomUUID(), requestId: crypto.randomUUID(),
      query: "今天加入午餐", selectedDay: "2030-01-02" };
    let clock: unknown;
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      clock = JSON.parse(String(init?.body)).contents[0].parts[0];
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ kind: "add", name: "午餐",
        day: "2030-01-02", message: "加入" }) }] } }] });
    };
    const response = await geminiHandler(new Request("https://preview.test/travel-planner/api/ai", { method: "POST",
      headers: { Authorization: "Bearer synthetic-token" }, body: JSON.stringify(body) }), env,
    http as typeof fetch, new Date("2030-01-01T02:00:00Z"));
    expect(response.status).toBe(502);
    expect(JSON.stringify(clock)).toContain("destinationLocalDate");
  });
  it("rejects model-supplied unsourced exploration cards", async () => {
    const cards = Array.from({ length: 3 }, () => ({ name: "X", originalName: "X", location: "?", reason: "?",
      sourceUrls: ["https://invented.test/"], pending: [] }));
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ suggestions: cards }) }] },
        groundingMetadata: { groundingChunks: [{ web: { uri: "https://real.test/" } }] } }] });
    };
    expect((await geminiHandler(request("explore"), env, http as typeof fetch)).status).toBe(502);
  });
  it("never accepts model citations as source proof without independent place lookup", async () => {
    const cards = Array.from({ length: 3 }, (_, index) => ({ name: `虛構地點 ${index}`,
      originalName: "", location: "東京", reason: "可考慮", sourceUrls: ["https://example.org/cited"], pending: [] }));
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      if (url.startsWith("https://photon.komoot.io/api/")) return Response.json({ features: [] });
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ suggestions: cards }) }] },
        groundingMetadata: { groundingChunks: [{ web: { uri: "https://example.org/cited" } }] } }] });
    };
    const response = await geminiHandler(new Request("https://preview.test/travel-planner/api/ai", {
      method: "POST", headers: { Authorization: "Bearer synthetic-token" },
      body: JSON.stringify({ mode: "explore", tripId: crypto.randomUUID(), requestId: crypto.randomUUID(),
        city: "Tokyo", query: "景點" }) }), env, http as typeof fetch);
    expect(response.status).toBe(502);
  });
  it("refuses to cite one of two same-named OSM locations without disambiguation", async () => {
    const names = ["Same Name", "Unique A", "Unique B"];
    const cards = names.map((name) => ({ name, originalName: "", location: "Tokyo",
      reason: "可考慮", sourceUrls: [], pending: [] }));
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      if (url.startsWith("https://photon.komoot.io/api/")) {
        const name = new URL(url).searchParams.get("q") ?? "";
        const count = name === "Same Name" ? 2 : 1;
        return Response.json({ features: Array.from({ length: count }, (_, index) => ({
          geometry: { coordinates: [139.7 + index, 35.6] },
          properties: { name, city: "Tokyo", country: "Japan", osm_type: "N",
            osm_id: (names.indexOf(name) + 1) * 100 + index, osm_value: "attraction" },
        })) });
      }
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ suggestions: cards }) }] } }] });
    };
    const response = await geminiHandler(new Request("https://preview.test/travel-planner/api/ai", {
      method: "POST", headers: { Authorization: "Bearer synthetic-token" },
      body: JSON.stringify({ mode: "explore", tripId: crypto.randomUUID(), requestId: crypto.randomUUID(),
        city: "Tokyo", query: "景點" }) }), env, http as typeof fetch);
    expect(response.status).toBe(502);
  });
  it("replaces ungrounded model URLs with independently verified OSM place sources", async () => {
    const names = ["Tokyo Tower", "Sensoji", "Tokyo Skytree"];
    const cards = names.map((name, index) => ({ name, originalName: index === 0 ? "大阪城" : name,
      location: "東京", reason: "可考慮參觀",
      sourceUrls: ["https://unverified.example/"], pending: index === 0 ? ["一", "二", "三", "四", "五"] : [] }));
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      if (url.startsWith("https://photon.komoot.io/api/")) {
        const query = new URL(url).searchParams.get("q") ?? "";
        const index = names.findIndex((name) => query.includes(name));
        return Response.json({ features: index < 0 ? [] : [{ geometry: { coordinates: [139.7, 35.6] },
          properties: { name: names[index], city: "Tokyo", country: "Japan", osm_type: "N",
            osm_id: index + 100, osm_value: "attraction" } }] });
      }
      const body = JSON.parse(String(init?.body));
      expect(body.generationConfig.responseJsonSchema.properties.suggestions.minItems).toBe(3);
      expect(body.generationConfig.responseJsonSchema.properties.suggestions.maxItems).toBe(8);
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ suggestions: cards }) }] },
        groundingMetadata: { groundingChunks: [{ web: { uri: "https://grounded.example/" } }] } }] });
    };
    const response = await geminiHandler(new Request("https://preview.test/travel-planner/api/ai", { method: "POST",
      headers: { Authorization: "Bearer synthetic-token" }, body: JSON.stringify({ mode: "explore", tripId: crypto.randomUUID(),
        requestId: crypto.randomUUID(), query: "東京景點", city: "Tokyo" }) }), env, http as typeof fetch);
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions.map((card: { sourceUrls: string[] }) => card.sourceUrls[0])).toEqual([
      "https://www.openstreetmap.org/node/100", "https://www.openstreetmap.org/node/101", "https://www.openstreetmap.org/node/102"]);
    expect(result.suggestions[0].pending).toContain("推薦理由與適合度尚未由地點來源獨立確認");
    expect(result.suggestions[0].originalName).toBe("");
    expect(result.suggestions[0].pending).toContain("原文名稱尚未由地點來源確認");
    expect(result.suggestions[0].reason).toContain("理由未由地點來源證實");
  });
  it("checks additional proposals but only shows independently verified cards", async () => {
    const cards = Array.from({ length: 8 }, (_, index) => ({ name: `Place ${index}`,
      originalName: "", location: "Tokyo", reason: "可考慮", sourceUrls: [], pending: [] }));
    const http = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("accounts:lookup")) return owner();
      if (url.includes("/records/")) return trip();
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/") && init?.method === "PATCH") return Response.json({});
      if (url.includes("/aiUsage/")) return new Response("", { status: 404 });
      if (url.startsWith("https://photon.komoot.io/api/")) {
        const name = new URL(url).searchParams.get("q") ?? "";
        const index = Number(name.replace("Place ", ""));
        return Response.json({ features: Number.isInteger(index) && index >= 5 && index <= 7 ? [{
          geometry: { coordinates: [139.7, 35.6] },
          properties: { name, city: "Tokyo", country: "Japan", osm_type: "N",
            osm_id: index + 500, osm_value: "attraction" },
        }] : [] });
      }
      const body = JSON.parse(String(init?.body));
      expect(body.generationConfig.responseJsonSchema.properties.suggestions.maxItems).toBe(8);
      return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ suggestions: cards }) }] } }] });
    };
    const response = await geminiHandler(new Request("https://preview.test/travel-planner/api/ai", {
      method: "POST", headers: { Authorization: "Bearer synthetic-token" },
      body: JSON.stringify({ mode: "explore", tripId: crypto.randomUUID(), requestId: crypto.randomUUID(),
        city: "Tokyo", query: "景點" }),
    }), env, http as typeof fetch);
    expect(response.status).toBe(200);
    expect((await response.json()).suggestions.map((card: { name: string }) => card.name))
      .toEqual(["Place 5", "Place 6", "Place 7"]);
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
      if (url.includes("/aiRequests/") && init?.method === "PATCH") return Response.json({});
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
