// PR #288 の現在仕様を、実データの境界で固定する smoke test.

import assert from "node:assert/strict";
import {
  CHARACTER_DEFINITIONS,
  ENEMY_ACTIVE_SKILLS,
  ENEMY_REACTIVE_SKILLS,
  PLAYABLE_CONTENT,
  EQUIPMENT_PACKS,
  WEAPON_SKILL_PACKS,
  WEAPON_SKILL_TREE_NODES,
} from "../ecology/content/index.mjs";
import { validateContentBundle } from "../ecology/validate.mjs";
import { freshLoadout } from "../ecology/playable-battles.mjs";

const playerSkillIds = new Set([
  ...Object.keys(PLAYABLE_CONTENT.activeSkills),
  ...Object.keys(PLAYABLE_CONTENT.targetSkills),
  ...Object.keys(PLAYABLE_CONTENT.reactiveSkills),
  ...Object.keys(PLAYABLE_CONTENT.passiveSkills),
]);
const enemyActiveIds = new Set();
const enemyReactiveIds = new Set();

for (const character of CHARACTER_DEFINITIONS) {
  const loadout = freshLoadout([character.id]);
  const tactics = loadout.tactics[character.id] ?? [];
  const reactives = loadout.reactives[character.id] ?? [];
  const passives = loadout.passives[character.id] ?? [];
  assert.equal(tactics.length, 2, character.id + " の初期Rは代表武器2つ");
  assert.equal(reactives.length, 0, character.id + " の初期リアクティブは空");
  assert.equal(passives.length, 2, character.id + " の初期A1は代表武器2つ");
  assert.equal(new Set([...tactics, ...passives]).size, 4, character.id + " の初期技能は4つ");
  for (const skillId of [...tactics, ...passives]) {
    assert.ok(playerSkillIds.has(skillId), character.id + " の初期技能がplayer registryにない: " + skillId);
    assert.ok(WEAPON_SKILL_TREE_NODES.some((node) => node.skillId === skillId),
      character.id + " の初期技能が武器ツリーにない: " + skillId);
    assert.ok(!Object.hasOwn(ENEMY_ACTIVE_SKILLS, skillId) && !Object.hasOwn(ENEMY_REACTIVE_SKILLS, skillId),
      character.id + " の初期技能がenemy registryへ混入: " + skillId);
  }
}

for (const actor of Object.values(PLAYABLE_CONTENT.enemyActors)) {
  for (const tactic of actor.tactics ?? []) {
    assert.ok(Object.hasOwn(ENEMY_ACTIVE_SKILLS, tactic.activeSkillId),
      actor.id + " の敵activeがenemy registryにない: " + tactic.activeSkillId);
    enemyActiveIds.add(tactic.activeSkillId);
  }
  for (const skillId of actor.reactiveSkillIds ?? []) {
    assert.ok(Object.hasOwn(ENEMY_REACTIVE_SKILLS, skillId),
      actor.id + " の敵reactiveがenemy registryにない: " + skillId);
    enemyReactiveIds.add(skillId);
  }
}
assert.deepEqual([...enemyActiveIds].sort(), Object.keys(ENEMY_ACTIVE_SKILLS).sort(),
  "enemy active registryに未使用技能が残っている");
assert.deepEqual([...enemyReactiveIds].sort(), Object.keys(ENEMY_REACTIVE_SKILLS).sort(),
  "enemy reactive registryに未使用技能が残っている");

for (const pack of EQUIPMENT_PACKS) {
  assert.equal(pack.kind, "equipment", pack.id + " は装備pack");
  assert.ok(!Object.keys(pack).some((key) => /Skill|skill/.test(key)),
    pack.id + " に技能欄が混ざっている");
}
for (const pack of WEAPON_SKILL_PACKS) {
  assert.equal(pack.kind, "skill", pack.id + " は技能pack");
  assert.ok(typeof pack.weaponId === "string", pack.id + " に武器IDがない");
  assert.ok(!Object.keys(pack).some((key) => /equipment|Equipment/.test(key)),
    pack.id + " に装備欄が混ざっている");
}

assert.deepEqual(validateContentBundle(PLAYABLE_CONTENT), [], "現行content bundleがvalidatorを通る");
console.log("ecology weapon-loadout smoke: ok");

