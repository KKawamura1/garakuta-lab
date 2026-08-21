import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

// **事前登録した条件と、実装した条件が一致していること。**
//
// P12 の検証で、登録は「勝てる並びがある局面が98%以上」という割合だったのに、
// 実装は「1局面でも詰みがあれば不可」という絶対条件になっていた。
// 敵1体あたり20局面なら、悪い引き1件で探索が止まる。**登録より厳しい条件を課していた。**
// T3 でも同じことが起きていた（分母から詰みを外し、閾値を95%→90%に緩めていた）。
//
// これは標本の粗さとは違う種類の誤りである。**事前登録という手続きそのものを無効にする。**
// 数字が両方の文書に現れるなら、突き合わせを機械にやらせる。

const protocol = readFileSync("agents/PROTOCOL.md", "utf8");
const gate = readFileSync("analysis/build-law-table.mjs", "utf8");

const checks = [
  { what: "T1 詰みを作らない", registered: /勝てる並びが1つ以上存在する\*\*割合が (\d+)% 以上/, code: /found\.safeRate < 0\.(\d+)/ },
  { what: "T2 締まっている（上限）", registered: /全戦闘で (\d+)% を超えない/, code: /found\.winMedian > 0\.(\d+)/ },
  { what: "T3 順序が効く", registered: /勝敗が変わる戦闘が \*\*(\d+)% 以上\*\*/, code: /found\.decided < 0\.(\d+)\)/ }
];

checks.forEach(({ what, registered, code }) => {
  const a = protocol.match(registered);
  const b = gate.match(code);
  assert.ok(a, `${what}: 登録文が読み取れない`);
  assert.ok(b, `${what}: 実装が読み取れない`);
  const want = Number(a[1]);
  const got = Number(b[1].padEnd(2, "0"));
  assert.equal(got, want, `${what}: 登録は${want}%だが実装は${got}%`);
});

// 天井の条件（P12-b）も同じ扱いにする。
assert.match(protocol, /最上位等級の1戦あたり到達率が50%未満/, "P12-b の登録文が無い");
assert.match(gate, /ceiling > 0\.50/, "P12-b の実装が登録と違う");

console.log(`gate smoke: 事前登録の閾値と実装が一致（${checks.length + 1}件） OK`);
