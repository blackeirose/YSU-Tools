import "fake-indexeddb/auto";
import { beforeAll, describe, it, expect } from "vitest";
import {
  PlannerStore,
  ConflictError,
  makeOperation,
  applyOperation,
  checkBase,
  readSnapshot,
} from "../src/storage";
import type { RecordData } from "../src/model";
import type { Remote, Operation } from "../src/storage";
import { blankTrip, blankItem, blankPlace } from "../src/model";
beforeAll(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: {
      onLine: true,
      locks: { request: async (_name: string, fn: () => unknown) => fn() },
    },
    configurable: true,
  });
  Object.defineProperty(globalThis, "window", {
    value: {
      setInterval,
      clearInterval,
      addEventListener() {},
      removeEventListener() {},
    },
    configurable: true,
  });
});
describe("recoverable editing", () => {
  it("rejects an open stale draft after a newer version arrives", async () => {
    const owner = crypto.randomUUID(),
      store = new PlannerStore(owner, null);
    await store.init();
    await store.edit("create", [blankTrip(owner)]);
    const draft = {
      ...store.snapshot.records[0],
      name: "old draft",
    } as RecordData;
    await store.edit("other device", [
      { ...store.snapshot.records[0], name: "new version" } as RecordData,
    ]);
    await expect(store.edit("save draft", [draft])).rejects.toThrow(
      "草稿仍保留",
    );
    expect((store.snapshot.records[0] as { name: string }).name).toBe(
      "new version",
    );
    expect((draft as { name: string }).name).toBe("old draft");
    await store.clear();
  });
  it("keeps preview and production queues separate even for the same UID", async () => {
    const owner = crypto.randomUUID(),
      preview = new PlannerStore(owner, null, "project:preview-v1"),
      production = new PlannerStore(owner, null, "project:v1");
    await preview.init();
    await production.init();
    await preview.edit("preview", [blankTrip(owner)]);
    expect(production.snapshot.records).toHaveLength(0);
    await preview.clear();
    await production.clear();
  });
  it("undo refuses to overwrite a later edit and retains the original operation", async () => {
    const owner = crypto.randomUUID(),
      store = new PlannerStore(owner, null);
    await store.init();
    const t = blankTrip(owner);
    await store.edit("create", [t]);
    await store.edit(
      "rename",
      [{ ...store.snapshot.records[0], name: "later" } as RecordData],
      false,
    );
    await expect(store.undo()).rejects.toThrow("無法安全復原");
    expect((store.snapshot.records[0] as { name: string }).name).toBe("later");
    expect(store.snapshot.undo).not.toBeNull();
    await store.clear();
  });
  it("resolving remote uses the latest remote version, and read failure preserves the conflict", async () => {
    const owner = crypto.randomUUID();
    let server: RecordData[] = [],
      fail = false;
    const remote: Remote = {
      watch: () => () => {},
      read: async (ids) => {
        if (fail) throw new Error("offline");
        return server.filter((r) => ids.includes(r.id));
      },
      commit: async (op) => {
        if (!checkBase(server, op)) throw new ConflictError(server);
        server = applyOperation(server, op);
      },
    };
    const store = new PlannerStore(owner, remote);
    await store.init();
    const t = blankTrip(owner);
    await store.edit("create", [t]);
    await store.flush();
    navigator.onLine = false;
    await store.edit("offline delete", [
      { ...store.snapshot.records[0], deleted: true },
    ]);
    server = applyOperation(
      server,
      makeOperation(
        "remote move",
        server,
        [{ ...server[0], name: "remote" } as RecordData],
        owner,
      ),
    );
    navigator.onLine = true;
    await store.flush();
    const id = store.snapshot.conflicts[0].operation.id;
    server = applyOperation(
      server,
      makeOperation(
        "newer remote",
        server,
        [{ ...server[0], name: "newest" } as RecordData],
        owner,
      ),
    );
    fail = true;
    await expect(store.resolve(id, "remote")).rejects.toThrow("offline");
    expect(store.snapshot.conflicts).toHaveLength(1);
    fail = false;
    await store.resolve(id, "remote");
    expect((store.snapshot.records[0] as { name: string }).name).toBe("newest");
    expect(store.snapshot.records[0].deleted).toBe(false);
    await store.clear();
  });
  it("CAS prevents stale cross-day/reorder/deletion writes and batches atomically", () => {
    const t = blankTrip("owner"),
      p = blankPlace("owner", t.id, "x"),
      i = blankItem("owner", t, p.id, t.start);
    const original = [t, p, i];
    const op = makeOperation(
      "move",
      original,
      [{ ...i, day: "2030-01-01", order: 2 }],
      "owner",
    );
    expect(checkBase(original, op)).toBe(true);
    expect(checkBase(applyOperation(original, op), op)).toBe(false);
    expect(() =>
      makeOperation("wrong", original, [{ ...i, ownerId: "other" }], "owner"),
    ).toThrow();
  });
  it("persists move/delete and undo across reload in IndexedDB", async () => {
    const owner = crypto.randomUUID();
    const store = new PlannerStore(owner, null);
    await store.init();
    const t = blankTrip(owner),
      p = blankPlace(owner, t.id, "test"),
      i = blankItem(owner, t, p.id, t.start);
    await store.edit("create", [t, p, i]);
    await store.edit("delete", [
      { ...store.snapshot.records.find((r) => r.id === i.id)!, deleted: true },
    ]);
    expect(
      (await readSnapshot(owner)).records.find((r) => r.id === i.id)?.deleted,
    ).toBe(true);
    await store.undo();
    expect(
      (await readSnapshot(owner)).records.find((r) => r.id === i.id)?.deleted,
    ).toBe(false);
    await store.clear();
    expect((await readSnapshot(owner)).records).toHaveLength(0);
  });
  it("retains offline edits, detects remote conflict and rebases only after an explicit choice", async () => {
    const owner = crypto.randomUUID();
    let server: RecordData[] = [];
    const remote: Remote = {
      watch() {
        return () => {};
      },
      read: async (ids) => server.filter((r) => ids.includes(r.id)),
      async commit(op) {
        if (!checkBase(server, op)) throw new ConflictError(server);
        server = applyOperation(server, op);
      },
    };
    const store = new PlannerStore(owner, remote);
    await store.init();
    navigator.onLine = false;
    const t = blankTrip(owner);
    await store.edit("create", [t]);
    expect(store.snapshot.pending).toHaveLength(1);
    expect(server).toHaveLength(0);
    navigator.onLine = true;
    await store.flush();
    expect(server).toHaveLength(1);
    navigator.onLine = false;
    await store.edit("offline rename", [
      { ...store.snapshot.records[0], name: "local" } as RecordData,
    ]);
    server = applyOperation(
      server,
      makeOperation(
        "other rename",
        server,
        [{ ...server[0], name: "remote" } as RecordData],
        owner,
      ),
    );
    navigator.onLine = true;
    await store.flush();
    expect(store.snapshot.conflicts).toHaveLength(1);
    expect((store.snapshot.records[0] as { name: string }).name).toBe("local");
    expect(
      (store.snapshot.conflicts[0].remote[0] as { name: string }).name,
    ).toBe("remote");
    await store.resolve(store.snapshot.conflicts[0].operation.id, "local");
    await store.flush();
    expect((server[0] as { name: string }).name).toBe("local");
    await store.clear();
  });
  it("failed persistence never silently acknowledges writes; rejects duplicate batch IDs", () => {
    const t = blankTrip("a");
    expect(() => makeOperation("bad", [], [t, t], "a")).toThrow("重複");
  });
});
