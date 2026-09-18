// analysis/ecology-main-action-smoke.mjs
//
// R20 — 無条件の2本目を取っても、現在の主軸の出番を奪わない。
// issue #187 のラウンドロビンでは、踏み込み斬りLv10へ貫き突きLv1を足すだけで
// 10ラウンドの火力が72%まで落ちた。この検査は同じ形を playable content で走らせ、
// 2本目が予備に留まることをイベント列と総量の両方で守る。

import assert from "node:assert/strict";
import { simulateBattle } from "../ecology/engine.mjs";
import { PLAYABLE_CONTENT } from "../ecology/playable-content.mjs";
import { BATTLE_SCHEMA_VERSION } from "../ecology/schema.mjs";

const ROUNDS = 10;

function run(tacticIds) {
  const content = structuredClone(PLAYABLE_CONTENT);
  content.enemyActors.husk = {
    ...content.enemyActors.husk,
    maxHp: 100_000,
    might: 0,
    focus: 0,
    tactics: [],
  };
  const result = simulateBattle({
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: "main_action_smoke",
    maxRounds: ROUNDS,
    objective: { type: "survive_rounds", rounds: ROUNDS },
    allies: [{
      instanceId: "a_warden",
      characterId: "warden",
      position: "front_left",
      tacticMode: "main_action",
      tactics: tacticIds.map((activeSkillId) => ({ activeSkillId, useWhen: [] })),
      reactiveSkillIds: [],
      passiveSkillIds: [],
      equipment: [],
      skillLevels: { steady_cut: 10 },
    }],
    enemies: [{ instanceId: "e_wall", enemyActorId: "husk", position: "front_left" }],
    rngSeed: "main-action-smoke",
  }, content);
  const actions = result.events
    .filter((event) => event.type === "action_declared" && event.sourceActorId === "a_warden")
    .map((event) => event.skillId);
  const damage = result.events
    .filter((event) => event.type === "damage_taken" && event.targetActorIds?.includes("e_wall"))
    .reduce((sum, event) => sum + Number(event.values?.amount ?? 0), 0);
  return { actions, damage };
}

const one = run(["steady_cut"]);
const two = run(["steady_cut", "pierce_thrust"]);
assert.deepEqual(two.actions, one.actions,
  "2本目の無条件行動は、主軸が使える拍に割り込まない");
assert.equal(two.damage, one.damage,
  "2本目をオンにしても主軸の10ラウンド火力を薄めない");
assert.ok(one.actions.length === ROUNDS && one.actions.every((id) => id === "steady_cut"),
  "比較対象は10ラウンドすべて主軸を出している");

console.log(`ecology main action smoke: ${one.damage} damage preserved across ${ROUNDS} rounds`);
