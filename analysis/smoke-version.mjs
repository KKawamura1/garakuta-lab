// **規則が変わったのに版が据え置きになっていないか。**
//
// 版の文字列は記録を分離するために置いてある。据え置くと、
// 別のゲームになった前後の記録が同じ入れ物に混ざり、後から分けられない。
// 2026-08-22、1巡上限・偏食削除・天井を外す、を入れても laws-0.1 のままだった。
// 作者の指摘：「いま0.1→0.2という事実が、これまで何度もこれを見落としていたことを物語っています」。
//
// **散文に書いても落ちる**（今日それを実測した）ので機械に置く。

import { readFileSync } from "node:fs";
import { fingerprint } from "./rules-fingerprint.mjs";
import { RULES_VERSION, RULES_FINGERPRINT } from "../core/rules-version.mjs";
import { makeLawRuleset, BASE } from "../core/laws.mjs";

const now = fingerprint();
if (now !== RULES_FINGERPRINT) {
  console.error(`version smoke: **規則が変わっている**（指紋 ${RULES_FINGERPRINT} → ${now}）のに`
    + ` 版は ${RULES_VERSION} のままです。

  遊ぶ側から見て何かが変わりました。記録を分けられるように、版を上げてください。
    1. core/rules-version.mjs の RULES_VERSION を上げ、RULES_FINGERPRINT を ${now} にする
    2. 何を変えたのかを、そのファイルの履歴に1行足す
    3. agent-view/sync.js の RULESET_VERSION.laws と core/laws.mjs の id を揃える

  変えたつもりが無いなら、それは意図しない変更なので、先に何が変わったかを調べること。`);
  process.exit(1);
}

// 版の文字列が3箇所で揃っていること。ずれると記録の分離が壊れる。
const sync = readFileSync("agent-view/sync.js", "utf8");
const laws = readFileSync("core/laws.mjs", "utf8");
const inSync = (sync.match(/laws: "(laws-[\d.]+)"/) || [])[1];
// **id は実物から読む。**以前はソースの文字列を正規表現で抜いていたが、
// 版を条件分岐にした（暴走ありなら cost-0.1）とたんに読めなくなった。
// **検査が形を見ていると、形が変わっただけで黙る。**組み立てた結果を見ればそうならない。
const FLAT = BASE.map(() => 1);
const CAPS = BASE.map(e => Math.max(4, Math.round(e.hp / 3)));
const idOf = options => makeLawRuleset(["relay", "vanguard"], FLAT, FLAT, FLAT, CAPS, options).id.split(":")[0];
const inLaws = idOf({});

// 代償の版も、通報の版と揃っていること。
const costId = idOf({ overdrive: { frac: 0.5, rate: 1 } });
const costInSync = (sync.match(/cost: "(cost-[\d.]+)"/) || [])[1];
if (costId !== costInSync) {
  console.error(`version smoke: 代償の版が laws.mjs で ${costId}、sync.js で ${costInSync}`);
  process.exit(1);
}
if (inSync !== RULES_VERSION) {
  console.error(`version smoke: sync.js の版が ${inSync}、rules-version.mjs は ${RULES_VERSION}`);
  process.exit(1);
}
if (inLaws !== RULES_VERSION) {
  console.error(`version smoke: laws.mjs の版が ${inLaws}、rules-version.mjs は ${RULES_VERSION}`);
  process.exit(1);
}

console.log(`version smoke: ${RULES_VERSION}（指紋 ${now}）が3箇所で揃っている OK`);
