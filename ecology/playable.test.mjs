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

assert.deepEqual(validateContentBundle(PLAYABLE_CONTENT), []);
assert.equal(CHARACTER_OPTIONS.length, 8);
assert.equal(Object.keys(SKILLS.active).length, 12);
assert.equal(Object.keys(SKILLS.reactive).length, 12);
assert.equal(Object.keys(EQUIPMENT).length, 18);
assert.equal(SKILL_TREE_NODES.length, 24);

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
  const first = simulateBattle(battle, PLAYABLE_CONTENT);
  const second = simulateBattle(battle, PLAYABLE_CONTENT);
  assert.deepEqual(first, second, "stage " + stage + " must replay deterministically");
  assert.ok(first.events.length > 0);
}

const targetCheck = simulateBattle(firstBattle, PLAYABLE_CONTENT);
const marksmanTarget = targetCheck.events.find((event) =>
  event.type === "target_selected" && event.sourceActorId === "e_marksman"
);
assert.ok(marksmanTarget, "the rear attacker must select a target");
const targetedActor = targetCheck.actors.find((actor) =>
  actor.instanceId === marksmanTarget.targetActorIds?.[0] ||
  actor.instanceId === marksmanTarget.targetIds?.[0]
);
assert.equal(targetedActor?.position, "rear_left");

console.log("full prototype: roster, formation, 12+12 skills, 18 equipment, targeting, 7 stages, deterministic replay passed");
