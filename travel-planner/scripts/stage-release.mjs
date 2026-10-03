// Component-only assembly. This script has no deployment/network operations.
import {
  readdir,
  readFile,
  mkdir,
  writeFile,
  copyFile,
} from "node:fs/promises";
import { createHash } from "node:crypto";
const source = new URL("../dist/", import.meta.url);
const files = (await readdir(source, { recursive: true }))
  .filter((f) => /\.(html|js|css|png|webmanifest)$/.test(f))
  .sort();
if (!files.includes("index.html") || !files.includes("sw.js"))
  throw new Error("Run pnpm build first.");
const hashes = {};
for (const file of files)
  hashes["/travel-planner/" + file.replaceAll("\\", "/")] = createHash("sha256")
    .update(await readFile(new URL(file.replaceAll("\\", "/"), source)))
    .digest("hex");
const id = createHash("sha256")
  .update(JSON.stringify(hashes))
  .digest("hex")
  .slice(0, 16);
const destination = new URL(`../artifacts/component-${id}/`, import.meta.url);
for (const file of files) {
  const target = new URL(
    "travel-planner/" + file.replaceAll("\\", "/"),
    destination,
  );
  await mkdir(new URL("./", target), { recursive: true });
  await copyFile(new URL(file.replaceAll("\\", "/"), source), target);
}
await writeFile(
  new URL("component-manifest.json", destination),
  JSON.stringify(
    {
      schemaVersion: 1,
      component: "travel-planner",
      prefix: "/travel-planner/",
      productionAuthorized: false,
      authority:
        "blackeirose/social-capture-tool:scripts/shared_host_release.py",
      hashes,
    },
    null,
    2,
  ),
);
console.log(
  `Component staged at ${destination.pathname}. Never deploy this folder alone over the shared host.`,
);
