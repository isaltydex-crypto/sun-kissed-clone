# Troubleshooting scripts

All diagnostic and troubleshooting scripts for the self-hosted stack live in this folder.

**Rule:** every new troubleshooting script goes here AND gets an entry in this README.

---

## How to pull & run on the VPS

```bash
cd /home/deploy/sun-kissed-clone
git pull
chmod +x self-host/troubleshoot/*.sh
cd self-host
bash troubleshoot/<script-name>.sh
```

Always run from the `self-host/` directory unless a script says otherwise — the scripts read `.env` and call `docker compose` from there.

---

## Available scripts

### `check-web-access.sh`
**Use when:** the site doesn't load in a browser (timeout, connection refused, cert warning, ERR_CONNECTION_*).

**What it does:**
- Reads `SITE_DOMAIN` from `.env`
- Greps Caddy logs for cert / ACME / error lines
- Lists what's bound to ports 80 and 443
- Shows processes holding port 80 (catches stray nginx/apache)
- Shows UFW firewall status
- Shows `docker compose ps` for all containers
- Probes the site over HTTPS and HTTP from inside the VPS
- Prints the VPS public IP so you can compare it to your DNS A records

**Typical fixes it points to:** UFW blocking 80/443, another web server holding port 80, Let's Encrypt failing because DNS doesn't match the public IP.

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
2. Start it with `#!/usr/bin/env bash` and `set -u`
3. Make it idempotent — safe to run multiple times
4. Add a section to this README with:
   - **Use when:** the symptom that calls for it
   - **What it does:** bullet list of the actual checks
   - Any fixes it suggests or auto-applies
5. `chmod +x` the script

Keep the "Available scripts" list alphabetical so it stays easy to scan.
