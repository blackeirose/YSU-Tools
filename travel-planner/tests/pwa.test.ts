import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import { serviceWorkerSource } from "../scripts/sw-source.mjs";

describe("scoped PWA updates", () => {
  it("removes only prior Planner shells and never touches private data or sibling caches", async () => {
    const listeners = new Map<string, (event: unknown) => void>();
    const names = new Set([
      "ysu-travel-planner-shell-old",
      "ysu-travel-planner-shell-current",
      "ysu-travel-private-offline",
      "sibling-tool-shell-v1",
    ]);
    const removed: string[] = [];
    const privateRecords = { trip: "still here", pending: ["offline edit"] };
    runInNewContext(serviceWorkerSource(["/travel-planner/index.html"], "current"), {
      self: {
        location: { origin: "https://example.test" },
        addEventListener: (name: string, fn: (event: unknown) => void) => listeners.set(name, fn),
        clients: { claim: async () => undefined },
      },
      caches: {
        keys: async () => [...names],
        delete: async (name: string) => { removed.push(name); names.delete(name); return true; },
      },
      URL,
    });
    let activation: Promise<unknown> = Promise.resolve();
    listeners.get("activate")!({ waitUntil: (promise: Promise<unknown>) => { activation = promise; } });
    await activation;
    expect(removed).toEqual(["ysu-travel-planner-shell-old"]);
    expect([...names]).toContain("sibling-tool-shell-v1");
    expect([...names]).toContain("ysu-travel-private-offline");
    expect(privateRecords).toEqual({ trip: "still here", pending: ["offline edit"] });
    let intercepted = false;
    const fetchHandler = listeners.get("fetch")!;
    for (const path of ["/sibling/", "/travel-planner/api/private"]) {
      fetchHandler({ request: { url: `https://example.test${path}`, method: "GET", mode: "cors" },
        respondWith: () => { intercepted = true; } });
    }
    expect(intercepted).toBe(false);
  });
});
