#!/usr/bin/env bash
# Static checks for the CSS performance rules at the top of app/css/base.css:
# nothing animates except transform and opacity, and nothing uses a filter.
# Prints each violation and exits non-zero if there are any.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
status=0
fail() { echo "$1"; status=1; }

while IFS= read -r hit; do
  fail "filter (repaints on the CPU): ${hit#$ROOT/}"
done < <(rg -n --no-heading '(^|[\s;{])(-webkit-)?(backdrop-)?filter\s*:' "$ROOT/app/css" || true)

for f in "$ROOT"/app/css/*.css; do
  name=${f#$ROOT/}
  # Whole file on one line, comments and parenthesized arguments removed, so commas
  # inside cubic-bezier() or var() don't split a transition list.
  flat=$(tr '\n' ' ' < "$f" | sed -E 's#/\*([^*]|\*+[^*/])*\*+/##g; s/\([^()]*\)//g; s/\([^()]*\)//g')

  while IFS= read -r decl; do
    IFS=',' read -ra items <<< "${decl#*:}"
    for item in "${items[@]}"; do
      prop=$(awk '{ print $1 }' <<< "$item")
      case "$prop" in
        transform|opacity|none) ;;
        *) fail "$name: transition on '$prop' (a bare duration means all) in: $(echo $decl)" ;;
      esac
    done
  done < <(tr '{};' '\n\n\n' <<< "$flat" | grep -E '^ *transition(-property)? *:' || true)

  while IFS= read -r block; do
    for prop in $(grep -oE '[a-z-]+ *:' <<< "${block#*\{}" | tr -d ': '); do
      case "$prop" in
        transform|opacity) ;;
        *) fail "$name: keyframes animate '$prop' in: ${block%%\{*}" ;;
      esac
    done
  done < <(grep -oE '@keyframes[^{]*\{([^{}]*\{[^}]*\})*[^{}]*\}' <<< "$flat" || true)
done

[ "$status" = 0 ] && echo "perf-lint: ok"
exit "$status"
