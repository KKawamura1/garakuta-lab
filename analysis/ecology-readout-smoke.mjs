// **技能の説明文が、実際の係数と食い違っていないか。**
//
// 2026-08-31、6件ずれていた。うち5件は PR59 が係数を変えたときからテキストが
// 旧値のままで、**大溜めは実際 1000% なのに「400%」と表示していた**。
// プレイヤーは4割の威力だと思って選んでいたことになる。
//
// ずれる理由ははっきりしている。`bpsForLegacyAmount(N)` は「旧尺度の量 N」を
// 中立 parameter 40 に対する係数へ直す関数で、**N はそのまま % ではない**
// （`bpsForLegacyAmount(10)` は 100% ではなく 250%）。説明文を書くとき
// この N をそのまま % として写すと必ずずれる。
//
// **散文の約束では落ちる。押すたびに機械が見る。**

import assert from "node:assert/strict";
import { PLAYABLE_CONTENT } from "../ecology/playable-content.mjs";
import { ACTIVE_META } from "../ecology/content/skill-tree.mjs";

const SKIP = /^(enemy_|front_strike|rear_strike|idle_|fallback_|basic_strike_)/;
const drifted = [];
let checked = 0;

for (const [id, definition] of Object.entries(PLAYABLE_CONTENT.activeSkills)) {
  if (SKIP.test(id)) continue;
  const meta = ACTIVE_META[id];
  if (!meta) continue;
  const scaled = [
    ...(definition.effects ?? []),
    ...(definition.preparation?.completionEffects ?? []),
  ].filter((effect) => effect.amount?.type === "stat_scaled");
  if (!scaled.length) continue;

  // 多段は1発ぶんも総量も書き方としてありうるので、両方を正解として許す。
  const perHit = scaled.reduce((sum, effect) => sum + effect.amount.coefficientBps, 0) / 100;
  const total = scaled.reduce((sum, effect) => sum + effect.amount.coefficientBps * (effect.hitCount ?? 1), 0) / 100;
  const written = [...String(meta[1]).matchAll(/(\d+)\s*%/g)].map((match) => Number(match[1]));
  if (!written.length) continue;
  checked += 1;
  const ok = written.some((value) => Math.abs(value - total) < 1 || Math.abs(value - perHit) < 1);
  if (!ok) drifted.push({ id, name: meta[0], total, perHit, written });
}

assert.ok(checked >= 10, `係数つきの説明文が ${checked} 件しか見つからない。読み出し側の形が変わった疑い`);
assert.deepEqual(
  drifted, [],
  "説明文と係数がずれている技能がある:\n"
  + drifted.map((row) => `  ${row.name}(${row.id}): 実際 ${row.total}%`
    + (row.perHit !== row.total ? `（1発 ${row.perHit}%）` : "")
    + ` / 説明文 ${row.written.join("・")}%`).join("\n")
  + "\n**bpsForLegacyAmount(N) の N はそのまま % ではない**（(10) は 250%）。実際の係数を書くこと",
);

console.log(`ecology readout smoke ok ${JSON.stringify({ checked, drifted: drifted.length })}`);
