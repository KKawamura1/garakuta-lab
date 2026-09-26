import assert from "node:assert/strict";
import { WEAPON_SKILL_SPECIFICATIONS } from "./content/weapon-specifications.mjs";
import {
  WEAPON_SKILL_PROTOTYPE_WEAPONS,
  buildWeaponSkillPrototypeTree,
  createWeaponSkillForecastPrototypeReadout,
  createWeaponSkillLoadoutPrototypeFixture,
  createWeaponSkillReservationPrototypeFixture,
  getWeaponSkillPrototypeNode,
  getWeaponSkillPrototypePointsToAcquire,
  getWeaponSkillPrototypePrerequisiteChain,
  grantWeaponSkillPrototypePoint,
  listWeaponSkillPrototypeNodes,
  reserveWeaponSkillPrototypeTarget,
} from "./weapon-skill-prototype.mjs";

assert.equal(WEAPON_SKILL_PROTOTYPE_WEAPONS.length, 10);
assert.equal(WEAPON_SKILL_SPECIFICATIONS.length, 190);

const expectedPositions = new Set([
  "R", "A1", "A2", "A3", "AA1", "AA2", "AA3", "AB1", "AB2", "AB3",
  "B1", "B2", "B3", "BA1", "BA2", "BA3", "BB1", "BB2", "BB3",
]);
const allKeys = new Set();

for (const weapon of WEAPON_SKILL_PROTOTYPE_WEAPONS) {
  const nodes = listWeaponSkillPrototypeNodes(weapon.id);
  const tree = buildWeaponSkillPrototypeTree(weapon.id);
  assert.equal(nodes.length, 19, `${weapon.id} must show all 19 catalogue positions`);
  assert.deepEqual(new Set(nodes.map((node) => node.position)), expectedPositions);
  assert.equal(tree.flatMap((group) => group.nodes).length, 19);
  for (const node of nodes) {
    assert.equal(node.canAcquire, false, `${node.key} is catalogue-only`);
    assert.equal(node.implementationStatus, "catalog-only");
    assert.equal(typeof node.displayEffect, "string");
    assert.equal(typeof node.flavorText, "string");
    assert.equal(allKeys.has(node.key), false, `${node.key} is unique`);
    allKeys.add(node.key);
  }
  assert.equal(getWeaponSkillPrototypeNode(`${weapon.id}:R`).position, "R");
}

assert.equal(allKeys.size, 190);
assert.equal(getWeaponSkillPrototypeNode("unknown:node"), null);

const loadoutFixture = createWeaponSkillLoadoutPrototypeFixture("warhammer");
const characterId = loadoutFixture.characterId;
assert.equal(loadoutFixture.loadout.primarySkillByCharacter[characterId], "warhammer:R");
assert.deepEqual(loadoutFixture.loadout.reactivePriorityByCharacter[characterId], ["warhammer:A2", "warhammer:AB1"]);
assert.deepEqual(loadoutFixture.loadout.targetPriorityByCharacter[characterId], ["warhammer:B1"]);
assert.equal("passiveByCharacter" in loadoutFixture.loadout, false, "passives do not have a per-skill equipment list");

let reservationFixture = createWeaponSkillReservationPrototypeFixture("warhammer");
assert.deepEqual(getWeaponSkillPrototypePrerequisiteChain("warhammer:AA1").map((node) => node.position), ["R", "A1", "A2", "A3", "AA1"]);
assert.equal(getWeaponSkillPrototypePointsToAcquire("warhammer:R"), 0);
assert.equal(getWeaponSkillPrototypePointsToAcquire("warhammer:A1"), 0);
assert.equal(getWeaponSkillPrototypePointsToAcquire("warhammer:A2"), 1);
assert.equal(getWeaponSkillPrototypePointsToAcquire("warhammer:A3"), 2);
assert.equal(getWeaponSkillPrototypePointsToAcquire("warhammer:AA1"), 3);
assert.equal(getWeaponSkillPrototypePointsToAcquire("warhammer:BB3"), 6);
assert.equal(getWeaponSkillPrototypePointsToAcquire("unknown:node"), null);
assert.ok(allKeys.size > 0 && [...allKeys].every((key) => Number.isInteger(getWeaponSkillPrototypePointsToAcquire(key))),
  "all catalogue nodes show a deterministic SP cost from their path");
const reservation = reserveWeaponSkillPrototypeTarget(reservationFixture, "warhammer:AA1");
assert.equal(reservation.ok, true);
reservationFixture = reservation.fixture;
assert.equal(reservationFixture.progression.skillReservationByCharacter[reservationFixture.characterId], "warhammer:AA1");
for (let index = 0; index < 3; index += 1) {
  const point = grantWeaponSkillPrototypePoint(reservationFixture);
  assert.equal(point.ok, true);
  reservationFixture = point.fixture;
}
assert.deepEqual(
  reservationFixture.progression.unlockedSkillKeysByCharacter[reservationFixture.characterId],
  ["warhammer:R", "warhammer:A1", "warhammer:A2", "warhammer:A3", "warhammer:AA1"],
);
assert.equal(reservationFixture.progression.skillReservationByCharacter[reservationFixture.characterId], null);
assert.ok(listWeaponSkillPrototypeNodes("warhammer").every((node) => node.canAcquire === false));
assert.deepEqual(createWeaponSkillForecastPrototypeReadout(), {
  connected: false,
  result: null,
  roundsUsed: null,
  allyHpLost: null,
  enemyHpLost: null,
});
console.log("weapon skill prototype: all catalogue nodes remain view-only until runtime support exists");
