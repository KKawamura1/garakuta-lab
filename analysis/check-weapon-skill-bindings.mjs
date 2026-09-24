import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WEAPON_SKILL_SPECIFICATIONS } from "../ecology/content/weapon-specifications.mjs";
import {
  STARTING_WEAPONS_BY_CHARACTER,
  WEAPON_SKILL_BINDINGS,
} from "../ecology/content/weapon-skill-bindings.mjs";

const WEAPON_IDS = [
  "warhammer", "gauntlets", "launcher", "medical_kit", "tower_shield",
  "long_spear", "grappling_hook", "dual_blades", "banner", "heavy_crossbow",
];
const POSITIONS = [
  "R", "A1", "A2", "A3", "AA1", "AA2", "AA3", "AB1", "AB2", "AB3",
  "B1", "B2", "B3", "BA1", "BA2", "BA3", "BB1", "BB2", "BB3",
];
const EXPECTED_STARTING_WEAPONS = Object.freeze({
  warden: ["warhammer", "gauntlets"],
  mender: ["launcher", "medical_kit"],
  lancer: ["tower_shield", "long_spear"],
  guardian: ["grappling_hook", "dual_blades"],
  tactician: ["banner", "heavy_crossbow"],
});
const EXPECTED_KIND_MISMATCHES = [
  "medical_kit:A1", "medical_kit:AA2", "medical_kit:BB1", "medical_kit:BB2",
  "tower_shield:A2", "tower_shield:BB1",
  "long_spear:AA2", "long_spear:AB2", "long_spear:B2", "long_spear:BA1", "long_spear:BB1",
  "grappling_hook:B1", "grappling_hook:B2", "grappling_hook:BA1", "grappling_hook:BB1",
  "banner:AB1", "banner:AB2", "banner:BB1", "banner:BB2",
  "heavy_crossbow:AB1", "heavy_crossbow:AB2", "heavy_crossbow:B2",
  "heavy_crossbow:BA1", "heavy_crossbow:BA2", "heavy_crossbow:BB1",
].sort();
const fail = (message) => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };
const keyFor = (weaponId, position) => `${weaponId}:${position}`;
const sameArray = (left, right) => JSON.stringify(left) === JSON.stringify(right);

assert(WEAPON_SKILL_BINDINGS.length === 190, `expected 190 bindings, got ${WEAPON_SKILL_BINDINGS.length}`);
assert(WEAPON_SKILL_SPECIFICATIONS.length === 190, `expected 190 catalog rows, got ${WEAPON_SKILL_SPECIFICATIONS.length}`);

const specificationByPosition = new Map();
for (const spec of WEAPON_SKILL_SPECIFICATIONS) {
  const key = keyFor(spec.weaponId, spec.position);
  assert(!specificationByPosition.has(key), `duplicate catalog position: ${key}`);
  specificationByPosition.set(key, spec);
}
assert(specificationByPosition.size === 190, "catalog positions are not unique");

const bindingByPosition = new Map();
const skillIds = new Set();
for (const binding of WEAPON_SKILL_BINDINGS) {
  const key = keyFor(binding.weaponId, binding.position);
  assert(WEAPON_IDS.includes(binding.weaponId), `unknown weapon: ${binding.weaponId}`);
  assert(POSITIONS.includes(binding.position), `unknown position: ${key}`);
  assert(!bindingByPosition.has(key), `duplicate binding position: ${key}`);
  assert(!skillIds.has(binding.skillId), `duplicate skill ID: ${binding.skillId}`);
  assert(/^[a-z][a-z0-9_]*$/.test(binding.skillId), `invalid skill ID: ${binding.skillId}`);
  assert(["active", "reactive", "target", "passive"].includes(binding.sourceDeclaredKind),
    `unknown source kind for ${key}`);
  assert(["audited", "pending"].includes(binding.auditStatus), `unknown audit status for ${key}`);
  bindingByPosition.set(key, binding);
  skillIds.add(binding.skillId);
}
assert(bindingByPosition.size === 190 && skillIds.size === 190, "binding uniqueness failed");
assert(sameArray([...bindingByPosition.keys()].sort(), [...specificationByPosition.keys()].sort()),
  "binding positions do not exactly cover the canonical catalog");

const auditCounts = { audited: 0, pending: 0 };
const mismatches = [];
for (const weaponId of WEAPON_IDS) {
  const byPosition = WEAPON_SKILL_BINDINGS.filter((binding) => binding.weaponId === weaponId);
  assert(byPosition.length === 19, `${weaponId}: expected 19 bindings, got ${byPosition.length}`);
  assert(sameArray(byPosition.map((binding) => binding.position), POSITIONS),
    `${weaponId}: bindings are not in canonical position order`);
  for (const binding of byPosition) {
    const key = keyFor(weaponId, binding.position);
    const spec = specificationByPosition.get(key);
    auditCounts[binding.auditStatus] += 1;
    if (binding.sourceDeclaredKind !== spec.kind) {
      mismatches.push(key);
      assert(binding.auditStatus === "pending", `${key}: audited binding has a catalog kind mismatch`);
    }
  }
}
assert(auditCounts.audited === 57 && auditCounts.pending === 133,
  `expected 57 audited / 133 pending, got ${auditCounts.audited} / ${auditCounts.pending}`);
for (const weaponId of WEAPON_IDS.slice(0, 3)) {
  assert(WEAPON_SKILL_BINDINGS.filter((binding) => binding.weaponId === weaponId)
    .every((binding) => binding.auditStatus === "audited"), `${weaponId}: audit status differs from source ledger`);
}
for (const weaponId of WEAPON_IDS.slice(3)) {
  assert(WEAPON_SKILL_BINDINGS.filter((binding) => binding.weaponId === weaponId)
    .every((binding) => binding.auditStatus === "pending"), `${weaponId}: unreviewed tree was marked audited`);
}
assert(sameArray(mismatches.sort(), EXPECTED_KIND_MISMATCHES),
  `catalog/source kind mismatch set changed: ${mismatches.sort().join(", ")}`);

const startingCharacterIds = Object.keys(EXPECTED_STARTING_WEAPONS);
assert(sameArray(Object.keys(STARTING_WEAPONS_BY_CHARACTER), startingCharacterIds),
  "starting weapon character set changed");
const startingSkillKeys = [];
for (const characterId of startingCharacterIds) {
  const expectedWeapons = EXPECTED_STARTING_WEAPONS[characterId];
  const weapons = STARTING_WEAPONS_BY_CHARACTER[characterId];
  assert(sameArray(weapons, expectedWeapons), `${characterId}: starting weapons differ from the five-character catalog`);
  assert(weapons.length === 2 && new Set(weapons).size === 2, `${characterId}: expected two distinct starting weapons`);
  for (const weaponId of weapons) {
    assert(WEAPON_IDS.includes(weaponId), `${characterId}: unknown starting weapon ${weaponId}`);
    for (const position of ["R", "A1"]) {
      const key = keyFor(weaponId, position);
      assert(bindingByPosition.has(key) && specificationByPosition.has(key), `${characterId}: missing initial binding ${key}`);
      startingSkillKeys.push(key);
    }
  }
}
assert(startingSkillKeys.length === 20, `expected 20 initial skills, got ${startingSkillKeys.length}`);
assert(new Set(startingSkillKeys).size === 20, "initial skills contain duplicates");
const medicalA1 = specificationByPosition.get("medical_kit:A1");
assert(medicalA1.kind === "reactive", "medical kit A1 must use the catalog's reactive kind");
assert(startingSkillKeys.includes("medical_kit:A1"), "reactive medical kit A1 must remain in the initial 20");

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ecologyRoot = path.join(repositoryRoot, "ecology");
function ecologySourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return ecologySourceFiles(entryPath);
    return /\.(mjs|js)$/.test(entry.name) ? [entryPath] : [];
  });
}
const bindingImportPattern = /\bimport(?:\s*\(\s*|\s+)["'][^"']*weapon-skill-bindings\.mjs["']|\bfrom\s*["'][^"']*weapon-skill-bindings\.mjs["']/;
const runtimeBindingImports = ecologySourceFiles(ecologyRoot)
  .filter((filePath) => bindingImportPattern.test(fs.readFileSync(filePath, "utf8")));
assert(runtimeBindingImports.length === 0,
  "migration-only bindings must not be imported by runtime modules: " + runtimeBindingImports.join(", "));

console.log("Weapon skill migration bindings: 190 canonical positions / 190 unique IDs.");
console.log("Audit status: 57 audited, 133 pending; migration data stays outside runtime modules.");
console.log(`Catalog kind differences preserved as source discrepancies: ${mismatches.length} (known set).`);
console.log(`Initial loadout: 5 characters × 2 weapons × R/A1 = ${startingSkillKeys.length} skills; medical-kit A1 stays reactive.`);
