// **伏せた法則が、まだ当てられる状態か。**
//
// 同定の版は「確かめれば分かる」ことに賭けている。法則を足したり直したりしたときに
// **盤面から情報が消えていたら、13件から選ばせるのは知識ではなく運を試すことになる。**
// ここで落として気づく。
//
// 注意：これは**情報が載っているかの上限**であって、人が当てられるかではない
// （91通りを完全な記憶で突き合わせている）。`analysis/identify.mjs` の但し書きを見よ。

import { identifiability } from "./identify.mjs";
import { LAW_TABLE } from "../core/law-table.mjs";
import { makeLawRuleset, LAWS } from "../core/laws.mjs";

const fail = m => { console.error(`ident smoke: ${m}`); process.exit(1); };
const TRIES = 12;
const LIMIT = 8;      // 12通り試して、残る候補がこれ以下であること（91通り中）

// 表の先頭から3組。全部やると遅い割に、傾向は3組で分かる。
const sample = LAW_TABLE.slice(0, 3);
if (!sample.length) fail("表が空で、確かめようがない");

// **伏せているつもりで、答えが書いてある場所が無いか。**
// 見出しは `rules.id` をそのまま出していて、`ident-0.1:reflect+monotony` と読めた。
// 遊び方の文面にも法則の名前と説明が並んでいた。両方とも伏せた意味を消す。
{
  const v = LAW_TABLE[0];
  const r = makeLawRuleset(v.laws, v.scales, v.atkScales, v.modScales, v.cycleCaps, { hidden: true });
  if (!r.publicId) fail("伏せた版に、画面へ出してよい名前（publicId）が無い");
  v.laws.forEach(id => {
    if (r.publicId.includes(id)) fail(`画面に出す名前に法則 ${id} が入っている`);
    if (r.rules.includes(LAWS[id].name)) fail(`遊び方の文面に法則「${LAWS[id].name}」が書いてある`);
    if (r.rules.includes(LAWS[id].desc)) fail(`遊び方の文面に法則の説明が書いてある`);
  });
}

const left = [];
for (const v of sample) {
  const r = identifiability(v.laws, v, [TRIES]);
  if (!r) fail(`${v.name} の局面を作れない`);
  if (r[TRIES] > LIMIT) {
    fail(`${v.name}：${TRIES}通り試しても候補が${r[TRIES]}通り残る（要 ${LIMIT} 以下）。`
      + "盤面に法則を見分ける情報が載っていない");
  }
  left.push(r[TRIES]);
}
console.log(`ident smoke: ${TRIES}通り試すと候補は ${left.join("/")} 通りまで絞れる（91通り中） OK`);
