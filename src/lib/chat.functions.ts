import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { adminAuthMiddleware } from "@/lib/admin-middleware";

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function getIrcBridge() {
  return import("@/lib/irc-bridge.server");
}

export const ensureChannel = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ visitorToken: z.string().min(8).max(128), displayName: z.string().min(1).max(60).optional() }).parse(d))
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdminClient();
    const irc = await getIrcBridge();
    const { data: existing, error: existingError } = await supabaseAdmin.from("chat_channels").select("*").eq("visitor_token", data.visitorToken).maybeSingle();
    if (existingError) throw new Error(existingError.message);
    if (existing) return { channelId: existing.id, slug: existing.irc_channel_slug, ircChannel: irc.ircChannelName(existing.irc_channel_slug), displayName: existing.display_name };
    const slug = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
    const displayName = data.displayName?.trim() || `kund-${slug.slice(0, 4)}`;
    const { data: created, error } = await supabaseAdmin.from("chat_channels").insert({ visitor_token: data.visitorToken, display_name: displayName, irc_channel_slug: slug }).select("*").single();
    if (error) throw new Error(error.message);
    await irc.provisionChannel(slug, displayName);
    await supabaseAdmin.from("chat_messages").insert({ channel_id: created.id, sender: "system", body: `Chatt skapad (${irc.ircChannelName(slug)}). Vi svarar så snart vi kan.` });
    return { channelId: created.id, slug: created.irc_channel_slug, ircChannel: irc.ircChannelName(created.irc_channel_slug), displayName: created.display_name };
  });

export const sendVisitorMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ visitorToken: z.string().min(8).max(128), body: z.string().min(1).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdminClient();
    const irc = await getIrcBridge();
    const { data: channel, error: channelError } = await supabaseAdmin.from("chat_channels").select("*").eq("visitor_token", data.visitorToken).maybeSingle();
    if (channelError) throw new Error(channelError.message);
    if (!channel) throw new Response("No channel", { status: 404 });
    if (channel.status !== "open") throw new Response("Channel closed", { status: 403 });
    const synced = await irc.forwardToIrc({ slug: channel.irc_channel_slug, sender: "visitor", senderName: channel.display_name, body: data.body });
    const { data: msg, error } = await supabaseAdmin.from("chat_messages").insert({ channel_id: channel.id, sender: "visitor", sender_name: channel.display_name, body: data.body, irc_synced: synced }).select("*").single();
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("chat_channels").update({ last_message_at: new Date().toISOString() }).eq("id", channel.id);
    return { message: msg };
  });

export const fetchVisitorMessages = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ visitorToken: z.string().min(8).max(128), sinceIso: z.string().optional() }).parse(d))
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdminClient();
    const irc = await getIrcBridge();
    const { data: channel, error: channelError } = await supabaseAdmin.from("chat_channels").select("*").eq("visitor_token", data.visitorToken).maybeSingle();
    if (channelError) throw new Error(channelError.message);
    if (!channel) return { channel: null, messages: [] as unknown[] };
    let q = supabaseAdmin.from("chat_messages").select("*").eq("channel_id", channel.id).order("created_at", { ascending: true }).limit(200);
    if (data.sinceIso) q = q.gt("created_at", data.sinceIso);
    const { data: messages, error } = await q;
    if (error) throw new Error(error.message);
    return { channel: { id: channel.id, slug: channel.irc_channel_slug, ircChannel: irc.ircChannelName(channel.irc_channel_slug), status: channel.status, displayName: channel.display_name }, messages: messages ?? [] };
  });

export const endVisitorChat = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ visitorToken: z.string().min(8).max(128) }).parse(d))
  .handler(async ({ data }) => {
    const supabaseAdmin = await getAdminClient();
    const { data: channel, error: channelError } = await supabaseAdmin.from("chat_channels").select("*").eq("visitor_token", data.visitorToken).maybeSingle();
    if (channelError) throw new Error(channelError.message);
    if (!channel) return { ok: true };
    const { error } = await supabaseAdmin.from("chat_channels").delete().eq("id", channel.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminListChannels = createServerFn({ method: "POST" }).middleware([adminAuthMiddleware]).inputValidator((d) => z.object({}).parse(d ?? {})).handler(async () => {
  const supabaseAdmin = await getAdminClient();
  const { data: channels, error } = await supabaseAdmin.from("chat_channels").select("*").order("last_message_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return { channels: channels ?? [] };
});

export const adminListMessages = createServerFn({ method: "POST" }).middleware([adminAuthMiddleware]).inputValidator((d) => z.object({ channelId: z.string().uuid(), sinceIso: z.string().optional() }).parse(d)).handler(async ({ data }) => {
  const supabaseAdmin = await getAdminClient();
  let q = supabaseAdmin.from("chat_messages").select("*").eq("channel_id", data.channelId).order("created_at", { ascending: true }).limit(500);
  if (data.sinceIso) q = q.gt("created_at", data.sinceIso);
  const { data: messages, error } = await q;
  if (error) throw new Error(error.message);
  return { messages: messages ?? [] };
});

export const adminSendMessage = createServerFn({ method: "POST" }).middleware([adminAuthMiddleware]).inputValidator((d) => z.object({ channelId: z.string().uuid(), body: z.string().min(1).max(2000), senderName: z.string().min(1).max(60).default("support") }).parse(d)).handler(async ({ data }) => {
  const supabaseAdmin = await getAdminClient();
  const irc = await getIrcBridge();
  const { data: channel, error: cErr } = await supabaseAdmin.from("chat_channels").select("*").eq("id", data.channelId).single();
  if (cErr || !channel) throw new Response("No channel", { status: 404 });
  const synced = await irc.forwardToIrc({ slug: channel.irc_channel_slug, sender: "admin", senderName: data.senderName, body: data.body });
  const { data: msg, error } = await supabaseAdmin.from("chat_messages").insert({ channel_id: channel.id, sender: "admin", sender_name: data.senderName, body: data.body, irc_synced: synced }).select("*").single();
  if (error) throw new Error(error.message);
  await supabaseAdmin.from("chat_channels").update({ last_message_at: new Date().toISOString() }).eq("id", channel.id);
  return { message: msg };
});

export const adminCloseChannel = createServerFn({ method: "POST" }).middleware([adminAuthMiddleware]).inputValidator((d) => z.object({ channelId: z.string().uuid() }).parse(d)).handler(async ({ data }) => {
  const supabaseAdmin = await getAdminClient();
  const { error } = await supabaseAdmin.from("chat_channels").update({ status: "closed" }).eq("id", data.channelId);
  if (error) throw new Error(error.message);
  return { ok: true };
});