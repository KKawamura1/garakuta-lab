// 公開する build に印をつける。
//
// **「規則の版」と「いま読み込まれている build」は別物である。**
// 規則の版（laws-0.2 など）は規則を変えたときだけ動くので、
// 「さっき公開したものが届いているか」の確認には使えない。
// 作者から見て、古い service worker のキャッシュが出ているのか、
// 新しいものが出ているのかが区別できない状態だった。
//
// ここでは commit の短縮 sha と日付を書き出し、画面の隅に出す。**公開のたびに必ず変わる。**
// 公開時に「上の隅が xxxxxxx になっていれば新しい版です」と伝えられるようにするためのもの。

import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fingerprint } from "./rules-fingerprint.mjs";
import { RULES_VERSION } from "../core/rules-version.mjs";

const sha = execSync("git rev-parse --short HEAD").toString().trim();
const when = new Date().toISOString().slice(0, 16).replace("T", " ");
// 規則の指紋も焼き込む。**版を上げ忘れても、記録は必ず分かれる。**
// smoke-version は公開時にしか鳴らないので、すり抜けた場合の受け皿がここ。
const fp = fingerprint();
writeFileSync("core/build.mjs",
  `// **analysis/stamp.mjs が生成する。手で編集しない。**\n`
  + `// BUILD は公開のたびに変わる（作者が「新しい版が届いたか」を目で確かめるため）。\n`
  + `// FINGERPRINT は遊ぶ側から見た規則が変わったときだけ変わる（記録を分けるため）。\n`
  + `export const BUILD = ${JSON.stringify(`${sha} / ${when}Z`)};\n`
  + `export const FINGERPRINT = ${JSON.stringify(fp)};\n`
  + `export default BUILD;\n`);
console.log(`build 印: ${sha} / ${when}Z ／ 規則の指紋: ${fp}（${RULES_VERSION}）`);
