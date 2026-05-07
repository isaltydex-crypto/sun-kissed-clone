# peptivaLab IRC server (self-hosted)

A drop-in IRC stack you can run on any private server with Docker.
It contains:

- **InspIRCd** — the IRC daemon itself (port `6697` TLS, `6667` plain).
- **ws-gateway** — a tiny Node.js WebSocket bridge in front of InspIRCd. The
  Lovable site (the `irc-bridge.server.ts` module) connects to this
  WebSocket; the gateway forwards every line over a real TCP IRC connection.
- A self-signed TLS cert auto-generated on first start.

## 1. Start it

```bash
cd irc-server
cp .env.example .env
#  → edit .env and set strong values for IRC_OPER_PASSWORD,
#    IRC_SERVER_PASSWORD and GATEWAY_TOKEN
docker compose up -d
```

That's it. Three things are now listening:

| Port  | What                          | Who connects                           |
| ----- | ----------------------------- | -------------------------------------- |
| 6697  | InspIRCd (TLS)                | You, with HexChat / mIRC / weechat     |
| 6667  | InspIRCd (plain, internal)    | The `ws-gateway` container             |
| 8080  | `ws-gateway` (WebSocket)      | The Lovable site (`IRC_GATEWAY_URL`)   |

For production put nginx/Caddy in front of `:8080` to terminate TLS as
`wss://`. Example Caddyfile snippet:

```
chat.yourdomain.com {
  reverse_proxy localhost:8080
}
```

## 2. Connect with HexChat / mIRC

- Server: `your-server:6697` (TLS, accept self-signed)
- Server password: the value of `IRC_SERVER_PASSWORD` in `.env`
- Nick: anything (e.g. `support`)
- Auto-join: `#pvl-*` channels are created on the fly when a visitor
  starts a chat. Run `/list` to see active ones.

Make yourself an oper if you want kick/mode powers:

```
/oper admin <IRC_OPER_PASSWORD>
```

## 3. Wire it to the website

Set these in the Lovable Cloud project (Settings → Backend secrets):

```
IRC_GATEWAY_URL    = wss://chat.yourdomain.com
IRC_SERVER         = chat.yourdomain.com
IRC_BOT_NICK       = pvl-bot
IRC_BOT_PASSWORD   = <same as GATEWAY_TOKEN in .env>
IRC_CHANNEL_PREFIX = #pvl-
```

The bridge sends `IRC_BOT_PASSWORD` as the first WebSocket frame; the
gateway compares it to `GATEWAY_TOKEN` and refuses the connection
otherwise. After that, each frame is a raw IRC line (`PRIVMSG`,
`JOIN`, etc.) and the gateway forwards it 1:1 to InspIRCd.

## 4. Update / stop

```bash
docker compose pull && docker compose up -d   # update
docker compose down                            # stop
docker compose logs -f ws-gateway              # tail bridge logs
docker compose logs -f ircd                    # tail IRC logs
```

## 5. Files

```
docker-compose.yml      service definitions
.env.example            template — copy to .env
inspircd/inspircd.conf  IRC daemon config (oper, password, channels)
ws-gateway/             Node.js WS↔TCP-IRC bridge
```
