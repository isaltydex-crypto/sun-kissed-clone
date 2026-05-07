// IRC bridge stub.
//
// This module is the SINGLE place to wire the chat to a real IRC gateway later.
// Today it only logs and returns false (not synced). When you're ready, fill in
// `forwardToIrc` and `provisionChannel` — the rest of the app already calls
// these for every visitor message and every new channel.
//
// Suggested env vars (already read here, no code changes needed when set):
//   IRC_GATEWAY_URL       e.g. wss://your-webircgateway.example/webirc
//   IRC_SERVER            e.g. irc.libera.chat
//   IRC_BOT_NICK          e.g. peptivalab-bot
//   IRC_BOT_PASSWORD      optional SASL/NickServ password
//   IRC_CHANNEL_PREFIX    e.g. #pvl-   (per-visitor channels become #pvl-<slug>)

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

/**
 * Called once when a new visitor channel is created.
 * Today: no-op. Later: open/join the IRC channel via your gateway.
 */
export async function provisionChannel(slug: string, displayName: string): Promise<void> {
  const cfg = getIrcConfig();
  if (!cfg) {
    console.log(`[irc-bridge] (no gateway configured) would provision ${ircChannelName(slug)} for ${displayName}`);
    return;
  }
  // TODO: connect to cfg.gatewayUrl, JOIN ircChannelName(slug), invite admins, etc.
  console.log(`[irc-bridge] provision ${ircChannelName(slug)} on ${cfg.server}`);
}

/**
 * Called for every chat message (visitor + admin).
 * Returns true when delivered to IRC. Today: returns false so messages are
 * marked irc_synced=false and stay queued in the database.
 */
export async function forwardToIrc(args: {
  slug: string;
  sender: "visitor" | "admin" | "system";
  senderName: string | null;
  body: string;
}): Promise<boolean> {
  const cfg = getIrcConfig();
  if (!cfg) return false;
  // TODO: PRIVMSG ircChannelName(args.slug) :<args.senderName>: <args.body>
  console.log(`[irc-bridge] -> ${ircChannelName(args.slug)} ${args.sender}/${args.senderName}: ${args.body}`);
  return false;
}
