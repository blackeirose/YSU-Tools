import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
if (
  process.env.GCLOUD_PROJECT !== "demo-ysu-travel-planner" ||
  process.env.VITE_USE_EMULATORS !== "true"
)
  throw new Error(
    "Only the explicitly configured demo emulator project is allowed",
  );
const run = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${args[0]} exited ${code}`)),
    );
  });
const evidence = {
  scope: "isolated Firebase Auth/Firestore emulators; synthetic data only",
  project: process.env.GCLOUD_PROJECT,
  source: process.env.TESTED_SOURCE_SHA ?? "local",
  checks: [],
  started: new Date().toISOString(),
};
let server;
try {
  await run([
    "node_modules/vitest/vitest.mjs",
    "run",
    "--config",
    "vitest.emulator.config.ts",
  ]);
  evidence.checks.push("rules PASS");
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "4174",
      "--strictPort",
    ],
    { stdio: "inherit" },
  );
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      ready = (await fetch("http://127.0.0.1:4174/travel-planner/")).ok;
    } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error("Preview failed to start");
  await run([
    "node_modules/@playwright/test/cli.js",
    "test",
    "--config",
    "playwright.cloud.config.ts",
  ]);
  evidence.checks.push("independent browser contexts PASS");
  evidence.status = "PASS";
} catch (error) {
  evidence.status = "FAIL";
  evidence.error = error.message;
  process.exitCode = 1;
} finally {
  server?.kill();
  evidence.finished = new Date().toISOString();
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(
    "artifacts/emulator-acceptance.json",
    JSON.stringify(evidence, null, 2),
  );
}
