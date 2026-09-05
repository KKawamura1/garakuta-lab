// ecology/contract-snapshot.mjs
//
// **content contract の観測点を一箇所で作る。** 検査と再生成が同じ関数を使うので、
// 「検査が見ている物」と「凍らせた物」がずれない。
//
// ここに載っているものは、R7 の hard contract として外から見える出力である。
// 中身を変えたいときは、変えてよい理由（Phase の採択、migration の用意）を
// 先に決めてから凍結ファイルを作り直すこと。**差分を見ずに更新しない。**

import {
  BOSS_LAWS,
  DIFFICULTIES,
  ENEMY_MUTATIONS,
  ENEMY_THREAT_COST,
  EXPEDITION_ENCOUNTERS,
  MAX_DIFFICULTY_RANK,
  PLAYABLE_CONTENT,
  DISPLAY_NAMES,
  REGION,
  SKILL_LEVEL_CAPS,
  SKILL_PACKS,
} from "./content/index.mjs";
import {
  META_UPGRADES,
  composeEncounter,
  makeManifest,
  newProfile,
  newRun,
  rewardOffer as expeditionRewardOffer,
} from "./progression.mjs";
import {
  CHARACTER_OPTIONS,
  COMPONENTS,
  COMPONENT_ORDER,
  EQUIPMENT,
  SKILLS,
  SKILL_TREE_NODES,
  enemyInfo,
  enemyTargetingText,
  freshLoadout,
  initialUnlockedSkills,
} from "./playable-battles.mjs";

// 現行 Phase B の参照編成。**seed と同じで、動かしたら比較の意味が消える。**
const ROSTER = ["warden", "mender", "lancer", "guardian", "tactician"];
export function contractSnapshot() {
  const loadout = freshLoadout(ROSTER);
  const enemyIds = Object.keys(PLAYABLE_CONTENT.enemyActors);

  // R7 Milestone 4（Phase B）— 遠征が外へ見せる出力。
  // **同じ入力から同じ編成・同じ manifest・同じ報酬が出ることを凍らせる**（R6 §16）。
  const profile = newProfile();
  const composed = {};
  for (const encounter of EXPEDITION_ENCOUNTERS) {
    for (let rank = 0; rank <= MAX_DIFFICULTY_RANK; rank += 1) {
      composed["e" + encounter.index + "/rank" + rank] = composeEncounter(encounter.index, rank);
    }
  }
  const manifests = Object.fromEntries(
    ["frontier-1801", "frontier-1801-abc12345", "frontier-1801-zzz"]
      .map((seed) => [seed, makeManifest(seed, profile)]),
  );
  const runRewards = {};
  for (const seed of Object.keys(manifests)) {
    const run = newRun(profile, { runSeed: seed, runId: seed, roster: ROSTER, difficulty: 0 });
    for (const index of [1, 5, 11]) {
      for (const reroll of [0, 1]) {
        runRewards[seed + "/" + index + "/" + reroll] = expeditionRewardOffer(run, profile, index, reroll);
      }
    }
  }

  return {
    contentVersion: PLAYABLE_CONTENT.contentVersion,
    content: PLAYABLE_CONTENT,
    displayNames: DISPLAY_NAMES,
    characterOptions: CHARACTER_OPTIONS,
    skills: SKILLS,
    equipment: EQUIPMENT,
    components: COMPONENTS,
    componentOrder: COMPONENT_ORDER,
    skillTreeNodes: SKILL_TREE_NODES,
    // R19（issue #137）— 技能レベルの上限。**上位互換を別技能として増やさない**
    // 代わりに、どの技能が何段まで伸びるのかを公開する。
    skillLevelCaps: SKILL_LEVEL_CAPS,
    enemyInfo: Object.fromEntries(enemyIds.map((id) => [id, enemyInfo(id)])),
    enemyTargeting: Object.fromEntries(enemyIds.map((id) => [id, enemyTargetingText(id)])),
    initialUnlocked: Object.fromEntries(CHARACTER_OPTIONS.map((o) => [o.id, initialUnlockedSkills(o.id)])),
    freshLoadout: loadout,
    // ---- Phase B
    region: REGION,
    skillPacks: SKILL_PACKS,
    difficulties: DIFFICULTIES,
    bossLaws: BOSS_LAWS,
    enemyMutations: ENEMY_MUTATIONS,
    enemyThreatCost: ENEMY_THREAT_COST,
    expeditionEncounters: EXPEDITION_ENCOUNTERS,
    composedEncounters: composed,
    manifests,
    // describeLevel は関数なので JSON へ出ない。id・費用・上限だけを凍らせる。
    metaUpgrades: META_UPGRADES.map((upgrade) => ({
      id: upgrade.id, category: upgrade.category, displayName: upgrade.displayName,
      maxLevel: upgrade.maxLevel ?? null, costs: upgrade.costs,
    })),
    freshProfile: profile,
    runRewards,
  };
}

export function contractSnapshotJson() {
  return JSON.stringify(contractSnapshot(), null, 1) + "\n";
}

// `node ecology/contract-snapshot.mjs --write` で凍結を作り直す。
// **意図した変更のときだけ。**差分を読まずに走らせない。
if (process.argv[1] && process.argv[1].endsWith("contract-snapshot.mjs") && process.argv.includes("--write")) {
  const { writeFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const path = fileURLToPath(new URL("./contract-snapshot.json", import.meta.url));
  writeFileSync(path, contractSnapshotJson());
  console.log("凍結を作り直した: " + path);
}

