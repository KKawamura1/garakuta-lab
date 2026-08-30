import assert from "node:assert/strict";
import { simulateBattle, validateBattleInput, validateContentBundle } from "./engine.mjs";
import { PLAYABLE_CONTENT } from "./playable-content.mjs";
import {
  CHARACTER_OPTIONS,
  EQUIPMENT,
  SKILLS,
  SKILL_TREE_NODES,
  equipEquipment,
  equipSkill,
  freshLoadout,
  makeBattle,
  removeSkill,
} from "./playable-battles.mjs";

const PLAYABLE_ENGINE_OPTIONS = { equipmentBreaks: false, captureReplaySnapshots: true };

assert.deepEqual(validateContentBundle(PLAYABLE_CONTENT), []);
assert.equal(CHARACTER_OPTIONS.length, 8);
assert.equal(Object.keys(SKILLS.active).length, 12);
assert.equal(Object.keys(SKILLS.reactive).length, 12);
assert.equal(Object.keys(EQUIPMENT).length, 18);
// PHASE A: 24（行動12＋反応12）に、R6 §6.8 の常設 fallback 7 を足して31。
// **数そのものより、種類ごとの内訳が動いていないこと**を見る。
assert.equal(SKILL_TREE_NODES.filter((node) => node.kind === "active").length, 12);
assert.equal(SKILL_TREE_NODES.filter((node) => node.kind === "reactive").length, 12);
assert.equal(SKILL_TREE_NODES.filter((node) => node.kind === "passive").length, 7);
assert.equal(SKILL_TREE_NODES.length, 31);
// 常設は前提を持たない。**詰み防止なので、いつでも取れなければ意味がない。**
for (const node of SKILL_TREE_NODES.filter((n) => n.kind === "passive")) {
  assert.deepEqual(node.requires, [], node.id + " は前提を持たない");
}

for (const [id, skill] of Object.entries(SKILLS.active)) {
  assert.ok(PLAYABLE_CONTENT.activeSkills[id], id + " must point at real active content");
  assert.ok(skill.effect.length > 0);
}
for (const [id, skill] of Object.entries(SKILLS.reactive)) {
  assert.ok(PLAYABLE_CONTENT.reactiveSkills[id], id + " must point at real reactive content");
  assert.ok(skill.effect.length > 0);
}

const roster = ["warden", "mender", "lancer", "scout"];
let loadout = freshLoadout(roster);
loadout = removeSkill(loadout, "warden", "strike", "active").loadout;
loadout = removeSkill(loadout, "warden", "cover_ally", "reactive").loadout;
let next = equipSkill(loadout, "warden", "steady_aim", "active");
assert.equal(next.ok, true);
loadout = next.loadout;
next = equipSkill(loadout, "warden", "counter_blow", "reactive");
assert.equal(next.ok, true);
loadout = next.loadout;
next = equipEquipment(loadout, "warden", "standing_plate", 0);
assert.equal(next.ok, true);
loadout = next.loadout;
next = equipEquipment(loadout, "mender", "worn_greaves", 1);
assert.equal(next.ok, true);
loadout = next.loadout;
assert.deepEqual(loadout.equipment.warden, ["standing_plate"]);
assert.deepEqual(loadout.equipment.mender, ["worn_greaves"]);

const formation = {
  warden: "rear_right",
  mender: "front_left",
  lancer: "front_right",
  scout: "rear_left",
};
const firstBattle = makeBattle(
  2,
  roster,
  loadout,
  "frontier-test",
  formation,
  { hp: {}, equipmentDurability: {} },
);
assert.deepEqual(validateBattleInput(firstBattle, PLAYABLE_CONTENT), []);
assert.deepEqual(
  Object.fromEntries(firstBattle.allies.map((ally) => [ally.characterId, ally.position])),
  formation,
);

for (let stage = 1; stage <= 7; stage += 1) {
  const battle = makeBattle(stage, roster, loadout, "frontier-test", formation);
  assert.deepEqual(validateBattleInput(battle, PLAYABLE_CONTENT), [], "stage " + stage);
  const first = simulateBattle(battle, PLAYABLE_CONTENT, PLAYABLE_ENGINE_OPTIONS);
  const second = simulateBattle(battle, PLAYABLE_CONTENT, PLAYABLE_ENGINE_OPTIONS);
  assert.deepEqual(first, second, "stage " + stage + " must replay deterministically");
  assert.ok(first.events.length > 0);
  assert.equal(first.replaySnapshots.length, first.events.length);
}

const terminalResult = simulateBattle(
  makeBattle(1, roster, loadout, "frontier-terminal", formation),
  PLAYABLE_CONTENT,
  PLAYABLE_ENGINE_OPTIONS,
);
const lastEnemyDefeat = Math.max(
  ...terminalResult.events.map((event, index) =>
    event.type === "actor_defeated" && event.values?.side === "enemy" ? index : -1
  ),
);
const battleEnded = terminalResult.events.findIndex(
  (event, index) => index > lastEnemyDefeat && event.type === "battle_ended",
);
assert.ok(battleEnded > lastEnemyDefeat, "battle must end after the final enemy defeat");
assert.equal(
  terminalResult.events
    .slice(lastEnemyDefeat + 1, battleEnded)
    .some((event) => ["actor_activated", "action_declared", "target_selected", "action_started"].includes(event.type)),
  false,
  "no new actor action may start after the final enemy defeat",
);

// The original R5 fixture contains an intentionally free-looping idle_shuffle.
// The playable bundle must keep old saves safe and must not make the pivot's
// starter build hit the engine's event cap.
const pivotRoster = ["warden", "mender", "lancer", "pivot"];
const pivotFormation = {
  warden: "front_left",
  mender: "rear_left",
  lancer: "front_right",
  pivot: "rear_right",
};
const pivotBattle = makeBattle(1, pivotRoster, freshLoadout(pivotRoster), "frontier-pivot", pivotFormation);
const pivotResult = simulateBattle(pivotBattle, PLAYABLE_CONTENT, PLAYABLE_ENGINE_OPTIONS);
assert.ok(pivotResult.events.length < 4096, "pivot starter build must not hit the event cap");

const legacyLoadout = freshLoadout(pivotRoster);
legacyLoadout.tactics.pivot = ["idle_shuffle", "strike"];
const legacyBattle = makeBattle(1, pivotRoster, legacyLoadout, "frontier-legacy", pivotFormation);
const legacyResult = simulateBattle(legacyBattle, PLAYABLE_CONTENT, PLAYABLE_ENGINE_OPTIONS);
assert.ok(legacyResult.events.length < 4096, "old idle_shuffle saves must remain safe");

const targetCheck = simulateBattle(firstBattle, PLAYABLE_CONTENT, PLAYABLE_ENGINE_OPTIONS);
const marksmanTarget = targetCheck.events.find((event) =>
  event.type === "target_selected" && event.sourceActorId === "e_marksman"
);
assert.ok(marksmanTarget, "the rear attacker must select a target");
const targetedActor = targetCheck.actors.find((actor) =>
  actor.instanceId === marksmanTarget.targetActorIds?.[0] ||
  actor.instanceId === marksmanTarget.targetIds?.[0]
);
assert.equal(targetedActor?.position, "rear_left");

const depletedLoadout = freshLoadout(roster);
const depletedEquip = equipEquipment(depletedLoadout, "warden", "hungry_plate", 0);
assert.equal(depletedEquip.ok, true);
const depletedBattle = makeBattle(
  1,
  roster,
  depletedEquip.loadout,
  "frontier-depleted",
  formation,
  { hp: {}, equipmentDurability: { hungry_plate: 1 } },
);
const depletedResult = simulateBattle(depletedBattle, PLAYABLE_CONTENT, PLAYABLE_ENGINE_OPTIONS);
const depletedItem = depletedResult.equipment.find((item) => item.equipmentId === "hungry_plate");
assert.equal(depletedItem?.durability, 0, "playable equipment may be depleted during a battle");
assert.equal(depletedItem?.broken, false, "playable equipment must not be marked broken");
assert.equal(
  depletedResult.events.some((event) => event.type === "equipment_broken"),
  false,
  "playable depletion must not emit a break event",
);
assert.equal(depletedResult.replaySnapshots.length, depletedResult.events.length);

console.log("full prototype: roster, formation, 12+12 skills, 18 equipment, targeting, 7 stages, deterministic replay passed");
