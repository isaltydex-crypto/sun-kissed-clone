# peptivaLab — Self-Hosting Kit

Run the **entire stack** on your private server, no Lovable Cloud required:

- **app** — TanStack Start app as a Node container (replaces Lovable hosting)
- **supabase** — full self-hosted Supabase stack (Postgres + Auth + Storage + Realtime + Studio)
- **ircd + ws-gateway** — your existing IRC server (re-used from `../irc-server/`)
- **caddy** — single TLS reverse proxy in front of all of it (auto Let's Encrypt)

Everything lives in one `docker compose` on the same box.

---

## 0. One-time prep on the server

Ubuntu 22.04+ recommended, 4 GB RAM minimum (8 GB if you expect traffic).

```bash
# Install Docker + compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# Open firewall
sudo ufw allow 80,443,6697/tcp
```

DNS records (point at this server's public IP):

| Host                       | Type | Purpose                       |
| -------------------------- | ---- | ----------------------------- |
| `peptivalab.se`            | A    | website                       |
| `www.peptivalab.se`        | A    | website                       |
| `chat.peptivalab.se`       | A    | IRC ws-gateway                |
| `db.peptivalab.se`         | A    | Supabase Studio (admin only)  |

---

## 1. Get the source onto the server

From the Lovable project: **Settings → GitHub → Connect** (or use the
"Export to GitHub" button), then:

```bash
git clone git@github.com:<you>/peptivalab.git
cd peptivalab
```

The `self-host/` and `irc-server/` folders are already in the repo.

---

## 2. Apply the self-host build patch

This swaps the Vite config from Cloudflare Workers (Lovable's default) to
a plain Node SSR target. The patch only touches `vite.config.ts` and
`package.json` — it does NOT change any application code.

```bash
cd self-host
./apply-patch.sh        # applies build-target.patch in the repo root
cd ..
bun install             # or: npm install
```

You can revert with `./self-host/revert-patch.sh` if you ever go back to Lovable.

---

## 3. Configure secrets

```bash
cd self-host
cp .env.example .env
```

Edit `.env` and set strong values for **every** field marked `CHANGEME`:

- `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY`,
  `DASHBOARD_PASSWORD` — Supabase
- `IRC_OPER_PASSWORD`, `IRC_SERVER_PASSWORD`, `GATEWAY_TOKEN` — IRC stack
- `ADMIN_CHAT_PASSWORD` — `/admin` login
- `LETSENCRYPT_EMAIL`, `SITE_DOMAIN`, `CHAT_DOMAIN`, `STUDIO_DOMAIN`

Generate keys quickly:

```bash
openssl rand -hex 32          # JWT_SECRET, GATEWAY_TOKEN, etc.
openssl rand -base64 24       # passwords
```

For the Supabase `ANON_KEY` and `SERVICE_ROLE_KEY` use the JWT generator at
<https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys>
(paste your `JWT_SECRET`, copy the two tokens).

---

## 4. (Only if migrating data) Export from Lovable Cloud

Skip this if starting clean.

In Lovable: **Cloud → Database → Export** → download `dump.sql`.
Drop it next to the compose file:

```bash
mv ~/Downloads/dump.sql self-host/initdb/01-import.sql
```

It will be auto-loaded on first Postgres start.

---

## 5. Bring it up

```bash
cd self-host
docker compose up -d
docker compose logs -f app   # watch for "ready"
```

First boot takes ~2 minutes (Caddy gets TLS certs from Let's Encrypt).

Verify:

- <https://peptivalab.se> → website
- <https://chat.peptivalab.se> → IRC ws-gateway (returns "426 Upgrade")
- <https://db.peptivalab.se> → Supabase Studio (login: `supabase` / `DASHBOARD_PASSWORD`)
- HexChat → `chat.peptivalab.se:6697`, PASS = `IRC_SERVER_PASSWORD`

---

## 6. Cut DNS over

Once you've smoke-tested:

1. In Lovable → unpublish (or just leave the `*.lovable.app` URL dormant).
2. Update DNS: change `peptivalab.se` A record from `185.158.133.1`
   (Lovable) → your server's IP.
3. Wait for propagation, watch `docker compose logs caddy` for the cert.

Done — the site, database, auth, storage, realtime and IRC all run on
your box. Lovable is no longer in the request path.

---

## Day-2 ops

```bash
docker compose pull && docker compose up -d   # update images
docker compose logs -f app                    # tail app
docker compose exec db pg_dump -U postgres postgres > backup.sql
docker compose down                           # stop everything
```

### Re-deploying after code changes

You'll edit code in Lovable (or locally), `git push`, then on the server:

```bash
cd peptivalab
git pull
cd self-host
docker compose build app
docker compose up -d app
```

(Or wire a GitHub Action to do this on push — see `self-host/deploy.example.yml`.)

---

## Troubleshooting

| Symptom                                  | Check                                                     |
| ---------------------------------------- | --------------------------------------------------------- |
| Site loads but DB queries fail           | `SUPABASE_URL` in `.env` matches the internal compose name (`http://kong:8000`) for the **app**, not the public URL |
| Realtime chat doesn't update             | `docker compose logs realtime` — needs `JWT_SECRET` to match across all services |
| Caddy keeps retrying certs               | DNS not propagated yet, or port 80 blocked                |
| IRC bridge says "auth failed"            | `GATEWAY_TOKEN` (compose) != `IRC_BOT_PASSWORD` (app env) |
| Admin login fails                        | `ADMIN_CHAT_PASSWORD` not loaded — `docker compose restart app` |

Full Supabase self-host docs: <https://supabase.com/docs/guides/self-hosting/docker>

---

## Hosting requirements (read before you buy a server)

This stack does **not** run on shared/cPanel/Plesk hosting. You need a Linux
box where you have **root** and can run **Docker**.

### Minimum specs

| Resource | Minimum    | Recommended |
| -------- | ---------- | ----------- |
| CPU      | 2 vCPU     | 2–4 vCPU    |
| RAM      | 4 GB       | 8 GB        |
| Disk     | 40 GB SSD  | 80 GB SSD   |
| Network  | public IPv4, ports 80/443/6697 open |
| OS       | Ubuntu 22.04 / 24.04 LTS (Debian 12 also fine) |

The full stack (Postgres + 6 Supabase services + app + ircd + Caddy) idles at
~1.3 GB RAM. 4 GB leaves headroom for a small site; bump to 8 GB if you
expect real traffic or want to run backups concurrently.

### Tested providers (any will do)

| Provider     | Plan that fits          | ~Price/mo |
| ------------ | ----------------------- | --------- |
| Hetzner      | CX22 (2 vCPU / 4 GB)    | €4        |
| Hetzner      | CX32 (2 vCPU / 8 GB)    | €7        |
| Contabo      | VPS S                   | €5        |
| DigitalOcean | Basic 2 GB (tight)      | $12       |
| OVH          | VLE-2                   | €6        |
| Scaleway     | DEV1-S                  | €6        |

Pick one in the same region as your audience for lower latency.

### What WON'T work

- ❌ **cPanel / Plesk shared hosting** — no Docker, no root, no Postgres,
  no long-running Node, no port 6697.
- ❌ **"Node.js hosting"** plans on shared cPanel (Passenger) — kills
  WebSockets and restarts on idle.
- ❌ **Vercel / Netlify / Cloudflare Pages alone** — they host the frontend
  fine but can't run Postgres, GoTrue, IRC, etc. (You could split: frontend
  on Vercel + this stack on a VPS for the backend, but that's a different
  architecture than what's in this folder.)
- ❌ **Raspberry Pi at home** — works technically but Let's Encrypt + dynamic
  IP + residential ISPs blocking port 25/80 make it painful. Use a VPS.

### What DOES work

- ✅ Any KVM/cloud VPS with Ubuntu 22.04+ and root access.
- ✅ Bare-metal dedicated servers.
- ✅ Hetzner / Contabo / OVH / Scaleway / DigitalOcean / Linode / Vultr.
- ✅ Self-hosted Proxmox VM, as long as it has a public IP and the listed ports.

---

## Auto-deploy on `git push` (optional)

`self-host/deploy.example.yml` is a ready-to-use GitHub Actions workflow.

1. On the VPS:
   ```bash
   sudo adduser deploy
   sudo usermod -aG docker deploy
   sudo -u deploy ssh-keygen -t ed25519 -f /home/deploy/.ssh/id_ed25519 -N ""
   sudo -u deploy bash -c "cat /home/deploy/.ssh/id_ed25519.pub >> /home/deploy/.ssh/authorized_keys"
   ```
   Print the **private** key — you'll paste it into GitHub:
   ```bash
   sudo cat /home/deploy/.ssh/id_ed25519
   ```
2. Make sure the repo is checked out as the `deploy` user (e.g. in `/home/deploy/peptivalab`).
3. In GitHub → Repo → **Settings → Secrets and variables → Actions**, add:
   - `VPS_HOST` — server IP or hostname
   - `VPS_USER` — `deploy`
   - `VPS_SSH_KEY` — contents of the private key above
   - `VPS_PATH` — `/home/deploy/peptivalab`
4. Move the workflow into place:
   ```bash
   mkdir -p .github/workflows
   cp self-host/deploy.example.yml .github/workflows/deploy.yml
   git add .github && git commit -m "ci: auto-deploy to VPS" && git push
   ```

Every push to `main` will now SSH in, `git pull`, rebuild the `app` container,
and restart it. DB and IRC containers are left running.
