import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, writeBatch } from "firebase/firestore";
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

  it("accepts guarded moves in either write order; rejects out-of-range days and Trip shortening", async () => {
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
    await assertFails(setDoc(tripRef, { ...trip, revision: 3, end: "2031-12-31" }));
    await assertSucceeds(setDoc(tripRef, { ...trip, revision: 3, end: "2032-01-03" }));
    await assertFails(setDoc(itemRef, { ...item, revision: 3, day: "2032-01-03" }));
    const reverseOrder = writeBatch(owner);
    reverseOrder.set(itemRef, { ...item, revision: 3, day: "2032-01-03" });
    reverseOrder.set(tripRef, { ...trip, revision: 4, end: "2032-01-03" });
    await assertSucceeds(reverseOrder.commit());
    await assertFails(setDoc(tripRef, { ...trip, revision: 5, deleted: true }));
    const saved = await getDoc(itemRef);
    if (saved.data()?.day !== "2032-01-03") throw new Error("Guarded move did not persist");
  });
});
