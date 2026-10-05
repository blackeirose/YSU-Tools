import { getStore } from "@netlify/blobs";
import { aiUsageEntry, logAiUsage, type AiUsageEvent } from "./ai-usage";

// Site-scoped, server-only storage survives individual Preview deploys. The
// namespace and owner isolate records; no endpoint exposes this ledger.
export const aiLedgerStore = () => getStore({ name: "travel-planner-ai-ledger-v1", consistency: "strong" });
type Store = ReturnType<typeof aiLedgerStore>;
type Receipt = { store: Store; key: string; etag: string };

export async function beginAiUsage(namespace: string, ownerId: string, event: AiUsageEvent,
  store: Store = aiLedgerStore()): Promise<Receipt> {
  if (!["v1", "preview-v1"].includes(namespace) || !/^[0-9a-f-]{36}$/i.test(event.id) ||
    !/^[a-z-]+$/.test(event.stage) || !ownerId || ownerId.includes("/")) throw new Error("ai-ledger-key");
  const key = `${namespace}/${ownerId}/${event.id}/${event.stage}`;
  const sent = { ...event, result: "sent-charge-unknown" };
  const result = await store.setJSON(key, aiUsageEntry(sent), { onlyIfNew: true });
  if (!result.modified || !result.etag) throw new Error("ai-ledger-unavailable-or-duplicate");
  logAiUsage(sent);
  return { store, key, etag: result.etag };
}

export async function finishAiUsage(receipt: Receipt, event: AiUsageEvent): Promise<void> {
  try {
    const result = await receipt.store.setJSON(receipt.key, aiUsageEntry(event), { onlyIfMatch: receipt.etag });
    if (!result.modified) console.warn("travel-planner-ai-ledger-unresolved", { id: event.id, stage: event.stage });
  } catch {
    // The durable sent record remains charge-unknown. Never erase or reissue it.
    console.warn("travel-planner-ai-ledger-unresolved", { id: event.id, stage: event.stage });
  }
  logAiUsage(event);
}
