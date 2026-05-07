// peptivaLab WebSocket ↔ TCP-IRC gateway.
//
// One TCP IRC connection per WebSocket client.
// Auth: first WebSocket frame MUST equal `AUTH <GATEWAY_TOKEN>`.
// After that, every frame is a raw IRC line and is forwarded to the
// IRC daemon verbatim (with PASS/NICK/USER prepended on connect).
//
// Inbound IRC lines from the daemon are forwarded back to the WebSocket
// client unchanged so the bridge can parse them with normal IRC tools.

import net from "node:net";
import { WebSocketServer } from "ws";

const IRC_HOST = process.env.IRC_HOST || "127.0.0.1";
const IRC_PORT = Number(process.env.IRC_PORT || 6667);
const IRC_SERVER_PASSWORD = process.env.IRC_SERVER_PASSWORD || "";
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || "";
const LISTEN_PORT = Number(process.env.LISTEN_PORT || 8080);

if (!GATEWAY_TOKEN) {
  console.error("[gateway] GATEWAY_TOKEN is required");
  process.exit(1);
}

const wss = new WebSocketServer({ port: LISTEN_PORT, path: "/" });
console.log(`[gateway] listening on :${LISTEN_PORT}, forwarding to ${IRC_HOST}:${IRC_PORT}`);

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[gateway] ws connected from ${ip}`);

  let authed = false;
  let irc = null;
  let buffer = "";

  const closeAll = (reason) => {
    try { ws.close(1000, reason); } catch {}
    try { irc?.destroy(); } catch {}
  };

  ws.on("message", (raw) => {
    const text = raw.toString("utf8");

    if (!authed) {
      const m = text.trim().match(/^AUTH\s+(.+)$/);
      if (!m || m[1] !== GATEWAY_TOKEN) {
        console.warn(`[gateway] auth failed from ${ip}`);
        closeAll("unauthorized");
        return;
      }
      authed = true;

      // Open the upstream IRC TCP connection.
      irc = net.createConnection({ host: IRC_HOST, port: IRC_PORT }, () => {
        console.log(`[gateway] connected to IRC ${IRC_HOST}:${IRC_PORT}`);
        if (IRC_SERVER_PASSWORD) irc.write(`PASS ${IRC_SERVER_PASSWORD}\r\n`);
        // The bridge is expected to send NICK/USER itself in subsequent frames.
        try { ws.send("READY"); } catch {}
      });

      irc.setEncoding("utf8");
      irc.on("data", (chunk) => {
        buffer += chunk;
        let nl;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).replace(/\r$/, "");
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          // Auto-PONG so the upstream session never times out.
          if (line.startsWith("PING ")) {
            irc.write(`PONG ${line.slice(5)}\r\n`);
          }
          if (ws.readyState === ws.OPEN) ws.send(line);
        }
      });

      irc.on("close", () => {
        console.log("[gateway] IRC closed");
        closeAll("irc-closed");
      });
      irc.on("error", (err) => {
        console.warn("[gateway] IRC error:", err.message);
        closeAll("irc-error");
      });
      return;
    }

    if (!irc || irc.destroyed) return;
    // Forward raw IRC line(s). Always terminate with CRLF.
    for (const line of text.split(/\r?\n/)) {
      if (!line) continue;
      irc.write(`${line}\r\n`);
    }
  });

  ws.on("close", () => {
    console.log(`[gateway] ws closed (${ip})`);
    try { irc?.destroy(); } catch {}
  });
  ws.on("error", (err) => {
    console.warn(`[gateway] ws error (${ip}):`, err.message);
    try { irc?.destroy(); } catch {}
  });
});
