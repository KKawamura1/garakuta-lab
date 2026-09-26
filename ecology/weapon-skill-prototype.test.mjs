import assert from "node:assert/strict";
import { WEAPON_SKILL_SPECIFICATIONS } from "./content/weapon-specifications.mjs";
import {
  WEAPON_SKILL_PROTOTYPE_WEAPONS,
  buildWeaponSkillPrototypeTree,
  getWeaponSkillPrototypeNode,
  listWeaponSkillPrototypeNodes,
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
console.log("weapon skill prototype: all catalogue nodes remain view-only until runtime support exists");
