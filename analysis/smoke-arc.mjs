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
assert.match(serviceWorker, /garakuta-lab-arc-v1/);

console.log("arc smoke: OBS 0.1 rules, prediction telemetry, end survey, cache version OK");
