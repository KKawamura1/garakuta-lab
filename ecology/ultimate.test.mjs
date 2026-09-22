// 必殺技の変換は、現在の武器技能 registry に対してだけ検査する。

import assert from "node:assert/strict";
import { PLAYABLE_CONTENT } from "./content/index.mjs";
import {
  ULTIMATE_AMOUNT_MULTIPLIER,
  ULTIMATE_SPENT_STATUS_ID,
  ascendSkill,
  baseSkillIdOf,
  isUltimateId,
  ultimateIdFor,
} from "./ultimates.mjs";
import { freshLoadout, ultimateCandidates } from "./playable-battles.mjs";

const check = (condition, message) => assert.ok(condition, message);

for (const skillId of ["warhammer_blow", "gauntlets_punch", "launcher_shot"]) {
  const ascended = ascendSkill(PLAYABLE_CONTENT, skillId);
  check(ascended, `${skillId} は必殺にできる`);
  check(isUltimateId(ascended.definition.id), `${skillId} の必殺IDが識別できる`);
  assert.equal(ascended.definition.id, ultimateIdFor(skillId));
  assert.equal(baseSkillIdOf(ascended.definition.id), skillId);
  const damage = ascended.definition.effects.find((effect) => effect.type === "deal_damage");
  const base = PLAYABLE_CONTENT.activeSkills[skillId].effects.find((effect) => effect.type === "deal_damage");
  if (damage && base) {
    assert.equal(damage.amount.numerator, (base.amount.numerator ?? 1) * ULTIMATE_AMOUNT_MULTIPLIER);
  }
  check(
    ascended.definition.intrinsicPredicates.some((predicate) => predicate.type === "has_status"
      && predicate.statusId === ULTIMATE_SPENT_STATUS_ID),
    `${skillId} の必殺は一戦一回の条件を持つ`,
  );
}

const loadout = freshLoadout(["warden", "mender"]);
const candidates = ultimateCandidates(loadout, "warden");
check(candidates.length > 0, "初期4技能から必殺候補を作れる");
check(
  candidates.every((entry) => loadout.tactics.warden.includes(entry.skillId)
    || loadout.passives.warden.includes(entry.skillId)),
  "必殺候補は装着済み技能だけ",
);

console.log("ultimate checks: current weapon skills only");
