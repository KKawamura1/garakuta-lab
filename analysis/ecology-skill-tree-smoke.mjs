// **技能ツリーの座標が、線を引ける形になっているか。**
//
// R19（issue #137）で、ツリーを「系統 × tier の格子」から「requires から組んだ森」へ
// 変えた。座標（x = 前提からの深さ、y = 行）は手で書かず
// `ecology/content/skill-tree-layout.mjs` が組む。**組み方から出てくる性質なので普通は
// 破れないが、破れるとしたら組み方を直したときで、そのとき静かに壊れるのが一番困る。**
//
// ここで見るのは、次の性質。
//
//   1. 座標重複     同じ列の同じ行に二つ置いていないか
//   2. x 列違反     子が必ず親の1列右に居るか
//   3. 線の交差     同じ親の子が連続した行に入り、部分木が重なっていないか
//   4. 循環         前提が輪になっていないか
//   5. 分岐数不足   役割の違う道が選べるだけの分岐があるか
//   6. 深さと分岐   主要な分岐と、種別ごとの複数の最終到達点があるか
//   7. 種別またぎの前提   行動 / 反応 / 常設をまたいで前提にしていないか
//
// **さらに「その到達点へ本当に届くのか」を見る。**最終到達点が campaign に
// 出ない pack に居たら、それは設計図であって遊べる形ではない。
//
// **Stage ごとの部分森でも見る。**manifest から pack が外れると節が減るので、
// 「全部あるときは正しいが、Stage 1 では親を失う」形が起きうる。
//
// **鳴ることを確かめてある**（末尾の自己検査）。

import {
  CAMPAIGN_STAGES,
  SKILL_TREE_LAYOUT,
  SKILL_TREE_NODES,
  buildSkillTreeLayout,
  requiredSkillIds,
  skillIdsForPacks,
  validateSkillTreeLayout,
} from "../ecology/content/index.mjs";

// 種別またぎの前提を禁じる。**行動 / 反応 / 常設をまたぐ前提は「どの資源を伸ばす
// 話なのか」を読めなくする**（旧 R19 の「橋渡し」は分かりにくいので廃止した）。
// skill-tree.mjs は node() だけで森を書くので普通は起きないが、
// 静かに戻らないよう毎回ここで見る。検査と自己検査（末尾）が同じ関数を使う。
function crossKindRequireProblems(nodes) {
  const bySkill = Object.fromEntries(nodes.map((node) => [node.skillId, node]));
  const found = [];
  for (const node of nodes) {
    for (const requiredId of requiredSkillIds(node)) {
      const required = bySkill[requiredId];
      if (required && required.kind !== node.kind) {
        found.push(`種別またぎの前提: ${node.skillId}（${node.kind}）が ${requiredId}（${required.kind}）を前提にしている`);
      }
    }
  }
  return found;
}

const problems = [
  ...validateSkillTreeLayout(SKILL_TREE_LAYOUT, SKILL_TREE_NODES).map((line) => "全節: " + line),
  ...crossKindRequireProblems(SKILL_TREE_NODES),
];

// Stage ごとの部分森。**画面が実際に組むのはこちら。**
for (const stage of CAMPAIGN_STAGES) {
  const available = new Set(skillIdsForPacks(stage.enabledPackIds, stage.packDepths).all);
  const visible = SKILL_TREE_NODES.filter((node) => available.has(node.skillId));
  const layout = buildSkillTreeLayout(visible);
  for (const line of validateSkillTreeLayout(layout, visible, { requireForks: false })) {
    problems.push(`${stage.id}: ${line}`);
  }

  // 出ている節は、必ず森のどこかに居ること。**取りこぼした節は画面から消える。**
  const placed = new Set(layout.flatMap((group) => group.rows.filter((row) => row.skillId).map((row) => row.skillId)));
  for (const node of visible) {
    if (!placed.has(node.skillId)) problems.push(`${stage.id}: ${node.skillId} が森のどこにも置かれていない（画面から消える）`);
  }
}

// **本編の最終到達点へ、campaign で届くこと。**最終 Stage の manifest から出る節を
// 実際に森へ組み直し、全体レイアウトの最終到達点と比べて到達範囲を導出する。
// 最終到達点の値をここへ写さない。pack の追加・深さの変更は manifest と layout から
// 自動的に反映され、遊べる側の到達点が消えたときだけ検査を鳴らす。
{
  const lastStage = CAMPAIGN_STAGES[CAMPAIGN_STAGES.length - 1];
  if (!lastStage) {
    problems.push("campaign: 最終 Stage が定義されていない");
  } else {
    const available = new Set(skillIdsForPacks(lastStage.enabledPackIds, lastStage.packDepths).all);
    const visible = SKILL_TREE_NODES.filter((node) => available.has(node.skillId));
    const campaignLayout = buildSkillTreeLayout(visible);
    const fullByKind = new Map(SKILL_TREE_LAYOUT.map((group) => [group.kind, group]));
    const campaignByKind = new Map(campaignLayout.map((group) => [group.kind, group]));
    for (const [kind, fullGroup] of fullByKind) {
      if (!["active", "reactive"].includes(kind)) continue;
      const campaignGroup = campaignByKind.get(kind);
      if (!campaignGroup || !campaignGroup.rows.length) {
        problems.push(lastStage.id + ": " + fullGroup.label + "ツリーに可視節が無い");
        continue;
      }
      if (campaignGroup.depth > fullGroup.depth) {
        problems.push(lastStage.id + ": " + fullGroup.label + "ツリーの深さが全体を超えている");
      }
      const fullFinalIds = new Set(
        fullGroup.rows
          .filter((row) => row.x === fullGroup.depth)
          .map((row) => row.skillId),
      );
      const reachableFinalIds = [...fullFinalIds].filter((skillId) => available.has(skillId));
      if (kind === "active" && !reachableFinalIds.length) {
        problems.push(lastStage.id + ": " + fullGroup.label + "ツリーの全体最終到達点へ届く節が無い");
      }
    }
  }
}

// 参照点。**この検査が本当に引っかかるのかを、ここで確かめる。**
{
  const broken = [
    { id: "n_a", skillId: "a", kind: "active", branch: "攻撃", tier: 0, cost: 0, maxLv: 1, requires: [] },
    { id: "n_b", skillId: "b", kind: "active", branch: "攻撃", tier: 0, cost: 0, maxLv: 1, requires: [{ skillId: "c", minLv: 1 }] },
    { id: "n_c", skillId: "c", kind: "active", branch: "攻撃", tier: 0, cost: 0, maxLv: 1, requires: [{ skillId: "b", minLv: 1 }] },
  ];
  const detected = validateSkillTreeLayout(buildSkillTreeLayout(broken), broken);
  const checks = [
    ["循環", detected.some((line) => line.includes("循環"))],
    ["分岐数不足", detected.some((line) => line.includes("分岐"))],
    ["最終到達点不足", detected.some((line) => line.includes("最終到達点"))],
  ];

  // 種別またぎの前提も、ここで実際に検出できることを確かめる。
  const crossed = [
    { id: "n_d", skillId: "d", kind: "active", branch: "攻撃", tier: 0, cost: 0, maxLv: 1, requires: [] },
    { id: "n_e", skillId: "e", kind: "reactive", branch: "攻撃", tier: 0, cost: 0, maxLv: 1, requires: [{ skillId: "d", minLv: 1 }] },
  ];
  checks.push(["種別またぎの前提", crossKindRequireProblems(crossed).length > 0]);
  // 座標側も鳴らす。**組み上がった森を手で壊して見せる。**
  const layout = buildSkillTreeLayout(SKILL_TREE_NODES);
  const group = layout[0];
  const moved = group.rows.find((row) => row.parentKey !== null);
  moved.x += 1;
  const collided = group.rows.find((row) => row.key !== moved.key && row.y > 0);
  collided.x = group.rows[0].x;
  collided.y = group.rows[0].y;
  const coordinateProblems = validateSkillTreeLayout(layout, SKILL_TREE_NODES);
  checks.push(["x 列違反", coordinateProblems.some((line) => line.includes("1列右ではない"))]);
  checks.push(["座標重複", coordinateProblems.some((line) => line.includes("重なっている"))]);
  checks.push(["宣言座標のずれ", coordinateProblems.some((line) => line.includes("森から出た x"))]);

  for (const [what, ok] of checks) {
    if (!ok) {
      console.error(`ecology-skill-tree smoke: 参照点が壊れている（${what} を検出できない）。`);
      process.exit(1);
    }
  }
}

if (problems.length) {
  console.error("ecology-skill-tree smoke:\n  " + problems.join("\n  "));
  process.exit(1);
}

const shape = SKILL_TREE_LAYOUT
  .map((group) => `${group.label} ${group.nodeCount}節・最深 x=${group.depth}・分岐 ${group.forks}`)
  .join(" / ");
console.log(
  `ecology-skill-tree smoke: ${shape} — `
  + `座標重複・x列違反・線の交差・循環・分岐数不足・種別またぎの前提なし（全${CAMPAIGN_STAGES.length} Stage の部分森でも同じ）`,
);
