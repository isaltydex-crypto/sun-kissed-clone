# Troubleshooting scripts

All diagnostic and troubleshooting scripts for the self-hosted stack live in this folder.

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
