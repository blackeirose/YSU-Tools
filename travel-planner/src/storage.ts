import { recordSchema, uid, validateSchedule } from "./model";
import type { RecordData } from "./model";
export type Change = {
  id: string;
  before: RecordData | null;
  after: RecordData;
};
export function isTripVersionTouch(change: Change) {
  return change.before?.kind === "trip" && change.after.kind === "trip" &&
    canonical({ ...change.before, revision: 0, updatedAt: "" }) ===
    canonical({ ...change.after, revision: 0, updatedAt: "" });
}
export type Operation = { id: string; label: string; changes: Change[] };
export type Conflict = {
  operation: Operation;
  remote: RecordData[];
  createdAt: string;
  reason?: "concurrent" | "oversize" | "legacy" | "range" | "policy";
};
export type Snapshot = {
  records: RecordData[];
  pending: Operation[];
  conflicts: Conflict[];
  undo: Operation | null;
  downloaded: string[];
};
export type Remote = {
  preflight?(op: Operation): void;
  commit(op: Operation): Promise<void>;
  read(ids: string[]): Promise<RecordData[]>;
  readTrip?(tripId: string): Promise<RecordData[]>;
  watch(
    next: (records: RecordData[]) => void,
    error: (e: Error) => void,
  ): () => void;
};
export class ConflictError extends Error {
  constructor(public remote: RecordData[], public reason: Conflict["reason"] = "concurrent") {
    super("同一項目已在其他裝置修改");
  }
}
const empty = (): Snapshot => ({
  records: [],
  pending: [],
  conflicts: [],
  undo: null,
  downloaded: [],
});
const DB = "ysu-travel-planner-v1";
export const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, part) =>
    part && typeof part === "object" && !Array.isArray(part)
      ? Object.fromEntries(
          Object.entries(part).sort(([a], [b]) => a.localeCompare(b)),
        )
      : part,
  );
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("accounts");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function readSnapshot(owner: string): Promise<Snapshot> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("accounts", "readonly");
    const r = tx.objectStore("accounts").get(owner);
    r.onsuccess = () => resolve(r.result ?? empty());
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}
export async function persist(owner: string, data: Snapshot | null) {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("accounts", "readwrite");
    const store = tx.objectStore("accounts");
    if (data) store.put(data, owner);
    else store.delete(owner);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
    tx.onabort = () => {
      db.close();
      reject(tx.error ?? new Error("本機儲存失敗"));
    };
  });
}
export async function lock<T>(owner: string, fn: () => Promise<T>): Promise<T> {
  if (!navigator.locks)
    throw new Error("瀏覽器不支援安全的跨分頁鎖定，請使用新版瀏覽器");
  return navigator.locks.request(`${DB}:${owner}`, fn);
}
export function makeOperation(
  label: string,
  records: RecordData[],
  updates: RecordData[],
  owner: string,
): Operation {
  const guarded = [...updates];
  for (const tripId of new Set(updates.filter((r) => r.kind === "item").map((r) => (r as Extract<RecordData, { kind: "item" }>).tripId))) {
    if (guarded.some((r) => r.id === tripId)) continue;
    const trip = records.find((r) => r.id === tripId);
    if (!trip || trip.kind !== "trip" || trip.deleted) throw new Error("找不到此行程所屬旅程，請先恢復旅程資料");
    guarded.push(trip);
  }
  for (const update of updates) {
    if (update.kind !== "item") continue;
    const tripIndex = guarded.findIndex((r) => r.kind === "trip" && r.id === update.tripId);
    const current = guarded[tripIndex];
    if (current?.kind !== "trip" || !(current.detachedItemIds ?? []).includes(update.id)) continue;
    if (update.deleted || (update.day && update.day >= current.start && update.day <= current.end))
      guarded[tripIndex] = { ...current, detachedItemIds: current.detachedItemIds!.filter((id) => id !== update.id) };
  }
  if (new Set(guarded.map((r) => r.id)).size !== guarded.length)
    throw new Error("批次含重複項目");
  const op: Operation = {
    id: uid(),
    label,
    changes: guarded.map((update) => {
      const before = records.find((r) => r.id === update.id) ?? null;
      if (update.ownerId !== owner || (before && before.ownerId !== owner))
        throw new Error("帳號不符");
      if ((before?.revision ?? 0) !== update.revision)
        throw new Error(
          "此項目已更新，草稿仍保留。請先複製草稿內容，再重新開啟最新版本編輯。",
        );
      const after = recordSchema.parse({
        ...update,
        revision: (before?.revision ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      });
      if (!after.deleted && (after.kind === "item" || after.kind === "task"))
        validateSchedule(after);
      return { id: update.id, before, after };
    }),
  };
  const next = applyOperation(records, op);
  for (const change of op.changes) {
    const after = change.after;
    if (after.kind === "item" && !after.deleted && after.day &&
      (!change.before || change.before.kind !== "item" || change.before.day !== after.day)) {
      const trip = next.find((r) => r.id === after.tripId);
      if (!trip || trip.kind !== "trip" || trip.deleted || after.day < trip.start || after.day > trip.end)
        throw new Error("行程日期超出旅程範圍；原本資料已保留");
    }
    if (after.kind === "trip" && change.before?.kind === "trip" &&
      (after.start !== change.before.start || after.end !== change.before.end)) {
      if (next.some((r) => r.kind === "item" && !r.deleted && r.tripId === after.id && r.day &&
        (r.day < after.start || r.day > after.end) && !(after.detachedItemIds ?? []).includes(r.id)))
        throw new Error("有安排尚未記錄為待定；資料未變更，請重新載入旅程後再試");
    }
  }
  return op;
}
export function unguardedItemChange(op: Operation) {
  return op.changes.some((c) => c.after.kind === "item" &&
    !op.changes.some((guard) => guard.id === (c.after as Extract<RecordData, { kind: "item" }>).tripId));
}
export function productionTripViolation(op: Operation): string | null {
  for (const change of op.changes) {
    if (change.after.kind !== "trip") continue;
    if (change.after.deleted)
      return "正式雲端旅程不能刪除；請封存旅程。原操作及本機資料仍保留。";
  }
  return null;
}
export function applyOperation(records: RecordData[], op: Operation) {
  const result = new Map(records.map((r) => [r.id, r]));
  for (const c of op.changes) result.set(c.id, c.after);
  return [...result.values()];
}
/** An Undo must restore the visible candidate, not write an out-of-range raw day. */
export function undoUpdates(op: Operation, records: RecordData[]): RecordData[] {
  const projected = new Set<string>();
  const updates = op.changes.map((change) => {
    const before = change.before ?? { ...change.after, deleted: true };
    if (before.kind !== "item" || before.deleted || !before.day)
      return { ...before, revision: change.after.revision };
    const targetTrip = op.changes.find((candidate) => candidate.id === before.tripId)?.before ??
      records.find((record) => record.id === before.tripId);
    if (targetTrip?.kind !== "trip" || (before.day >= targetTrip.start && before.day <= targetTrip.end))
      return { ...before, revision: change.after.revision };
    projected.add(before.id);
    return { ...before, revision: change.after.revision, day: null, status: "candidate" as const,
      candidateOrigin: before.candidateOrigin ?? { day: before.day, order: before.order,
        status: before.status === "candidate" ? "planned" as const : before.status, reason: "trip-range" as const } };
  });
  return updates.map((update) => update.kind === "trip" && projected.size
    ? { ...update, detachedItemIds: (update.detachedItemIds ?? []).filter((id) => !projected.has(id)) }
    : update);
}
export function checkBase(records: RecordData[], op: Operation) {
  return op.changes.every(
    (c) =>
      (records.find((r) => r.id === c.id)?.revision ?? 0) ===
      (c.before?.revision ?? 0),
  );
}
/** A rules denial can be a concurrent revision race, not a durable policy error. */
export function deniedWriteConflict(op: Operation, latest: RecordData[]) {
  return checkBase(latest, op)
    ? new ConflictError(latest, "policy")
    : new ConflictError(latest, "concurrent");
}
export class PlannerStore {
  snapshot = empty();
  status = "載入中";
  error = "";
  private listeners = new Set<() => void>();
  private closed = false;
  private channel: BroadcastChannel;
  private unsubscribe?: () => void;
  private timer?: number;
  private running = false;
  private flight?: Promise<void>;
  private remoteReady = false;
  isRemoteReady() { return !this.remote || this.remoteReady; }
  private cacheKey: string;
  constructor(
    public owner: string,
    public remote: Remote | null,
    storageScope = "",
  ) {
    this.cacheKey = storageScope ? `${storageScope}:${owner}` : owner;
    this.channel = new BroadcastChannel(DB);
    this.channel.onmessage = (e) => {
      if (e.data?.owner === this.cacheKey) this.reload();
    };
  }
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private emit() {
    this.listeners.forEach((fn) => fn());
  }
  private state() {
    if (this.error) this.status = "同步失敗";
    else if (!navigator.onLine)
      this.status = this.remote ? "離線 · 修改待同步" : "離線 · 本機已儲存";
    else
      this.status = this.remote
        ? this.snapshot.conflicts.length
          ? "有衝突待處理"
          : this.snapshot.pending.length
            ? "同步中"
            : this.remoteReady
              ? "已同步"
              : "連線中"
        : "本機已儲存 · 不跨裝置";
  }
  async init() {
    this.snapshot = await readSnapshot(this.cacheKey);
    if (this.closed) return;
    this.state();
    this.emit();
    if (this.remote) {
      this.unsubscribe = this.remote.watch(
        (records) => void this.receive(records),
        (e) => {
          this.error = e.message;
          this.state();
          this.emit();
        },
      );
      this.timer = window.setInterval(() => void this.flush(), 15000);
    }
    window.addEventListener("online", this.connect);
    window.addEventListener("offline", this.connect);
    void this.flush();
  }
  private connect = () => {
    this.state();
    this.emit();
    if (navigator.onLine) void this.flush();
  };
  private async reload() {
    if (this.closed) return;
    this.snapshot = await readSnapshot(this.cacheKey);
    this.state();
    this.emit();
  }
  private async save(s: Snapshot) {
    if (this.closed) return;
    await persist(this.cacheKey, s);
    this.snapshot = s;
    this.state();
    this.channel.postMessage({ owner: this.cacheKey });
    this.emit();
  }
  async edit(label: string, updates: RecordData[], undoable = true) {
    const shown = this.snapshot.records;
    await lock(this.cacheKey, async () => {
      const s = await readSnapshot(this.cacheKey);
      if (this.closed) throw new Error("帳號已切換");
      const op = makeOperation(label, shown, updates, this.owner);
      this.remote?.preflight?.(op);
      if (this.remote && op.changes.length > 450)
        throw new Error("單次雲端操作最多 450 筆資料；本機與同步佇列未變更。請縮小批次。 ");
      if (!checkBase(s.records, op)) {
        this.snapshot = s;
        this.emit();
        throw new Error("另一個分頁剛修改了資料，請重新操作");
      }
      if (
        s.conflicts.some((c) =>
          c.operation.changes.some((x) =>
            op.changes.some((y) => x.id === y.id),
          ),
        )
      )
        throw new Error("請先處理這些項目的同步衝突");
      await this.save({
        ...s,
        records: applyOperation(s.records, op),
        pending: this.remote ? [...s.pending, op] : [],
        undo: undoable ? op : s.undo,
      });
    });
    void this.flush();
  }
  async undo() {
    await lock(this.cacheKey, async () => {
      const s = await readSnapshot(this.cacheKey);
      const op = s.undo;
      if (!op) return;
      if (
        op.changes.some((c) => {
          const current = s.records.find((r) => r.id === c.id);
          return (
            !current ||
            current.revision !== c.after.revision ||
            canonical(current) !== canonical(c.after)
          );
        })
      )
        throw new Error(
          "資料已在其他操作或裝置修改，無法安全復原；原資料已保留。",
        );
      const inverse = makeOperation(
        `復原：${op.label}`,
        s.records,
        undoUpdates(op, s.records),
        this.owner,
      );
      this.remote?.preflight?.(inverse);
      if (this.remote && inverse.changes.length > 450)
        throw new Error("這次復原超過 450 筆，請先匯出資料備份並逐項處理");
      await this.save({
        ...s,
        records: applyOperation(s.records, inverse),
        pending: this.remote ? [...s.pending, inverse] : [],
        undo: null,
      });
    });
    void this.flush();
  }
  private async receive(records: RecordData[]) {
    if (this.closed) return;
    try {
      await lock(this.cacheKey, async () => {
        if (this.closed) return;
        const s = await readSnapshot(this.cacheKey);
        const blocked = new Set(
          [...s.pending, ...s.conflicts.map((c) => c.operation)].flatMap((op) =>
            op.changes.map((c) => c.id),
          ),
        );
        const merged = new Map(s.records.map((r) => [r.id, r]));
        for (const record of records) {
          if (record.ownerId !== this.owner) continue;
          const local = merged.get(record.id);
          if (
            !blocked.has(record.id) &&
            (!local || record.revision >= local.revision)
          )
            merged.set(record.id, recordSchema.parse(record));
        }
        this.remoteReady = true;
        this.error = "";
        await this.save({ ...s, records: [...merged.values()] });
      });
    } catch (e) {
      this.error = String(e);
      this.state();
      this.emit();
    }
  }
  flush(): Promise<void> {
    if (this.flight) return this.flight;
    const job = this.flushOnce();
    this.flight = job;
    return job.finally(() => {
      if (this.flight === job) this.flight = undefined;
    });
  }
  private async flushOnce() {
    if (!this.remote || this.closed || this.running || !navigator.onLine)
      return;
    this.running = true;
    try {
      // Only synchronization holds this lock while waiting for the network.
      // Editing, offline persistence and logout use a separate short state lock.
      await lock(`${this.cacheKey}:sync`, async () => {
        while (!this.closed && navigator.onLine) {
          const op = await lock(
            this.cacheKey,
            async () => (await readSnapshot(this.cacheKey)).pending[0],
          );
          if (!op) break;
          try {
            if (op.changes.length > 450)
              throw new ConflictError([], "oversize");
            if (unguardedItemChange(op))
              throw new ConflictError([], "legacy");
            await this.remote!.commit(op);
            if (this.closed) break;
            await lock(this.cacheKey, async () => {
              if (this.closed) return;
              const current = await readSnapshot(this.cacheKey);
              this.error = "";
              await this.save({
                ...current,
                pending: current.pending.filter((p) => p.id !== op.id),
              });
            });
          } catch (e) {
            if (this.closed) break;
            if (e instanceof ConflictError) {
              // New edits may arrive during the read. Re-read if their IDs expand
              // the conflict group, then atomically preserve every related edit.
              let captured = false;
              while (!captured && !this.closed) {
                const initial = await lock(this.cacheKey, () =>
                  readSnapshot(this.cacheKey),
                );
                const readIds = new Set(
                  initial.pending.flatMap((p) => p.changes.map((c) => c.id)),
                );
                let latest: RecordData[];
                try {
                  latest = await this.remote!.read([...readIds]);
                } catch (readError) {
                  if (e.reason === "oversize" || e.reason === "legacy") latest = [];
                  else throw readError;
                }
                await lock(this.cacheKey, async () => {
                  if (this.closed) return;
                  const s = await readSnapshot(this.cacheKey);
                  if (!s.pending.some((p) => p.id === op.id)) {
                    captured = true;
                    return;
                  }
                  const affected = new Set(op.changes.map((c) => c.id));
                  const relatedIds = new Set([op.id]);
                  let expanded = true;
                  while (expanded) {
                    expanded = false;
                    for (const pending of s.pending) {
                      if (relatedIds.has(pending.id) || !pending.changes.some((c) => affected.has(c.id))) continue;
                      relatedIds.add(pending.id);
                      pending.changes.forEach((c) => affected.add(c.id));
                      expanded = true;
                    }
                  }
                  const related = s.pending.filter((p) => relatedIds.has(p.id));
                  const remaining = s.pending.filter((p) => !relatedIds.has(p.id));
                  // Preserve the latest local intention plus earliest base for every related record.
                  const changes = new Map<string, Change>();
                  for (const group of related)
                    for (const c of group.changes) {
                      const prev = changes.get(c.id);
                      changes.set(c.id, {
                        ...c,
                        before: prev ? prev.before : c.before,
                      });
                    }
                  if ([...affected].some((id) => !readIds.has(id))) return;
                  const resolved = {
                    ...s,
                    pending: remaining,
                    conflicts: [
                      ...s.conflicts,
                      {
                        operation: { ...op, changes: [...changes.values()] },
                        remote: latest.filter((r) => affected.has(r.id)),
                        createdAt: new Date().toISOString(),
                        reason: e.reason,
                      },
                    ],
                    undo: null,
                  };
                  await this.save(resolved);
                  captured = true;
                });
              }
              continue;
            }
            this.error = e instanceof Error ? e.message : "同步失敗";
            this.state();
            this.emit();
            break;
          }
        }
      });
    } catch (e) {
      this.error = String(e);
      this.state();
      this.emit();
    } finally {
      this.running = false;
    }
  }
  async resolve(conflictId: string, choice: "remote" | "local", recoveryDay?: string) {
    if (!this.remote) return;
    const initial = await lock(this.cacheKey, () =>
      readSnapshot(this.cacheKey),
    );
    const resolving = initial.conflicts.find(
      (c) => c.operation.id === conflictId,
    );
    if (!resolving) return;
    const latest = await this.remote.read(
      [...new Set([...resolving.operation.changes.map((c) => c.id),
        ...resolving.operation.changes.filter((c) => c.after.kind === "item").map((c) => (c.after as Extract<RecordData, { kind: "item" }>).tripId)])],
    );
    const shrinkingTrips = resolving.operation.changes.filter((c) =>
      c.before?.kind === "trip" && c.after.kind === "trip" &&
      (c.before.start !== c.after.start || c.before.end !== c.after.end));
    if (choice === "local" && shrinkingTrips.length && !this.remote.readTrip)
      throw new Error("無法讀取完整遠端旅程安排，不能安全縮短日期；衝突與備份仍保留。");
    const remoteTripRows = choice === "local"
      ? (await Promise.all(shrinkingTrips.map((c) => this.remote!.readTrip!(c.id)))).flat()
      : [];
    await lock(this.cacheKey, async () => {
      if (this.closed) throw new Error("帳號已切換");
      const s = await readSnapshot(this.cacheKey);
      const conflict = s.conflicts.find((c) => c.operation.id === conflictId);
      if (!conflict) return;
      let records = s.records;
      const remote = new Map(latest.map((r) => [r.id, r]));
      for (const c of conflict.operation.changes) {
        const current = remote.get(c.id);
        records = records.filter((r) => r.id !== c.id);
        if (current) records.push(current);
      }
      for (const row of latest.filter((r) => r.kind === "trip")) {
        records = records.filter((r) => r.id !== row.id);
        records.push(row);
      }
      let pending = s.pending;
      if (choice === "local") {
        if (conflict.reason === "oversize")
          throw new Error("此舊批次超過 450 筆，請先下載衝突備份；無法整批重新同步。可選擇遠端版本並重新分批建立。 ");
        const localUpdates = conflict.operation.changes.map((c) => {
          const base = isTripVersionTouch(c) ? (remote.get(c.id) ?? c.after) : c.after;
          if (base.kind === "item" && base.day) {
            const ownerTrip = records.find((r) => r.id === base.tripId);
            if (ownerTrip?.kind === "trip" && (base.day < ownerTrip.start || base.day > ownerTrip.end)) {
              // A concurrent range change is resolved with the user's explicit
              // Trip choice below. Preserve this item's original date until the
              // Trip has a durable detached-ID projection.
              if (conflict.operation.changes.some((change) => change.after.kind === "trip" && change.id === base.tripId && !isTripVersionTouch(change)))
                return { ...base, revision: remote.get(c.id)?.revision ?? 0 };
              if (!recoveryDay || recoveryDay < ownerTrip.start || recoveryDay > ownerTrip.end)
                throw new Error("本機行程超出遠端旅程日期。請先選擇旅程內的復原日期；備份仍保留。");
              return { ...base, day: recoveryDay, revision: remote.get(c.id)?.revision ?? 0 };
            }
          }
          return { ...base, revision: remote.get(c.id)?.revision ?? 0 };
        });
        for (const changedTrip of localUpdates.filter((r) => r.kind === "trip")) {
          if (changedTrip.kind !== "trip") continue;
          const latestTrip = records.find((r) => r.id === changedTrip.id);
          if (latestTrip?.kind !== "trip" ||
            (latestTrip.start === changedTrip.start && latestTrip.end === changedTrip.end)) continue;
          const override = new Map(localUpdates.map((r) => [r.id, r]));
          const outside = [...remoteTripRows, ...localUpdates].filter((r) => {
            const row = override.get(r.id) ?? r;
            return row.kind === "item" && !row.deleted && row.tripId === changedTrip.id &&
              row.day && (row.day < changedTrip.start || row.day > changedTrip.end);
          }).map((r) => r.id);
          const index = localUpdates.findIndex((r) => r.id === changedTrip.id);
          localUpdates[index] = { ...changedTrip,
            detachedItemIds: [...new Set([...(changedTrip.detachedItemIds ?? []), ...outside])] };
        }
        const op = makeOperation(
          "保留本機衝突版本",
          records,
          localUpdates,
          this.owner,
        );
        this.remote?.preflight?.(op);
        records = applyOperation(records, op);
        pending = [...pending, op];
      }
      await this.save({
        ...s,
        records,
        pending,
        conflicts: s.conflicts.filter((c) => c.operation.id !== conflictId),
        undo: null,
      });
    });
    void this.flush();
  }
  async download(tripId: string) {
    await lock(this.cacheKey, async () => {
      const s = await readSnapshot(this.cacheKey);
      await this.save({
        ...s,
        downloaded: [...new Set([...s.downloaded, tripId])],
      });
    });
  }
  async restoreAfterSessionLoss(recovery: Snapshot) {
    if (
      recovery.records.some((r) => r.ownerId !== this.owner) ||
      [...recovery.pending, ...recovery.conflicts.map((c) => c.operation)].some(
        (op) =>
          op.changes.some(
            (c) =>
              c.after.ownerId !== this.owner ||
              (c.before && c.before.ownerId !== this.owner),
          ),
      )
    )
      throw new Error("復原資料與登入帳號不符");
    await lock(this.cacheKey, async () => {
      const existing = await readSnapshot(this.cacheKey);
      if (
        existing.records.length ||
        existing.pending.length ||
        existing.conflicts.length
      )
        throw new Error("本機已有資料，請先匯出復原備份，避免覆寫");
      for (const record of recovery.records) recordSchema.parse(record);
      await this.save(structuredClone(recovery));
    });
  }
  close() {
    this.closed = true;
    this.unsubscribe?.();
    if (this.timer) window.clearInterval(this.timer);
    window.removeEventListener("online", this.connect);
    window.removeEventListener("offline", this.connect);
    this.channel.close();
    this.listeners.clear();
  }
  async clear() {
    this.close();
    await lock(this.cacheKey, () => persist(this.cacheKey, null));
  }
  async clearWithRecovery(): Promise<Snapshot | null> {
    this.close();
    return lock(this.cacheKey, async () => {
      const current = await readSnapshot(this.cacheKey);
      await persist(this.cacheKey, null);
      return current.pending.length || current.conflicts.length
        ? current
        : null;
    });
  }
}
