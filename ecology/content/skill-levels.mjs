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

import { MAX_SKILL_LEVEL, MIN_SKILL_LEVEL } from "../schema.mjs";

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
