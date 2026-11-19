#!/usr/bin/env bash
# Fixed frame-time scenarios on the TV, for comparing builds against docs/perf-baseline.md.
# Needs a dev build (./scripts/deploy.sh --dev) and node tools/devserver.mjs running.
# Every scenario restarts Home first, so runs start from the same state.
#   tools/bench.sh                  all scenarios, RUNS (default 3) runs each, plus medians
#   tools/bench.sh home-h detail    only these: home-h home-v home-hold lib-v detail
#   tools/bench.sh info             TV model, firmware and user agent (the Chromium version)
#   tools/bench.sh cold             "home rows ready" over COLD_RUNS (default 5) reloads
# BENCH_LIBRARY=<title> picks the library for lib-v (default: the first one).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOG="$ROOT/build/tv.log"
SEND="localhost:${PORT:-8790}/send"
RUNS="${RUNS:-3}"
ALL="home-h home-v home-hold lib-v detail"

[ -f "$LOG" ] || { echo "No $LOG. Start node tools/devserver.mjs first." >&2; exit 1; }
case "$(curl -s "$SEND" || true)" in
  sent*) ;;
  *) echo "The app isn't connected to the devserver. Deploy with ./scripts/deploy.sh --dev and open it." >&2; exit 1 ;;
esac

SLEEP="await new Promise(r => setTimeout(r, 3000));"
RESET="window.dispatchEvent(new Event('samsucks:restart')); $SLEEP"

scenario_js() {
  case "$1" in
    home-h) echo "$RESET return __bench([...Array(10).fill('right'), ...Array(10).fill('left')], 250);" ;;
    home-v) echo "$RESET return __bench([...Array(6).fill('down'), ...Array(6).fill('up')], 350);" ;;
    home-hold) echo "$RESET return __hold('right', 3000);" ;;
    lib-v) echo "$RESET const all = await __ss.session.server.sections();
      __ss.nav.openLibrary(all.find(s => s.title === '${BENCH_LIBRARY:-}') || all[0]); $SLEEP
      return __bench([...Array(10).fill('down'), ...Array(10).fill('up')], 300);" ;;
    detail) echo "$RESET return __bench(['enter', 'back', 'enter', 'back', 'enter', 'back'], 1200);" ;;
    *) return 1 ;;
  esac
}

mid() { sort -n | awk '{ a[NR] = $1 } END { if (NR) print a[int((NR + 1) / 2)] }'; }

median() {
  local out=""
  for k in fps p50 p95 max; do
    out="$out $k=$(printf '%s\n' "$1" | grep -o "$k=[0-9]*" | cut -d= -f2 | mid)"
  done
  echo "${out# }"
}

run_scenario() {
  local js line results=""
  js=$(scenario_js "$1") || { echo "unknown scenario: $1 (one of: $ALL info cold)" >&2; exit 1; }
  for i in $(seq 1 "$RUNS"); do
    line=$("$ROOT/tools/tveval.sh" "(async () => { $js })()" 90 || true)
    line="${line#*eval → }"
    printf '%-10s run %s  %s\n' "$1" "$i" "$line"
    results="$results$line"$'\n'
  done
  printf '%-10s median %s\n' "$1" "$(median "$results")"
}

info() {
  local line
  line=$("$ROOT/tools/tveval.sh" "[navigator.userAgent, (() => { try { return webapis.productinfo.getRealModel() +
    ' firmware ' + webapis.productinfo.getFirmware() + ' tizen ' +
    tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version'); } catch (e) { return 'no productinfo'; } })()].join(' | ')" 20 || true)
  echo "info       ${line#*eval → }"
}

# Reload the page and read the app's own "home rows ready" log line, so this measures the
# same thing a launch does (minus process start).
cold() {
  local n ms values=""
  for i in $(seq 1 "${COLD_RUNS:-5}"); do
    n=$(wc -l < "$LOG")
    curl -s --get --data-urlencode "eval=setTimeout(() => location.reload(), 200), 'reloading'" "$SEND" >/dev/null
    ms=""
    for _ in $(seq 1 120); do
      sleep 0.25
      ms=$(tail -n +$((n + 1)) "$LOG" | sed -n 's/.*home rows ready at \([0-9]*\)ms.*/\1/p' | head -1)
      [ -n "$ms" ] && break
    done
    echo "cold       run $i  rows ready at ${ms:-timeout}ms"
    values="$values$ms"$'\n'
    sleep 3 # the reloaded app reconnects to the devserver before the next command
  done
  echo "cold       median rows ready at $(printf '%s' "$values" | grep . | mid)ms"
}

[ $# -gt 0 ] || set -- $ALL
for s in "$@"; do
  case "$s" in
    info) info ;;
    cold) cold ;;
    *) run_scenario "$s" ;;
  esac
done
