#!/usr/bin/env bash
# 検査を全部走らせ、**一つでも落ちたら 1 で終わる。**
#
# 一晩に一度、これが無かったせいで**落ちている検査を抱えたまま公開した。**
# for ループで走らせて "FAIL" と印字するだけだと、後ろの `set -e` は反応しない。
# 印字は人が読む前提だが、公開の判断は機械にさせないといけない。
set -u
fail=0

# **ブラウザ側の .js を、モジュールとして構文検査する。**
#
# `node --check play/app.js` は**何も見ていなかった。**
# import を含む `.js` は CommonJS 判定の道へ入り、そこで黙って 0 を返す
# （`.mjs` なら同じ間違いを捕まえる）。実際 2026-08-23、同じ関数の中に
# `const rules` を二重に宣言したまま `--check` を通り、ブラウザで初めて落ちた。
# **検査だと思っていたものが、検査ではなかった。**
for f in play/app.js puzzle/app.js agent-view/app.js agent-view/sync.js graft/app.js control/app.js; do
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
