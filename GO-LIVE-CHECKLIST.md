# peptivaLab — Go-Live Checklist

Step-by-step everything you need to do before flipping the site to production.
Work top to bottom — each section assumes the previous one is done.

---

## 1. Domain & DNS

1. Buy/own your main domain (e.g. `peptivalab.se`) and a chat subdomain
   (e.g. `chat.peptivalab.se`).
2. Point DNS:
   - `peptivalab.se` + `www` → Lovable (set after publishing, see §6).
   - `chat.peptivalab.se` → A/AAAA record to your private server's public IP
     (the box that will run the IRC stack).
3. Open these inbound ports on the IRC server's firewall:
   - `443` (HTTPS for the WebSocket gateway, via Caddy/nginx)
   - `6697` (IRC over TLS, for HexChat/mIRC)
   - Optionally `80` (only so Caddy can fetch a Let's Encrypt cert)

---

## 2. Stand up the IRC server

On the private server (Linux + Docker installed):

```bash
git clone <your-repo> peptivalab
cd peptivalab/irc-server
cp .env.example .env
```

Edit `.env` and set **strong, unique** values for:

- `IRC_OPER_PASSWORD` — your `/oper admin <pwd>` password in HexChat.
- `IRC_SERVER_PASSWORD` — server PASS that every IRC client must send.
- `GATEWAY_TOKEN` — shared secret between the website and the WS gateway.
  **Must match `IRC_BOT_PASSWORD` in §4.**

Start it:

```bash
docker compose up -d
docker compose logs -f
```

You should see `InspIRCd started` and `ws-gateway listening on :8080`.

---

## 3. Put TLS in front of the WebSocket (`wss://`)

Browsers will refuse a plain `ws://` from an HTTPS site. Install Caddy
(easiest, auto-Let's Encrypt) on the same box:

```bash
sudo apt install caddy   # or your distro's equivalent
```

`/etc/caddy/Caddyfile`:

```
chat.peptivalab.se {
  reverse_proxy localhost:8080
}
```

```bash
sudo systemctl reload caddy
```

Verify:

```bash
curl -I https://chat.peptivalab.se   # should return 426 / upgrade required
```

---

## 4. Wire the website to IRC (Lovable Cloud secrets)

In Lovable → **Cloud → Secrets**, add:

| Secret               | Value                                                 |
| -------------------- | ----------------------------------------------------- |
| `IRC_GATEWAY_URL`    | `wss://chat.peptivalab.se`                            |
| `IRC_SERVER`         | `chat.peptivalab.se`                                  |
| `IRC_BOT_NICK`       | `pvl-bot` (or any nick)                               |
| `IRC_BOT_PASSWORD`   | **same value as `GATEWAY_TOKEN` in `irc-server/.env`** |
| `IRC_CHANNEL_PREFIX` | `#pvl-`                                               |
| `ADMIN_CHAT_PASSWORD`| strong password for `/admin` login                    |

After saving, redeploy the project so server functions pick them up.

---

## 5. Connect HexChat (or any IRC client) for staff

- **Server:** `chat.peptivalab.se / 6697` — TLS, accept self-signed if needed.
- **Server password:** `IRC_SERVER_PASSWORD` from §2.
- **Nick:** `support` (or your name).
- **Auto-join:** leave empty — channels appear when visitors start chats.
  Use `/list` to see active `#pvl-*` channels, `/join #pvl-xxxx` to enter.
- Become an operator (gives kick/mode rights):
  ```
  /oper admin <IRC_OPER_PASSWORD>
  ```

Tell every staff member to keep HexChat open during business hours so
visitor messages get answered.

---

## 6. Smoke-test end-to-end

1. From the staging preview, open the chat bubble and send a message.
2. In HexChat, `/list` — there should be a `#pvl-xxxx` channel.
3. `/join` it. You should see the visitor's message.
4. Reply in HexChat — it should appear in the website chat within ~1 second.
5. Click "Avsluta chatt" in the widget — channel + history should disappear
   from the database (verify in Lovable → Cloud → Database → `chat_channels`).

If steps 2–4 fail, check:

```bash
docker compose logs ws-gateway      # auth or connection errors
```
…and the project's server-function logs in Lovable.

---

## 7. Database & content sanity check

In Lovable → Cloud → Database, confirm:

- `site_pages` has all pages you want public, `published = true`.
- `site_content` keys (hero text, contact info, etc.) are filled in.
- `chat_channels` and `chat_messages` are empty or test-only — clear them
  before launch with `DELETE FROM chat_channels;` (cascades to messages).

---

## 8. Admin access

1. Visit `/admin/login`, sign in with `ADMIN_CHAT_PASSWORD` (§4).
2. Confirm `/admin/produkter` and `/admin/chatt` both load.
3. Change the password by updating the `ADMIN_CHAT_PASSWORD` secret
   in Lovable Cloud and redeploying.

---

## 9. SEO & metadata

For each route under `src/routes/`, double-check `head()` has:

- Unique `title` (< 60 chars)
- Unique `meta description` (< 160 chars)
- `og:title`, `og:description`, and `og:image` where you have a hero image
- Canonical URL pointing at the production domain

---

## 10. Publish & connect custom domain

1. Click **Publish** (top right) → "Publish".
2. Verify the `*.lovable.app` URL works.
3. Project Settings → **Domains** → add `peptivalab.se` and `www.peptivalab.se`.
4. Update DNS as Lovable instructs (usually a CNAME or A record).
5. Wait for the cert to provision (✅ green check).

---

## 11. Post-launch monitoring

- Bookmark the IRC server: `ssh user@chat.peptivalab.se` + `docker compose logs -f`.
- Bookmark Lovable → **Logs** for server-function and edge errors.
- Set a reminder to rotate `IRC_SERVER_PASSWORD`, `GATEWAY_TOKEN`, and
  `ADMIN_CHAT_PASSWORD` every 90 days.
- Back up the database periodically from Lovable → Cloud → Database → Export.

---

## Quick reference — secrets that MUST match

```
irc-server/.env            ⇄   Lovable Cloud secrets
GATEWAY_TOKEN              ==  IRC_BOT_PASSWORD
IRC_SERVER_PASSWORD        →   used by HexChat (PASS)
IRC_OPER_PASSWORD          →   used by /oper admin
```

If chats silently fail to forward to IRC, 99% of the time it's a mismatch
between `GATEWAY_TOKEN` and `IRC_BOT_PASSWORD`.
