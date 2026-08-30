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
// Phase Aの語彙にContent Wave 1の行動5を加えた。
assert.equal(Object.keys(SKILLS.active).length, 21);
assert.equal(Object.keys(SKILLS.reactive).length, 14);
assert.equal(Object.keys(SKILLS.passive).length, 8);
assert.equal(Object.keys(EQUIPMENT).length, 24);
// 既存40ノードにWave 1の反応2を足して42。
// **数そのものより、種類ごとの内訳が動いていないこと**を見る。
assert.equal(SKILL_TREE_NODES.filter((node) => node.kind === "active").length, 21);
assert.equal(SKILL_TREE_NODES.filter((node) => node.kind === "reactive").length, 14);
assert.equal(SKILL_TREE_NODES.filter((node) => node.kind === "passive").length, 8);
assert.equal(SKILL_TREE_NODES.length, 43);

// R6 §6.4 — **どの active 技能も種別を宣言している。**宣言が無いと
// 追撃するのかしないのかが決まらず、支援だけで戦闘が止まりうる。
for (const [id, skill] of Object.entries(PLAYABLE_CONTENT.activeSkills)) {
  assert.ok(
    ["offense", "utility", "channel"].includes(skill.actionMode),
    id + " が actionMode を宣言していない",
  );
}
// 中核の行動は content が名指しし、実在すること。
for (const byReach of Object.values(PLAYABLE_CONTENT.coreActions)) {
  for (const skillId of Object.values(byReach)) {
    assert.ok(PLAYABLE_CONTENT.activeSkills[skillId], skillId + " が無い");
  }
}
// 常設は前提を持たない。**詰み防止なので、いつでも取れなければ意味がない。**
for (const node of SKILL_TREE_NODES.filter((n) => n.kind === "passive" && n.branch === "基礎")) {
  assert.deepEqual(node.requires, [], node.id + " は前提を持たない");
}

// Balance contract: the core normal attack is 100% might. Direct-damage
// skills must beat it when their target condition is true; multi-target and
// multi-hit skills are checked by their full intended payload.
const normalAttackCoefficient = 10_000;
const damageEffect = (skillId) => {
  const skill = PLAYABLE_CONTENT.activeSkills[skillId];
  return skill.effects?.find((effect) => effect.type === "deal_damage")
    ?? skill.preparation?.completionEffects?.find((effect) => effect.type === "deal_damage");
};
assert.ok(PLAYABLE_CONTENT.activeSkills.basic_strike_melee.effects[0].amount.coefficientBps === normalAttackCoefficient);
assert.ok(PLAYABLE_CONTENT.activeSkills.strike.effects[0].amount.coefficientBps > normalAttackCoefficient);
assert.ok(
  damageEffect("rapid_cuts").amount.coefficientBps * damageEffect("rapid_cuts").hitCount > normalAttackCoefficient,
);
for (const skillId of [
  "pierce_thrust", "column_thrust", "guard_crush", "rear_hunt", "finishing_thrust", "crack_mark",
]) {
  assert.ok(
    damageEffect(skillId).amount.coefficientBps > normalAttackCoefficient,
    skillId + " must beat the normal attack when its condition is true",
  );
}
for (const skillId of ["heavy_swing", "long_swing", "hunt_the_slow"]) {
  assert.ok(
    damageEffect(skillId).amount.coefficientBps > normalAttackCoefficient,
    skillId + " completion must beat the normal attack",
  );
}
assert.equal(PLAYABLE_CONTENT.activeSkills.mend.targetQuery.filters.at(-1).type, "hp_percent");
assert.equal(PLAYABLE_CONTENT.activeSkills.mark_target.targetQuery.filters.at(-1).type, "has_status");
assert.equal(PLAYABLE_CONTENT.characters.scout.basicStrikeReach, undefined, "reach must not be assigned by character role");
for (const skillId of [
  "strike", "rapid_cuts", "pierce_thrust", "row_sweep", "column_thrust", "guard_crush",
  "finishing_thrust", "crack_mark", "heavy_swing", "long_swing", "hunt_the_slow",
]) {
  assert.equal(damageEffect(skillId).reach, "melee", skillId + " is melee unless explicitly ranged");
}
assert.equal(damageEffect("rear_hunt").reach, "ranged");
assert.equal(PLAYABLE_CONTENT.activeSkills.rear_strike.effects[0].reach, "ranged");

// An ineligible tactic is skipped without spending AP. If every tactic is
// ineligible, the result must be byte-for-byte the same event stream as an
// actor with no skills equipped; a later eligible tactic is still tried.
const behaviorRoster = ["warden", "mender", "lancer", "scout", "guardian"];
const behaviorFormation = {
  warden: "front_left",
  mender: "rear_left",
  lancer: "front_right",
  scout: "rear_right",
  guardian: "front_center",
};
const noSkillLoadout = freshLoadout(behaviorRoster);
noSkillLoadout.tactics.scout = [];
const impossibleSkillLoadout = freshLoadout(behaviorRoster);
impossibleSkillLoadout.tactics.scout = ["rear_hunt"];
const noSkillResult = simulateBattle(
  makeBattle(1, behaviorRoster, noSkillLoadout, "frontier-skill-fallback", behaviorFormation),
  PLAYABLE_CONTENT,
  PLAYABLE_ENGINE_OPTIONS,
);
const impossibleSkillResult = simulateBattle(
  makeBattle(1, behaviorRoster, impossibleSkillLoadout, "frontier-skill-fallback", behaviorFormation),
  PLAYABLE_CONTENT,
  PLAYABLE_ENGINE_OPTIONS,
);
assert.deepEqual(impossibleSkillResult.events, noSkillResult.events, "an unusable skill must behave like no equipped skill");
assert.ok(
  impossibleSkillResult.events.some(
    (event) => event.type === "action_started" && event.sourceActorId === "a_scout" && event.skillId === "basic_strike_melee",
  ),
  "all unusable tactics must fall through to a normal attack",
);
const nextSkillLoadout = freshLoadout(behaviorRoster);
nextSkillLoadout.tactics.scout = ["rear_hunt", "strike"];
const nextSkillResult = simulateBattle(
  makeBattle(1, behaviorRoster, nextSkillLoadout, "frontier-skill-fallback", behaviorFormation),
  PLAYABLE_CONTENT,
  PLAYABLE_ENGINE_OPTIONS,
);
assert.equal(
  nextSkillResult.events.find((event) => event.type === "action_started" && event.sourceActorId === "a_scout")?.skillId,
  "strike",
  "an ineligible first tactic must yield to the next eligible tactic",
);

// Row position does not grant reach. A rear-positioned scout using an ordinary
// skill or no skill can hit the front anchor, while the explicitly ranged
// skill can select the rear stalker directly.
const normalRearLoadout = freshLoadout(behaviorRoster);
normalRearLoadout.tactics.scout = [];
const normalRearResult = simulateBattle(
  makeBattle(2, behaviorRoster, normalRearLoadout, "frontier-reach-by-skill", behaviorFormation),
  PLAYABLE_CONTENT,
  PLAYABLE_ENGINE_OPTIONS,
);
assert.equal(
  normalRearResult.events.find((event) => event.type === "action_started" && event.sourceActorId === "a_scout")?.skillId,
  "basic_strike_melee",
  "a rear-positioned actor still uses the melee normal attack",
);
assert.deepEqual(
  normalRearResult.events.find((event) => event.type === "target_selected" && event.sourceActorId === "a_scout")?.targetActorIds,
  ["e_harrower"],
  "a normal attack from the rear must target the enemy front row",
);
const frontSkillLoadout = freshLoadout(behaviorRoster);
frontSkillLoadout.tactics.scout = ["strike"];
const frontSkillResult = simulateBattle(
  makeBattle(2, behaviorRoster, frontSkillLoadout, "frontier-reach-by-skill", behaviorFormation),
  PLAYABLE_CONTENT,
  PLAYABLE_ENGINE_OPTIONS,
);
assert.deepEqual(
  frontSkillResult.events.find((event) => event.type === "target_selected" && event.sourceActorId === "a_scout")?.targetActorIds,
  ["e_harrower"],
  "an ordinary skill from the rear must target the enemy front row",
);
const rangedSkillLoadout = freshLoadout(behaviorRoster);
rangedSkillLoadout.tactics.scout = ["rear_hunt"];
const rangedSkillResult = simulateBattle(
  makeBattle(2, behaviorRoster, rangedSkillLoadout, "frontier-reach-by-skill", behaviorFormation),
  PLAYABLE_CONTENT,
  PLAYABLE_ENGINE_OPTIONS,
);
assert.deepEqual(
  rangedSkillResult.events.find((event) => event.type === "target_selected" && event.sourceActorId === "a_scout")?.targetActorIds,
  ["e_stalker"],
  "an explicitly ranged skill may target the enemy rear row",
);

// The final expedition must still distinguish a starter/default answer from a
// deliberate Wave 1 answer after the skill buffs: default tactics fail,
// while a build that attacks the rear, breaks guard and finishes low HP targets
// clears the same fixed encounter.
const defaultFinalResult = simulateBattle(
  makeBattle(7, behaviorRoster, freshLoadout(behaviorRoster), "frontier-balance-final", behaviorFormation),
  PLAYABLE_CONTENT,
  PLAYABLE_ENGINE_OPTIONS,
);
assert.notEqual(
  defaultFinalResult.events.find((event) => event.type === "battle_ended")?.values?.reason,
  "objective_met",
  "the starter/default build must not auto-clear the final expedition",
);
const waveLoadout = freshLoadout(behaviorRoster);
waveLoadout.tactics.warden = ["guard_crush", "strike"];
waveLoadout.tactics.mender = ["mend", "triage"];
waveLoadout.tactics.lancer = ["finishing_thrust", "strike"];
waveLoadout.tactics.scout = ["rear_hunt", "strike"];
waveLoadout.tactics.guardian = ["row_sweep", "column_thrust"];
const waveFinalResult = simulateBattle(
  makeBattle(7, behaviorRoster, waveLoadout, "frontier-balance-final", behaviorFormation),
  PLAYABLE_CONTENT,
  PLAYABLE_ENGINE_OPTIONS,
);
assert.equal(
  waveFinalResult.events.find((event) => event.type === "battle_ended")?.values?.reason,
  "objective_met",
  "a Wave 1 composition must be able to clear the final expedition",
);

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
const stalkerTarget = targetCheck.events.find((event) =>
  event.type === "target_selected" && event.sourceActorId === "e_stalker"
);
assert.ok(stalkerTarget, "the rear attacker must select a target");
const targetedActor = targetCheck.actors.find((actor) =>
  actor.instanceId === stalkerTarget.targetActorIds?.[0] ||
  actor.instanceId === stalkerTarget.targetIds?.[0]
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

console.log("full prototype: roster, formation, 21+14+8 skills, 24 equipment, targeting, 7 stages, deterministic replay passed");
