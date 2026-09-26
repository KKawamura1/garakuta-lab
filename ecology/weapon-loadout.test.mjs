import assert from "node:assert/strict";
import {
  WEAPON_LOADOUT_SCHEMA_VERSION,
  WEAPON_SKILL_NODES,
  addWeaponPrioritySkill,
  freshWeaponSkillLoadout,
  moveWeaponPrioritySkill,
  removeWeaponPrioritySkill,
  selectPrimaryWeaponSkill,
  validateWeaponSkillLoadout,
} from "./weapon-loadout.mjs";

const skillsOf = (kind, count) => Object.values(WEAPON_SKILL_NODES)
  .filter((node) => node.kind === kind)
  .slice(0, count)
  .map((node) => node.key);

const [activeA, activeB] = skillsOf("active", 2);
const [reactiveA, reactiveB] = skillsOf("reactive", 2);
const [targetA, targetB] = skillsOf("target", 2);
const [passive] = skillsOf("passive", 1);
assert.equal(Object.keys(WEAPON_SKILL_NODES).length, 190, "全190節に一意なカタログ位置キーを割り当てる");
const acquired = {
  gou: [activeA, activeB, reactiveA, reactiveB, targetA, targetB, passive],
  tsugumi: [activeB],
};

const fresh = freshWeaponSkillLoadout(["gou", "tsugumi"]);
assert.equal(fresh.schemaVersion, WEAPON_LOADOUT_SCHEMA_VERSION);
assert.deepEqual(fresh.primarySkillByCharacter, { gou: null, tsugumi: null });
assert.deepEqual(fresh.reactivePriorityByCharacter, { gou: [], tsugumi: [] });
assert.deepEqual(fresh.targetPriorityByCharacter, { gou: [], tsugumi: [] });
assert.equal("passiveSkillIdsByCharacter" in fresh, false, "取得済みpassiveは個別装着せず、すべて適用する");
assert.equal(validateWeaponSkillLoadout(fresh, { characterIds: ["gou", "tsugumi"] }).valid, true);

const selected = selectPrimaryWeaponSkill(fresh, "gou", activeA, acquired);
assert.equal(selected.ok, true);
assert.equal(selected.loadout.primarySkillByCharacter.gou, activeA);
const replaced = selectPrimaryWeaponSkill(selected.loadout, "gou", activeB, acquired);
assert.equal(replaced.ok, true);
assert.equal(replaced.loadout.primarySkillByCharacter.gou, activeB, "主軸は常に一つだけ");
assert.equal(fresh.primarySkillByCharacter.gou, null, "変更前のロードアウトは変更しない");
assert.equal(selectPrimaryWeaponSkill(replaced.loadout, "gou", null).loadout.primarySkillByCharacter.gou, null);
assert.equal(selectPrimaryWeaponSkill(fresh, "missing", activeA, acquired).code, "unknown_character");
assert.equal(selectPrimaryWeaponSkill(fresh, "gou", reactiveA, acquired).code, "wrong_skill_kind");
assert.equal(selectPrimaryWeaponSkill(fresh, "gou", passive, acquired).code, "wrong_skill_kind");
assert.equal(selectPrimaryWeaponSkill(fresh, "gou", activeA, { gou: [] }).code, "skill_not_unlocked");
assert.equal(selectPrimaryWeaponSkill(fresh, "gou", "old_skill_id", acquired).code, "unknown_skill");

let priority = addWeaponPrioritySkill(fresh, "gou", reactiveA, acquired);
assert.equal(priority.ok, true);
priority = addWeaponPrioritySkill(priority.loadout, "gou", reactiveB, acquired);
priority = addWeaponPrioritySkill(priority.loadout, "gou", targetA, acquired);
priority = addWeaponPrioritySkill(priority.loadout, "gou", targetB, acquired);
assert.equal(priority.ok, true);
assert.deepEqual(priority.loadout.reactivePriorityByCharacter.gou, [reactiveA, reactiveB]);
assert.deepEqual(priority.loadout.targetPriorityByCharacter.gou, [targetA, targetB]);
assert.equal(addWeaponPrioritySkill(priority.loadout, "gou", reactiveA, acquired).code, "already_equipped");
assert.equal(addWeaponPrioritySkill(priority.loadout, "gou", activeA, acquired).code, "wrong_skill_kind");
assert.equal(addWeaponPrioritySkill(priority.loadout, "gou", passive, acquired).code, "wrong_skill_kind");
assert.equal(addWeaponPrioritySkill(fresh, "gou", reactiveA, { gou: [] }).code, "skill_not_unlocked");

const reordered = moveWeaponPrioritySkill(priority.loadout, "gou", "reactive", 1, 0);
assert.equal(reordered.ok, true);
assert.deepEqual(reordered.loadout.reactivePriorityByCharacter.gou, [reactiveB, reactiveA]);
assert.deepEqual(priority.loadout.reactivePriorityByCharacter.gou, [reactiveA, reactiveB]);
assert.equal(moveWeaponPrioritySkill(priority.loadout, "gou", "active", 1, 0).code, "wrong_skill_kind");
assert.equal(moveWeaponPrioritySkill(priority.loadout, "gou", "target", 0, 9).code, "invalid_priority_index");

const removed = removeWeaponPrioritySkill(priority.loadout, "gou", reactiveA);
assert.equal(removed.ok, true);
assert.deepEqual(removed.loadout.reactivePriorityByCharacter.gou, [reactiveB]);
assert.equal(removeWeaponPrioritySkill(removed.loadout, "gou", reactiveA).code, "not_equipped");

assert.equal(
  validateWeaponSkillLoadout(priority.loadout, {
    characterIds: ["gou", "tsugumi"],
    unlockedSkillKeysByCharacter: acquired,
  }).valid,
  true,
);
const wrongKind = {
  ...priority.loadout,
  targetPriorityByCharacter: {
    ...priority.loadout.targetPriorityByCharacter,
    gou: [activeA],
  },
};
assert.ok(validateWeaponSkillLoadout(wrongKind).errors.some((error) => error.code === "wrong_skill_kind"));
const duplicated = {
  ...priority.loadout,
  reactivePriorityByCharacter: { ...priority.loadout.reactivePriorityByCharacter, gou: [reactiveA, reactiveA] },
};
assert.ok(validateWeaponSkillLoadout(duplicated).errors.some((error) => error.code === "duplicate_skill"));
const lockedInSave = {
  ...priority.loadout,
  primarySkillByCharacter: { ...priority.loadout.primarySkillByCharacter, gou: activeA },
};
assert.ok(validateWeaponSkillLoadout(lockedInSave, { unlockedSkillKeysByCharacter: { gou: [] } })
  .errors.some((error) => error.code === "skill_not_unlocked"));
assert.ok(validateWeaponSkillLoadout({ ...fresh, schemaVersion: "ecology-weapon-loadout-0" })
  .errors.some((error) => error.code === "unsupported_version"));
assert.ok(validateWeaponSkillLoadout({ ...fresh, passiveSkillIdsByCharacter: { gou: [passive], tsugumi: [] } })
  .errors.some((error) => error.code === "unknown_loadout_field"), "未定義の欄を読み飛ばさない");
assert.ok(validateWeaponSkillLoadout(fresh, { characterIds: ["gou"] })
  .errors.some((error) => error.code === "roster_mismatch"));
for (const invalidCharacterId of ["", "   "]) {
  const malformedRoster = {
    ...fresh,
    primarySkillByCharacter: { [invalidCharacterId]: null },
    reactivePriorityByCharacter: { [invalidCharacterId]: [] },
    targetPriorityByCharacter: { [invalidCharacterId]: [] },
  };
  assert.ok(validateWeaponSkillLoadout(malformedRoster).errors
    .some((error) => error.code === "invalid_character_ids"),
  "derived roster must reject empty or whitespace-only character IDs");
  assert.ok(validateWeaponSkillLoadout(fresh, { characterIds: [invalidCharacterId] }).errors
    .some((error) => error.code === "invalid_character_ids"),
  "explicit roster must reject empty or whitespace-only character IDs");
}

console.log(`weapon loadout: ${Object.keys(WEAPON_SKILL_NODES).length} catalogue nodes; single primary and ordered priority lists pass`);
