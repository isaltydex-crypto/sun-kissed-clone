// Node HTTP adapter for the TanStack Start Worker bundle.
// The Vite/Cloudflare build emits an ES module that exports
// `default { fetch(request, env, ctx) }`. Under Node nothing
// listens automatically — this wrapper bridges Node's http
// server to the Web Fetch handler.

import { createServer } from "node:http";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";

const candidates = [
  ".output/server/index.mjs",
  ".output/server/index.js",
  "dist/server/server.js",
  "dist/server/index.js",
  "dist/server/index.mjs",
];

const entry = candidates.map((p) => resolve(p)).find((p) => existsSync(p));
if (!entry) {
  console.error("[adapter] no server bundle found, looked for:", candidates);
  process.exit(1);
}
console.log("[adapter] loading", entry);

const staticRoots = [
  ".output/public",
  ".output/client",
  "dist/client",
  "dist/public",
  "public",
]
  .map((p) => resolve(p))
  .filter((p) => existsSync(p));
console.log("[adapter] static roots", staticRoots.length ? staticRoots.join(", ") : "<none>");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function findStaticFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relativePath = normalize(decoded).replace(/^[/\\]+/, "");
  if (!relativePath || relativePath.startsWith("..") || relativePath.includes(`${sep}..${sep}`)) {
    return null;
  }

  for (const root of staticRoots) {
    const filePath = resolve(join(root, relativePath));
    if (filePath !== root && !filePath.startsWith(root + sep)) continue;
    try {
      const stat = statSync(filePath);
      if (stat.isFile()) return { filePath, stat };
    } catch {
      // Try the next static root.
    }
  }
  return null;
}

const mod = await import(pathToFileURL(entry).href);
const handler = mod.default ?? mod;
if (typeof handler?.fetch !== "function") {
  console.error("[adapter] bundle does not export { fetch }; keys =", Object.keys(mod));
  process.exit(1);
}

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

const server = createServer(async (req, res) => {
  try {
    const url = `http://${req.headers.host || `${host}:${port}`}${req.url}`;
    const requestUrl = new URL(url);
    if (req.method && ["GET", "HEAD"].includes(req.method)) {
      const staticFile = findStaticFile(requestUrl.pathname);
      if (staticFile) {
        res.statusCode = 200;
        res.setHeader("Content-Type", mimeTypes[extname(staticFile.filePath).toLowerCase()] || "application/octet-stream");
        res.setHeader("Content-Length", String(staticFile.stat.size));
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        if (req.method === "HEAD") return res.end();
        createReadStream(staticFile.filePath).pipe(res);
        return;
      }
    }
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (v == null) continue;
      if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
      else headers.set(k, String(v));
    }
    const hasBody = req.method && !["GET", "HEAD"].includes(req.method);
    const body = hasBody ? Readable.toWeb(req) : undefined;
    const request = new Request(url, {
      method: req.method,
      headers,
      body,
      // @ts-expect-error duplex required by undici when body is a stream
      duplex: hasBody ? "half" : undefined,
    });
    const response = await handler.fetch(request, process.env, {
      waitUntil() {},
      passThroughOnException() {},
    });
    res.statusCode = response.status;
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const reader = response.body.getReader();
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error("[adapter] handler error", err);
    if (!res.headersSent) res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`[adapter] listening on http://${host}:${port}`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[adapter] ${sig} received, shutting down`);
    server.close(() => process.exit(0));
  });
}
process.on("uncaughtException", (e) => console.error("[adapter] uncaughtException", e));
process.on("unhandledRejection", (e) => console.error("[adapter] unhandledRejection", e));
