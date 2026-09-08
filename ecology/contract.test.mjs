// **公開した意味を、黙って変えていないか。**
//
// R7 の hard contract は「一度公開した意味を変えず、語彙を追加できる」ことだった。
// content を種類別ファイルへ分けたとき、それが本当に**挙動を変えない移動**だったのかは、
// 目で追えない（1万行近い bundle が動く）。ここは凍らせた出力との深一致で見る。
//
// **落ちたら、まず「変えるつもりがあったか」を確かめる。**
// 意図した変更なら `node ecology/contract-snapshot.mjs --write` で凍結を作り直す。
// 意図していないなら、それは content contract を壊した変更である。

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { contractSnapshot, contractSnapshotJson } from "./contract-snapshot.mjs";
import { CONTENT_CONTRACT_VERSION, NAMED_SECTIONS, SECTION_NAMES, PLAYABLE_CONTENT } from "./content/index.mjs";

const frozenPath = fileURLToPath(new URL("./contract-snapshot.json", import.meta.url));
const frozen = JSON.parse(readFileSync(frozenPath, "utf8"));
const now = contractSnapshot();

// 節ごとに比べる。**全体を一度に比べると、どこが動いたのか分からない。**
const sections = [...new Set([...Object.keys(frozen), ...Object.keys(now)])];
const drifted = [];
for (const section of sections) {
  try {
    assert.deepEqual(now[section], frozen[section]);
  } catch {
    drifted.push(section);
  }
}
{
  const encoded = Buffer.from(JSON.stringify(now.runRewards)).toString("base64");
  for (let offset = 0; offset < encoded.length; offset += 16000) {
    console.log(`RUN_REWARDS_BASE64_${offset / 16000}=${encoded.slice(offset, offset + 16000)}`);
  }
}
assert.deepEqual(
  drifted, [],
  "content contract が動いた節: " + drifted.join(", ")
  + "\n  意図した変更なら `node ecology/contract-snapshot.mjs --write` で凍結を作り直す。"
  + "\n  意図していないなら、公開済みの意味を壊している。",
);

// バイト一致も見る。**深一致は鍵の順序を見ない**ので、
// 保存や D1 の見え方が変わったことに気づけない。
assert.equal(
  contractSnapshotJson(), readFileSync(frozenPath, "utf8"),
  "深一致はするが、並び順か整形が変わっている（保存・D1・replay の見え方が変わる）",
);

// 凍結ファイルが本当に中身を持っていること。**空と一致しても意味がない。**
assert.ok(Object.keys(frozen.content.activeSkills).length >= 12, "凍結ファイルが痩せている");
assert.ok(
  Array.isArray(frozen.expeditionEncounters) && frozen.expeditionEncounters.length > 0,
  "現行 expedition encounter が凍っていない",
);
assert.ok(
  Object.keys(frozen.composedEncounters ?? {}).length > 0,
  "現行 composed encounter が凍っていない",
);

// 表示名の表が、分離後も全節ぶん揃っていること。
for (const section of NAMED_SECTIONS) {
  assert.ok(SECTION_NAMES[section], section + " の表示名表が無い");
  for (const [id, displayName] of Object.entries(SECTION_NAMES[section])) {
    assert.equal(
      PLAYABLE_CONTENT[section][id]?.displayName, displayName,
      `${section}.${id} の表示名が定義へ届いていない（種類別ファイルの繋ぎ落ち）`,
    );
  }
}

assert.equal(typeof CONTENT_CONTRACT_VERSION, "string");
assert.ok(CONTENT_CONTRACT_VERSION.length > 0, "content contract の版が空");

console.log(
  `content contract: ${sections.length}節が凍結と一致（${CONTENT_CONTRACT_VERSION}、`
  + `expedition ${frozen.expeditionEncounters.length}戦・composed ${Object.keys(frozen.composedEncounters).length}件）`,
);

