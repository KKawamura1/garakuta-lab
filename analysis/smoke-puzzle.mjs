// 「破れ」の出題が、出題として成立しているか。
//
// この版が賭けているのは**「足し算では届かない」**という一点である。
// そこが崩れたら、ただの総当たりになる。法則を直したときに気づけるよう、ここで見張る。

import { PUZZLES } from "../core/puzzle-table.mjs";
import { makeSimulate, PARTS, SLOT_COUNT } from "../core/laws.mjs";
import { makeRng } from "../core/rng.mjs";

const fail = m => { console.error(`puzzle smoke: ${m}`); process.exit(1); };
if (!Array.isArray(PUZZLES) || PUZZLES.length < 4) fail("出題が4問未満で、遊びにならない");

const score = (p, order) => {
  const sim = makeSimulate(p.laws);
  const enemy = { name: "試験体", hp: 1e9, atk: 0, atkPeriod: 99, cap: p.cap, floor: 0, cycleCap: 0, regen: 0 };
  const r = sim({ slots: order.map((t, i) => ({ id: `s${i}`, type: t })), hp: 999, maxHp: 999, enemy, rng: makeRng(1) });
  let total = 0;
  (r.log || []).forEach(e => { if (e.cycle <= p.cycles && e.damage) total += e.damage; });
  return total;
};

PUZZLES.forEach((p, i) => {
  const n = `${i + 1}問目（${p.name}）`;
  if (p.answer.length !== SLOT_COUNT) fail(`${n}：答えの枠数が ${p.answer.length}`);
  p.answer.forEach(t => { if (!PARTS[t]) fail(`${n}：答えに知らない部品 ${t}`); });

  // 1. **解があること。**表の答えで、実機が目標を越えること。
  const got = score(p, p.answer);
  if (got !== p.best) fail(`${n}：表の最良 ${p.best} と実機 ${got} が食い違う`);
  if (got < p.target) fail(`${n}：最良 ${got} が目標 ${p.target} に届かない。解けない出題`);

  // 2. **足し算では届かないこと。**ここが崩れると、噛み合わせを試していない。
  if (p.naive >= p.target) fail(`${n}：足し算で組んでも ${p.naive} で目標 ${p.target} を越える。気づきが要らない`);

  // 3. **総当たりで潰せないこと。**（学び：ガチャガチャで当たるのは退屈の側）
  if (p.space < 400) fail(`${n}：並びが ${p.space} 通りしかなく、総当たりで解ける`);

  // 4. 手持ちが5枠ぶん以上あること。
  if (p.pool.length < SLOT_COUNT) fail(`${n}：手持ちが ${p.pool.length} 個`);
  // 答えが手持ちから作れること（同じ部品の数まで足りているか）。
  const have = new Map();
  p.pool.forEach(t => have.set(t, (have.get(t) || 0) + 1));
  p.answer.forEach(t => {
    const left = (have.get(t) || 0) - 1;
    if (left < 0) fail(`${n}：答えの ${PARTS[t].name} が手持ちに足りない`);
    have.set(t, left);
  });
});

const ratios = PUZZLES.map(p => p.ratio);
console.log(`puzzle smoke: ${PUZZLES.length}問すべて、足し算では届かず最良で越える`
  + `（倍率 ${Math.min(...ratios)}〜${Math.max(...ratios)}、並び ${Math.min(...PUZZLES.map(p => p.space))}〜${Math.max(...PUZZLES.map(p => p.space))}通り） OK`);

// **遊んだことが持ち帰れること。**
//
// 2026-08-23、作者：「感想を書く欄や遊び方を見る欄はないんですか？」——無かった。
// 遊べるところまで作って、**記録がサーバーへ出る道を繋いでいなかった。**
// `sendRun` は core/run.mjs のランしか通せないので、破れは通せないまま放置されていた。
// 通す必要があるのは payload であって、ランの形ではない。
{
  const { readFileSync } = await import("node:fs");
  const app = readFileSync("puzzle/app.js", "utf8");
  const html = readFileSync("puzzle/index.html", "utf8");
  const sync = readFileSync("agent-view/sync.js", "utf8");
  if (!/export async function sendPayload/.test(sync)) fail("本編以外の形の記録を送る口が無い");
  if (!/sendPayload\(payload\(survey\)\)/.test(app)) fail("感想がサーバーへ送られない");
  if (!/gameVersion: "puzzle-0\.1-play"/.test(app)) fail("通報の版が付いていない（集計で分けられない）");
  if (!/telemetryRunId: state\.runId/.test(app)) fail("schemaVersion 2 以上の必須項目が欠けている（弾かれる）");
  if (!/const HOW = /.test(app)) fail("遊び方の本文が無い");
  if (!/id="howDialog"/.test(html) || !/id="howBtn"/.test(html)) fail("遊び方を開く口が無い");
  if (!/id="surveyBtn"/.test(html)) fail("感想を書く口が無い");
  if (!/id="markButton"/.test(html)) fail("気持ちを残す口が無い");
  // **途中でやめたときこそ聞きたい。**全問越えないと出ない作りにしていないこと。
  if (!/途中でも構いません/.test(app)) fail("感想が全問クリア後にしか出ない形になっている");
}
