#!/usr/bin/env bash
# ============================================================================
# menu.sh — interactive menu for self-host operations.
#
# Run from anywhere:
#   bash /path/to/sun-kissed-clone/self-host/menu.sh
#
# Provides a friendly TUI to:
#   - run troubleshooting scripts
#   - rebuild / restart containers
#   - tail logs
#   - pull latest code
#   - view recent troubleshoot logs
#
# No dependencies beyond bash + docker compose.
# ============================================================================
set -u

# Resolve script dir → cd into self-host/ so docker compose + .env work.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1

TROUBLESHOOT_DIR="$SCRIPT_DIR/troubleshoot"
LOG_DIR="$TROUBLESHOOT_DIR/logs"
mkdir -p "$LOG_DIR"

# ---- colors ----------------------------------------------------------------
if [ -t 1 ]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_DIM=$'\033[2m'
  C_CYAN=$'\033[1;36m'
  C_GREEN=$'\033[1;32m'
  C_YELLOW=$'\033[1;33m'
  C_RED=$'\033[1;31m'
  C_BLUE=$'\033[1;34m'
  C_MAGENTA=$'\033[1;35m'
else
  C_RESET= C_BOLD= C_DIM= C_CYAN= C_GREEN= C_YELLOW= C_RED= C_BLUE= C_MAGENTA=
fi

clear_screen() { printf '\033[2J\033[H'; }

banner() {
  clear_screen
  printf '%s\n' "${C_CYAN}╔════════════════════════════════════════════════════════════════╗${C_RESET}"
  printf '%s\n' "${C_CYAN}║         peptivaLab self-host control menu                      ║${C_RESET}"
  printf '%s\n' "${C_CYAN}╚════════════════════════════════════════════════════════════════╝${C_RESET}"
  printf '%s%s%s\n\n' "${C_DIM}" "  $(pwd)" "${C_RESET}"
}

pause() {
  printf '\n%sPress ENTER to continue…%s' "${C_DIM}" "${C_RESET}"
  read -r _
}

confirm() {
  # confirm "Are you sure?"  → returns 0 if yes
  local prompt="${1:-Are you sure?}"
  printf '%s%s%s [y/N] ' "${C_YELLOW}" "$prompt" "${C_RESET}"
  read -r ans
  [[ "$ans" =~ ^[Yy]$ ]]
}

# ---- compose helpers -------------------------------------------------------
DC() { docker compose "$@"; }

list_services() {
  DC config --services 2>/dev/null | sort
}

pick_service() {
  # Prints chosen service name on stdout, or empty if cancelled.
  # All UI goes to stderr so callers can capture stdout cleanly.
  local services=()
  while IFS= read -r s; do services+=("$s"); done < <(list_services)
  if [ "${#services[@]}" -eq 0 ]; then
    printf '%sNo services found in docker-compose.yml%s\n' "${C_RED}" "${C_RESET}" >&2
    return 1
  fi
  printf '\n%sAvailable services:%s\n' "${C_BOLD}" "${C_RESET}" >&2
  local i=1
  for s in "${services[@]}"; do
    printf '  %2d) %s\n' "$i" "$s" >&2
    i=$((i+1))
  done
  printf '   a) %sALL services%s\n' "${C_MAGENTA}" "${C_RESET}" >&2
  printf '   q) cancel\n' >&2
  printf '\n%sChoose service:%s ' "${C_BOLD}" "${C_RESET}" >&2
  read -r choice
  case "$choice" in
    q|Q|"") return 1 ;;
    a|A)    printf '%s\n' "__ALL__" ;;
    *)
      if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#services[@]}" ]; then
        printf '%s\n' "${services[$((choice-1))]}"
      else
        printf '%sInvalid choice%s\n' "${C_RED}" "${C_RESET}" >&2
        return 1
      fi
      ;;
  esac
}

# ===========================================================================
# Menu actions
# ===========================================================================

action_troubleshoot() {
  banner
  printf '%sTroubleshooting scripts%s\n\n' "${C_BOLD}" "${C_RESET}"
  local scripts=()
  while IFS= read -r f; do scripts+=("$f"); done < <(find "$TROUBLESHOOT_DIR" -maxdepth 1 -name '*.sh' ! -name '_*' -type f | sort)
  if [ "${#scripts[@]}" -eq 0 ]; then
    printf '%sNo troubleshoot scripts found.%s\n' "${C_YELLOW}" "${C_RESET}"
    pause; return
  fi
  local i=1
  for s in "${scripts[@]}"; do
    printf '  %2d) %s\n' "$i" "$(basename "$s")"
    i=$((i+1))
  done
  printf '   q) back\n\n'
  printf '%sChoose script:%s ' "${C_BOLD}" "${C_RESET}"
  read -r choice
  [[ "$choice" =~ ^[Qq]$ || -z "$choice" ]] && return
  if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#scripts[@]}" ]; then
    local script="${scripts[$((choice-1))]}"
    printf '\n%sRunning %s …%s\n\n' "${C_CYAN}" "$(basename "$script")" "${C_RESET}"
    bash "$script"
    pause
  else
    printf '%sInvalid choice%s\n' "${C_RED}" "${C_RESET}"; pause
  fi
}

action_compose_status() {
  banner
  printf '%sContainer status%s\n\n' "${C_BOLD}" "${C_RESET}"
  DC ps
  pause
}

action_logs() {
  banner
  printf '%sTail logs%s\n' "${C_BOLD}" "${C_RESET}"
  local svc; svc="$(pick_service)" || return
  printf '\n%sTailing logs (Ctrl-C to stop)…%s\n\n' "${C_CYAN}" "${C_RESET}"
  if [ "$svc" = "__ALL__" ]; then
    DC logs -f --tail=100
  else
    DC logs -f --tail=200 "$svc"
  fi
  pause
}

action_restart() {
  banner
  printf '%sRestart container%s\n' "${C_BOLD}" "${C_RESET}"
  local svc; svc="$(pick_service)" || return
  if [ "$svc" = "__ALL__" ]; then
    confirm "Restart ALL services?" || return
    DC restart
  else
    DC restart "$svc"
  fi
  pause
}

action_rebuild() {
  banner
  printf '%sRebuild & redeploy container%s\n' "${C_BOLD}" "${C_RESET}"
  printf '%sUse --no-cache for clean rebuild (slower, fixes asset hash mismatches).%s\n\n' "${C_DIM}" "${C_RESET}"
  local svc; svc="$(pick_service)" || return

  printf '\nRebuild mode:\n'
  printf '  1) normal rebuild\n'
  printf '  2) %s--no-cache%s (clean)\n' "${C_MAGENTA}" "${C_RESET}"
  printf '  q) cancel\n\n'
  printf '%sChoose:%s ' "${C_BOLD}" "${C_RESET}"
  read -r mode
  local args=()
  case "$mode" in
    1) ;;
    2) args+=("--no-cache") ;;
    *) return ;;
  esac

  if [ "$svc" = "__ALL__" ]; then
    confirm "Rebuild ALL buildable services?" || return
    DC build "${args[@]}"
    DC up -d
  else
    DC build "${args[@]}" "$svc"
    DC up -d "$svc"
  fi
  pause
}

action_pull_images() {
  banner
  printf '%sPull latest images & recreate%s\n\n' "${C_BOLD}" "${C_RESET}"
  confirm "Pull all images and recreate containers?" || return
  DC pull
  DC up -d
  pause
}

action_git_pull() {
  banner
  printf '%sgit pull (project root)%s\n\n' "${C_BOLD}" "${C_RESET}"
  ( cd .. && git status --short && echo && git pull --ff-only )
  pause
}

action_view_logs_dir() {
  banner
  printf '%sRecent troubleshoot log files%s\n\n' "${C_BOLD}" "${C_RESET}"
  local logs=()
  while IFS= read -r f; do logs+=("$f"); done < <(ls -1t "$LOG_DIR"/*.log 2>/dev/null | head -n 20)
  if [ "${#logs[@]}" -eq 0 ]; then
    printf '%sNo logs in %s%s\n' "${C_DIM}" "$LOG_DIR" "${C_RESET}"
    pause; return
  fi
  local i=1
  for f in "${logs[@]}"; do
    printf '  %2d) %s  %s(%s)%s\n' "$i" "$(basename "$f")" "${C_DIM}" "$(date -r "$f" '+%Y-%m-%d %H:%M')" "${C_RESET}"
    i=$((i+1))
  done
  printf '   q) back\n\n'
  printf '%sView which log? (number, or "d" to delete all):%s ' "${C_BOLD}" "${C_RESET}"
  read -r choice
  case "$choice" in
    q|Q|"") return ;;
    d|D)
      confirm "Delete ALL log files in $LOG_DIR?" || return
      rm -f "$LOG_DIR"/*.log
      printf '%sDeleted.%s\n' "${C_GREEN}" "${C_RESET}"
      pause
      ;;
    *)
      if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#logs[@]}" ]; then
        ${PAGER:-less} "${logs[$((choice-1))]}"
      fi
      ;;
  esac
}

action_shell() {
  banner
  printf '%sOpen shell in container%s\n' "${C_BOLD}" "${C_RESET}"
  local svc; svc="$(pick_service)" || return
  [ "$svc" = "__ALL__" ] && { printf '%sPick a single service.%s\n' "${C_RED}" "${C_RESET}"; pause; return; }
  printf '\n%sLaunching shell in %s …%s\n' "${C_CYAN}" "$svc" "${C_RESET}"
  DC exec "$svc" sh -c 'command -v bash >/dev/null && exec bash || exec sh' \
    || printf '%sFailed to open shell (container running?).%s\n' "${C_RED}" "${C_RESET}"
  pause
}

action_down_up() {
  banner
  printf '%sFull stack restart (down + up -d)%s\n\n' "${C_BOLD}" "${C_RESET}"
  printf '%sThis stops every container, then starts them again. Volumes are preserved.%s\n\n' "${C_DIM}" "${C_RESET}"
  confirm "Proceed?" || return
  DC down
  DC up -d
  pause
}

# ===========================================================================
# Main loop
# ===========================================================================

main_menu() {
  while true; do
    banner
    printf '  %s1)%s Run troubleshooting script\n'        "${C_GREEN}"  "${C_RESET}"
    printf '  %s2)%s Show container status (compose ps)\n' "${C_GREEN}" "${C_RESET}"
    printf '  %s3)%s Tail container logs\n'                "${C_GREEN}" "${C_RESET}"
    printf '  %s4)%s Restart container(s)\n'               "${C_GREEN}" "${C_RESET}"
    printf '  %s5)%s Rebuild & redeploy container\n'       "${C_BLUE}"  "${C_RESET}"
    printf '  %s6)%s Pull latest images & recreate\n'      "${C_BLUE}"  "${C_RESET}"
    printf '  %s7)%s Open shell inside container\n'        "${C_GREEN}" "${C_RESET}"
    printf '  %s8)%s git pull (latest code)\n'             "${C_BLUE}"  "${C_RESET}"
    printf '  %s9)%s View recent troubleshoot logs\n'      "${C_GREEN}" "${C_RESET}"
    printf ' %s10)%s Full stack restart (down + up -d)\n'  "${C_YELLOW}" "${C_RESET}"
    printf '\n  %sq)%s Quit\n\n'                            "${C_DIM}"   "${C_RESET}"
    printf '%sChoose an option:%s ' "${C_BOLD}" "${C_RESET}"
    read -r opt
    case "$opt" in
      1)  action_troubleshoot ;;
      2)  action_compose_status ;;
      3)  action_logs ;;
      4)  action_restart ;;
      5)  action_rebuild ;;
      6)  action_pull_images ;;
      7)  action_shell ;;
      8)  action_git_pull ;;
      9)  action_view_logs_dir ;;
      10) action_down_up ;;
      q|Q) clear_screen; printf '%sBye.%s\n' "${C_CYAN}" "${C_RESET}"; exit 0 ;;
      *)  printf '%sUnknown option: %s%s\n' "${C_RED}" "$opt" "${C_RESET}"; sleep 1 ;;
    esac
  done
}

main_menu
