import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const [baselinePath, outputPath] = process.argv.slice(2);
if (!baselinePath || !outputPath || baselinePath === outputPath)
  throw new Error("Usage: merge-firestore-production.mjs CURRENT_LIVE_RULES NEW_CANDIDATE");
const baseline = readFileSync(baselinePath, "utf8");
if (/match\s+\/travelPlanner\/v1\//.test(baseline))
  throw new Error("Planner v1 rules already exist; reconcile instead of duplicating");
if (!baseline.includes("function trustedGoogle()") ||
    !/match\s+\/travelPlanner\/preview-v1\//.test(baseline))
  throw new Error("Reviewed owner and preview scope are missing from live baseline");
const ending = baseline.match(/\r?\n[ \t]+}\r?\n}\s*$/);
if (!ending || ending.index === undefined)
  throw new Error("Unexpected baseline structure; review manually");
const fragment = "\n" + readFileSync(new URL("../firestore.production.fragment.rules", import.meta.url), "utf8");
const candidate = baseline.slice(0, ending.index) + fragment + baseline.slice(ending.index);
if (candidate.slice(0, ending.index) + candidate.slice(ending.index + fragment.length) !== baseline)
  throw new Error("Shared rules changed during the additive merge");
writeFileSync(outputPath, candidate, { flag: "wx" });
const hash = (value) => createHash("sha256").update(value).digest("hex");
console.log(JSON.stringify({
  baselineSha256: hash(baseline), candidateSha256: hash(candidate),
  fragmentSha256: hash(fragment), siblingBytesPreserved: true,
  namespace: "v1", applied: false,
}));
