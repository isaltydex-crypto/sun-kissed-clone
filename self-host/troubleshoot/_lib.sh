# Shared helpers for troubleshoot scripts. Source from each script:
#   . "$(dirname "$0")/_lib.sh"
#
# Behavior:
#   - cd's to self-host/ (parent of troubleshoot/) so .env + docker compose work.
#   - Creates self-host/troubleshoot/logs/<script>-<timestamp>.log
#   - All raw stdout/stderr (e.g. `docker compose logs ...`, `curl -I ...`) goes
#     ONLY to the log file. The terminal stays clean.
#   - Use the helpers below to print status to BOTH terminal + log:
#       hdr "section title"
#       info "neutral message"
#       ok   "passed"
#       warn "soft failure"
#       fail "hard failure"
#       run  "label" -- some command args...    # runs cmd, captures to log,
#                                                 prints ok/fail on terminal
#   - Final line printed automatically: "✓ finished  log saved: ..."

_TS_NAME="$(basename "${BASH_SOURCE[1]:-$0}" .sh)"
_TS_DIR="$(cd "$(dirname "${BASH_SOURCE[1]:-$0}")" && pwd)"
_TS_LOGDIR="$_TS_DIR/logs"
mkdir -p "$_TS_LOGDIR"
TS_LOG_FILE="$_TS_LOGDIR/${_TS_NAME}-$(date +%Y%m%d-%H%M%S).log"

cd "$_TS_DIR/.." || exit 1

# Save original stdout for terminal-only writes; pick a writable terminal sink.
exec 9>&1
_TS_TTY=/dev/tty
[ -w "$_TS_TTY" ] || _TS_TTY=/proc/self/fd/9

# Banner shown to the user immediately.
printf '\033[1;36m▶ %s\033[0m\n   log: %s\n\n' "$_TS_NAME" "$TS_LOG_FILE" > "$_TS_TTY"

# Redirect EVERYTHING (raw command output) to the log file only.
# ANSI color codes are stripped so the file is paste-friendly.
exec > >(sed -u 's/\x1b\[[0-9;]*[a-zA-Z]//g' >> "$TS_LOG_FILE") 2>&1

# ---- helpers that also print to the terminal -------------------------------

_ts_emit() {  # $1 = ansi-prefixed line for tty, $2 = plain line for log
  printf '%s\n' "$1" > "$_TS_TTY"
  printf '%s\n' "$2"   # goes to redirected stdout = log file
}

hdr()  { _ts_emit $'\n\033[1;36m=== '"$*"$' ===\033[0m'   "=== $* ==="; }
info() { _ts_emit "  • $*"                                "  . $*"; }
ok()   { _ts_emit $'  \033[32m✓\033[0m '"$*"               "  [OK]   $*"; }
warn() { _ts_emit $'  \033[33m⚠\033[0m '"$*"               "  [WARN] $*"; }
fail() { _ts_emit $'  \033[31m✗\033[0m '"$*"               "  [FAIL] $*"; }

# run "label" -- cmd args...
# Runs the command silently (output captured to the log only) and prints
# a single ok/fail line to the terminal.
run() {
  local label="$1"; shift
  [ "${1:-}" = "--" ] && shift
  echo "+ $label: $*"          # echoed into the log
  if "$@"; then
    ok "$label"
    return 0
  else
    local rc=$?
    fail "$label (exit $rc)"
    return "$rc"
  fi
}

_ts_done() {
  printf '\n\033[1;32m✓ finished\033[0m  log saved: %s\n' "$TS_LOG_FILE" > "$_TS_TTY"
}
trap _ts_done EXIT
