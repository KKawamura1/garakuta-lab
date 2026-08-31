// ecology のテストに、明らかな恒真アサートを混ぜないための軽い衛生検査。
//
// 実行時の値を読まずに「片側もリテラル、もう片側も同じリテラル」という
// 形だけを拾う。変数同士の同値性は決定性テストなどで意図的な場合があるため、
// この検査で推測して禁止しない。

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const root = new URL("../ecology/", import.meta.url);
const testFiles = readdirSync(root)
  .filter((name) => name.endsWith(".test.mjs"))
  .sort();
const literalTautologies = [];

for (const name of testFiles) {
  const source = readFileSync(new URL(name, root), "utf8");
  for (const [index, line] of source.split("\n").entries()) {
    const lineNumber = index + 1;
    if (/assert\.ok\(\s*(?:true|false)\s*[,)]/.test(line)) {
      literalTautologies.push(`${name}:${lineNumber}: ${line.trim()}`);
    }
    if (
      /assert\.(?:equal|strictEqual|deepEqual|deepStrictEqual)\(\s*(true|false|null|\[\]|\{\})\s*,\s*\1\s*(?:,|\))/.test(line)
    ) {
      literalTautologies.push(`${name}:${lineNumber}: ${line.trim()}`);
    }
  }
}

assert.deepEqual(
  literalTautologies,
  [],
  "恒真になりうるリテラル比較がある:\n" + literalTautologies.join("\n"),
);

console.log(
  "ecology test hygiene smoke ok "
  + JSON.stringify({ files: testFiles.length, literalTautologies: 0 }),
);
