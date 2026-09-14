// ecology/attack-style.test.mjs — 作者要望 2026-09-14。
//
// **腕力の攻撃は斬撃、技術の攻撃は銃撃。**分けているのは画面の CSS だが、どちらの
// 型かを決めているのはここなので、決め方そのものを content の実物で押さえる。
//
// 見るのは三つ。
//   1. effect の tag（weapon / technique）が最優先で効く。
//   2. tag が無ければ伸びる能力値（might / focus）で補う。
//   3. 攻撃でないダメージ（裂傷・装備の破片）はどちらの型も返さない。

import assert from "node:assert/strict";
import { PLAYABLE_CONTENT } from "./content/index.mjs";
import { TECHNIQUE_SKILL_IDS } from "./content/skills-active.mjs";
import { ultimateIdFor, withUltimates } from "./ultimates.mjs";
import {
  attackStyleOfEffect,
  attackStyleOfEvent,
  beatAttackStyle,
  buildAttackStyleIndex,
} from "./attack-style.mjs";

const index = buildAttackStyleIndex(PLAYABLE_CONTENT);

// 1. tag が正本。
assert.equal(
  attackStyleOfEffect({ type: "deal_damage", tags: ["attack", "technique"], amount: { scalingStat: "might" } }),
  "technique",
  "tag は scalingStat より優先する",
);
assert.equal(
  attackStyleOfEffect({ type: "deal_damage", tags: ["attack", "weapon"], amount: { scalingStat: "focus" } }),
  "weapon",
  "weapon tag も同じく優先する",
);

// 2. tag が無い定義は能力値で補う。
assert.equal(
  attackStyleOfEffect({ type: "deal_damage", tags: ["attack"], amount: { scalingStat: "might" } }),
  "weapon",
  "腕力で伸びる攻撃は斬撃",
);
assert.equal(
  attackStyleOfEffect({ type: "deal_damage", tags: ["attack"], amount: { scalingStat: "focus" } }),
  "technique",
  "技術で伸びる攻撃は銃撃",
);

// 3. 攻撃でないダメージには型が無い。
assert.equal(
  attackStyleOfEffect({ type: "deal_damage", tags: ["bleed"], amount: { type: "constant", value: 4 } }),
  null,
  "定数のダメージは攻撃の型を持たない",
);
assert.equal(attackStyleOfEffect({ type: "heal", amount: { scalingStat: "focus" } }), null, "回復は攻撃ではない");

// content の実物。**基準の一撃と、技術へ寄せた技能の全部**をここで押さえる。
assert.equal(index.get("strike"), "weapon", "踏み込み斬りは斬撃");
assert.equal(index.get("basic_strike_melee"), "weapon", "通常攻撃は斬撃");
assert.equal(index.get("front_strike"), "weapon", "敵の前列攻撃は斬撃");
assert.equal(index.get("rear_strike"), "technique", "後列から撃つ敵の一撃は銃撃");
for (const id of TECHNIQUE_SKILL_IDS) {
  assert.equal(index.get(id), "technique", id + " は技術の技能なので銃撃");
}
assert.equal(index.get("heavy_swing"), "technique", "溜め技の着弾は完了効果の側にある");
assert.equal(index.get("bulwark"), undefined, "防壁形成はダメージを出さないので型を持たない");
assert.equal(index.get("bleeding"), undefined, "裂傷は攻撃の型を持たない");

// イベントからの読み。tag → skillId → ruleId → sourceDefinitionId の順で引く。
const impact = (fields) => ({ type: "damage_taken", targetActorIds: ["a_warden"], ...fields });
assert.equal(attackStyleOfEvent(index, impact({ tags: ["attack", "technique"], skillId: "strike" })), "technique",
  "イベントの tag は定義より優先する");
assert.equal(attackStyleOfEvent(index, impact({ skillId: "aimed_shot" })), "technique", "技能 ID から引ける");
assert.equal(attackStyleOfEvent(index, impact({ ruleId: "counter_blow_rule" })), "weapon", "規則 ID から引ける");
assert.equal(attackStyleOfEvent(index, impact({ sourceDefinitionId: "opportunist" })), "weapon", "出どころの定義から引ける");
assert.equal(attackStyleOfEvent(index, impact({ skillId: "unknown_skill" })), null, "知らない ID には型が無い");

// 拍からの読み。着弾のイベントだけを見る。
const declareOnly = { kind: "declare", events: [{ type: "action_declared", skillId: "aimed_shot" }] };
assert.equal(beatAttackStyle(index, declareOnly), null, "宣言だけの拍では絵を変えない");
const shot = {
  kind: "impact",
  events: [
    { type: "action_started", skillId: "aimed_shot" },
    impact({ skillId: "aimed_shot", values: { amount: 12 } }),
  ],
};
assert.equal(beatAttackStyle(index, shot), "technique", "着弾のある拍は技能の型を返す");
const bleed = { kind: "sub", events: [impact({ ruleId: "bleeding_tick", tags: ["bleed"] })] };
assert.equal(beatAttackStyle(index, bleed), null, "裂傷の刻みは攻撃の絵を出さない");

// 必殺技は取得済み技能から毎回作る（固定 content に無い）。**元の型を引き継ぐ**ことを
// 押さえておかないと、必殺の一撃だけが既定の斬撃へ落ちる。
const ultimateShot = withUltimates(PLAYABLE_CONTENT, ["aimed_shot"]).activeSkills[ultimateIdFor("aimed_shot")];
assert.ok(ultimateShot, "狙い撃ちは必殺にできる");
assert.equal(
  buildAttackStyleIndex({ activeSkills: { [ultimateShot.id]: ultimateShot } }).get(ultimateShot.id),
  "technique",
  "必殺になっても技術の技能は銃撃のまま",
);

console.log("ecology attack-style tests ok");
