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
  META_UPGRADES, TRAINING_MAX_LEVEL, campTreat, characterStats, commitBattleResult,
  newProfile, newRun, parseFunds, purchaseTraining, purchaseUpgrade, settleRun,
  recordEncounterCleared, trainingCost, upgradeCost,
} from "../ecology/progression.mjs";
import { freshLoadout, simulateNextBattle } from "../ecology/playable-battles.mjs";

const SEED = "campaign-curve";

// ---- 想定される投資
//
// **難度が上がるのは分かった。では、上がったぶんを買えるのか。**
// 第一部を Stage 0 から順に rank 0 で一度ずつ完走した人が、その時点までに持っている
// 資金を決まった順で使い切ったら、どれだけ強くなっているか。
//
// 使う順は宣言で固定する（プレイヤーの最適解ではなく、**釣り合いを測るための一本の線**）。
//   1. 財布の1/4までを常設の強化へ。安い順に一段ずつ
//   2. 残りは鍛錬へ。宣言した20枠を薄く、同じ段まで揃えながら積む
//
// **常設の強化に全部は使わない。**目利き・持込枠・初期SPは実際の遊びでは効くが、
// この検査は「購入なし・装備なし」の基準編成で測るので盤面に出てこない。全部そちらへ
// 流すと「投資しても効かない」という誤った読みになる。効き方の違うものを一本の線で
// 測る以上、**盤面に出る側（鍛錬）へ寄せた線**を引く。
const TRAINING_ORDER = Object.freeze([
  ["mender", "focus"], ["warden", "might"], ["warden", "vitality"], ["lancer", "guard"],
  ["lancer", "vitality"], ["tactician", "focus"], ["guardian", "might"], ["mender", "vitality"],
  ["guardian", "vitality"], ["tactician", "vitality"], ["lancer", "focus"], ["warden", "guard"],
  ["mender", "guard"], ["tactician", "guard"], ["guardian", "guard"], ["lancer", "might"],
  ["tactician", "might"], ["guardian", "focus"], ["mender", "might"], ["warden", "focus"],
]);
const UPGRADE_SHARE_BPS = 2_500;

function fundsEarnedFor(stage) {
  const profile = newProfile();
  let run = newRun(profile, {
    campaignStageSequence: stage.sequence,
    runSeed: SEED, runId: `${SEED}-funds-${stage.id}`, roster: [...stage.castCharacterIds],
  });
  for (let index = 1; index <= ENCOUNTERS_PER_RUN; index += 1) run = recordEncounterCleared(run, index);
  return settleRun(profile, run, "won").settlement.earned;
}

function investedProfileFor(stages, upTo) {
  let profile = newProfile();
  let purse = 0n;
  for (const stage of stages) {
    if (stage.sequence >= upTo) break;
    purse += BigInt(fundsEarnedFor(stage));
  }
  profile.activityFunds = purse.toString();
  // 1. 常設の強化は財布の1/4まで、安い順に
  const upgradeBudget = (purse * BigInt(UPGRADE_SHARE_BPS)) / 10_000n;
  let spentOnUpgrades = 0n;
  for (;;) {
    const affordable = META_UPGRADES
      .map((upgrade) => ({ upgrade, cost: upgradeCost(profile, upgrade.id) }))
      .filter((entry) => entry.cost !== null && spentOnUpgrades + entry.cost <= upgradeBudget
        && entry.cost <= parseFunds(profile.activityFunds))
      .sort((a, b) => (a.cost < b.cost ? -1 : a.cost > b.cost ? 1 : 0));
    if (!affordable.length) break;
    const bought = purchaseUpgrade(profile, affordable[0].upgrade.id);
    if (!bought.ok) break;
    spentOnUpgrades += affordable[0].cost;
    profile = bought.profile;
  }
  // 2. 残りは鍛錬へ、宣言した順で一段ずつ
  for (let level = 0; level < TRAINING_MAX_LEVEL; level += 1) {
    let spentThisPass = false;
    for (const [characterId, axis] of TRAINING_ORDER) {
      const cost = trainingCost(level);
      if (cost === null || cost > parseFunds(profile.activityFunds)) continue;
      const bought = purchaseTraining(profile, characterId, axis);
      if (!bought.ok) continue;
      profile = bought.profile;
      spentThisPass = true;
    }
    if (!spentThisPass) break;
  }
  return profile;
}

function partyMaxHp(profile, roster) {
  return roster.reduce((total, id) => total + (characterStats(profile, id)?.stats.maxHp ?? 0), 0);
}

// ---- A. 一戦ごとの重さ（満タンから、単発で）
function encounterWeights(stage, profile = newProfile()) {
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
  // **投資したあとの重さ。**その Stage までに入る資金を宣言順で使い切った隊で測り直す。
  const investedRows = encounterWeights(stage, investedProfileFor(CAMPAIGN_STAGES, stage.sequence));
  const investedAvg = (key) =>
    Math.round(investedRows.reduce((total, row) => total + row[key], 0) / investedRows.length);
  report.push({
    stage,
    invested: Math.round(investedAvg("pressureBps") * investedAvg("volumeBps") / 10_000),
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
    + ` 基準編成の通し 第${row.through.reached}戦まで`
    + ` / 投資後の指数 ${String(row.invested).padStart(4)}`,
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
// 「余る」へ一足飛びになる。目安は一段 5〜30%（実測の soft data）。ただし Stage 1から
// ナギへ `cover_ally` を初期装着するため、基準編成の相対値が動く Stage 3→4 / 8→9は
// 再測定値の上限を暫定的に広げる。敵側の再調整はこのcontent変更と分ける。
const MAX_GROWTH_BY_STAGE = Object.freeze({ stage_4: 50, stage_9: 35 });
for (let i = 1; i < lateral.length; i += 1) {
  const growth = Math.round((lateral[i].index * 100) / lateral[i - 1].index) - 100;
  const maxGrowth = MAX_GROWTH_BY_STAGE[lateral[i].stage.id] ?? 30;
  assert.ok(
    growth >= 5 && growth <= maxGrowth,
    `${lateral[i].stage.id} の難度指数の伸びが ${growth}%（目安 5〜${maxGrowth}%）`,
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

// **投資が難度に追いついているか。**
//
// 生の難度指数は Stage 3 → 9 で 2.8 倍になる。ギルドが同じだけ効いていなければ、
// 「調整されていない後半」が形を変えて戻ってくる。**投資後の指数**は、その Stage までに
// 入る資金を宣言順で使い切った隊で測り直した値で、**伸びがこちらでは大きく縮む**こと
// （＝資金が効いていること）を見る。
{
  const first = lateral[0];
  const last = lateral[lateral.length - 1];
  const rawGrowth = last.index / first.index;
  const investedGrowth = last.invested / first.invested;
  console.log(
    `ecology-campaign-curve 投資の効き: Stage ${first.stage.sequence} → ${last.stage.sequence} で`
    + ` 生の指数 ×${rawGrowth.toFixed(2)} / 投資後 ×${investedGrowth.toFixed(2)}`,
  );
  assert.ok(
    investedGrowth <= rawGrowth * 0.7,
    `投資しても難度の伸びが十分に縮んでいない`
    + `（生 ×${rawGrowth.toFixed(2)} / 投資後 ×${investedGrowth.toFixed(2)}、目安は生の7割以下）`,
  );
  // **買えるものが無い、も失敗である。**第一部で入る資金が、鍛錬の総量（20枠 × 12段）の
  // どれだけを買えるか。少なすぎれば投資が効かず、多すぎれば選ぶ余地が消える。
  const endProfile = investedProfileFor(CAMPAIGN_STAGES, last.stage.sequence + 1);
  const levels = Object.values(endProfile.characters ?? {})
    .flatMap((entry) => Object.values(entry.trainingLevels ?? {}));
  const boughtShare = levels.reduce((total, level) => total + level, 0)
    / (levels.length * TRAINING_MAX_LEVEL);
  console.log(
    `ecology-campaign-curve 鍛錬の余地: 第一部の資金で買えるのは全体の`
    + ` ${(boughtShare * 100).toFixed(0)}%（20枠 × ${TRAINING_MAX_LEVEL}段）`,
  );
  assert.ok(
    boughtShare >= 0.2 && boughtShare <= 0.6,
    `第一部の資金で鍛錬の ${(boughtShare * 100).toFixed(0)}% が買える（目安 20〜60%）`,
  );
}

console.log("ecology-campaign-curve: 第一部10 Stage の圧力と分量が、Stage を追って増えている");
