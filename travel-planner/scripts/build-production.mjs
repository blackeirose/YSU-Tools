// Build the source-matched, owner-only v1 component. No hosting API is called.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadEnv } from "vite";

const env = { ...loadEnv("production", process.cwd(), ""), ...process.env };
const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
if (git(["status", "--porcelain"]))
  throw new Error("Commit and review source before a production build");
const sourceCommit = git(["rev-parse", "HEAD"]);
if (env.VITE_USE_EMULATORS === "true" || env.VITE_FIREBASE_NAMESPACE !== "v1")
  throw new Error("Production requires the dedicated v1 Firebase namespace");
for (const key of ["API_KEY", "AUTH_DOMAIN", "PROJECT_ID", "APP_ID"])
  if (!env["VITE_FIREBASE_" + key])
    throw new Error("Missing Firebase setting: " + key);
if (env.VITE_AI_ENDPOINT !== "/travel-planner/api/ai")
  throw new Error("Production requires the exact reviewed Planner-only AI route");
for (const args of [
  ["node_modules/typescript/bin/tsc", "-b"],
  ["node_modules/vite/bin/vite.js", "build"],
])
  execFileSync(process.execPath, args, { stdio: "inherit", env });
writeFileSync("dist/version.json", JSON.stringify({
  schema: 1,
  sourceCommit,
  base: "/travel-planner/",
  mode: "production",
  namespace: "v1",
  syntheticOnly: false,
  aiEnabled: true,
  lockHash: createHash("sha256").update(readFileSync("pnpm-lock.yaml")).digest("hex"),
}, null, 2));
execFileSync(process.execPath, ["scripts/build-sw.mjs"], { stdio: "inherit", env });
