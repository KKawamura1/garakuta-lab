#!/usr/bin/env bash
# 全検査を一つでも落としたら失敗させる。SCRAPLINEの新しい境界検査も
# 通常の smoke と seed 回帰に含め、push時に古いルールへ戻らないようにする。
set -u
fail=0

for f in play/app.js puzzle/app.js agent-view/app.js agent-view/sync.js graft/app.js control/app.js night-eater/app.js night-eater/telemetry.mjs scrapline/app.js; do
  [ -f "$f" ] || continue
  if node --input-type=module --check < "$f" 2>/tmp/syntax.$$; then
    echo "ok   構文 $f"
  else
    echo "FAIL 構文 $f"
    tail -3 /tmp/syntax.$$
    fail=1
  fi
  rm -f /tmp/syntax.$$
done

for f in $(ls analysis/*smoke*.mjs analysis/*seed-regression*.mjs 2>/dev/null | sort -u); do
  if out=$(node "$f" 2>&1); then
    echo "ok   $f"
  else
    echo "FAIL $f"
    echo "$out" | tail -3
    fail=1
  fi
done

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
echo "検査は全部通った。"
