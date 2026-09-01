// **画面が丸ごと消えても、構文検査は通る。**
//
// 2026-08-29、戦闘画面を書き直したときに、隣り合っていた
// renderBattleError / renderResult / renderReward / renderComplete の4画面を
// まとめて消してしまった。`node --check` は通る（残りは正しいJSなので）。
// 気づいたのはブラウザで開いて真っ白になったときで、それは通しを走らせるまで来ない。
//
// ここは押すたびに走る安い受け皿。画面の割り当て表と、押せるボタンの行き先が、
// 本当に存在するかだけを見る。
//
// **取り出せなかったら黙らずに落とす。**書き方を変えたらこの検査も直すこと
// （形だけ見る検査は、形が変わった瞬間に何も見なくなる）。

import { readFileSync } from "node:fs";

const app = readFileSync("ecology/app.js", "utf8");
const problems = [];

const defined = new Set([...app.matchAll(/^function ([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]));
if (defined.size < 40) {
  console.error("ecology-screens smoke: 関数定義をほとんど取り出せなかった。検査の書き方が古い。");
  process.exit(1);
}

// 1. 画面の割り当て表。`render()` と `renderCamp()` が名前で画面を引いている。
const tables = [...app.matchAll(/const (views|view) = \{([\s\S]*?)\}\[?/g)];
if (tables.length < 2) {
  console.error("ecology-screens smoke: 画面の割り当て表を見つけられなかった。検査の書き方が古い。");
  process.exit(1);
}
let mapped = 0;
for (const [, name, body] of tables) {
  for (const [, key, target] of body.matchAll(/(\w+):\s*([A-Za-z_$][\w$]*)/g)) {
    mapped += 1;
    if (!defined.has(target)) problems.push(`${name} の ${key} が指す ${target}() が無い`);
  }
}
if (mapped < 10) {
  console.error(`ecology-screens smoke: 割り当てを${mapped}件しか取り出せなかった。検査の書き方が古い。`);
  process.exit(1);
}

// 2. 押せるボタンの行き先。button(ラベル, 行き先, ...) の行き先が
//    handleAction のどこかで受けられているか。受け手が無いボタンは黙って何もしない。
const actions = new Set([...app.matchAll(/\bbutton\(\s*(?:"[^"]*"|[^,]+),\s*"([a-z0-9-]+)"/g)].map((m) => m[1]));
const handled = new Set([...app.matchAll(/action === "([a-z0-9-]+)"/g)].map((m) => m[1]));
if (actions.size < 10 || handled.size < 10) {
  console.error(`ecology-screens smoke: ボタン${actions.size}件・受け手${handled.size}件しか取り出せなかった。`
    + "検査の書き方が古い。");
  process.exit(1);
}
for (const action of actions) {
  if (!handled.has(action)) problems.push(`ボタン "${action}" を受ける handleAction が無い（押しても何も起きない）`);
}

// 2b. button() を通さず data-action を直接書いた要素も同じ受け皿へ。
//     会話画面の「舞台を叩いて進む」のように、押せるのがボタンとは限らない。
const rawActions = new Set([...app.matchAll(/data-action=\\"([a-z0-9-]+)\\"/g)].map((m) => m[1]));
if (rawActions.size < 5) {
  console.error(`ecology-screens smoke: data-action を${rawActions.size}件しか取り出せなかった。検査の書き方が古い。`);
  process.exit(1);
}
for (const action of rawActions) {
  if (!handled.has(action)) problems.push(`data-action "${action}" を受ける handleAction が無い（触っても何も起きない）`);
}

// 3. 呼び先の実在。**「呼んでいるが、どこにも無い名前」を見る。**
//
//    140aa36 で isRecoverableStorageError が消え、呼び出しだけが2箇所残った。
//    保存枠が尽きたときにしか踏まれないので `node --check` も単体テストも通り、
//    公開先の通しが長い遠征のときだけ ReferenceError で落ちていた。
//    **黙って消えるのを防ぐのが、ここの仕事である。**
const source = app
  .replace(/\/\/[^\n]*/g, " ")
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/"(?:[^"\\]|\\.)*"/g, '"S"')
  .replace(/'(?:[^'\\]|\\.)*'/g, "'S'")
  .replace(/`(?:[^`\\]|\\.)*`/g, "`S`");
const names = (pattern, pick = (m) => [m[1]]) => [...source.matchAll(pattern)].flatMap(pick);
const splitList = (m) => m[1].split(",").map((part) => part.trim().split(/[=:\s.[\]{}]/)[0]).filter(Boolean);
const known = new Set([
  ...names(/function\s+([A-Za-z_$][\w$]*)/g),
  ...names(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g),
  ...names(/import\s*\{([^}]*)\}/g, (m) => m[1].split(",")
    .map((part) => part.trim().split(/\s+as\s+/).pop()).filter(Boolean)),
  ...names(/\(([^()]*)\)\s*=>/g, splitList),
  ...names(/function\s*[A-Za-z_$\w]*\s*\(([^()]*)\)/g, splitList),
]);
// 言語と実行環境が用意している名前。**足りなければここへ足す。**
const ambient = new Set([
  "Object", "Array", "JSON", "Math", "Number", "String", "Boolean", "Date", "Map", "Set", "WeakMap",
  "Error", "Promise", "RegExp", "Symbol", "BigInt", "Intl", "TextEncoder",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame",
  "parseInt", "parseFloat", "isNaN", "isFinite", "structuredClone",
  "encodeURIComponent", "decodeURIComponent",
  "localStorage", "document", "window", "console", "fetch", "crypto", "navigator", "alert", "confirm",
  "if", "for", "while", "switch", "catch", "return", "typeof", "function", "await", "new",
  "case", "do", "else", "of", "in", "delete", "void", "yield", "throw", "super", "import",
]);
const callTargets = [...new Set(names(/(?<![.\w$?])([a-zA-Z_$][\w$]*)\s*\(/g))];
if (callTargets.length < 100) {
  console.error(`ecology-screens smoke: 呼び先を${callTargets.length}件しか取り出せなかった。検査の書き方が古い。`);
  process.exit(1);
}
for (const target of callTargets) {
  if (known.has(target) || ambient.has(target)) continue;
  problems.push(`${target}() を呼んでいるが、定義も import もどこにも無い（踏んだ瞬間に ReferenceError）`);
}

// 4. 参照点。**片側だけでなく、鳴ることも確かめられる形にしておく。**
//    存在しない名前を混ぜたら必ず引っかかることを、ここで自己確認する。
if (defined.has("__surely_missing__")) {
  console.error("ecology-screens smoke: 参照点が壊れている。");
  process.exit(1);
}

if (problems.length) {
  console.error("ecology-screens smoke:\n  " + problems.join("\n  "));
  console.error("\n  画面か行き先が消えている。ブラウザでは真っ白になるが、構文検査では通る。");
  process.exit(1);
}

console.log(`ecology-screens smoke: 画面${mapped}件・ボタン${actions.size}件・data-action ${rawActions.size}件`
  + `・呼び先${callTargets.length}件の行き先がすべて存在する`);
