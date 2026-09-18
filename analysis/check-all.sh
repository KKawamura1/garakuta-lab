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
  analysis/ecology-map-smoke.mjs
  analysis/ecology-equipment-gen-smoke.mjs
  analysis/ecology-readout-smoke.mjs
  analysis/ecology-active-slot-smoke.mjs
  analysis/ecology-skill-catalog-smoke.mjs
  analysis/ecology-canonical-numbers-smoke.mjs
  analysis/ecology-skill-tree-smoke.mjs
  analysis/ecology-ultimate-smoke.mjs
  analysis/ecology-enemy-tactics-smoke.mjs
  analysis/ecology-screens-smoke.mjs
  analysis/ecology-test-hygiene-smoke.mjs
  analysis/ecology-upload-smoke.mjs
)

for smoke in "${smokes[@]}"; do
  echo "smoke: $smoke"
  node "$smoke"
done

# **難度の測定は関門から外してある**（作者判断 2026-09-18）。
# 「難度は最後に調整するもので、システムは最初に調整するもの」なので、12戦の勝敗や
# 難度曲線の刻みを関門にすると、技能の規則を一つ動かすたびに技能とは無関係な理由で鳴る。
# どれも道具としては残してあるので、調整の段に入ったら手で走らせて数を読む。
#
#   node analysis/ecology-skill-balance-smoke.mjs   # 倍率と登場時期の錨
#   node analysis/ecology-stage3-builds.mjs         # 三構成の12戦通し
#   node analysis/ecology-campaign-curve.mjs        # 第一部10 Stage の難度曲線
#   node analysis/ecology-active-slot-report.mjs    # 装着枠の実測
#
# Browser screen trials are opt-in so the normal checks job stays lightweight.
# The deployed full-check workflow runs these trials on its own path.
if [[ "${ECOLOGY_SCREEN_TRIALS:-0}" == "1" ]]; then
  echo "screen: analysis/ecology-tutorial-trial.mjs"
  node analysis/ecology-tutorial-trial.mjs
  echo "screen: analysis/ecology-trial.mjs"
  node analysis/ecology-trial.mjs
fi
echo "One Battle Ahead checks: ok"
