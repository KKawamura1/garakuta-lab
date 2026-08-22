# 起床予約の控え

`send_later` で予約したら、**必ず `.claude/next-wakeup` に発火時刻（RFC3339）を書く。**
`.claude/stop-check-unfinished.sh` がこれを読んで、
「やりかけがあるのに、未来の予約が無い」状態で turn を返そうとしたら止める。

書き忘れると**止められる側に倒れる**ので、安全な向きに壊れる。
