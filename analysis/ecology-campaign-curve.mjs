// **第一部10 Stage の難度曲線を、同じ物差しで並べる。**
//
// R23。作者の指摘は「1シナリオ目はちょうどいいが、2シナリオ目以降が全く調整
// されていない」だった。実際、以前は **12戦の中身が Stage 0 用の一組しか無く**、
// Stage 1〜3 はそれを人数で切り詰めたものを遊んでいた（`content/expedition.mjs`）。
// Stage ごとに別の12戦を持たせた以上、**Stage をまたいで比べられる数**が要る。
//
// ここは fun を測らない。測るのは二つだけである。
//
//   A. **一戦ごとの重さ。**同じ基準編成（購入なし・装備なし・満タン）で12戦を
//      別々に走らせ、二つに分けて出す。**合計の被害だけでは足りない**（弱い相手でも
//      round 上限まで殴られ続ければ数が積み上がるので、「速く殺される」と
//      「長く削られる」が同じ値になる）。
//
//        圧力 … 1ラウンドあたりに受ける damage が、隊の総HPの何割か
//        分量 … 敵の総HPが、隊の総HPの何倍か（どれだけ削り切る必要があるか）
//
//      Stage をまたいだ比較は、この二つを掛けた **難度指数（圧力 × 分量）** で行う。
//      速く殺される相手と、長く削り続けなければならない相手は、どちらも重い。
//   B. **通しの到達点。**HP を持ち越し、補給3を野営へ配りながら通す。
//      基準編成がどこで止まるか。**基準編成は技能を1点も買っていない**ので、
//      ここで完走してしまう Stage は「投資しなくても通る」という意味になる。
//
// 合格条件は一つだけ:
//   **A の重さが Stage を追って単調に増える**（第一部が10 Stage の梯子になっている）。
// 数そのものは soft data で、遊んでから動かす。動かしたら EXPECTED を書き直す。

import assert from "node:assert/strict";
import { CAMPAIGN_STAGES } from "../ecology/content/campaign-stages.mjs";
import { expeditionEncounter, ENCOUNTERS_PER_RUN } from "../ecology/content/expedition.mjs";
import {
  campTreat, commitBattleResult, newProfile, newRun,
} from "../ecology/progression.mjs";
import { characterStats } from "../ecology/progression.mjs";
import { freshLoadout, simulateNextBattle } from "../ecology/playable-battles.mjs";

const SEED = "campaign-curve";

function partyMaxHp(profile, roster) {
  return roster.reduce((total, id) => total + (characterStats(profile, id)?.stats.maxHp ?? 0), 0);
}

// ---- A. 一戦ごとの重さ（満タンから、単発で）
function encounterWeights(stage) {
  const profile = newProfile();
  const roster = [...stage.castCharacterIds];
  const maxHp = partyMaxHp(profile, roster);
  const rows = [];
  for (let index = 1; index <= ENCOUNTERS_PER_RUN; index += 1) {
    const run = {
      ...newRun(profile, {
        campaignStageSequence: stage.sequence,
        runSeed: SEED, runId: `${SEED}-${stage.id}-${index}`, roster,
      }),
      loadout: freshLoadout(roster),
    };
    const { result } = simulateNextBattle(run, profile, index);
    let taken = 0;
    for (const event of result.events) {
      if (event.type !== "damage_taken") continue;
      if (!(event.targetActorIds ?? []).some((id) => String(id).startsWith("a_"))) continue;
      taken += Number(event.values?.amount ?? 0);
    }
    const enemyHp = result.actors
      .filter((actor) => !actor.instanceId.startsWith("a_"))
      .reduce((total, actor) => total + (actor.maxHp ?? 0), 0);
    rows.push({
      index,
      kind: expeditionEncounter(index, stage.sequence).kind,
      result: result.result,
      rounds: result.roundsUsed,
      takenBps: Math.round((taken * 10_000) / maxHp),
      pressureBps: Math.round((taken * 10_000) / maxHp / Math.max(1, result.roundsUsed)),
      volumeBps: Math.round((enemyHp * 10_000) / maxHp),
    });
  }
  return rows;
}

// ---- B. 通しの到達点（持ち越し・補給3）
function playThrough(stage) {
  const profile = newProfile();
  const roster = [...stage.castCharacterIds];
  let run = {
    ...newRun(profile, {
      campaignStageSequence: stage.sequence,
      runSeed: SEED, runId: `${SEED}-${stage.id}-run`, roster,
    }),
    loadout: freshLoadout(roster),
  };
  let reached = 0;
  for (let index = 1; index <= ENCOUNTERS_PER_RUN; index += 1) {
    const { result } = simulateNextBattle(run, profile, index);
    const committed = commitBattleResult(profile, run, index, result);
    run = committed.run;
    if (result.result !== "win") break;
    reached = index;
    // 倒れた者から蘇生し、それが済んでから一番深い傷を集中治療する（stage3-builds と同じ形）。
    for (const characterId of roster) {
      if ((run.supplies ?? 0) < 1) break;
      if ((run.currentHp?.[characterId] ?? 0) > 0) continue;
      const treated = campTreat(run, profile, "revive", [characterId]);
      if (treated.ok) run = treated.run;
    }
  }
  return { reached, supplies: run.supplies ?? 0 };
}

const report = [];
for (const stage of CAMPAIGN_STAGES) {
  const rows = encounterWeights(stage);
  const avg = (key, list = rows) => Math.round(list.reduce((t, r) => t + r[key], 0) / list.length);
  const boss = rows.filter((row) => row.kind === "boss");
  const through = playThrough(stage);
  report.push({
    stage,
    index: Math.round(avg("pressureBps") * avg("volumeBps") / 10_000),
    pressure: avg("pressureBps"),
    volume: avg("volumeBps"),
    bossPressure: avg("pressureBps", boss),
    bossVolume: avg("volumeBps", boss),
    taken: avg("takenBps"),
    through,
  });
}

for (const row of report) {
  console.log(
    `${row.stage.id} 人数${row.stage.partySize} 難度指数 ${String(row.index).padStart(4)}`
    + ` 圧力 ${(row.pressure / 100).toFixed(1)}%/R（ボス ${(row.bossPressure / 100).toFixed(1)}）`
    + ` 分量 ${(row.volume / 100).toFixed(2)}倍（ボス ${(row.bossVolume / 100).toFixed(2)}）`
    + ` 一戦被害 ${(row.taken / 100).toFixed(0)}%`
    + ` 基準編成の通し 第${row.through.reached}戦まで`,
  );
}

// **単調増加。**Stage 0〜3 は人数が増えるので、同じ人数になる Stage 3 以降だけを見る
// （2人 Stage と5人 Stage の「隊の総HPに対する割合」を直に比べても意味が無い）。
const lateral = report.filter((row) => row.stage.partySize === 5);
for (let i = 1; i < lateral.length; i += 1) {
  assert.ok(
    lateral[i].index > lateral[i - 1].index,
    `${lateral[i].stage.id} の難度指数が ${lateral[i - 1].stage.id} より重くない`
    + `（${lateral[i - 1].index} → ${lateral[i].index}）`,
  );
}
// **一段あたりの上がり幅**も見る。刻みが粗いと、投資の効果が「足りない」から
// 「余る」へ一足飛びになる。目安は一段 5〜30%（実測の soft data）。
for (let i = 1; i < lateral.length; i += 1) {
  const growth = Math.round((lateral[i].index * 100) / lateral[i - 1].index) - 100;
  assert.ok(
    growth >= 5 && growth <= 30,
    `${lateral[i].stage.id} の難度指数の伸びが ${growth}%（目安 5〜30%）`,
  );
}

// 導入の4 Stage は人数が増えるので圧力の割合を直に比べない。**分量**だけは、
// 「人数が増えたぶん以上に敵が増えていないか」を見るために並べる。
const early = report.filter((row) => row.stage.partySize < 5);
for (let i = 1; i < early.length; i += 1) {
  assert.ok(
    early[i].volume > 0,
    `${early[i].stage.id} の分量が測れていない`,
  );
}

console.log("ecology-campaign-curve: 第一部10 Stage の圧力と分量が、Stage を追って増えている");
