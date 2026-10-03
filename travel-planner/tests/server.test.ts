import { describe, it, expect } from "vitest";
import { exploreHandler } from "../src/server/explore";
const settings: Record<string, string> = {
  TRAVEL_PLANNER_OPENAI_KEY: "synthetic-key",
  TRAVEL_PLANNER_AI_MODEL: "test-model",
  TRAVEL_PLANNER_FIREBASE_PROJECT_ID: "demo-travel-planner",
  TRAVEL_PLANNER_FIREBASE_WEB_KEY: "public-test-key",
  TRAVEL_PLANNER_AI_OWNER_UID: "owner",
  TRAVEL_PLANNER_FIREBASE_NAMESPACE: "preview-v1",
};
const env = (key: string) => settings[key];
function request() {
  return new Request("https://example.test/travel-planner/api/explore", {
    method: "POST",
    headers: { Authorization: "Bearer synthetic-token" },
    body: JSON.stringify({
      tripId: crypto.randomUUID(),
      query: "雨天室內活動",
    }),
  });
}
describe("server trust boundary", () => {
  it("rejects fabricated URL citations even when the model returns valid-looking cards", async () => {
    let calls = 0;
    const http = async () => {
      if (++calls === 1)
        return Response.json({ users: [{ localId: "owner" }] });
      if (calls === 2)
        return Response.json({
          fields: {
            ownerId: { stringValue: "owner" },
            kind: { stringValue: "trip" },
          },
        });
      return Response.json({
        output: [
          {
            type: "web_search_call",
            action: { sources: [{ url: "https://official.test/real" }] },
          },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  suggestions: Array.from({ length: 3 }, () => ({
                    name: "Synthetic",
                    originalName: "Synthetic",
                    location: "Unlocated",
                    reason: "Example",
                    sourceUrls: ["https://invented.test/fake"],
                    pending: ["Verify"],
                  })),
                }),
              },
            ],
          },
        ],
      });
    };
    expect(
      (await exploreHandler(request(), env, http as typeof fetch)).status,
    ).toBe(502);
    expect(calls).toBe(3);
  });
  it("fails closed without settings and without sign-in", async () => {
    expect((await exploreHandler(request(), () => undefined)).status).toBe(503);
    const r = new Request("https://example.test", {
      method: "POST",
      body: "{}",
    });
    expect((await exploreHandler(r, env)).status).toBe(401);
    expect(
      (await exploreHandler(new Request("https://example.test"), env)).status,
    ).toBe(405);
  });
  it("denies expired identity, other users, and inaccessible trips before any AI call", async () => {
    let calls = 0;
    const bad = async () => {
      calls++;
      return new Response("{}", { status: 401 });
    };
    expect(
      (await exploreHandler(request(), env, bad as typeof fetch)).status,
    ).toBe(401);
    expect(calls).toBe(1);
    calls = 0;
    const other = async () => {
      calls++;
      return Response.json({ users: [{ localId: "other" }] });
    };
    expect(
      (await exploreHandler(request(), env, other as typeof fetch)).status,
    ).toBe(403);
    expect(calls).toBe(1);
    calls = 0;
    const denied = async () =>
      ++calls === 1
        ? Response.json({ users: [{ localId: "owner" }] })
        : new Response("{}", { status: 403 });
    expect(
      (await exploreHandler(request(), env, denied as typeof fetch)).status,
    ).toBe(403);
    expect(calls).toBe(2);
  });
  it("validates resource ownership, actual search source URLs, query time and no-store", async () => {
    const cards = Array.from({ length: 3 }, (_, i) => ({
      name: `合成候選 ${i}`,
      originalName: "Example",
      location: "未定位",
      reason: "提供室內空間",
      sourceUrls: ["https://official.test/place"],
      pending: ["確認開放時間"],
    }));
    let calls = 0;
    const http = async () => {
      calls++;
      if (calls === 1) return Response.json({ users: [{ localId: "owner" }] });
      if (calls === 2)
        return Response.json({
          fields: {
            ownerId: { stringValue: "owner" },
            kind: { stringValue: "trip" },
          },
        });
      return Response.json({
        output: [
          {
            type: "web_search_call",
            action: { sources: [{ url: "https://official.test/place" }] },
          },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({ suggestions: cards }),
              },
            ],
          },
        ],
      });
    };
    const response = await exploreHandler(request(), env, http as typeof fetch);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const data = await response.json();
    expect(data.suggestions).toHaveLength(3);
    expect(data.suggestions[0].checkedAt).toMatch(/^20/);
  });
  it("rejects invented citations and service failures without changing any trip", async () => {
    let calls = 0;
    const http = async () => {
      calls++;
      if (calls === 1) return Response.json({ users: [{ localId: "owner" }] });
      if (calls === 2)
        return Response.json({
          fields: {
            ownerId: { stringValue: "owner" },
            kind: { stringValue: "trip" },
          },
        });
      return new Response("{}", { status: 500 });
    };
    expect(
      (await exploreHandler(request(), env, http as typeof fetch)).status,
    ).toBe(502);
    expect(calls).toBe(3);
  });
});
