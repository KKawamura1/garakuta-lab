#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "syntax: ecology"
while IFS= read -r -d '' file; do
  node --check "$file"
done < <(find ecology -type f \( -name "*.mjs" -o -name "*.js" \) -print0)

echo "contract: ecology/check.mjs"
node ecology/check.mjs

smokes=(
  analysis/ecology-anti-stall-audit.mjs
  analysis/ecology-contract-smoke.mjs
  analysis/ecology-equipment-gen-smoke.mjs
  analysis/ecology-readout-smoke.mjs
  analysis/ecology-skill-catalog-smoke.mjs
  analysis/ecology-screens-smoke.mjs
  analysis/ecology-test-hygiene-smoke.mjs
  analysis/ecology-upload-smoke.mjs
)

for smoke in "${smokes[@]}"; do
  echo "smoke: $smoke"
  node "$smoke"
done

echo "One Battle Ahead checks: ok"
