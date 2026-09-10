// ecology/ultimates.mjs — 必殺技（issue #238）
//
// **必殺技は新しい技能ではない。取得済みの技能に掛ける、一つきりの変換規則である。**
//
// 固有 ID の相方を量産すると、必殺技は「上位互換の技能表」になる（AGENTS.md が
// 禁じている作り方）。そうではなく、どの技能にも同じ形で掛かる規則を一つ置く。
// 見向きもしなかった技能が、その規則を通した瞬間だけ別物になる——という形を狙う。
//
// 規則は三つだけ:
//
//   1. **単体が全体になる。** 一体だけを狙う技能は全員へ、自分だけを守る技能は
//      味方全員へ広がる。武器（melee）の必殺は前列が生きているあいだ前列しか
//      届かないので、「腕の必殺は薙ぎ、技の必殺は全体に届く」が自然に出る。
//   2. **広がれない効果は、量が2倍になる。** 自分を強める技能、反撃、割り込みの
//      増減など。**広さと太さは両立させない**——両方を一度に掛けると 5体×2倍＝10倍の
//      一手になり、一戦がそのまま終わってしまう（実測した。ecology-ultimate-smoke）。
//   3. **溜めが消える。** 準備が要る技能は、その場で着弾する。
//
// 変えないものも決めてある。**AP・RP・hit 数・耐久・行動権は増えない**
// （技能レベルが離散量へ掛からないのと同じ理由。手数が増える効果は、
// 多くの面白い技能より強くなりやすい）。だから「号令の必殺技」は作れない。
//
// 有限性:
//
//   - 1戦闘に1回。状態「必殺」(ultimate_spent) を自分へ付け、
//     「その状態が付いていないこと」を発動条件にする。**engine と schema は
//     変更していない**——既存の語彙だけで書ける。
//   - 遠征を通して、隊で共有の「必殺印」ぶんだけ（ULTIMATE_SEALS_PER_RUN）。
//     印は補充されない。誰に、どの戦闘で切るかを 12戦のあいだ悩ませる。
//   - 放った直後、自分へ「隙」が1段付く。代償はここだけで、他は取らない。
//
// この module は純関数だけを持つ。Date も Math.random も読まない。

import { STATUS_NAMES } from "./content/statuses.mjs";

// ---------------------------------------------------------------- soft data
//
// **遊んだあとに動かしてよい数値。**動かすと build の印が変わる。

// 一遠征（12戦）で放てる回数。隊で共有する。
export const ULTIMATE_SEALS_PER_RUN = 3;
// 量に掛かる倍率。分子だけを倍にするので、整数のまま動く。
export const ULTIMATE_AMOUNT_MULTIPLIER = 2;
// 放った直後の代償。
export const ULTIMATE_BACKLASH_STATUS_ID = "exposed";
export const ULTIMATE_BACKLASH_STACKS = 1;

// ---------------------------------------------------------------- 語彙

// 「この戦闘でもう放った」印。content/statuses.mjs が定義を持つ。
export const ULTIMATE_SPENT_STATUS_ID = "ultimate_spent";
export const ULTIMATE_ID_PREFIX = "ult_";
export const ULTIMATE_NAME_PREFIX = "必殺・";

export function ultimateIdFor(skillId) {
  return ULTIMATE_ID_PREFIX + skillId;
}

export function isUltimateId(id) {
  return typeof id === "string" && id.startsWith(ULTIMATE_ID_PREFIX);
}

export function baseSkillIdOf(ultimateId) {
  return isUltimateId(ultimateId) ? ultimateId.slice(ULTIMATE_ID_PREFIX.length) : null;
}

export function ultimateDisplayName(baseDisplayName) {
  return ULTIMATE_NAME_PREFIX + baseDisplayName;
}

// ---------------------------------------------------------------- 変換

const clone = (value) => structuredClone(value);

// 量を2倍にしてよい effect。**連続量だけ。**行動権・受け構え・耐久は離散量なので
// 触らない（schema.mjs の技能レベルと同じ線引き）。
const AMPLIFIED_EFFECTS = new Set(["deal_damage", "heal", "gain_barrier", "modify_pending_amount"]);
// 狙い先を広げてよい effect。位置替え・行動権の受け渡しはここに無い。
const WIDENED_EFFECTS = new Set(["deal_damage", "heal", "gain_barrier", "add_status", "remove_status"]);
// 「自分だけ」を「味方全員」へ広げてよい effect。**攻撃はここに無い**
// （自傷を全体化して味方を焼く、という事故を作らないため）。
const SELF_WIDENED_EFFECTS = new Set(["heal", "gain_barrier", "add_status"]);
// take: 1 を take: "all" にしてよい scope。
const WIDENED_SCOPES = new Set(["allies", "enemies", "event_targets"]);

const ALIVE_ALLIES = Object.freeze({ scope: "allies", filters: [{ type: "alive" }], take: "all" });

// 量。**分子だけを倍にする。** どの value type も numerator / denominator を
// 同じ意味で持つので（values.mjs）、ここ一箇所で全種類に掛かる。
function amplifiedAmount(amount) {
  if (!amount || typeof amount !== "object") return { amount, changed: false };
  const numerator = (amount.numerator ?? 1) * ULTIMATE_AMOUNT_MULTIPLIER;
  return { amount: { ...amount, numerator }, changed: true };
}

// 狙い先を広げた結果。広げられないなら null を返す。
function widenedEffectTarget(effect, content) {
  if (!WIDENED_EFFECTS.has(effect.type)) return null;
  // 行・列へ広がる技能は、**一つの起点から広がる**という形をやめて全体になる。
  // 起点付きの pattern と take:"all" は両立しない（validate.mjs が拒む）ので、
  // 「単体が全体になる」をここでも同じ言葉で通す。
  if (effect.targetPattern && effect.targetPattern !== "single") {
    return { target: { ...effect.target, take: "all" }, dropPattern: true };
  }
  const target = effect.target;
  if (!target || typeof target !== "object") return null;
  if (target.scope === "self") {
    if (!SELF_WIDENED_EFFECTS.has(effect.type)) return null;
    // 負の状態を全体へ配らない。**自分に隙を付ける技能が、味方全員を裸にしない。**
    if (effect.type === "add_status"
      && content?.statuses?.[effect.statusId]?.polarity === "negative") {
      return null;
    }
    return { target: clone(ALIVE_ALLIES), dropPattern: false };
  }
  if (!WIDENED_SCOPES.has(target.scope)) return null;
  if (target.take !== 1) return null;
  return { target: { ...target, take: "all" }, dropPattern: false };
}

// effect 一つぶん。**変換した結果と、何が変わったかを一緒に返す。**
// 画面に出す「全体へ・量2倍・溜め不要」の印は、この記録から作る（手で書くとずれる）。
//
// **広さと太さは両立しない。**両方を一度に掛けると、5体へ2倍＝10倍の一手になり、
// 一戦がそのまま終わる（analysis/ecology-ultimate-smoke.mjs で実測した）。
// 広げられる技能は広がるだけ、広げられない技能だけが太くなる。
function ascendEffect(effect, content, traits) {
  const next = clone(effect);
  const widened = widenedEffectTarget(next, content);
  if (widened) {
    if (widened.dropPattern) delete next.targetPattern;
    next.target = widened.target;
    traits.widened = true;
    return next;
  }
  if (AMPLIFIED_EFFECTS.has(next.type) && next.amount) {
    const amplified = amplifiedAmount(next.amount);
    if (amplified.changed) {
      next.amount = amplified.amount;
      traits.amplified = true;
    }
  }
  if (next.type === "add_status") {
    next.stacks = (next.stacks ?? 1) * ULTIMATE_AMOUNT_MULTIPLIER;
    traits.amplified = true;
  }
  return next;
}

function ascendEffects(effects, content, traits) {
  return (effects ?? []).map((effect) => ascendEffect(effect, content, traits));
}

function selfTarget() {
  return { scope: "self", take: 1 };
}

// 必殺が必ず持つ二つ。**発動条件と代償を、変換された技能そのものへ書き込む。**
// 呼び出し側（engine・画面）に「必殺だけの分岐」を作らないためである。
function ultimateGate() {
  return {
    type: "has_status",
    subject: "self",
    statusId: ULTIMATE_SPENT_STATUS_ID,
    op: "eq",
    value: 0,
  };
}

function ultimateSeal() {
  return [
    // 放った印。同じ戦闘では二度と条件を満たさない。
    { type: "add_status", target: selfTarget(), statusId: ULTIMATE_SPENT_STATUS_ID, stacks: 1 },
    // 代償。**必殺の直後は隙だらけ。**ラウンド終わりまで受けるダメージが増える。
    {
      type: "add_status",
      target: selfTarget(),
      statusId: ULTIMATE_BACKLASH_STATUS_ID,
      stacks: ULTIMATE_BACKLASH_STACKS,
    },
  ];
}

function newTraits() {
  return { amplified: false, widened: false, instant: false };
}

function ascendActive(definition, content) {
  const traits = newTraits();
  const source = clone(definition);
  const prepared = source.preparation ?? null;
  const effects = [
    ...ascendEffects(source.effects, content, traits),
    ...(prepared ? ascendEffects(prepared.completionEffects, content, traits) : []),
  ];
  if (prepared) traits.instant = true;
  if (!traits.amplified && !traits.widened) return null;

  const next = {
    ...source,
    id: ultimateIdFor(source.id),
    displayName: ultimateDisplayName(source.displayName),
    intrinsicPredicates: [...(source.intrinsicPredicates ?? []), ultimateGate()],
    effects: [...effects, ...ultimateSeal()],
    tags: [...new Set([...(source.tags ?? []), "ultimate"])],
  };
  delete next.preparation;
  // 溜めを外した技能は、その場で当てる普通の攻撃になる。追撃の扱いもそれに合わせる。
  if (traits.instant && effects.some((effect) => effect.type === "deal_damage")) {
    next.actionMode = "offense";
  }
  // 効果の狙い先が広がったなら、選ぶ側（targetQuery）も広げる。**宣言した狙い先と
  // 実際に当たる相手を一致させる**ため（ログと予測が「1体を狙う」と言いながら
  // 全体へ当たる、という嘘を作らない）。狙い先を広げない技能はここも動かない。
  if (traits.widened && next.targetQuery
    && WIDENED_SCOPES.has(next.targetQuery.scope) && next.targetQuery.take === 1) {
    next.targetQuery = { ...next.targetQuery, take: "all" };
  }
  return { kind: "active", definition: next, traits };
}

function ascendReactive(definition, content) {
  const traits = newTraits();
  const source = clone(definition);
  const rule = source.rule;
  if (!rule) return null;
  const effects = ascendEffects(rule.effects, content, traits);
  if (!traits.amplified && !traits.widened) return null;

  const next = {
    ...source,
    id: ultimateIdFor(source.id),
    displayName: ultimateDisplayName(source.displayName),
    tags: [...new Set([...(source.tags ?? []), "ultimate"])],
    rule: {
      ...rule,
      // 元の rule と同じ ID のままだと、通常版と必殺版の発火回数が同じ鍵を共有する。
      id: ultimateIdFor(rule.id),
      predicates: [...(rule.predicates ?? []), ultimateGate()],
      effects: [...effects, ...ultimateSeal()],
      // 状態の印だけでも一度きりになるが、**回数の上限は回数として書く。**
      limit: { owner: "actor-instance + rule", scope: "battle", count: 1 },
    },
  };
  return { kind: "reactive", definition: next, traits };
}

// 技能一つを必殺技へ変える。**変換して何も変わらない技能は必殺にできない。**
// 位置替え・号令のように量も状態も動かさない技能がそれで、画面では候補に出さない。
export function ascendSkill(content, skillId) {
  if (!content || typeof skillId !== "string" || isUltimateId(skillId)) return null;
  const active = content.activeSkills?.[skillId];
  if (active) return ascendActive(active, content);
  const reactive = content.reactiveSkills?.[skillId];
  if (reactive) return ascendReactive(reactive, content);
  return null;
}

export function canBecomeUltimate(content, skillId) {
  return ascendSkill(content, skillId) !== null;
}

// 画面に出す印。**変換の記録から作る**ので、規則を足したら印も一緒に増える。
export function ultimateTraitLabels(traits) {
  if (!traits) return [];
  const labels = [];
  if (traits.widened) labels.push("全体へ");
  if (traits.amplified) labels.push("量2倍");
  if (traits.instant) labels.push("溜め不要");
  return labels;
}

// 必殺が必ず背負う制限。**技能によらず同じ**なので、ここに一度だけ書く。
export const ULTIMATE_TERMS = Object.freeze([
  "戦闘に1回",
  "必殺印1",
  `直後に自分へ「${STATUS_NAMES[ULTIMATE_BACKLASH_STATUS_ID]}」${ULTIMATE_BACKLASH_STACKS}`,
]);

// ---------------------------------------------------------------- content bundle
//
// **必殺技の定義は固定 content に居ない。**遠征ごとの装備と同じで、いま指定されて
// いるものだけを bundle へ混ぜる。engine も validator も、混ぜたあとの bundle を読む。
export function ultimateContentFor(content, skillIds = []) {
  const activeSkills = {};
  const reactiveSkills = {};
  for (const skillId of [...new Set(skillIds)].sort()) {
    const ascended = ascendSkill(content, skillId);
    if (!ascended) continue;
    if (ascended.kind === "active") activeSkills[ascended.definition.id] = ascended.definition;
    else reactiveSkills[ascended.definition.id] = ascended.definition;
  }
  return { activeSkills, reactiveSkills };
}

export function withUltimates(content, skillIds = []) {
  const extra = ultimateContentFor(content, skillIds);
  const activeIds = Object.keys(extra.activeSkills);
  const reactiveIds = Object.keys(extra.reactiveSkills);
  if (!activeIds.length && !reactiveIds.length) return content;
  return {
    ...content,
    activeSkills: { ...content.activeSkills, ...extra.activeSkills },
    reactiveSkills: { ...content.reactiveSkills, ...extra.reactiveSkills },
  };
}

// ---------------------------------------------------------------- 消費の観測
//
// **印を払ったかどうかは、戦闘のイベント列から読む。**「構えたから払う」ではない
// （構えても条件が揃わなければ出ない。出なければ払わない）。
export function ultimateFirings(result) {
  const fired = [];
  for (const event of result?.events ?? []) {
    if (event.type !== "status_added") continue;
    if (event.values?.statusId !== ULTIMATE_SPENT_STATUS_ID) continue;
    const instanceId = event.targetActorIds?.[0];
    if (!instanceId || fired.includes(instanceId)) continue;
    fired.push(instanceId);
  }
  return fired;
}
