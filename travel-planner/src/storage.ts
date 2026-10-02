import { recordSchema, uid, validateSchedule } from "./model";
import type { RecordData } from "./model";
export type Change = {
  id: string;
  before: RecordData | null;
  after: RecordData;
};
export type Operation = { id: string; label: string; changes: Change[] };
export type Conflict = {
  operation: Operation;
  remote: RecordData[];
  createdAt: string;
};
export type Snapshot = {
  records: RecordData[];
  pending: Operation[];
  conflicts: Conflict[];
  undo: Operation | null;
  downloaded: string[];
};
export type Remote = {
  commit(op: Operation): Promise<void>;
  read(ids: string[]): Promise<RecordData[]>;
  watch(
    next: (records: RecordData[]) => void,
    error: (e: Error) => void,
  ): () => void;
};
export class ConflictError extends Error {
  constructor(public remote: RecordData[]) {
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
const canonical = (value: unknown): string =>
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
  if (new Set(updates.map((r) => r.id)).size !== updates.length)
    throw new Error("批次含重複項目");
  return {
    id: uid(),
    label,
    changes: updates.map((update) => {
      const before = records.find((r) => r.id === update.id) ?? null;
      if (update.ownerId !== owner || (before && before.ownerId !== owner))
        throw new Error("帳號不符");
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
}
export function applyOperation(records: RecordData[], op: Operation) {
  const result = new Map(records.map((r) => [r.id, r]));
  for (const c of op.changes) result.set(c.id, c.after);
  return [...result.values()];
}
export function checkBase(records: RecordData[], op: Operation) {
  return op.changes.every(
    (c) =>
      (records.find((r) => r.id === c.id)?.revision ?? 0) ===
      (c.before?.revision ?? 0),
  );
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
  constructor(
    public owner: string,
    public remote: Remote | null,
  ) {
    this.channel = new BroadcastChannel(DB);
    this.channel.onmessage = (e) => {
      if (e.data?.owner === owner) this.reload();
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
            : "已同步"
        : "本機已儲存 · 不跨裝置";
  }
  async init() {
    this.snapshot = await readSnapshot(this.owner);
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
    this.snapshot = await readSnapshot(this.owner);
    this.state();
    this.emit();
  }
  private async save(s: Snapshot) {
    if (this.closed) return;
    await persist(this.owner, s);
    this.snapshot = s;
    this.state();
    this.channel.postMessage({ owner: this.owner });
    this.emit();
  }
  async edit(label: string, updates: RecordData[], undoable = true) {
    const shown = this.snapshot.records;
    await lock(this.owner, async () => {
      const s = await readSnapshot(this.owner);
      if (this.closed) throw new Error("帳號已切換");
      const op = makeOperation(label, shown, updates, this.owner);
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
    await lock(this.owner, async () => {
      const s = await readSnapshot(this.owner);
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
        op.changes.map((c) => c.before ?? { ...c.after, deleted: true }),
        this.owner,
      );
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
      await lock(this.owner, async () => {
        const s = await readSnapshot(this.owner);
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
      await lock(this.owner, async () => {
        let s = await readSnapshot(this.owner);
        while (s.pending.length && !this.closed && navigator.onLine) {
          const op = s.pending[0];
          try {
            await this.remote!.commit(op);
            if (this.closed) break;
            s = { ...s, pending: s.pending.slice(1) };
            this.error = "";
            await this.save(s);
          } catch (e) {
            if (e instanceof ConflictError) {
              const affected = new Set(op.changes.map((c) => c.id));
              const related: Operation[] = [op];
              const remaining: Operation[] = [];
              for (const pending of s.pending.slice(1)) {
                if (pending.changes.some((c) => affected.has(c.id))) {
                  related.push(pending);
                  pending.changes.forEach((c) => affected.add(c.id));
                } else remaining.push(pending);
              }
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
              const latest = await this.remote!.read([...affected]);
              s = {
                ...s,
                pending: remaining,
                conflicts: [
                  ...s.conflicts,
                  {
                    operation: { ...op, changes: [...changes.values()] },
                    remote: latest,
                    createdAt: new Date().toISOString(),
                  },
                ],
                undo: null,
              };
              await this.save(s);
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
  async resolve(conflictId: string, choice: "remote" | "local") {
    if (!this.remote) return;
    await lock(this.owner, async () => {
      const s = await readSnapshot(this.owner);
      const conflict = s.conflicts.find((c) => c.operation.id === conflictId);
      if (!conflict) return;
      let records = s.records;
      const latest = await this.remote!.read(
        conflict.operation.changes.map((c) => c.id),
      );
      const remote = new Map(latest.map((r) => [r.id, r]));
      for (const c of conflict.operation.changes) {
        const current = remote.get(c.id);
        records = records.filter((r) => r.id !== c.id);
        if (current) records.push(current);
      }
      let pending = s.pending;
      if (choice === "local") {
        const op = makeOperation(
          "保留本機衝突版本",
          records,
          conflict.operation.changes.map((c) => c.after),
          this.owner,
        );
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
    await lock(this.owner, async () => {
      const s = await readSnapshot(this.owner);
      await this.save({
        ...s,
        downloaded: [...new Set([...s.downloaded, tripId])],
      });
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
    await lock(this.owner, () => persist(this.owner, null));
  }
}
