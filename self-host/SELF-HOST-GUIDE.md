# peptivaLab — Self-Host Guide

The single source of truth for putting the site live on your own VPS.
Combines what used to be three separate docs (wire-up, go-live, cheat sheet)
into one **top-to-bottom** walkthrough.

- **Time:** 45–90 min of work + 5–30 min waiting for DNS
- **Skill level:** comfortable on a Linux command line
- **You'll need:** an Ubuntu 22.04+ VPS, sudo SSH access, the domain
  `peptivalabgroup.com` at a registrar where you control DNS, and a password manager

**Symbols**

- 🔴 **Required** — site won't run without it
- 🟡 **Recommended** — site works, but you really should set this
- 🟢 **Optional** — nice to have

> Before you start, open a terminal AND a fresh password-manager note.
> Every secret you generate, paste into the password manager **before**
> putting it in `.env`. Some are unrecoverable if lost.

---

## 0. What you'll end up with

| URL                              | Service                              |
| -------------------------------- | ------------------------------------ |
| `https://peptivalabgroup.com`    | The website + admin panel            |
| `https://www.peptivalabgroup.com`| Same, redirects to apex              |
| `https://chat.peptivalabgroup.com`| WebSocket gateway for the live chat |
| `https://db.peptivalabgroup.com` | Supabase Studio (database admin UI)  |
| `chat.peptivalabgroup.com:6697`  | IRC over TLS (HexChat / mIRC)        |

---

## 1. Provision the VPS 🔴

Recommended specs: **Ubuntu 22.04 / 24.04 LTS · 4–8 GB RAM · 2 vCPU · 40 GB SSD.**
Hetzner CX22 (€4) or CX32 (€7) are well-tested. DigitalOcean, Linode, OVH all work.

Once you can SSH in as root, find the public IP:

```bash
ssh root@YOUR_SERVER_IP
curl -4 ifconfig.me
```

Write the IP down — you'll paste it into DNS in the next step.

---

## 2. DNS — point your domain at the server 🔴

At your registrar (Loopia, Cloudflare, Namecheap, …) add **four A-records**,
all pointing to your VPS IP, all with TTL `300`:

| Subdomain                       | Type | Points to    |
| ------------------------------- | ---- | ------------ |
| `peptivalabgroup.com`           | A    | your VPS IP  |
| `www.peptivalabgroup.com`       | A    | your VPS IP  |
| `chat.peptivalabgroup.com`      | A    | your VPS IP  |
| `db.peptivalabgroup.com`        | A    | your VPS IP  |

> **Cloudflare users:** set the proxy to **DNS only (grey cloud)** for now.
> Switch back to orange after Caddy has issued certificates.

Wait 5–30 min, then verify from your laptop:

```bash
dig +short peptivalabgroup.com
dig +short www.peptivalabgroup.com
dig +short chat.peptivalabgroup.com
dig +short db.peptivalabgroup.com
```

All four **must** print the VPS IP. **Don't continue** until they do.

- [ ] All 4 DNS A-records resolve to the VPS IP

---

## 3. Bootstrap the server 🔴

SSH back in (still as root) and run:

```bash
apt update && apt -y upgrade
curl -fsSL https://get.docker.com | sh
adduser deploy                            # create the deploy user
usermod -aG docker deploy
docker compose version                    # should print v2.x.x
apt -y install git
```

Then switch to the `deploy` user — never run the stack as root:

```bash
su - deploy
git clone https://github.com/<YOU>/peptivalab.git
cd peptivalab
ls self-host/                             # confirm the folder exists
```

- [ ] `docker compose version` works without `sudo`
- [ ] Repo cloned into `/home/deploy/peptivalab`

---

## 4. Lock down the firewall (UFW) 🔴

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # HTTP — required for Let's Encrypt
sudo ufw allow 443/tcp       # HTTPS — the website
sudo ufw allow 6697/tcp      # IRC over TLS (only if you use HexChat/mIRC)
sudo ufw enable
sudo ufw status
```

> **Do NOT open** ports 5432 (Postgres), 8000 (Kong), 3000 (app), 4000
> (Realtime), 9999 (Auth), 8080 (ws-gateway). They live inside Docker
> and must stay private.
>
> Skipping IRC desktop clients? Leave 6697 closed. The chat widget on
> the website still works — it tunnels through 443.

Also check your **VPS provider's separate firewall** (Hetzner Cloud Firewall,
DigitalOcean Cloud Firewalls, security groups). If 80/443 are blocked there,
UFW won't help.

- [ ] Firewall active, only 22 / 80 / 443 / 6697 open

---

## 5. Patch the build for self-hosting 🔴

The default build targets Cloudflare Workers. Switch it to a regular Node
build:

```bash
cd ~/peptivalab
./self-host/apply-patch.sh
```

You should see: `✔ self-host build patch applied.`

> Need to undo this later? `./self-host/revert-patch.sh`.

- [ ] Patch script ran successfully

---

## 6. Generate every secret 🔴

You'll paste these into `self-host/.env` in §7. Generate them now and
**save every value in your password manager** before pasting.

```bash
# Core stack
openssl rand -hex 32       # → JWT_SECRET (must be ≥ 32 chars)
openssl rand -base64 24    # → POSTGRES_PASSWORD
openssl rand -base64 18    # → DASHBOARD_PASSWORD (Supabase Studio)

# IRC / live chat (run 3 times, save each)
openssl rand -hex 24       # → IRC_OPER_PASSWORD
openssl rand -hex 24       # → IRC_SERVER_PASSWORD
openssl rand -hex 24       # → GATEWAY_TOKEN (= IRC_BOT_PASSWORD in app env)

# Admin panel
openssl rand -base64 18    # → ADMIN_CHAT_PASSWORD (temporary; replaced in §11)
openssl rand -hex 32       # → ADMIN_SESSION_SECRET (signs login cookie)

# Backups
openssl rand -base64 48    # → BACKUP_ENCRYPTION_PASSPHRASE
openssl rand -hex 32       # → INTERNAL_NOTIFY_TOKEN (lets backups send alerts)

# Crypto checkout (skip if not using NOWPayments)
openssl rand -hex 32       # → CRYPTO_INTERNAL_TOKEN
```

**Then generate the two Supabase API keys** from your `JWT_SECRET`:

1. Open <https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys>
2. Paste your `JWT_SECRET` into both fields.
3. Copy the **anon** JWT → that's `ANON_KEY`.
4. Copy the **service_role** JWT → that's `SERVICE_ROLE_KEY`.

> **Why `JWT_SECRET` is special:** Auth, the database API, Realtime AND
> Storage all share it. Mismatch = nothing logs in. Always regenerate the
> two API keys whenever you change `JWT_SECRET`.

- [ ] All secrets saved in your password manager

---

## 7. Fill in `.env` 🔴

The `.env` file lives **on the VPS** at `~/peptivalab/self-host/.env`. It's
plain text — every line is `KEY=value`. Every `CHANGEME_*` value must be
replaced with one of the secrets you generated in §6.

### 7.0 How to edit `.env` (step-by-step)

Follow this exact sequence every time you change `.env`, both for first-boot
and any later edit. Skipping a step is how `.env` edits "silently don't
take effect".

**Step 1 — SSH into the VPS as the `deploy` user.**

```bash
ssh deploy@<VPS_IP>            # never edit as root
cd ~/peptivalab/self-host
```

**Step 2 — On first boot only, create `.env` from the template.**

```bash
[ -f .env ] || cp .env.example .env
```

The `[ -f .env ] ||` part means "only copy if `.env` doesn't already exist"
— so re-running this can't wipe an `.env` you've already filled in.

**Step 3 — Make a backup before editing.** Cheap insurance.

```bash
cp .env .env.bak.$(date +%F-%H%M)
```

**Step 4 — Open it in the `nano` editor.**

```bash
nano .env
```

`nano` basics (the bottom bar shows them too — `^` means the **Ctrl** key):

| Key            | Action                                                  |
| -------------- | ------------------------------------------------------- |
| Arrow keys     | Move the cursor                                         |
| `Ctrl+W`       | Search — type the variable name, press Enter            |
| `Ctrl+K`       | Cut the current line (use to delete an entire line)     |
| `Ctrl+U`       | Paste the line you just cut                             |
| `Ctrl+O`, Enter| **Save** (writes the file)                              |
| `Ctrl+X`       | Exit (asks to save if you haven't)                      |

> **Pasting from your password manager:** in most terminals, `Shift+Insert`
> or `Ctrl+Shift+V` pastes. **Right-click → Paste** also works in PuTTY,
> WSL and Windows Terminal.

**Step 5 — Replace every `CHANGEME_…` value.** Format rules:

- One variable per line: `KEY=value` — no spaces around `=`.
- **Don't quote values** unless the value itself contains spaces or `#`.
  `JWT_SECRET=abc123` is correct, `JWT_SECRET="abc123"` works but is noisy.
- A line that starts with `#` is a comment — ignored. Use it for notes.
- Multi-line values (only `RCLONE_CONFIG` needs this) keep working as long
  as you don't add a blank line in the middle of the block.
- Don't leave any `CHANGEME_*` placeholders. Even one breaks the boot.

**Step 6 — Save and exit.** `Ctrl+O`, Enter, `Ctrl+X`.

**Step 7 — Verify the edit.**

```bash
chmod 600 .env                 # only you can read it
grep CHANGEME .env             # MUST print nothing
docker compose config -q       # MUST exit 0 (validates compose + .env)
```

If `grep CHANGEME .env` prints any line, you missed a value — go back to
step 4 and fix it.

If `docker compose config -q` prints an error, your `.env` has a syntax
problem (most often: a stray space, an unmatched quote, or `$` in a value
that compose tries to interpret — escape it as `$$`).

**Step 8 — Apply the change.**

| What you changed                                | How to apply                                                                |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| First boot, or any non-`VITE_*` variable        | `docker compose up -d` (recreates affected containers with the new env)     |
| A single service's variable (e.g. `SMTP_PASS`)  | `docker compose up -d <service>` — e.g. `docker compose up -d app`          |
| Any `VITE_*` variable (baked into the frontend) | `docker compose build app && docker compose up -d app` — needs a **rebuild**|

> **Use `up -d`, NOT `restart`.** `docker compose restart` reuses the
> existing container with its old environment — your edit silently won't
> take effect. Only `up -d` re-reads `.env` and recreates the container.

**Step 9 — Confirm it took effect.**

```bash
docker compose ps              # target service should be Up / healthy
docker compose logs -f <service>  # tail logs and watch for errors
```

For a single variable, you can verify it landed inside the container:

```bash
docker compose exec app printenv SMTP_HOST
```

If you broke something, restore the backup from step 3:

```bash
cp .env.bak.<timestamp> .env
docker compose up -d
```

### 7.1 Core stack

| Variable              | Value                                          |
| --------------------- | ---------------------------------------------- |
| `POSTGRES_PASSWORD`   | from §6                                        |
| `JWT_SECRET`          | from §6 (≥ 32 chars)                           |
| `ANON_KEY`            | anon JWT from the generator                    |
| `SERVICE_ROLE_KEY`    | service_role JWT from the generator            |
| `DASHBOARD_USERNAME`  | anything you like, e.g. `supabase`             |
| `DASHBOARD_PASSWORD`  | from §6                                        |
| `PUBLIC_SUPABASE_URL` | `https://db.peptivalabgroup.com`               |

### 7.2 HTTPS, domains, firewall

| Variable           | Value                                |
| ------------------ | ------------------------------------ |
| `LETSENCRYPT_EMAIL`| your real address (cert expiry warnings) |
| `SITE_DOMAIN`      | `peptivalabgroup.com`                |
| `WWW_DOMAIN`       | `www.peptivalabgroup.com`            |
| `CHAT_DOMAIN`      | `chat.peptivalabgroup.com`           |
| `STUDIO_DOMAIN`    | `db.peptivalabgroup.com`             |

### 7.3 Admin panel

| Variable                | Value                                    |
| ----------------------- | ---------------------------------------- |
| `ADMIN_SESSION_SECRET`  | from §6 (≥ 32 chars)                     |
| `ADMIN_CHAT_PASSWORD`   | from §6 — **temporary**, replaced in §11 |
| `ADMIN_PASSWORD_HASH`   | leave empty for now (set in §11)         |
| `ADMIN_TOTP_SECRET`     | leave empty for now (set in §11)         |

### 7.4 Live chat

| Variable                | Value                                 |
| ----------------------- | ------------------------------------- |
| `IRC_OPER_PASSWORD`     | from §6                               |
| `IRC_SERVER_PASSWORD`   | from §6                               |
| `GATEWAY_TOKEN`         | from §6                               |
| `IRC_BOT_PASSWORD`      | **same value as `GATEWAY_TOKEN`**     |
| `IRC_BOT_NICK`          | `pvl-bot` (default fine)              |
| `IRC_CHANNEL_PREFIX`    | `#pvl-` (default fine)                |

`docker-compose.yml` already wires the same `GATEWAY_TOKEN` value into both
the app and the ws-gateway, so you usually only set it once.

### 7.5 Email — contact form & alerts 🟡

Without this: contact form submissions are still saved in the database, but
nobody gets emailed about them, and backup failures only end up in logs.

Pick one provider:

| Provider                          | Host                  | Port  | Where to find credentials                  |
| --------------------------------- | --------------------- | ----- | ------------------------------------------ |
| **Brevo** (free, recommended)     | `smtp-relay.brevo.com`| `587` | brevo.com → SMTP & API → SMTP key          |
| Postmark                          | `smtp.postmarkapp.com`| `587` | server → API tokens                        |
| Mailgun                           | `smtp.eu.mailgun.org` | `587` | domain → SMTP credentials                  |
| Gmail (low volume only)           | `smtp.gmail.com`      | `587` | Google account → App Passwords             |
| Fastmail                          | `smtp.fastmail.com`   | `465` | settings → app passwords                   |

| Variable                | Value                                                    |
| ----------------------- | -------------------------------------------------------- |
| `SMTP_HOST`             | from table above                                         |
| `SMTP_PORT`             | from table above                                         |
| `SMTP_SECURE`           | leave empty for port `587`; set to `true` for port `465` |
| `SMTP_USER`             | provider username / API key id                           |
| `SMTP_PASS`             | provider password / API secret                           |
| `NOTIFY_EMAIL_FROM`     | `PeptivaLab <noreply@peptivalabgroup.com>`               |
| `NOTIFY_EMAIL_TO`       | your real address (comma-separate for multiple)          |
| `INTERNAL_NOTIFY_TOKEN` | from §6                                                  |

**Recommended:** also add **SPF / DKIM / DMARC** DNS records (your provider's
setup wizard generates the exact values) so your mail doesn't go to spam.

> Email subject lines and body templates are editable in the admin panel
> at `/admin/innehall → Mailmallar` — no need to touch any files.

### 7.6 Backups 🔴

| Variable                       | Value                                       |
| ------------------------------ | ------------------------------------------- |
| `BACKUP_ENCRYPTION_KEY_ID`     | `k1` (just a label)                         |
| `BACKUP_ENCRYPTION_PASSPHRASE` | from §6                                     |
| `BACKUP_CRON`                  | `17 3 * * *` (daily 03:17 UTC) — default ok |
| `BACKUP_RETENTION_DAYS`        | `14` — default ok                           |

The `backup` service in `docker-compose.yml` runs this automatically — you
do **not** need a host-side cron job. See §13 for the off-site copy.

### 7.7 NOWPayments — crypto checkout 🟡

Skip if you don't accept BTC / ETH / USDC / USDT — checkout falls back to
other payment methods.

1. Sign up at <https://nowpayments.io>, complete basic KYB.
2. **Store settings → Payout wallets** — add a receiving wallet for each
   coin you want. Coins without a payout wallet are hidden at checkout.
3. **Store settings → API keys** → *Create*. Copy the key.
4. **Store settings → IPN settings**:
   - **IPN callback URL:** `https://peptivalabgroup.com/api/public/crypto/webhook`
   - Click *Generate* next to **IPN Secret key** and copy it.

| Variable                       | Value                                               |
| ------------------------------ | --------------------------------------------------- |
| `NOWPAYMENTS_API_KEY`          | from step 3                                         |
| `NOWPAYMENTS_IPN_SECRET`       | from step 4                                         |
| `NOWPAYMENTS_BASE_URL`         | `https://api.nowpayments.io/v1` (default)           |
| `CRYPTO_INTERNAL_TOKEN`        | from §6                                             |
| `VITE_PAYMENTS_API_BASE_URL`   | `https://peptivalabgroup.com`                       |
| `CRYPTO_SUCCESS_URL`           | `https://peptivalabgroup.com/checkout/bekraftelse`  |
| `CRYPTO_CANCEL_URL`            | `https://peptivalabgroup.com/checkout`              |

The frontend calls `${VITE_PAYMENTS_API_BASE_URL}/api/crypto/create-invoice`
and `/api/crypto/order/:id`. Hosting payments routes on a different
subdomain (e.g. `api.peptivalabgroup.com`)? Point `VITE_PAYMENTS_API_BASE_URL`
there and add a matching DNS record + Caddy entry.

### 7.8 Analytics 🟢

| Variable                | Value                                            |
| ----------------------- | ------------------------------------------------ |
| `VITE_PLAUSIBLE_DOMAIN` | `peptivalabgroup.com` (your domain in Plausible) |
| `VITE_PLAUSIBLE_SRC`    | only set if you self-host Plausible              |

> Changes to `VITE_*` vars need an app rebuild:
> `docker compose build app && docker compose up -d app`

### 7.9 SEO 🟡

| Variable          | Value                          |
| ----------------- | ------------------------------ |
| `PUBLIC_SITE_URL` | `https://peptivalabgroup.com`  |

Used for `/sitemap.xml` and `/robots.txt`.

### 7.10 Final `.env` hygiene

```bash
chmod 600 .env
grep CHANGEME .env       # MUST return nothing
docker compose config -q # MUST exit 0 (validates the compose file)
```

- [ ] `.env` filled, no `CHANGEME` strings remain
- [ ] `JWT_SECRET` matches the value used to mint `ANON_KEY` / `SERVICE_ROLE_KEY`
- [ ] `IRC_BOT_PASSWORD` (app) = `GATEWAY_TOKEN` (ws-gateway)
- [ ] `PUBLIC_SUPABASE_URL=https://db.peptivalabgroup.com`

---

## 8. (Optional) Import data from a previous host 🟡

Skip if starting fresh.

1. Export the old database to a file called `dump.sql`.
2. Upload to the VPS:
   ```bash
   scp dump.sql deploy@<VPS_IP>:~/peptivalab/self-host/initdb/01-import.sql
   ```
3. Postgres auto-loads it on **first** boot, after the base schema. If
   Postgres has already booted once, you have to wipe its volume first
   (`docker compose down -v` — **deletes everything**).

---

## 9. First boot 🔴

```bash
cd ~/peptivalab/self-host
docker compose up -d
docker compose ps                       # everything Up / healthy in ~2 min
docker compose logs -f caddy            # watch SSL certs being issued
```

Look for `certificate obtained successfully` for each of the four domains.
Press **Ctrl-C** once you see them.

**If Caddy keeps retrying:**

- DNS hasn't propagated — verify with `dig` again
- Port 80 blocked — check UFW *and* the VPS provider's firewall
- Cloudflare proxy on — switch back to DNS-only (grey cloud)

For a deeper diagnosis run:

```bash
bash self-host/troubleshoot/check-web-access.sh
# or use the interactive menu:
bash self-host/menu.sh
```

- [ ] All services show `Up` or `healthy`
- [ ] Caddy issued certs for all 4 domains

---

## 10. Smoke tests 🔴

From your laptop, not the VPS:

**Test 1 — The website**

- [ ] <https://peptivalabgroup.com> loads, padlock is green
- [ ] `/produkter`, `/kontakt`, `/faq` open without errors
- [ ] DevTools → Network → reload — no failed requests

**Test 2 — Admin panel**

- [ ] <https://peptivalabgroup.com/admin/login>
- [ ] Login with `ADMIN_CHAT_PASSWORD` works
- [ ] `/admin/produkter`, `/admin/innehall`, `/admin/sidor` all load
- [ ] Edit a page, save, reload → change persisted

**Test 3 — Live chat** (open in a private window so you're not logged in)

- [ ] Chat widget appears, you can type
- [ ] Send a message → it appears in `/admin/chatt`
- [ ] Reply from admin → visitor window updates in real time

**Test 4 — Database admin (Studio)**

- [ ] <https://db.peptivalabgroup.com> prompts for login
- [ ] `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` work
- [ ] You can browse tables

**Test 5 — IRC desktop client** (only if you opened 6697)

- [ ] HexChat connects to `chat.peptivalabgroup.com:6697`, password = `IRC_SERVER_PASSWORD`
- [ ] `/oper admin <IRC_OPER_PASSWORD>` succeeds

> Anything fails? Tail the matching service:
> `docker compose logs <name>` (e.g. `app`, `auth`, `realtime`, `kong`).

---

## 11. Lock down the admin login 🔴

Now that you can log in, swap the temporary password for a hashed one and
turn on 2FA.

### 11.1 Hash the admin password

1. <https://peptivalabgroup.com/admin/sakerhet>
2. Click **"Generera lösenordshash"**, type a strong password.
3. Copy the long `$2b$…` string into `ADMIN_PASSWORD_HASH` in `.env`.
4. **Delete** the `ADMIN_CHAT_PASSWORD=` line.
5. Apply:
   ```bash
   docker compose up -d app
   ```
   Use `up -d`, **not** `restart` — only `up -d` re-reads `.env`.

### 11.2 Two-factor authentication 🟡

1. `/admin/sakerhet` → click **"Generera 2FA"**.
2. Scan the QR with your authenticator app (Aegis, 1Password, Google Auth…).
3. Copy the Base32 secret shown below the QR → paste into
   `ADMIN_TOTP_SECRET` in `.env`.
4. `docker compose up -d app`.
5. Next login asks for the 6-digit code.

`ADMIN_TOTP_ISSUER` and `ADMIN_TOTP_ACCOUNT` are just labels in your
authenticator app — defaults are fine.

- [ ] `ADMIN_PASSWORD_HASH` set, `ADMIN_CHAT_PASSWORD` removed
- [ ] 2FA tested with authenticator app

---

## 12. Auto-deploy on git push 🟢

Push to GitHub → VPS pulls and rebuilds.

```bash
# On the VPS:
sudo -u deploy ssh-keygen -t ed25519 -f /home/deploy/.ssh/id_ed25519 -N ""
sudo -u deploy bash -c "cat /home/deploy/.ssh/id_ed25519.pub >> /home/deploy/.ssh/authorized_keys"
sudo cat /home/deploy/.ssh/id_ed25519     # copy this private key
```

In **GitHub repo → Settings → Secrets and variables → Actions** add:

| Secret        | Value                                       |
| ------------- | ------------------------------------------- |
| `VPS_HOST`    | your VPS IP (or `peptivalabgroup.com`)      |
| `VPS_USER`    | `deploy`                                    |
| `VPS_SSH_KEY` | the private key from above (the whole file) |
| `VPS_PATH`    | `/home/deploy/peptivalab`                   |

Activate the workflow:

```bash
mkdir -p .github/workflows
cp self-host/deploy.example.yml .github/workflows/deploy.yml
git add .github && git commit -m "ci: auto-deploy" && git push
```

- [ ] First GitHub Actions run is green
- [ ] `docker compose logs -f app` shows the redeploy

---

## 13. Off-site backups 🔴

The `backup` container already takes daily encrypted dumps to the VPS.
**On-server backups die with the VPS** — set up off-site too. Backblaze B2
is cheap (~$0.005/GB/month):

1. backblaze.com → create a **private** bucket called `peptivalab-backups`.
2. **App keys** → "Add a New Application Key" scoped to that bucket.
   Copy keyID and applicationKey.
3. On your laptop: `rclone config` → "n" (new) → name `b2` → choose
   Backblaze B2 → paste the credentials.
4. Open `~/.config/rclone/rclone.conf`, copy the entire `[b2]` block.
5. Paste it into `RCLONE_CONFIG` in `.env` (multiline value is fine).
6. Set `OFFSITE_REMOTE=b2:peptivalab-backups`.
7. `docker compose up -d backup`.

Verify:

```bash
docker compose exec backup rclone ls b2:peptivalab-backups
```

### Test restore — required, do it once 🔴

```bash
docker compose exec backup verify-latest.sh
```

This decrypts the most recent dump into a throwaway database and replays it.
Without this drill you don't actually have a backup, you have hope.

- [ ] Backup container running and producing daily dumps
- [ ] `OFFSITE_REMOTE` set, first sync verified
- [ ] **Test restore passed**

---

## 14. Uptime monitoring 🟡

Free, no env vars needed. The app exposes `/api/public/health` returning
HTTP 200 + JSON.

1. <https://uptimerobot.com> → New monitor → HTTP(S):
   - **URL:** `https://peptivalabgroup.com/api/public/health`
   - **Interval:** 5 min
   - **Alert contact:** your email or phone
2. Add a second monitor for `https://db.peptivalabgroup.com`.

For self-hosted: see `UPTIME-MONITORING.md` for an Uptime Kuma block.

- [ ] Monitor green

---

## 15. Post go-live cleanup

- [ ] Decommission the previous deployment (or leave it dormant)
- [ ] Remove old DNS records pointing at the previous host
- [ ] Confirm email aliases (`hej@`, `admin@`) still work — DNS changes
      didn't touch MX, but verify
- [ ] All secrets safely stored in your password manager
- [ ] VPS provider, server IP, recovery steps written down somewhere
      future-you will find

---

## Day-2 commands

```bash
# Update everything to latest images
docker compose pull && docker compose up -d

# Tail one service's logs
docker compose logs -f app

# Reload .env changes (recreates the container with fresh env)
docker compose up -d app
# NOT `docker compose restart app` — restart keeps the old env

# Rebuild only the app container after a code change
docker compose build app && docker compose up -d app

# Manual database backup to a local file
docker compose exec -T db pg_dump -U postgres postgres > backup.sql

# Stop everything (data preserved)
docker compose down

# Stop AND DELETE all data (DANGEROUS)
docker compose down -v

# Interactive troubleshooting menu
bash self-host/menu.sh

# Or run individual diagnostics directly
bash self-host/troubleshoot/diag.sh
bash self-host/troubleshoot/check-web-access.sh
```

---

## Quick troubleshooting

| Symptom                                | First thing to check                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------- |
| Site loads, DB queries fail            | App's `SUPABASE_URL` must be `http://kong:8000` (internal), not the public URL      |
| Realtime / chat doesn't update         | `JWT_SECRET` must match across all Supabase services                                |
| Caddy keeps retrying TLS               | DNS not propagated yet, or port 80 blocked (UFW or provider firewall)               |
| IRC bridge "auth failed"               | `GATEWAY_TOKEN` (ws-gateway) must equal `IRC_BOT_PASSWORD` (app)                    |
| `/admin` login fails after `.env` edit | `docker compose up -d app` (NOT `restart` — restart keeps old env)                  |
| Crypto webhook 401                     | `NOWPAYMENTS_IPN_SECRET` mismatch with the value in NOWPayments dashboard           |
| 502 Bad Gateway from Caddy             | `bash self-host/troubleshoot/check-caddy-dns.sh`                                    |
| One specific PC can't reach the site   | Run `self-host/troubleshoot/check-pc-access.ps1` on that PC                         |
| Anything else                          | `bash self-host/menu.sh` and pick the relevant diagnostic                           |

---

## Rollback plan — if go-live goes badly

You can flip back to the previous host in under 5 min:

1. Point the four A-records back to the old host's IP.
2. Re-enable the previous deployment.
3. Wait 5–30 min for DNS.
4. Investigate the VPS at your leisure — it stays running, just with no traffic.

> The previous database is unchanged (the migration was a one-way **copy**,
> not a move). Anything written to the VPS DB after cutover is lost on
> rollback.

---

## Final pre-flight check

Tick these before announcing go-live:

- [ ] All 4 DNS A-records resolve (`dig +short …`)
- [ ] `JWT_SECRET` matches the value used to mint `ANON_KEY` / `SERVICE_ROLE_KEY`
- [ ] `ADMIN_SESSION_SECRET` set (≥ 32 chars)
- [ ] `ADMIN_PASSWORD_HASH` set, `ADMIN_CHAT_PASSWORD` deleted
- [ ] `ADMIN_TOTP_SECRET` set, tested with authenticator app
- [ ] `GATEWAY_TOKEN` identical in app and ws-gateway env
- [ ] SMTP test: submit `/kontakt` form → email arrives
- [ ] NOWPayments sandbox order flips to `paid` (skip if no crypto)
- [ ] `BACKUP_ENCRYPTION_PASSPHRASE` saved off-server in password manager
- [ ] `OFFSITE_REMOTE` configured + first sync verified
- [ ] Test restore (`verify-latest.sh`) passed
- [ ] UptimeRobot monitor green
- [ ] Caddy issued certs for all 4 domains (`docker compose logs caddy`)
- [ ] UFW: only 22 / 80 / 443 / 6697 open (`sudo ufw status`)
- [ ] All `CHANGEME` strings gone from `.env` (`grep CHANGEME .env`)
