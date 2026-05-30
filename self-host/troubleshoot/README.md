# Troubleshooting scripts

All diagnostic and troubleshooting scripts for the self-hosted stack live in this folder.

> **Tip:** for an interactive menu that lets you pick scripts, restart/rebuild
> containers, tail logs, open shells, and view past log files — run
> `bash self-host/menu.sh` instead of remembering individual commands.

**Rules:**
- Every new troubleshooting script goes here AND gets an entry in this README.
- Every script sources `_lib.sh`, which redirects all output to `troubleshoot/logs/<script>-<timestamp>.log`. The terminal only shows a banner and the final log path — no wall of text.

---

## How to pull & run on the VPS

```bash
cd /home/deploy/sun-kissed-clone
git pull
chmod +x self-host/troubleshoot/*.sh
bash self-host/troubleshoot/<script-name>.sh
```

After the script finishes it prints something like:

```
✓ finished  log: /home/deploy/sun-kissed-clone/self-host/troubleshoot/logs/diag-20260510-134812.log
```

Send me that file (`cat <path>` and paste, or upload it) instead of screenshots.

Clear old logs anytime with:

```bash
rm self-host/troubleshoot/logs/*.log
```

---

## Available scripts

### `check-web-access.sh`
**Use when:** the site doesn't load in a browser (timeout, connection refused, cert warning, ERR_CONNECTION_*).

**What it does:**
- Reads `SITE_DOMAIN`, `WWW_DOMAIN`, `CHAT_DOMAIN`, and `STUDIO_DOMAIN` from `.env`
- Greps Caddy logs for cert / ACME / error lines
- Lists what's bound to ports 80 and 443
- Shows processes holding port 80 (catches stray nginx/apache)
- Shows UFW firewall status
- Shows `docker compose ps` for all containers
- Logs DNS A/AAAA records for each configured domain
- Probes each configured domain over HTTPS and HTTP from inside the VPS, treating redirects, protected DB login, and WebSocket upgrade responses as expected
- Checks that the app container contains built static CSS/JS/image files
- Parses the homepage and probes its CSS/JS/image URLs, catching the “unstyled page / broken images” failure mode
- Probes Caddy locally on `127.0.0.1` using the configured hostname
- Prints the VPS public IP and compares it to DNS A records

**Typical fixes it points to:** UFW blocking 80/443, provider firewall/security group blocking 80/443, another web server holding port 80, Let's Encrypt failing because DNS doesn't match the public IP, or built static assets not being served by the app container.

---

### `diag.sh`
**Use when:** you want a full health check of the entire stack (app, database, Caddy, IRC, etc.) and have the script attempt safe auto-fixes.

**What it does:**
- Inspects every service in `docker-compose.yml`
- Verifies the app container responds on `/api/public/health` (uses Node's `fetch` since `curl`/`wget` aren't reliably present inside the alpine container)
- Checks Postgres connectivity and migration state
- Restarts unhealthy containers when it's safe to do so
- Prints a summary of what's green / red / fixed

**When to prefer this over `check-web-access.sh`:** the browser reaches the site but something inside is broken (500s, blank pages, login fails, missing data).

---

### `fix-checkout-db.sh`
**Use when:** checkout shows `Failed to create invoice (500)` / `Could not create order`, especially after adding Paymento to an existing self-host install.

**What it does:**
- Checks that the checkout database tables (`orders`, `order_items`, `discount_codes`, audit and diagnostics tables) exist
- Applies the idempotent app schema from `initdb/zz-app-schema.sql` if anything is missing
- Restarts the REST API container so it reloads the schema cache
- Runs a rollback-only smoke test that inserts an order and item, then rolls it back
- Confirms whether `PAYMENTO_API_KEY` is present inside the app container

**Typical fixes it points to:** the existing database volume was created before order/payment tables were added, or `.env` was changed but the app container was not recreated.

---

### `check-peptidepay.sh`
**Use when:** checkout still shows Peptide-Pay `503` / “not configured” after editing `self-host/.env`.

**What it does:**
- Confirms `.env` contains either `PEPTIDEPAY_API_KEY` or `PEPTIDEPAY_WALLET`
- Confirms `.env` contains `PEPTIDEPAY_WEBHOOK_SECRET` and `VITE_PAYMENTS_API_BASE_URL`
- Confirms `docker-compose.yml` passes Peptide-Pay env vars into the `app` container
- Checks the running `app` container has those env vars without printing secret values
- Suggests the exact rebuild command if the container is stale

**Typical fixes it points to:** the code was not pulled after the compose wiring was added, or `.env` was edited but the `app` container was not rebuilt/recreated.

---

### `check-nowpayments.sh`
**Use when:** "Betala med krypto"-knappen i checkout är borta eller returnerar `503`, eller NOWPayments webhooks inte markerar ordrar som betalda.

**What it does:**
- Confirms `.env` contains `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET`
- Confirms `docker-compose.yml` passes those vars into the `app` container
- Confirms the running `app` container actually has them (without printing secret values)
- Pings `https://api.nowpayments.io/v1/status` from inside the app container with the configured key to verify the key works
- Probes `/api/public/nowpayments-webhook` and expects `401`/`503` (anything else means the route didn't load)

**Typical fixes it points to:** the code was not pulled after the compose wiring was added, `.env` was edited but the `app` container was not rebuilt, or the IPN callback URL in the NOWPayments dashboard doesn't match `https://<your-domain>/api/public/nowpayments-webhook`.

---

### `check-email.sh`
**Use when:** contact/admin/NOWPayments emails are not arriving even though `self-host/.env` looks correct.

**What it does:**
- Confirms SMTP + notification recipient variables exist in `.env`
- Confirms `docker-compose.yml` passes those variables into the `app` container
- Confirms the running `app` container actually has them without printing secret values
- Checks whether Brevo TXT/DKIM/DMARC records are visible in public DNS
- Runs a real SMTP login test from inside the app container
- Sends a real test email to `NOWPAYMENTS_NOTIFY_TO` or `NOTIFY_EMAIL_TO`

**Typical fixes it points to:** `.env` was changed but the app container was not recreated, `NOWPAYMENTS_NOTIFY_TO` was set but not passed into the app, Brevo DNS records have not propagated, or Brevo SMTP rejects the login/sender.

---

### `simulate-nowpayments-ipn.sh`
**Use when:** du vill verifiera att en order faktiskt blir `paid` (eller `failed`) i DB utan att vänta på en riktig krypto-betalning.

**What it does:**
- Läser `NOWPAYMENTS_IPN_SECRET` + `SITE_DOMAIN` ur `.env`
- Bygger en NOWPayments-liknande payload med `order_id=<order_number>` och valt `payment_status`
- Signerar payloaden i app-containern med HMAC-SHA512 över *sorted-keys* JSON (samma algoritm som NOWPayments)
- POST:ar till `https://<SITE_DOMAIN>/api/public/nowpayments-webhook` med `x-nowpayments-sig`-header
- Skriver ut HTTP-status + tolkar 200/401/503/404
- Visar order-raden i `public.orders` så du ser om `payment_status` och `metadata.last_ipn` uppdaterades

**Usage:** `./simulate-nowpayments-ipn.sh <order_number> [status]` — status default `finished`. Overrida endpoint med `WEBHOOK_PATH=/api/public/nowpayments/webhook ./simulate-...` om du fortfarande kör den gamla URL:en.

**Typical fixes it points to:** `IPN_SECRET` skiljer mellan dashboard och `.env` (→ 401), app-containern saknar secret (→ 503), eller fel webhook-URL i dashboarden (→ 404).



### `fix-irc-tls.sh`
**Use when:** `docker compose up -d app` fails with `Bind for 0.0.0.0:6697 failed: port is already allocated`, or RevolutionIRC / HexChat / mIRC can't connect to `chat.<domain>:6697`.

**What it does:**
- Reads `CHAT_DOMAIN` from `self-host/.env`
- Stops and removes stale standalone IRC containers (`pvl-ircd`, `pvl-ws-gateway`) that conflict with the integrated self-host IRC service on port `6697`
- Finds the Caddy data volume (`*_caddy_data`)
- Confirms Caddy has issued a Let's Encrypt cert for `CHAT_DOMAIN` (fails fast with instructions if not)
- Recreates the integrated self-host `ircd` and `ws-gateway` containers so they pick up the shared cert volume, TLS entrypoint, and current secrets
- Confirms the TLS cert/key are readable inside `ircd` and that the TLS bind config is present
- Runs an external `openssl s_client` certificate-validating handshake against `${CHAT_DOMAIN}:6697`
- Sends a full `PASS` / `NICK` / `USER` IRC login sequence and reports the exact server-side failure if welcome `001` is not returned

**Typical fixes it points to:** the old standalone `irc-server/docker-compose.yml` stack is still running and owns `6697`, Caddy hasn't issued the cert yet (visit `https://chat.<domain>` once), firewall is blocking 6697 (`ufw allow 6697/tcp`), Revolution IRC has the wrong server password, or the IRC containers were still running with stale `.env` values.

---

### `fix-products-db.sh`
**Use when:** `/admin/produkter` won't add or update products, or saving appears to do nothing.

**What it does:**
- Confirms the database is reachable
- Creates or repairs the `products` table, columns, unique slug constraint, updated-at trigger, public read policy, and service-role privileges
- Runs a rollback-only product insert smoke test
- Restarts the REST API and recreates the app container so schema/env changes are picked up

**Typical fixes it points to:** the self-hosted database volume was created before the products table migration existed, or the app container is still running an older build.

---

### `fix-product-images-bucket.sh`
**Use when:** uploading a product image in `/admin/produkter` fails with **"Bilden kunde inte laddas upp: The related resource does not exist"**.

**What it does:**
- Confirms the database is reachable and the `storage.buckets` table exists
- Creates the public `product-images` bucket (idempotent) and the public-read RLS policy on `storage.objects`
- Restarts the `storage` and `rest` services so they pick up the new bucket

**Typical fixes it points to:** the self-hosted database volume was created before the storage bucket was added to the init schema. New installs get the bucket automatically from `initdb/zz-app-schema.sql`.

---


### `check-pc-access.ps1` (Windows / PowerShell — **standalone**, runs on the affected PC)
**Use when:** the site loads from your phone / other devices but **not from a specific PC**.

This script is self-contained — it does **not** need the rest of the repo. Copy
just the `.ps1` file (USB stick, email, download from GitHub) onto the affected
PC and run it. Logs are written to `%USERPROFILE%\Desktop\pc-access-logs\`.

**What it does (read-only by default):**
- Resolves the domain via local DNS and cross-checks `1.1.1.1` and `8.8.8.8`
- Dumps the local DNS cache for the domain
- Scans the `hosts` file for stray overrides
- Pings + TCP connect tests on 443 and 80
- HTTPS HEAD request (status + response headers)
- Inspects the served TLS certificate
- Reports system / environment proxy settings
- Runs `tracert` to show where packets die
- Opens the log folder when finished

**Run it:**
```powershell
powershell -ExecutionPolicy Bypass -File .\check-pc-access.ps1
```

**With auto-repair (admin PowerShell):**
```powershell
powershell -ExecutionPolicy Bypass -File .\check-pc-access.ps1 -Fix
```

**Override the domain:** `-Domain example.com`

---

### `check-irc-client.sh`
**Use when:** Revolution IRC (or HexChat / mIRC) won't connect to `chat.<domain>:6697` and you need the EXACT error the server returns.

**HexChat note:** the server entry must be `chat.<domain>/+6697` or the network must have **Use SSL for all the servers on this network** checked. In HexChat, plain `:6697` can still attempt a non-TLS IRC login on a TLS-only port and disconnect as “connection aborted”.

**What it does:**
- Reads `CHAT_DOMAIN` and `IRC_SERVER_PASSWORD` from `.env` (override with `HOST=`, `PORT=`, `PASS=`, `NICK=` env vars)
- Resolves DNS for the chat host
- Confirms TCP reachability on port 6697
- Performs a real TLS handshake with `openssl s_client` and checks cert validity
- Sends the same `PASS` / `NICK` / `USER` sequence Revolution IRC sends, captures every byte the server returns
- Interprets the response and prints a one-line cause: 001 success, 464 bad password, 432 bad nick, 433 nick in use, throttle/ban, generic ERROR, missing HexChat SSL setting, or "zero bytes after TLS"

**Typical fixes it points to:** `IRC_SERVER_PASSWORD` mismatch with what's typed in Revolution IRC, expired/wrong TLS cert on `chat.<domain>`, port 6697 blocked by firewall, or InspIRCd crashed.

---

### `check-irc.sh`
**Use when:** the live chat widget shows "ansluter…" forever, admins don't receive visitor messages, or you want to confirm the InspIRCd + ws-gateway + bridge chain is healthy.

**What it does:**
- Verifies all required `.env` vars are present and not `CHANGEME`, and that `IRC_BOT_PASSWORD` matches `GATEWAY_TOKEN` (bridge auth fails otherwise)
- Confirms `ircd` and `ws-gateway` containers are running, with recent log tails
- From inside the docker network, opens a TCP connection to `ircd:6667` and checks for an IRC banner
- Confirms host port `8080` is listening
- Performs a real WebSocket handshake against `ws://127.0.0.1:8080` AND the public `IRC_GATEWAY_URL` using the configured `GATEWAY_TOKEN`, expecting `READY` back
- Hits `https://chat.<domain>` through Caddy and treats `426`/`101`/`400`/`404` as healthy (a plain GET to a WS endpoint is supposed to be rejected)
- Confirms the `app` container has the IRC env vars baked in (catches the "I edited `.env` but used `restart`" footgun) and greps app logs for `irc-bridge` activity

**Typical fixes it points to:** mismatched `IRC_BOT_PASSWORD` / `GATEWAY_TOKEN`, missing `IRC_GATEWAY_URL` in the app container (use `docker compose up -d app`, not `restart`), Caddy not proxying `chat.<domain>`, or InspIRCd refusing `PASS`.

---

### `check-caddy-dns.sh`
**Use when:** Caddy returns **502 Bad Gateway** and its logs show `dial tcp: lookup app on 127.0.0.11:53: no such host` (or any upstream hostname it can't resolve).

**What it does:**
- Lists the Docker networks attached to `caddy` and `app`, and confirms they share `pvl`
- Lists every container on the `pvl` network with its IP
- Resolves `app` from inside the Caddy container via Docker's embedded DNS (127.0.0.11)
- Probes `http://app:3000` from inside Caddy to confirm TCP reachability
- Greps recent Caddy logs for upstream / dial / 502 errors
- Prints remediation hints (most often: `docker compose up -d --force-recreate caddy app`)

---

### `diagnose-app.sh`
**Use when:** only the `app` container is misbehaving (crash loop, 502 from Caddy, healthcheck failing) and you want a deep-dive on just that service.

**What it does:**
- Tails recent `app` container logs
- Runs the in-container health probe
- Checks the Node adapter is serving on port 3000
- Reports memory / restart count
- Attempts a clean restart if the container is stuck

---

---

### `check-wireguard.sh`
**Use when:** you've enabled (or are about to enable) the optional WireGuard
VPN gate for `/admin` and want to verify each piece of the chain.

**What it does:**
- Confirms the `wireguard` container is running (under the `vpn` compose profile)
- Confirms UFW allows `51820/udp`
- Lists generated peer configs and reminds you how to fetch the `.conf` / QR code
- Runs `wg show` and checks at least one peer has handshaked recently
- Detects whether the Caddyfile `WireGuard-gated admin allowlist` block is uncommented
- Probes `https://<SITE_DOMAIN>/admin/login` from the VPS and expects `404`
  (which means the gate is working — outside callers see no admin panel)

**Typical fixes it points to:** container not started (`docker compose --profile vpn up -d wireguard`), UFW blocking the UDP port, peer never connected, or the Caddy allowlist block still commented out.

See **`self-host/wireguard/README.md`** for the full setup walkthrough.

---

### `view-logs.sh`

**Use when:** you want to browse any log on the server (container stdout, persistent log files, past troubleshoot runs) without remembering each `docker compose logs` / `tail -F` command.

**What it does:**
- Discovers every available log source:
  - `docker compose logs` for each compose service
  - Persistent log files inside the `app` container under `/var/log/peptiva/*.log` (e.g. `admin-actions.log`)
  - Caddy log files inside the `caddy` container under `/var/log/caddy/*.log`
  - The 30 most recent `troubleshoot/logs/*.log` files on the host
- Prints an interactive numbered menu — pick a source, then choose a viewing mode:
  1. tail last 200 lines
  2. follow live (Ctrl-C to stop)
  3. open full log in `less` (q to exit)
- Everything you view is also appended to this script's own `logs/view-logs-*.log` so you can share it later.

**Run it:**
```bash
bash self-host/troubleshoot/view-logs.sh
```

---

## Adding a new script

1. Create the script in this folder: `self-host/troubleshoot/<name>.sh`
2. Start it with `#!/usr/bin/env bash` and `set -u`, then immediately source the logging helper:
   ```bash
   . "$(cd "$(dirname "$0")" && pwd)/_lib.sh"
   ```
   This auto-creates a timestamped log file under `logs/` and silences the terminal.
3. Make it idempotent — safe to run multiple times
4. Add a section to this README with:
   - **Use when:** the symptom that calls for it
   - **What it does:** bullet list of the actual checks
   - Any fixes it suggests or auto-applies
5. `chmod +x` the script

Keep the "Available scripts" list alphabetical so it stays easy to scan.
