// **装備の生成処理が「形として正しい」だけでなく「実際に鳴る」かを見る診断。**
// R8 §3.5 / §13.2 / Implementation Phase 4 step 2。
//
// ecology/phase-c.test.mjs は契約（決定性・budget・完結 rule）を見る。ここは
// その先の問いを見る:
//
//   1. Stage 0〜3 の pool で、全 rarity が 50 attempt 以内に作れるか。
//   2. 生成した品を実際の戦闘へ着けたとき、**一度も発火し得ない trigger** が
//      残っていないか（構造上は正しいのに、盤面では絶対に起きない形）。
//   3. 報酬候補が同じ払い先ばかりに寄っていないか（R8 §13.2「報酬3候補が
//      全て同じroleにならない」）。
//
// **fun の証明ではない。**「拾っても何も起きない品」を作っていないことだけを見る。

import { simulateBattle } from "../ecology/engine.mjs";
import { validateBattleInput } from "../ecology/validate.mjs";
import { PLAYABLE_CONTENT } from "../ecology/content/index.mjs";
import { AFFIX_BY_ID, RARITIES } from "../ecology/content/affixes.mjs";
import { generateEquipment } from "../ecology/equipment-gen.mjs";
import { composeEncounter, newProfile, newRun, rewardOffer, runContentBundle } from "../ecology/progression.mjs";
import { freshLoadout, makeExpeditionBattle } from "../ecology/playable-battles.mjs";

const problems = [];
const ROSTER = ["warden", "mender", "lancer", "guardian", "tactician"];
const STAGE_POOLS = [
  ["family_care", "family_scar"],
  ["family_edge", "family_care", "family_scar"],
  ["family_edge", "family_wall", "family_care", "family_scar"],
  ["family_edge", "family_wall", "family_tempo", "family_care", "family_scar"],
];
// issue #173 — 遠征の実戦（EXPEDITION_ENCOUNTERS）から幕をまたいで拾う。
// 序盤2体・中盤elite・最終bossで盤面の形（人数・役割・boss law）が変わる。
const PROBE_ENCOUNTER_INDICES = [1, 7, 12];

// ---- 1. Stage の pool で全 rarity が作れる ---------------------------------

let equipmentCount = 0;
const items = [];
for (const [stage, familyIds] of STAGE_POOLS.entries()) {
  for (const rarity of RARITIES) {
    for (let dropIndex = 0; dropIndex < 12; dropIndex += 1) {
      try {
        const item = generateEquipment({ seed: "smoke-" + stage, dropIndex, rarity, familyIds });
        items.push(item);
        equipmentCount += 1;
        for (const rule of item.definition.rules) {
          const repair = rule.effects.some((effect) => effect.type === "repair_equipment");
          const wear = rule.costs.filter((cost) => cost.type === "wear_equipment");
          if (!repair && wear.length !== 1) {
            problems.push(`stage ${stage} / ${rarity} / drop ${dropIndex}: 耐久コストが一つではない`);
          }
          if (repair && (wear.length || !rule.costs.some((cost) =>
            ["lose_hp", "consume_barrier"].includes(cost.type)))) {
            problems.push(`stage ${stage} / ${rarity} / drop ${dropIndex}: 修理の有限コストが不正`);
          }
        }
      } catch (error) {
        problems.push(`stage ${stage} / ${rarity} / drop ${dropIndex}: ${error.message}`);
      }
    }
  }
}

// ---- 2. trigger ごとの発火可能性 --------------------------------------------
//
// 5人 × 3区画の実戦へ一品ずつ着け、rule が一度でも解決したかを数える。
// **一度も鳴らなかった trigger があれば、それは盤面に存在しない出来事を
// 読んでいる**ので、名前を出す。

const firedBySource = new Map();
const seenBySource = new Map();
// **trigger ごとに拾う。**「n 個おき」で間引くと、どの trigger が標本から
// 漏れるかが affix 目録の変化で揺れて、「鳴らなかった」のか「試されなかった」
// のかが分からなくなる（issue #255 で目録が増えたとき実際にそうなった）。
// trigger ごとに上限を決めて拾えば、全 trigger が必ず盤面へ出る。
const PROBES_PER_SOURCE = 4;
const probeQuota = new Map();
const probeItems = items.filter((item) => {
  const sources = item.provenance.affixIds.filter((id) => AFFIX_BY_ID[id]?.role === "source");
  if (!sources.some((id) => (probeQuota.get(id) ?? 0) < PROBES_PER_SOURCE)) return false;
  for (const id of sources) probeQuota.set(id, (probeQuota.get(id) ?? 0) + 1);
  return true;
});
for (const item of probeItems) {
  const sources = item.provenance.affixIds.filter((id) => AFFIX_BY_ID[id]?.role === "source");
  for (const id of sources) seenBySource.set(id, (seenBySource.get(id) ?? 0) + 1);
  const bundle = {
    ...PLAYABLE_CONTENT,
    equipment: { ...PLAYABLE_CONTENT.equipment, [item.definition.id]: item.definition },
  };
  const ruleIds = new Set(item.definition.rules.map((rule) => rule.id));
  for (const index of PROBE_ENCOUNTER_INDICES) {
    const composed = composeEncounter(index, 0);
    for (let slot = 0; slot < 5; slot += 1) {
      const battle = makeExpeditionBattle(composed, ROSTER, freshLoadout(ROSTER));
      battle.allies[slot].equipment = [{
        instanceId: "e_probe",
        equipmentId: item.definition.id,
        durability: item.definition.maxDurability,
      }];
      if (validateBattleInput(battle, bundle).length) continue;
      const result = simulateBattle(battle, bundle, { equipmentBreaks: false });
      const rang = result.events.some((event) => ruleIds.has(event.sourceRuleId)
        || event.sourceDefinitionId === item.definition.id);
      if (!rang) continue;
      for (const id of sources) firedBySource.set(id, (firedBySource.get(id) ?? 0) + 1);
    }
  }
}
for (const [sourceId, seen] of seenBySource) {
  if ((firedBySource.get(sourceId) ?? 0) === 0) {
    problems.push(`trigger "${sourceId}" は ${seen} 品で一度も鳴らなかった（盤面に無い出来事を読んでいる可能性）`);
  }
}

// ---- 3. 報酬候補の払い先が同じ役割へ寄らない --------------------------------

const profile = newProfile();
let invalidRewardOffers = 0;
let offersChecked = 0;
for (let sequence = 0; sequence <= 3; sequence += 1) {
  const run = newRun(profile, {
    runSeed: "spread-" + sequence, runId: "spread-" + sequence, roster: ROSTER,
    campaignStageSequence: sequence,
  });
  for (let index = 1; index <= 11; index += 1) {
    const offers = rewardOffer(run, profile, index, 0);
    const equipmentCount = offers.filter((offer) => offer.type === "equipment").length;
    const suppliesCount = offers.filter((offer) => offer.type === "supplies").length;
    offersChecked += 1;
    // issue #255 — 候補は装備だけ。補給は遠征開始時に固定されるので混ざらない。
    if (offers.length !== 2 || equipmentCount !== 2 || suppliesCount !== 0) {
      invalidRewardOffers += 1;
    }
    for (const offer of offers) {
      if (offer.type !== "equipment") continue;
      if (!offer.generated || !offer.item) {
        problems.push("報酬の装備に遠征ごとの定義が無い（" + offer.equipmentId + "）");
      } else if (!offer.item.readout.lines.length) {
        problems.push("報酬の装備に説明文が無い（" + offer.equipmentId + "）");
      }
    }
    if (offers.some((offer) => offer.type === "generator_error")) {
      problems.push(`stage ${sequence} 第${index}戦の報酬で生成に失敗した`);
    }
  }
}
if (invalidRewardOffers > 0) problems.push(`報酬候補の構成が想定外だった回が ${invalidRewardOffers} / ${offersChecked}`);

// ---- 4. 参照点。**この検査が本当に鳴るのかを確かめる。** ---------------------
{
  let threw = false;
  try {
    generateEquipment({ seed: "impossible", dropIndex: 0, rarity: "legendary", familyIds: ["family_unknown"] });
  } catch {
    threw = true;
  }
  if (!threw) {
    console.error("ecology-equipment-gen smoke: 参照点が壊れている"
      + "（作れないはずの pool から品が返った）。");
    process.exit(1);
  }
}

if (problems.length) {
  console.error("ecology-equipment-gen smoke:\n  " + problems.join("\n  "));
  process.exit(1);
}

console.log("ecology-equipment-gen smoke: "
  + JSON.stringify({
    equipment: equipmentCount,
    triggers: seenBySource.size,
    rewardOffers: offersChecked,
  }));

