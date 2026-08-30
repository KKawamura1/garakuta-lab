// ecology/content/base.mjs
//
// **種類別ファイルが共有する道具だけを置く。** ここに定義そのものを置かない。
// R5 fixture を土台に、表示名の差し替えと部分改変で本番定義を作る。

import { FIXTURE_CONTENT } from "../fixture-content.mjs";

export const clone = (value) => structuredClone(value);

// fixture の一節を、渡した表示名で置き換えて複製する。
export function renamed(section, displayNames = {}) {
  return Object.fromEntries(
    Object.entries(FIXTURE_CONTENT[section]).map(([id, definition]) => [
      id,
      displayNames[id]
        ? { ...clone(definition), displayName: displayNames[id] }
        : clone(definition),
    ]),
  );
}

export function cloneActive(baseId, id, displayName, patch = {}) {
  const definition = clone(FIXTURE_CONTENT.activeSkills[baseId]);
  definition.id = id;
  definition.displayName = displayName;
  Object.assign(definition, patch);
  return definition;
}

export function cloneEnemy(baseId, id, displayName, patch = {}) {
  const definition = clone(FIXTURE_CONTENT.enemyActors[baseId]);
  definition.id = id;
  definition.displayName = displayName;
  Object.assign(definition, patch);
  definition.tags = [...new Set([...(definition.tags ?? []), "playable"])];
  return definition;
}

export function cloneEquipment(baseId, id, displayName, patch = {}) {
  const definition = clone(FIXTURE_CONTENT.equipment[baseId]);
  definition.id = id;
  definition.displayName = displayName;
  definition.rules = definition.rules.map((rule, index) => ({
    ...rule,
    id: id + "_rule_" + index,
  }));
  Object.assign(definition, patch);
  return definition;
}

export function setRuleEffectAmount(definition, value, effectType) {
  for (const rule of definition.rules ?? []) {
    for (const effect of rule.effects ?? []) {
      if (effectType && effect.type !== effectType) continue;
      if (effect.amount?.type === "constant") effect.amount.value = value;
    }
  }
  return definition;
}

// ---------------------------------------------------------------- Phase A の移行
//
// R6 §4.4 — 戦闘量を約10倍し、技能の量を might / focus の係数へ移す。
//
// **定数×10だけで終えない**（R6 が明示的に禁じている）。技能ごとに
// 「weapon か technique か」「係数いくつか」を決める。決め方は2つだけ：
//
//   1. R6 §4.4 が名指しした3つ … 斬撃 might 100%、手当て focus 80%、防壁形成 focus 60%
//   2. それ以外 … **中立 parameter（might = focus = 40）で現行の相対効果量を保つ**
//      係数から始める。現行値 V に対して coefficientBps = V × 2500
//      （40 × V×2500 / 10_000 = V×10）
//
// 係数は soft data なので、遊んだあとに動かしてよい。動かしたら build の印が変わる。

// 連続量を持つ effect だけを移す。離散量（行動権・耐久・段数）は触らない。
// この分類は analysis/ecology-contract-smoke.mjs の表と同じでなければならない。
const CONTINUOUS_EFFECTS = new Set(["deal_damage", "heal", "gain_barrier", "modify_pending_amount"]);

export const LEGACY_COMBAT_SCALE = 10;
// 中立 parameter。ここを動かすと全技能の初期係数が動く。
export const NEUTRAL_STAT = 40;

export function bpsForLegacyAmount(value) {
  return value * (LEGACY_COMBAT_SCALE * 10_000) / NEUTRAL_STAT;
}

// 定数の量を stat_scaled へ移す。scaling は effect ごとではなく**技能ごと**に決める
// （同じ技能の中で might と focus が混ざると、何で伸びる技能なのか読めない）。
export function scaleDefinitionAmounts(definition, scaling) {
  if (!scaling) return definition;
  const { stat, bps } = scaling;
  walkEffects(definition, (effect) => {
    if (!CONTINUOUS_EFFECTS.has(effect.type)) return;
    if (effect.amount?.type !== "constant") return;
    const coefficientBps = bps ?? bpsForLegacyAmount(effect.amount.value);
    effect.amount = {
      type: "stat_scaled",
      subject: "self",
      scalingStat: stat,
      coefficientBps,
    };
  });
  return definition;
}

// 装備と状態異常は parameter に依存させない。R6 §4.4 が
// 「装備の flat roll は parameter 非依存で残してよい」と言っているので、
// **10倍した定数のまま**にする。持ち主が強くなっても装備は同じだけ効く。
export function scaleFlatAmounts(definition) {
  walkEffects(definition, (effect) => {
    if (!CONTINUOUS_EFFECTS.has(effect.type)) return;
    if (effect.amount?.type !== "constant") return;
    effect.amount = { ...effect.amount, value: effect.amount.value * LEGACY_COMBAT_SCALE };
  });
  return definition;
}

function walkEffects(node, visit) {
  if (Array.isArray(node)) {
    for (const item of node) walkEffects(item, visit);
    return;
  }
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string" && node.amount) visit(node);
  for (const value of Object.values(node)) walkEffects(value, visit);
}
