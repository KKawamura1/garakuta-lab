#!/usr/bin/env bash
# 全検査を一つでも落としたら失敗させる。検査対象は従来のまま、
# 独立した検査だけを並列実行してCIの待ち時間を短くする。
#
# **push ごとの検査は1分以内に保つ。** 長いもの、一度回せば十分なもの
# （総当たり、seed回帰、方策探索、釣り合い探索）は下の SLOW_CHECKS へ入れ、
# 毎週の Exhaustive checks と手動実行にだけ回す。
# 予算は最後に機械が見る。散文の約束にしない。
set -u
fail=0
started_ms=$(( $(date +%s%N) / 1000000 ))
FAST_CHECK_BUDGET_MS="${FAST_CHECK_BUDGET_MS:-60000}"
tmpdir="$(mktemp -d)"
trap 'rm -rf -- "$tmpdir"' EXIT

for f in play/app.js puzzle/app.js agent-view/app.js agent-view/sync.js graft/app.js control/app.js night-eater/app.js night-eater/telemetry.mjs scrapline/app.js ecology/app.js; do
  [ -f "$f" ] || continue
  syntax_log="$tmpdir/syntax-$(basename "$f").log"
  if node --input-type=module --check < "$f" 2>"$syntax_log"; then
    echo "ok   構文 $f"
  else
    echo "FAIL 構文 $f"
    tail -3 "$syntax_log"
    fail=1
  fi
done

mapfile -t smoke_files < <(ls analysis/*smoke*.mjs analysis/*seed-regression*.mjs 2>/dev/null | sort -u)

# 探索・総当たり・回帰の類。**assertion は1つも削っていない。**
# 走る頻度だけを毎pushから毎週＋手動へ落としてある。
# 対象が変わったとき（core/trial.mjs, core/laws.mjs, scrapline/engine.mjs など）は
# 手で回すこと。手順は docs/OPERATIONS.md「長く走るものの扱い」。
SLOW_CHECKS=(
  analysis/scrapline-balance-smoke.mjs    # 全順序列 × 7区画の総当たり（約45秒）
  analysis/scrapline-seed-regression.mjs  # 256 seed の回帰
  analysis/smoke-trial.mjs                # 対の釣り合い探索（約19秒）
  analysis/scrapline-run-policy-smoke.mjs # 愚直方策の探索（約6秒）
)

if [[ "${RUN_EXHAUSTIVE:-0}" == "1" ]]; then
  echo "full mode: 探索・総当たり・回帰も含めて全部走らせる"
else
  fast_smoke_files=()
  for f in "${smoke_files[@]}"; do
    skip=0
    for slow in "${SLOW_CHECKS[@]}"; do
      [ "$f" = "$slow" ] && skip=1 && break
    done
    [ "$skip" -eq 1 ] && continue
    fast_smoke_files+=("$f")
  done
  smoke_files=("${fast_smoke_files[@]}")
  echo "fast mode: ${#SLOW_CHECKS[@]}件の長い検査を外した（RUN_EXHAUSTIVE=1 で全部走る）"
fi

pids=()
status_files=()
for i in "${!smoke_files[@]}"; do
  f="${smoke_files[$i]}"
  output_file="$tmpdir/check-$i.out"
  status_file="$tmpdir/check-$i.status"
  status_files[$i]="$status_file"
  (
    check_started=$(( $(date +%s%N) / 1000000 ))
    if node "$f" >"$output_file" 2>&1; then
      printf "ok   %5dms %s\n" $(( $(date +%s%N) / 1000000 - check_started )) "$f" >"$status_file"
    else
      {
        printf "FAIL %5dms %s\n" $(( $(date +%s%N) / 1000000 - check_started )) "$f"
        tail -3 "$output_file"
      } >"$status_file"
      exit 1
    fi
  ) &
  pids[$i]=$!
done

for i in "${!smoke_files[@]}"; do
  if wait "${pids[$i]}"; then
    cat "${status_files[$i]}"
  else
    if [ -f "${status_files[$i]}" ]; then
      cat "${status_files[$i]}"
    else
      echo "FAIL ${smoke_files[$i]}"
    fi
    fail=1
  fi
done

# ecology/ は R5 の戦闘ルールエンジン。自前の runner が各テストを別プロセスで
# 走らせ、出力ではなく exit code を見る。散文の約束ではなく、ここから鳴らす。
if [ -f ecology/check.mjs ]; then
  ecology_started=$(( $(date +%s%N) / 1000000 ))
  if node ecology/check.mjs >"$tmpdir/ecology.log" 2>&1; then
    printf "ok   %5dms ecology/check.mjs\n" $(( $(date +%s%N) / 1000000 - ecology_started ))
  else
    echo "FAIL ecology/check.mjs"
    tail -20 "$tmpdir/ecology.log"
    fail=1
  fi
fi

if node --check scrapline/engine.mjs; then
  echo "ok   構文 scrapline/engine.mjs"
else
  echo "FAIL 構文 scrapline/engine.mjs"
  fail=1
fi

if [ "$fail" -ne 0 ]; then
  echo "検査が落ちている。公開しない。"
  exit 1
fi

elapsed_ms=$(( $(date +%s%N) / 1000000 - started_ms ))
echo "検査は全部通った。（${elapsed_ms}ms）"

# **予算を超えたら落とす。** 「1分以内に保つ」は散文だと守られない。
# 超えたときに直すのは、閾値ではなく検査の置き場所（SLOW_CHECKS へ移す）。
if [[ "${RUN_EXHAUSTIVE:-0}" != "1" ]] && [ "$elapsed_ms" -gt "$FAST_CHECK_BUDGET_MS" ]; then
  echo "FAIL push ごとの検査が ${elapsed_ms}ms かかった。予算は ${FAST_CHECK_BUDGET_MS}ms。"
  echo "     上の一覧で長いものを SLOW_CHECKS へ移し、docs/OPERATIONS.md の手動実行へ回すこと。"
  echo "     予算のほうを動かして通さない。"
  exit 1
fi
