// ecology/equipment-gen.mjs
//
// **Phase C の装備 generator。R8 §3.5、§13.2、Implementation Phase 4 step 1〜2。**
//
// 契約（ここを壊したら Phase C は成立しない）
//
//   1. **決定性。** 同じ seed / dropIndex / rarity / family pool から、同じ品が出る。
//      Date も Math.random も読まない。
//   2. **完結 rule だけを作る。** trigger だけ、effect だけ、発火不能、無料無限循環は
//      生成しない（R8 §3.5）。作れなかったら既定品へ黙って落ちず、診断 error を投げる。
//   3. **power budget は item 全体で一つ。** rule 数で倍にしない（R8 §3.5）。
//   4. **canonical descriptor は品の同一性。** Blueprint はこれを保存し、
//      同じ descriptor からは同じ品が再製造される（R8 §3.6）。
//
// 目録（affix そのもの）は content/affixes.mjs にある。ここは組み立てと検査だけを持つ。

import { makeRng, seedKey } from "./seeded.mjs";
import { validateContentBundle } from "./validate.mjs";
import { PLAYABLE_CONTENT, CONTENT_CONTRACT_VERSION } from "./content/index.mjs";
import {
  AFFIX_BY_ID,
  AFFIX_FAMILY_IDS,
  AFFIXES_BY_ROLE,
  COST_AFFIX_IDS,
  EQUIPMENT_IMPLICITS,
  ITEM_NOUNS,
  RARITIES,
  RARITY_BUDGET,
  RARITY_LABEL,
  SHAPE_AFFIX_IDS,
} from "./content/affixes.mjs";

// **版を上げたら、古い Blueprint は disabled 表示になる。**黙って別物を作らない
// （R8 §3.6「互換不能な古いBlueprintを削除せず、disabledReasonを表示する」）。
export const GENERATOR_VERSION = "ecology-equipment-gen-7";

// R8 §3.5 —「50 attemptで生成不能なら既定品へ黙ってfallbackせず、診断errorにする。」
export const GENERATOR_MAX_ATTEMPTS = 50;

// rarity は「落ちやすさ」だけでなく、最低限の耐久・効果数・発動回数にも効く。
const BASE_DURABILITY = Object.freeze({
  common: 2,
  rare: 2,
  epic: 3,
  legendary: 3,
  mythic: 4,
  oopart: 5,
});
const MAX_CONVERTERS_PER_RULE = 1;
const MAX_PAYOFFS_PER_RULE = 3;
const MAX_TIER = 2;

// 効果 rarity は同じ affix でも最終値を変える。離散量は倍率ではなく、
// legendary 以上で段階的に +1 する（行動点や受け止めを壊れにくくするため）。
const EFFECT_AMOUNT_BPS = Object.freeze({
  common: 10000,
  rare: 11500,
  epic: 13500,
  legendary: 16000,
  mythic: 19500,
  oopart: 24000,
});
const EFFECT_LIMIT_BONUS = Object.freeze({
  common: 0,
  rare: 0,
  epic: 1,
  legendary: 1,
  mythic: 2,
  oopart: 3,
});
// 高位 item の追加効果が common だらけにならないよう、品質の下限を段階的に上げる。
// common / rare の規格外品だけは、重い代償と引き換えに item より最大2段上へ飛べる。
const EFFECT_RARITY_FLOOR = Object.freeze({
  common: "common",
  rare: "common",
  epic: "rare",
  legendary: "epic",
  mythic: "legendary",
  oopart: "mythic",
});
const EFFECT_RARITY_WEIGHTS = Object.freeze([50, 30, 14, 6]);
const RISK_COST_CHANCE = Object.freeze({ common: 0.12, rare: 0.08, epic: 0, legendary: 0, mythic: 0, oopart: 0 });
const KEYSTONE_CHANCE = Object.freeze({ common: 0, rare: 0, epic: 0, legendary: 0.7, mythic: 0.9, oopart: 1 });
// 狭い family pool では item rarity の目標予算を満額使えないことがある。
// 生成不能にしない代わりに、等級ごとの最低 power は守る。
const MIN_POWER = Object.freeze({
  common: 4,
  rare: 6,
  epic: 9,
  legendary: 14,
  mythic: 20,
  oopart: 28,
});

export class EquipmentGenerationError extends Error {
  constructor(message, diagnostics) {
    super(message);
    this.name = "EquipmentGenerationError";
    this.diagnostics = diagnostics;
  }
}

// ---------------------------------------------------------------- 決定的な選択

function pickIndex(rng, length) {
  return Math.min(length - 1, Math.floor(rng() * length));
}
function pick(rng, list) {
  return list.length ? list[pickIndex(rng, list.length)] : null;
}
function pickInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

// ---------------------------------------------------------------- affix pool

// R8 §13.2 — manifest の enabledAffixFamilyIds が pool を決める。
// **持込 Blueprint は manifest 外の family でも動く**（R8 §3.6）。それは
// 再製造が descriptor をそのまま復元するからで、ここの pool とは無関係。
export function affixPool(familyIds = AFFIX_FAMILY_IDS) {
  const allowed = new Set(familyIds.length ? familyIds : AFFIX_FAMILY_IDS);
  const inPool = (affix) => allowed.has(affix.familyId);
  return {
    source: AFFIXES_BY_ROLE.source.filter(inPool),
    converter: AFFIXES_BY_ROLE.converter.filter(inPool),
    payoff: AFFIXES_BY_ROLE.payoff.filter(inPool),
    cost: COST_AFFIX_IDS.map((id) => AFFIX_BY_ID[id]).filter(inPool),
    shape: SHAPE_AFFIX_IDS.map((id) => AFFIX_BY_ID[id]).filter(inPool),
    keystone: AFFIXES_BY_ROLE.keystone.filter(inPool),
  };
}

const satisfies = (requires, provides) => (requires ?? []).every((tag) => provides.includes(tag));
const sharesTheme = (left = [], right = []) => left.some((tag) => right.includes(tag));
const payoffFitsSource = (payoff, source) => satisfies(payoff.requires, source.provides ?? [])
  && sharesTheme(source.supports ?? [], payoff.payoffTags ?? []);
// 自分のHPを消費する代償と、自分だけを回復する効果は、同じ装備に重ねない。
// 回復の基準値が低い品では、発火しても差し引きで損をするため。
const isSelfHealPayoff = (payoff) => {
  const affix = payoff?.affix ?? payoff;
  const effect = affix?.effect?.(1);
  return effect?.type === "heal" && effect.target?.scope === "self";
};
const isHpCost = (affix) => affix?.cost?.type === "lose_hp";
const isRepairPayoff = (payoff) => {
  const affix = payoff?.affix ?? payoff;
  return affix?.effect?.(1)?.type === "repair_equipment";
};

// issue #210 — 発火する生成装備 rule は、追加の代償とは別に装備自身の
// 耐久を払う。多段・範囲・複数効果は一回の発火で耐久2を使う。
// 修理だけは「1減らして1戻す」という死に rule を避け、非耐久の有限コストを払う。
function durabilityCostOf(draft, rule) {
  if (rule.payoffs.some(isRepairPayoff)) return 0;
  const explicitWear = rule.cost?.cost?.type === "wear_equipment"
    ? rule.cost.cost.amount
    : 0;
  const effects = rule.payoffs.map((payoff) => {
    const effect = payoff.affix.effect(1);
    return draft.keystone?.transformEffect ? draft.keystone.transformEffect(effect) : effect;
  });
  if (draft.keystone?.extraEffect) effects.push(draft.keystone.extraEffect());
  const heavy = effects.length > 1 || effects.some((effect) =>
    (effect.hitCount ?? 1) > 1
      || ["row", "column"].includes(effect.targetPattern)
      || effect.target?.take === "all");
  return Math.max(explicitWear, heavy ? 2 : 1);
}

function costsOf(draft, rule) {
  const costs = [];
  const wear = durabilityCostOf(draft, rule);
  if (wear > 0) costs.push({ type: "wear_equipment", amount: wear });
  if (rule.cost && rule.cost.cost.type !== "wear_equipment") {
    costs.push({ ...rule.cost.cost });
  }
  return costs;
}
const converterFitsSource = (converter, source, payoff) => {
  const valueKeys = source.valueKeys ?? [];
  return satisfies(converter.requires, source.provides ?? [])
    && sharesTheme(converter.supports ?? [], payoff.payoffTags ?? [])
    && (converter.predicates ?? []).every((predicate) =>
      predicate.type !== "event_value" || valueKeys.includes(predicate.key));
};

// ---------------------------------------------------------------- 組み立て

function rollEffectRarity(rng, minRarity, maxRarity) {
  const minIndex = Math.max(0, RARITIES.indexOf(minRarity));
  const maxIndex = Math.max(minIndex, RARITIES.indexOf(maxRarity));
  const candidates = RARITIES.slice(minIndex, maxIndex + 1);
  const total = candidates.reduce(
    (sum, _rarity, index) => sum + (EFFECT_RARITY_WEIGHTS[index] ?? 1),
    0,
  );
  let roll = rng() * total;
  for (let index = 0; index < candidates.length; index += 1) {
    roll -= EFFECT_RARITY_WEIGHTS[index] ?? 1;
    if (roll < 0) return candidates[index];
  }
  return candidates[candidates.length - 1];
}

function assignEffectRarities(rng, draft) {
  const slots = draft.rules.flatMap((rule) => rule.payoffs.map((payoff) => ({ rule, payoff })));
  if (!slots.length) return;
  const floor = EFFECT_RARITY_FLOOR[draft.rarity] ?? "common";
  // 基礎効果とは別に、追加効果にも item と同じ品質を一つ保証する。
  const guaranteedIndex = pickIndex(rng, slots.length);
  slots.forEach(({ payoff }, index) => {
    payoff.effectRarity = index === guaranteedIndex
      ? draft.rarity
      : rollEffectRarity(rng, floor, draft.rarity);
  });
  // common / rare の低確率品は、重い代償のある rule に限って最大2段上の効果を持つ。
  const risky = slots.filter(({ rule }) => rule.cost?.risky);
  // 同じ slot を格上げして保証枠を消さない。低レアでも item 同格の効果を
  // 少なくとも一つ残し、規格外効果は別 slot に載せる。
  const promotable = risky.filter(({ payoff }) => payoff.effectRarity !== draft.rarity);
  if (promotable.length) {
    const promoted = pick(rng, promotable);
    const itemIndex = RARITIES.indexOf(draft.rarity);
    promoted.payoff.effectRarity = RARITIES[Math.min(RARITIES.length - 1, itemIndex + 2)];
  }
}

function buildRuleDraft(rng, rarity, pool, budget, sourceIdsUsed, riskUsed, hasSelfHeal, hasHpCost) {
  // 同じ trigger を二度使うと「同じ出来事の二重取り」になり、rule が別々である
  // 意味が消える。**item の中で trigger は重複させない。**
  const sources = pool.source.filter((affix) => !sourceIdsUsed.has(affix.id));
  if (!sources.length) return null;
  const source = pick(rng, sources);
  const provides = source.provides ?? [];

  const payoffCandidates = pool.payoff.filter((affix) => payoffFitsSource(affix, source)
    && (!hasHpCost || !isSelfHealPayoff(affix)));
  if (!payoffCandidates.length) return null;
  const payoff = pick(rng, payoffCandidates);

  const costCandidates = pool.cost.filter((affix) => {
    if ((payoff.forbidsCostTypes ?? []).includes(affix.cost.type)) return false;
    if (payoff.needsFiniteCost && !affix.finite) return false;
    if (isHpCost(affix) && (hasSelfHeal || isSelfHealPayoff(payoff))) return false;
    // 代償が trigger と同じ出来事を出すと、払った瞬間に自分を呼び戻す。
    if ((affix.emits ?? []).includes(source.listenTo)) return false;
    return true;
  });
  const needsCost = Boolean(payoff.needsFiniteCost || payoff.needsAnyCost);
  const safeCosts = costCandidates.filter((affix) => !affix.risky);
  const riskyCosts = costCandidates.filter((affix) => affix.risky);
  let cost = null;
  const wantsRisk = !riskUsed && riskyCosts.length > 0 && rng() < (RISK_COST_CHANCE[rarity] ?? 0);
  if (wantsRisk) {
    cost = pick(rng, riskyCosts);
  } else if (needsCost) {
    cost = pick(rng, safeCosts);
    if (!cost) return null;
  } else if (safeCosts.length && rng() < 0.35) {
    cost = pick(rng, safeCosts);
  }

  let power = payoff.power + (cost?.power ?? 0);
  if (power > budget) {
    if (!cost && costCandidates.length) {
      cost = pick(rng, costCandidates);
      power = payoff.power + cost.power;
    }
    if (power > budget) return null;
  }

  const converters = [];
  const usedGroups = new Set();
  const converterCandidates = pool.converter.filter((affix) => converterFitsSource(affix, source, payoff));
  const wanted = rng() < 0.32 ? 1 : 0;
  for (let index = 0; index < wanted; index += 1) {
    const options = converterCandidates.filter(
      (affix) => !usedGroups.has(affix.group) && !converters.includes(affix),
    );
    if (!options.length) break;
    const converter = pick(rng, options);
    usedGroups.add(converter.group);
    converters.push(converter);
  }

  const reentrant = (payoff.emits ?? []).includes(source.listenTo);
  const scope = reentrant || payoff.chainOnly ? "chain"
    : source.listenTo === "battle_started" ? "battle"
      : source.listenTo === "round_started" ? "round"
        : source.timing === "interrupt" ? pick(rng, ["chain", "round", "round"])
          : pick(rng, ["chain", "round", "round"]);
  return {
    source,
    converters,
    cost,
    payoffs: [{ affix: payoff, tier: 0, effectRarity: null }],
    limit: { scope, count: 1 },
    power,
  };
}

function draftPower(draft) {
  let power = draft.keystone?.power ?? 0;
  for (const shape of draft.shapes) power += shape.power;
  for (const rule of draft.rules) {
    power += (rule.cost?.power ?? 0);
    for (const payoff of rule.payoffs) power += payoff.affix.power + payoff.tier;
  }
  return power;
}

function affixCount(draft) {
  let count = draft.keystone ? 1 : 0;
  count += draft.shapes.length;
  for (const rule of draft.rules) {
    count += rule.converters.length + (rule.cost ? 1 : 0) + rule.payoffs.length;
  }
  return count;
}

function keystoneFitsDraft(keystone, draft) {
  // 発火回数を増やす keystone は、同じ被弾 chain に一度しか許されない回復や、
  // 自分の trigger を出し直す rule へ付くと、keystone 自体が audit で無効になる。
  if (keystone.limitBonusAll && draft.rules.some((rule) =>
    rule.payoffs.some((payoff) => payoff.affix.chainOnly
      || (payoff.affix.emits ?? []).includes(rule.source.listenTo)))) return false;
  const required = keystone.requiresEffectTypes ?? [];
  if (!required.length) return true;
  const effectTypes = draft.rules.flatMap((rule) =>
    rule.payoffs.map((payoff) => payoff.affix.effect(1).type));
  return required.some((type) => effectTypes.includes(type));
}

function chooseImplicit(rng, draft) {
  const tags = draft.rules.flatMap((rule) =>
    rule.payoffs.flatMap((payoff) => payoff.affix.payoffTags ?? []));
  const coherent = EQUIPMENT_IMPLICITS.filter((implicit) => sharesTheme(implicit.payoffTags, tags));
  return pick(rng, coherent.length ? coherent : EQUIPMENT_IMPLICITS);
}

function buildDraft(rng, rarity, pool) {
  const spec = RARITY_BUDGET[rarity];
  const draft = { rarity, implicit: null, keystone: null, shapes: [], rules: [] };
  const wantsKeystone = spec.keystones > 0
    && pool.keystone.length > 0
    && rng() < (KEYSTONE_CHANCE[rarity] ?? 0);
  const keystoneReserve = wantsKeystone ? Math.max(...pool.keystone.map((affix) => affix.power)) : 0;

  // family pool が狭い場合でも、存在しない数の trigger を要求して全 attempt を
  // 使い切らないようにする。重複 trigger は引き続き禁止するので、上限は
  // pool 内の source 数でも制限する。
  const maxRuleCount = Math.min(spec.rules[1], pool.source.length);
  if (maxRuleCount < spec.rules[0]) return null;
  const ruleCount = pickInt(rng, spec.rules[0], maxRuleCount);
  const sourceIdsUsed = new Set();
  let riskUsed = false;
  let hasSelfHeal = false;
  let hasHpCost = false;
  for (let index = 0; index < ruleCount; index += 1) {
    const remaining = spec.power - keystoneReserve - draftPower(draft);
    const rule = buildRuleDraft(
      rng, rarity, pool, remaining, sourceIdsUsed, riskUsed, hasSelfHeal, hasHpCost,
    );
    if (!rule) return null;
    sourceIdsUsed.add(rule.source.id);
    draft.rules.push(rule);
    riskUsed ||= Boolean(rule.cost?.risky);
    hasSelfHeal ||= rule.payoffs.some(isSelfHealPayoff);
    hasHpCost ||= isHpCost(rule.cost);
  }
  if (!draft.rules.length) return null;

  if (wantsKeystone) {
    const compatible = pool.keystone.filter((affix) => keystoneFitsDraft(affix, draft));
    if (!compatible.length && rarity === "oopart") return null;
    if (compatible.length) draft.keystone = pick(rng, compatible);
  }

  // ---- 予算の使い切り。**余った予算を捨てない**（rarity が意味を持たなくなる）。
  for (let guard = 0; guard < 24; guard += 1) {
    const remaining = spec.power - draftPower(draft);
    if (remaining <= 0) break;
    const options = [];
    for (const rule of draft.rules) {
      for (const payoff of rule.payoffs) {
        // **量が増えない tier は買わない。**集中のように上限1の効果へ予算を
        // 落とすと、rarity を上げたのに何も変わらない品が出る。
        const magnitudes = payoff.affix.magnitudes;
        const grows = payoff.tier < MAX_TIER && magnitudes[payoff.tier + 1] > magnitudes[payoff.tier];
        if (grows && remaining >= 1) options.push({ kind: "tier", payoff });
      }
      if (rule.payoffs.length < MAX_PAYOFFS_PER_RULE) {
        const provides = rule.source.provides ?? [];
        for (const affix of pool.payoff) {
          if (rule.payoffs.some((entry) => entry.affix.id === affix.id)) continue;
          if (!payoffFitsSource(affix, rule.source)) continue;
          if (!rule.converters.every((converter) => sharesTheme(converter.supports ?? [], affix.payoffTags ?? []))) continue;
          if (affix.needsFiniteCost && !rule.cost?.finite) continue;
          if (affix.needsAnyCost && !rule.cost) continue;
          if ((hasHpCost || isHpCost(rule.cost)) && isSelfHealPayoff(affix)) continue;
          if (affix.chainOnly && rule.limit.scope !== "chain") continue;
          if ((affix.emits ?? []).includes(rule.source.listenTo) && rule.limit.scope !== "chain") continue;
          if ((affix.forbidsCostTypes ?? []).includes(rule.cost?.cost?.type)) continue;
          if (affix.power > remaining) continue;
          options.push({ kind: "payoff", rule, affix });
        }
      }
    }
    for (const affix of pool.shape) {
      if (draft.shapes.includes(affix)) continue;
      if (affix.power > remaining) continue;
      options.push({ kind: "shape", affix });
    }
    if (!options.length) break;
    const choice = pick(rng, options);
    if (choice.kind === "tier") choice.payoff.tier += 1;
    else if (choice.kind === "payoff") choice.rule.payoffs.push({ affix: choice.affix, tier: 0, effectRarity: null });
    else draft.shapes.push(choice.affix);
  }

  // 条件は affix 数合わせに使わない。下限へ届かない draft は捨て、次の attempt で
  // payoff / shape が十分に揃う組み合わせを作る。
  if (affixCount(draft) < spec.affixes[0]) return null;
  draft.implicit = chooseImplicit(rng, draft);
  assignEffectRarities(rng, draft);
  return draft;
}

// ---------------------------------------------------------------- draft → 定義

function hash64(value) {
  let a = 2166136261;
  let b = 1099511628211 % 4294967296;
  for (const character of String(value)) {
    const code = character.charCodeAt(0);
    a = Math.imul(a ^ code, 16777619) >>> 0;
    b = Math.imul(b ^ (code + 0x9e37), 2246822519) >>> 0;
  }
  return (a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0"));
}

function magnitudeOf(payoff, rule, fallbackRarity = "common") {
  const conditionBonus = rule.converters.reduce((total, affix) => total + (affix.magnitudeBonus ?? 0), 0);
  const limitBonus = rule.limit.scope === "battle" ? 2 : rule.limit.scope === "round" ? 1 : 0;
  const bonus = conditionBonus + limitBonus;
  const tier = Math.min(MAX_TIER, payoff.tier + bonus);
  const effectRarity = payoff.effectRarity ?? fallbackRarity;
  const baseAmount = payoff.affix.magnitudes[tier];
  const rarityIndex = Math.max(0, RARITIES.indexOf(effectRarity));
  const effectType = payoff.affix.effect(1)?.type;
  const scaledAmount = Math.max(1, Math.floor((baseAmount * (EFFECT_AMOUNT_BPS[effectRarity] ?? 10000)
    + (effectType === "heal" ? 0 : 5000)) / 10000));
  const amount = payoff.affix.discrete
    ? baseAmount + Math.max(0, rarityIndex - 2)
    : scaledAmount;
  return { tier, amount, effectRarity };
}

function implicitAmountOf(draft) {
  const base = draft.implicit.amounts[draft.rarity];
  const bps = draft.keystone?.implicitBonusBps ?? 10_000;
  return Math.max(1, Math.floor((base * bps + 5_000) / 10_000));
}

export function canonicalDescriptor(draft, durability) {
  const rules = draft.rules.map((rule) => {
    const converters = rule.converters.map((affix) => affix.id).join("+") || "-";
    const payoffs = rule.payoffs
      .map((payoff) => {
        const magnitude = magnitudeOf(payoff, rule, draft.rarity);
        return `${payoff.affix.id}@${magnitude.effectRarity}@${magnitude.amount}`;
      })
      .join("+");
    return [rule.source.id, converters, `${rule.cost?.id ?? "-"}+wear${durabilityCostOf(draft, rule)}`, payoffs,
      `${rule.limit.scope}x${rule.limit.count}`].join("/");
  });
  return [
    GENERATOR_VERSION,
    draft.rarity,
    `${draft.implicit.id}@${draft.rarity}@${implicitAmountOf(draft)}`,
    `dur${durability}`,
    draft.keystone?.id ?? "-",
    draft.shapes.map((affix) => affix.id).join("+") || "-",
    rules.join(";"),
  ].join("|");
}

function durabilityOf(draft) {
  let durability = BASE_DURABILITY[draft.rarity];
  for (const shape of draft.shapes) durability += shape.durabilityBonus ?? 0;
  durability += draft.keystone?.durabilityBonus ?? 0;
  return durability;
}

function limitOf(draft, rule) {
  let count = rule.limit.count;
  for (const shape of draft.shapes) count += shape.limitBonus ?? 0;
  count += draft.keystone?.limitBonusAll ?? 0;
  const chainOnly = rule.payoffs.some((payoff) => payoff.affix.chainOnly);
  const reentrant = rule.payoffs.some((payoff) => (payoff.affix.emits ?? []).includes(rule.source.listenTo));
  if (!chainOnly && !reentrant) {
    const maxEffectIndex = rule.payoffs.reduce((max, payoff) => Math.max(
      max,
      Math.max(0, RARITIES.indexOf(payoff.effectRarity ?? draft.rarity)),
    ), 0);
    count += EFFECT_LIMIT_BONUS[RARITIES[maxEffectIndex]] ?? 0;
  }
  return { owner: "actor-instance + rule", scope: rule.limit.scope, count };
}

function displayNameOf(draft, itemId) {
  const noun = ITEM_NOUNS[parseInt(hash64(itemId).slice(0, 6), 16) % ITEM_NOUNS.length];
  const first = draft.rules[0];
  const keystone = draft.keystone ? draft.keystone.displayName : "";
  if (draft.rarity === "common" || draft.rarity === "rare") {
    return `${first.source.displayName}${noun}`;
  }
  return `${keystone}${first.source.displayName}${first.payoffs[0].affix.displayName}の${noun}`;
}

// **画面用の一文。**effect の中身ではなく「何をきっかけに、何を払い、何が起きるか」を
// affix の summary から組む。生成物の説明を engine の event 名で書かない。
export function ruleText(draft, rule, effectOffset = 0) {
  const when = [rule.source.summary, ...rule.converters.map((affix) => affix.summary)].join("・");
  const paidParts = [];
  const wear = durabilityCostOf(draft, rule);
  if (wear > 0) paidParts.push(`耐久${wear}`);
  if (rule.cost && rule.cost.cost.type !== "wear_equipment") paidParts.push(rule.cost.summary);
  const paid = paidParts.length ? `${paidParts.join("と")}を払い、` : "";
  const done = rule.payoffs
    .map((payoff, index) => {
      const magnitude = magnitudeOf(payoff, rule, draft.rarity);
      const slot = `追加効果${effectOffset + index + 1}`;
      const label = RARITY_LABEL[magnitude.effectRarity] ?? magnitude.effectRarity;
      return `${slot}（${label}）：${payoff.affix.summary}（${magnitude.amount}）`;
    })
    .join("、");
  const limit = limitOf(draft, rule);
  const scopeText = { chain: "一連の解決", round: "1 round", battle: "1戦" }[limit.scope];
  return `${when}、${paid}${done}。${scopeText}につき${limit.count}回。`;
}

export function draftToDefinition(draft) {
  const durability = durabilityOf(draft);
  const descriptor = canonicalDescriptor(draft, durability);
  const itemId = "gen_" + hash64(descriptor);
  const rules = draft.rules.map((rule, index) => {
    const effects = rule.payoffs.map((payoff) => {
      const magnitude = magnitudeOf(payoff, rule, draft.rarity);
      const effect = payoff.affix.effect(magnitude.amount);
      return draft.keystone?.transformEffect ? draft.keystone.transformEffect(effect) : effect;
    });
    if (draft.keystone?.extraEffect) effects.push(draft.keystone.extraEffect());
    return {
      id: `${itemId}_r${index}`,
      listenTo: rule.source.listenTo,
      timing: rule.source.timing ?? "after",
      priority: 100,
      predicates: [...rule.source.predicates, ...rule.converters.flatMap((affix) => affix.predicates)],
      costs: costsOf(draft, rule),
      effects,
      effectRarities: rule.payoffs.map((payoff) => (
        magnitudeOf(payoff, rule, draft.rarity).effectRarity
      )),
      limit: limitOf(draft, rule),
    };
  });
  const definition = {
    id: itemId,
    displayName: displayNameOf(draft, itemId),
    maxDurability: durability,
    statBonus: { [draft.implicit.stat]: implicitAmountOf(draft) },
    rules,
    tags: ["generated", draft.rarity],
  };
  return { definition, descriptor };
}

// ---------------------------------------------------------------- 検査
//
// R8 §3.5 —「不完全なtriggerだけ、effectだけ、発火不能、無料無限循環を生成しない。」
// ここは **形の検査**で、面白さの検査ではない。

const FINITE_COST_TYPES = new Set(["wear_equipment", "lose_hp", "consume_barrier"]);

export function auditDraft(draft, definition) {
  const problems = [];
  const spec = RARITY_BUDGET[draft.rarity];
  const power = draftPower(draft);
  const count = affixCount(draft);

  if (!draft.implicit || !EQUIPMENT_IMPLICITS.includes(draft.implicit)) {
    problems.push("無条件の基礎効果が無い");
  } else {
    const amount = implicitAmountOf(draft);
    if (definition.statBonus?.[draft.implicit.stat] !== amount
      || Object.keys(definition.statBonus ?? {}).length !== 1) {
      problems.push("基礎効果と EquipmentDef.statBonus が一致しない");
    }
  }

  if (power > spec.power) problems.push(`power budget 超過（${power} > ${spec.power}）`);
  const minimumPower = Math.min(spec.power - 1, MIN_POWER[draft.rarity] ?? 0);
  if (power < minimumPower) {
    problems.push(`最低 power 未達（${power} < ${minimumPower}、目標 ${spec.power}）`);
  }
  if (count < spec.affixes[0] || count > spec.affixes[1]) {
    problems.push(`affix 数が範囲外（${count} ∉ [${spec.affixes[0]}, ${spec.affixes[1]}]）`);
  }
  if (draft.rules.length < spec.rules[0] || draft.rules.length > spec.rules[1]) {
    problems.push(`rule 数が範囲外（${draft.rules.length}）`);
  }
  const hasSelfHeal = draft.rules.some((rule) => rule.payoffs.some(isSelfHealPayoff));
  const hasHpCost = draft.rules.some((rule) => isHpCost(rule.cost));
  if (hasSelfHeal && hasHpCost) {
    problems.push("HP消費コストと自分だけを回復する効果を同じ装備へ重ねている");
  }
  if (!draft.keystone && draft.rarity === "oopart") {
    problems.push("oopart は体験を変える keystone を必ず持つ");
  } else if (!draft.keystone && spec.keystones > 0) {
    // keystone は 0〜1。無くてよい。
  } else if (draft.keystone && spec.keystones === 0) {
    problems.push(`${draft.rarity} は keystone を持てない`);
  } else if (draft.keystone && !keystoneFitsDraft(draft.keystone, draft)) {
    problems.push(`keystone "${draft.keystone.id}" が追加効果へ作用しない`);
  }

  const seenSources = new Set();
  draft.rules.forEach((rule, index) => {
    const at = `rule ${index}`;
    const provides = rule.source.provides ?? [];
    const definitionRule = definition.rules[index];
    const wearCosts = definitionRule.costs.filter((cost) => cost.type === "wear_equipment");
    const repairs = rule.payoffs.some(isRepairPayoff);
    if (repairs) {
      if (wearCosts.length) problems.push(`${at}: 修理 rule が自分の耐久を同時に消費している`);
      if (!FINITE_COST_TYPES.has(rule.cost?.cost?.type) || rule.cost.cost.type === "wear_equipment") {
        problems.push(`${at}: 修理 rule は非耐久の有限コストを要する`);
      }
    } else {
      const expectedWear = durabilityCostOf(draft, rule);
      if (wearCosts.length !== 1 || wearCosts[0]?.amount !== expectedWear) {
        problems.push(`${at}: 発火時の耐久消費が定義と一致しない（期待 ${expectedWear}）`);
      }
    }
    if (definitionRule.costs.length > (repairs ? 1 : 2)) {
      problems.push(`${at}: cost が多すぎる（${definitionRule.costs.length}）`);
    }
    if (seenSources.has(rule.source.id)) problems.push(`${at}: trigger "${rule.source.id}" が重複`);
    seenSources.add(rule.source.id);

    if (!rule.payoffs.length) problems.push(`${at}: effect の無い rule`);
    for (const payoff of rule.payoffs) {
      const effectRarity = payoff.effectRarity ?? draft.rarity;
      const effectIndex = RARITIES.indexOf(effectRarity);
      const itemIndex = RARITIES.indexOf(draft.rarity);
      const floorIndex = RARITIES.indexOf(EFFECT_RARITY_FLOOR[draft.rarity] ?? "common");
      if (effectIndex < floorIndex) {
        problems.push(`${at}: effect rarity "${effectRarity}" が品質下限を下回る`);
      }
      if (effectIndex > itemIndex && (!rule.cost?.risky || effectIndex > itemIndex + 2)) {
        problems.push(`${at}: effect rarity "${effectRarity}" が代償なしで item rarity を超える`);
      }
      if (!satisfies(payoff.affix.requires, provides)) {
        problems.push(`${at}: payoff "${payoff.affix.id}" が trigger の提供しないものを要求している`);
      }
      if (!sharesTheme(rule.source.supports ?? [], payoff.affix.payoffTags ?? [])) {
        problems.push(`${at}: trigger と payoff "${payoff.affix.id}" のテーマが繋がらない`);
      }
      if (payoff.affix.needsFiniteCost && !FINITE_COST_TYPES.has(rule.cost?.cost?.type)) {
        problems.push(`${at}: payoff "${payoff.affix.id}" は有限コストを要する（無料無限循環になる）`);
      }
      if (payoff.affix.needsAnyCost && !rule.cost) {
        problems.push(`${at}: payoff "${payoff.affix.id}" はコストを要する`);
      }
      if ((payoff.affix.forbidsCostTypes ?? []).includes(rule.cost?.cost?.type)) {
        problems.push(`${at}: payoff "${payoff.affix.id}" と cost "${rule.cost.id}" が打ち消し合う`);
      }
      if (payoff.affix.chainOnly) {
        const limit = limitOf(draft, rule);
        if (limit.scope !== "chain" || limit.count > 1) {
          problems.push(`${at}: "${payoff.affix.id}" は同じ被弾 chain の中で1回だけに限る`
            + "（analysis/ecology-anti-stall-audit.mjs と同じ条件）");
        }
      }
    }

    const groups = rule.converters.map((affix) => affix.group);
    if (rule.converters.length > MAX_CONVERTERS_PER_RULE) problems.push(`${at}: condition が多すぎる`);
    if (new Set(groups).size !== groups.length) problems.push(`${at}: 同じ軸の condition が二つある`);
    for (const converter of rule.converters) {
      if (!satisfies(converter.requires, provides)) {
        problems.push(`${at}: condition "${converter.id}" が trigger の提供しないものを要求している`);
      }
      if (!rule.payoffs.every((payoff) => sharesTheme(
        converter.supports ?? [], payoff.affix.payoffTags ?? [],
      ))) {
        problems.push(`${at}: condition "${converter.id}" と効果のテーマが繋がらない`);
      }
      for (const predicate of converter.predicates) {
        if (predicate.type !== "event_value") continue;
        if (!(rule.source.valueKeys ?? []).includes(predicate.key)) {
          problems.push(`${at}: condition "${converter.id}" が "${rule.source.listenTo}" の持たない値 `
            + `"${predicate.key}" を読む（永久に発火しない）`);
        }
      }
    }

    if (rule.cost) {
      if ((rule.cost.emits ?? []).includes(rule.source.listenTo)) {
        problems.push(`${at}: cost "${rule.cost.id}" が trigger と同じ出来事を出す（自己再帰）`);
      }
      if (rule.cost.cost.type === "wear_equipment" && rule.cost.cost.amount > definition.maxDurability) {
        problems.push(`${at}: 耐久 ${definition.maxDurability} では払えない摩耗コスト`);
      }
      for (const payoff of rule.payoffs) {
        const effect = payoff.affix.effect(1);
        if (effect.type !== "gain_resource") continue;
        const spend = effect.resource === "action_points" ? "spend_action_points" : "spend_reaction_points";
        if (rule.cost.cost.type === spend) {
          problems.push(`${at}: 同じ資源を払って同じ資源を得る（差し引き0の死に rule）`);
        }
      }
    }

    const reentrant = rule.payoffs.some((payoff) => (payoff.affix.emits ?? []).includes(rule.source.listenTo));
    const limit = limitOf(draft, rule);
    if (reentrant && limit.count > 2) {
      problems.push(`${at}: 自分の trigger を出し直す rule の発火回数が多すぎる（${limit.count}）`);
    }
    if (limit.count < 1) problems.push(`${at}: 発火回数が0`);
  });

  return problems;
}

// content bundle 検査は毎 attempt 走るので、生成物だけを含む最小 bundle で見る。
// 参照される status は本編の定義をそのまま渡す（"focused" などの dangling を出さない）。
function schemaProblems(definition) {
  const bundle = {
    ...PLAYABLE_CONTENT,
    equipment: { [definition.id]: definition },
  };
  return validateContentBundle(bundle)
    .filter((error) => error.path.startsWith("equipment."))
    .map((error) => `${error.path}: ${error.code} ${error.message}`);
}

// ---------------------------------------------------------------- 公開 API

export const RARITY_DROP_WEIGHTS = Object.freeze({ common: 550, rare: 280, epic: 120, legendary: 40, mythic: 8, oopart: 2 });

export function rollRarity(rng, weights = RARITY_DROP_WEIGHTS) {
  const total = RARITIES.reduce((sum, rarity) => sum + (weights[rarity] ?? 0), 0);
  let roll = rng() * total;
  for (const rarity of RARITIES) {
    roll -= weights[rarity] ?? 0;
    if (roll < 0) return rarity;
  }
  return RARITIES[0];
}

// **生成の唯一の入口。** 同じ引数からは同じ品が返る。
//
//   seed        … run seed 等。列を分ける鍵の一部。
//   dropIndex   … その seed の中で何個目の drop か。
//   rarity      … 省略時は seed から roll する。
//   familyIds   … manifest の enabledAffixFamilyIds。
//   origin      … 来歴。生成には影響しない（descriptor にも入れない）。
export function generateEquipment(options = {}) {
  const seed = String(options.seed ?? "gen");
  const dropIndex = Math.max(0, Math.floor(options.dropIndex ?? 0));
  const familyIds = options.familyIds?.length ? [...options.familyIds] : [...AFFIX_FAMILY_IDS];
  const pool = affixPool(familyIds);
  const rarity = options.rarity
    ?? rollRarity(makeRng(seedKey(seed, "rarity", GENERATOR_VERSION, dropIndex)));
  if (!RARITIES.includes(rarity)) {
    throw new EquipmentGenerationError(`未知の rarity: ${rarity}`, { seed, dropIndex, rarity });
  }

  const attempts = [];
  for (let attempt = 0; attempt < GENERATOR_MAX_ATTEMPTS; attempt += 1) {
    const rng = makeRng(seedKey(seed, "equipgen", GENERATOR_VERSION, rarity, dropIndex, attempt));
    const draft = buildDraft(rng, rarity, pool);
    if (!draft) {
      attempts.push({ attempt, problems: ["draft を組み立てられなかった（pool 不足）"] });
      continue;
    }
    const { definition, descriptor } = draftToDefinition(draft);
    const problems = [...auditDraft(draft, definition), ...schemaProblems(definition)];
    if (problems.length) {
      attempts.push({ attempt, problems });
      continue;
    }
    const implicitAmount = implicitAmountOf(draft);
    let effectOffset = 0;
    const additionalEffects = [];
    const ruleLines = [];
    for (const [ruleIndex, rule] of draft.rules.entries()) {
      ruleLines.push(ruleText(draft, rule, effectOffset));
      for (const payoff of rule.payoffs) {
        const magnitude = magnitudeOf(payoff, rule, draft.rarity);
        additionalEffects.push({
          slot: `effect${effectOffset + 1}`,
          ruleIndex,
          affixId: payoff.affix.id,
          rarity: magnitude.effectRarity,
          rarityLabel: RARITY_LABEL[magnitude.effectRarity] ?? magnitude.effectRarity,
          summary: payoff.affix.summary,
          amount: magnitude.amount,
        });
        effectOffset += 1;
      }
    }
    const riskCost = draft.rules.map((rule) => rule.cost).find((cost) => cost?.risky) ?? null;
    return {
      definition,
      descriptor,
      rarity,
      provenance: {
        generatorVersion: GENERATOR_VERSION,
        contentContractVersion: CONTENT_CONTRACT_VERSION,
        seed,
        dropIndex,
        rarity,
        familyIds,
        attempt,
        descriptor,
        implicitId: draft.implicit.id,
        affixIds: [
          ...(draft.keystone ? [draft.keystone.id] : []),
          ...draft.shapes.map((affix) => affix.id),
          ...draft.rules.flatMap((rule) => [
            rule.source.id,
            ...rule.converters.map((affix) => affix.id),
            ...(rule.cost ? [rule.cost.id] : []),
            ...rule.payoffs.map((payoff) => payoff.affix.id),
          ]),
        ],
        resolvedParameters: {
          maxDurability: definition.maxDurability,
          statBonus: { ...definition.statBonus },
          rules: draft.rules.map((rule) => ({
            listenTo: rule.source.listenTo,
            limit: limitOf(draft, rule),
            costs: costsOf(draft, rule),
            effectRarities: rule.payoffs.map((payoff) => (
              magnitudeOf(payoff, rule, draft.rarity).effectRarity
            )),
            amounts: rule.payoffs.map((payoff) => (
              magnitudeOf(payoff, rule, draft.rarity).amount
            )),
          })),
        },
        origin: { ...(options.origin ?? {}) },
      },
      readout: {
        rarity,
        familyIds: [...new Set(draft.rules.map((rule) => rule.source.familyId))],
        payoffTags: [...new Set([
          ...draft.implicit.payoffTags,
          ...draft.rules.flatMap((rule) =>
            rule.payoffs.flatMap((payoff) => payoff.affix.payoffTags ?? [])),
        ])],
        keystone: draft.keystone ? draft.keystone.summary : null,
        risk: riskCost ? riskCost.riskSummary : null,
        effects: [{
          slot: "implicit",
          ruleIndex: -1,
          affixId: draft.implicit.id,
          rarity,
          rarityLabel: RARITY_LABEL[rarity] ?? rarity,
          summary: draft.implicit.summary,
          amount: implicitAmount,
          unconditional: true,
        }, ...additionalEffects],
        lines: ruleLines,
      },
    };
  }

  const worst = attempts.slice(0, 5).map((entry) => `#${entry.attempt}: ${entry.problems.join(" / ")}`);
  throw new EquipmentGenerationError(
    `${GENERATOR_MAX_ATTEMPTS} attempt で ${rarity} の完結 rule を作れなかった`
    + `（seed=${seed} dropIndex=${dropIndex} families=${familyIds.join(",")}）`,
    { seed, dropIndex, rarity, familyIds, attempts: worst },
  );
}
