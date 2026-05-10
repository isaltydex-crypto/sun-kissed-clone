// Node HTTP adapter for the TanStack Start Worker bundle.
// The Vite/Cloudflare build emits an ES module that exports
// `default { fetch(request, env, ctx) }`. Under Node nothing
// listens automatically — this wrapper bridges Node's http
// server to the Web Fetch handler.

import { createServer } from "node:http";
import { Readable } from "node:stream";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

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
