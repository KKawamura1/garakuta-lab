import { createRun } from "../core/run.mjs";
import { PHASE } from "../core/phase.mjs";
import { makeRng } from "../core/rng.mjs";
import { localSearchPolicy } from "../agents/policies.mjs";

// 画面が出す「この並びの結果」は、実機が出す結果と一字一句同じでなければならない。
// 見積りを本物に置き換えた以上、ここがずれたら嘘をつくことになる。
// 画面と同じ入力（観測から組んだ並び・現在HP・戦闘番号の敵）で引いて、実機の結果と突き合わせる。

const rules = PHASE;
let checked = 0;
let mismatches = 0;

for (let seed = 1; seed <= 60; seed += 1) {
  const policy = localSearchPolicy({ ruleset: rules });
  const run = createRun({ seed, playerId: "verdict-smoke", ruleset: rules });
  let guard = 0;
  while (!run.done && guard < 400) {
    guard += 1;
    const observation = run.observe();
    if (observation.phase === "reward") { run.act(policy.reward(observation)); continue; }
    policy.build(observation).forEach(action => run.act(action));

    // ここが画面と同じ計算。
    const o = run.observe();
    const enemy = rules.ENEMIES[o.battleNumber - 1] || rules.ENEMIES[rules.ENEMIES.length - 1];
    const slots = o.slots.map(x => (x.part ? { id: x.part.id, type: x.part.type } : null));
    const shown = rules.simulateBattle({ slots, hp: o.hp, maxHp: o.maxHp, enemy, rng: makeRng(1) });

    const result = run.act(policy.battle(o));
    if (!result.ok || !result.battle) {
      console.error(`seed ${seed} 第${o.battleNumber}戦 phase=${o.phase} ok=${result.ok} err=${result.error}`);
      break;
    }
    const actual = result.battle;
    checked += 1;
    const same = shown.won === actual.won
      && shown.cycles === actual.cycles
      && shown.hp === actual.hpAfter
      && shown.enemyHp === actual.enemyHpLeft;
    if (!same) {
      mismatches += 1;
      if (mismatches <= 3) {
        console.error(`seed ${seed} 第${o.battleNumber}戦 ${enemy.name}`);
        console.error(`  画面 勝${shown.won} ${shown.cycles}巡 HP${shown.hp} 敵残${shown.enemyHp}`);
        console.error(`  実機 勝${actual.won} ${actual.cycles}巡 HP${actual.hpAfter} 敵残${actual.enemyHpLeft}`);
      }
    }
  }
}

if (mismatches) {
  console.error(`verdict smoke: ${checked}戦中 ${mismatches}戦で画面と実機が食い違った`);
  process.exit(1);
}
console.log(`verdict smoke: 画面の結果表示が実機と完全一致（${checked}戦） OK`);
