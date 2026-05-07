import { useEffect, useRef, useState, useCallback } from "react";
import { MessageCircle, X, Send, Trash2 } from "lucide-react";
import {
  endVisitorChat,
  ensureChannel,
  fetchVisitorMessages,
  sendVisitorMessage,
} from "@/server/chat.functions";

type Msg = {
  id: string;
  sender: "visitor" | "admin" | "system";
  sender_name: string | null;
  body: string;
  created_at: string;
};

const TOKEN_KEY = "peptivalab.chat.visitor.v1";
const NAME_KEY = "peptivalab.chat.name.v1";

function getOrCreateToken(): string {
  if (typeof window === "undefined") return "";
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) {
    t = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)) + Date.now().toString(36);
    localStorage.setItem(TOKEN_KEY, t);
  }
  return t;
}

export function IrcChat() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState<string>(
    () => (typeof window !== "undefined" && localStorage.getItem(NAME_KEY)) || "",
  );
  const [needsName, setNeedsName] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [ircChannel, setIrcChannel] = useState<string>("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string>("");
  const lastTsRef = useRef<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const initedRef = useRef(false);

  // Token only needed once on mount in browser
  useEffect(() => {
    tokenRef.current = getOrCreateToken();
  }, []);

  const refresh = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const res = await fetchVisitorMessages({
        data: { visitorToken: tokenRef.current, sinceIso: lastTsRef.current },
      });
      if (res.channel) setIrcChannel(res.channel.ircChannel);
      if (res.messages.length > 0) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const merged = [...prev];
          for (const m of res.messages as Msg[]) {
            if (!seen.has(m.id)) merged.push(m);
          }
          const last = merged[merged.length - 1];
          if (last) lastTsRef.current = last.created_at;
          return merged;
        });
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Initialize channel on first open
  useEffect(() => {
    if (!open || initedRef.current) return;
    initedRef.current = true;
    if (!name) {
      setNeedsName(true);
      return;
    }
    void (async () => {
      try {
        const res = await ensureChannel({
          data: { visitorToken: tokenRef.current, displayName: name },
        });
        setIrcChannel(res.ircChannel);
        await refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [open, name, refresh]);

  // Polling while open
  useEffect(() => {
    if (!open || needsName) return;
    const id = setInterval(refresh, 4000);
    return () => clearInterval(id);
  }, [open, needsName, refresh]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const submitName = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    localStorage.setItem(NAME_KEY, trimmed);
    setNeedsName(false);
    initedRef.current = false; // re-trigger init
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await sendVisitorMessage({
        data: { visitorToken: tokenRef.current, body: text },
      });
      setMessages((prev) => [...prev, res.message as Msg]);
      lastTsRef.current = (res.message as Msg).created_at;
      setInput("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const endChat = async () => {
    if (!confirm("Avsluta chatten? All chatthistorik raderas permanent.")) return;
    try {
      if (tokenRef.current) {
        await endVisitorChat({ data: { visitorToken: tokenRef.current } });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      // Reset local state and generate a fresh token next time
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {
        /* ignore */
      }
      tokenRef.current = "";
      lastTsRef.current = undefined;
      setMessages([]);
      setIrcChannel("");
      setInput("");
      setOpen(false);
      initedRef.current = false;
    }
  };

  return (
    <>
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
          <div className="flex items-center justify-between gap-2 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Kundchatt</span>
              <span className="text-[11px] opacity-80">{ircChannel || "ansluter…"}</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Stäng chatt"
              className="rounded p-1 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {needsName ? (
            <form onSubmit={submitName} className="flex flex-1 flex-col justify-center gap-3 bg-background p-6">
              <p className="text-sm text-muted-foreground">
                Vad ska vi kalla dig? Vi skapar en privat chattkanal åt dig.
              </p>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ditt namn"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={!name.trim()}
                className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Starta chatt
              </button>
            </form>
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
                      m.sender === "system"
                        ? "text-center text-[11px] italic text-muted-foreground"
                        : m.sender === "visitor"
                          ? "ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                          : "mr-auto max-w-[80%] rounded-2xl rounded-bl-sm bg-muted px-3 py-1.5 text-sm text-foreground"
                    }
                  >
                    {m.sender === "admin" && (
                      <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                        {m.sender_name || "support"}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  </div>
                ))}
                {error && (
                  <p className="text-center text-[11px] text-destructive">{error}</p>
                )}
              </div>

              <form
                className="flex items-center gap-2 border-t border-border bg-card p-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendMessage();
                }}
              >
                <input
                  className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Skriv ett meddelande…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button
                  type="submit"
                  className="rounded-md bg-primary p-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  disabled={!input.trim() || sending}
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
