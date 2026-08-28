#!/usr/bin/env bash
# 全検査を一つでも落としたら失敗させる。検査対象は従来のまま、
# 独立した検査だけを並列実行してCIの待ち時間を短くする。
set -u
fail=0
tmpdir="$(mktemp -d)"
trap 'rm -rf -- "$tmpdir"' EXIT

for f in play/app.js puzzle/app.js agent-view/app.js agent-view/sync.js graft/app.js control/app.js night-eater/app.js night-eater/telemetry.mjs scrapline/app.js; do
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
pids=()
status_files=()
for i in "${!smoke_files[@]}"; do
  f="${smoke_files[$i]}"
  output_file="$tmpdir/check-$i.out"
  status_file="$tmpdir/check-$i.status"
  status_files[$i]="$status_file"
  (
    if node "$f" >"$output_file" 2>&1; then
      printf "ok   %s\n" "$f" >"$status_file"
    else
      {
        printf "FAIL %s\n" "$f"
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
