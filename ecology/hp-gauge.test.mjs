// ecology/hp-gauge.test.mjs — Issue #226.
//
// 残りHPの色とHP内訳の濃淡、区分の角丸を表示契約として固定する。
// DOMを再現するテストではなく、画面が読む純粋な投影のテスト。

import assert from "node:assert/strict";
import {
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

console.log("hp-gauge checks: 8 checks passed");
