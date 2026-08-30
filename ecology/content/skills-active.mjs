// ecology/content/skills-active.mjs
//
// **行動技能（active skill）の定義。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。**挙動は1バイトも変えていない**（ecology/contract.test.mjs が
// 分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 技能 担当だけ。engine・schema・共通registryは変更しない。

import { cloneActive, renamed } from "./base.mjs";

export const ACTIVE_SKILL_NAMES = {
  strike: "斬撃",
  mend: "手当て",
  bulwark: "防壁形成",
  relay_order: "号令",
  heavy_swing: "溜め突き",
  reposition: "位置替え",
  long_swing: "大溜め",
  triage: "応急手当",
  hunt_the_slow: "準備狩り",
  idle_shuffle: "息を整える",
  mark_target: "隙を刻む",
  steady_aim: "狙いを澄ます",
  front_strike: "前列打ち",
  rear_strike: "後列打ち",
  enemy_heavy: "重い一撃",
  enemy_guard: "盾を構える",
};

const activeSkills = renamed("activeSkills", ACTIVE_SKILL_NAMES);
// The R5 fixture's idle_shuffle is intentionally a zero-cost infinite-loop
// witness. It must not leak into player-facing content, including old saves
// that may already contain the id. Keep the id as a safe compatibility alias.
activeSkills.idle_shuffle = cloneActive("steady_aim", "idle_shuffle", "息を整える", {
  tags: ["buff", "playable"],
});
activeSkills.front_strike = cloneActive("strike", "front_strike", ACTIVE_SKILL_NAMES.front_strike, {
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }],
    sort: ["position_asc"],
    take: 1,
  },
});
activeSkills.rear_strike = cloneActive("strike", "rear_strike", ACTIVE_SKILL_NAMES.rear_strike, {
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }, { type: "row_is", row: "rear" }],
    sort: ["position_asc"],
    take: 1,
  },
});
activeSkills.enemy_heavy = cloneActive("heavy_swing", "enemy_heavy", ACTIVE_SKILL_NAMES.enemy_heavy, {
  targetQuery: {
    scope: "enemies",
    filters: [{ type: "alive" }],
    sort: ["position_asc"],
    take: 1,
  },
  preparation: {
    steps: 1,
    completionEffects: [{
      type: "deal_damage",
      target: {
        scope: "enemies",
        filters: [{ type: "alive" }],
        sort: ["position_asc"],
        take: 1,
      },
      amount: { type: "constant", value: 8 },
      tags: ["attack", "heavy"],
    }],
  },
});
activeSkills.enemy_guard = cloneActive("bulwark", "enemy_guard", ACTIVE_SKILL_NAMES.enemy_guard, {
  effects: [{
    type: "gain_barrier",
    target: { scope: "self", take: 1 },
    amount: { type: "constant", value: 4 },
    duration: "round",
  }],
});

export const ACTIVE_SKILLS = activeSkills;
