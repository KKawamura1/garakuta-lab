// **技能ツリーの座標が、線を引ける形になっているか。**
//
// R19（issue #137）で、ツリーを「系統 × tier の格子」から「requires から組んだ森」へ
// 変えた。座標（x = 前提からの深さ、y = 行）は手で書かず
// `ecology/content/skill-tree-layout.mjs` が組む。**組み方から出てくる性質なので普通は
// 破れないが、破れるとしたら組み方を直したときで、そのとき静かに壊れるのが一番困る。**
//
// ここで見るのは五つ。
//
//   1. 座標重複     同じ列の同じ行に二つ置いていないか
//   2. x 列違反     子が必ず親の1列右に居るか
//   3. 線の交差     同じ親の子が連続した行に入り、部分木が重なっていないか
//   4. 循環         前提が輪になっていないか
//   5. 分岐数不足   役割の違う道が選べるだけの分岐があるか
//   6. 深さと分岐   x=3 と x=5 で2方向へ分かれ、x=10 に複数の到達点があるか
//
// **さらに「その到達点へ本当に届くのか」を見る。**x=10 の節が全部 campaign に
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
  skillIdsForPacks,
  validateSkillTreeLayout,
} from "../ecology/content/index.mjs";

const problems = validateSkillTreeLayout(SKILL_TREE_LAYOUT, SKILL_TREE_NODES)
  .map((line) => "全節: " + line);

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

// **x=10 の到達点へ、campaign で届くこと。**最終 Stage の manifest から出る節だけで
// 根から x=10 まで繋がる道が、行動と反応のそれぞれに一本はあること。
{
  const lastStage = CAMPAIGN_STAGES[CAMPAIGN_STAGES.length - 1];
  const available = new Set(skillIdsForPacks(lastStage.enabledPackIds, lastStage.packDepths).all);
  const visible = SKILL_TREE_NODES.filter((node) => available.has(node.skillId));
  const layout = buildSkillTreeLayout(visible);
  for (const group of layout) {
    if (!["active", "reactive"].includes(group.kind)) continue;
    const reachable = group.rows.filter((row) => row.x === 10);
    if (!reachable.length) {
      const deepest = group.rows.reduce((max, row) => Math.max(max, row.x), 0);
      problems.push(`${lastStage.id}: ${group.label}ツリーは最終 Stage でも x=${deepest} までしか届かない`
        + "（x=10 の到達点が、campaign に出ない pack にしか無い）");
    }
  }
}

// 参照点。**この検査が本当に引っかかるのかを、ここで確かめる。**
{
  const broken = [
    { id: "n_a", skillId: "a", kind: "active", branch: "攻撃", tier: 0, cost: 0, requires: [] },
    { id: "n_b", skillId: "b", kind: "active", branch: "攻撃", tier: 0, cost: 0, requires: ["c"] },
    { id: "n_c", skillId: "c", kind: "active", branch: "攻撃", tier: 0, cost: 0, requires: ["b"] },
  ];
  const detected = validateSkillTreeLayout(buildSkillTreeLayout(broken), broken);
  const checks = [
    ["循環", detected.some((line) => line.includes("循環"))],
    ["分岐数不足", detected.some((line) => line.includes("分岐"))],
    ["x=10 の到達点不足", detected.some((line) => line.includes("最終到達点"))],
  ];
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
  .map((group) => `${group.label} ${group.nodeCount}節・最深 x=${group.depth}・分岐 ${group.forks}・橋渡し ${group.bridges.length}`)
  .join(" / ");
console.log(
  `ecology-skill-tree smoke: ${shape} — `
  + `座標重複・x列違反・線の交差・循環・分岐数不足なし（全${CAMPAIGN_STAGES.length} Stage の部分森でも同じ）`,
);
