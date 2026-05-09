# peptivaLab — Self-Host Go-Live Checklist

Step-by-step checklist for taking the stack live on your VPS. Work top to
bottom; don't skip ahead. Estimated time end-to-end: **45–90 minutes** (plus
DNS propagation wait).

Companion to `self-host/README.md` — that file has the *what*, this file has
the *do this, then this, then this*.

---

## 0. Before you start

- [ ] VPS provisioned, Ubuntu 22.04+ (see `README.md → Hosting requirements`)
- [ ] You can SSH in as a sudo user (don't work as root)
- [ ] Domain registered and you control its DNS
- [ ] Email address ready for Let's Encrypt notifications
- [ ] Local clone of this repo (you'll push to GitHub from here)

---

## 1. DNS — point the domains at your VPS

Get your VPS public IPv4: `curl -4 ifconfig.me` (run on the VPS).

At your registrar (Loopia, Cloudflare, Namecheap, …), add **four A records**:

| Host                  | Type | Value           | TTL  |
| --------------------- | ---- | --------------- | ---- |
| `peptivalab.se`       | A    | `<VPS_IP>`      | 300  |
| `www.peptivalab.se`   | A    | `<VPS_IP>`      | 300  |
| `chat.peptivalab.se`  | A    | `<VPS_IP>`      | 300  |
| `db.peptivalab.se`    | A    | `<VPS_IP>`      | 300  |

If using **Cloudflare**, set proxy = **DNS only (grey cloud)** for now. You
can re-enable the orange cloud after Let's Encrypt has issued certs.

Verify propagation (give it 5–30 min):

```bash
dig +short peptivalab.se
dig +short www.peptivalab.se
dig +short chat.peptivalab.se
dig +short db.peptivalab.se
```

All four must return your VPS IP before continuing.

- [ ] All four A records resolve to the VPS IP

---

## 2. VPS prep

SSH in, then:

```bash
# System update
sudo apt update && sudo apt -y upgrade

# Docker + compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker compose version    # must print v2.x

# Git
sudo apt -y install git
```

- [ ] `docker compose version` works without sudo

---

## 3. Firewall (UFW)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # HTTP (Let's Encrypt + redirect to HTTPS)
sudo ufw allow 443/tcp       # HTTPS (site, chat ws, db studio)
sudo ufw allow 6697/tcp      # IRC over TLS (HexChat / mIRC clients)
sudo ufw enable
sudo ufw status              # confirm rules
```

**Do NOT open** 5432 (Postgres), 8000 (Kong), 3000 (app), 4000 (realtime),
9999 (auth), 8080 (ws-gateway), 6667 (plain IRC) — they're internal to the
docker network only.

If you skip the IRC client port: leave 6697 closed, the in-browser chat still
works (it goes via the ws-gateway over 443).

- [ ] UFW active, ports 22/80/443/6697 open, everything else denied

---

## 4. Get the code on the VPS

```bash
# As a deploy user (recommended over working in $HOME of root)
sudo adduser deploy
sudo usermod -aG docker deploy
sudo su - deploy

git clone https://github.com/<you>/peptivalab.git
cd peptivalab
```

- [ ] Repo cloned, you can `cd peptivalab && ls self-host/`

---

## 5. Apply the self-host build patch

```bash
cd ~/peptivalab
./self-host/apply-patch.sh
```

What this does: swaps `vite.config.ts` from the Cloudflare Workers target to
a Node SSR target, adds a `start` script to `package.json`. Reversible with
`./self-host/revert-patch.sh`.

- [ ] `apply-patch.sh` printed `✔ self-host build patch applied.`

---

## 6. Generate secrets

You'll fill these into `self-host/.env` in the next step. **Generate them
now** so you can paste later:

```bash
# JWT secret (used by Auth, PostgREST, Realtime, Storage — all must match)
openssl rand -hex 32 ; echo

# Postgres password
openssl rand -base64 24 ; echo

# Studio dashboard password
openssl rand -base64 18 ; echo

# IRC oper / server / gateway tokens (3 separate values)
openssl rand -hex 24 ; echo
openssl rand -hex 24 ; echo
openssl rand -hex 24 ; echo

# Admin panel password
openssl rand -base64 18 ; echo
```

Now generate the **Supabase ANON_KEY and SERVICE_ROLE_KEY** from your
`JWT_SECRET`:

1. Open <https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys>
2. Paste your `JWT_SECRET` into both fields
3. Copy the two JWT tokens it produces — those are `ANON_KEY` and `SERVICE_ROLE_KEY`

- [ ] All 9 secrets generated and saved somewhere (password manager, ideally)

---

## 7. Fill in `.env`

```bash
cd ~/peptivalab/self-host
cp .env.example .env
nano .env
```

Replace **every** `CHANGEME_*`. Double-check:

- [ ] `SITE_DOMAIN`, `WWW_DOMAIN`, `CHAT_DOMAIN`, `STUDIO_DOMAIN` match your DNS
- [ ] `LETSENCRYPT_EMAIL` is a real address you check
- [ ] `JWT_SECRET` is the same value used to generate `ANON_KEY` / `SERVICE_ROLE_KEY`
- [ ] `PUBLIC_SUPABASE_URL=https://db.peptivalab.se` (the public URL the browser hits)
- [ ] `IRC_BOT_PASSWORD` (in app env) matches `GATEWAY_TOKEN` — these are the same shared secret

Tighten file perms:

```bash
chmod 600 .env
```

- [ ] `.env` filled, no `CHANGEME` strings remain (`grep CHANGEME .env` returns nothing)

---

## 8. (Optional) Migrate data from Lovable Cloud

Skip if starting fresh.

1. In Lovable: **Cloud → Database → Export** → download `dump.sql`
2. SCP it up:
   ```bash
   scp dump.sql deploy@<VPS_IP>:~/peptivalab/self-host/initdb/01-import.sql
   ```
3. Postgres will auto-load it on first boot, after `00-schema.sql`.

- [ ] Either: starting fresh (skip), OR `01-import.sql` is in `self-host/initdb/`

---

## 9. First boot

```bash
cd ~/peptivalab/self-host
docker compose up -d
docker compose ps          # all should be "Up" or "healthy" within ~2 min
docker compose logs -f caddy   # watch for "certificate obtained successfully"
```

If Caddy is stuck retrying:
- DNS not propagated yet → wait, re-check with `dig`
- Port 80 blocked → check UFW + cloud provider's external firewall
- Cloudflare proxy on → switch to DNS-only

Press `Ctrl-C` once you see the cert success line for each domain.

- [ ] `docker compose ps` shows all services running
- [ ] Caddy obtained certs for `peptivalab.se`, `www.peptivalab.se`, `chat.peptivalab.se`, `db.peptivalab.se`

---

## 10. Smoke tests (do all four)

From your laptop, NOT the VPS:

1. **Website** — open <https://peptivalab.se>
   - [ ] Loads, padlock is green
   - [ ] Browse to /produkter, /kontakt, /faq — no errors
   - [ ] Open browser DevTools → Network tab → reload → no failed `/rest/v1/...` or `/auth/v1/...` requests

2. **Admin panel** — open <https://peptivalab.se/admin/login>
   - [ ] Login with `ADMIN_CHAT_PASSWORD` works
   - [ ] /admin/produkter, /admin/innehall, /admin/sidor load without errors
   - [ ] Edit a page, save → reload, change persisted

3. **Live chat** — open <https://peptivalab.se> in a private window
   - [ ] Chat widget opens
   - [ ] Send a message
   - [ ] In the original (admin) window, message appears in /admin/chatt
   - [ ] Reply from admin → visitor window updates in real time

4. **Supabase Studio** — open <https://db.peptivalab.se>
   - [ ] Basic-auth prompt accepts `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`
   - [ ] Studio loads, can browse `chat_channels`, `chat_messages`, `site_pages`, `site_content`

5. **(If port 6697 open) IRC client**
   - [ ] HexChat → `chat.peptivalab.se:6697`, PASS = `IRC_SERVER_PASSWORD`, connects
   - [ ] `/oper admin <IRC_OPER_PASSWORD>` succeeds

If anything fails, check `docker compose logs <service>` (e.g. `app`, `auth`,
`realtime`, `kong`).

---

## 11. Set up auto-deploy (optional, recommended)

Follows `self-host/README.md → Auto-deploy on git push`. Quick version:

```bash
# On the VPS as root:
sudo -u deploy ssh-keygen -t ed25519 -f /home/deploy/.ssh/id_ed25519 -N ""
sudo -u deploy bash -c "cat /home/deploy/.ssh/id_ed25519.pub >> /home/deploy/.ssh/authorized_keys"
sudo cat /home/deploy/.ssh/id_ed25519     # copy this — paste into GitHub secret
```

In GitHub → repo → **Settings → Secrets and variables → Actions**:

- [ ] `VPS_HOST` = your IP or `peptivalab.se`
- [ ] `VPS_USER` = `deploy`
- [ ] `VPS_SSH_KEY` = the private key from above
- [ ] `VPS_PATH` = `/home/deploy/peptivalab`

Then:

```bash
mkdir -p .github/workflows
cp self-host/deploy.example.yml .github/workflows/deploy.yml
git add .github && git commit -m "ci: auto-deploy" && git push
```

- [ ] GitHub Action ran green on push
- [ ] Tail on VPS: `cd ~/peptivalab/self-host && docker compose logs -f app` shows the redeploy

---

## 12. Backups (do this same day, not "later")

Quick start — daily DB dump kept for 14 days:

```bash
sudo tee /etc/cron.d/peptivalab-backup >/dev/null <<'CRON'
0 3 * * * deploy cd /home/deploy/peptivalab/self-host && \
  docker compose exec -T db pg_dump -U postgres postgres | \
  gzip > /home/deploy/backups/db-$(date +\%F).sql.gz && \
  find /home/deploy/backups -name 'db-*.sql.gz' -mtime +14 -delete
CRON
mkdir -p /home/deploy/backups
```

Now do an off-server copy. Pick one:

- `rclone` to S3 / Backblaze B2 / Hetzner Storage Box
- Hetzner snapshots (paid, weekly is fine)
- `borg` to a second VPS

- [ ] Cron job created
- [ ] Off-server destination configured and tested (run a manual restore drill)

---

## 13. Post-go-live cleanup

- [ ] Lovable project: **Settings → Visibility → Unpublish** (or just leave the `*.lovable.app` dormant)
- [ ] Old DNS records pointing to Lovable's IP (`185.158.133.1`) removed
- [ ] Email aliases (`hej@`, `admin@`) still work — go-live didn't touch MX records (verify anyway)
- [ ] Save `.env` and the JWT generator inputs in your password manager
- [ ] Document the VPS provider, IP, root password recovery steps somewhere your future-self can find

---

## Day-2 quick reference

```bash
# Update images
docker compose pull && docker compose up -d

# Tail one service
docker compose logs -f app

# Restart just the app after a manual code change
docker compose build app && docker compose up -d app

# Backup now
docker compose exec -T db pg_dump -U postgres postgres > backup.sql

# Stop everything
docker compose down

# Stop + wipe data (DANGEROUS — deletes the database)
docker compose down -v
```

---

## Rollback (if go-live goes wrong)

You can flip back to Lovable in <5 minutes:

1. At your registrar, change the four A records back to `185.158.133.1` (Lovable).
2. In Lovable, **republish** the project.
3. Wait for DNS to propagate.
4. Investigate the VPS at your leisure — it stays running, just no traffic.

The data on Lovable Cloud is unchanged (the migration was a one-way *copy*,
not a move). You only lose anything written to the VPS DB after cutover.
