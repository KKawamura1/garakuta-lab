// analysis/ecology-skill-balance-smoke.mjs
//
// issue #190 / #189 / #128 — 数字が存在することではなく、取得コストと登場時期に
// 見合う見せ場が実戦の event 列へ出ることを検査する。

import assert from "node:assert/strict";
import { simulateBattle, validateBattleInput } from "../ecology/engine.mjs";
import {
  BATTLE_SCHEMA_VERSION, MAX_SKILL_LEVEL, MIN_SKILL_LEVEL, SKILL_LEVEL_STEP_BPS,
} from "../ecology/schema.mjs";
import {
  SKILL_LEVEL_COST, SKILL_LEVEL_COST_STEEP, UNCONDITIONAL_FLAT_LEVELS, skillLevelCost,
} from "../ecology/content/skill-levels.mjs";
import { BPS } from "../ecology/values.mjs";
import {
  CAMPAIGN_STAGES,
  PLAYABLE_CONTENT,
  SKILL_PACKS,
  SKILL_LEVEL_CAPS,
  SKILL_TREE_NODES,
  skillIdsForPacks,
} from "../ecology/content/index.mjs";
import { staticStatBonuses } from "../ecology/static-bonuses.mjs";

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};

const nodeBySkill = Object.fromEntries(SKILL_TREE_NODES.map((node) => [node.skillId, node]));

function unlockBudget(skillId) {
  const needed = new Map();
  const pending = [];
  const demand = (id, level = 1) => {
    if (level <= (needed.get(id) ?? 0)) return;
    needed.set(id, level);
    pending.push(id);
  };
  demand(skillId);
  while (pending.length) {
    const current = nodeBySkill[pending.pop()];
    for (const required of current?.requires ?? []) demand(required.skillId, required.minLv);
  }
  return [...needed].reduce((total, [id, level]) => (
    total + (nodeBySkill[id]?.cost ?? 0) + level - 1
  ), 0);
}

const availableByStage = CAMPAIGN_STAGES.map((stage) => new Set(
  skillIdsForPacks(stage.enabledPackIds, stage.packDepths).all,
));
const firstScenario = (skillId) => availableByStage.findIndex((ids) => ids.has(skillId)) + 1;

function firstDamage(skillId) {
  const skill = PLAYABLE_CONTENT.activeSkills[skillId];
  const effects = [...(skill.effects ?? []), ...(skill.preparation?.completionEffects ?? [])];
  return effects.find((effect) => effect.type === "deal_damage");
}

const coefficient = (skillId) => firstDamage(skillId)?.amount?.coefficientBps;
const coefficientAtLevel = (skillId, level) => Math.round(
  coefficient(skillId) * (10_000 + (level - 1) * SKILL_LEVEL_STEP_BPS) / 10_000,
);

// ---- 取得コストと登場時期に対する攻撃の傾き ------------------------------------

equal(unlockBudget("reckless_swing"), 9, "捨て身の一振りは9点を通った到達点");
check(
  coefficient("reckless_swing") >= coefficientAtLevel("strike", 10),
  "捨て身の一振りLv1は斬撃Lv10以上で、深い前提と自分への隙に見合う",
);
check(
  coefficient("double_back") >= coefficientAtLevel("strike", 9),
  "二の太刀Lv1は斬撃Lv9級で、8点の到達先になる",
);
check(
  coefficient("spread_cut") >= coefficientAtLevel("strike", 6),
  "散らし斬りLv1は斬撃Lv6級で、5点の到達先になる",
);
check(
  coefficient("bloodied_charge") > coefficient("reckless_swing"),
  "HP半分以下だけの手負いの突撃は、任意に選べる捨て身より成立時が強い",
);

equal(firstScenario("aimed_shot"), 1, "狙い撃ちは最初のシナリオから出る");
equal(firstScenario("mark_strike"), 5, "刻印撃ちは後半のシナリオで出る");
check(
  coefficient("mark_strike") > coefficient("aimed_shot"),
  "後発の刻印撃ちは、隙を作りながらでも序盤の狙い撃ちを上回る",
);
check(
  coefficient("precise_cut") > coefficient("aimed_shot"),
  "無被弾条件と追加コストを持つ静かな一手は、狙い撃ちより強い",
);

const heavyPerAction = coefficient("heavy_swing") / 2;
const longPerAction = coefficient("long_swing") / 4;
check(heavyPerAction <= coefficient("steady_cut"), "溜め突きの1行動平均は安定武器を超えない");
check(longPerAction <= coefficient("steady_cut"), "大溜めの1行動平均も安定武器を超えない");
check(
  heavyPerAction - coefficientAtLevel("aimed_shot", 2) <= 2_000,
  "溜め突きと狙い撃ちLv2の1行動差は20ポイント以内で、旧275%対140%へ戻らない",
);

const ordinaryTechniqueIds = [
  "aimed_shot", "rear_hunt", "crack_mark", "hunt_the_slow",
  "mark_strike", "mark_break", "precise_cut",
];
for (const skillId of ordinaryTechniqueIds) {
  equal(firstDamage(skillId).amount.scalingStat, "focus", `${skillId} は技術攻撃`);
  check(coefficient(skillId) <= 14_500, `${skillId} は後列無減衰と支援相乗を倍率へ織り込む`);
}
check(coefficient("aimed_shot") < coefficient("steady_cut"), "無条件の技は無条件の武器より低倍率");

// 作者が基準として挙げた三本は、役割を変えず調整の錨にする。
const sweep = PLAYABLE_CONTENT.activeSkills.row_sweep;
equal(unlockBudget("row_sweep"), 4, "薙ぎ払いは前提込み4点の範囲攻撃");
equal(firstScenario("row_sweep"), 4, "薙ぎ払いは4シナリオ目から出る");
equal(coefficient("row_sweep"), 8_000, "薙ぎ払いは敵1体あたり腕力80%");
check(sweep.intrinsicPredicates.some((predicate) => (
  predicate.type === "target_exists" && predicate.op === "gte" && predicate.value === 2
)), "薙ぎ払いは前列が1体ならスキップする");

const guardStep = PLAYABLE_CONTENT.reactiveSkills.guard_step;
equal(unlockBudget("guard_step"), 5, "踏み固めは前提込み5点");
equal(guardStep.rule.listenTo, "actor_moved", "踏み固めは移動をコンボ源にする");
equal(guardStep.rule.costs.length, 0, "踏み固めはRPを払わず、繰り返す移動を防壁へ変える");
equal(guardStep.rule.effects[0].amount.coefficientBps, 6_500, "踏み固めは技術65%の防壁");

const triage = PLAYABLE_CONTENT.reactiveSkills.triage;
equal(unlockBudget("triage"), 1, "応急手当は前提込み1点の序盤技能");
equal(firstScenario("triage"), 1, "応急手当は最初のシナリオから出る");
const triageQuery = triage.rule.effects.find((effect) => effect.type === "heal").target;
check(triageQuery.filters.some((filter) => filter.type === "not_self"),
  "応急手当は自分以外の味方を救う");
check(triageQuery.filters.some((filter) => (
  filter.type === "hp_percent" && filter.op === "lte" && filter.value === 50
)), "応急手当はHP半分以下にだけ厚く返す");
equal(triage.rule.effects[0].amount.coefficientBps, 5_000, "応急手当は技術50%を返す");

// AP移譲は、自分へ戻して無限に動いたり、50%追撃まで得たりしない。
for (const skillId of ["relay_order", "hasten_ally"]) {
  const skill = PLAYABLE_CONTENT.activeSkills[skillId];
  equal(skill.actionMode, "channel", `${skillId} は攻撃を休むAP移譲`);
  check(
    skill.targetQuery.filters.some((filter) => filter.type === "not_self"),
    `${skillId} は自分へAPを戻せない`,
  );
}
check(
  PLAYABLE_CONTENT.activeSkills.steady_aim.effects.some((effect) => (
    effect.type === "gain_resource" && effect.resource === "reaction_points"
  )),
  "深い狙いを澄ますは、早い息を整えると違って反応権も整える",
);

// 各packには、行動権を増やさず既存の一手を読む無料反応と、条件付き常設を置く。
// 本数の総量ではなく、「各packで二つずつ選べる」ことを検査する。
const freeReactivePairs = {
  pack_edge: ["exploit_stagger", "deepen_bleed"],
  pack_care: ["critical_care", "aftercare"],
  pack_wall: ["moving_guard", "barrier_rebuke"],
  pack_tempo: ["charge_guard", "stagger_focus"],
  pack_barrage: ["deepen_mark", "third_cut"],
  pack_relay: ["return_the_mark", "carry_the_ward"],
};
for (const pack of SKILL_PACKS) {
  const expected = freeReactivePairs[pack.id];
  assert.deepEqual(
    expected.filter((id) => pack.reactiveSkillIds.includes(id)),
    expected,
    `${pack.id} は無料反応を二つ持つ`,
  );
  checks += 1;
  for (const id of expected) {
    assert.deepEqual(PLAYABLE_CONTENT.reactiveSkills[id].rule.costs, [], `${id} はAP/RPを使わない`);
    checks += 1;
  }
  check(pack.passiveSkillIds.length >= 3, `${pack.id} は条件付き常設を複数持つ`);
}

// 基礎能力は余った点の逃げ道としてLv10まで伸びるが、行動権は増やさない。
const foundationIds = [
  "foundation_vitality", "foundation_might", "foundation_focus", "foundation_guard",
];
for (const id of foundationIds) equal(nodeBySkill[id].maxLv, 10, `${id} はLv10まで取れる`);
assert.deepEqual(
  staticStatBonuses(PLAYABLE_CONTENT, foundationIds),
  { max_hp: 50, might: 2, focus: 2, guard: 1 },
  "基礎能力4種のLv1は既存値を保つ",
);
checks += 1;
assert.deepEqual(
  staticStatBonuses(PLAYABLE_CONTENT, foundationIds, [], Object.fromEntries(
    foundationIds.map((id) => [id, 10]),
  )),
  { max_hp: 140, might: 11, focus: 11, guard: 10 },
  "基礎能力4種を10点ずつ取っても、増えるのはHPと三能力だけ",
);
checks += 1;

// ---- production content を通す小戦闘 ---------------------------------------

const training = Object.freeze({ might: 0, focus: 0, guard: 0, vitality: 0 });
const baseStats = Object.freeze({ maxHp: 1_000, might: 100, focus: 100, guard: 0 });

function ally(instanceId, tactics, options = {}) {
  return {
    instanceId,
    characterId: options.characterId ?? "warden",
    position: options.position ?? "front_left",
    tactics: tactics.map((activeSkillId) => ({ activeSkillId, useWhen: [] })),
    reactiveSkillIds: options.reactives ?? [],
    passiveSkillIds: options.passives ?? [],
    ...(options.skillLevels ? { skillLevels: options.skillLevels } : {}),
    equipment: [],
    stats: options.stats ?? baseStats,
    training,
  };
}

function enemy(instanceId, enemyActorId = "dust_maw", options = {}) {
  return {
    instanceId,
    enemyActorId,
    position: options.position ?? "front_left",
    stats: options.stats ?? { maxHp: 5_000, might: 100, focus: 100, guard: 0 },
  };
}

function run(name, allies, enemies, rounds = 1) {
  const input = {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: "balance_" + name,
    maxRounds: rounds,
    objective: { type: "survive_rounds", rounds },
    allies,
    enemies,
  };
  assert.deepEqual(validateBattleInput(input, PLAYABLE_CONTENT), [], `${name} の入力が正しい`);
  checks += 1;
  return simulateBattle(input, PLAYABLE_CONTENT);
}

const modifiers = (result, prefix) => result.events.filter((event) => (
  event.type === "pending_amount_modified" && event.ruleId?.startsWith(prefix)
));

// 隙・怯み・守勢は多段の初段だけで止まらず、3hit全部を割合で動かす。
const exposed = run(
  "exposed_multihit",
  [ally("a", ["mark_target", "barrage_strike"], { characterId: "guardian" })],
  [enemy("e")],
);
const exposedBarrage = modifiers(exposed, "exposed").filter((modified) => {
  const proposed = exposed.events.find((event) => event.id === modified.values.proposalEventId);
  return proposed?.skillId === "barrage_strike";
});
equal(exposedBarrage.length, 3, "隙は連撃3hitの全てへ効く");
check(exposedBarrage.every((event) => event.values.after * 5 === event.values.before * 6),
  "隙1段は各hitを20%増やす");

for (const [statusId, setupSkill] of [["warded", "ward_ally"], ["staggered", "feint"]]) {
  const result = run(statusId + "_multihit", [ally("a", [setupSkill])], [enemy("e")]);
  const changed = modifiers(result, statusId);
  equal(changed.length, 3, `${statusId} は敵の連撃3hit全てへ効く`);
  check(changed.every((event) => event.values.after * 5 === event.values.before * 4),
    `${statusId} 1段は各hitを20%減らす`);
}

const bleed = run(
  "bleed_boss",
  [ally("a", ["rend"])],
  [enemy("e", "husk", { stats: { maxHp: 1_000, might: 1, focus: 1, guard: 999 } })],
);
const bleedTick = bleed.events.find((event) => (
  event.type === "damage_proposed" && event.ruleId === "bleeding_2_rule"
));
equal(bleedTick?.values.amount, 100, "裂傷2段は受け999の敵にも最大HP10%を刻む");

// 刃packは「状態を付ける弱い一手」を、次の一撃とround末の実ダメージへつなぐ。
const edged = run(
  "free_edge_status_combo",
  [ally("a", ["hamstring", "rend"], {
    characterId: "guardian",
    reactives: ["exploit_stagger", "deepen_bleed"],
  })],
  [enemy("e", "still_husk", { stats: { maxHp: 1_000, might: 0, focus: 0, guard: 999 } })],
);
check(modifiers(edged, "exploit_stagger_rule").length >= 1,
  "足を払ったあとの攻撃は、無料の崩れを穿つで伸びる");
check(edged.events.some((event) => event.type === "status_added"
  && event.ruleId === "deepen_bleed_rule" && event.values.statusId === "bleeding"),
"抉るが付けた裂傷は、傷を深めるで1段増える");
equal(edged.events.find((event) => event.type === "damage_proposed"
  && event.ruleId === "bleeding_3_rule")?.values.amount, 150,
"無料反応で3段になった裂傷は最大HP15%を刻む");

// 手当てpackは瀕死者への治療だけを厚くし、同じ一手のあとへ守勢を残す。
const cared = run(
  "free_care_combo",
  [
    ally("wounded", ["steady_cut"], {
      position: "front_left", stats: { maxHp: 24, might: 1, focus: 1, guard: 0 },
    }),
    ally("healer", ["steady_cut"], {
      characterId: "mender", position: "rear_left",
      reactives: ["triage", "critical_care", "aftercare"],
    }),
  ],
  [enemy("e", "husk", { stats: { maxHp: 5_000, might: 10, focus: 1, guard: 0 } })],
);
check(modifiers(cared, "critical_care_rule").length >= 1,
  "半分以下の味方への応急手当を、急所を診るが無料で厚くする");
check(cared.events.some((event) => event.type === "status_added"
  && event.ruleId === "aftercare_rule" && event.targetActorIds.includes("wounded")
  && event.values.statusId === "warded"),
"実際に治した味方へ、手当てのあとが守勢を残す");

// 溜めpackは準備開始の無防備を守り、完成した重い一撃だけを太くする。
const charged = run(
  "free_charge_combo",
  [ally("a", ["heavy_swing"], {
    characterId: "guardian",
    reactives: ["charge_guard"], passives: ["prepared_power"],
  })],
  [enemy("e", "still_husk", { stats: { maxHp: 5_000, might: 0, focus: 0, guard: 0 } })],
);
check(charged.events.some((event) => event.type === "status_added"
  && event.ruleId === "charge_guard_rule" && event.values.statusId === "warded"),
"溜め始めた拍に無料の守勢が付く");
check(modifiers(charged, "prepared_power_rule").length >= 1,
  "準備を終えたheavy攻撃だけを、溜めの勘所が強める");

// 連撃packは刻印を2段へし、刻印相手への三連撃を倍率・裂傷・次の集中へ分岐させる。
const barraged = run(
  "free_barrage_combo",
  [ally("a", ["mark_strike", "barrage_strike"], {
    characterId: "guardian",
    reactives: ["deepen_mark", "third_cut"],
    passives: ["marked_assault", "three_count"],
  })],
  [enemy("e", "still_husk", { stats: { maxHp: 5_000, might: 0, focus: 0, guard: 0 } })],
);
check(barraged.events.some((event) => event.type === "status_added"
  && event.ruleId === "deepen_mark_rule" && event.values.statusId === "exposed"),
"最初の刻印を重ね刻みが2段へする");
equal(modifiers(barraged, "marked_assault_rule").length, 1,
  "刻印攻めは後続の三連撃の最初のhitを強める");
check(barraged.events.some((event) => event.type === "status_added"
  && event.ruleId === "third_cut_rule" && event.values.statusId === "bleeding"),
"三撃目は裂傷の入口になる");
check(barraged.events.some((event) => event.type === "status_added"
  && event.ruleId === "three_count_rule" && event.values.statusId === "focused"),
"刻印相手への三撃目は次の一手の集中も残す");

// 受け渡しpackは自分に来た不利と、仲間へ渡した守りを同じ一手から敵味方へ返す。
const relayed = run(
  "free_relay_combo",
  [
    ally("giver", ["take_the_wound"], {
      position: "front_left", reactives: ["return_the_mark", "carry_the_ward"],
    }),
    ally("receiver", ["steady_cut"], { position: "front_right" }),
  ],
  [enemy("e", "still_husk", { stats: { maxHp: 5_000, might: 0, focus: 0, guard: 0 } })],
);
check(relayed.events.some((event) => event.type === "status_added"
  && event.ruleId === "return_the_mark_rule" && event.values.statusId === "staggered"),
"傷を引き受けて自分に付いた隙を、隙を返すが敵の怯みへ変える");
check(relayed.events.some((event) => event.type === "block_gained"
  && event.ruleId === "carry_the_ward_rule" && event.targetActorIds.includes("receiver")),
"渡した守勢に守りを継ぐがblockを重ねる");

// 急かすは、準備役がいるときだけRPを一手へ変え、そのラウンド中に大技を完成させる。
const urged = run(
  "urging_charge",
  [
    ally("charger", ["heavy_swing"], { position: "front_left" }),
    ally("caller", ["bulwark"], {
      characterId: "tactician", position: "front_right", reactives: ["urging"],
    }),
  ],
  [enemy("e", "still_husk", { stats: { maxHp: 5_000, might: 0, focus: 0, guard: 0 } })],
);
check(urged.events.some((event) => (
  event.type === "preparation_advanced" && event.ruleId === "urging_rule"
)), "急かすは味方の準備を外から1段進める");
check(urged.events.some((event) => (
  event.type === "preparation_completed" && event.sourceActorId === "charger" && event.round === 1
)), "急かした溜め突きは開始したラウンド中に完成する");

// 意趣返しは仲間を失う重い条件に対して、通常攻撃を上回る即時反撃を返す。
const avenged = run(
  "vengeful_fall",
  [
    ally("fallen", ["steady_cut"], {
      position: "front_left", stats: { maxHp: 1, might: 1, focus: 0, guard: 0 },
    }),
    ally("avenger", ["heavy_swing"], {
      position: "front_right", reactives: ["vengeful_step"],
    }),
  ],
  [enemy("e", "husk", { stats: { maxHp: 5_000, might: 100, focus: 100, guard: 0 } })],
);
check(avenged.events.some((event) => (
  event.type === "damage_proposed" && event.ruleId === "vengeful_step_rule"
    && event.values.amount === 180
)), "意趣返しは味方が倒れた拍に腕力180%で返す");

// 「余りを溜める」は通常は発生しないround末APではなく、AP2の1手目を読む。
const held = run(
  "held_breath",
  [ally("a", ["steady_cut"], { characterId: "guardian", passives: ["held_breath"] })],
  [enemy("e", "still_husk", { stats: { maxHp: 5_000, might: 0, focus: 0, guard: 0 } })],
);
check(held.events.some((event) => event.ruleId === "held_breath_rule" && event.type === "status_added"),
  "AP2の1手目のあとに余りを溜めるが発火する");
const heldBoost = modifiers(held, "focused_damage_rule");
equal(heldBoost.length, 1, "溜めた集中は2手目に一度だけ使う");
equal(heldBoost[0].values.after, 195, "腕力100の踏み込み斬り130を集中で195にする");

// 位置替えは移動そのもの、守勢、無料の踏み固めを一手で結ぶ。
const moved = run(
  "movement_combo",
  [
    ally("a", ["reposition"], {
      characterId: "guardian", position: "rear_left", reactives: ["guard_step"],
    }),
    ally("b", ["bulwark"], {
      position: "front_left", stats: { maxHp: 1_000, might: 1, focus: 1, guard: 0 },
    }),
  ],
  [enemy("e", "still_husk", { stats: { maxHp: 5_000, might: 0, focus: 0, guard: 0 } })],
);
check(moved.events.some((event) => event.type === "actor_moved" && event.targetActorIds[0] === "a"),
  "位置替えで本人が前へ動く");
check(moved.events.some((event) => event.type === "status_added"
  && event.skillId === "reposition" && event.values.statusId === "warded"),
"位置替えで前へ出た本人に守勢が付く");
check(moved.events.some((event) => event.type === "barrier_gained" && event.ruleId === "guard_step_rule"),
  "同じ移動を踏み固めが読み、RPなしで防壁へ変える");

const movingGuard = run(
  "moving_guard_combo",
  [
    ally("mover", ["reposition"], {
      characterId: "guardian", position: "rear_left", reactives: ["moving_guard"],
    }),
    ally("anchor", ["steady_cut"], { position: "front_left" }),
  ],
  [enemy("e", "husk", { stats: { maxHp: 5_000, might: 100, focus: 1, guard: 0 } })],
);
check(modifiers(movingGuard, "moving_guard_rule").length >= 1,
  "前へ動いたroundの被弾を、動いた足場がRPなしで軽くする");

const rebuked = run(
  "barrier_rebuke_combo",
  [ally("a", ["bulwark"], {
    reactives: ["barrier_rebuke"],
    stats: { maxHp: 1_000, might: 1, focus: 10, guard: 0 },
  })],
  [enemy("e", "husk", { stats: { maxHp: 5_000, might: 100, focus: 1, guard: 0 } })],
);
check(rebuked.events.some((event) => event.type === "status_added"
  && event.ruleId === "barrier_rebuke_rule" && event.values.statusId === "staggered"),
"防壁が砕けた拍を、砕け際が攻撃者の怯みへ返す");

const dragged = run(
  "drag_into_mark",
  [ally("mover", ["drag_forward"], { position: "front_left" })],
  [
    enemy("front", "still_husk", { position: "front_left" }),
    enemy("rear", "still_husk", { position: "rear_left" }),
  ],
);
check(dragged.events.some((event) => (
  event.type === "actor_moved" && event.targetActorIds.includes("rear")
)), "引きずり出すは後列の敵を実際に動かす");
check(dragged.events.some((event) => (
  event.type === "status_added" && event.skillId === "drag_forward"
    && event.targetActorIds.includes("rear") && event.values.statusId === "exposed"
)), "引きずり出した敵へ隙を残し、次の武器攻撃につなぐ");

const rallied = run(
  "rally_guard",
  [
    ally("caller", ["rally_line"], { position: "rear_left" }),
    ally("front", ["bulwark"], { position: "front_left" }),
    ally("reserve", ["bulwark"], { position: "rear_right" }),
  ],
  [enemy("e", "still_husk", { stats: { maxHp: 5_000, might: 0, focus: 0, guard: 0 } })],
);
check(rallied.events.some((event) => (
  event.type === "actor_moved" && event.targetActorIds.includes("reserve")
)), "陣を組み直すは別の後衛を前へ戻す");
check(rallied.events.some((event) => (
  event.type === "status_added" && event.skillId === "rally_line"
    && event.targetActorIds.includes("reserve") && event.values.statusId === "warded"
)), "陣を組み直して前へ出した味方へ守勢を渡す");

// 身代わりは本人が狙われた時にRPだけを捨てない。
const cover = run(
  "cover_self_target",
  [
    ally("a", ["bulwark"], {
      reactives: ["cover_ally"], stats: { maxHp: 100, might: 1, focus: 1, guard: 0 },
    }),
    ally("b", ["bulwark"], {
      characterId: "mender", position: "front_right",
      stats: { maxHp: 1_000, might: 1, focus: 1, guard: 0 },
    }),
  ],
  [enemy("e", "husk", { stats: { maxHp: 1_000, might: 10, focus: 10, guard: 0 } })],
);
check(!cover.events.some((event) => event.ruleId === "cover_ally_rule"),
  "身代わり所有者本人が標的なら規則は発火しない");
check(!cover.events.some((event) => event.type === "resource_spent"
  && event.values.resource === "reaction_points" && event.sourceActorId === "a"),
"身代わりの空振りでRPを消費しない");

// status rule は最大6hitまでを明示的に覆う。実技能の最大5hitと追加hit affixの
// 1hitぶんを含み、エンジンの「同ruleはchain 1回」を緩めていない。
for (const statusId of ["exposed", "staggered", "warded"]) {
  const hitIndexes = PLAYABLE_CONTENT.statuses[statusId].rules
    .filter((rule) => rule.predicates.some((predicate) => (
      predicate.type === "has_status" && predicate.value === 1
    )))
    .map((rule) => rule.predicates.find((predicate) => (
      predicate.type === "event_value" && predicate.key === "hitIndex"
    ))?.value)
    .sort((a, b) => a - b);
  assert.deepEqual(hitIndexes, [0, 1, 2, 3, 4, 5], `${statusId} は6hitまで有限規則で覆う`);
  checks += 1;
}

// ============================================================ 出番と報酬（issue #286）
//
// **いつでも出せるものは伸びない。場面を選ぶものが伸びる。**
//
// アクティブは1ラウンドに1本しか出ないので、装着した無条件の技能は輪番で出番を
// 分け合う（DESIGN 8.7.5）。条件つきは条件が成立しない拍で読み飛ばされるだけなので、
// 出番を奪わない。この非対称を放っておくと、技能点は必ず「毎ラウンド出る無条件の
// 1本」へ集まり、**2本目を装着すると弱くなる**（analysis/ecology-active-slot-report.mjs
// が 72% と実測した）。規約は二つで、どちらも content 側だけで閉じている。
//
//   1. 上限は出番の逆（content/skill-levels.mjs）… 無条件のアクティブは Lv5、
//      条件つきは Lv10。ここでは「実際にそうなっているか」を数える。
//   2. 条件の報酬 … 条件つきの攻撃節は、**同じ能力値・同じ予算で取れる
//      「その拍で出せる素の無条件」の上限 Lv を、Lv1 で上回る。**
//      上回らないなら、条件を満たす手間に対して何も払われていない。
//
// 免除は二つだけ。**量以外で報われているもの**（状態・位置・資源を動かす）と、
// **対象数で報われているもの**（行・列・全体へ届く）。どちらも「量で上回れ」と
// 言うと、範囲技や刻印技を無意味に太らせることになる。
//
// 比べる相手から**溜め技を外す**。溜めは一撃へ集約する代わりに拍を先に払うので、
// 「その拍で出せる一撃」ではない（大溜めの一手あたり平均と、いま出せる一撃を
// 並べると、選択の話にならない）。
const activeNodes = SKILL_TREE_NODES.filter((node) => node.kind === "active");
const definitionOf = (skillId) => PLAYABLE_CONTENT.activeSkills[skillId];
const allEffectsOf = (skill) => [
  ...(skill?.effects ?? []), ...(skill?.preparation?.completionEffects ?? []),
];
const damageEffectsOf = (skill) => allEffectsOf(skill).filter((effect) => effect.type === "deal_damage");

// 技能欄の「無条件／条件つき」と同じ根拠（app.js の skillConditionLabel）。
// プレイヤーが付けた useWhen は run ごとに変わるので、ここでは数えない。
const isConditional = (skill) => (skill?.intrinsicPredicates ?? []).length > 0
  || (skill?.targetQuery?.filters ?? []).some((filter) => filter.type !== "alive");
const spreadsAcrossTargets = (skill) => allEffectsOf(skill)
  .some((effect) => effect.targetPattern && effect.targetPattern !== "single");
const paysInSomethingElse = (skill) => allEffectsOf(skill)
  .some((effect) => effect.type !== "deal_damage");
const isPlainDamage = (skill) => {
  const effects = allEffectsOf(skill);
  return effects.length > 0 && effects.every((effect) => effect.type === "deal_damage");
};
// 一手あたりの総係数。多段は足し、溜めは拍で割る。
const perActionBps = (skill) => Math.round(
  damageEffectsOf(skill).reduce(
    (total, effect) => total + (effect.amount?.coefficientBps ?? 0) * (effect.hitCount ?? 1), 0,
  ) / (1 + (skill?.preparation?.steps ?? 0)),
);
const scalingStatOf = (skill) => damageEffectsOf(skill)[0]?.amount?.scalingStat ?? null;
// **比べる相手は「据え置き価格で届く上限」。**Lv6 以降は1段2点なので、
// そこから先は「他を全部諦める」宣言になる。条件つきはその宣言をしていない
// 相手（＝Lv5 の無条件）を Lv1 で上回っていればよい。
const atFlatCeiling = (skill, skillId) => Math.round(
  perActionBps(skill)
    * (BPS + (Math.min(SKILL_LEVEL_CAPS[skillId], UNCONDITIONAL_FLAT_LEVELS) - MIN_SKILL_LEVEL)
      * SKILL_LEVEL_STEP_BPS) / BPS,
);

const activeEntries = activeNodes.map((node) => {
  const skill = definitionOf(node.skillId);
  return {
    skillId: node.skillId,
    displayName: skill?.displayName ?? node.skillId,
    budget: unlockBudget(node.skillId),
    conditional: isConditional(skill),
    prepares: (skill?.preparation?.steps ?? 0) > 0,
    plain: isPlainDamage(skill),
    spread: spreadsAcrossTargets(skill),
    other: paysInSomethingElse(skill),
    bps: perActionBps(skill),
    stat: scalingStatOf(skill),
    cap: SKILL_LEVEL_CAPS[node.skillId],
  };
});

// 1. 値段が出番の逆になっている。**天井（Lv10）は動かさない。**
for (const entry of activeEntries) {
  if (entry.cap === MIN_SKILL_LEVEL) continue;  // 連続量を持たない技能
  const definition = definitionOf(entry.skillId);
  equal(entry.cap, MAX_SKILL_LEVEL, `${entry.displayName} の上限は Lv10 のまま`);
  equal(skillLevelCost(definition, UNCONDITIONAL_FLAT_LEVELS), SKILL_LEVEL_COST,
    `${entry.displayName} は Lv${UNCONDITIONAL_FLAT_LEVELS} までなら1点`);
  equal(skillLevelCost(definition, UNCONDITIONAL_FLAT_LEVELS + 1),
    entry.conditional ? SKILL_LEVEL_COST : SKILL_LEVEL_COST_STEEP,
    `${entry.displayName}（${entry.conditional ? "条件つき" : "無条件"}）の`
    + `Lv${UNCONDITIONAL_FLAT_LEVELS + 1} の値段が出番と対応する`);
}
check(activeEntries.some((entry) => entry.cap > MIN_SKILL_LEVEL && !entry.conditional),
  "値上がりする無条件のアクティブが実際にある（規約が空振りしていない）");
check(activeEntries.some((entry) => entry.cap > MIN_SKILL_LEVEL && entry.conditional),
  "据え置きのまま伸びる条件つきが実際にある");

// 2. 条件の報酬。
const plainRivals = activeEntries.filter((entry) => (
  !entry.conditional && entry.plain && !entry.spread && !entry.prepares && entry.bps > 0
));
// **敵も使う技能は、味方の側だけを直せない**（AGENTS.md: 敵も味方と同じ共有語彙を使う）。
// 倍率を上げると同じ技能を持つ敵がそのまま強くなり、難度曲線が動く
// （実測: 後衛狩りを上げると第6段の刻みが 24% → 32% になった）。
// **敵の側とセットで直すまでの保留**で、この表は増やさない。減らすだけにする。
const SHARED_WITH_ENEMIES = Object.freeze({
  rear_hunt: "灰織の遠手（weave_reach）の主攻撃",
  finishing_thrust: "灰炉の熾（forge_ember）の主攻撃",
  execute_low: "灰炉の熾（forge_ember）の主攻撃",
});
for (const [skillId, reason] of Object.entries(SHARED_WITH_ENEMIES)) {
  check(Object.values(PLAYABLE_CONTENT.enemyActors).some((actor) => (
    (actor.tactics ?? []).some((tactic) => tactic.activeSkillId === skillId)
  )), `${skillId} の保留理由（${reason}）が実際の敵と合っている`);
}

for (const entry of activeEntries) {
  if (!entry.conditional || entry.bps === 0) continue;
  if (entry.other || entry.spread) continue;  // 量以外／対象数で報われている
  if (SHARED_WITH_ENEMIES[entry.skillId]) continue;  // 敵の再調整とセットで直す
  const rivals = plainRivals.filter((rival) => rival.budget <= entry.budget && rival.stat === entry.stat);
  const ceiling = rivals.reduce(
    (top, rival) => Math.max(top, atFlatCeiling(definitionOf(rival.skillId), rival.skillId)), 0,
  );
  check(entry.bps > ceiling,
    `${entry.displayName}（予算${entry.budget}・${entry.bps / 100}%）は`
    + `同格の無条件が据え置き価格で届く ${ceiling / 100}% を Lv1 で上回る`);
}

console.log(`ecology skill balance smoke: ${checks} checks passed`);
