import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
  connectFirestoreEmulator,
  collection,
  doc,
  onSnapshot,
  runTransaction,
  getDocFromServer,
  getDocsFromServer,
  query,
  where,
} from "firebase/firestore";
import type { RecordData } from "./model";
import { recordSchema } from "./model";
import { ConflictError, isTripVersionTouch, unguardedItemChange } from "./storage";
import type { Operation, Remote } from "./storage";
import { cloudScope } from "./cloud-config";
const env = import.meta.env;
export const emulator = env.VITE_USE_EMULATORS === "true";
export const namespace = emulator ? "preview-v1" : env.VITE_FIREBASE_NAMESPACE;
export const previewCloud = namespace === "preview-v1";
export const configured =
  emulator ||
  !!(
    env.VITE_FIREBASE_API_KEY &&
    env.VITE_FIREBASE_PROJECT_ID &&
    env.VITE_FIREBASE_AUTH_DOMAIN &&
    env.VITE_FIREBASE_APP_ID &&
    ["preview-v1", "v1"].includes(namespace)
  );
const config = emulator
  ? {
      apiKey: "demo-key",
      authDomain: "demo-ysu-travel-planner.firebaseapp.com",
      projectId: "demo-ysu-travel-planner",
      appId: "demo-app",
    }
  : {
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    };
export const storageScope = configured
  ? cloudScope(config.projectId, namespace)
  : "";
const app = configured
  ? initializeApp(config, `travel-planner-${namespace}`)
  : null;
export const auth = app ? getAuth(app) : null;
const db = app
  ? initializeFirestore(app, { localCache: memoryLocalCache() })
  : null;
if (emulator && auth && db) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}
export const watchAuth = (fn: (id: string | null) => void) =>
  auth ? onAuthStateChanged(auth, (user) => fn(user?.uid ?? null)) : () => {};
export async function login(email?: string, password?: string) {
  if (!auth) throw new Error("Firebase 尚未設定");
  await setPersistence(auth, browserLocalPersistence);
  if (emulator) {
    if (!email || !password) throw new Error("請填 emulator 測試帳號");
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      if (
        (e as { code?: string }).code === "auth/invalid-credential" ||
        (e as { code?: string }).code === "auth/user-not-found"
      )
        await createUserWithEmailAndPassword(auth, email, password);
      else throw e;
    }
  } else await signInWithPopup(auth, new GoogleAuthProvider());
}
export const logout = () => (auth ? signOut(auth) : Promise.resolve());
export function cloudRemote(owner: string): Remote {
  if (!db || !auth) throw new Error("Firebase 尚未設定");
  const records = collection(
    db,
    "travelPlanner",
    namespace,
    "users",
    owner,
    "records",
  );
  const assertOwner = () => {
    if (auth?.currentUser?.uid !== owner) throw new Error("請重新登入");
  };
  const readTripRows = async (tripId: string) => {
    assertOwner();
    const snapshot = await getDocsFromServer(query(records, where("tripId", "==", tripId)));
    return snapshot.docs.map((row) => recordSchema.parse(row.data()));
  };
  return {
    async read(ids) {
      assertOwner();
      const rows = await Promise.all(
        ids.map((id) => getDocFromServer(doc(records, id))),
      );
      return rows
        .filter((r) => r.exists())
        .map((r) => recordSchema.parse(r.data()));
    },
    readTrip: readTripRows,
    watch(next, error) {
      assertOwner();
      return onSnapshot(
        records,
        { includeMetadataChanges: true },
        (snap) => {
          try {
            assertOwner();
            if (snap.metadata.fromCache) return;
            next(snap.docs.map((d) => recordSchema.parse(d.data())));
          } catch (e) {
            error(e as Error);
          }
        },
        error,
      );
    },
    async commit(op: Operation) {
      assertOwner();
      if (op.changes.length > 450) throw new Error("單次批次過大");
      if (unguardedItemChange(op)) throw new ConflictError([], "legacy");
      const shrinkingTrips = op.changes.filter((c) => c.before?.kind === "trip" && c.after.kind === "trip" &&
        (c.before.start !== c.after.start || c.before.end !== c.after.end));
      // The web Transaction API reads document refs only. Fetch candidate IDs
      // from the server first, then re-read every candidate inside the CAS transaction.
      // New clients also touch Trip revision on item edits, closing the add/move race.
      const knownTripRows = (await Promise.all(shrinkingTrips.map((c) => readTripRows(c.id)))).flat();
      await runTransaction(db!, async (tx) => {
        assertOwner();
        const refs = op.changes.map((c) => doc(records, c.id));
        const changeIds = new Set(op.changes.map((c) => c.id));
        const extraRefs = [...new Set(knownTripRows.filter((r) => r.kind === "item" && !changeIds.has(r.id)).map((r) => r.id))]
          .map((id) => doc(records, id));
        const [snapshots, extraSnapshots] = await Promise.all([
          Promise.all(refs.map((r) => tx.get(r))),
          Promise.all(extraRefs.map((r) => tx.get(r))),
        ]);
        const remote = snapshots
          .filter((s) => s.exists())
          .map((s) => recordSchema.parse(s.data()) as RecordData);
        // Idempotent ack after reconnect: exact revisions and full payload must agree.
        const canonical = (value: unknown): string =>
          JSON.stringify(value, Object.keys(value as object).sort());
        if (
          op.changes.every(
            (c, i) =>
              snapshots[i].exists() &&
              canonical(snapshots[i].data()) === canonical(c.after),
          )
        )
          return;
        if (
          op.changes.some(
            (c, i) =>
              (snapshots[i].data()?.revision ?? 0) !==
              (c.before?.revision ?? 0),
          )
        )
          throw new ConflictError(remote);
        for (const changedTrip of shrinkingTrips) {
          const trip = changedTrip.after;
          if (trip.kind !== "trip") continue;
          const all = [...snapshots, ...extraSnapshots]
            .filter((snapshot) => snapshot.exists())
            .map((snapshot) => recordSchema.parse(snapshot.data()));
          const byId = new Map(all.map((r) => [r.id, r]));
          for (const change of op.changes) byId.set(change.id, change.after);
          if ([...byId.values()].some((row) => row.kind === "item" && !row.deleted && row.tripId === trip.id && row.day &&
            (row.day < trip.start || row.day > trip.end)))
            throw new ConflictError(all, "range");
        }
        for (const change of op.changes) {
          const after = change.after;
          if (after.kind !== "item" || after.deleted || !after.day ||
            (change.before?.kind === "item" && change.before.day === after.day)) continue;
          const trip = op.changes.find((c) => c.id === after.tripId)?.after;
          if (!trip || trip.kind !== "trip" || trip.deleted || after.day < trip.start || after.day > trip.end)
            throw new ConflictError(remote);
        }
        for (let i = 0; i < op.changes.length; i++) {
          const change = op.changes[i];
          const after = change.after;
          if (after.ownerId !== owner) throw new Error("帳號不符");
          if (isTripVersionTouch(change))
            tx.update(refs[i], { revision: after.revision, updatedAt: after.updatedAt });
          else tx.set(refs[i], after);
        }
      });
    },
  };
}
