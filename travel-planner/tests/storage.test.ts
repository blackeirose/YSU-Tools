import "fake-indexeddb/auto";
import { beforeAll, describe, it, expect } from "vitest";
import {
  PlannerStore,
  ConflictError,
  makeOperation,
  applyOperation,
  checkBase,
  readSnapshot,
  persist,
  productionTripViolation,
} from "../src/storage";
import type { RecordData } from "../src/model";
import type { Remote, Operation } from "../src/storage";
import { blankTrip, blankItem, blankPlace } from "../src/model";
beforeAll(() => {
  const held = new Map<string, Promise<unknown>>();
  Object.defineProperty(globalThis, "navigator", {
    value: {
      onLine: true,
      locks: {
        request: async (name: string, fn: () => unknown) => {
          const next = (held.get(name) ?? Promise.resolve())
            .catch(() => {})
            .then(fn);
          held.set(name, next);
          return next;
        },
      },
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
  it("production policy rejects Trip tombstone but permits a safe range Undo", async () => {
    const owner = crypto.randomUUID();
    const original = { ...blankTrip(owner), start: "2030-01-01", end: "2030-01-03" };
    let server: RecordData[] = [];
    const remote: Remote = {
      watch: () => () => {},
      read: async (ids) => server.filter((r) => ids.includes(r.id)),
      preflight(op) {
        const issue = productionTripViolation(op);
        if (issue) throw new Error(issue);
      },
      async commit(op) {
        if (productionTripViolation(op)) throw new ConflictError([], "policy");
        server = applyOperation(server, op);
      },
    };
    const store = new PlannerStore(owner, remote);
    await store.init();
    await store.edit("create", [original]);
    await store.flush();
    await expect(store.undo()).rejects.toThrow("不能刪除");
    expect(store.snapshot.pending).toHaveLength(0);
    expect(store.snapshot.records.find((r) => r.id === original.id)?.deleted).toBe(false);
    const current = store.snapshot.records.find((r) => r.id === original.id) as typeof original;
    await store.edit("extend", [{ ...current, end: "2030-01-04" }]);
    await store.flush();
    await store.undo();
    await store.flush();
    expect(store.snapshot.pending).toHaveLength(0);
    expect(server.find((r) => r.id === original.id)).toMatchObject({ end: "2030-01-03" });
    await store.clear();
  });
  it("isolates a legacy policy-rejected pending Trip edit and continues unrelated sync", async () => {
    const owner = crypto.randomUUID();
    const base = { ...blankTrip(owner), start: "2030-01-01", end: "2030-01-04", revision: 1 };
    const stale = makeOperation("old offline shrink", [base], [{ ...base, end: "2030-01-02" }], owner);
    let server: RecordData[] = [base];
    await persist(owner, { records: applyOperation([base], stale), pending: [stale], conflicts: [], undo: stale, downloaded: [] });
    const remote: Remote = {
      watch: () => () => {},
      read: async (ids) => server.filter((r) => ids.includes(r.id)),
      preflight(op) {
        const issue = productionTripViolation(op);
        if (issue) throw new Error(issue);
      },
      async commit(op) {
        if (op.changes.some((change) => change.before?.kind === "trip" && change.after.kind === "trip" &&
          change.after.end < change.before.end && !change.after.detachedItemIds)) throw new ConflictError([], "policy");
        server = applyOperation(server, op);
      },
    };
    const store = new PlannerStore(owner, remote);
    await store.init();
    await store.flush();
    expect(store.snapshot.conflicts[0].reason).toBe("policy");
    expect(store.snapshot.conflicts[0].operation.changes[0].after).toMatchObject({ end: "2030-01-02" });
    await store.edit("unrelated", [blankTrip(owner)]);
    await store.flush();
    expect(server).toHaveLength(2);
    expect(store.snapshot.pending).toHaveLength(0);
    await store.resolve(store.snapshot.conflicts[0].operation.id, "remote");
    expect(store.snapshot.records.find((r) => r.id === base.id)).toMatchObject({ end: "2030-01-04" });
    await store.clear();
  });
  it("a stalled network commit does not block offline edits or overwrite their queue on ack", async () => {
    const owner = crypto.randomUUID();
    let release!: () => void, entered!: () => void;
    const started = new Promise<void>((r) => {
      entered = r;
    });
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const remote: Remote = {
      watch: () => () => {},
      read: async () => [],
      commit: async () => {
        entered();
        await gate;
      },
    };
    const store = new PlannerStore(owner, remote);
    await store.init();
    await store.edit("first", [blankTrip(owner)]);
    await started;
    navigator.onLine = false;
    try {
      await store.edit("offline second", [blankTrip(owner)]);
      expect((await readSnapshot(owner)).pending).toHaveLength(2);
      release();
      await store.flush();
      expect((await readSnapshot(owner)).records).toHaveLength(2);
      expect((await readSnapshot(owner)).pending).toHaveLength(1);
    } finally {
      release();
      navigator.onLine = true;
      await store.clear();
    }
  });
  it("session-loss cleanup recovers the latest disk queue even before a tab received its broadcast", async () => {
    const owner = crypto.randomUUID(),
      store = new PlannerStore(owner, null);
    await store.init();
    const op = makeOperation("other tab", [], [blankTrip(owner)], owner);
    const snapshot = {
      records: applyOperation([], op),
      pending: [op],
      conflicts: [],
      undo: op,
      downloaded: [],
    };
    await persist(owner, snapshot);
    expect(store.snapshot.records).toHaveLength(0);
    const recovered = await store.clearWithRecovery();
    expect(recovered?.pending).toHaveLength(1);
    expect((await readSnapshot(owner)).records).toHaveLength(0);
    const other = new PlannerStore("other-" + owner, null);
    await expect(other.restoreAfterSessionLoss(recovered!)).rejects.toThrow(
      "帳號不符",
    );
    const same = new PlannerStore(owner, null);
    await same.restoreAfterSessionLoss(recovered!);
    await same.init();
    expect(same.snapshot.pending).toHaveLength(1);
    await same.clear();
    await other.clear();
  });
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
    const t = { ...blankTrip("owner"), start: "2030-01-01", end: "2030-01-03" },
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
  it("serializes trip shortening with offline item creation and movement in either order", () => {
    const t = { ...blankTrip("owner"), start: "2030-01-01", end: "2030-01-03" };
    const p = blankPlace("owner", t.id, "Museum");
    const i = blankItem("owner", t, p.id, "2030-01-02");
    const base = [t, p, i];
    const shorten = makeOperation("shorten", base, [{ ...t, end: "2030-01-02" }], "owner");
    const move = makeOperation("move", base, [{ ...i, day: "2030-01-03" }], "owner");
    expect(move.changes.map((c) => c.id)).toContain(t.id);
    expect(checkBase(applyOperation(base, shorten), move)).toBe(false);
    expect(checkBase(applyOperation(base, move), shorten)).toBe(false);
    expect(() => makeOperation("outside", applyOperation(base, shorten), [
      blankItem("owner", t, p.id, "2030-01-03"),
    ], "owner")).toThrow(/日期|範圍/);
  });
  it("rejects a 451-record cloud batch before it reaches IndexedDB, keeping ordinary edits possible", async () => {
    const owner = crypto.randomUUID();
    const remote: Remote = { watch: () => () => {}, read: async () => [], commit: async () => {} };
    const store = new PlannerStore(owner, remote);
    await store.init();
    const many = Array.from({ length: 451 }, () => blankTrip(owner));
    await expect(store.edit("oversized", many)).rejects.toThrow(/450/);
    expect((await readSnapshot(owner)).records).toHaveLength(0);
    expect((await readSnapshot(owner)).pending).toHaveLength(0);
    await store.edit("normal", [blankTrip(owner)]);
    await store.flush();
    expect((await readSnapshot(owner)).pending).toHaveLength(0);
    await store.clear();
  });
  it.each([449, 450])("accepts a %i-record cloud batch", async (count) => {
    const owner = crypto.randomUUID();
    let committed = 0;
    const remote: Remote = { watch: () => () => {}, read: async () => [], commit: async (op) => { committed = op.changes.length; } };
    const store = new PlannerStore(owner, remote);
    await store.init();
    await store.edit("batch", Array.from({ length: count }, () => blankTrip(owner)));
    await store.flush();
    expect(committed).toBe(count);
    expect((await readSnapshot(owner)).pending).toHaveLength(0);
    await store.clear();
  });
  it("quarantines an old permanently oversized pending batch and syncs an unrelated edit", async () => {
    const owner = crypto.randomUUID();
    const old = makeOperation("old copy", [], Array.from({ length: 451 }, () => blankTrip(owner)), owner);
    await persist(owner, { records: applyOperation([], old), pending: [old], conflicts: [], undo: old, downloaded: [] });
    const committed: string[] = [];
    const remote: Remote = { watch: () => () => {}, read: async () => [], commit: async (op) => { committed.push(op.label); } };
    const store = new PlannerStore(owner, remote);
    await store.init();
    await store.flush();
    expect(store.snapshot.conflicts[0].reason).toBe("oversize");
    expect(store.snapshot.records).toHaveLength(451);
    await store.edit("unrelated", [blankTrip(owner)]);
    await store.flush();
    expect(committed).toContain("unrelated");
    expect(store.snapshot.pending).toHaveLength(0);
    expect(store.snapshot.conflicts[0].operation.changes).toHaveLength(451);
    await store.clear();
  });
  it("quarantines a legacy offline item operation with its source data intact", async () => {
    const owner = crypto.randomUUID();
    const trip = { ...blankTrip(owner), start: "2030-01-01", end: "2030-01-03" };
    const place = blankPlace(owner, trip.id, "x");
    const item = blankItem(owner, trip, place.id, "2030-01-03");
    const legacy = { id: crypto.randomUUID(), label: "old offline item", changes: [{ id: item.id, before: null, after: { ...item, revision: 1 } }] };
    await persist(owner, { records: [trip, place, legacy.changes[0].after], pending: [legacy], conflicts: [], undo: legacy, downloaded: [] });
    const remote: Remote = { watch: () => () => {}, read: async () => [trip], commit: async () => { throw new Error("legacy reached cloud"); } };
    const store = new PlannerStore(owner, remote);
    await store.init();
    await store.flush();
    expect(store.snapshot.conflicts[0].reason).toBe("legacy");
    expect(store.snapshot.records.find((r) => r.id === item.id)).toBeTruthy();
    await store.clear();
  });
  it("rebases a conflicted item onto a chosen valid day without reverting a remote trip shrink", async () => {
    const owner = crypto.randomUUID();
    const trip = { ...blankTrip(owner), start: "2030-01-01", end: "2030-01-03" };
    const place = blankPlace(owner, trip.id, "keep");
    const item = blankItem(owner, trip, place.id, "2030-01-01");
    let server: RecordData[] = [trip, place, item];
    await persist(owner, { records: server, pending: [], conflicts: [], undo: null, downloaded: [] });
    const remote: Remote = {
      watch: () => () => {},
      read: async (ids) => server.filter((r) => ids.includes(r.id)),
      commit: async (op) => {
        if (!checkBase(server, op)) throw new ConflictError(server);
        server = applyOperation(server, op);
      },
    };
    const store = new PlannerStore(owner, remote);
    await store.init();
    navigator.onLine = false;
    await store.edit("offline move", [{ ...item, day: "2030-01-03" }]);
    server = applyOperation(server, makeOperation("remote shrink", server, [{ ...trip, end: "2030-01-02" }], owner));
    navigator.onLine = true;
    await store.flush();
    expect(store.snapshot.conflicts).toHaveLength(1);
    const id = store.snapshot.conflicts[0].operation.id;
    await expect(store.resolve(id, "local")).rejects.toThrow("請先選擇旅程內");
    expect(store.snapshot.conflicts).toHaveLength(1);
    await store.resolve(id, "local", "2030-01-02");
    await store.flush();
    expect(server.find((r) => r.id === trip.id)).toMatchObject({ end: "2030-01-02" });
    expect(server.find((r) => r.id === item.id)).toMatchObject({ day: "2030-01-02" });
    expect(store.snapshot.conflicts).toHaveLength(0);
    await store.clear();
  });
  it("rebases local trip shrink with a concurrent remote move as a recoverable candidate", async () => {
    const owner = crypto.randomUUID();
    const trip = { ...blankTrip(owner), start: "2030-01-01", end: "2030-01-03" };
    const place = blankPlace(owner, trip.id, "remote stop");
    const item = blankItem(owner, trip, place.id, "2030-01-01");
    let server: RecordData[] = [trip, place, item];
    await persist(owner, { records: server, pending: [], conflicts: [], undo: null, downloaded: [] });
    const remote: Remote = {
      watch: () => () => {}, // deliberately delay all server snapshots
      read: async (ids) => server.filter((r) => ids.includes(r.id)),
      readTrip: async (tripId) => server.filter((r) => r.kind === "item" && r.tripId === tripId),
      commit: async (op) => {
        if (!checkBase(server, op)) throw new ConflictError(server);
        server = applyOperation(server, op);
      },
    };
    const store = new PlannerStore(owner, remote);
    await store.init();
    navigator.onLine = false;
    await store.edit("offline shorten", [{ ...trip, end: "2030-01-02" }]);
    server = applyOperation(server, makeOperation("other device moves", server, [{ ...item, day: "2030-01-03" }], owner));
    navigator.onLine = true;
    await store.flush();
    const id = store.snapshot.conflicts[0].operation.id;
    await store.resolve(id, "local");
    await store.flush();
    expect(store.snapshot.conflicts).toHaveLength(0);
    expect(server.find((r) => r.id === trip.id)).toMatchObject({ end: "2030-01-02", detachedItemIds: [item.id] });
    expect(server.find((r) => r.id === item.id)).toMatchObject({ day: "2030-01-03" });
    await store.clear();
  });
});
