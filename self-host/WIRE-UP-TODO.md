# peptivaLab — VPS Wire-Up TODO

Point-by-point list of every secret, service, and integration that must be
wired up on your private VPS. Work top-to-bottom. Each item has **what**,
**where to put it**, and **how to generate / get it**.

Companion to `GO-LIVE-CHECKLIST.md` (which covers the *order of operations*).
This file is the *what plugs into what*.

Legend: 🔴 required to boot · 🟡 strongly recommended · 🟢 optional

---

## 1. DNS — 4 A-records 🔴

**Where:** your domain registrar (Loopia / Cloudflare / Namecheap).
**How:** point each at your VPS public IPv4 (`curl -4 ifconfig.me` on VPS).

| Host                   | Value      |
| ---------------------- | ---------- |
| `peptivalab.se`        | `<VPS_IP>` |
| `www.peptivalab.se`    | `<VPS_IP>` |
| `chat.peptivalab.se`   | `<VPS_IP>` |
| `db.peptivalab.se`     | `<VPS_IP>` |

If on Cloudflare → **DNS-only (grey cloud)** until Let's Encrypt issues certs.

---

## 2. Postgres / Supabase core 🔴

In `self-host/.env`:

| Var | How to generate / get |
| --- | --- |
| `POSTGRES_PASSWORD` | `openssl rand -base64 24` |
| `JWT_SECRET` | `openssl rand -hex 32` (≥32 chars) |
| `ANON_KEY` | https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys — paste `JWT_SECRET`, copy the `anon` JWT |
| `SERVICE_ROLE_KEY` | same page, copy the `service_role` JWT |
| `DASHBOARD_USERNAME` | free choice, e.g. `supabase` |
| `DASHBOARD_PASSWORD` | `openssl rand -base64 18` |
| `PUBLIC_SUPABASE_URL` | `https://db.peptivalab.se` (must match `STUDIO_DOMAIN`) |

**Verify:** `JWT_SECRET` is the *exact* value you pasted into the JWT
generator — Auth, PostgREST, Realtime, Storage all reject mismatches.

---

## 3. Admin authentication 🔴

| Var | How |
| --- | --- |
| `ADMIN_SESSION_SECRET` | `openssl rand -hex 32` — signs HttpOnly session cookies. **Required** or login is insecure. |
| `ADMIN_PASSWORD_HASH` | 🟡 Log in once with `ADMIN_CHAT_PASSWORD`, go to `/admin/sakerhet` → "Generera lösenordshash", paste a strong password, copy the resulting `$2b$…` hash here. After this you can delete `ADMIN_CHAT_PASSWORD`. |
| `ADMIN_CHAT_PASSWORD` | `openssl rand -base64 18` — legacy plaintext fallback, used until you set `ADMIN_PASSWORD_HASH`. |

### Admin 2FA (TOTP) 🟡

| Var | How |
| --- | --- |
| `ADMIN_TOTP_SECRET` | Log in, open `/admin/sakerhet` → "Generera 2FA". Scan the QR with Aegis / 1Password / Google Authenticator. Paste the Base32 secret here, restart `app`. |
| `ADMIN_TOTP_ISSUER` | Display name in the authenticator app (default `PeptivaLab`). |
| `ADMIN_TOTP_ACCOUNT` | Account label (default `admin`). |

---

## 4. IRC / chat stack 🔴

| Var | How |
| --- | --- |
| `IRC_OPER_PASSWORD` | `openssl rand -hex 24` |
| `IRC_SERVER_PASSWORD` | `openssl rand -hex 24` |
| `GATEWAY_TOKEN` | `openssl rand -hex 24` — shared secret between app ↔ ws-gateway |
| `IRC_BOT_NICK` | free, default `pvl-bot` |
| `IRC_CHANNEL_PREFIX` | free, default `#pvl-` |

Open port **6697/tcp** in UFW only if you want HexChat / mIRC clients to
connect. The in-browser widget works without it.

---

## 5. Email (contact form + backup alerts) 🟡

Leave `SMTP_HOST` empty to disable email entirely (contact form still saves;
backup failures only log). To enable, pick **one** SMTP provider:

| Provider | `SMTP_HOST` | `SMTP_PORT` | Where to get user/pass |
| --- | --- | --- | --- |
| **Brevo** (recommended, free tier) | `smtp-relay.brevo.com` | `587` | brevo.com → SMTP & API → SMTP key |
| **Postmark** | `smtp.postmarkapp.com` | `587` | server → API tokens |
| **Mailgun** | `smtp.eu.mailgun.org` | `587` | domain → SMTP credentials |
| **Gmail** (low volume only) | `smtp.gmail.com` | `587` | Google account → App Passwords |
| **Fastmail** | `smtp.fastmail.com` | `465` | settings → app passwords |

Then fill:

| Var | Value |
| --- | --- |
| `SMTP_HOST` | from table above |
| `SMTP_PORT` | from table above |
| `SMTP_SECURE` | leave empty (auto: `true` for 465, STARTTLS for 587) |
| `SMTP_USER` | provider username / API key id |
| `SMTP_PASS` | provider password / API secret |
| `NOTIFY_EMAIL_FROM` | `PeptivaLab <noreply@peptivalab.se>` — must be a domain you've verified at the SMTP provider, otherwise SPF/DKIM fail and mail goes to spam |
| `NOTIFY_EMAIL_TO` | **your real address.** Comma-separate for multiple. Read fresh each send — change any time, just `docker compose up -d app backup`. |
| `INTERNAL_NOTIFY_TOKEN` | `openssl rand -hex 32` — lets the backup container POST to `/api/internal/notify` |

Email subjects/bodies are editable at `/admin/innehall → Mailmallar` — no
env vars, no redeploy.

### DNS for deliverability 🟡

At your registrar (or your SMTP provider's DNS wizard), add:

- **SPF** TXT on `peptivalab.se`: `v=spf1 include:<provider's spf domain> ~all`
- **DKIM** CNAME(s) the provider gives you
- **DMARC** TXT on `_dmarc.peptivalab.se`: `v=DMARC1; p=none; rua=mailto:admin@peptivalab.se`

Without these, expect ~50 % of mail to land in spam.

---

## 6. Backups 🔴 (encrypted) + 🟡 (off-site)

| Var | How |
| --- | --- |
| `BACKUP_CRON` | default `17 3 * * *` (daily 03:17 UTC). |
| `BACKUP_RETENTION_DAYS` | default `14`. |
| `BACKUP_ENCRYPTION_KEY_ID` | short label, start with `k1`. |
| `BACKUP_ENCRYPTION_PASSPHRASE` | `openssl rand -base64 48` — **store in password manager off the server**, otherwise dumps are unrecoverable. |
| `BACKUP_OLD_KEYS` | empty initially. After a key rotation: `k0:old_passphrase`. |
| `BACKUP_VERIFY_CRON` | default `43 4 * * 0` (Sundays 04:43 UTC). Restores latest dump into a throwaway DB. |
| `OFFSITE_REMOTE` | 🟡 e.g. `b2:peptivalab-backups`. **Without this a fire / disk loss = total data loss.** |
| `RCLONE_CONFIG` | run `rclone config` locally, paste the resulting INI block (multiline). |

**Recommended off-site target: Backblaze B2** (cheap, S3-compatible, EU
region available).
1. backblaze.com → sign up → create bucket `peptivalab-backups` (private).
2. App keys → "Add a New Application Key" scoped to that bucket.
3. Locally: `rclone config` → new remote `b2` → paste keyID + applicationKey.
4. Copy the `[b2]` block from `~/.config/rclone/rclone.conf` into `RCLONE_CONFIG`.

---

## 7. Caddy / TLS 🔴

| Var | How |
| --- | --- |
| `LETSENCRYPT_EMAIL` | a real address — Let's Encrypt sends expiry warnings here |
| `SITE_DOMAIN`, `WWW_DOMAIN`, `CHAT_DOMAIN`, `STUDIO_DOMAIN` | match the four A-records in section 1 |

UFW: open `22, 80, 443, 6697`. Block everything else (Postgres, Kong,
Realtime, Auth, app, ws-gateway are all internal to the docker network).

---

## 8. Analytics 🟢

| Var | How |
| --- | --- |
| `VITE_PLAUSIBLE_DOMAIN` | your Plausible site domain, e.g. `peptivalab.se`. Empty = no analytics. **Build-time** — rebuild app container after change: `docker compose build app && docker compose up -d app`. |
| `VITE_PLAUSIBLE_SRC` | only if you self-host Plausible. |

---

## 9. Sitemap / SEO 🟡

| Var | Value |
| --- | --- |
| `PUBLIC_SITE_URL` | `https://peptivalab.se` — used by `/sitemap.xml` and `/robots.txt`. |

After cutover, submit the sitemap to Google Search Console (one-time).

---

## 10. Uptime monitoring 🟡

Free, no env vars to set:

1. Sign up at **uptimerobot.com** (or self-host **Uptime Kuma** on a second
   tiny VPS).
2. Add HTTP(s) monitor:
   - URL: `https://peptivalab.se/api/public/health`
   - Interval: 5 min
   - Alert contact: your email / SMS
3. Add a second monitor for `https://db.peptivalab.se` (Studio reachability).

See `UPTIME-MONITORING.md` for details.

---

## 11. Auto-deploy (GitHub → VPS) 🟢

In **GitHub repo → Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `VPS_HOST` | your IP or `peptivalab.se` |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | private key from `/home/deploy/.ssh/id_ed25519` (generate with `ssh-keygen -t ed25519`) |
| `VPS_PATH` | `/home/deploy/peptivalab` |

Then: `cp self-host/deploy.example.yml .github/workflows/deploy.yml`, push.

---

## 12. Cutover from previous host 🟡 (only if migrating)

1. Export the previous database as `dump.sql`.
2. SCP up: `scp dump.sql deploy@<VPS_IP>:~/peptivalab/self-host/initdb/01-import.sql`.
3. First boot auto-imports it after `00-schema.sql`.
4. After smoke tests pass: decommission the previous deployment.

---

## Final pre-flight

```bash
cd ~/peptivalab/self-host
chmod 600 .env
grep CHANGEME .env        # must return nothing
docker compose config -q  # must exit 0
docker compose up -d
docker compose ps         # everything Up / healthy within ~2 min
```

Then run the 5 smoke tests in `GO-LIVE-CHECKLIST.md → §10`.

---

## Quick "is X wired up?" checklist

- [ ] DNS resolves for all 4 hosts
- [ ] `JWT_SECRET` matches the keys it generated
- [ ] `ADMIN_SESSION_SECRET` set (≥32 chars)
- [ ] `ADMIN_PASSWORD_HASH` set (delete `ADMIN_CHAT_PASSWORD` after)
- [ ] `ADMIN_TOTP_SECRET` set + tested with authenticator app
- [ ] `GATEWAY_TOKEN` identical in app + ws-gateway env
- [ ] SMTP test: submit `/kontakt` form → email arrives at `NOTIFY_EMAIL_TO`
- [ ] `BACKUP_ENCRYPTION_PASSPHRASE` saved off-server
- [ ] `OFFSITE_REMOTE` configured + first sync verified (`docker compose exec backup ls /backups`)
- [ ] UptimeRobot monitor green
- [ ] Caddy issued certs for all 4 domains
- [ ] UFW: only 22/80/443/6697 open
- [ ] Cron: `crontab -l` (or `/etc/cron.d/`) shows the backup job
- [ ] Restore drill: `docker compose exec backup verify-latest.sh` passes
