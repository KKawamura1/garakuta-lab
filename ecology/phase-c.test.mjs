// ecology/phase-c.test.mjs — R8 Implementation Phase 4（Phase C: 装備と Blueprint）。
//
// **見るのは generator 契約と archive 契約であり、fun ではない。**
//   - 決定性（R8 §3.5）: 同じ seed / dropIndex / rarity / family から同じ品が出る。
//   - 完結 rule（R8 §3.5）: 生成物は content 契約を通り、発火不能・無料無限循環・
//     dead condition を持たない。
//   - power budget（R8 §3.5）: rarity ごとの rule 数・affix 数・予算に収まる。
//   - 診断 error（R8 §3.5）: 50 attempt で作れないときに既定品へ黙って落ちない。
//   - Blueprint（R8 §3.6）: immutable、上限なし archive、持込枠 1〜5、exact 再製造、
//     互換不能でも消さず disabledReason を出す。
//   - 保存件数（R8 §10.3）: 勝利2 / 安全撤退2 / 敗北1。
//   - 遠征経路（R8 §13.2）: 装備が preview と正式実行の両方へ同じ形で入る。

import assert from "node:assert/strict";
import { validateBattleInput, validateContentBundle } from "./validate.mjs";
import { simulateBattle } from "./engine.mjs";
import { PLAYABLE_CONTENT } from "./content/index.mjs";
import {
  AFFIXES,
  AFFIX_BY_ID,
  AFFIX_FAMILY_IDS,
  AFFIX_ROLES,
  EQUIPMENT_IMPLICITS,
  RARITIES,
  RARITY_BUDGET,
} from "./content/affixes.mjs";
import {
  EquipmentGenerationError,
  GENERATOR_VERSION,
  generateEquipment,
} from "./equipment-gen.mjs";
import {
  BLUEPRINT_MAX_CAPACITY,
  BLUEPRINT_SAVE_LIMIT,
  blueprintCompatibility,
  carryCapacity,
  manufactureCarried,
  newArchive,
  normalizeArchive,
  saveBlueprint,
  searchBlueprints,
  setCarrySelection,
  toggleFavorite,
} from "./blueprints.mjs";
import {
  appraisalLevel,
  blueprintCarryCapacity,
  dismantle,
  newProfile,
  newRun,
  purchaseUpgrade,
  rewardOffer,
  runContentBundle,
  settleRun,
  takeGeneratedEquipment,
} from "./progression.mjs";
import {
  equipEquipment,
  freshLoadout,
  makeExpeditionBattle,
  registerGeneratedEquipment,
  componentInfo,
  simulateNextBattle,
} from "./playable-battles.mjs";

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message);
  checks += 1;
};

const ROSTER = ["warden", "mender", "lancer", "guardian", "tactician"];
const EFFECT_FLOOR = Object.freeze({
  common: "common",
  rare: "common",
  epic: "rare",
  legendary: "epic",
  mythic: "legendary",
  oopart: "mythic",
});

// ---- affix 目録の形（R8 §3.5, §13.2）----------------------------------------

{
  const ids = AFFIXES.map((affix) => affix.id);
  equal(new Set(ids).size, ids.length, "affix id は重複しない");
  for (const affix of AFFIXES) {
    check(AFFIX_ROLES.includes(affix.role), `${affix.id} の role が語彙内`);
    check(typeof affix.familyId === "string" && affix.familyId.length > 0, `${affix.id} が family を持つ`);
    check(typeof affix.displayName === "string" && affix.displayName.length > 0, `${affix.id} が表示名を持つ`);
    check(Number.isInteger(affix.power), `${affix.id} の power が整数`);
  }
  // source は予算を取らない（trigger は強さではない）。
  for (const affix of AFFIXES.filter((entry) => entry.role === "source")) {
    equal(affix.power, 0, `${affix.id}（trigger）は power を取らない`);
  }
  // payoff の requires は、いずれかの source が実際に提供している。
  const allProvides = new Set(AFFIXES.filter((a) => a.role === "source").flatMap((a) => a.provides ?? []));
  for (const affix of AFFIXES.filter((entry) => entry.role === "payoff")) {
    for (const tag of affix.requires ?? []) {
      check(allProvides.has(tag), `payoff ${affix.id} が要求する "${tag}" を出す trigger がある`);
    }
  }
  check(AFFIXES.filter((entry) => entry.role === "source").length >= 15,
    "装備 trigger は15種類以上ある");
  check(AFFIXES.filter((entry) => entry.role === "payoff").length >= 25,
    "装備 payoff は25種類以上ある");
  equal(EQUIPMENT_IMPLICITS.length, 4, "無条件基礎効果は4能力から選ぶ");
}

// ---- 決定性（R8 §3.5, §3.9）-------------------------------------------------

{
  const a = generateEquipment({ seed: "det", dropIndex: 7, rarity: "epic" });
  const b = generateEquipment({ seed: "det", dropIndex: 7, rarity: "epic" });
  assert.deepEqual(a.definition, b.definition, "同じ入力から同じ定義");
  equal(a.descriptor, b.descriptor, "同じ入力から同じ descriptor");
  checks += 1;

  const other = generateEquipment({ seed: "det", dropIndex: 8, rarity: "epic" });
  check(other.descriptor !== a.descriptor, "dropIndex を変えると別の品になる");

  const otherSeed = generateEquipment({ seed: "det2", dropIndex: 7, rarity: "epic" });
  check(otherSeed.descriptor !== a.descriptor, "seed を変えると別の品になる");

  equal(a.provenance.generatorVersion, GENERATOR_VERSION, "generator 版を来歴に残す");
  equal(a.provenance.seed, "det", "seed を来歴に残す");
  equal(a.provenance.dropIndex, 7, "drop index を来歴に残す");
  check(Array.isArray(a.provenance.resolvedParameters.rules), "resolved parameter を来歴に残す");
  // 来歴は品の同一性に入らない。**同じ品を別の遠征で拾っても同じ descriptor。**
  const elsewhere = generateEquipment({
    seed: "det", dropIndex: 7, rarity: "epic", origin: { runId: "other" },
  });
  equal(elsewhere.descriptor, a.descriptor, "origin は descriptor を動かさない");
}

// ---- 完結 rule と budget（R8 §3.5）------------------------------------------

{
  const seen = new Set();
  let generated = 0;
  for (const rarity of RARITIES) {
    const spec = RARITY_BUDGET[rarity];
    for (let dropIndex = 0; dropIndex < 40; dropIndex += 1) {
      const item = generateEquipment({ seed: "budget", dropIndex, rarity });
      generated += 1;
      seen.add(item.descriptor);
      const definition = item.definition;

      // 生成物単体が content 契約を通る。
      const errors = validateContentBundle({
        ...PLAYABLE_CONTENT, equipment: { [definition.id]: definition },
      }).filter((error) => error.path.startsWith("equipment."));
      assert.deepEqual(errors, [], `${rarity}#${dropIndex} が content 契約を通る`);

      check(definition.rules.length >= spec.rules[0] && definition.rules.length <= spec.rules[1],
        `${rarity} の rule 数が範囲内`);
      check(definition.maxDurability >= 1, `${rarity} の耐久が1以上`);
      const [implicit, ...additionalEffects] = item.readout?.effects ?? [];
      equal(implicit?.slot, "implicit", `${rarity} の先頭は無条件基礎効果`);
      equal(implicit?.rarity, rarity, `${rarity} の基礎効果は item と同格`);
      equal(implicit?.unconditional, true, `${rarity} の基礎効果は無条件`);
      const statBonus = Object.entries(definition.statBonus ?? {});
      equal(statBonus.length, 1, `${rarity} は常時能力をちょうど一つ持つ`);
      check(Number.isInteger(statBonus[0]?.[1]) && statBonus[0][1] > 0,
        `${rarity} の常時能力は正の整数`);
      equal(implicit?.amount, statBonus[0]?.[1], `${rarity} の表示値と戦闘値が一致する`);
      check(additionalEffects.some((effect) => effect.rarity === rarity),
        `${rarity} は追加効果にも少なくとも1つ同じ等級を持つ`);
      const floorIndex = RARITIES.indexOf(EFFECT_FLOOR[rarity]);
      check(additionalEffects.every((effect) => RARITIES.indexOf(effect.rarity) >= floorIndex),
        `${rarity} の追加効果は品質下限 ${EFFECT_FLOOR[rarity]} 以上`);

      const affixIds = item.provenance.affixIds;
      const counted = affixIds.filter((id) => AFFIX_BY_ID[id]?.role !== "source").length;
      check(counted >= spec.affixes[0] && counted <= spec.affixes[1],
        `${rarity} の affix 数 ${counted} が [${spec.affixes[0]}, ${spec.affixes[1]}]`);

      const power = affixIds.reduce((total, id) => total + (AFFIX_BY_ID[id]?.power ?? 0), 0);
      check(power <= spec.power + 4,
        `${rarity} の affix 素の power ${power} が budget ${spec.power} から離れすぎない`);

      // keystone は legendary 以上の等級だけ、最大1つ。
      const keystones = affixIds.filter((id) => AFFIX_BY_ID[id]?.role === "keystone");
      check(keystones.length <= spec.keystones, `${rarity} の keystone 数 ${keystones.length}`);
      if (rarity === "oopart") equal(keystones.length, 1, "オーパーツは keystone を必ず持つ");
      const conditions = affixIds.filter((id) => AFFIX_BY_ID[id]?.role === "converter");
      check(conditions.length <= definition.rules.length, "追加 condition は1 ruleにつき最大1つ");

      for (const rule of definition.rules) {
        check(rule.effects.length >= 1 && rule.effects.length <= 4, "各 rule は payoff effect を1〜3＋keystone bonus まで持つ");
        check(rule.costs.length <= 1, "各 rule の cost は 0〜1");
        check(rule.limit.count >= 1, "各 rule は1回以上発火できる");
        // 無料無限循環を作らない。
        const gains = rule.effects.filter((effect) =>
          effect.type === "gain_resource" || effect.type === "heal" || effect.type === "repair_equipment");
        if (gains.length) check(rule.costs.length === 1, "資源・HP・耐久を戻す rule は代償を持つ");
        // heal は被弾 chain の中でだけ（anti-stall）。
        if (rule.effects.some((effect) => effect.type === "heal")) {
          equal(rule.listenTo, "damage_taken", "heal は被弾に反応する");
          equal(rule.limit.scope, "chain", "heal は chain 単位");
          equal(rule.limit.count, 1, "heal は同じ被弾へ一度だけ");
        }
        // 耐久で払えない摩耗コストを書かない。
        for (const cost of rule.costs) {
          if (cost.type !== "wear_equipment") continue;
          check(cost.amount <= definition.maxDurability, "摩耗コストは耐久以下");
        }
      }
    }
  }
  check(seen.size > generated / 2, `生成物が十分に散らばる（${seen.size}/${generated}）`);
}

// ---- 低レアの規格外品（強い効果と重い代償）----------------------------------

{
  let riskyItems = 0;
  for (const rarity of ["common", "rare"]) {
    const itemRank = RARITIES.indexOf(rarity);
    for (let dropIndex = 0; dropIndex < 300; dropIndex += 1) {
      const item = generateEquipment({ seed: "risky-outlier", dropIndex, rarity });
      const overRank = item.readout.effects.slice(1)
        .some((effect) => RARITIES.indexOf(effect.rarity) > itemRank);
      if (!overRank) continue;
      riskyItems += 1;
      check(typeof item.readout.risk === "string" && item.readout.risk.length > 0,
        "格上効果には画面へ出る重い代償がある");
      check(item.definition.rules.some((rule) => rule.costs.some((cost) =>
        (cost.type === "wear_equipment" && cost.amount >= 2)
        || (cost.type === "lose_hp" && cost.amount >= 15))),
      "規格外品は耐久2またはHP15の重い代償を実際に払う");
    }
  }
  check(riskyItems >= 10, `低レアにまれな規格外品が生成される（600件中${riskyItems}件）`);
}

// ---- 診断 error（R8 §3.5）---------------------------------------------------

{
  // 未知の family しかない pool では trigger も effect も無く、rule を閉じられない。
  // **既定品へ黙って落ちず、error を投げる**ことをここで確かめる。
  let thrown = null;
  try {
    generateEquipment({ seed: "impossible", dropIndex: 0, rarity: "common", familyIds: ["family_unknown"] });
  } catch (error) {
    thrown = error;
  }
  check(thrown instanceof EquipmentGenerationError, "作れないときは診断 error を投げる");
  check(String(thrown.message).includes("attempt"), "何回試したかを message に残す");
  check(Array.isArray(thrown.diagnostics.attempts) && thrown.diagnostics.attempts.length > 0,
    "失敗した attempt の理由を残す");

  // 実際に遊ぶ pool（Stage 0〜3 の manifest）では全 rarity が作れる。
  const stagePools = [
    ["family_care", "family_scar"],
    ["family_edge", "family_care", "family_scar"],
    ["family_edge", "family_wall", "family_care", "family_scar"],
    ["family_edge", "family_wall", "family_tempo", "family_care", "family_scar"],
  ];
  for (const familyIds of stagePools) {
    for (const rarity of RARITIES) {
      const item = generateEquipment({ seed: "pool", dropIndex: 3, rarity, familyIds });
      check(item.definition.rules.length >= 1, `${familyIds.length}family × ${rarity} が生成できる`);
    }
  }
}

// ---- 装備が戦闘へ入る（R8 §13.2）--------------------------------------------

{
  const item = generateEquipment({ seed: "battle", dropIndex: 2, rarity: "rare" });
  const run = {
    generatedEquipment: { [item.definition.id]: item },
  };
  const bundle = runContentBundle(run);
  check(Boolean(bundle.equipment[item.definition.id]), "run の content bundle が装備を持つ");
  check(!PLAYABLE_CONTENT.equipment[item.definition.id], "固定 content 側は汚れていない");

  const loadout = freshLoadout(ROSTER);
  loadout.equipment.warden = [item.definition.id];
  const battle = makeExpeditionBattle(
    { index: 1, maxRounds: 8, enemies: [
      { instanceId: "e1", enemyActorId: "husk", position: "front_left", stats: {}, mutations: [] },
    ] },
    ROSTER, loadout, "seed", {}, { content: bundle },
  );
  assert.deepEqual(validateBattleInput(battle, bundle), [], "装備入りの BattleInput が通る");
  checks += 1;
  const worn = battle.allies.find((ally) => ally.characterId === "warden").equipment;
  equal(worn.length, 1, "装備が装備欄へ入る");
  equal(worn[0].durability, item.definition.maxDurability, "耐久は定義どおりに始まる");

  const first = simulateBattle(battle, bundle);
  const again = simulateBattle(battle, bundle);
  assert.deepEqual(first.events, again.events, "装備を入れても戦闘は決定的");
  checks += 1;
  const actor = first.actors.find((entry) => entry.definitionId === "warden");
  const [bonusStat, bonusAmount] = Object.entries(item.definition.statBonus)[0];
  const actorStat = { max_hp: "maxHp", might: "might", focus: "focus", guard: "guard" }[bonusStat];
  const baseStat = PLAYABLE_CONTENT.characters.warden[actorStat];
  equal(actor[actorStat], baseStat + bonusAmount, "装備の無条件基礎効果が戦闘 actor へ加算される");

  const brokenBattle = structuredClone(battle);
  brokenBattle.allies.find((entry) => entry.characterId === "warden").equipment[0].durability = 0;
  const brokenActor = simulateBattle(brokenBattle, bundle).actors
    .find((entry) => entry.definitionId === "warden");
  equal(brokenActor[actorStat], baseStat, "壊れた装備は無条件基礎効果も停止する");

  const invalidDefinition = { ...item.definition, statBonus: { action_points: 1 } };
  const invalidErrors = validateContentBundle({
    ...PLAYABLE_CONTENT, equipment: { [invalidDefinition.id]: invalidDefinition },
  });
  check(invalidErrors.some((error) => error.code === "unknown_equipment_stat"),
    "装備でAPなど未許可の常時能力は作れない");

  // **固定 content だけでは同じ入力が通らない。**bundle を渡し忘れると落ちる、が
  // 黙って落ちないことを確かめる（装備が無かったことにされない）。
  const missing = validateBattleInput(battle, PLAYABLE_CONTENT);
  check(missing.some((error) => error.code === "dangling_reference"),
    "装備を知らない content では dangling_reference になる（黙って落ちない）");
}

// ---- 装備画面の metadata（生成品も装着できる）--------------------------------

{
  const item = generateEquipment({ seed: "ui", dropIndex: 4, rarity: "rare" });
  registerGeneratedEquipment({});
  equal(componentInfo(item.definition.id), null, "登録前は未知の部材");
  registerGeneratedEquipment({ [item.definition.id]: item });
  const info = componentInfo(item.definition.id);
  check(Boolean(info) && info.kind === "equipment", "登録後は装備として引ける");
  equal(info.label, item.definition.displayName, "表示名は定義のもの");
  check(info.generated === true, "内部の由来情報を持つ");

  const equipped = equipEquipment(freshLoadout(ROSTER), "warden", item.definition.id, 0);
  check(equipped.ok, "生成品を装備枠へ入れられる");
  check(equipped.loadout.equipment.warden.includes(item.definition.id), "装備欄に入る");
  registerGeneratedEquipment({});
  equal(componentInfo(item.definition.id), null, "遠征が変わると前の品は残らない");
}

// ---- 報酬（R8 §13.2）--------------------------------------------------------

{
  const profile = newProfile();
  const run = newRun(profile, { runSeed: "rw", runId: "rw", roster: ROSTER, campaignStageSequence: 3 });
  const offer = rewardOffer(run, profile, 1, 0);
  equal(offer.length, 3, "候補は3件");
  const equipmentOffers = offer.filter((entry) => entry.type === "equipment");
  equal(equipmentOffers.length, 2, "装備候補は2件");
  equal(equipmentOffers.filter((entry) => entry.generated).length, 2, "装備候補はすべて手続き生成品");
  check(equipmentOffers.every((entry) => Array.isArray(entry.item?.readout?.lines)
    && entry.item.readout.lines.length >= 1),
  "装備は最初から全 rule を読める（R8 §11 の完全開示と衝突させない）");
  assert.deepEqual(rewardOffer(run, profile, 1, 0), offer, "同じ鍵なら同じ候補");
  checks += 1;
  const rerolled = rewardOffer(run, profile, 1, 1);
  check(JSON.stringify(rerolled) !== JSON.stringify(offer), "引き直すと候補が変わる");

  // 目利きは等級の引きを良くする。**情報は隠さない。**
  let rich = { ...newProfile(), activityFunds: "10000000" };
  for (let level = 0; level < 5; level += 1) {
    const bought = purchaseUpgrade(rich, "appraisal");
    check(bought.ok, `目利き level ${level + 1} を買える`);
    rich = bought.profile;
  }
  equal(appraisalLevel(rich), 5, "目利きは5段まで");
  equal(purchaseUpgrade(rich, "appraisal").ok, false, "6段目は無い");
  const rank = Object.fromEntries(RARITIES.map((rarity, index) => [rarity, index]));
  let plain = 0;
  let appraised = 0;
  for (let index = 1; index <= 12; index += 1) {
    const base = rewardOffer(run, newProfile(), index, 0).find((entry) => entry.generated);
    const better = rewardOffer(run, rich, index, 0).find((entry) => entry.generated);
    plain += rank[base.item.rarity];
    appraised += rank[better.item.rarity];
  }
  check(appraised > plain, `目利きが等級を押し上げる（${plain} → ${appraised}）`);
}

// ---- 持ち物への出入り -------------------------------------------------------

{
  const profile = newProfile();
  let run = newRun(profile, { runSeed: "inv", runId: "inv", roster: ROSTER, campaignStageSequence: 0 });
  const item = rewardOffer(run, profile, 1, 0).find((entry) => entry.generated).item;
  const taken = takeGeneratedEquipment(run, item);
  check(taken.ok, "装備を拾える");
  run = taken.run;
  check(run.inventory.includes(item.definition.id), "持ち物へ入る");
  check(Boolean(run.generatedEquipment[item.definition.id]), "定義も run が抱える");
  equal(takeGeneratedEquipment(run, item).ok, false, "同じ品は二度拾えない");

  const scrapped = dismantle(run, item.definition.id);
  check(scrapped.ok, "装備も分解できる");
  check(!scrapped.run.inventory.includes(item.definition.id), "持ち物から消える");
  check(!scrapped.run.generatedEquipment[item.definition.id], "定義も落として save を太らせない");
}

// ---- Blueprint archive（R8 §3.6）--------------------------------------------

{
  const item = generateEquipment({ seed: "bp", dropIndex: 1, rarity: "epic" });
  const first = saveBlueprint(newArchive(), item, { runId: "r1", outcome: "won" });
  check(first.added, "初回は新しい entry");
  equal(first.archive.entries.length, 1, "1件になる");
  const second = saveBlueprint(first.archive, item, { runId: "r2", outcome: "won" });
  check(!second.added, "同じ descriptor は重複品にしない");
  equal(second.archive.entries.length, 1, "件数は増えない");
  equal(second.archive.entries[0].acquisitions.length, 2, "取得履歴だけが増える");
  equal(second.blueprintId, first.blueprintId, "同じ品は同じ blueprintId");

  // immutable — 保存後に定義を触っても archive は変わらない。
  const before = JSON.stringify(second.archive.entries[0].definition);
  item.definition.displayName = "書き換え";
  equal(JSON.stringify(second.archive.entries[0].definition), before, "archive の定義は後から動かない");

  // archive 自体に所持上限は無い。
  let archive = second.archive;
  for (let index = 0; index < 30; index += 1) {
    archive = saveBlueprint(archive, generateEquipment({ seed: "many", dropIndex: index }), {}).archive;
  }
  check(archive.entries.length > 20, `archive に上限が無い（${archive.entries.length}件）`);

  // 検索と favorite。
  const favorited = toggleFavorite(archive, first.blueprintId);
  equal(searchBlueprints(favorited, { favorite: true }).length, 1, "favorite で絞れる");
  equal(searchBlueprints(favorited)[0].blueprintId, first.blueprintId, "favorite が先頭へ来る");
  const rareOnly = searchBlueprints(archive, { rarity: "legendary" });
  check(rareOnly.every((entry) => entry.rarity === "legendary"), "rarity で絞れる");
  assert.deepEqual(
    searchBlueprints(archive).map((entry) => entry.blueprintId),
    searchBlueprints(archive).map((entry) => entry.blueprintId),
    "並びは取得順に依らず決定的",
  );
  checks += 1;

  // 保存し直しても読める。
  const round = normalizeArchive(JSON.parse(JSON.stringify(favorited)));
  equal(round.entries.length, favorited.entries.length, "保存 → 読み込みで件数が保たれる");
  check(round.entries.some((entry) => entry.favorite), "favorite も保たれる");
}

// ---- 持込枠（R8 §3.6, §3.7）-------------------------------------------------

{
  equal(carryCapacity(0), 1, "初期の持込枠は1");
  equal(carryCapacity(4), 5, "4段買うと5");
  equal(carryCapacity(9), BLUEPRINT_MAX_CAPACITY, "上限を超えない");

  let profile = { ...newProfile(), activityFunds: "10000000" };
  equal(blueprintCarryCapacity(profile), 1, "買う前は1件");
  for (let level = 0; level < 4; level += 1) {
    const bought = purchaseUpgrade(profile, "blueprint_capacity");
    check(bought.ok, `持込枠 ${level + 2} を買える`);
    profile = bought.profile;
  }
  equal(blueprintCarryCapacity(profile), 5, "4段で5件");
  equal(purchaseUpgrade(profile, "blueprint_capacity").ok, false, "5段目は無い");

  let archive = newArchive();
  const items = [0, 1, 2].map((index) => generateEquipment({ seed: "carry", dropIndex: index, rarity: "rare" }));
  const ids = [];
  for (const item of items) {
    const saved = saveBlueprint(archive, item, {});
    archive = saved.archive;
    ids.push(saved.blueprintId);
  }
  const narrow = setCarrySelection(archive, ids, 1);
  equal(narrow.carrySelection.length, 1, "枠1なら1件へ丸める");
  const wide = setCarrySelection(archive, ids, 5);
  equal(wide.carrySelection.length, 3, "枠が足りれば全部持ち込める");

  const made = manufactureCarried(wide, 5);
  equal(made.length, 3, "持込枠のぶんだけ再製造する");
  assert.deepEqual(
    made.map((entry) => entry.definition),
    items.map((entry) => entry.definition),
    "再製造は exact copy（seed から作り直さない）",
  );
  checks += 1;
  check(made.every((entry) => entry.carried === true), "持込品だと分かる印がある");
  check(made.every((entry) => entry.provenance.carriedFromBlueprintId), "どの Blueprint から来たか残る");
}

// ---- 互換不能な Blueprint（R8 §3.6）----------------------------------------

{
  const item = generateEquipment({ seed: "stale", dropIndex: 0, rarity: "rare" });
  const archive = saveBlueprint(newArchive(), item, {}).archive;
  equal(blueprintCompatibility(archive.entries[0]).ok, true, "現行 content で作れる品は有効");

  // 現行 content に無い status を読む古い品を模す。
  const broken = structuredClone(archive.entries[0]);
  broken.definition.rules[0].effects = [
    { type: "add_status", target: { scope: "self", take: 1 }, statusId: "retired_status", stacks: 1 },
  ];
  broken.provenance.generatorVersion = "ecology-equipment-gen-0";
  const verdict = blueprintCompatibility(broken);
  equal(verdict.ok, false, "互換不能な品は無効になる");
  check(typeof verdict.disabledReason === "string" && verdict.disabledReason.length > 0,
    "理由が付く（黙って消さない）");
  check(verdict.disabledReason.includes("ecology-equipment-gen-0"), "古い generator 版を理由に含む");

  // 無効な品は持込枠を埋めない。
  const withBroken = { ...archive, entries: [...archive.entries, broken] };
  const selected = setCarrySelection(withBroken, [broken.blueprintId, archive.entries[0].blueprintId], 2);
  assert.deepEqual(selected.carrySelection, [archive.entries[0].blueprintId],
    "無効な Blueprint は持込選択から外れる");
  checks += 1;
  check(withBroken.entries.length === 2, "archive からは消さない");
}

// ---- 遠征終了時の保存件数（R8 §10.3）----------------------------------------

{
  const outcomes = [["won", 2], ["retreat", 2], ["lost", 1]];
  for (const [outcome, limit] of outcomes) {
    equal(BLUEPRINT_SAVE_LIMIT[outcome], limit, `${outcome} の保存上限は ${limit}`);
    const profile = newProfile();
    let run = newRun(profile, { runSeed: "set-" + outcome, runId: "set-" + outcome, roster: ROSTER, campaignStageSequence: 3 });
    for (let index = 1; index <= 4; index += 1) {
      const found = rewardOffer(run, profile, index, 0).find((entry) => entry.generated);
      const taken = takeGeneratedEquipment(run, found.item);
      if (taken.ok) run = taken.run;
    }
    check(Object.keys(run.generatedEquipment).length >= 3, "遠征中に3品以上見つけてある");
    const settled = settleRun(profile, run, outcome);
    check(settled.ok, `${outcome} で精算できる`);
    equal(settled.settlement.savedBlueprints.length, limit, `${outcome} は ${limit} 件だけ残る`);
    equal(settled.profile.blueprints.entries.length, limit, `archive も ${limit} 件`);
    // 良い等級から残す（取得順ではない）。
    const rank = Object.fromEntries(RARITIES.map((rarity, index) => [rarity, RARITIES.length - 1 - index]));
    const saved = settled.settlement.savedBlueprints.map((entry) => rank[entry.rarity]);
    assert.deepEqual(saved, [...saved].sort((a, b) => a - b), "等級の高い順に残す");
    checks += 1;
  }
}

// ---- 持込品は manifest の family 外でも動く（R8 §3.6）------------------------

{
  let profile = newProfile();
  let run = newRun(profile, { runSeed: "cross", runId: "cross", roster: ROSTER, campaignStageSequence: 3 });
  const found = rewardOffer(run, profile, 1, 0).find((entry) => entry.generated);
  run = takeGeneratedEquipment(run, found.item).run;
  const settled = settleRun(profile, run, "won");
  profile = settled.profile;
  const blueprintId = profile.blueprints.entries[0].blueprintId;
  profile.blueprints = setCarrySelection(profile.blueprints, [blueprintId], blueprintCarryCapacity(profile));

  // Stage 0 の pool は刃と傷だけ。持込品はそこに無い family でも復活する。
  const stage0 = newRun(profile, { runSeed: "cross2", runId: "cross2", roster: ROSTER, campaignStageSequence: 0 });
  const carriedId = profile.blueprints.entries[0].definition.id;
  check(stage0.inventory.includes(carriedId), "持込品が遠征開始時の持ち物に入る");
  check(Boolean(stage0.generatedEquipment[carriedId]), "定義も一緒に来る");
  assert.deepEqual(stage0.carriedBlueprintIds, [blueprintId], "どの Blueprint から来たか run が覚える");
  checks += 1;
  const bundle = runContentBundle(stage0);
  assert.deepEqual(
    validateContentBundle(bundle).filter((error) => error.path.startsWith("equipment.")),
    [],
    "manifest 外 family の持込品でも content 契約を通る",
  );
  checks += 1;

  // 持込品は Blueprint 保存の新規候補にならない（既に archive にある）。
  const again = settleRun(profile, { ...stage0, runId: "cross3" }, "won");
  equal(again.settlement.savedBlueprints.length, 0, "持込品は保存候補に数えない");
}

// ---- preview と正式実行が同じ装備を見る（R8 §11, §13.2）---------------------

{
  const profile = newProfile();
  let run = newRun(profile, { runSeed: "pv", runId: "pv", roster: ROSTER, campaignStageSequence: 3 });
  const found = rewardOffer(run, profile, 1, 0).find((entry) => entry.generated);
  run = takeGeneratedEquipment(run, found.item).run;
  run = { ...run, loadout: freshLoadout(ROSTER) };
  const beforeRegister = equipEquipment(run.loadout, "warden", found.item.definition.id, 0);
  equal(beforeRegister.ok, false, "登録前は遠征装備を装備できない（黙って装着済みにしない）");
  registerGeneratedEquipment(run.generatedEquipment);
  const withItem = equipEquipment(run.loadout, "warden", found.item.definition.id, 0);
  check(withItem.ok, "登録後は装備できる");
  run = { ...run, loadout: withItem.loadout };

  const first = simulateNextBattle(run, profile, 1);
  const second = simulateNextBattle(run, profile, 1);
  assert.deepEqual(first.result.events, second.result.events, "装備込みの preview は決定的");
  checks += 1;
  check(Boolean(first.content.equipment[found.item.definition.id]),
    "preview の content bundle が装備を含む");
  assert.deepEqual(validateBattleInput(first.battleInput, first.content), [],
    "preview の BattleInput が通る");
  checks += 1;
  const worn = first.battleInput.allies.find((ally) => ally.characterId === "warden").equipment;
  check(worn.some((entry) => entry.equipmentId === found.item.definition.id),
    "装着した装備が BattleInput に入っている");
  registerGeneratedEquipment({});
}

// ---- affix family は manifest から決まる（R8 §13.2）------------------------

{
  const profile = newProfile();
  const stage0 = newRun(profile, { runSeed: "fam", runId: "f0", roster: ROSTER, campaignStageSequence: 0 });
  const stage3 = newRun(profile, { runSeed: "fam", runId: "f3", roster: ROSTER, campaignStageSequence: 3 });
  check(stage0.manifest.enabledAffixFamilyIds.length >= 2, "Stage 0 も family を持つ");
  check(stage3.manifest.enabledAffixFamilyIds.length > stage0.manifest.enabledAffixFamilyIds.length,
    "pack が増えると affix family も増える");
  for (const familyId of stage0.manifest.enabledAffixFamilyIds) {
    check(AFFIX_FAMILY_IDS.includes(familyId), `${familyId} は既知の family`);
  }
}

console.log(`phase-c.test.mjs: ${checks} checks passed`);

