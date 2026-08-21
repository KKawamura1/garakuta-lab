import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
const serviceWorker = await readFile(new URL("../sw.js", import.meta.url), "utf8");

assert.match(source, /const GAME_VERSION = "arc-0\.1"/);
assert.match(source, /const TELEMETRY_SCHEMA = 4/);
assert.match(source, /prediction_resolved/);
assert.match(source, /battle_prediction_selected/);
assert.match(source, /runStory/);
assert.match(source, /replayReason/);

for (const prediction of ["負けそう", "ギリギリ", "勝てそう", "圧勝"]) {
  assert.match(html, new RegExp(`data-prediction="${prediction}"`));
}
assert.match(html, /name="runStory"/);
assert.match(html, /name="replayReason"/);

// ARC 0.1は初期OBS 0.1の対照実験なので、後の調整値へ戻っていないことを固定する。
assert.match(source, /熱を1冷まし、電力を2得る/);
assert.match(source, /さらに装甲＋3/);
assert.match(source, /damage: 2 \+ cooled,/);
assert.match(source, /damage: 2 \+ used \* 2,/);
// キャッシュ名から arc を外した（この場所は複数のルールセットを載せるようになった）。
// 見るべきは版が上がっていることだけなので、番号の有無だけを確かめる。
assert.match(serviceWorker, /garakuta-lab-v\d+/);

// 存在しないパスへ index.html を返すと、相対パスのCSS/JSだけが404になり
// 「読み込めていないのに動いて見える」壊れ方をする。ルート文書だけに限定する。
assert.match(serviceWorker, /isRootDocument/);
assert.ok(!/cached \|\| caches\.match\("\.\/index\.html"\)/.test(serviceWorker), "無条件のindex.html退避を持たない");

console.log("arc smoke: OBS 0.1 rules, prediction telemetry, end survey, cache version OK");
