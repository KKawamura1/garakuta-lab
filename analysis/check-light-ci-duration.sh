#!/usr/bin/env bash
set -euo pipefail

# The workflow records milliseconds so a run just over the budget is not rounded down.
started_ms="${LIGHT_CI_STARTED_AT_MS:-}"
now_ms="${LIGHT_CI_NOW_MS:-$(date +%s%3N)}"
max_seconds="${LIGHT_CI_MAX_SECONDS:-120}"

is_non_negative_integer() {
  [[ "$1" =~ ^[0-9]+$ ]]
}

if ! is_non_negative_integer "$started_ms"; then
  echo "LIGHT_CI_STARTED_AT_MS must be a non-negative Unix timestamp in milliseconds" >&2
  exit 2
fi
if ! is_non_negative_integer "$now_ms"; then
  echo "LIGHT_CI_NOW_MS must be a non-negative Unix timestamp in milliseconds" >&2
  exit 2
fi
if ! is_non_negative_integer "$max_seconds"; then
  echo "LIGHT_CI_MAX_SECONDS must be a non-negative integer" >&2
  exit 2
fi

elapsed_ms=$((now_ms - started_ms))
if (( elapsed_ms < 0 )); then
  echo "light CI timer moved backwards: start=${started_ms}ms now=${now_ms}ms" >&2
  exit 2
fi

max_ms=$((max_seconds * 1000))
printf -v elapsed_display "%d.%03d" "$((elapsed_ms / 1000))" "$((elapsed_ms % 1000))"
echo "light CI duration: ${elapsed_display}s (${elapsed_ms}ms) / budget ${max_seconds}s"

if [[ "${LIGHT_CI_WRITE_SUMMARY:-0}" == "1" && -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "### Light CI duration"
    echo
    echo "- elapsed: \`${elapsed_display}s\`"
    echo "- budget: \`${max_seconds}s\`"
  } >> "$GITHUB_STEP_SUMMARY"
fi

if (( elapsed_ms > max_ms )); then
  echo "light CI exceeded its ${max_seconds}s budget by $((elapsed_ms - max_ms))ms" >&2
  exit 1
fi
