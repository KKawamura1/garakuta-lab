// ecology/hp-gauge.test.mjs — Issue #226 と、絶対尺度（作者要望 2026-09-12）。
//
// 残りHPの警告色とHP内訳の濃淡、区分の角丸、そして**バー1本＝100HPの絶対尺度**
// （本の色・容量・控えの四角・畳み）を表示契約として固定する。
// DOMを再現するテストではなく、画面が読む純粋な投影のテスト。

import assert from "node:assert/strict";
import {
  HP_BAR_MARKER_LIMIT,
  HP_BAR_UNIT,
  hpBarCornerRoles,
  hpBarCount,
  hpBarToneFor,
  hpGaugeBar,
  hpGaugeCornerRoles,
  hpGaugeState,
  hpToneFor,
} from "./hp-gauge.mjs";

const alive = (hp, extra = {}) => ({ maxHp: 100, hp, alive: true, ...extra });

assert.equal(hpToneFor(alive(56)), "green", "56%は緑の主色");
assert.equal(hpToneFor(alive(55)), "yellow", "26〜55%は黄色の主色");
assert.equal(hpToneFor(alive(25)), "red", "25%以下は赤の主色");

const recoveryActor = alive(80, {
  recoveredDamage: 10,
  recoverableDamage: 10,
});
const damagedAndRecovering = hpGaugeState(recoveryActor);
assert.deepEqual(
  damagedAndRecovering,
  { maxHp: 100, currentHp: 80, green: 70, recovered: 10, recoverable: 10, unrecoverable: 10 },
  "4区分は最大HP幅を埋め、現在HPと回復内訳を分離する",
);
assert.equal(
  damagedAndRecovering.green
    + damagedAndRecovering.recovered
    + damagedAndRecovering.recoverable
    + damagedAndRecovering.unrecoverable,
  damagedAndRecovering.maxHp,
  "4区分の合計は常に最大HPになる",
);

assert.deepEqual(
  hpGaugeCornerRoles(recoveryActor),
  { leftRound: "green", rightRound: "recoverable" },
  "左端と赤の終端（赤黒境界）だけを丸める",
);
assert.deepEqual(
  hpGaugeCornerRoles(alive(80, { recoverableDamage: 0 })),
  { leftRound: "green", rightRound: "green" },
  "赤が無いときは黒の手前の非黒区分を終端にする",
);
assert.deepEqual(
  hpGaugeCornerRoles({ maxHp: 100, hp: 0, alive: false }),
  { leftRound: "unrecoverable", rightRound: "unrecoverable" },
  "全損時は黒区分だけが外側になる",
);


// ---------------------------------------------------------------- 絶対尺度（作者要望 2026-09-12）

assert.equal(HP_BAR_UNIT, 100, "1本は100HP");
assert.deepEqual(
  [0, 1, 2, 3, 4, 9].map(hpBarToneFor),
  ["red", "yellow", "green", "blue", "violet", "violet"],
  "本の色は0〜100赤・100〜200黄・200〜300緑・300〜400青で、400以上は紫のまま",
);
assert.deepEqual(
  [0, 1, 100, 101, 250, 300].map(hpBarCount),
  [1, 1, 1, 2, 3, 3],
  "本数は最大HPを100で切り上げ、0でも1本は描く",
);

const wardenFull = hpGaugeBar({ maxHp: 300, hp: 300, alive: true });
assert.equal(wardenFull.activeTier, 2, "300/300は3本目（200〜300）に居る");
assert.equal(wardenFull.tone, "green", "3本目は緑");
assert.equal(wardenFull.capacity, 100, "満たされた本の容量は100");
assert.equal(wardenFull.green, 100, "満タンの本は緑で埋まる");
assert.deepEqual(
  wardenFull.markers.map((marker) => [marker.tier, marker.state, marker.tone]),
  [[0, "stock", "red"], [1, "stock", "yellow"]],
  "下の満タン2本は控えの四角として並ぶ",
);

// **同じ絶対HPは、最大HPが違っても同じ長さで描かれる。**割合ゲージを絶対尺度へ
// 変えた理由そのもの。ゴウ(300)の260とだれか(200)の160は、どちらも本の中で60。
const wardenHit = hpGaugeBar({ maxHp: 300, hp: 260, alive: true });
const smallerHit = hpGaugeBar({ maxHp: 200, hp: 160, alive: true });
assert.equal(wardenHit.unit, smallerHit.unit, "1pxが表すHPは全員で同じ");
assert.equal(wardenHit.green, smallerHit.green,
  "最大HPが違っても、同じ40ダメージは同じ幅だけ削る");
assert.equal(wardenHit.unrecoverable, smallerHit.unrecoverable,
  "欠けた量も同じ幅で描かれる");

// 描かれる量の合計は必ず現在HPになる（＝盤面の総量がそのまま絶対HP）。
for (const actor of [
  { maxHp: 300, hp: 260, alive: true },
  { maxHp: 110, hp: 70, alive: true },
  { maxHp: 648, hp: 421, alive: true },
  { maxHp: 96, hp: 96, alive: true },
]) {
  const bar = hpGaugeBar(actor);
  assert.equal(
    bar.stockCount * bar.unit + bar.green + bar.recovered,
    bar.currentHp,
    "控えの四角と本の中の残量を足すと現在HPになる",
  );
}

// 端数の本は容量そのものが小さいので、バーの実寸も短くなる（＝最大HPが読める）。
const menderFull = hpGaugeBar({ maxHp: 110, hp: 110, alive: true });
assert.equal(menderFull.activeTier, 1, "110/110は2本目に居る");
assert.equal(menderFull.capacity, 10, "最上位の本だけ端数の容量になる");
assert.equal(menderFull.green, 10, "端数の本は端数ぶんだけ満ちる");

// 本の境目。100ちょうどは「赤の満タン」であって「黄の空」ではない。
const exactlyOneBar = hpGaugeBar({ maxHp: 300, hp: 100, alive: true });
assert.equal(exactlyOneBar.activeTier, 0, "100ちょうどは1本目に居る");
assert.equal(exactlyOneBar.green, 100, "1本目は満タンで、空の2本目にはしない");
assert.deepEqual(
  exactlyOneBar.markers.map((marker) => marker.state),
  ["lost", "lost"],
  "使い切った上の本は失われた四角として残り、最大HPが読める",
);

// 回復窓が本をまたぐときは、またいだ先の四角が「まだ戻せる本」を名乗る。
const acrossBars = hpGaugeBar({
  maxHp: 300, hp: 180, alive: true, recoveredDamage: 20, recoverableDamage: 60,
});
assert.equal(acrossBars.activeTier, 1, "180は2本目");
assert.equal(acrossBars.recovered, 20, "同じ攻撃で回復した分は本の中に残る");
assert.equal(acrossBars.recoverable, 20, "本の中に入る回復可能分だけを区分にする");
assert.equal(
  acrossBars.green + acrossBars.recovered + acrossBars.recoverable + acrossBars.unrecoverable,
  acrossBars.capacity,
  "4区分の合計はその本の容量になる",
);
assert.deepEqual(
  acrossBars.markers.map((marker) => [marker.tier, marker.state]),
  [[0, "stock"], [2, "recoverable"]],
  "本をまたぐ回復窓は、上の四角が回復可能として受け持つ",
);

const closedWindow = hpGaugeBar({ maxHp: 300, hp: 180, alive: true, recoverableDamage: 0 });
assert.deepEqual(
  closedWindow.markers.map((marker) => marker.state),
  ["stock", "lost"],
  "回復窓が閉じた本は失われた四角になる",
);

// 戦闘不能。回復窓は閉じ、控えの本も残らない。
const defeated = hpGaugeBar({ maxHp: 300, hp: 0, alive: false, recoverableDamage: 40 });
assert.equal(defeated.activeTier, 0, "全損時は1本目を描く");
assert.equal(defeated.unrecoverable, 100, "全損時の本は回復不能で埋まる");
assert.equal(defeated.stockCount, 0, "控えの本は残らない");
assert.deepEqual(
  hpBarCornerRoles(defeated),
  { leftRound: "unrecoverable", rightRound: "unrecoverable" },
  "全損時は黒区分だけが外側になる",
);

// 四角が並びきらない盤面は `◼×N` へ畳む。
const boss = hpGaugeBar({ maxHp: 648, hp: 648, alive: true });
assert.equal(boss.tierCount, 7, "648HPは7本");
assert.equal(boss.tone, "violet", "5本目以降は紫のまま");
assert.equal(boss.markers.length, HP_BAR_MARKER_LIMIT, "控えは6本");
assert.equal(boss.compact, false, "上限ちょうどまでは四角を並べる");
assert.equal(hpGaugeBar({ maxHp: 750, hp: 750, alive: true }).compact, true,
  "上限を超えたら畳む");

assert.deepEqual(
  hpBarCornerRoles(hpGaugeBar({ maxHp: 300, hp: 260, alive: true, recoverableDamage: 40 })),
  { leftRound: "green", rightRound: "recoverable" },
  "本の中でも左端と赤の終端だけを丸める",
);

console.log("hp-gauge checks: 35 checks passed");
