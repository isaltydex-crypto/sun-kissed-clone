# peptivaLab — Go-Live Checklist

Step-by-step instructions for putting the site live on your own server.
Work through it **top to bottom — don't skip ahead.**

**Time needed:** 45–90 minutes of work, plus 5–30 min waiting for DNS.

This file answers: **"In what order do I do things?"**
Its sister file `WIRE-UP-TODO.md` answers: **"What goes in `.env` and where do I get it?"**
Keep both open.

---

## 0. Before you start — what you'll need

- [ ] A VPS (virtual server) with **Ubuntu 22.04 or newer**
      (Hetzner, DigitalOcean, Linode, OVH all work — see `README.md` for sizing)
- [ ] You can SSH into it as a normal user with `sudo` rights (don't use root)
- [ ] You own the domain `peptivalabgroup.com` and can edit its DNS
- [ ] An email address you actually check (for SSL cert warnings)
- [ ] A local clone of this repo on your laptop, pushed to your own GitHub

> Open `WIRE-UP-TODO.md` in another tab and a password manager note —
> you'll generate ~12 secrets and need somewhere safe to keep them.

---

## 1. Point your domain at the server (DNS)

**1.1.** SSH into your VPS and find its public IP:
```bash
curl -4 ifconfig.me
```
Write the number down (e.g. `203.0.113.42`).

**1.2.** Log into your domain registrar (Loopia, Cloudflare, Namecheap, …).
Add **four A-records** — all pointing to that IP, all with TTL `300`:

| Subdomain                 | Type | Points to    |
| ------------------------- | ---- | ------------ |
| `peptivalabgroup.com`           | A    | your VPS IP  |
| `www.peptivalabgroup.com`       | A    | your VPS IP  |
| `chat.peptivalabgroup.com`      | A    | your VPS IP  |
| `db.peptivalabgroup.com`        | A    | your VPS IP  |

> **On Cloudflare?** Click each record → set proxy to **"DNS only" (grey
> cloud)** for now. You can switch to orange later, after SSL certs are issued.

**1.3.** Wait 5–30 minutes, then verify from your laptop:
```bash
dig +short peptivalabgroup.com
dig +short www.peptivalabgroup.com
dig +short chat.peptivalabgroup.com
dig +short db.peptivalabgroup.com
```
All four **must** print your VPS IP. **Don't continue** until they do.

- [ ] All 4 DNS records resolve to the VPS IP

---

## 2. Prep the VPS

SSH back into the server and run:

```bash
# Update the system
sudo apt update && sudo apt -y upgrade

# Install Docker + the compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker compose version    # should print v2.x.x

# Install git
sudo apt -y install git
```

- [ ] `docker compose version` works without `sudo`

---

## 3. Lock down the firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp        # SSH (so you don't lock yourself out!)
sudo ufw allow 80/tcp        # HTTP — needed for SSL cert renewal
sudo ufw allow 443/tcp       # HTTPS — the website
sudo ufw allow 6697/tcp      # IRC over TLS (only if you use HexChat/mIRC)
sudo ufw enable
sudo ufw status              # double-check the rules
```

> **Do NOT open** ports 5432 (Postgres), 8000 (Kong), 3000 (app), 4000
> (Realtime), 9999 (Auth), 8080 (ws-gateway). They live inside Docker and
> must stay private.

> **Skipping IRC desktop clients?** Leave 6697 closed. The chat widget on
> the website still works because it tunnels through 443.

- [ ] Firewall active, only ports 22 / 80 / 443 / 6697 open

---

## 4. Pull the code onto the VPS

It's safer to use a dedicated `deploy` user instead of working as root:

```bash
sudo adduser deploy                      # create a new user
sudo usermod -aG docker deploy           # give it Docker access
sudo su - deploy                         # switch to it

git clone https://github.com/<YOU>/peptivalab.git
cd peptivalab
ls self-host/                            # confirm the folder exists
```

- [ ] Repo cloned into `/home/deploy/peptivalab`

---

## 5. Patch the build for self-hosting

The default build targets Cloudflare Workers. Switch it to a regular Node
build:

```bash
cd ~/peptivalab
./self-host/apply-patch.sh
```

You should see: `✔ self-host build patch applied.`

> Need to undo this later? Run `./self-host/revert-patch.sh`.

- [ ] Patch script ran successfully

---

## 6. Generate all your secrets

You'll paste each one into `self-host/.env` in the next step. Generate them
now and **save every value in a password manager** before pasting:

```bash
# JWT signing key — used by Auth, the API, Realtime AND Storage (must match!)
openssl rand -hex 32

# Postgres database password
openssl rand -base64 24

# Supabase Studio (web UI) password
openssl rand -base64 18

# IRC oper password, server password, and gateway token (run 3 times)
openssl rand -hex 24
openssl rand -hex 24
openssl rand -hex 24

# Admin panel password (temporary — you'll replace with a hash later)
openssl rand -base64 18

# Admin session signing secret
openssl rand -hex 32

# Backup encryption passphrase
openssl rand -base64 48
```

**Then generate the two API keys** from your `JWT_SECRET`:

1. Open <https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys>
2. Paste your `JWT_SECRET` into both fields.
3. Copy the **anon** JWT → that's `ANON_KEY`.
4. Copy the **service_role** JWT → that's `SERVICE_ROLE_KEY`.

- [ ] All 11 secrets saved in your password manager

---

## 7. Fill in `.env`

```bash
cd ~/peptivalab/self-host
cp .env.example .env
nano .env
```

Replace **every** `CHANGEME_*` with one of the values you generated above.
For details on each variable, read **`WIRE-UP-TODO.md`** alongside this file.

Key things to double-check:

- [ ] `SITE_DOMAIN`, `WWW_DOMAIN`, `CHAT_DOMAIN`, `STUDIO_DOMAIN` match your DNS
- [ ] `LETSENCRYPT_EMAIL` is a real address you check
- [ ] `JWT_SECRET` is the **exact** value you used to generate the keys
- [ ] `PUBLIC_SUPABASE_URL=https://db.peptivalabgroup.com`
- [ ] `IRC_BOT_PASSWORD` (in app env) = `GATEWAY_TOKEN` (in ws-gateway env)

Tighten file permissions so only you can read it:

```bash
chmod 600 .env
grep CHANGEME .env       # MUST return nothing
```

- [ ] `.env` filled, no `CHANGEME` strings remain

---

## 8. (Optional) Import data from a previous host

Skip this section if starting fresh.

1. Export the old database to a file called `dump.sql`.
2. Upload it to the VPS:
   ```bash
   scp dump.sql deploy@<VPS_IP>:~/peptivalab/self-host/initdb/01-import.sql
   ```
3. Postgres will auto-load it on first boot, after the schema setup.

- [ ] Either skipping (fresh start), OR `01-import.sql` is in `self-host/initdb/`

---

## 9. First boot

```bash
cd ~/peptivalab/self-host
docker compose up -d
docker compose ps                       # all should be Up / healthy in ~2 min
docker compose logs -f caddy            # watch SSL certs being issued
```

You're looking for `certificate obtained successfully` for each of the four
domains. Press **Ctrl-C** once you see them.

**If Caddy is stuck retrying:**
- DNS hasn't propagated yet → wait, check with `dig` again
- Port 80 blocked → check UFW *and* your VPS provider's separate firewall
- Cloudflare proxy is on → switch back to DNS-only (grey cloud)

- [ ] All services show `Up` or `healthy`
- [ ] Caddy issued certs for all 4 domains

---

## 10. Smoke tests — try everything from your laptop

**Test 1 — The website**
- [ ] Open <https://peptivalabgroup.com> — page loads, padlock is green
- [ ] Visit `/produkter`, `/kontakt`, `/faq` — no errors
- [ ] Open browser DevTools → Network tab → reload — no failed requests

**Test 2 — Admin panel**
- [ ] Open <https://peptivalabgroup.com/admin/login>
- [ ] Login with `ADMIN_CHAT_PASSWORD` works
- [ ] `/admin/produkter`, `/admin/innehall`, `/admin/sidor` all load
- [ ] Edit a page, save, reload → change persisted

**Test 3 — Live chat** (open a private window so you're not logged in)
- [ ] Chat widget appears, you can type
- [ ] Send a message
- [ ] In the admin window, message appears in `/admin/chatt`
- [ ] Reply from admin → visitor window updates in real time

**Test 4 — Database admin (Studio)**
- [ ] Open <https://db.peptivalabgroup.com>
- [ ] Login prompt accepts `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`
- [ ] Studio loads; you can browse the tables

**Test 5 — IRC desktop client (only if you opened port 6697)**
- [ ] Connect HexChat to `chat.peptivalabgroup.com:6697`, password = `IRC_SERVER_PASSWORD`
- [ ] `/oper admin <IRC_OPER_PASSWORD>` succeeds

> Anything fails? Check the matching log:
> `docker compose logs <service-name>` (e.g. `app`, `auth`, `realtime`, `kong`).

---

## 11. Lock down the admin login (replace plaintext password)

Now that you can log in, swap the temporary password for a hashed one:

1. Visit <https://peptivalabgroup.com/admin/sakerhet>
2. Click **"Generera lösenordshash"**
3. Type a strong password you'll remember
4. Copy the long `$2b$…` string it produces
5. Paste it into `ADMIN_PASSWORD_HASH=` in `.env`
6. **Delete** the `ADMIN_CHAT_PASSWORD=` line
7. Restart the app: `docker compose up -d app`

While you're there, set up 2FA — see `WIRE-UP-TODO.md → §3`.

- [ ] `ADMIN_PASSWORD_HASH` set, `ADMIN_CHAT_PASSWORD` removed
- [ ] 2FA tested with authenticator app

---

## 12. Auto-deploy on git push (optional)

Detailed steps in `WIRE-UP-TODO.md → §11`. Quick version:

```bash
# On the VPS:
sudo -u deploy ssh-keygen -t ed25519 -f /home/deploy/.ssh/id_ed25519 -N ""
sudo -u deploy bash -c "cat /home/deploy/.ssh/id_ed25519.pub >> /home/deploy/.ssh/authorized_keys"
sudo cat /home/deploy/.ssh/id_ed25519     # copy → paste into GitHub secret VPS_SSH_KEY
```

Then in **GitHub repo → Settings → Secrets and variables → Actions** add
`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PATH`. Activate the workflow:

```bash
mkdir -p .github/workflows
cp self-host/deploy.example.yml .github/workflows/deploy.yml
git add .github && git commit -m "ci: auto-deploy" && git push
```

- [ ] First GitHub Actions run is green
- [ ] `docker compose logs -f app` on the VPS shows the redeploy

---

## 13. Backups — do this **today**, not "later"

A daily DB dump kept for 14 days:

```bash
mkdir -p /home/deploy/backups
sudo tee /etc/cron.d/peptivalab-backup >/dev/null <<'CRON'
0 3 * * * deploy cd /home/deploy/peptivalab/self-host && \
  docker compose exec -T db pg_dump -U postgres postgres | \
  gzip > /home/deploy/backups/db-$(date +\%F).sql.gz && \
  find /home/deploy/backups -name 'db-*.sql.gz' -mtime +14 -delete
CRON
```

Then add an **off-server** copy. Pick one:

- 🟢 **Backblaze B2 via rclone** (recommended) — see `WIRE-UP-TODO.md → §6`
- 🟢 Hetzner snapshots (paid, weekly is fine)
- 🟢 Borg backup to a second VPS

- [ ] Cron job scheduled
- [ ] Off-server copy configured
- [ ] **Test restore** done at least once (simulate disaster recovery)

---

## 14. Post go-live cleanup

- [ ] Decommission the previous deployment (or just leave it dormant)
- [ ] Remove old DNS records pointing to your previous host's IP
- [ ] Confirm email aliases (`hej@`, `admin@`) still work — DNS changes
      didn't touch MX records, but verify anyway
- [ ] All secrets safely stored in your password manager
- [ ] VPS provider, server IP, and recovery steps documented somewhere
      your future self can find

---

## Day-2 quick reference

```bash
# Update everything to latest images
docker compose pull && docker compose up -d

# Tail one service's logs
docker compose logs -f app

# Restart just the app after a code change
docker compose build app && docker compose up -d app

# Manual backup (to local file)
docker compose exec -T db pg_dump -U postgres postgres > backup.sql

# Stop everything (data preserved)
docker compose down

# Stop AND DELETE all data (DANGEROUS)
docker compose down -v
```

---

## Rollback plan — if go-live goes badly

You can flip back to your previous host in under 5 minutes:

1. At your registrar, point the four A-records back to the old host's IP.
2. Re-enable the previous deployment.
3. Wait for DNS to propagate (5–30 min).
4. Investigate the VPS at your leisure — it stays running, just with no traffic.

> The previous database is unchanged (the migration was a one-way *copy*,
> not a move). Anything written to the VPS DB after cutover is lost on
> rollback, though.
