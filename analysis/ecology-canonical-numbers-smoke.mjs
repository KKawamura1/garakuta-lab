// **正本の数値を一箇所から導出し、説明文の再発を防ぐ。**
//
// 節数・pack 数・baseline の内訳・最終 Stage の到達範囲は、content と manifest から
// その場で数える。ここへ現在の実値を写すと、content を変更したときに検査自体が
// 古くなるので、期待値は持たない。
//
// さらに、現在値を説明するコメントや docs が導出可能な数を手書きしていないかを見る。
// 散文で数値を持つ場合は、そこから値を出す検査名を併記する。**数字を直すだけの修正が
// 再び入らないことを、CI の入口で確認する。**

import { readFileSync } from "node:fs";
import {
  BASELINE_PASSIVE_SKILL_IDS,
  CAMPAIGN_STAGES,
  PACKS_PER_MANIFEST,
  PACK_BY_ID,
  PLAYABLE_CONTENT,
  SKILL_PACKS,
  SKILL_TREE_LAYOUT,
  SKILL_TREE_NODES,
  buildSkillTreeLayout,
  packOfSkill,
  skillIdsForPacks,
} from "../ecology/content/index.mjs";

const problems = [];
const requireCondition = (condition, message) => {
  if (!condition) problems.push(message);
};
const unique = (values) => new Set(values).size === values.length;

const layoutNodeCount = SKILL_TREE_LAYOUT.reduce((total, group) => total + group.nodeCount, 0);
requireCondition(
  layoutNodeCount === SKILL_TREE_NODES.length,
  "SKILL_TREE_LAYOUT の節数合計が SKILL_TREE_NODES.length と一致しない",
);
requireCondition(unique(SKILL_TREE_NODES.map((node) => node.id)), "技能ツリーの節 ID が重複している");
requireCondition(
  unique(SKILL_TREE_NODES.map((node) => node.skillId)),
  "技能ツリーの skillId が重複している",
);
requireCondition(unique(SKILL_PACKS.map((pack) => pack.id)), "SKILL_PACKS の pack ID が重複している");
requireCondition(
  Object.keys(PACK_BY_ID).length === SKILL_PACKS.length,
  "PACK_BY_ID が SKILL_PACKS の全 pack を指していない",
);
requireCondition(
  Number.isInteger(PACKS_PER_MANIFEST)
    && PACKS_PER_MANIFEST > 0
    && PACKS_PER_MANIFEST <= SKILL_PACKS.length,
  "PACKS_PER_MANIFEST が SKILL_PACKS の範囲外",
);

requireCondition(
  unique(BASELINE_PASSIVE_SKILL_IDS),
  "BASELINE_PASSIVE_SKILL_IDS に重複がある",
);
for (const skillId of BASELINE_PASSIVE_SKILL_IDS) {
  requireCondition(
    Boolean(PLAYABLE_CONTENT.passiveSkills?.[skillId]),
    "baseline passive " + skillId + " の定義が無い",
  );
  requireCondition(
    packOfSkill(skillId) === "baseline",
    "baseline passive " + skillId + " が pack 側へ移っている",
  );
}
for (const node of SKILL_TREE_NODES) {
  requireCondition(
    packOfSkill(node.skillId) !== null,
    node.skillId + " が pack にも baseline にも属さない",
  );
}

const lastStage = CAMPAIGN_STAGES[CAMPAIGN_STAGES.length - 1];
const campaignSummary = [];
if (!lastStage) {
  problems.push("CAMPAIGN_STAGES に最終 Stage が定義されていない");
} else {
  const available = new Set(skillIdsForPacks(lastStage.enabledPackIds, lastStage.packDepths).all);
  const visibleNodes = SKILL_TREE_NODES.filter((node) => available.has(node.skillId));
  const campaignLayout = buildSkillTreeLayout(visibleNodes);
  const placed = new Set(
    campaignLayout.flatMap((group) => group.rows.map((row) => row.skillId)),
  );
  requireCondition(
    placed.size === visibleNodes.length,
    lastStage.id + " の可視節がレイアウトから漏れている",
  );

  const fullByKind = new Map(SKILL_TREE_LAYOUT.map((group) => [group.kind, group]));
  const campaignByKind = new Map(campaignLayout.map((group) => [group.kind, group]));
  for (const [kind, fullGroup] of fullByKind) {
    if (!["active", "reactive"].includes(kind)) continue;
    const campaignGroup = campaignByKind.get(kind);
    if (!campaignGroup || !campaignGroup.rows.length) {
      problems.push(lastStage.id + ": " + fullGroup.label + "ツリーに可視節が無い");
      continue;
    }
    requireCondition(
      campaignGroup.nodeCount <= fullGroup.nodeCount,
      lastStage.id + ": " + fullGroup.label + "ツリーの可視節数が全体を超えている",
    );
    requireCondition(
      campaignGroup.depth <= fullGroup.depth,
      lastStage.id + ": " + fullGroup.label + "ツリーの深さが全体を超えている",
    );

    // 行動は本編の最終到達点へ届く必要がある。到達点の x は全体レイアウトから導出し、
    // ここに現在の列番号を複製しない。反応側の未導入 pack は将来 Stage の候補として残る。
    const fullFinalIds = new Set(
      fullGroup.rows
        .filter((row) => row.x === fullGroup.depth)
        .map((row) => row.skillId),
    );
    const reachableFinalIds = [...fullFinalIds].filter((skillId) => available.has(skillId));
    if (kind === "active") {
      requireCondition(
        reachableFinalIds.length > 0,
        lastStage.id + ": " + fullGroup.label + "ツリーの全体最終到達点へ届く節が無い",
      );
    }
    campaignSummary.push(
      fullGroup.label
        + " "
        + campaignGroup.nodeCount
        + "節・最深 x="
        + campaignGroup.depth,
    );
  }
}

const readRepoFile = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const sourceRules = [
  {
    path: "ecology/content/index.mjs",
    required: ["SKILL_TREE_NODES.length", "analysis/ecology-canonical-numbers-smoke.mjs"],
    forbidden: [
      { label: "現在の節数の手書き", expression: /節数は[^\n]*\d+\s*節/ },
    ],
  },
  {
    path: "ecology/content/packs.mjs",
    required: ["SKILL_PACKS", "PACKS_PER_MANIFEST", "BASELINE_PASSIVE_SKILL_IDS"],
    forbidden: [
      { label: "Free / Endless の固定 pack 数", expression: /Free\s*\/\s*Endless[^\n]*\d+\s*パック/ },
      { label: "baseline passive の固定種類数", expression: /BASELINE_PASSIVE_SKILL_IDS[^\n]*\d+\s*種/ },
    ],
  },
  {
    path: "docs/GAME.md",
    required: [
      "SKILL_TREE_NODES",
      "skillIdsForPacks",
      "analysis/ecology-canonical-numbers-smoke.mjs",
      "analysis/ecology-skill-catalog-smoke.mjs",
      "analysis/ecology-skill-tree-smoke.mjs",
    ],
    forbidden: [
      { label: "可視節数の手書き表", expression: /\|\s*可視節数\s*\|/ },
      { label: "現行ツリー深さの手書き", expression: /(?:行動|反応)ツリー[^\n。]*x=\d+/ },
      { label: "core 技能数の手書き", expression: /core、\d+〜\d+技能/ },
    ],
  },
  {
    path: "docs/DESIGN.md",
    required: ["SKILL_TREE_LAYOUT", "analysis/ecology-skill-tree-smoke.mjs"],
    forbidden: [
      { label: "現行ツリー深さの手書き", expression: /(?:行動|反応)ツリー[^\n。]*x=\d+/ },
    ],
  },
  {
    path: "ecology/content/skill-tree.mjs",
    required: [
      "analysis/ecology-skill-tree-smoke.mjs",
      "analysis/ecology-skill-catalog-smoke.mjs",
    ],
    forbidden: [
      { label: "campaign 到達深さの手書き", expression: /campaign で[^\n。]*x=\d+/ },
      { label: "到達点の必要点数の手書き", expression: /到達点まで[^\n。]*\d+点/ },
    ],
  },
  {
    path: "analysis/ecology-skill-tree-smoke.mjs",
    required: ["SKILL_TREE_LAYOUT", "CAMPAIGN_STAGES", "skillIdsForPacks"],
    forbidden: [
      { label: "campaign 到達列の複製", expression: /CAMPAIGN_FINAL_COLUMNS/ },
      { label: "campaign 到達深さの手書き", expression: /行動は x=\d+、リアクティブは x=\d+/ },
    ],
  },
];

for (const rule of sourceRules) {
  const source = readRepoFile(rule.path);
  for (const required of rule.required) {
    requireCondition(
      source.includes(required),
      rule.path + " に正本または検査名 " + required + " が無い",
    );
  }
  for (const forbidden of rule.forbidden) {
    const matched = source.split(/\r?\n/).some((line) => forbidden.expression.test(line));
    requireCondition(!matched, rule.path + " に " + forbidden.label + " が残っている");
  }
}

if (problems.length) {
  console.error("ecology-canonical-numbers smoke:\n  " + problems.join("\n  "));
  process.exit(1);
}

const treeSummary = SKILL_TREE_LAYOUT
  .map((group) => group.label + " " + group.nodeCount + "節・最深 x=" + group.depth)
  .join(" / ");
console.log(
  "ecology-canonical-numbers smoke: "
    + treeSummary
    + " / pack "
    + SKILL_PACKS.length
    + " / baseline passive "
    + BASELINE_PASSIVE_SKILL_IDS.length
    + " / "
    + (lastStage?.id ?? "最終 Stage なし")
    + " "
    + campaignSummary.join(" / ")
    + " — 正本から導出した値と説明文の参照を確認",
);
