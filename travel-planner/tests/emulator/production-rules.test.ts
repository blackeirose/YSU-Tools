import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, writeBatch, deleteDoc } from "firebase/firestore";
import { blankItem, blankTrip } from "../../src/model";

let env: RulesTestEnvironment;
const fragment = readFileSync("firestore.production.fragment.rules", "utf8");
const merged = process.env.PLANNER_PRODUCTION_MERGED_RULES;
const rules = merged ? readFileSync(merged, "utf8") : `rules_version = '2';
service cloud.firestore { match /databases/{database}/documents {
  function trustedGoogle() { return request.auth != null && request.auth.token.email == 'owner@example.test' && request.auth.token.email_verified == true && request.auth.token.firebase.sign_in_provider == 'google.com'; }
  ${fragment}
}}`;
const ownerEmail = merged
  ? rules.match(/token\.email == ['"]([^'"]+)['"]/)?.[1]
  : "owner@example.test";
if (!ownerEmail) throw new Error("Reviewed owner policy missing");
const path = (owner: string, id: string) => `travelPlanner/v1/users/${owner}/records/${id}`;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-ysu-planner-production",
    firestore: { host: "127.0.0.1", port: 8080, rules },
  });
});
afterAll(async () => env?.cleanup());

describe("production v1 server enforcement", () => {
  it("rejects an old whole-Trip write that drops detached IDs", async () => {
    const claims = { email: ownerEmail, email_verified: true, firebase: { sign_in_provider: "google.com" } };
    const owner = env.authenticatedContext("owner", claims).firestore();
    const trip = { ...blankTrip("owner"), start: "2030-01-01", end: "2030-01-02", detachedItemIds: [crypto.randomUUID()], revision: 1 };
    const ref = doc(owner, path("owner", trip.id));
    await assertSucceeds(setDoc(ref, trip));
    const oldClient = { ...trip };
    delete (oldClient as Partial<typeof trip>).detachedItemIds;
    await assertFails(setDoc(ref, { ...oldClient, name: "legacy rename", revision: 2 }));
    await assertFails(setDoc(ref, { ...oldClient, end: "2030-01-03", revision: 2 }));
    await assertSucceeds(setDoc(ref, { ...trip, end: "2030-01-03", revision: 2 }));
    if (!(await getDoc(ref)).data()?.detachedItemIds?.includes(trip.detachedItemIds[0]))
      throw new Error("Date extension lost detached item IDs");
  });
  it("reserves paid Gemini calls monotonically in an Owner-only daily counter", async () => {
    const claims = { email: ownerEmail, email_verified: true, firebase: { sign_in_provider: "google.com" } };
    const owner = env.authenticatedContext("owner", claims).firestore();
    const other = env.authenticatedContext("other", { ...claims, email: "other@example.test" }).firestore();
    const path = "travelPlanner/v1/users/owner/aiUsage/2030-01-01";
    const ref = doc(owner, path);
    const first = { ownerId: "owner", day: "2030-01-01", assistCount: 1, exploreCount: 0, visionCount: 0, backgroundCount: 0,
      reservedMicrousd: 20000 };
    await assertFails(getDoc(doc(other, path)));
    await assertFails(setDoc(doc(other, path), first));
    await assertFails(setDoc(ref, { ...first, assistCount: 0 }));
    await assertSucceeds(setDoc(ref, first));
    await assertFails(setDoc(ref, { ...first, assistCount: 0 }));
    await assertFails(setDoc(ref, { ...first, assistCount: 3 }));
    await assertFails(setDoc(ref, { ...first, ownerId: "other", assistCount: 2 }));
    await assertSucceeds(setDoc(ref, { ...first, assistCount: 2, reservedMicrousd: 40000 }));
    await assertSucceeds(setDoc(ref, { ...first, assistCount: 2, exploreCount: 1, reservedMicrousd: 180000 }));
    await assertSucceeds(setDoc(ref, { ...first, assistCount: 2, exploreCount: 1, backgroundCount: 1, reservedMicrousd: 400000 }));
    await assertFails(setDoc(ref, { ...first, assistCount: 2, exploreCount: 2, reservedMicrousd: 400000 }));
    await assertFails(setDoc(ref, { ...first, assistCount: 2, exploreCount: 2, backgroundCount: 1, reservedMicrousd: 1100000 }));
    const legacyPath = "travelPlanner/v1/users/owner/aiUsage/2030-01-02";
    await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), legacyPath),
      { ownerId: "owner", day: "2030-01-02", assistCount: 10, exploreCount: 1, visionCount: 3, backgroundCount: 2 }));
    await assertFails(setDoc(doc(owner, legacyPath), { ownerId: "owner", day: "2030-01-02",
      assistCount: 10, exploreCount: 2, visionCount: 3, backgroundCount: 2, reservedMicrousd: 1130000 }));
    const migratable = "travelPlanner/v1/users/owner/aiUsage/2030-01-03";
    const old = { ownerId: "owner", day: "2030-01-03", assistCount: 1, exploreCount: 0, visionCount: 0, backgroundCount: 0 };
    await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), migratable), old));
    await assertFails(setDoc(doc(owner, migratable), { ...old, assistCount: 2, reservedMicrousd: 20000 }));
    await assertSucceeds(setDoc(doc(owner, migratable), { ...old, assistCount: 2, reservedMicrousd: 40000 }));
    await assertFails(setDoc(doc(owner, migratable), { ...old, assistCount: 3, reservedMicrousd: 40000 }));
    await assertFails(deleteDoc(ref));
    const requestId = crypto.randomUUID();
    const requestPath = `travelPlanner/v1/users/owner/aiRequests/${requestId}`;
    const receipt = { ownerId: "owner", requestId, mode: "assist" };
    await assertFails(setDoc(doc(other, requestPath), receipt));
    await assertSucceeds(setDoc(doc(owner, requestPath), receipt));
    await assertFails(setDoc(doc(owner, requestPath), { ...receipt, mode: "vision" }));
    await assertFails(deleteDoc(doc(owner, requestPath)));
  });
  it("rejects anonymous, another user, physical deletion and old Item-only writes", async () => {
    const claims = { email: ownerEmail, email_verified: true, firebase: { sign_in_provider: "google.com" } };
    const owner = env.authenticatedContext("owner", claims).firestore();
    const other = env.authenticatedContext("other", { ...claims, email: "other@example.test" }).firestore();
    const anon = env.unauthenticatedContext().firestore();
    const trip = { ...blankTrip("owner"), start: "2030-01-01", end: "2030-01-03", revision: 1 };
    const item = { ...blankItem("owner", trip, crypto.randomUUID(), "2030-01-01"), revision: 1 };
    const tripRef = doc(owner, path("owner", trip.id));
    const itemRef = doc(owner, path("owner", item.id));
    const create = writeBatch(owner);
    create.set(tripRef, trip);
    create.set(itemRef, item);
    await assertSucceeds(create.commit());
    await assertSucceeds(getDoc(itemRef));
    await assertFails(getDoc(doc(other, path("owner", item.id))));
    await assertFails(getDoc(doc(anon, path("owner", item.id))));
    await assertFails(setDoc(doc(other, path("owner", item.id)), { ...item, revision: 2 }));
    await assertFails(setDoc(itemRef, { ...item, revision: 2, day: "2030-01-02" }));
    await assertFails((async () => { const b = writeBatch(owner); b.delete(itemRef); await b.commit(); })());
  });

  it("accepts a versioned Trip shrink with detached IDs, while rejecting stale and out-of-range item writes", async () => {
    const claims = { email: ownerEmail, email_verified: true, firebase: { sign_in_provider: "google.com" } };
    const owner = env.authenticatedContext("owner", claims).firestore();
    const trip = { ...blankTrip("owner"), start: "2031-12-30", end: "2032-01-02", revision: 1 };
    const item = { ...blankItem("owner", trip, crypto.randomUUID(), "2032-01-01"), revision: 1 };
    const tripRef = doc(owner, path("owner", trip.id));
    const itemRef = doc(owner, path("owner", item.id));
    const create = writeBatch(owner);
    create.set(itemRef, item);
    create.set(tripRef, trip);
    await assertSucceeds(create.commit());
    const move = writeBatch(owner);
    move.set(tripRef, { ...trip, revision: 2 });
    move.set(itemRef, { ...item, revision: 2, day: "2031-12-31" });
    await assertSucceeds(move.commit());
    const invalid = writeBatch(owner);
    invalid.set(itemRef, { ...item, revision: 3, day: "2032-01-03" });
    invalid.set(tripRef, { ...trip, revision: 3 });
    await assertFails(invalid.commit());
    await assertFails(setDoc(tripRef, { ...trip, revision: 3, end: "2031-12-30" }));
    await assertSucceeds(setDoc(tripRef, { ...trip, revision: 3, end: "2031-12-30", detachedItemIds: [item.id] }));
    await assertFails(setDoc(itemRef, { ...item, revision: 3, day: "2031-12-31" }));
    const restore = writeBatch(owner);
    restore.set(itemRef, { ...item, revision: 3, day: "2031-12-30" });
    restore.set(tripRef, { ...trip, revision: 4, end: "2031-12-30", detachedItemIds: [] });
    await assertSucceeds(restore.commit());
    await assertSucceeds(setDoc(tripRef, { ...trip, revision: 5, end: "2032-01-03", detachedItemIds: [] }));
    const reverseOrder = writeBatch(owner);
    reverseOrder.set(itemRef, { ...item, revision: 4, day: "2032-01-03" });
    reverseOrder.set(tripRef, { ...trip, revision: 6, end: "2032-01-03", detachedItemIds: [] });
    await assertSucceeds(reverseOrder.commit());
    await assertFails(setDoc(tripRef, { ...trip, revision: 7, deleted: true }));
    const saved = await getDoc(itemRef);
    if (saved.data()?.day !== "2032-01-03") throw new Error("Guarded move did not persist");
  });
});
