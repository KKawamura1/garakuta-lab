// **送る側と受ける側の上限がずれていないか。**
//
// 2026-08-29、ecology は 4000 件で切って送り、functions/api/runs.js は 2000 件で
// 弾いていた。5区画も遊べば戦闘イベントが 2000 を超えるので、**長く遊んだ記録ほど
// D1 に残らない。**しかも画面には「端末に保存しました（D1未送信）」としか出ず、
// 送信そのものは成功したように見える。公開先で通しを踏むまで誰も気づかなかった。
//
// 散文で「揃えること」と書いても落ちるので、両方のファイルから実際の数を読んで比べる。

import { readFileSync } from "node:fs";

const app = readFileSync("ecology/app.js", "utf8");
const api = readFileSync("functions/api/runs.js", "utf8");

const num = (text, pattern, what) => {
  const found = text.match(pattern);
  if (!found) {
    console.error(`ecology-upload smoke: ${what} を読めなかった（${pattern}）。`
      + "定数の書き方を変えたなら、この検査も一緒に直すこと。");
    process.exit(1);
  }
  return Number(found[1].replace(/_/g, ""));
};

const clientEvents = num(app, /const MAX_SENT_EVENTS = (\d[\d_]*);/, "ecology 側のイベント上限");
const clientBytes = num(app, /const MAX_SENT_BYTES = (\d[\d_]*);/, "ecology 側のバイト上限");
const serverEvents = num(api, /payload\.events\.length <= (\d[\d_]*)/, "サーバ側のイベント上限");
const serverBytes = num(api, /const MAX_BODY_BYTES = (\d[\d_]*);/, "サーバ側のバイト上限");

const problems = [];
if (clientEvents > serverEvents) {
  problems.push(`イベント上限: ecology が ${clientEvents} 件送るのに、サーバは ${serverEvents} 件で弾く。`
    + " 長く遊んだランほど invalid_payload になり、D1 に1行も残らない。");
}
if (clientBytes > serverBytes) {
  problems.push(`本体の大きさ: ecology が ${clientBytes} バイトまで送るのに、`
    + `サーバは ${serverBytes} バイトで弾く（413）。`);
}

if (problems.length) {
  console.error("ecology-upload smoke:\n  " + problems.join("\n  "));
  console.error("\n  直すのは ecology/app.js 側の上限。サーバ側を緩めて通さない"
    + "（D1 の1行が大きくなるだけで、記録は増えない）。");
  process.exit(1);
}

console.log(`ecology-upload smoke: 送信上限は整合している`
  + `（イベント ${clientEvents}/${serverEvents} 件、本体 ${clientBytes}/${serverBytes} バイト）`);
