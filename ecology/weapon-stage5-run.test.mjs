import assert from "node:assert/strict";
import {
  createStage5WeaponProfile,
  createStage5WeaponRun,
  syncStage5WeaponParty,
  reserveStage5WeaponSkill,
  grantStage5SkillPointsForClear,
  selectStage5Primary,
  toggleStage5WeaponUltimate,
} from "./weapon-stage5-run.mjs";
import { settleStage5UltimateFirings } from "./weapon-stage5-ultimate.mjs";
import { validateWeaponRun } from "./weapon-save.mjs";

const profile = createStage5WeaponProfile("profile_stage5h");
let run = createStage5WeaponRun({
  runId: "run_stage5h",
  profile,
  characterIds: ["warden", "mender"],
  seed: "stage5h_seed",
});
assert.deepEqual(run.skillProgression.unlockedSkillKeysByCharacter.mender, [
  "launcher:R", "launcher:A1", "medical_kit:R", "medical_kit:A1",
]);
assert.deepEqual(run.loadout.reactivePriorityByCharacter.mender, ["medical_kit:A1"]);
assert.equal(run.loadout.primarySkillByCharacter.mender, "launcher:R");

const reserved = reserveStage5WeaponSkill(run, "mender", "long_spear:A1");
assert.equal(reserved.ok, true);
run = reserved.run;
assert.equal(run.skillProgression.skillReservationByCharacter.mender, "long_spear:A1");
let grant = grantStage5SkillPointsForClear(run, "stage:1");
assert.equal(grant.ok, true);
assert.equal(grant.run.skillProgression.skillPointsByCharacter.mender, 0);
assert.ok(grant.run.skillProgression.unlockedSkillKeysByCharacter.mender.includes("long_spear:R"));
assert.equal(grant.run.skillProgression.skillReservationByCharacter.mender, "long_spear:A1");
grant = grantStage5SkillPointsForClear(grant.run, "stage:2");
assert.ok(grant.run.skillProgression.unlockedSkillKeysByCharacter.mender.includes("long_spear:A1"));
assert.equal(grant.run.skillProgression.skillReservationByCharacter.mender, null);
const selected = selectStage5Primary(grant.run, "mender", "long_spear:R");
assert.equal(selected.ok, true);
grant.run = selected.run;

const removed = syncStage5WeaponParty(grant.run, { partyCharacterIds: ["warden"] });
assert.equal(removed.ok, true);
assert.deepEqual(removed.run.battleState.partyCharacterIds, ["warden"]);
assert.deepEqual(removed.run.skillProgression.unlockedSkillKeysByCharacter.mender,
  grant.run.skillProgression.unlockedSkillKeysByCharacter.mender);
const rejoined = syncStage5WeaponParty(removed.run, { partyCharacterIds: ["warden", "mender"] });
assert.equal(rejoined.ok, true);
assert.equal(rejoined.run.loadout.primarySkillByCharacter.mender, "long_spear:R");

const wardenPointsBeforeClear = removed.run.skillProgression.skillPointsByCharacter.warden;
const inactiveReward = grantStage5SkillPointsForClear(removed.run, "stage:3");
assert.equal(inactiveReward.run.skillProgression.skillPointsByCharacter.warden, wardenPointsBeforeClear + 1);
assert.equal(inactiveReward.run.skillProgression.skillPointsByCharacter.mender, 0);
assert.equal(grantStage5SkillPointsForClear(inactiveReward.run, "stage:3").granted, false);

const withLancer = syncStage5WeaponParty(grant.run, {
  partyCharacterIds: ["warden", "mender", "lancer"],
});
assert.equal(withLancer.ok, true);
const spearPrimary = selectStage5Primary(withLancer.run, "lancer", "long_spear:R");
assert.equal(spearPrimary.ok, true);
const armed = toggleStage5WeaponUltimate(spearPrimary.run, "lancer", "long_spear:R");
assert.equal(armed.ok, true);
assert.equal(armed.armed, true);
assert.deepEqual(armed.candidate.traitLabels, ["全体へ", "量3倍"]);
assert.equal(validateWeaponRun(armed.run).valid, true);
const failedBattle = settleStage5UltimateFirings(armed.run, {
  result: "loss",
  events: [{ type: "status_added", values: { statusId: "ultimate_spent" }, targetActorIds: ["a_lancer"] }],
});
assert.deepEqual(failedBattle.spentCharacterIds, []);
assert.equal(failedBattle.run.ultimateState.armedByCharacter.lancer, true,
  "敗北後も必殺の使用権と構えが戻る");
const wonBattle = settleStage5UltimateFirings(armed.run, {
  result: "win",
  events: [{ type: "status_added", values: { statusId: "ultimate_spent" }, targetActorIds: ["a_lancer"] }],
});
assert.deepEqual(wonBattle.spentCharacterIds, ["lancer"]);
assert.deepEqual(wonBattle.run.ultimateState.spentCharacterIds, ["lancer"]);
assert.equal(wonBattle.run.ultimateState.armedByCharacter.lancer, false);
assert.equal(validateWeaponRun(wonBattle.run).valid, true);
assert.equal(toggleStage5WeaponUltimate(wonBattle.run, "lancer", "long_spear:R").armed, false,
  "使用済みの指定は解除できても再構えできない");

console.log("Stage 5 Run: starter loadout, reservation, party persistence, and weapon Run ultimate ledger");
