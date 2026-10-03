// Produce three exact Planner-only Netlify bundles; never deploy this directory alone.
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire, builtinModules } from "node:module";
import { zipFunctions } from "@netlify/zip-it-and-ship-it";

// zip-it-and-ship-it can leave bare imports in a pnpm layout while archiving
// only .pnpm/store paths. Bundle packages first so a deployed ZIP has no
// dependency on symlinks that ZIP cannot preserve.
const requireFromPackager = createRequire(import.meta.resolve("@netlify/zip-it-and-ship-it"));
const { build } = requireFromPackager("esbuild");

const check = process.argv.includes("--check");
const sourceCommit = check ? "CHECK-ONLY" : execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const dirty = check ? true : !!execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim();
if (dirty && !check) throw new Error("Commit source before release function bundling");
const output = "artifacts/planner-functions";
await mkdir(output, { recursive: true });
const entrypoints = `${output}/entrypoints`;
const bundled = await build({
  entryPoints: ["netlify/functions/travel-ai.mts", "netlify/functions/travel-background.mts",
    "netlify/functions/travel-background-read.mts"],
  outdir: entrypoints, outExtension: { ".js": ".mjs" },
  bundle: true, packages: "bundle", platform: "node", format: "esm", target: "node22",
  metafile: true, logLevel: "warning",
});
const builtins = new Set(builtinModules.map((name) => name.replace(/^node:/, "")));
for (const output of Object.values(bundled.metafile.outputs))
  for (const dependency of output.imports ?? [])
    if (dependency.external && !builtins.has(dependency.path.replace(/^node:/, "")))
      throw new Error(`Unbundled Function dependency: ${dependency.path}`);
const result = await zipFunctions(entrypoints, output, { basePath: process.cwd(),
  config: { "*": { nodeBundler: "esbuild", nodeVersion: "22" } } });
const contract = {
  "travel-ai": { invocationMode: "stream", path: "/travel-planner/api/ai" },
  "travel-background": { invocationMode: "background", path: "/travel-planner/api/background/start" },
  "travel-background-read": { invocationMode: "stream", path: "/travel-planner/api/background/status" },
};
if (result.length !== 3 || result.some((entry) => !(entry.name in contract) || entry.runtimeAPIVersion !== 2))
  throw new Error("Unexpected Planner function inventory");
const functions = [];
for (const entry of result) {
  const expected = contract[entry.name];
  if (entry.invocationMode !== expected.invocationMode || entry.schedule ||
    entry.routes?.length !== 1 || entry.routes[0]?.pattern !== expected.path ||
    entry.routes[0]?.literal !== expected.path || entry.routes[0]?.expression ||
    entry.routes[0]?.methods?.length || entry.routes[0]?.preferStatic)
    throw new Error(`Unreviewed function route or mode: ${entry.name}`);
  const path = entry.path;
  const sha256 = createHash("sha256").update(await readFile(path)).digest("hex");
  functions.push({ name: entry.name, path, sha256,
    invocationMode: entry.invocationMode, runtimeAPIVersion: entry.runtimeAPIVersion,
    routes: entry.routes, bootstrapVersion: entry.bootstrapVersion });
}
await writeFile(`${output}/manifest.json`, JSON.stringify({ schema: 1,
  sourceCommit: dirty ? `uncommitted:${sourceCommit}` : sourceCommit,
  functions: functions.sort((a, b) => a.name.localeCompare(b.name)) }, null, 2));
console.log(JSON.stringify(functions.map(({ name, sha256, invocationMode }) => ({ name, sha256, invocationMode }))));
