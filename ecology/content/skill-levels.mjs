// ecology/content/skill-levels.mjs
//
// **どの技能がレベルを持つのか。**
//
// R19（issue #137）— 単純な上位互換を別の技能として増やすと、同じ条件の技能の
// 装着順とオン／オフが際限なく複雑になる。代わりに一つの技能を段階的に強くする。
//
// **上限は手で書かない。**レベルが上げるのは連続量（damage / heal / barrier と
// その増減・pending damage の軽減）だけなので、「その技能が連続量を持っているか」で決まる。手で書くと、
// 効果を書き換えたときに「レベルは上がるのに何も強くならない技能」が黙って残る
// （点数を払わせておいて何も返さないので、罠になる）。
//
// 位置替え・号令・刻印付与のような、連続量を持たない技能は Lv1 だけである。
// **画面はそれを「レベルなし」と書く。**強くならないものへ点を払わせない。

import { MAX_SKILL_LEVEL, MIN_SKILL_LEVEL, SKILL_LEVEL_STEP_BPS } from "../schema.mjs";
import { BPS, roundHalfUpDiv } from "../values.mjs";

// effects.mjs の afterSkillLevel が掛かる effect と同じ表でなければならない。
// ここがずれると「レベルは上がるのに強くならない」か、その逆が起きる。
// **外へ出しておく。**analysis/ecology-skill-catalog-smoke.mjs が、この表と
// effects.mjs の afterSkillLevel が掛かる effect 型が一致しているかを見張る
// （ずれると「Lv だけ上がって何も強くならない」技能が黙って生まれる）。
export const LEVELED_EFFECTS = new Set([
  "deal_damage", "heal", "gain_barrier", "modify_pending_amount", "split_pending_damage",
]);

function hasLeveledAmount(node) {
  if (Array.isArray(node)) return node.some(hasLeveledAmount);
  if (!node || typeof node !== "object") return false;
  if (typeof node.type === "string" && LEVELED_EFFECTS.has(node.type) && node.amount) return true;
  return Object.values(node).some(hasLeveledAmount);
}

// 技能ひとつぶんの上限。連続量を持たない技能は Lv1 止まり。
export function skillLevelCap(definition) {
  return hasLeveledAmount(definition) ? MAX_SKILL_LEVEL : MIN_SKILL_LEVEL;
}

// R19 — レベルを1段上げる値段。**深さと違って、いつでも同じ1点。**
// 深く伸ばす（新しい役割を得る）か、いま持っている技能を厚くするかを、
// 同じ通貨の同じ値段で選ばせる。
export const SKILL_LEVEL_COST = 1;

export function skillLevelCaps(content) {
  const caps = {};
  for (const section of ["activeSkills", "reactiveSkills", "passiveSkills"]) {
    for (const [id, definition] of Object.entries(content[section] ?? {})) {
      caps[id] = skillLevelCap(definition);
    }
  }
  return Object.freeze(caps);
}

// ============================================================ 変動量と固定量（issue #148）
//
// **技能が持つ数のうち、レベルで伸びるのは一つだけである。**
//
//   変動量 … その技能の damage / heal / barrier / 増減の amount。レベルで伸びる。
//   固定量 … 発動条件の閾値、後列減衰、段数、耐久、AP / RP。レベルでは動かない。
//
// 説明文は**変動量を書かない。**`{amount}` と書いて定義を指す。
//
//   steady_cut: "条件も準備もない、腕力{amount}の一撃。武器なので後列から出すと40%まで落ちる。"
//
// これで「腕力130%」の 130 は定義の `coefficientBps` ただ一つになり、
//
//   - 係数を変えたのに説明文が旧値のまま、が起きない（2026-08-31 に6件出た壊れ方）
//   - レベルで伸びた値を、本文のどの数字か推し当てる必要がない
//   - 同じ文の 40%（後列減衰）や 30%（発動条件）は**ただの文字**なので、
//     間違って一緒に伸びることがない
//
// の三つが同時に片づく。**固定量は文字のまま書く。**単一の出どころへ寄せる価値が
// 変動量ほど無く、条件や単位ごとに言い回しが変わる（「6割無視する」「半分以下」）ため。
//
// 使える差し込み口は三つだけ:
//
//   {amount} … 変動量ひとつぶん。単位（% か素の数）は定義の amount 型から決まる
//   {total}  … 変動量 × 段数。多段技能が「合計」を書くときだけ
//   {hits}   … 段数（固定量だが、{total} と食い違わせないために定義から引く）
//
// **変動量を二つ以上持つ技能は作れない。**どちらを指すのか本文から決められないので、
// 検査（phase-b.test.mjs と analysis/ecology-skill-catalog-smoke.mjs）が落とす。

const SLOT_PATTERN = /\{(amount|total|hits)\}/g;

// 定義の中の「レベルで伸びる量」。**一つだけあるのが正しい形。**
function leveledEffects(node, found = []) {
  if (Array.isArray(node)) {
    for (const item of node) leveledEffects(item, found);
    return found;
  }
  if (!node || typeof node !== "object") return found;
  if (typeof node.type === "string" && LEVELED_EFFECTS.has(node.type) && node.amount) {
    found.push(node);
  }
  for (const item of Object.values(node)) leveledEffects(item, found);
  return found;
}

// 変動量を、丸めない有理数（n / d）と単位で返す。
// **丸めるのはレベルを掛けたあと一度だけ**（R6 §4.4 と同じ約束）。
function amountRational(amount) {
  const numerator = amount.numerator ?? 1;
  const denominator = amount.denominator ?? 1;
  switch (amount.type) {
    case "stat_scaled":
      // coefficientBps 13000 は 130%。flat を併用する定義はまだ無い（増えたら検査が落ちる）。
      return amount.flat
        ? null
        : { n: (amount.coefficientBps ?? 0) * numerator, d: denominator * 100, unit: "percent" };
    case "event_value_scaled":
    case "actor_stat_scaled":
      return { n: 100 * numerator, d: denominator, unit: "percent" };
    case "constant":
      return { n: (amount.value ?? 0) * numerator, d: denominator, unit: "plain" };
    case "status_stacks_scaled":
      return { n: numerator, d: denominator, unit: "plain" };
    default:
      return null;
  }
}

// **変動量を出している effect そのもの。**issue #177 の画面は、係数だけでなく
// 「誰の何で伸びるのか」（`scalingStat`）と段数を読む。同じ一つの effect を
// 二箇所で探すと必ずずれるので、探すのはここだけにして外へ渡す。
export function leveledEffectOf(definition) {
  const effects = definition ? leveledEffects(definition) : [];
  return effects.length === 1 ? effects[0] : null;
}

// レベルを掛けたあとの実数。**掛けて丸めるのは一度だけ**（R6 §4.4）。
// `stat` にはその人物の能力値を入れる（`stat_scaled` 以外では使わない）。
export function leveledValueAt(definition, level, stat = null) {
  const effect = leveledEffectOf(definition);
  const variable = leveledAmountOf(definition);
  if (!effect || !variable) return null;
  const amount = effect.amount;
  const scaled = amount?.type === "stat_scaled";
  if (scaled && (stat === null || stat === undefined)) return null;
  const numerator = variable.n * levelFactor(level) * (scaled ? stat : 1);
  const denominator = variable.d * BPS * (scaled ? 100 : 1);
  const one = roundHalfUpDiv(numerator, denominator);
  return { one, hits: variable.hits, total: one * variable.hits, unit: scaled ? "plain" : variable.unit };
}

// その技能の変動量。**無い（レベルを持たない）技能では null。**
export function leveledAmountOf(definition) {
  const effects = definition ? leveledEffects(definition) : [];
  if (effects.length !== 1) return null;
  const rational = amountRational(effects[0].amount);
  if (!rational) return null;
  return { ...rational, hits: effects[0].hitCount ?? 1 };
}

function levelFactor(level) {
  return BPS + (Math.max(MIN_SKILL_LEVEL, level) - MIN_SKILL_LEVEL) * SKILL_LEVEL_STEP_BPS;
}

// 差し込む文字。単位は定義の amount 型が決めるので、**本文は % を書かない。**
function slotText(name, variable, level) {
  if (name === "hits") return String(variable.hits);
  const one = roundHalfUpDiv(variable.n * levelFactor(level), variable.d * BPS);
  // 合計は「1段ぶんを丸めてから段数を掛ける」。読み手が掛け算しても合う。
  const value = name === "total" ? one * variable.hits : one;
  return variable.unit === "percent" ? value + "%" : String(value);
}

// いまのレベルでの説明文。**Lv1 でも同じ経路を通る**（差し込み口を埋めるのは
// レベルの有無に関わらず必要で、Lv1 は係数 1.0 になるだけ）。
export function skillTextAtLevel(text, definition, level) {
  const source = String(text ?? "");
  const variable = leveledAmountOf(definition);
  if (!variable) return source;
  return source.replace(SLOT_PATTERN, (raw, name) => slotText(name, variable, level));
}

// 「1点払うと、この数字がどうなるか」。**倍率ではなく、変わる数そのものを見せる。**
export function skillLevelValueSteps(text, definition, level) {
  const variable = leveledAmountOf(definition);
  if (!variable) return [];
  const names = [...new Set([...String(text ?? "").matchAll(SLOT_PATTERN)].map((match) => match[1]))]
    .filter((name) => name !== "hits");
  return names.map((name) => ({
    from: slotText(name, variable, level),
    to: slotText(name, variable, level + 1),
  }));
}

// 検査が読む不変条件。**空なら正しい形。**
//
// 画面に出るまで気づけない壊れ方（差し込み口がそのまま出る／レベルが伸びる量が
// 本文のどこにも出ない／伸びない数を伸ばして書いた）を、ここで名前にして返す。
export function skillTextIssues(text, definition) {
  const issues = [];
  const source = String(text ?? "");
  const slots = [...new Set([...source.matchAll(SLOT_PATTERN)].map((match) => match[1]))];
  const effects = definition ? leveledEffects(definition) : [];
  const variable = leveledAmountOf(definition);

  if (effects.length > 1) {
    issues.push(`レベルで伸びる量を${effects.length}つ持っている（本文の {amount} がどれを指すか決められない）`);
  }
  if (effects.length === 1 && !variable) {
    issues.push(`レベルで伸びる量の形（${effects[0].amount.type}）を説明文へ差し込めない`);
  }
  if (!variable && slots.length) {
    issues.push(`{${slots.join("}・{")}} と書いてあるが、レベルで伸びる量が無い`);
  }
  if (variable) {
    if (!slots.includes("amount") && !slots.includes("total")) {
      issues.push("レベルで伸びる量を {amount} で書いていない（Lv を上げても本文が動かない）");
    }
    if (variable.hits <= 1 && (slots.includes("total") || slots.includes("hits"))) {
      issues.push("多段でないのに {total} / {hits} を使っている");
    }
    // 変動量を数字で直接書いてしまうと、そこだけ Lv1 のまま古びる。
    const literal = slotText("amount", variable, MIN_SKILL_LEVEL).replace("%", "");
    const bare = source.replace(SLOT_PATTERN, "");
    if (new RegExp("(?<![0-9])" + literal + "\\s*%").test(bare)) {
      issues.push(`変動量（${literal}%）を数字で直接書いている（{amount} を使うこと）`);
    }
  }
  return issues;
}
