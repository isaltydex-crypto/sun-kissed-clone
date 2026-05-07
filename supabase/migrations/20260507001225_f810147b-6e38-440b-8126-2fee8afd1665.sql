
-- Customer support chat: per-visitor channels with persisted messages.
-- IRC bridge will be wired in later; this schema is bridge-agnostic.

create table if not exists public.chat_channels (
  id uuid primary key default gen_random_uuid(),
  visitor_token text not null unique,
  display_name text,
  irc_channel_slug text not null unique,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index if not exists chat_channels_last_message_at_idx
  on public.chat_channels (last_message_at desc);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.chat_channels(id) on delete cascade,
  sender text not null check (sender in ('visitor','admin','system')),
  sender_name text,
  body text not null,
  irc_synced boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_channel_created_idx
  on public.chat_messages (channel_id, created_at);

-- Lock the tables down. All access goes through server functions using the
-- service role; the visitor_token acts as the per-visitor capability check
-- in the server function layer.
alter table public.chat_channels enable row level security;
alter table public.chat_messages enable row level security;

-- No public policies are created on purpose: anon/authenticated clients
-- cannot read or write directly. Server functions use the admin client.
