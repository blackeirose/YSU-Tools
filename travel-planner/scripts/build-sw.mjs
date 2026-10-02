import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
const root = new URL("../dist/", import.meta.url);
function crc(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) {
    c ^= b;
    for (let n = 0; n < 8; n++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
  const b = Buffer.alloc(data.length + 12);
  b.writeUInt32BE(data.length, 0);
  b.write(name, 4);
  data.copy(b, 8);
  b.writeUInt32BE(crc(b.subarray(4, -4)), b.length - 4);
  return b;
}
function icon(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const pattern = [
    "11110011110",
    "10001010001",
    "10001010001",
    "11110011110",
    "10000010000",
    "10000010000",
    "10000010000",
  ];
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const gx = Math.floor((x - size * 0.21) / (size * 0.052)),
        gy = Math.floor((y - size * 0.3) / (size * 0.055));
      const white =
        gy >= 0 && gy < 7 && gx >= 0 && gx < 11 && pattern[gy][gx] === "1";
      const n = y * (size * 4 + 1) + 1 + x * 4;
      raw[n] = white ? 255 : 49;
      raw[n + 1] = white ? 255 : 92;
      raw[n + 2] = white ? 255 : 75;
      raw[n + 3] = 255;
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0);
  head.writeUInt32BE(size, 4);
  head[8] = 8;
  head[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", head),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
for (const size of [180, 192, 512])
  await writeFile(new URL(`icon-${size}.png`, root), icon(size));
await writeFile(
  new URL("manifest.webmanifest", root),
  JSON.stringify(
    {
      id: "/travel-planner/",
      name: "YSU Travel Planner",
      short_name: "Travel Planner",
      lang: "zh-Hant",
      start_url: "/travel-planner/",
      scope: "/travel-planner/",
      display: "standalone",
      background_color: "#F7F6F3",
      theme_color: "#315C4B",
      icons: [192, 512].map((size) => ({
        src: `/travel-planner/icon-${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "any maskable",
      })),
    },
    null,
    2,
  ),
);
const files = await readdir(root, { recursive: true });
const shell = files
  .filter((f) => /\.(js|css|png|webmanifest|html)$/.test(f) && f !== "sw.js")
  .map((f) => "/travel-planner/" + f.replaceAll("\\", "/"));
const fingerprint = createHash("sha256");
for (const path of [...shell].sort()) {
  fingerprint.update(path);
  fingerprint.update(
    await readFile(new URL(path.slice("/travel-planner/".length), root)),
  );
}
const version = fingerprint.digest("hex").slice(0, 16);
await writeFile(
  new URL("sw.js", root),
  `const CACHE='ysu-travel-planner-shell-${version}';const SHELL=${JSON.stringify(shell)};const ALLOWED=new Set(SHELL);self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ysu-travel-planner-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||!u.pathname.startsWith('/travel-planner/'))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>r.ok?r:caches.match('/travel-planner/index.html')).catch(()=>caches.match('/travel-planner/index.html')));return;}if(ALLOWED.has(u.pathname))e.respondWith(caches.open(CACHE).then(c=>c.match(u.pathname)).then(r=>r||fetch(e.request)));});`,
);
console.log(
  `PWA shell: ${shell.length} static resources; scope /travel-planner/; no private API or map tiles cached.`,
);
