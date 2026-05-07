// IRC bridge.
//
// Single persistent WebSocket to the self-hosted ws-gateway in irc-server/.
// Protocol on that socket:
//   1. We send       "AUTH <IRC_BOT_PASSWORD>"
//   2. Gateway opens TCP IRC, sends PASS <server-pwd>, replies "READY"
//   3. We send NICK / USER and then JOIN/PRIVMSG as raw IRC lines.
// Inbound IRC lines come back unchanged; PRIVMSGs from human operators are
// parsed and inserted into chat_messages so the visitor sees them live.
//
// Env vars:
//   IRC_GATEWAY_URL    e.g. wss://chat.yourdomain.com
//   IRC_SERVER         e.g. chat.yourdomain.com   (informational)
//   IRC_BOT_NICK       e.g. pvl-bot
//   IRC_BOT_PASSWORD   shared GATEWAY_TOKEN from irc-server/.env
//   IRC_CHANNEL_PREFIX e.g. #pvl-

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type IrcConfig = {
  gatewayUrl: string;
  server: string;
  botNick: string;
  botPassword?: string;
  channelPrefix: string;
};

export function getIrcConfig(): IrcConfig | null {
  const gatewayUrl = process.env.IRC_GATEWAY_URL;
  const server = process.env.IRC_SERVER;
  if (!gatewayUrl || !server) return null;
  return {
    gatewayUrl,
    server,
    botNick: process.env.IRC_BOT_NICK || "pvl-bot",
    botPassword: process.env.IRC_BOT_PASSWORD,
    channelPrefix: process.env.IRC_CHANNEL_PREFIX || "#pvl-",
  };
}

export function ircChannelName(slug: string): string {
  const cfg = getIrcConfig();
  const prefix = cfg?.channelPrefix || "#pvl-";
  return `${prefix}${slug}`.toLowerCase().replace(/[^a-z0-9#-]/g, "");
}


// ---------------------------------------------------------------------------
// WebSocket connection manager with automatic reconnection
// ---------------------------------------------------------------------------

type ConnState = "idle" | "connecting" | "open" | "closed";

const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
const PING_INTERVAL_MS = 30_000;

type Manager = {
  ws: WebSocket | null;
  state: ConnState;
  attempts: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  pingTimer: ReturnType<typeof setInterval> | null;
  joined: Set<string>;
  outbox: string[];
};

let manager: Manager | null = null;

function getManager(): Manager {
  if (!manager) {
    manager = {
      ws: null,
      state: "idle",
      attempts: 0,
      reconnectTimer: null,
      pingTimer: null,
      joined: new Set(),
      outbox: [],
    };
  }
  return manager;
}

function backoffDelay(attempt: number): number {
  const exp = Math.min(RECONNECT_MAX_MS, RECONNECT_MIN_MS * 2 ** attempt);
  // jitter so reconnect storms spread out
  return Math.floor(exp * (0.5 + Math.random() * 0.5));
}

function scheduleReconnect(cfg: IrcConfig) {
  const m = getManager();
  if (m.reconnectTimer) return;
  const delay = backoffDelay(m.attempts);
  console.log(`[irc-bridge] reconnect in ${delay}ms (attempt ${m.attempts + 1})`);
  m.reconnectTimer = setTimeout(() => {
    m.reconnectTimer = null;
    m.attempts += 1;
    void connect(cfg);
  }, delay);
}

function send(line: string) {
  const m = getManager();
  if (m.ws && m.state === "open") {
    try {
      m.ws.send(line);
      return;
    } catch (err) {
      console.warn("[irc-bridge] send failed, queueing:", err);
    }
  }
  m.outbox.push(line);
}

function flushOutbox() {
  const m = getManager();
  if (!m.ws || m.state !== "open") return;
  const pending = m.outbox.splice(0, m.outbox.length);
  for (const line of pending) {
    try {
      m.ws.send(line);
    } catch (err) {
      console.warn("[irc-bridge] flush failed, requeueing:", err);
      m.outbox.unshift(line);
      break;
    }
  }
}

async function connect(cfg: IrcConfig): Promise<void> {
  const m = getManager();
  if (m.state === "connecting" || m.state === "open") return;
  m.state = "connecting";

  let ws: WebSocket;
  try {
    ws = new WebSocket(cfg.gatewayUrl);
  } catch (err) {
    console.error("[irc-bridge] failed to construct WebSocket:", err);
    m.state = "closed";
    scheduleReconnect(cfg);
    return;
  }
  m.ws = ws;

  ws.addEventListener("open", () => {
    console.log(`[irc-bridge] connected to ${cfg.gatewayUrl}`);
    m.state = "open";
    m.attempts = 0;

    // 1) Auth to the ws-gateway. It opens the upstream IRC TCP after this.
    if (cfg.botPassword) send(`AUTH ${cfg.botPassword}`);

    // 2) Standard IRC registration. PASS was already sent by the gateway.
    send(`NICK ${cfg.botNick}`);
    send(`USER ${cfg.botNick} 0 * :peptivaLab support bot`);

    // Re-join every channel we had before the disconnect.
    for (const ch of m.joined) send(`JOIN ${ch}`);
    flushOutbox();

    if (m.pingTimer) clearInterval(m.pingTimer);
    m.pingTimer = setInterval(() => {
      if (m.state === "open") send(`PING :${Date.now()}`);
    }, PING_INTERVAL_MS);
  });

  ws.addEventListener("message", (ev: MessageEvent) => {
    if (typeof ev.data !== "string") return;
    for (const line of ev.data.split(/\r?\n/)) {
      if (!line) continue;
      if (line.startsWith("PING ")) {
        send(`PONG ${line.slice(5)}`);
        continue;
      }
      void handleInbound(line, cfg);
    }
  });

  ws.addEventListener("error", (ev: Event) => {
    console.warn("[irc-bridge] socket error:", (ev as ErrorEvent)?.message ?? ev);
  });

  ws.addEventListener("close", (ev: CloseEvent) => {
    console.log(`[irc-bridge] socket closed (code=${ev.code} reason=${ev.reason || "n/a"})`);
    m.state = "closed";
    m.ws = null;
    if (m.pingTimer) {
      clearInterval(m.pingTimer);
      m.pingTimer = null;
    }
    scheduleReconnect(cfg);
  });
}

function ensureConnected(): boolean {
  const cfg = getIrcConfig();
  if (!cfg) return false;
  const m = getManager();
  if (m.state === "idle" || m.state === "closed") {
    void connect(cfg);
  }
  return true;
}

/**
 * Called once when a new visitor channel is created.
 * Joins the channel on the gateway (queued if currently disconnected).
 */
export async function provisionChannel(slug: string, displayName: string): Promise<void> {
  const cfg = getIrcConfig();
  const channel = ircChannelName(slug);
  if (!cfg) {
    console.log(`[irc-bridge] (no gateway configured) would provision ${channel} for ${displayName}`);
    return;
  }
  ensureConnected();
  const m = getManager();
  m.joined.add(channel);
  send(`JOIN ${channel}`);
  console.log(`[irc-bridge] provision ${channel} on ${cfg.server} for ${displayName}`);
}

/**
 * Called for every chat message (visitor + admin).
 * Returns true when handed off to the gateway socket (or queued for the next
 * successful reconnect). Returns false only when no gateway is configured.
 */
export async function forwardToIrc(args: {
  slug: string;
  sender: "visitor" | "admin" | "system";
  senderName: string | null;
  body: string;
}): Promise<boolean> {
  const cfg = getIrcConfig();
  if (!cfg) return false;
  ensureConnected();
  const channel = ircChannelName(args.slug);
  const prefix = args.senderName ? `<${args.senderName}> ` : "";
  // PRIVMSG cannot contain newlines — split into multiple lines.
  for (const line of args.body.split(/\r?\n/)) {
    if (!line) continue;
    send(`PRIVMSG ${channel} :${prefix}${line}`);
  }
  return true;
}
