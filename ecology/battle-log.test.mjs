// Issue #198 — 中央の拍ログは、同時イベントの詳細列ではなく
// プレイヤーが一読できる主行動と重要な結果を表示する。

import assert from "node:assert/strict";
import { CENTRAL_LOG_MAX_CHARS, summarizeBattleBeat } from "./battle-log.mjs";

const ACTORS = {
  a_gou: "ゴウ",
  a_tsugumi: "ツグミ",
  e_husk: "灰狼",
  e_wraith: "影兵",
};
const SKILLS = {
  strike: "斬撃",
  triage: "応急手当",
  enemy_heavy: "重い一撃",
  seize_the_opening: "機を逃さず",
};
const STATUSES = { exposed: "隙" };
const resolve = {
  actorName: (id) => ACTORS[id] ?? id,
  skillName: (id) => SKILLS[id] ?? id,
  statusName: (id) => STATUSES[id] ?? id,
  targetName: (ids) => ids.length > 1 ? (ids.length === 3 ? "敵全体" : ids.length + "体") : ACTORS[ids[0]] ?? ids[0],
  causeName: (event) => event.ruleId === "equipment_rule" ? "刃の刻印" : "機を逃さず",
};

const event = (type, fields = {}) => ({
  type,
  round: 2,
  sourceActorId: "a_gou",
  targetActorIds: ["e_husk"],
  values: {},
  ...fields,
});

const textOf = (kind, events) => summarizeBattleBeat({ kind, events }, resolve);
const expectCompact = (text) => {
  assert.ok(text.length <= CENTRAL_LOG_MAX_CHARS, `中央ログが長すぎる: ${text}`);
  assert.doesNotMatch(text, /＋/, `中央ログがイベント連結になっている: ${text}`);
  assert.doesNotMatch(text, /damage_|action_started|status_added/, `技術語が中央へ漏れている: ${text}`);
};

// 単体攻撃は開始・提案・着弾を重ねず、結果を主文にする。
const attack = textOf("impact", [
  event("action_started", { skillId: "strike" }),
  event("damage_proposed", { values: { amount: 5 } }),
  event("damage_taken", { values: { amount: 5 } }),
]);
assert.match(attack, /ゴウ/);
assert.match(attack, /斬撃/);
assert.match(attack, /灰狼/);
assert.match(attack, /5ダメージ/);
assert.doesNotMatch(attack, /始まる/);
expectCompact(attack);

const declaration = textOf("declare", [
  event("action_declared", { skillId: "strike", targetActorIds: ["e_husk"] }),
  event("target_selected", { skillId: "strike", targetActorIds: ["e_husk", "e_wraith", "e_third"] }),
]);
assert.match(declaration, /斬撃/);
assert.match(declaration, /敵全体/);
expectCompact(declaration);

// 複数対象は名前をすべて並べず、対象全体であることと結果を残す。
const multiTarget = textOf("impact", [
  event("action_started", { skillId: "strike", targetActorIds: ["e_husk", "e_wraith", "e_third"] }),
  event("damage_taken", { targetActorIds: ["e_husk"], values: { amount: 4 } }),
  event("damage_taken", { targetActorIds: ["e_wraith"], values: { amount: 4 } }),
  event("damage_taken", { targetActorIds: ["e_third"], values: { amount: 4 } }),
]);
assert.match(multiTarget, /敵全体/);
assert.match(multiTarget, /4ダメージ/);
expectCompact(multiTarget);

// 防壁で完全吸収された攻撃は、HPダメージが無くても攻撃と吸収を表示する。
const absorbed = textOf("impact", [
  event("action_started", { skillId: "strike" }),
  event("damage_absorbed", { values: { amount: 7, finalDamage: 0, fullyAbsorbed: true } }),
]);
assert.match(absorbed, /防壁7吸収/);
assert.match(absorbed, /0ダメージ/);
expectCompact(absorbed);

const healed = textOf("sub", [
  event("healing_applied", {
    sourceActorId: "a_tsugumi",
    targetActorIds: ["a_gou"],
    skillId: "triage",
    values: { amount: 3, actual: 3 },
  }),
]);
assert.match(healed, /ツグミ/);
assert.match(healed, /ゴウ/);
assert.match(healed, /3回復/);
expectCompact(healed);

const status = textOf("sub", [
  event("status_added", {
    sourceActorId: "a_tsugumi",
    targetActorIds: ["e_husk"],
    skillId: "seize_the_opening",
    values: { statusId: "exposed", stacks: 1 },
  }),
]);
assert.match(status, /隙付与/);
assert.match(status, /ツグミ/);
expectCompact(status);

const equipment = textOf("sub", [
  event("equipment_worn", {
    ruleId: "equipment_rule",
    values: { before: 2, after: 1, amount: 1 },
  }),
]);
assert.match(equipment, /ゴウ/);
assert.match(equipment, /装備反応/);
assert.match(equipment, /刃の刻印/);
expectCompact(equipment);

// 敵の行動と不発も同じ短い語彙で読める。
const enemySkipped = textOf("skipped", [
  event("action_canceled", {
    sourceActorId: "e_husk",
    targetActorIds: [],
    skillId: "enemy_heavy",
    values: { reason: "no_target" },
  }),
]);
assert.match(enemySkipped, /灰狼/);
assert.match(enemySkipped, /重い一撃/);
assert.match(enemySkipped, /不発/);
assert.match(enemySkipped, /対象なし/);
expectCompact(enemySkipped);

const prepared = textOf("prepare", [
  event("preparation_completed", { skillId: "enemy_heavy", sourceActorId: "e_husk", targetActorIds: ["a_gou"] }),
]);
assert.match(prepared, /灰狼/);
assert.match(prepared, /準備完了/);
expectCompact(prepared);

console.log("battle-log checks ok", JSON.stringify({ samples: 9, maxChars: CENTRAL_LOG_MAX_CHARS }));
