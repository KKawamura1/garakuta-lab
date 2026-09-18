// ecology/tactics.mjs
//
// 行動技能を「盤面を待つ条件行動」と「いつでも出せる主軸」に分ける、純粋な分類。
// engine と画面が別々の判定を持つと、画面では主軸なのに戦闘では条件行動になるため、
// この一箇所だけを読む。

// `alive` は対象が存在するための最低条件で、盤面を選ぶ条件には数えない。
// それ以外の filter、技能固有 predicate、loadout 側の useWhen のどれかがあれば、
// その技能は条件が成立する拍だけ主軸へ割り込む。
export function tacticHasCondition(skill, tactic = {}) {
  if ((skill?.intrinsicPredicates ?? []).length > 0) return true;
  if ((tactic?.useWhen ?? []).length > 0) return true;
  return (skill?.targetQuery?.filters ?? []).some((filter) => filter.type !== "alive");
}
