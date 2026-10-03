import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { blankTrip } from "../../src/model";
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-ysu-travel-planner",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
afterAll(async () => env?.cleanup());
describe("owner rules — real Firestore emulator required", () => {
  it("owner revisions pass; anonymous, other user, Trip tombstones and physical deletes fail", async () => {
    const t = { ...blankTrip("alice"), revision: 1 };
    const path = `travelPlanner/preview-v1/users/alice/records/${t.id}`;
    const alice = env.authenticatedContext("alice").firestore();
    const bob = env.authenticatedContext("bob").firestore();
    const anon = env.unauthenticatedContext().firestore();
    await assertSucceeds(setDoc(doc(alice, path), t));
    await assertSucceeds(getDoc(doc(alice, path)));
    await assertFails(getDoc(doc(bob, path)));
    await assertFails(getDoc(doc(anon, path)));
    await assertFails(setDoc(doc(bob, path), { ...t, revision: 2 }));
    await assertFails(
      setDoc(doc(alice, path), { ...t, ownerId: "bob", revision: 2 }),
    );
    await assertFails(setDoc(doc(alice, path), { ...t, revision: 1 }));
    // A Trip tombstone can strand child records. The range-safe policy keeps
    // the Trip available for recovery; archive is the supported hide action.
    await assertFails(
      setDoc(doc(alice, path), { ...t, deleted: true, revision: 2 }),
    );
    await assertFails(deleteDoc(doc(alice, path)));
  });
});
