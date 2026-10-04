import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, writeBatch, deleteDoc } from "firebase/firestore";
import { blankItem, blankTrip } from "../../src/model";
let env: RulesTestEnvironment;
const exact = process.env.PLANNER_MERGED_RULES;
const ownerEmail = exact
  ? readFileSync(exact, "utf8").match(/token\.email == ['"]([^'"]+)['"]/)?.[1]
  : "owner@example.test";
if (!ownerEmail) throw new Error("Owner policy missing from reviewed rules");
const rules = exact
  ? readFileSync(exact, "utf8")
  : `rules_version = '2';service cloud.firestore { match /databases/{database}/documents {
  function trustedGoogle() { return request.auth != null && request.auth.token.email == 'owner@example.test' && request.auth.token.email_verified == true && request.auth.token.firebase.sign_in_provider == 'google.com'; }
  ${readFileSync("firestore.preview.fragment.rules", "utf8")}
}}`;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-ysu-planner-merged",
    firestore: { host: "127.0.0.1", port: 8080, rules },
  });
});
afterAll(async () => env?.cleanup());
it("preview requires the trusted verified Google owner, correct UID, revisions; production and sibling paths stay denied", async () => {
  const claims = {
    email: ownerEmail,
    email_verified: true,
    firebase: { sign_in_provider: "google.com" },
  };
  const owner = env.authenticatedContext("owner", claims).firestore();
  const other = env
    .authenticatedContext("other", { ...claims, email: "other@example.test" })
    .firestore();
  const anon = env.unauthenticatedContext().firestore();
  const unverified = env
    .authenticatedContext("owner", { ...claims, email_verified: false })
    .firestore();
  const password = env
    .authenticatedContext("owner", {
      ...claims,
      firebase: { sign_in_provider: "password" },
    })
    .firestore();
  const t = { ...blankTrip("owner"), revision: 1 },
    path = `travelPlanner/preview-v1/users/owner/records/${t.id}`;
  await assertSucceeds(setDoc(doc(owner, path), t));
  await assertSucceeds(getDoc(doc(owner, path)));
  for (const db of [anon, other, unverified, password]) {
    await assertFails(getDoc(doc(db, path)));
    await assertFails(setDoc(doc(db, path), { ...t, revision: 2 }));
  }
  await assertFails(
    setDoc(doc(other, `travelPlanner/preview-v1/users/other/records/${t.id}`), {
      ...t,
      ownerId: "other",
    }),
  );
  await assertFails(setDoc(doc(owner, path), { ...t, revision: 1 }));
  await assertFails(
    setDoc(doc(owner, path), { ...t, ownerId: "other", revision: 2 }),
  );
  // The standalone fragment has no v1 match. A merged live rule set does;
  // its existing production behavior is covered by production-rules.test.ts.
  if (!exact) await assertFails(
    setDoc(doc(owner, `travelPlanner/v1/users/owner/records/${t.id}`), t),
  );
  await assertFails(setDoc(doc(owner, "unowned/test"), t));
  await assertFails(
    setDoc(doc(owner, path), { ...t, deleted: true, revision: 2 }),
  );
});
it("preview guards Trip/Item dependencies and reserves paid calls within its own namespace", async () => {
  const claims = { email: ownerEmail, email_verified: true, firebase: { sign_in_provider: "google.com" } };
  const owner = env.authenticatedContext("owner", claims).firestore();
  const other = env.authenticatedContext("other", { ...claims, email: "other@example.test" }).firestore();
  const trip = { ...blankTrip("owner"), start: "2030-01-01", end: "2030-01-03", revision: 1 };
  const item = { ...blankItem("owner", trip, crypto.randomUUID(), "2030-01-03"), revision: 1 };
  const tripRef = doc(owner, `travelPlanner/preview-v1/users/owner/records/${trip.id}`);
  const itemRef = doc(owner, `travelPlanner/preview-v1/users/owner/records/${item.id}`);
  await assertFails(setDoc(itemRef, item));
  const create = writeBatch(owner); create.set(tripRef, trip); create.set(itemRef, item);
  await assertSucceeds(create.commit());
  await assertFails(setDoc(itemRef, { ...item, day: "2030-01-02", revision: 2 }));
  await assertFails(setDoc(tripRef, { ...trip, end: "2030-01-02", revision: 2 }));
  await assertSucceeds(setDoc(tripRef, { ...trip, end: "2030-01-02", detachedItemIds: [item.id], revision: 2 }));
  const illegal = writeBatch(owner);
  illegal.set(tripRef, { ...trip, end: "2030-01-02", detachedItemIds: [], revision: 3 });
  illegal.set(itemRef, { ...item, day: "2030-01-03", revision: 2 });
  await assertFails(illegal.commit());
  const move = writeBatch(owner);
  move.set(tripRef, { ...trip, end: "2030-01-02", detachedItemIds: [], revision: 3 });
  move.set(itemRef, { ...item, day: "2030-01-02", revision: 2 });
  await assertSucceeds(move.commit());
  const undo = writeBatch(owner);
  undo.set(tripRef, { ...trip, end: "2030-01-02", detachedItemIds: [], revision: 4 });
  undo.set(itemRef, { ...item, day: null, status: "candidate", revision: 3,
    candidateOrigin: { day: "2030-01-03", order: item.order, status: "planned", reason: "trip-range" } });
  await assertSucceeds(undo.commit());
  const invalidUndo = writeBatch(owner);
  invalidUndo.set(tripRef, { ...trip, end: "2030-01-02", detachedItemIds: [item.id], revision: 5 });
  invalidUndo.set(itemRef, { ...item, day: "2030-01-03", revision: 4 });
  await assertFails(invalidUndo.commit());
  const usagePath = "travelPlanner/preview-v1/users/owner/aiUsage/2030-01-01";
  const usage = { ownerId: "owner", day: "2030-01-01", assistCount: 1, exploreCount: 0, visionCount: 0, backgroundCount: 0 };
  await assertFails(setDoc(doc(other, usagePath), usage));
  await assertSucceeds(setDoc(doc(owner, usagePath), usage));
  await assertFails(setDoc(doc(owner, usagePath), { ...usage, assistCount: 0 }));
  await assertSucceeds(setDoc(doc(owner, usagePath), { ...usage, assistCount: 2 }));
  const requestId = crypto.randomUUID();
  const requestPath = `travelPlanner/preview-v1/users/owner/aiRequests/${requestId}`;
  const receipt = { ownerId: "owner", requestId, mode: "assist" };
  await assertFails(setDoc(doc(other, requestPath), receipt));
  await assertSucceeds(setDoc(doc(owner, requestPath), receipt));
  await assertFails(setDoc(doc(owner, requestPath), { ...receipt, mode: "vision" }));
  await assertFails(deleteDoc(doc(owner, requestPath)));
  await assertFails(setDoc(doc(owner, `travelPlanner/preview-v1/users/owner/aiRequests/${crypto.randomUUID()}`),
    { ...receipt, mode: "explore" }));
});
