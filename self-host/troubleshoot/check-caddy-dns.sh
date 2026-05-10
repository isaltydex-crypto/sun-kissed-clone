#!/usr/bin/env bash
# Diagnose why Caddy returns 502 with "lookup app on 127.0.0.11:53: no such host".
# Inspects the docker network from Caddy's perspective and tests DNS + TCP to `app`.
set -u
. "$(dirname "$0")/_lib.sh"

PROJECT="$(basename "$PWD")"
NET="${PROJECT}_pvl"

hdr "1. networks attached to caddy and app"
echo "--- caddy networks ---"
docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} aliases={{$v.Aliases}}{{"\n"}}{{end}}' "${PROJECT}-caddy-1" || true
echo "--- app networks ---"
docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} aliases={{$v.Aliases}} ip={{$v.IPAddress}}{{"\n"}}{{end}}' "${PROJECT}-app-1" || true

if docker inspect "${PROJECT}-caddy-1" -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null | grep -qw "$NET" \
   && docker inspect "${PROJECT}-app-1" -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null | grep -qw "$NET"; then
  ok "caddy and app share network $NET"
else
  fail "caddy and app are NOT on the same network ($NET) — fix compose/recreate"
fi

hdr "2. containers on $NET"
docker network inspect "$NET" --format '{{range .Containers}}{{.Name}}  {{.IPv4Address}}{{"\n"}}{{end}}' || true

hdr "3. DNS lookup of 'app' from inside caddy"
if docker exec "${PROJECT}-caddy-1" sh -c 'getent hosts app || nslookup app 127.0.0.11 || true' 2>&1 | tee /dev/stderr | grep -qE '^[0-9]'; then
  ok "caddy can resolve 'app'"
else
  fail "caddy cannot resolve 'app' via Docker DNS (127.0.0.11)"
fi

hdr "4. TCP reach app:3000 from inside caddy"
if docker exec "${PROJECT}-caddy-1" sh -c 'wget -qO- --timeout=3 http://app:3000/ >/dev/null 2>&1 && echo OK || (nc -zv app 3000 2>&1 || true)'; then
  ok "caddy reached app:3000"
else
  warn "caddy could not reach app:3000 (see log)"
fi

hdr "5. recent caddy errors mentioning 'app'"
docker compose logs --tail=200 caddy 2>&1 | grep -iE 'app|dial|lookup|no such host|upstream|502' || echo "(none)"

hdr "remediation hints"
cat <<'EOF'
If 'caddy and app are NOT on the same network' or DNS fails:
  1) Confirm both services declare:  networks: [pvl]
  2) Recreate cleanly so Caddy picks up the network alias:
       docker compose up -d --force-recreate caddy app
  3) If the project name differs (compose was run from another folder),
     containers will be on <other-project>_pvl. Always run compose from
     the same directory (self-host/).
EOF
