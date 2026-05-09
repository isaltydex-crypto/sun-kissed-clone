# peptivaLab — Wire-Up Checklist

Everything you need to plug in to make the site run on your own server.
Work through it from top to bottom, **one section at a time**.

This file answers: **"What do I need to fill in, and where do I get it?"**
Its sister file `GO-LIVE-CHECKLIST.md` answers: **"In what order do I do things?"**
Use them together.

**Symbols**
- 🔴 **Required** — site won't start without it
- 🟡 **Recommended** — site works, but you really should set this
- 🟢 **Optional** — nice to have

> **Tip:** Open a fresh terminal on your computer and a password manager
> note. Every secret you generate, paste into the password manager BEFORE
> putting it in the file. If you lose them, some are unrecoverable.

---

## 1. DNS — point your domain at the server 🔴

Your domain (peptivalab.se) needs to know where the server lives.

**Step 1.** On your VPS, find its public IP address:
```bash
curl -4 ifconfig.me
```
Write down the number it prints (e.g. `203.0.113.42`).

**Step 2.** Log into your domain registrar (Loopia, Cloudflare, Namecheap, etc.)
and add **four A-records**, all pointing to that IP:

| Subdomain                 | Type | Points to    |
| ------------------------- | ---- | ------------ |
| `peptivalab.se`           | A    | your VPS IP  |
| `www.peptivalab.se`       | A    | your VPS IP  |
| `chat.peptivalab.se`      | A    | your VPS IP  |
| `db.peptivalab.se`        | A    | your VPS IP  |

**Step 3.** Wait 5–30 minutes, then check from your computer:
```bash
dig +short peptivalab.se
```
It should print your VPS IP. Repeat for the other three. Don't continue
until all four work.

> **Cloudflare users:** Set the proxy to **DNS-only (grey cloud)** for now.
> You can switch it on (orange cloud) later, after Let's Encrypt has issued
> certificates.

---

## 2. Database & Supabase keys 🔴

These all go into `self-host/.env`.

**Step 1.** Generate the basics. Run each line, copy the output into your
password manager:
```bash
openssl rand -base64 24    # → POSTGRES_PASSWORD
openssl rand -hex 32       # → JWT_SECRET (≥32 chars)
openssl rand -base64 18    # → DASHBOARD_PASSWORD
```

**Step 2.** Generate the two API keys.
1. Open <https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys>
2. Paste your `JWT_SECRET` (from step 1) into both fields on that page.
3. Copy the **anon** JWT it produces → that's your `ANON_KEY`.
4. Copy the **service_role** JWT → that's your `SERVICE_ROLE_KEY`.

> **Why this matters:** Auth, the database API, Realtime, and Storage all
> share `JWT_SECRET`. If they don't all use the same value, nothing logs in.

**Step 3.** Fill these into `self-host/.env`:

| Variable              | Value                                       |
| --------------------- | ------------------------------------------- |
| `POSTGRES_PASSWORD`   | from step 1                                 |
| `JWT_SECRET`          | from step 1                                 |
| `ANON_KEY`            | from step 2 (anon JWT)                      |
| `SERVICE_ROLE_KEY`    | from step 2 (service_role JWT)              |
| `DASHBOARD_USERNAME`  | anything you like, e.g. `supabase`          |
| `DASHBOARD_PASSWORD`  | from step 1                                 |
| `PUBLIC_SUPABASE_URL` | `https://db.peptivalab.se`                  |

---

## 3. Admin login 🔴

Lets you sign into the `/admin` panel on the live site.

**Step 1.** Generate a session secret (signs your login cookie):
```bash
openssl rand -hex 32       # → ADMIN_SESSION_SECRET
```

**Step 2.** Set a temporary password (you'll replace it in step 3):
```bash
openssl rand -base64 18    # → ADMIN_CHAT_PASSWORD
```

**Step 3.** After the site is running, log in once with that password,
then go to `/admin/sakerhet` → click **"Generera lösenordshash"**, type a
strong password you'll remember, copy the long `$2b$…` string into
`ADMIN_PASSWORD_HASH`. Restart the app, then **delete `ADMIN_CHAT_PASSWORD`**
from `.env`.

### Two-factor authentication (2FA) 🟡

Highly recommended.

1. Log into `/admin/sakerhet` → click **"Generera 2FA"**.
2. Scan the QR code with your authenticator app (Aegis, 1Password, Google Authenticator, etc.).
3. Copy the Base32 secret shown below the QR → paste into `ADMIN_TOTP_SECRET`.
4. Restart the app: `docker compose up -d app`.
5. Next login will ask for the 6-digit code from your phone.

`ADMIN_TOTP_ISSUER` and `ADMIN_TOTP_ACCOUNT` are just the labels shown in
your authenticator app — leave the defaults unless you care.

---

## 4. Live chat 🔴

The IRC-based chat widget needs three shared secrets:

```bash
openssl rand -hex 24       # → IRC_OPER_PASSWORD
openssl rand -hex 24       # → IRC_SERVER_PASSWORD
openssl rand -hex 24       # → GATEWAY_TOKEN
```

`GATEWAY_TOKEN` is the password the website uses to talk to the chat
gateway. Make sure it appears in **both** the app's env and the
ws-gateway's env (the docker-compose file already does this for you).

`IRC_BOT_NICK` and `IRC_CHANNEL_PREFIX` are display-only — defaults
(`pvl-bot`, `#pvl-`) are fine.

> Want to use HexChat or mIRC from your laptop? Open port `6697/tcp`
> in the firewall (see section 7). The in-browser widget works
> without it.

---

## 5. Email — contact form & alerts 🟡

Without this: contact form submissions are still saved in the database,
but no one gets emailed about them, and backup failures are only logged.

**Step 1.** Pick a provider and sign up (one is enough):

| Provider                          | Host                  | Port  | Where to find credentials                  |
| --------------------------------- | --------------------- | ----- | ------------------------------------------ |
| **Brevo** (free, recommended)     | `smtp-relay.brevo.com`| `587` | brevo.com → SMTP & API → SMTP key          |
| Postmark                          | `smtp.postmarkapp.com`| `587` | server → API tokens                        |
| Mailgun                           | `smtp.eu.mailgun.org` | `587` | domain → SMTP credentials                  |
| Gmail (low volume only)           | `smtp.gmail.com`      | `587` | Google account → App Passwords             |
| Fastmail                          | `smtp.fastmail.com`   | `465` | settings → app passwords                   |

**Step 2.** Verify your sending domain (`peptivalab.se`) inside the
provider. They'll give you DNS records to add — do that in your registrar.

**Step 3.** Fill into `self-host/.env`:

| Variable                | Value                                                    |
| ----------------------- | -------------------------------------------------------- |
| `SMTP_HOST`             | from table above                                         |
| `SMTP_PORT`             | from table above                                         |
| `SMTP_SECURE`           | leave empty                                              |
| `SMTP_USER`             | provider username / API key id                           |
| `SMTP_PASS`             | provider password / API secret                           |
| `NOTIFY_EMAIL_FROM`     | `PeptivaLab <noreply@peptivalab.se>`                     |
| `NOTIFY_EMAIL_TO`       | your real address (comma-separate for multiple)          |
| `INTERNAL_NOTIFY_TOKEN` | `openssl rand -hex 32` (lets backups send alerts)        |

**Step 4. (Recommended)** Add three DNS records so your mail doesn't go
to spam. Your provider's setup wizard generates the exact values:
- **SPF** (TXT record)
- **DKIM** (CNAME records)
- **DMARC** (TXT record on `_dmarc.peptivalab.se`)

> **Email templates** (subject lines and body text) are editable in the
> admin panel at `/admin/innehall → Mailmallar` — no need to touch any files.

---

## 6. Backups 🔴

**Step 1.** Generate an encryption passphrase:
```bash
openssl rand -base64 48
```
**Save this in your password manager.** Without it, backups are unreadable.

**Step 2.** Fill in:

| Variable                       | Value                                       |
| ------------------------------ | ------------------------------------------- |
| `BACKUP_ENCRYPTION_KEY_ID`     | `k1` (just a label)                         |
| `BACKUP_ENCRYPTION_PASSPHRASE` | from step 1                                 |
| `BACKUP_CRON`                  | `17 3 * * *` (daily 03:17 UTC) — default ok |
| `BACKUP_RETENTION_DAYS`        | `14` — default ok                           |

### Off-site copy 🟡 (strongly recommended)

If your VPS dies, on-server backups die with it. Set up Backblaze B2
(cheap, ~$0.005/GB/month):

1. Sign up at backblaze.com → create a **private** bucket called
   `peptivalab-backups`.
2. **App keys** → "Add a New Application Key" scoped to that bucket.
   Copy keyID and applicationKey.
3. On your laptop: `rclone config` → "n" (new remote) → name it `b2` →
   choose Backblaze B2 → paste the credentials.
4. Open `~/.config/rclone/rclone.conf`. Copy the entire `[b2]` block.
5. Paste it into `RCLONE_CONFIG` in `.env` (multiline value is fine).
6. Set `OFFSITE_REMOTE=b2:peptivalab-backups`.

Test that it works:
```bash
docker compose exec backup rclone ls b2:peptivalab-backups
```

---

## 7. HTTPS & firewall 🔴

| Variable           | Value                                |
| ------------------ | ------------------------------------ |
| `LETSENCRYPT_EMAIL`| your real address (cert expiry warnings) |
| `SITE_DOMAIN`      | `peptivalab.se`                      |
| `WWW_DOMAIN`       | `www.peptivalab.se`                  |
| `CHAT_DOMAIN`      | `chat.peptivalab.se`                 |
| `STUDIO_DOMAIN`    | `db.peptivalab.se`                   |

**Firewall (UFW):** open only what you need.
```bash
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP (Let's Encrypt)
sudo ufw allow 443/tcp    # HTTPS (the website)
sudo ufw allow 6697/tcp   # IRC (only if you want desktop chat clients)
sudo ufw enable
```
Everything else stays internal to Docker — never expose Postgres or Auth
directly to the internet.

---

## 8. NOWPayments — crypto checkout 🟡

Skip if you don't want to accept BTC / ETH / USDC / USDT. The site falls back
to other payment methods when this isn't configured.

NOWPayments is the crypto processor. Your VPS runs a small server that talks
to it; the website talks to your VPS, never to NOWPayments directly. That
keeps your API key off the browser.

**Step 1. Create a NOWPayments account.**
1. Sign up at <https://nowpayments.io> and complete the basic KYB form.
2. **Dashboard → Store settings → Payout wallets** — add a receiving wallet
   for each coin you want to accept (BTC, ETH, USDC, USDT). Without a payout
   wallet, that coin is disabled at checkout.
3. **Dashboard → Store settings → API keys** — click *Create*. Copy the key.
4. **Dashboard → Store settings → IPN settings**:
   - **IPN callback URL:** `https://peptivalab.se/api/crypto/webhook`
   - Click *Generate* next to **IPN Secret key** and copy it.

**Step 2. Generate the secrets locally.**
```bash
openssl rand -hex 32       # → CRYPTO_INTERNAL_TOKEN (links site ↔ payments server)
```

**Step 3. Fill into `self-host/.env`:**

| Variable                       | Value                                               |
| ------------------------------ | --------------------------------------------------- |
| `NOWPAYMENTS_API_KEY`          | from step 1.3                                       |
| `NOWPAYMENTS_IPN_SECRET`       | from step 1.4                                       |
| `NOWPAYMENTS_BASE_URL`         | `https://api.nowpayments.io/v1` (default — leave)   |
| `CRYPTO_INTERNAL_TOKEN`        | from step 2                                         |
| `VITE_PAYMENTS_API_BASE_URL`   | `https://peptivalab.se` (where the payments routes live) |
| `CRYPTO_SUCCESS_URL`           | `https://peptivalab.se/checkout/bekraftelse`        |
| `CRYPTO_CANCEL_URL`            | `https://peptivalab.se/checkout`                    |

> The frontend calls `${VITE_PAYMENTS_API_BASE_URL}/api/crypto/create-invoice`
> and `/api/crypto/order/:id` — see `src/lib/paymentsApi.ts`. If you host the
> payments routes on a different subdomain (e.g. `api.peptivalab.se`), point
> `VITE_PAYMENTS_API_BASE_URL` there and add a matching DNS A-record + Caddy
> entry.

**Step 4. Test before going live.**
1. NOWPayments dashboard → **Sandbox mode ON** (top right) for the first run.
2. Place a small test order on `/checkout`, choose *Crypto*, complete the
   sandbox payment.
3. Check `docker compose logs -f app` — you should see
   `crypto.webhook received` and the order should flip to `paid` in the admin
   panel (`/admin/ordrar`).
4. Turn sandbox **OFF** when satisfied.

> **Common gotchas:** wrong IPN URL (must be HTTPS, must match exactly),
> missing payout wallet (coin won't appear at checkout), or `CRYPTO_INTERNAL_TOKEN`
> mismatch between the site and the payments server (invoice creation 401s).

---

## 9. Analytics 🟢

Optional Plausible Analytics. Empty = no tracking.

| Variable                | Value                                            |
| ----------------------- | ------------------------------------------------ |
| `VITE_PLAUSIBLE_DOMAIN` | `peptivalab.se` (your domain in Plausible)       |
| `VITE_PLAUSIBLE_SRC`    | only set if you self-host Plausible              |

> Changes to these need an app rebuild:
> `docker compose build app && docker compose up -d app`

---

## 10. SEO 🟡

| Variable          | Value                  |
| ----------------- | ---------------------- |
| `PUBLIC_SITE_URL` | `https://peptivalab.se` |

Used for `/sitemap.xml` and `/robots.txt`. After go-live, submit the
sitemap to Google Search Console (one-time).

---

## 11. Uptime monitoring 🟡

Get an email/SMS if the site goes down. Free, no env vars.

1. Sign up at <https://uptimerobot.com> (or self-host Uptime Kuma).
2. Add an HTTP monitor:
   - **URL:** `https://peptivalab.se/api/public/health`
   - **Interval:** 5 min
   - **Alert contact:** your email or phone
3. Add a second monitor for `https://db.peptivalab.se`.

See `UPTIME-MONITORING.md` for screenshots and Uptime Kuma instructions.

---

## 12. Auto-deploy on git push 🟢

Push to GitHub and have the VPS pull and rebuild automatically.

**Step 1.** On the VPS, generate a deploy SSH key:
```bash
sudo -u deploy ssh-keygen -t ed25519 -f /home/deploy/.ssh/id_ed25519 -N ""
sudo -u deploy bash -c "cat /home/deploy/.ssh/id_ed25519.pub >> /home/deploy/.ssh/authorized_keys"
sudo cat /home/deploy/.ssh/id_ed25519     # copy this private key
```

**Step 2.** In **GitHub → repo → Settings → Secrets and variables → Actions**,
add four secrets:

| Secret        | Value                                    |
| ------------- | ---------------------------------------- |
| `VPS_HOST`    | your VPS IP, or `peptivalab.se`          |
| `VPS_USER`    | `deploy`                                 |
| `VPS_SSH_KEY` | the private key from step 1 (whole thing)|
| `VPS_PATH`    | `/home/deploy/peptivalab`                |

**Step 3.** Activate the workflow:
```bash
mkdir -p .github/workflows
cp self-host/deploy.example.yml .github/workflows/deploy.yml
git add .github && git commit -m "ci: auto-deploy" && git push
```

---

## 12. Migrating data from a previous host 🟡

Skip if starting fresh.

1. Export the old database to a single SQL file called `dump.sql`.
2. Upload it to the VPS:
   ```bash
   scp dump.sql deploy@<VPS_IP>:~/peptivalab/self-host/initdb/01-import.sql
   ```
3. On the **first** boot of Postgres, the file is auto-imported after the
   schema. (If Postgres has already booted once, you'll need to wipe its
   volume — `docker compose down -v` — first. **This deletes everything.**)

---

## Final pre-flight check

Before you start the stack, run:

```bash
cd ~/peptivalab/self-host
chmod 600 .env                 # tighten permissions
grep CHANGEME .env             # MUST return nothing
docker compose config -q       # MUST exit 0 (validates the compose file)
docker compose up -d
docker compose ps              # everything Up / healthy within ~2 min
```

If anything is "Restarting" or "Exited", check its logs:
```bash
docker compose logs -f <service-name>
```

Then run the 5 smoke tests in **`GO-LIVE-CHECKLIST.md → §10`**.

---

## Quick "is everything wired up?" checklist

Tick these off as you go:

- [ ] All 4 DNS A-records resolve (`dig +short ...`)
- [ ] `JWT_SECRET` matches the value used to generate `ANON_KEY` / `SERVICE_ROLE_KEY`
- [ ] `ADMIN_SESSION_SECRET` set (≥32 chars)
- [ ] `ADMIN_PASSWORD_HASH` set, `ADMIN_CHAT_PASSWORD` deleted
- [ ] `ADMIN_TOTP_SECRET` set, tested with authenticator app
- [ ] `GATEWAY_TOKEN` identical in app and ws-gateway env
- [ ] SMTP test: submit `/kontakt` form → email arrives
- [ ] `BACKUP_ENCRYPTION_PASSPHRASE` saved off-server in password manager
- [ ] `OFFSITE_REMOTE` configured + first sync verified
- [ ] UptimeRobot monitor green
- [ ] Caddy issued certs for all 4 domains (`docker compose logs caddy`)
- [ ] UFW: only 22 / 80 / 443 / 6697 open (`sudo ufw status`)
- [ ] Restore drill passed: `docker compose exec backup verify-latest.sh`
