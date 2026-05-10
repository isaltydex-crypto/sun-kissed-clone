#!/usr/bin/env bash
# Diagnose why Caddy returns 502 with "lookup app on 127.0.0.11:53: no such host".
# Inspects the docker network from Caddy's perspective and tests DNS + TCP to `app`.
set -u
. "$(dirname "$0")/_lib.sh"

# Resolve actual container IDs via compose (works regardless of project name)
CADDY_CID="$(docker compose ps -q caddy 2>/dev/null)"
APP_CID="$(docker compose ps -q app 2>/dev/null)"

if [ -z "$CADDY_CID" ] || [ -z "$APP_CID" ]; then
  fail "could not find caddy/app containers via 'docker compose ps -q' (run from self-host/)"
  echo "caddy cid='$CADDY_CID' app cid='$APP_CID'"
  echo "--- docker compose ps ---"
  docker compose ps || true
  exit 1
fi
info "caddy=$CADDY_CID  app=$APP_CID"

# Determine the actual shared network name from app's networks (pick one ending in _pvl, else first)
APP_NETS="$(docker inspect "$APP_CID" -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null)"
CADDY_NETS="$(docker inspect "$CADDY_CID" -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null)"
NET=""
for n in $APP_NETS; do
  case "$n" in *_pvl) NET="$n"; break;; esac
done
[ -z "$NET" ] && NET="$(echo "$APP_NETS" | awk '{print $1}')"
info "shared-net candidate: $NET"

hdr "1. networks attached to caddy and app"
echo "--- caddy networks ---"
docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} aliases={{$v.Aliases}} ip={{$v.IPAddress}}{{"\n"}}{{end}}' "$CADDY_CID"
echo "--- app networks ---"
docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} aliases={{$v.Aliases}} ip={{$v.IPAddress}}{{"\n"}}{{end}}' "$APP_CID"

if echo " $CADDY_NETS " | grep -qw "$NET" && echo " $APP_NETS " | grep -qw "$NET"; then
  ok "caddy and app share network $NET"
else
  fail "caddy and app are NOT on the same network ($NET)"
  echo "caddy nets: $CADDY_NETS"
  echo "app   nets: $APP_NETS"
fi

hdr "2. containers on $NET"
docker network inspect "$NET" --format '{{range .Containers}}{{.Name}}  {{.IPv4Address}}{{"\n"}}{{end}}' || true

hdr "3. DNS lookup of 'app' from inside caddy"
if docker exec "$CADDY_CID" sh -c 'getent hosts app 2>/dev/null || nslookup app 127.0.0.11 2>&1 || true' | tee /dev/stderr | grep -qE '^[0-9a-f]'; then
  ok "caddy can resolve 'app'"
else
  fail "caddy cannot resolve 'app' via Docker DNS (127.0.0.11)"
fi

hdr "4. TCP reach app:3000 from inside caddy"
if docker exec "$CADDY_CID" sh -c 'wget -qO- --timeout=3 http://app:3000/ >/dev/null 2>&1 && echo OK || (nc -zv app 3000 2>&1 || true)'; then
  ok "caddy reached app:3000"
else
  warn "caddy could not reach app:3000 (see log)"
fi

hdr "5. recent caddy errors mentioning 'app'"
docker compose logs --tail=200 caddy 2>&1 | grep -iE 'app|dial|lookup|no such host|upstream|502' || echo "(none)"

hdr "remediation hints"
cat <<'EOF'
If networks differ or DNS fails:
  1) Confirm both services declare:  networks: [pvl]
  2) Recreate cleanly so Caddy picks up the network alias:
       docker compose up -d --force-recreate caddy app
  3) Always run docker compose from the same directory (self-host/) so the
     compose project name (and network name) stays consistent.
EOF
