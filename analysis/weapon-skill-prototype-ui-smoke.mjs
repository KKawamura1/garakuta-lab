import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  WEAPON_SKILL_PROTOTYPE_WEAPONS,
  listWeaponSkillPrototypeNodes,
  weaponSkillPrototypeSignals,
} from "../ecology/weapon-skill-prototype.mjs";

const nodes = WEAPON_SKILL_PROTOTYPE_WEAPONS.flatMap((weapon) => listWeaponSkillPrototypeNodes(weapon.id));
const reactives = nodes.filter((node) => node.kind === "reactive");

assert.ok(reactives.length > 0);
for (const node of reactives) {
  const { condition } = weaponSkillPrototypeSignals(node);
  assert.ok(condition?.detail, `${node.key} must expose its reactive trigger in the prototype`);
}

const hammerEcho = nodes.find((node) => node.displayName === "響く鉄");
assert.deepEqual(weaponSkillPrototypeSignals(hammerEcho).costs, ["RP1"]);

const command = nodes.find((node) => node.displayName === "号令");
assert.ok(command, "catalogue must contain 号令");
assert.equal(command.displayEffect.includes("AP1"), true, "fixture must cover AP grant wording");
assert.deepEqual(
  weaponSkillPrototypeSignals(command).costs,
  [],
  "AP granted by an effect must not be rendered as a cost",
);

const hpThreshold = nodes.find((node) => /HP\s*\d+%以下/.test(node.displayEffect));
if (hpThreshold) {
  assert.equal(
    weaponSkillPrototypeSignals(hpThreshold).costs.some((cost) => cost.startsWith("HP")),
    false,
    "HP thresholds must not be rendered as HP costs",
  );
}

const css = readFileSync(new URL("../ecology/weapon-skill-prototype.css", import.meta.url), "utf8");
assert.match(css, /--bad:\s*#e78980;/);

console.log(`weapon skill prototype UI smoke: ${nodes.length} nodes, ${reactives.length} reactive triggers verified`);
