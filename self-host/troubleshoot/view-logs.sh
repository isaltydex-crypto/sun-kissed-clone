#!/usr/bin/env bash
# Interactive log viewer. Lists every log source we know about (docker
# services, persistent log files inside the app container, troubleshoot
# script logs) and lets you tail / follow / open each one.
#
# Usage:
#   bash self-host/troubleshoot/view-logs.sh
set -uo pipefail

. "$(dirname "$0")/_lib.sh"

# Helpers from _lib.sh redirect stdout to the log file. For interactive UI
# we have to write to the saved tty (fd 9 / $_TS_TTY) and read from it.
TTY_OUT="$_TS_TTY"
TTY_IN=/dev/tty
[ -r "$TTY_IN" ] || TTY_IN=/proc/self/fd/0

tput_safe() { tput "$@" 2>/dev/null || true; }

# ---- discover sources ------------------------------------------------------

hdr "Discover log sources"

declare -a LABELS=()   # human label
declare -a KINDS=()    # docker | file
declare -a TARGETS=()  # service name OR "container:/path" OR host path

add_source() {
  LABELS+=("$1"); KINDS+=("$2"); TARGETS+=("$3")
}

# Docker compose services (container stdout/stderr, captured by Docker).
if docker compose ps --services >/dev/null 2>&1; then
  while IFS= read -r svc; do
    [ -z "$svc" ] && continue
    add_source "docker: $svc (container stdout/stderr)" "docker" "$svc"
  done < <(docker compose ps --services 2>/dev/null | sort)
  ok "found docker compose services"
else
  warn "docker compose not available in this directory"
fi

# Persistent log files inside the app container (admin audit log etc).
if docker compose ps --services 2>/dev/null | grep -qx app; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    add_source "file (app container): $f" "container-file" "app:$f"
  done < <(docker compose exec -T app sh -lc 'ls -1 /var/log/peptiva/*.log 2>/dev/null' 2>/dev/null)
fi

# Caddy access/error logs (if mounted on the host or inside the container).
if docker compose ps --services 2>/dev/null | grep -qx caddy; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    add_source "file (caddy container): $f" "container-file" "caddy:$f"
  done < <(docker compose exec -T caddy sh -lc 'ls -1 /var/log/caddy/*.log 2>/dev/null' 2>/dev/null)
fi

# Troubleshoot script logs we've previously written.
if [ -d "$_TS_LOGDIR" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    add_source "troubleshoot log: $(basename "$f")" "host-file" "$f"
  done < <(ls -1t "$_TS_LOGDIR"/*.log 2>/dev/null | head -n 30)
fi

if [ "${#LABELS[@]}" -eq 0 ]; then
  fail "no log sources found"
  exit 1
fi
ok "${#LABELS[@]} sources available"

# ---- interactive picker ----------------------------------------------------

print_menu() {
  {
    echo
    tput_safe bold; echo "Available logs:"; tput_safe sgr0
    local i
    for i in "${!LABELS[@]}"; do
      printf "  %3d) %s\n" "$((i+1))" "${LABELS[$i]}"
    done
    echo "    q) quit"
    echo
  } > "$TTY_OUT"
}

ask() { # ask "prompt" -> echoes user input to stdout(=log) AND tty
  local prompt="$1" reply
  printf '%s' "$prompt" > "$TTY_OUT"
  IFS= read -r reply < "$TTY_IN" || reply="q"
  printf '%s\n' "$reply"
}

view_source() {
  local label="$1" kind="$2" target="$3" mode="$4"
  local cmd
  case "$kind" in
    docker)
      case "$mode" in
        tail)   cmd=(docker compose logs --tail=200 --no-color "$target") ;;
        follow) cmd=(docker compose logs --tail=200 --no-color -f "$target") ;;
        less)   cmd=(docker compose logs --no-color "$target") ;;
      esac
      ;;
    container-file)
      local svc="${target%%:*}" path="${target#*:}"
      case "$mode" in
        tail)   cmd=(docker compose exec -T "$svc" tail -n 200 "$path") ;;
        follow) cmd=(docker compose exec -T "$svc" tail -n 200 -F "$path") ;;
        less)   cmd=(docker compose exec -T "$svc" cat "$path") ;;
      esac
      ;;
    host-file)
      case "$mode" in
        tail)   cmd=(tail -n 200 "$target") ;;
        follow) cmd=(tail -n 200 -F "$target") ;;
        less)   cmd=(cat "$target") ;;
      esac
      ;;
  esac

  {
    echo
    tput_safe bold; printf -- '--- %s [%s] ---\n' "$label" "$mode"; tput_safe sgr0
  } > "$TTY_OUT"

  info "view: $label ($mode)"
  echo "+ ${cmd[*]}"   # to log file

  if [ "$mode" = "less" ] && command -v less >/dev/null 2>&1; then
    "${cmd[@]}" 2>&1 | tee -a "$TS_LOG_FILE" | less -R +G < "$TTY_IN" > "$TTY_OUT"
  elif [ "$mode" = "follow" ]; then
    {
      printf '\n(press Ctrl-C to stop following)\n\n' > "$TTY_OUT"
      "${cmd[@]}" 2>&1 | tee -a "$TS_LOG_FILE" > "$TTY_OUT"
    } || true
  else
    "${cmd[@]}" 2>&1 | tee -a "$TS_LOG_FILE" > "$TTY_OUT"
  fi
}

while true; do
  print_menu
  pick="$(ask 'Pick a log number (or q to quit): ')"
  case "$pick" in
    q|Q|"") break ;;
  esac
  if ! [[ "$pick" =~ ^[0-9]+$ ]] || [ "$pick" -lt 1 ] || [ "$pick" -gt "${#LABELS[@]}" ]; then
    warn "invalid choice: $pick"
    continue
  fi
  idx=$((pick-1))

  {
    echo
    echo "Mode for: ${LABELS[$idx]}"
    echo "  1) tail last 200 lines"
    echo "  2) follow (live, Ctrl-C to stop)"
    echo "  3) open in less (full content, q to exit)"
    echo "  b) back to list"
    echo
  } > "$TTY_OUT"
  mode_pick="$(ask 'Mode: ')"
  case "$mode_pick" in
    1) view_source "${LABELS[$idx]}" "${KINDS[$idx]}" "${TARGETS[$idx]}" tail ;;
    2) view_source "${LABELS[$idx]}" "${KINDS[$idx]}" "${TARGETS[$idx]}" follow ;;
    3) view_source "${LABELS[$idx]}" "${KINDS[$idx]}" "${TARGETS[$idx]}" less ;;
    b|B|"") continue ;;
    *) warn "invalid mode: $mode_pick" ;;
  esac
done

ok "viewer exited cleanly"
