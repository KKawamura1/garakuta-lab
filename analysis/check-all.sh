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
  analysis/build-metadata-smoke.mjs
  analysis/ecology-anti-stall-audit.mjs
  analysis/ecology-chain-safety-audit.mjs
  analysis/ecology-chain-safety-blind-spots.mjs
  analysis/ecology-contract-smoke.mjs
  analysis/ecology-equipment-gen-smoke.mjs
  analysis/ecology-readout-smoke.mjs
  analysis/ecology-skill-catalog-smoke.mjs
  analysis/ecology-canonical-numbers-smoke.mjs
  analysis/ecology-skill-tree-smoke.mjs
  analysis/ecology-stage3-builds.mjs
  analysis/ecology-screens-smoke.mjs
  analysis/ecology-test-hygiene-smoke.mjs
  analysis/ecology-upload-smoke.mjs
)

for smoke in "${smokes[@]}"; do
  echo "smoke: $smoke"
  node "$smoke"
done

# Browser screen trials are opt-in so the normal checks job stays lightweight.
# The deployed full-check workflow runs these trials on its own path.
if [[ "${ECOLOGY_SCREEN_TRIALS:-0}" == "1" ]]; then
  echo "screen: analysis/ecology-tutorial-trial.mjs"
  node analysis/ecology-tutorial-trial.mjs
  echo "screen: analysis/ecology-trial.mjs"
  node analysis/ecology-trial.mjs
fi
echo "One Battle Ahead checks: ok"
