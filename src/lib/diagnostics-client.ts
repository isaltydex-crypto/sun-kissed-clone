// ============================================================================
// Browser-side error capture: window.onerror + unhandledrejection.
// Posts to /api/public/diag-client. In-memory dedupe to avoid spamming.
// ============================================================================
const SEEN: Map<string, number> = new Map();
const DEDUPE_MS = 30_000;

function fingerprint(message: string, source?: string, lineno?: number): string {
  return `${message}|${source ?? ""}|${lineno ?? ""}`.slice(0, 300);
}

function shouldSend(fp: string): boolean {
  const now = Date.now();
  const last = SEEN.get(fp);
  if (last && now - last < DEDUPE_MS) return false;
  SEEN.set(fp, now);
  // GC old entries occasionally
  if (SEEN.size > 200) {
    for (const [k, t] of SEEN) {
      if (now - t > DEDUPE_MS * 4) SEEN.delete(k);
    }
  }
  return true;
}

async function send(payload: {
  kind: string;
  message: string;
  stack?: string;
  url?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await fetch("/api/public/diag-client", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // Diagnostics must never break the app.
  }
}

let installed = false;

export function installClientDiagnostics(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (event) => {
    const err = event.error as Error | undefined;
    const message = err?.message || event.message || "Unknown error";
    const fp = fingerprint(message, event.filename, event.lineno);
    if (!shouldSend(fp)) return;
    send({
      kind: "window.error",
      message,
      stack: err?.stack,
      url: window.location.href,
      meta: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      typeof reason === "string"
        ? reason
        : (reason as Error)?.message ?? JSON.stringify(reason).slice(0, 500);
    const stack = (reason as Error)?.stack;
    const fp = fingerprint(message);
    if (!shouldSend(fp)) return;
    send({
      kind: "unhandledrejection",
      message,
      stack,
      url: window.location.href,
    });
  });
}
