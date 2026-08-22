#!/bin/bash
# ターンを返す瞬間に、やりかけを見つける。
#
# なぜ機械に置くか：2026-08-22、同じ失敗を1時間で2回した。
# 「このあと〇〇をやります」と言って turn を返すと、予約が無いので〇〇は永久に来ない。
# ルールを CLAUDE.md に書いた1時間後に、自分でそれを破った。
# **文書はセッションの最初に読むもので、必要なのは turn を手放す瞬間である。**
# 未コミットを見る hook は同じ日に4回発火して4回とも効いた。置く場所の問題だった。
#
# in_progress だけを見る。pending は「積んである」であって「やりかけ」ではないので、
# それで毎回止めると雑音になる。**着手したと自分で宣言したものだけを咎める。**
input=$(cat)
[[ "$(echo "$input" | jq -r '.stop_hook_active')" = "true" ]] && exit 0

session=$(echo "$input" | jq -r '.session_id // empty')
dir="$HOME/.claude/tasks/$session"
[[ -d "$dir" ]] || exit 0

running=$(grep -l '"status": *"in_progress"' "$dir"/*.json 2>/dev/null | wc -l)
pending=$(grep -l '"status": *"pending"' "$dir"/*.json 2>/dev/null | wc -l)
[[ $((running + pending)) -eq 0 ]] && exit 0

# **未来の起床予約があるなら通す。**
#
# 5回、「このあと〇〇をやります」と言って turn を返し、予約せずに止まった。
# タスクに積んであっても、**積んであるだけでは復帰しない。**復帰の手段は send_later だけである。
# 予約したら発火時刻を .claude/next-wakeup に書く決まりにして、ここで読む。
# 書き忘れたら止まる側に倒れるので、**安全な向きに壊れる。**
marker="${CLAUDE_PROJECT_DIR:-.}/.claude/next-wakeup"
if [[ -f "$marker" ]]; then
  at=$(head -1 "$marker" | tr -d '[:space:]')
  when=$(date -u -d "$at" +%s 2>/dev/null || echo 0)
  [[ "$when" -gt "$(date -u +%s)" ]] && exit 0
fi

# **積んであるだけでも止める。**
#
# 最初は「着手中だけ」を見ていた。すると「これから〇〇をやります」と言って
# タスクを pending のまま turn を返すと素通りする。**実際にそれで止まった。**
# 開いているタスクがあって予約が無いなら、その作業は進まない。例外を作らない。
# 作者の返事待ちなら、長めの予約を取っておけばよい（空振りの起床は安い）。

subjects=$(grep -h -A1 '"id"' "$dir"/*.json 2>/dev/null | true)
names=$(for f in "$dir"/*.json; do
  grep -qE '"status": *"(in_progress|pending)"' "$f" 2>/dev/null && \
    sed -n 's/.*"subject": *"\([^"]*\)".*/  - \1/p' "$f"
done)

cat >&2 <<MSG
終わっていない作業が $((running + pending)) 件あるのに、起床を予約していません：
${names}
次のどれかにしてください。
  1. 終わらせる
  2. 背景で走らせる（Bash の run_in_background）— 終了時に起こされます
  3. send_later で予約し、発火時刻を .claude/next-wakeup に書く
     — 予約しなければ、この作業は二度と再開しません
  4. 作者の返事待ちなら、長めの予約を取る（空振りの起床は安い）
MSG
exit 2
