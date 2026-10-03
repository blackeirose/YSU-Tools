import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { blankTrip } from "../../src/model";
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
  await assertFails(
    setDoc(doc(owner, `travelPlanner/v1/users/owner/records/${t.id}`), t),
  );
  await assertFails(setDoc(doc(owner, "unowned/test"), t));
  await assertSucceeds(
    setDoc(doc(owner, path), { ...t, deleted: true, revision: 2 }),
  );
});
