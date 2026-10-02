import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const [baselinePath, outputPath] = process.argv.slice(2);
if (!baselinePath || !outputPath || baselinePath === outputPath)
  throw new Error(
    "Usage: merge-firestore-preview.mjs CURRENT_BASELINE NEW_CANDIDATE",
  );
const baseline = readFileSync(baselinePath, "utf8");
if (/match\s+\/travelPlanner\//.test(baseline))
  throw new Error(
    "Planner rules already exist; reconcile instead of duplicating",
  );
if (!baseline.includes("function trustedGoogle()"))
  throw new Error("Reviewed existing owner helper is missing");
const ending = baseline.match(/\r?\n[ \t]+}\r?\n}\s*$/);
if (!ending || ending.index === undefined)
  throw new Error("Unexpected baseline structure; review manually");
const fragment =
  "\n" +
  readFileSync(
    new URL("../firestore.preview.fragment.rules", import.meta.url),
    "utf8",
  );
const candidate =
  baseline.slice(0, ending.index) + fragment + baseline.slice(ending.index);
if (
  candidate.slice(0, ending.index) +
    candidate.slice(ending.index + fragment.length) !==
  baseline
)
  throw new Error("Sibling preservation failed");
writeFileSync(outputPath, candidate, { flag: "wx" });
const hash = (s) => createHash("sha256").update(s).digest("hex");
console.log(
  JSON.stringify({
    baselineSha256: hash(baseline),
    candidateSha256: hash(candidate),
    fragmentSha256: hash(fragment),
    siblingBytesPreserved: true,
    namespace: "preview-v1",
    applied: false,
  }),
);
