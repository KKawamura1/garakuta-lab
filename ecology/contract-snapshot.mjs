// ecology/contract-snapshot.mjs
//
// **content contract の観測点を一箇所で作る。** 検査と再生成が同じ関数を使うので、
// 「検査が見ている物」と「凍らせた物」がずれない。
//
// ここに載っているものは、R7 の hard contract として外から見える出力である。
// 中身を変えたいときは、変えてよい理由（Phase の採択、migration の用意）を
// 先に決めてから凍結ファイルを作り直すこと。**差分を見ずに更新しない。**

import { PLAYABLE_CONTENT, DISPLAY_NAMES } from "./content/index.mjs";
import {
  CHARACTER_OPTIONS,
  COMPONENTS,
  COMPONENT_ORDER,
  EQUIPMENT,
  RUN_SEED,
  SKILLS,
  SKILL_TREE_NODES,
  allEncounters,
  encounterInfo,
  enemyInfo,
  enemyTargetingText,
  freshLoadout,
  initialUnlockedSkills,
  makeBattle,
  rewardOffer,
  stageRule,
} from "./playable-battles.mjs";

const STAGES = [1, 2, 3, 4, 5, 6, 7];
// 観測に使う固定の編成。**seed と同じで、動かしたら比較の意味が消える。**
const ROSTER = ["warden", "mender", "lancer", "scout"];
const FORMATION = {
  warden: "front_left",
  lancer: "front_right",
  mender: "rear_left",
  scout: "rear_right",
};
const REWARD_SEEDS = [RUN_SEED, "frontier-1801-abc12345", "frontier-1801-zzz"];
const OWNED = ["standing_plate", "field_kit"];

export function contractSnapshot() {
  const loadout = freshLoadout(ROSTER);
  const battles = {};
  for (const stage of STAGES) {
    battles["stage" + stage] = makeBattle(stage, ROSTER, loadout, RUN_SEED, FORMATION);
  }
  const rewards = {};
  for (const seed of REWARD_SEEDS) {
    for (const stage of STAGES) {
      rewards[seed + "/" + stage] = rewardOffer(seed, stage, [], 3);
      rewards[seed + "/" + stage + "/owned"] = rewardOffer(seed, stage, OWNED, 3);
    }
  }
  const enemyIds = Object.keys(PLAYABLE_CONTENT.enemyActors);
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
    encounters: allEncounters(),
    encounterInfo: Object.fromEntries(STAGES.map((s) => [s, encounterInfo(s)])),
    stageRules: Object.fromEntries(STAGES.map((s) => [s, stageRule(s)])),
    enemyInfo: Object.fromEntries(enemyIds.map((id) => [id, enemyInfo(id)])),
    enemyTargeting: Object.fromEntries(enemyIds.map((id) => [id, enemyTargetingText(id)])),
    initialUnlocked: Object.fromEntries(CHARACTER_OPTIONS.map((o) => [o.id, initialUnlockedSkills(o.id)])),
    freshLoadout: loadout,
    battles,
    rewards,
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
