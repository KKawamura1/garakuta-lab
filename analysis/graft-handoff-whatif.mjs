// **直す前に、直したらどうなるかを出す。**
//
// 作者の報告（2026-08-25）：
//   「反動と継ぎ火は重複しないのか。5×2×1.5=15になると思ったが13。
//     シナジーはないのか。無念」
//
// 継ぎ火の説明は「次に別の行動を選ぶと、**その効果が1.5倍になる**」。
// だが `applyHandoff` は加算分を `baseEffect(actionId)`（変異前の素の値）から作る。
// 打撃5・反動あり → 手動10、継ぎ火の加算は round(5/2)=3 → 合計13。
// 説明どおりなら、その行動の効果は10なので1.5倍で15。
// **素の行動では差が出ない。食い違うのは別の変異と重なったときだけ。**
//
// これは仕様の判断なので勝手には直さない。代わりに、**直した engine を
// その場で作って同じ物差しにかけ、決めるのに要る数字だけを出す。**
// ルールの再実装はしない（それは `smoke-core` が禁じている形の間違いである）。
// engine の該当箇所を書き換えた一時モジュールを import して測る。
//
//   node analysis/graft-handoff-whatif.mjs [試行数]

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import * as current from "../graft/engine.mjs";
import { measureBuild } from "./graft-dominance.mjs";

const SOURCE = new URL("../graft/engine.mjs", import.meta.url);

// 現状：加算分を素の値から作る
const BEFORE = `  const base = baseEffect(actionId);
  const bonus = {};
  for (const key of ["energy", "damage", "shield"]) {
    if (base[key]) bonus[key] = Math.max(1, Math.round(base[key] / 2));
  }`;

// 説明どおり：その行動の**変異後の**効果の半分を足す（＝合計1.5倍）
const AFTER = `  const base = baseEffect(actionId);
  const handoffMutation = mutationFor(state, actionId);
  const handoffMultiplier = handoffMutation?.id === "recoil" ? 2 : 1;
  const bonus = {};
  for (const key of ["energy", "damage", "shield"]) {
    if (base[key]) bonus[key] = Math.max(1, Math.round(scaled(base[key], handoffMultiplier) / 2));
  }`;

const source = readFileSync(SOURCE, "utf8");
if (!source.includes(BEFORE)) {
  console.error("graft/engine.mjs の applyHandoff が想定と違う。書き換え箇所を直してから測ること。");
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "graft-whatif-"));
const patchedPath = join(dir, "engine.mjs");
writeFileSync(patchedPath, source.replace(BEFORE, AFTER));
const patched = await import(pathToFileURL(patchedPath).href);
const trials = Number(process.argv[2] || 300);

// まず、狙った一点が本当に変わっているかを確かめる（変わっていなければ測る意味がない）。
// **敵HPは十分大きくする。** 最初これを12のままやって「12→12、差なし」と出た。
// 実際は13ダメージが敵HP12で頭打ちになっていただけである。
function strikeWithRecoilAfterHandoff(engine) {
  const s = engine.createGame(5);
  s.enemy = { ...s.enemy, hp: 999, maxHp: 999 };
  s.actions.strike = { mutation: "recoil" };
  s.actions.guard = { mutation: "handoff" };
  s.energy = 6;
  const afterGuard = engine.playAction(s, "guard").state;
  const before = afterGuard.enemy.hp;
  const afterStrike = engine.playAction(afterGuard, "strike").state;
  return before - afterStrike.enemy.hp;
}
const dmgNow = strikeWithRecoilAfterHandoff(current);
const dmgNew = strikeWithRecoilAfterHandoff(patched);
console.log(`遮蔽（継ぎ火）→ 打撃（反動）の1発:  いま ${dmgNow}  →  説明どおり ${dmgNew}`);
console.log(`（素の打撃は5。反動で10。説明どおりならさらに1.5倍で15）\n`);

// **測るのは「2つ載せた盤面」でなければならない。**
// 一つずつしか載せない測り方では、変異どうしの噛み合わせは原理的に動かない
// （最初それで全部 +0.0pt と出た。差が無いのではなく、差の出る盤面を作っていなかった）。
const BUILDS = [
  { name: "継ぎ火→遮蔽 ＋ 反動→打撃（作者の答え）", grafts: { guard: "handoff", strike: "recoil" } },
  { name: "継ぎ火→充電 ＋ 反動→打撃", grafts: { charge: "handoff", strike: "recoil" } },
  { name: "継ぎ火→遮蔽 ＋ 余波→打撃", grafts: { guard: "handoff", strike: "echo" } },
  { name: "継ぎ火→打撃 ＋ 反動→遮蔽", grafts: { strike: "handoff", guard: "recoil" } },
  { name: "反動→打撃だけ（継ぎ火なし）", grafts: { strike: "recoil" } },
  { name: "継ぎ火→遮蔽だけ", grafts: { guard: "handoff" } },
  { name: "接ぎ木なし", grafts: {} }
];

const width = Math.max(...BUILDS.map(b => b.name.length));
console.log(`でたらめな方針の勝率（1戦あたり、${trials}試行 × 敵${current.ENEMIES.length}体）\n`);
console.log(`${"".padEnd(width)}   いま   説明どおり     差`);
for (const b of BUILDS) {
  const a = measureBuild(current, b.grafts, trials);
  const c = measureBuild(patched, b.grafts, trials);
  const d = (c.overall - a.overall) * 100;
  console.log(
    `${b.name.padEnd(width)}  ${(a.overall * 100).toFixed(1).padStart(5)}%  ` +
    `${(c.overall * 100).toFixed(1).padStart(6)}%  ${(d >= 0 ? "+" : "") + d.toFixed(1)}pt`
  );
}
