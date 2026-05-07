import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, X, Send, Settings as SettingsIcon } from "lucide-react";

type ChatMessage = {
  id: string;
  from: string;
  text: string;
  ts: number;
  system?: boolean;
};

type IrcConfig = {
  gatewayUrl: string; // e.g. wss://your-gateway.example/webirc
  channel: string; // e.g. #peptivalab-support
  nickPrefix: string; // e.g. kund
};

const STORAGE_KEY = "peptivalab.ircchat.config.v1";

const DEFAULT_CONFIG: IrcConfig = {
  gatewayUrl: "",
  channel: "#peptivalab-support",
  nickPrefix: "kund",
};

function loadConfig(): IrcConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(cfg: IrcConfig) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

function randomNick(prefix: string) {
  const n = Math.floor(Math.random() * 9000) + 1000;
  const safe = (prefix || "kund").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 10) || "kund";
  return `${safe}${n}`;
}

// Minimal IRC line parser: ":prefix CMD args :trailing"
function parseIrcLine(line: string) {
  let rest = line;
  let prefix = "";
  if (rest.startsWith(":")) {
    const sp = rest.indexOf(" ");
    prefix = rest.slice(1, sp);
    rest = rest.slice(sp + 1);
  }
  let trailing = "";
  const tIdx = rest.indexOf(" :");
  if (tIdx >= 0) {
    trailing = rest.slice(tIdx + 2);
    rest = rest.slice(0, tIdx);
  }
  const parts = rest.split(" ").filter(Boolean);
  const command = parts.shift() || "";
  if (trailing) parts.push(trailing);
  const nickFromPrefix = prefix.split("!")[0] || "";
  return { prefix, nick: nickFromPrefix, command, params: parts };
}

export function IrcChat() {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<IrcConfig>(() => loadConfig());
  const [draftConfig, setDraftConfig] = useState<IrcConfig>(config);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error" | "closed">(
    "idle",
  );
  const [input, setInput] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const nickRef = useRef<string>("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const pushMsg = useCallback((m: Omit<ChatMessage, "id" | "ts">) => {
    setMessages((prev) => [
      ...prev.slice(-199),
      { ...m, id: Math.random().toString(36).slice(2), ts: Date.now() },
    ]);
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    setStatus("closed");
  }, []);

  const connect = useCallback(() => {
    if (!config.gatewayUrl || !config.channel) {
      pushMsg({ from: "system", text: "Konfigurera gateway-URL och kanal i inställningar.", system: true });
      setShowSettings(true);
      return;
    }
    if (wsRef.current) return;

    setStatus("connecting");
    pushMsg({ from: "system", text: `Ansluter till ${config.gatewayUrl}…`, system: true });

    let ws: WebSocket;
    try {
      ws = new WebSocket(config.gatewayUrl);
    } catch (e) {
      setStatus("error");
      pushMsg({ from: "system", text: `Kunde inte öppna anslutning: ${(e as Error).message}`, system: true });
      return;
    }
    wsRef.current = ws;

    const nick = randomNick(config.nickPrefix);
    nickRef.current = nick;

    const send = (line: string) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(line + "\r\n");
    };

    ws.onopen = () => {
      setStatus("connected");
      pushMsg({ from: "system", text: `Ansluten som ${nick}`, system: true });
      send(`NICK ${nick}`);
      send(`USER ${nick} 0 * :Customer`);
      // Many gateways auto-join after registration; we send JOIN once we see 001 (welcome).
    };

    let buffer = "";
    ws.onmessage = (ev) => {
      const data = typeof ev.data === "string" ? ev.data : "";
      if (!data) return;
      buffer += data;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const { command, params, nick: fromNick } = parseIrcLine(line);

        if (command === "PING") {
          send(`PONG :${params[0] ?? ""}`);
          continue;
        }
        if (command === "001") {
          send(`JOIN ${config.channel}`);
          continue;
        }
        if (command === "PRIVMSG") {
          const target = params[0];
          const text = params[1] ?? "";
          if (target === config.channel || target === nickRef.current) {
            pushMsg({ from: fromNick || "?", text });
          }
          continue;
        }
        if (command === "JOIN" && fromNick === nickRef.current) {
          pushMsg({ from: "system", text: `Du gick med i ${config.channel}`, system: true });
          continue;
        }
        if (command === "NOTICE") {
          pushMsg({ from: fromNick || "notice", text: params[1] ?? "", system: true });
          continue;
        }
        if (/^4\d\d|^5\d\d/.test(command)) {
          pushMsg({ from: "server", text: `${command} ${params.join(" ")}`, system: true });
        }
      }
    };

    ws.onerror = () => {
      setStatus("error");
      pushMsg({ from: "system", text: "Anslutningsfel.", system: true });
    };

    ws.onclose = () => {
      setStatus("closed");
      pushMsg({ from: "system", text: "Anslutning stängd.", system: true });
      wsRef.current = null;
    };
  }, [config, pushMsg]);

  // Auto-connect when chat opens (if configured)
  useEffect(() => {
    if (open && status === "idle" && config.gatewayUrl) connect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cleanup on unmount
  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(`PRIVMSG ${config.channel} :${text}\r\n`);
      pushMsg({ from: nickRef.current || "du", text });
      setInput("");
    } else {
      pushMsg({ from: "system", text: "Inte ansluten – försöker återansluta…", system: true });
      setStatus("idle");
      connect();
    }
  };

  const applySettings = () => {
    setConfig(draftConfig);
    saveConfig(draftConfig);
    setShowSettings(false);
    disconnect();
    setStatus("idle");
    setMessages([]);
    // re-connect on next render via effect won't trigger (status now closed). Connect manually:
    setTimeout(() => connect(), 50);
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Öppna kundchatt"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 hover:bg-primary/90"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[480px] w-[340px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Kundchatt</span>
              <span className="text-[11px] opacity-80">
                {status === "connected" ? `online · ${config.channel}` : status}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setDraftConfig(config);
                  setShowSettings((s) => !s);
                }}
                aria-label="Inställningar"
                className="rounded p-1 hover:bg-white/10"
              >
                <SettingsIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Stäng chatt"
                className="rounded p-1 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showSettings ? (
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-background p-4 text-sm">
              <p className="text-xs text-muted-foreground">
                Ange en WebSocket-URL till en IRC-gateway (t.ex. Kiwi IRC's webircgateway konfigurerad
                för raw IRC, ergo, eller InspIRCd m_websocket). URL:en måste börja med <code>wss://</code>.
              </p>
              <label className="block">
                <span className="text-xs font-medium text-foreground">Gateway-URL</span>
                <input
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="wss://gateway.example.com/webirc"
                  value={draftConfig.gatewayUrl}
                  onChange={(e) => setDraftConfig({ ...draftConfig, gatewayUrl: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-foreground">Kanal</span>
                <input
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="#peptivalab-support"
                  value={draftConfig.channel}
                  onChange={(e) => setDraftConfig({ ...draftConfig, channel: e.target.value })}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-foreground">Nick-prefix</span>
                <input
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="kund"
                  value={draftConfig.nickPrefix}
                  onChange={(e) => setDraftConfig({ ...draftConfig, nickPrefix: e.target.value })}
                />
              </label>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={applySettings}
                  className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  Spara & anslut
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="rounded-md border border-input px-3 py-2 text-xs font-medium hover:bg-muted"
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-background p-3">
                {messages.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground">
                    Säg hej så svarar vårt team så snart vi kan.
                  </p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.system
                        ? "text-center text-[11px] italic text-muted-foreground"
                        : m.from === nickRef.current
                          ? "ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                          : "mr-auto max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-3 py-1.5 text-sm text-foreground"
                    }
                  >
                    {!m.system && m.from !== nickRef.current && (
                      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                        {m.from}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  </div>
                ))}
              </div>

              <form
                className="flex items-center gap-2 border-t border-border bg-card p-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
              >
                <input
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={status === "connected" ? "Skriv ett meddelande…" : "Inte ansluten"}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="rounded-md bg-primary p-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  disabled={!input.trim()}
                  aria-label="Skicka"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
