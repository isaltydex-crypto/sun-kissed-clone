import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Lock } from "lucide-react";
import {
  adminCloseChannel,
  adminListChannels,
  adminListMessages,
  adminSendMessage,
} from "@/server/chat.functions";

export const Route = createFileRoute("/admin/chatt")({
  head: () => ({
    meta: [
      { title: "Admin — Kundchatt" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminChatPage,
});

type Channel = {
  id: string;
  visitor_token: string;
  display_name: string | null;
  irc_channel_slug: string;
  status: string;
  last_message_at: string;
  created_at: string;
};

type Msg = {
  id: string;
  sender: "visitor" | "admin" | "system";
  sender_name: string | null;
  body: string;
  created_at: string;
  irc_synced: boolean;
};

function AdminChatPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const lastTsRef = useRef<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const loadChannels = useCallback(async () => {
    try {
      const res = await adminListChannels({ data: {} });
      setChannels(res.channels as Channel[]);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const loadMessages = useCallback(async (channelId: string, sinceIso?: string) => {
    try {
      const res = await adminListMessages({ data: { channelId, sinceIso } });
      const incoming = res.messages as Msg[];
      if (sinceIso) {
        if (incoming.length > 0) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const merged = [...prev];
            for (const m of incoming) if (!seen.has(m.id)) merged.push(m);
            const last = merged[merged.length - 1];
            if (last) lastTsRef.current = last.created_at;
            return merged;
          });
        }
      } else {
        setMessages(incoming);
        const last = incoming[incoming.length - 1];
        lastTsRef.current = last?.created_at;
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void loadChannels();
    const id = setInterval(loadChannels, 6000);
    return () => clearInterval(id);
  }, [loadChannels]);

  useEffect(() => {
    if (!activeId) return;
    lastTsRef.current = undefined;
    void loadMessages(activeId);
    const id = setInterval(() => {
      if (activeId) void loadMessages(activeId, lastTsRef.current);
    }, 3000);
    return () => clearInterval(id);
  }, [activeId, loadMessages]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || !activeId) return;
    try {
      const res = await adminSendMessage({
        data: { channelId: activeId, body: text, senderName: "support" },
      });
      setMessages((prev) => [...prev, res.message as Msg]);
      lastTsRef.current = (res.message as Msg).created_at;
      setInput("");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const close = async () => {
    if (!activeId) return;
    if (!confirm("Stäng denna chattkanal?")) return;
    try {
      await adminCloseChannel({ data: { channelId: activeId } });
      await loadChannels();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const active = channels.find((c) => c.id === activeId);

  return (
    <section className="bg-background py-6">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mb-4 flex items-center justify-between">
          <Link to="/admin/produkter" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Tillbaka
          </Link>
          <h1 className="text-xl font-bold text-foreground">Kundchatt</h1>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="grid h-[70vh] grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
          {/* Channel list */}
          <aside className="overflow-y-auto rounded-xl border border-border bg-card">
            {channels.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Inga chattar än.</p>
            )}
            <ul>
              {channels.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className={`flex w-full items-start justify-between gap-2 border-b border-border px-3 py-2 text-left text-sm transition ${
                      activeId === c.id ? "bg-muted" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1 truncate font-medium text-foreground">
                        {c.status === "closed" && <Lock className="h-3 w-3" />}
                        {c.display_name || "Okänd"}
                      </div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        #{c.irc_channel_slug}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(c.last_message_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {/* Conversation */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
            {!active ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Välj en chatt till vänster
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {active.display_name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      #{active.irc_channel_slug} · {active.status}
                    </div>
                  </div>
                  {active.status === "open" && (
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
                    >
                      Stäng chatt
                    </button>
                  )}
                </div>

                <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-background p-3">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={
                        m.sender === "system"
                          ? "text-center text-[11px] italic text-muted-foreground"
                          : m.sender === "admin"
                            ? "ml-auto max-w-[70%] rounded-2xl rounded-br-sm bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                            : "mr-auto max-w-[70%] rounded-2xl rounded-bl-sm bg-muted px-3 py-1.5 text-sm text-foreground"
                      }
                    >
                      {m.sender === "visitor" && (
                        <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
                          {m.sender_name || "kund"}
                        </div>
                      )}
                      <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    </div>
                  ))}
                </div>

                {active.status === "open" ? (
                  <form
                    className="flex items-center gap-2 border-t border-border bg-card p-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void send();
                    }}
                  >
                    <input
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="Svara kunden…"
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
                ) : (
                  <div className="border-t border-border bg-muted px-4 py-3 text-center text-xs text-muted-foreground">
                    Chatten är stängd.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
