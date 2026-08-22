#!/bin/bash
# **作業ツリーが巻き戻っていないか。**
#
# コンテナ再起動で、作業ディレクトリが古い commit に戻ることがある（2026-08-22 までに3回）。
# 3回目は、修正が効かない理由を追いかけている途中で気づくまで数十分かかった。
# 気づくのが遅れると、**巻き戻った土台の上に新しい編集を重ねてしまう**（実際にそうなった）。
#
# HEAD が origin より後ろにいたら止める。push 済みのものが手元から消えている状態なので、
# **編集を続ける前に復旧しないと、混成のまま作業が進む。**
input=$(cat)
[[ "$(echo "$input" | jq -r '.stop_hook_active')" = "true" ]] && exit 0
git rev-parse --git-dir >/dev/null 2>&1 || exit 0
[[ -z "$(git remote)" ]] && exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
[[ -z "$branch" || "$branch" = "HEAD" ]] && exit 0
upstream="origin/$branch"
git rev-parse --verify --quiet "$upstream" >/dev/null 2>&1 || exit 0

# HEAD が upstream の先祖 かつ 別物 ＝ 手元が後ろにいる
if git merge-base --is-ancestor HEAD "$upstream" 2>/dev/null && \
   [[ "$(git rev-parse HEAD)" != "$(git rev-parse "$upstream")" ]]; then
  behind=$(git rev-list --count "HEAD..$upstream" 2>/dev/null)
  cat >&2 <<MSG
**作業ツリーが巻き戻っています。** HEAD が $upstream より ${behind} commit 後ろです。
  手元: $(git log --oneline -1 HEAD)
  遠隔: $(git log --oneline -1 "$upstream")

コンテナ再起動で古い commit に戻る事故が過去に3回起きています。
**編集を続ける前に復旧してください**（そうしないと古い土台の上に重ねることになります）:
  git stash -u            # 手元の編集があれば退避
  git reset --hard $upstream
  git stash pop           # 退避したものを戻す
MSG
  exit 2
fi
exit 0
