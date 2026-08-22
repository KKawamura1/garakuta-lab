#!/usr/bin/env bash
# 検査を全部走らせ、**一つでも落ちたら 1 で終わる。**
#
# 一晩に一度、これが無かったせいで**落ちている検査を抱えたまま公開した。**
# for ループで走らせて "FAIL" と印字するだけだと、後ろの `set -e` は反応しない。
# 印字は人が読む前提だが、公開の判断は機械にさせないといけない。
set -u
fail=0
for f in analysis/smoke-*.mjs; do
  if out=$(node "$f" 2>&1); then
    echo "ok   $f"
  else
    echo "FAIL $f"
    echo "$out" | tail -3
    fail=1
  fi
done
if [ "$fail" -ne 0 ]; then
  echo "検査が落ちている。**公開しない。**"
  exit 1
fi
echo "検査は全部通った。"
