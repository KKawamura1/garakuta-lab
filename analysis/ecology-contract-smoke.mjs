// **content contract を、押すたびに機械が引く。**
//
// R7 の hard contract は「一度公開した意味を変えず、語彙を追加できる」ことだった。
// 深一致 fixture（ecology/contract.test.mjs）は「変わっていないか」を見るが、
// それだけでは**壊れた足し方**を止められない。ここは足し方の側を見る。
//
// 見るもの:
//   1. bundle が validator を通ること
//   2. engine が content の ID で分岐していないこと
//   3. content に小数が無いこと（丸めは effect 確定時だけ）
//   4. 公開済みの ID が、同じ節に、同じ意味で残っていること
//   5. position が canonical ID であること（表示語を保存しない）
//
// **鳴ることを確かめてある**（末尾の自己検査）。

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateContentBundle } from "../ecology/validate.mjs";
import { POSITIONS } from "../ecology/schema.mjs";
import {
  CONTENT_CONTRACT_VERSION,
  NAMED_SECTIONS,
  PLAYABLE_CONTENT,
  RETIRED_IDS,
} from "../ecology/content/index.mjs";

const problems = [];

// 1. validator を通ること。未知 event / effect / predicate、ID重複、
//    key と id の食い違いはここで落ちる。
const errors = validateContentBundle(PLAYABLE_CONTENT);
if (errors.length) {
  problems.push("validator が " + errors.length + " 件返した: "
    + errors.slice(0, 3).map((e) => `${e.path} ${e.code}`).join(" / "));
}

const idsBySection = Object.fromEntries(
  NAMED_SECTIONS.map((section) => [section, new Set(Object.keys(PLAYABLE_CONTENT[section]))]),
);
const allIds = new Set(NAMED_SECTIONS.flatMap((s) => [...idsBySection[s]]));
if (allIds.size < 40) {
  console.error("ecology-contract smoke: content ID をほとんど取り出せなかった。検査の書き方が古い。");
  process.exit(1);
}

// 2. **engine が content の ID で分岐していない。**
//    分岐が入った瞬間、content は data ではなくなり、並列に足せなくなる
//    （R7 §11 の停止条件そのもの）。
const ENGINE_FILES = [
  "engine.mjs", "effects.mjs", "predicates.mjs", "selectors.mjs",
  "values.mjs", "actors.mjs", "event-queue.mjs", "schema.mjs", "validate.mjs",
];
function contentIdsIn(source) {
  return [...allIds].filter((id) => source.includes(`"${id}"`) || source.includes(`'${id}'`));
}
for (const file of ENGINE_FILES) {
  const hits = contentIdsIn(readFileSync(new URL(`../ecology/${file}`, import.meta.url), "utf8"));
  if (hits.length) {
    problems.push(`ecology/${file} が content の ID で分岐している: ${hits.join(", ")}`
      + "（engine は語彙だけを知る。個別 ID は content 側へ）");
  }
}

// 3. **content に小数を置かない。**中間計算は整数で持ち、丸めるのは
//    effect を event へ確定する直前だけ（R6 §4.4）。data に小数があると、
//    どこで丸めたのかが後から辿れない。
function fractions(value, path, found = []) {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) found.push(`${path} = ${value}`);
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => fractions(item, `${path}[${index}]`, found));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) fractions(item, `${path}.${key}`, found);
  }
  return found;
}
const floats = fractions(PLAYABLE_CONTENT, "content");
if (floats.length) problems.push("content に小数がある: " + floats.slice(0, 5).join(", "));

// 4. **公開済みの ID が消えていない・引っ越していない。**
//    保存済みの run、D1 の行、Blueprint はこの ID を持っている。
//    消すなら RETIRED_IDS へ理由と行き先を書く（黙って消さない）。
const frozen = JSON.parse(readFileSync(new URL("../ecology/contract-snapshot.json", import.meta.url), "utf8"));
for (const section of NAMED_SECTIONS) {
  for (const id of Object.keys(frozen.content[section] ?? {})) {
    if (idsBySection[section].has(id)) continue;
    if (RETIRED_IDS[id]) continue;
    const movedTo = NAMED_SECTIONS.find((other) => idsBySection[other].has(id));
    problems.push(movedTo
      ? `公開済みの ID ${id} が ${section} から ${movedTo} へ移った（別内容への再利用は禁止）`
      : `公開済みの ID ${id}（${section}）が消えた。RETIRED_IDS へ理由と行き先を書くこと`);
  }
}

// 5. **position は canonical ID で保存する。**「前列」「front」等の表示語を
//    data に入れると、2×3 formation（R6 §5.4）へ広げるときに全定義が壊れる。
function positionWords(value, path, found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => positionWords(item, `${path}[${index}]`, found));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (key === "position" && typeof item === "string" && !POSITIONS.includes(item)) {
        found.push(`${path}.${key} = ${JSON.stringify(item)}`);
      }
      positionWords(item, `${path}.${key}`, found);
    }
  }
  return found;
}
const badPositions = positionWords(PLAYABLE_CONTENT, "content");
if (badPositions.length) problems.push("position が canonical ID でない: " + badPositions.join(", "));

if (typeof CONTENT_CONTRACT_VERSION !== "string" || !CONTENT_CONTRACT_VERSION) {
  problems.push("content contract の版が無い");
}

// 参照点。**この検査が本当に引っかかるのかを、ここで確かめる。**
// 片側だけ書いて「通った」で終わらせない。
{
  const selfChecks = [
    ["engine の ID 分岐", contentIdsIn(`if (actor.definitionId === "${[...allIds][0]}") {}`).length > 0],
    ["小数", fractions({ a: { b: 1.5 } }, "x").length === 1],
    ["表示語の position", positionWords({ a: { position: "前列" } }, "x").length === 1],
    ["canonical な position は通す", positionWords({ a: { position: POSITIONS[0] } }, "x").length === 0],
  ];
  for (const [what, ok] of selfChecks) {
    if (!ok) {
      console.error(`ecology-contract smoke: 参照点が壊れている（${what} を検出できない）。`);
      process.exit(1);
    }
  }
}

if (problems.length) {
  console.error("ecology-contract smoke:\n  " + problems.join("\n  "));
  process.exit(1);
}

console.log(`ecology-contract smoke: ${CONTENT_CONTRACT_VERSION} — `
  + `ID ${allIds.size}件、engine に個別分岐なし、小数なし、公開済み ID の引っ越しなし`);
