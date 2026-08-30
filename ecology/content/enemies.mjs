// ecology/content/enemies.mjs
//
// **敵 unit の定義と、その狙いの説明文。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。敵の役割に合わせたHP帯の調整もここで管理する。
//
// ここを触ってよいのは 敵・encounter 担当だけ。engine・schema・共通registryは変更しない。

import { LEGACY_COMBAT_SCALE, NEUTRAL_STAT, cloneEnemy, renamed } from "./base.mjs";

export const ENEMY_NAMES = {
  husk: "灰殻兵",
  husk_warden: "灰殻の見張り",
  still_husk: "動かない灰殻",
  husk_hunter: "灰殻の狩人",
  husk_bulwark: "灰殻の盾兵",
  husk_echo: "灰殻の反響体",
  husk_marker: "灰殻の標定手",
  gray_scrapper: "灰殻の走者",
  gray_runner: "灰殻の走り手",
  gray_marksman: "灰殻の後撃ち",
  gray_stalker: "灰殻の潜み手",
  gray_guard: "灰殻の守衛",
  gray_breaker: "灰殻の砕き手",
  gray_shelter: "灰殻の籠り手",
  gray_hunter: "灰殻の狩人",
  gray_harrower: "灰殻の追い手",
  gray_echo: "灰殻の反響体",
  gray_bulwark: "灰殻の盾兵",
  gray_swarm: "灰殻の群れ",
  ash_core: "灰の核心",
};

const enemyActors = renamed("enemyActors", ENEMY_NAMES);
enemyActors.gray_scrapper = cloneEnemy("husk", "gray_scrapper", ENEMY_NAMES.gray_scrapper, {
  maxHp: 10,
  speed: 6,
  tactics: [{ activeSkillId: "front_strike", useWhen: [] }],
});
enemyActors.gray_runner = cloneEnemy("husk", "gray_runner", ENEMY_NAMES.gray_runner, {
  maxHp: 12,
  speed: 9,
  tactics: [{ activeSkillId: "front_strike", useWhen: [] }],
});
enemyActors.gray_marksman = cloneEnemy("husk", "gray_marksman", ENEMY_NAMES.gray_marksman, {
  maxHp: 12,
  speed: 7,
  tactics: [{ activeSkillId: "rear_strike", useWhen: [] }],
});
enemyActors.gray_stalker = cloneEnemy("husk", "gray_stalker", ENEMY_NAMES.gray_stalker, {
  maxHp: 13,
  speed: 7,
  tactics: [
    { activeSkillId: "rear_strike", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});
enemyActors.gray_guard = cloneEnemy("husk_warden", "gray_guard", ENEMY_NAMES.gray_guard, {
  maxHp: 18,
  speed: 3,
  tactics: [
    { activeSkillId: "enemy_guard", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});
enemyActors.gray_breaker = cloneEnemy("husk_warden", "gray_breaker", ENEMY_NAMES.gray_breaker, {
  maxHp: 22,
  speed: 5,
  tactics: [
    { activeSkillId: "enemy_heavy", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});
enemyActors.gray_shelter = cloneEnemy("husk_warden", "gray_shelter", ENEMY_NAMES.gray_shelter, {
  maxHp: 20,
  speed: 4,
  tactics: [
    { activeSkillId: "enemy_guard", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});
enemyActors.gray_hunter = cloneEnemy("husk_hunter", "gray_hunter", ENEMY_NAMES.gray_hunter, {
  maxHp: 20,
  speed: 8,
  tactics: [
    { activeSkillId: "hunt_the_slow", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});
enemyActors.gray_harrower = cloneEnemy("husk_hunter", "gray_harrower", ENEMY_NAMES.gray_harrower, {
  maxHp: 18,
  speed: 8,
  tactics: [
    { activeSkillId: "hunt_the_slow", useWhen: [] },
    { activeSkillId: "rear_strike", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});
enemyActors.gray_echo = cloneEnemy("husk_echo", "gray_echo", ENEMY_NAMES.gray_echo, {
  maxHp: 20,
  speed: 5,
  tactics: [{ activeSkillId: "front_strike", useWhen: [] }],
});
enemyActors.gray_swarm = cloneEnemy("husk", "gray_swarm", ENEMY_NAMES.gray_swarm, {
  maxHp: 8,
  speed: 10,
  tactics: [{ activeSkillId: "front_strike", useWhen: [] }],
});
enemyActors.gray_bulwark = cloneEnemy("husk_bulwark", "gray_bulwark", ENEMY_NAMES.gray_bulwark, {
  maxHp: 32,
  speed: 4,
  tactics: [
    { activeSkillId: "enemy_guard", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});
enemyActors.ash_core = cloneEnemy("husk_bulwark", "ash_core", ENEMY_NAMES.ash_core, {
  maxHp: 54,
  speed: 4,
  tactics: [
    { activeSkillId: "enemy_heavy", useWhen: [] },
    { activeSkillId: "front_strike", useWhen: [] },
  ],
});

// R6 §4.4 / §11.1 — Phase A の敵 parameter。R6 は人物の表しか出していないので、
// 敵はここで決める（R7 §4.2 の soft data。遊んでから動かす前提）。
//
// **決め方は一つだけ：中立 parameter を置く。** might = focus = 40 にすると、
// 技能側の係数が「中立 40 で現行の相対効果量を保つ」ように作ってあるので、
// 敵の攻撃力は現行の10倍そのままになる。**移行で強さが動かない。**
//
// guard だけは役割で分ける。前で受ける敵に guard を持たせないと、
// 単発と多段の使い分け（R6 §6.7 の軸1）が盤面に現れない。
// **人物と同じ帯に置く。** R6 §4.4 の人物表は guard 2〜12 なので、
// 敵だけ 20〜30 にすると「敵は同じ小規則で構成する」（R6 §11.1）が嘘になる。
// 実測でも 20 だと might 18 の反撃が最低保証まで落ちて、役割ごと無効になっていた。
const ENEMY_GUARD = {
  gray_guard: 10,     // 衛。前で受ける。ユウリと同じ硬さ
  gray_breaker: 4,    // 砕き手。重い一撃を優先するので受けは薄い
  gray_shelter: 8,    // 籠り手。防壁で時間を稼ぐ
  gray_harrower: 2,   // 追い手。後衛を追う代わりに受けは薄い
  gray_bulwark: 14,   // 盾兵。いちばん硬い。多段を誘う
  ash_core: 12,       // 核。重い一撃の代わりに受けも硬い
};

for (const [id, definition] of Object.entries(enemyActors)) {
  definition.maxHp = definition.maxHp * LEGACY_COMBAT_SCALE;
  definition.might = NEUTRAL_STAT;
  definition.focus = NEUTRAL_STAT;
  definition.guard = ENEMY_GUARD[id] ?? 0;
}

export const ENEMY_ACTORS = enemyActors;
