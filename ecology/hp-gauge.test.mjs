// ecology/hp-gauge.test.mjs — Issue #226.
//
// HP内訳の色を低HP警告へ流用しないことと、区分の角丸を表示契約として
// 固定する。DOMを再現するテストではなく、画面が読む純粋な投影のテスト。

import assert from "node:assert/strict";
import {
  HP_CRITICAL_BPS,
  HP_WARNING_BPS,
  hpAlertFor,
  hpAlertLabelFor,
  hpGaugeCornerRoles,
  hpGaugeState,
} from "./hp-gauge.mjs";

const alive = (hp, extra = {}) => ({ maxHp: 100, hp, alive: true, ...extra });

assert.equal(HP_WARNING_BPS, 5500, "HP注意の境界は55%で固定する");
assert.equal(HP_CRITICAL_BPS, 2500, "HP危険域の境界は25%で固定する");
assert.equal(hpAlertFor(alive(56)), "normal", "56%は通常表示");
assert.equal(hpAlertFor(alive(55)), "warning", "55%以下はHP注意");
assert.equal(hpAlertFor(alive(25)), "critical", "25%以下はHP危険域");
assert.equal(hpAlertFor({ ...alive(0), alive: false }), "normal", "戦闘不能は低HP警告を重ねない");
assert.equal(hpAlertLabelFor("critical"), "HP危険域", "警告のARIA語彙がある");

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

console.log("hp-gauge checks: 12 checks passed");
