# Shared helpers for troubleshoot scripts. Source from each script:
#   . "$(dirname "$0")/_lib.sh"
#
# Effects:
#   - cd's to self-host/ (parent of troubleshoot/) so docker compose + .env work
#   - Creates self-host/troubleshoot/logs/<script>-<timestamp>.log
#   - Redirects ALL stdout+stderr into that log file
#   - Prints only a short banner + final "log written to ..." line to the terminal
#   - Strips ANSI color codes from the saved log so it's easy to paste back

_TS_NAME="$(basename "${BASH_SOURCE[1]:-$0}" .sh)"
_TS_DIR="$(cd "$(dirname "${BASH_SOURCE[1]:-$0}")" && pwd)"
_TS_LOGDIR="$_TS_DIR/logs"
mkdir -p "$_TS_LOGDIR"
TS_LOG_FILE="$_TS_LOGDIR/${_TS_NAME}-$(date +%Y%m%d-%H%M%S).log"

# Move into self-host/ (parent of troubleshoot/) for .env + docker compose
cd "$_TS_DIR/.." || exit 1

# Save terminal fd so we can still print short status lines.
exec 9>&1
_TS_TTY=/dev/tty
[ -w "$_TS_TTY" ] || _TS_TTY=/proc/self/fd/9

printf '\033[1;36m▶ %s\033[0m   logging to: %s\n' "$_TS_NAME" "$TS_LOG_FILE" > "$_TS_TTY"

# Tee all output to terminal AND to the log file (with ANSI stripped in the file).
exec > >(tee >(sed -u 's/\x1b\[[0-9;]*[a-zA-Z]//g' >> "$TS_LOG_FILE")) 2>&1

ts_say() {
  printf '%s\n' "$*"
}

ts_done() {
  local status="${1:-done}"
  printf '\033[1;32m✓ %s\033[0m  log saved: %s\n' "$status" "$TS_LOG_FILE"
}

trap 'ts_done "finished"' EXIT
