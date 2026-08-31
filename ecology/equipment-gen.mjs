// ecology/equipment-gen.mjs
//
// **Phase C の生成装備 generator。R8 §3.5、§13.2、Implementation Phase 4 step 1〜2。**
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
  ITEM_NOUNS,
  RARITIES,
  RARITY_BUDGET,
  SHAPE_AFFIX_IDS,
} from "./content/affixes.mjs";

// **版を上げたら、古い Blueprint は disabled 表示になる。**黙って別物を作らない
// （R8 §3.6「互換不能な古いBlueprintを削除せず、disabledReasonを表示する」）。
export const GENERATOR_VERSION = "ecology-equipment-gen-1";

// R8 §3.5 —「50 attemptで生成不能なら既定品へ黙ってfallbackせず、診断errorにする。」
export const GENERATOR_MAX_ATTEMPTS = 50;

const BASE_DURABILITY = Object.freeze({ common: 2, rare: 2, epic: 3, legendary: 3 });
const MAX_CONVERTERS_PER_RULE = 2;
const MAX_PAYOFFS_PER_RULE = 2;
const MAX_TIER = 2;

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

// ---------------------------------------------------------------- 組み立て

function buildRuleDraft(rng, pool, budget, sourceIdsUsed) {
  // 同じ trigger を二度使うと「同じ出来事の二重取り」になり、rule が別々である
  // 意味が消える。**item の中で trigger は重複させない。**
  const sources = pool.source.filter((affix) => !sourceIdsUsed.has(affix.id));
  if (!sources.length) return null;
  const source = pick(rng, sources);
  const provides = source.provides ?? [];

  const payoffCandidates = pool.payoff.filter((affix) => satisfies(affix.requires, provides));
  if (!payoffCandidates.length) return null;
  const payoff = pick(rng, payoffCandidates);

  const costCandidates = pool.cost.filter((affix) => {
    if ((payoff.forbidsCostTypes ?? []).includes(affix.cost.type)) return false;
    if (payoff.needsFiniteCost && !affix.finite) return false;
    // 代償が trigger と同じ出来事を出すと、払った瞬間に自分を呼び戻す。
    if ((affix.emits ?? []).includes(source.listenTo)) return false;
    return true;
  });
  const needsCost = Boolean(payoff.needsFiniteCost || payoff.needsAnyCost);
  let cost = null;
  if (needsCost) {
    cost = pick(rng, costCandidates);
    if (!cost) return null;
  } else if (costCandidates.length && rng() < 0.5) {
    cost = pick(rng, costCandidates);
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
  const converterCandidates = pool.converter.filter((affix) => satisfies(affix.requires, provides));
  const wanted = pickInt(rng, 0, MAX_CONVERTERS_PER_RULE);
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
  const scope = reentrant ? "chain" : pick(rng, ["chain", "round", "round", "battle"]);
  return {
    source,
    converters,
    cost,
    payoffs: [{ affix: payoff, tier: 0 }],
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

function buildDraft(rng, rarity, pool) {
  const spec = RARITY_BUDGET[rarity];
  const draft = { rarity, keystone: null, shapes: [], rules: [] };

  if (spec.keystones > 0 && pool.keystone.length && rng() < 0.6) {
    draft.keystone = pick(rng, pool.keystone);
  }

  const ruleCount = pickInt(rng, spec.rules[0], spec.rules[1]);
  const sourceIdsUsed = new Set();
  for (let index = 0; index < ruleCount; index += 1) {
    const remaining = spec.power - draftPower(draft);
    const rule = buildRuleDraft(rng, pool, remaining, sourceIdsUsed);
    if (!rule) return null;
    sourceIdsUsed.add(rule.source.id);
    draft.rules.push(rule);
  }
  if (!draft.rules.length) return null;

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
          if (!satisfies(affix.requires, provides)) continue;
          if (affix.needsFiniteCost && !rule.cost?.finite) continue;
          if (affix.needsAnyCost && !rule.cost) continue;
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
    else if (choice.kind === "payoff") choice.rule.payoffs.push({ affix: choice.affix, tier: 0 });
    else draft.shapes.push(choice.affix);
  }

  // ---- affix 数の下限を converter（power 0）で埋める。
  for (let guard = 0; guard < 24 && affixCount(draft) < spec.affixes[0]; guard += 1) {
    let added = false;
    for (const rule of draft.rules) {
      if (rule.converters.length >= MAX_CONVERTERS_PER_RULE) continue;
      const usedGroups = new Set(rule.converters.map((affix) => affix.group));
      const provides = rule.source.provides ?? [];
      const options = pool.converter.filter(
        (affix) => satisfies(affix.requires, provides) && !usedGroups.has(affix.group),
      );
      if (!options.length) continue;
      rule.converters.push(pick(rng, options));
      added = true;
      if (affixCount(draft) >= spec.affixes[0]) break;
    }
    if (!added) break;
  }

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

function magnitudeOf(payoff, converters) {
  const bonus = converters.reduce((total, affix) => total + (affix.magnitudeBonus ?? 0), 0);
  const tier = Math.min(MAX_TIER, payoff.tier + bonus);
  return { tier, amount: payoff.affix.magnitudes[tier] };
}

export function canonicalDescriptor(draft, durability) {
  const rules = draft.rules.map((rule) => {
    const converters = rule.converters.map((affix) => affix.id).join("+") || "-";
    const payoffs = rule.payoffs
      .map((payoff) => `${payoff.affix.id}@${magnitudeOf(payoff, rule.converters).amount}`)
      .join("+");
    return [rule.source.id, converters, rule.cost?.id ?? "-", payoffs,
      `${rule.limit.scope}x${rule.limit.count}`].join("/");
  });
  return [
    GENERATOR_VERSION,
    draft.rarity,
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
  return { scope: rule.limit.scope, count };
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
export function ruleText(draft, rule) {
  const when = [rule.source.summary, ...rule.converters.map((affix) => affix.summary)].join("・");
  const paid = rule.cost ? `${rule.cost.summary}を払い、` : "";
  const done = rule.payoffs
    .map((payoff) => `${payoff.affix.summary}（${magnitudeOf(payoff, rule.converters).amount}）`)
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
    const effects = rule.payoffs.map((payoff) => payoff.affix.effect(magnitudeOf(payoff, rule.converters).amount));
    if (draft.keystone?.extraEffect) effects.push(draft.keystone.extraEffect());
    return {
      id: `${itemId}_r${index}`,
      listenTo: rule.source.listenTo,
      timing: "after",
      priority: 100,
      predicates: [...rule.source.predicates, ...rule.converters.flatMap((affix) => affix.predicates)],
      costs: rule.cost ? [{ ...rule.cost.cost }] : [],
      effects,
      limit: limitOf(draft, rule),
    };
  });
  const definition = {
    id: itemId,
    displayName: displayNameOf(draft, itemId),
    maxDurability: durability,
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

  if (power > spec.power) problems.push(`power budget 超過（${power} > ${spec.power}）`);
  if (power < spec.power - 1) problems.push(`power budget 未使用（${power} < ${spec.power - 1}）`);
  if (count < spec.affixes[0] || count > spec.affixes[1]) {
    problems.push(`affix 数が範囲外（${count} ∉ [${spec.affixes[0]}, ${spec.affixes[1]}]）`);
  }
  if (draft.rules.length < spec.rules[0] || draft.rules.length > spec.rules[1]) {
    problems.push(`rule 数が範囲外（${draft.rules.length}）`);
  }
  if (!draft.keystone && spec.keystones > 0) {
    // keystone は 0〜1。無くてよい。
  } else if (draft.keystone && spec.keystones === 0) {
    problems.push(`${draft.rarity} は keystone を持てない`);
  }

  const seenSources = new Set();
  draft.rules.forEach((rule, index) => {
    const at = `rule ${index}`;
    const provides = rule.source.provides ?? [];
    if (seenSources.has(rule.source.id)) problems.push(`${at}: trigger "${rule.source.id}" が重複`);
    seenSources.add(rule.source.id);

    if (!rule.payoffs.length) problems.push(`${at}: effect の無い rule`);
    for (const payoff of rule.payoffs) {
      if (!satisfies(payoff.affix.requires, provides)) {
        problems.push(`${at}: payoff "${payoff.affix.id}" が trigger の提供しないものを要求している`);
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
    if (new Set(groups).size !== groups.length) problems.push(`${at}: 同じ軸の condition が二つある`);
    for (const converter of rule.converters) {
      if (!satisfies(converter.requires, provides)) {
        problems.push(`${at}: condition "${converter.id}" が trigger の提供しないものを要求している`);
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

export const RARITY_DROP_WEIGHTS = Object.freeze({ common: 52, rare: 30, epic: 14, legendary: 4 });

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
          rules: draft.rules.map((rule) => ({
            listenTo: rule.source.listenTo,
            limit: limitOf(draft, rule),
            amounts: rule.payoffs.map((payoff) => magnitudeOf(payoff, rule.converters).amount),
          })),
        },
        origin: { ...(options.origin ?? {}) },
      },
      readout: {
        rarity,
        familyIds: [...new Set(draft.rules.map((rule) => rule.source.familyId))],
        payoffTags: [...new Set(draft.rules.flatMap((rule) =>
          rule.payoffs.flatMap((payoff) => payoff.affix.payoffTags ?? [])))],
        keystone: draft.keystone ? draft.keystone.summary : null,
        lines: draft.rules.map((rule) => ruleText(draft, rule)),
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
