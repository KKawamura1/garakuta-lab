// **Campaign Stage 0〜3 が、実際に通せる形になっているか。**
//
// analysis/ecology-expedition-smoke.mjs は旧・自由遠征（Free mode）を見ている。
// R9 でチュートリアルになった本編——2人から始まり、Stage ごとに人数と pack が
// 増える経路——は、そこを一度も通らない。**Stage 0 が2人で本当に越えられるのか**は、
// 作者が最初の晩に必ずぶつかるところなので、ここで先に測る。
//
// 見るのは勝率でも「正解 build」でもない。次の三つだけを見る。
//
//   1. その Stage の語彙だけで、12戦を通せる build が**少なくとも一つある**。
//      無ければ、その Stage は詰んでいる。
//   2. 12戦とも決着する（引き分け・膠着で止まらない）。
//   3. 素の初期構成では通せない（組む意味が残っている）。
//
// **fun を自動判定しない。**ここが言えるのは「通せる形かどうか」までである。

import {
  characterStats,
  manifestSkillIds,
  newProfile,
  newRun,
  rewardOffer,
  takeGeneratedEquipment,
} from "../ecology/progression.mjs";
import { freshLoadout, simulateNextBattle } from "../ecology/playable-battles.mjs";
import { CAMPAIGN_STAGES, ENCOUNTERS_PER_RUN } from "../ecology/content/index.mjs";

const problems = [];
const profile = newProfile();

// 決定的な build の作り分け。**乱数を使わない**（同じ変更で同じ結果が出ないと、
// 「調整で通るようになった」のか「たまたま当たった」のか区別できない）。
// 変種 v は、各人物へ available の別の窓を渡すだけの機械的な配り方である。
function variantLoadout(roster, ids, variant) {
  const loadout = freshLoadout(roster);
  // **窓ではなく歩幅で選ぶ。**連続した3つだけを試すと、
  // 「溜め突き＋斬撃＋防壁形成」のような飛び飛びの組み合わせに一生届かない。
  const pick = (list, offset, stride, count) => {
    const out = [];
    const step = 1 + (Math.abs(stride) % Math.max(1, list.length - 1));
    for (let n = 0; out.length < Math.min(count, list.length) && n < list.length * 2; n += 1) {
      const candidate = list[(offset + n * step) % list.length];
      if (!out.includes(candidate)) out.push(candidate);
    }
    return out;
  };
  const passives = [
    ...ids.passive.filter((id) => !id.startsWith("foundation")),
    "foundation_vitality", "foundation_might",
  ];
  roster.forEach((characterId, index) => {
    loadout.tactics[characterId] = pick(ids.active, variant + index * 3, variant + index, 3);
    loadout.reactives[characterId] = pick(ids.reactive, variant + index, variant, 3);
    loadout.passives[characterId] = pick(passives, variant + index, variant + 1, 2);
    loadout.equipment[characterId] = [];
  });
  return loadout;
}

// 拾った装備を、空き枠のある人へ順に持たせる。**選び方の巧さは測らない。**
function equipInto(run, equipmentId) {
  const owner = run.roster.find((id) => (run.loadout.equipment[id] ?? []).length < 2);
  if (!owner) return run;
  const loadout = structuredClone(run.loadout);
  loadout.equipment[owner] = [...(loadout.equipment[owner] ?? []), equipmentId];
  return { ...run, loadout };
}

function playStage(sequence, variant) {
  let run = newRun(profile, {
    runSeed: `campaign-smoke-${sequence}`, runId: `cs-${sequence}-${variant}`,
    roster: [], campaignStageSequence: sequence,
  });
  const ids = manifestSkillIds(run.manifest);
  const loadout = variant === null ? freshLoadout(run.roster) : variantLoadout(run.roster, ids, variant);
  run = { ...run, loadout };
  // 手元の初期装備を配ってから始める。
  for (const equipmentId of run.inventory) run = equipInto(run, equipmentId);

  const undecided = [];
  let reach = 0;
  for (let index = 1; index <= ENCOUNTERS_PER_RUN; index += 1) {
    const { result } = simulateNextBattle({ ...run, encounterIndex: index }, profile, index);
    if (result.result === "draw" || result.reason === "stalemate") {
      undecided.push(`${index}:${result.result}/${result.reason}`);
    }
    if (result.result !== "win") break;
    reach = index;
    const endingHp = Object.fromEntries(run.roster.map((characterId) => {
      const actor = result.actors.find((entry) => entry.instanceId === "a_" + characterId);
      return [characterId, actor ? actor.hp : 0];
    }));
    run = {
      ...run,
      currentHp: [4, 8].includes(index)
        ? Object.fromEntries(run.roster.map((id) => [id, characterStats(profile, id).stats.maxHp]))
        : endingHp,
    };
    if (index >= ENCOUNTERS_PER_RUN) break;
    // 報酬は毎回「装備を拾う」で固定する。技能点の使い方まで真似はしない。
    const offer = rewardOffer(run, profile, index, 0).find((entry) => entry.type === "equipment");
    if (!offer) continue;
    if (offer.generated) {
      const taken = takeGeneratedEquipment(run, offer.item);
      if (taken.ok) run = taken.run;
    } else {
      run = { ...run, inventory: [...run.inventory, offer.equipmentId] };
    }
    run = equipInto(run, offer.equipmentId);
  }
  return { reach, undecided };
}

const VARIANTS = 120;
const report = [];
for (const stage of CAMPAIGN_STAGES) {
  const starter = playStage(stage.sequence, null);
  let best = { reach: starter.reach, variant: null };
  const undecided = [...starter.undecided];
  for (let variant = 0; variant < VARIANTS; variant += 1) {
    const run = playStage(stage.sequence, variant);
    undecided.push(...run.undecided);
    if (run.reach > best.reach) best = { reach: run.reach, variant };
    if (best.reach >= ENCOUNTERS_PER_RUN) break;
  }
  report.push({ stage: stage.id, party: stage.partySize, starter: starter.reach, best: best.reach, variant: best.variant });

  if (best.reach < ENCOUNTERS_PER_RUN) {
    problems.push(`${stage.id}（${stage.partySize}人）: ${VARIANTS} 通りの build で最良 ${best.reach} / ${ENCOUNTERS_PER_RUN} 戦。`
      + "この Stage を通せる build が見つからない");
  }
  if (undecided.length) {
    problems.push(`${stage.id}: 決着しない戦闘がある — ${[...new Set(undecided)].join(", ")}`);
  }
  // 素の初期構成で12戦通ってしまうなら、組む意味が無い。
  if (starter.reach >= ENCOUNTERS_PER_RUN) {
    problems.push(`${stage.id}: 素の初期構成のまま12戦通せる（組み替える意味が無い）`);
  }
}

// **参照点。**この検査が本当に鳴るのかを、ここで確かめる。
{
  const impossible = playStage(0, null);
  if (impossible.reach >= ENCOUNTERS_PER_RUN) {
    console.error("ecology-campaign smoke: 参照点が壊れている（素の初期構成が12戦通ってしまう）。");
    process.exit(1);
  }
}

for (const row of report) {
  console.log(`  ${row.stage}（${row.party}人）: 初期構成 ${row.starter} 戦 → 最良 ${row.best} 戦`
    + (row.variant === null ? "" : `（build 変種 #${row.variant}）`));
}

if (problems.length) {
  console.error("ecology-campaign smoke:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`ecology-campaign smoke: Stage 0〜3 のいずれも、${ENCOUNTERS_PER_RUN}戦を通せる build がある`);
