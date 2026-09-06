// ecology/content/skill-levels.mjs
//
// **どの技能がレベルを持つのか。**
//
// R19（issue #137）— 単純な上位互換を別の技能として増やすと、同じ条件の技能の
// 装着順とオン／オフが際限なく複雑になる。代わりに一つの技能を段階的に強くする。
//
// **上限は手で書かない。**レベルが上げるのは連続量（damage / heal / barrier と
// その増減）だけなので、「その技能が連続量を持っているか」で決まる。手で書くと、
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
export const LEVELED_EFFECTS = new Set(["deal_damage", "heal", "gain_barrier", "modify_pending_amount"]);

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

// ============================================================ 説明文の数字（issue #148）
//
// **倍率を別に書くのではなく、説明文の値そのものを、いまのレベルの値にする。**
//
// 「確かな斬り」は Lv1 で「腕力130%の一撃」だが、Lv2 では実際に 146% を出す。
// 別行に「×1.12」と添えるより、本文が 146% と言うほうが読み手の手間が少ない
// （作者指摘）。
//
// **ただし、同じ文に掛からない数字が混ざっている。**「武器なので後列から出すと
// 40%まで落ちる」の 40% は後列減衰で、レベルとは無関係である。「HP50%以下の
// 味方へ技術60%」の 50% は発動条件で、これも掛からない。だから**書かれた % を
// 一律に掛けることはできない。**掛けてよい数だけを定義側から引き、その数と
// 一致する字面だけを書き換える。
//
// **一致が一意でないときは、何も書き換えない。**係数と発動条件が同じ数
// （「HP50%以下の敵へ腕力50%」）になった瞬間、どちらを掛けるべきか字面からは
// 決められない。嘘の数を出すくらいなら Lv1 の値のまま出す。その状態は
// analysis/ecology-skill-catalog-smoke.mjs が拾って落とすので、本文を書き直せば
// 直る（黙って間違え続けることがない）。

// 一致とみなす幅。説明文は 33.33% を「33%」と書く（readout smoke と同じ幅）。
const MATCH_TOLERANCE = 1;

// レベルが掛かる量を、**説明文に書かれうる形**で集める。
// percent … 「130%」のように % を付けて書く数
// plain   … 「12減らす」「1段につき45」のように単位なしで書く数
//
// 多段の技能は1発ぶんと合計の両方を書く（「50%を3回。合計150%」）。合計は
// **1発ぶんを丸めてから掛ける**ので、`base`（1発）と `hits`（回数）で持つ。
// 合計だけを別に丸めると「56%を3回。合計168%」のように、読んだ人が掛け算しても
// 合わない数が並ぶ。
function leveledDisplayValues(node, found = { percent: [], plain: [] }) {
  if (Array.isArray(node)) {
    for (const item of node) leveledDisplayValues(item, found);
    return found;
  }
  if (!node || typeof node !== "object") return found;
  if (typeof node.type === "string" && LEVELED_EFFECTS.has(node.type) && node.amount) {
    const amount = node.amount;
    const ratio = (amount.numerator ?? 1) / (amount.denominator ?? 1);
    const hits = node.hitCount ?? 1;
    const add = (bag, base) => {
      if (!Number.isFinite(base) || base <= 0) return;
      bag.push({ value: base, base, hits: 1 });
      if (hits > 1) bag.push({ value: base * hits, base, hits });
    };
    if (amount.type === "stat_scaled") {
      add(found.percent, (amount.coefficientBps ?? 0) / 100 * ratio);
      add(found.plain, (amount.flat ?? 0) * ratio);
    } else if (amount.type === "event_value_scaled" || amount.type === "actor_stat_scaled") {
      add(found.percent, ratio * 100);
    } else if (amount.type === "constant") {
      add(found.plain, (amount.value ?? 0) * ratio);
    } else if (amount.type === "status_stacks_scaled") {
      add(found.plain, ratio);
    }
  }
  for (const item of Object.values(node)) leveledDisplayValues(item, found);
  return found;
}

// 説明文の中の数字を、書かれ方（% つきか否か）ごとに拾う。
function numberTokens(text) {
  return [...String(text).matchAll(/(\d+)(?:\.(\d+))?(\s*%)?/g)].map((match) => ({
    index: match.index,
    raw: match[0],
    value: Number(match[1] + (match[2] ? "." + match[2] : "")),
    decimals: match[2] ? match[2].length : 0,
    percent: Boolean(match[3]),
    suffix: match[3] ?? "",
  }));
}

// **どの字面を書き換えるか**の下見。書き換え可能なら tokens が入り、
// 一意に決められない字面があれば ambiguous に理由が入る（smoke がこれを読む）。
export function skillTextLevelPlan(text, definition) {
  const values = leveledDisplayValues(definition);
  const tokens = numberTokens(text);
  const matched = [];
  const ambiguous = [];
  for (const token of tokens) {
    const bag = token.percent ? values.percent : values.plain;
    const hit = bag.find((entry) => Math.abs(entry.value - token.value) < MATCH_TOLERANCE);
    if (!hit) continue;
    matched.push({ ...token, expected: hit.value, base: hit.base, hits: hit.hits });
  }
  // 同じ量に二つ以上の字面が当たったら、どちらが係数でどちらが条件か決められない。
  for (const token of matched) {
    const twins = matched.filter((other) => other.expected === token.expected);
    if (twins.length > 1 && !ambiguous.some((entry) => entry.expected === token.expected)) {
      ambiguous.push({ expected: token.expected, written: twins.map((entry) => entry.raw.trim()) });
    }
  }
  return { tokens: ambiguous.length ? [] : matched, ambiguous, values };
}

// 一つの字面を、あるレベルの値へ。
// 合計は**1発ぶんを丸めてから回数を掛ける**ので、読み手が掛け算しても合う。
function liftToken(token, level) {
  const scale = 10 ** token.decimals;
  const factor = BPS + (Math.max(MIN_SKILL_LEVEL, level) - MIN_SKILL_LEVEL) * SKILL_LEVEL_STEP_BPS;
  const perHit = Math.round((token.value / token.hits) * scale);
  return (roundHalfUpDiv(perHit * factor, BPS) * token.hits / scale).toFixed(token.decimals);
}

// いまのレベルでの説明文。**Lv1 では元の文字列をそのまま返す**
// （係数 1.0 では engine も掛け算そのものを行わない。§afterSkillLevel と同じ約束）。
export function skillTextAtLevel(text, definition, level) {
  const source = String(text ?? "");
  if (!Number.isInteger(level) || level <= MIN_SKILL_LEVEL || !definition) return source;
  const plan = skillTextLevelPlan(source, definition);
  if (!plan.tokens.length) return source;
  let out = "";
  let cursor = 0;
  for (const token of plan.tokens) {
    out += source.slice(cursor, token.index) + liftToken(token, level) + token.suffix;
    cursor = token.index + token.raw.length;
  }
  return out + source.slice(cursor);
}

// 「1点払うと、この数字がどうなるか」。**倍率ではなく、変わる数そのものを見せる。**
export function skillLevelValueSteps(text, definition, level) {
  if (!definition) return [];
  const plan = skillTextLevelPlan(String(text ?? ""), definition);
  return plan.tokens.map((token) => ({
    from: liftToken(token, level) + token.suffix.trim(),
    to: liftToken(token, level + 1) + token.suffix.trim(),
  }));
}
