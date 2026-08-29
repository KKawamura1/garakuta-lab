import assert from "node:assert/strict";
import { simulateBattle, validateBattleInput, validateContentBundle } from "./engine.mjs";
import { PLAYABLE_CONTENT } from "./playable-content.mjs";
import {
  CHARACTER_OPTIONS,
  COMPONENTS,
  componentOffer,
  freshLoadout,
  installComponent,
  makeBattle,
  reorderTactic,
} from "./playable-battles.mjs";

const contentErrors = validateContentBundle(PLAYABLE_CONTENT);
assert.deepEqual(contentErrors, [], `content errors: ${JSON.stringify(contentErrors)}`);
assert.equal(CHARACTER_OPTIONS.length, 4);
assert.equal(Object.keys(COMPONENTS).length, 17);

for (const [id, component] of Object.entries(COMPONENTS)) {
  const section = component.kind === "active" ? "activeSkills" : component.kind === "reactive" ? "reactiveSkills" : "equipment";
  assert.ok(PLAYABLE_CONTENT[section][component.definitionId], `${id} must point at real content`);
  assert.ok(component.effect.length > 0, `${id} needs a player-facing effect`);
}

const offers = componentOffer("slice-1801", 1, [], 5);
assert.equal(new Set(offers).size, offers.length);
assert.deepEqual(offers, componentOffer("slice-1801", 1, [], 5));
assert.ok(offers.every((id) => Object.hasOwn(COMPONENTS, id)));

const rosters = [
  ["warden", "mender", "lancer"],
  ["warden", "mender", "pivot"],
  ["warden", "lancer", "pivot"],
  ["mender", "lancer", "pivot"],
];

for (const roster of rosters) {
  const loadout = freshLoadout(roster);
  let configured = installComponent(loadout, "heavy_swing", roster[0]);
  assert.equal(configured.ok, true);
  configured = installComponent(configured.loadout, "counter_blow", roster[1]);
  assert.equal(configured.ok, true);
  configured = installComponent(configured.loadout, "standing_plate", roster[2]);
  assert.equal(configured.ok, true);
  const beforeReorder = configured.loadout.tactics[roster[0]];
  const reordered = reorderTactic(configured.loadout, roster[0], 0, 1);
  assert.deepEqual(reordered.tactics[roster[0]], [beforeReorder[1], beforeReorder[0]]);

  for (const stage of [1, 2, 3]) {
    const battle = makeBattle(stage, roster, configured.loadout, "slice-1801");
    const inputErrors = validateBattleInput(battle, PLAYABLE_CONTENT);
    assert.deepEqual(inputErrors, [], `roster ${roster.join(",")} stage ${stage}: ${JSON.stringify(inputErrors)}`);
    const first = simulateBattle(battle, PLAYABLE_CONTENT);
    const second = simulateBattle(battle, PLAYABLE_CONTENT);
    assert.deepEqual(first, second, `replay mismatch for ${roster.join(",")} stage ${stage}`);
    assert.equal(first.schemaVersion, "ecology-result-1");
    assert.ok(first.events.length > 0);
  }
}

console.log("playable slice: 4-to-3 roster, real components, 3 stages, and deterministic replay passed");
