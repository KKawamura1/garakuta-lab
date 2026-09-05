// ecology/content/skill-tree-layout.mjs
//
// **技能ツリーの座標。どの節がどの節から派生したのかを、画面が線で引けるようにする。**
//
// R19（issue #137）— それまでのツリーは「系統 × T1/T2/T3」の格子だった。節は
// tier ごとの箱に並ぶだけで、**どの節がどの節から派生したのかは画面に出ていなかった**。
// 前提は節を開かないと読めず、開いても名前が一つ書いてあるだけで、そこから先に何が
// 生えるのかは分からない。取得方針が立たない。
//
// ここは `SKILL_TREE_NODES` の `requires` **だけ**から森を組み、各節へ
//
//   x = 前提からの深さ（前提の1列右）
//   y = 上から数えた行（同じ親の子は連続した行に入る）
//
// を与える。**座標は手で書かない。**手で書くと `requires` を直したときに黙ってずれる。
// 代わりに、座標が満たすべき決まりを `validateSkillTreeLayout()` が機械で見る
// （analysis/ecology-skill-tree-smoke.mjs）。
//
// ## 三つのツリーと橋渡し
//
// 節は種別（行動 / 反応 / 常設）で三つのツリーに分かれる。AP を払う行動と RP を払う
// 反応が同じ枝に混ざっていると、「どっちの資源を伸ばす話なのか」が読めないためである。
//
// 種別をまたぐ前提（例: 反応の「反撃」は行動の「斬撃」を前提にする）は、普通の派生に
// 混ぜず、**橋渡しの節（bridge anchor）**として明示する。反応ツリーの左端に
// 「橋渡し ← 斬撃（行動）」という節が立ち、そこから反撃たちが生える。
// 前提が別のツリーに居ることが、線を辿るだけで分かる。
//
// ここを触ってよいのは 統合 担当だけ。engine・schema・共通registryは変更しない。

import { SKILL_TREE_NODES } from "./skill-tree.mjs";

// ---------------------------------------------------------------- 表示語彙

// **三つのツリー。**順番は「まず何を出すか（行動）→ 相手の手に何を返すか（反応）→
// いつでも効く土台（常設）」。
export const SKILL_TREE_GROUPS = Object.freeze([
  Object.freeze({
    kind: "active",
    label: "行動",
    resource: "AP",
    summary: "自分の手番で出す。上から順に、出せる最初の一つを試す。",
  }),
  Object.freeze({
    kind: "reactive",
    label: "反応",
    resource: "RP",
    summary: "相手や味方の出来事へ割り込む。同じ出来事は上から順に発火する。",
  }),
  Object.freeze({
    kind: "passive",
    label: "常設",
    resource: "—",
    summary: "資源を払わずいつでも効く。土台と、読みの補助。",
  }),
]);

// **系統の並び順。**「基礎」は最後（詰み防止の棚であって、最初に見せる棚ではない）。
export const BRANCH_ORDER = Object.freeze(["攻撃", "守り", "支援", "指揮", "基礎"]);

// **分岐先のビルド方針。**節を選んだとき、その先がどういう戦い方になるのかを一行で出す。
// 数値の差ではなく、**役割の差**を書く。
export const BRANCH_BUILDS = Object.freeze({
  "攻撃": "削り切る側。単体処刑・範囲制圧・刻印連携のどれで倒すかを選ぶ。",
  "守り": "受け止める側。防壁・受け構え・隊列の入れ替えで、被害の総量を下げる。",
  "支援": "保たせる側。手当てと守勢を配り、味方が倒れる前に止める。",
  "指揮": "順番を作る側。行動権と準備を動かし、こちらが先に動く形にする。",
  "基礎": "土台。前提を持たないので、伸ばしたい資源へいつでも点を置ける。",
});

// **反応の発動条件。**engine の event 名をそのまま画面に出さない。
export const TRIGGER_LABELS = Object.freeze({
  action_declared: "行動が宣言されたとき",
  action_resolved: "行動が解決したとき",
  actor_defeated: "誰かが倒れたとき",
  actor_moved: "誰かが位置を変えたとき",
  barrier_broken: "防壁が割れたとき",
  barrier_gained: "防壁を得たとき",
  damage_blocked: "受け構えで防いだとき",
  damage_proposed: "damage が決まる直前",
  damage_taken: "被弾したとき",
  excess_damage: "過剰damageが出たとき",
  excess_healing: "過剰治療が出たとき",
  healing_applied: "治療が入ったとき",
  preparation_advanced: "準備が進んだとき",
  preparation_completed: "準備が終わったとき",
  preparation_started: "準備が始まったとき",
  resource_gained: "資源を得たとき",
  status_added: "状態が付いたとき",
  status_removed: "状態が外れたとき",
  target_selected: "対象が決まったとき",
});

// **行動の対象範囲。**targetQuery.scope をそのまま出さない。
export const SCOPE_LABELS = Object.freeze({
  enemies: "敵",
  allies: "味方",
  self: "自分",
  event_targets: "その出来事の対象",
  event_source: "その出来事の出し手",
});

// ---------------------------------------------------------------- 森を組む

function branchRank(branch) {
  const index = BRANCH_ORDER.indexOf(branch);
  return index === -1 ? BRANCH_ORDER.length : index;
}

// **並び順は一意に決める。**同じ入力から同じ座標が出ないと、画面が毎回踊る。
function orderNodes(a, b) {
  if (branchRank(a.branch) !== branchRank(b.branch)) return branchRank(a.branch) - branchRank(b.branch);
  if (a.tier !== b.tier) return a.tier - b.tier;
  return a.skillId.localeCompare(b.skillId);
}

const bridgeKey = (requireId) => "bridge:" + requireId;

// 一つの種別ぶんの森を組む。`nodes` はその時点で画面に出す節だけでよい
// （manifest から外れた pack の節は渡ってこない）。前提は必ず同じ manifest に居ることを
// analysis/ecology-skill-catalog-smoke.mjs が保証しているので、親を失った子は出ない。
function buildGroup(group, nodes, allBySkill) {
  const groupNodes = nodes.filter((node) => node.kind === group.kind).sort(orderNodes);
  const present = new Set(groupNodes.map((node) => node.skillId));

  // 構造上の親は「同じツリーに居る最初の前提」。それ以外の前提は合流として脇に置く。
  const structure = new Map();
  for (const node of groupNodes) {
    const inside = node.requires.filter((id) => present.has(id));
    const outside = node.requires.filter((id) => !present.has(id));
    structure.set(node.skillId, { node, parent: inside[0] ?? null, extraRequires: [...inside.slice(1), ...outside.slice(1)], bridgeFrom: inside.length ? null : (outside[0] ?? null) });
  }

  // 根は二種類。前提を持たない本物の根と、種別をまたぐ前提を束ねる橋渡しの節。
  const roots = [];
  const bridges = new Map();
  for (const node of groupNodes) {
    const entry = structure.get(node.skillId);
    if (entry.parent) continue;
    if (!entry.bridgeFrom) {
      roots.push({ type: "node", key: node.skillId, node, branch: node.branch, tier: node.tier });
      continue;
    }
    const key = bridgeKey(entry.bridgeFrom);
    if (!bridges.has(key)) {
      const source = allBySkill[entry.bridgeFrom] ?? null;
      bridges.set(key, {
        type: "bridge",
        key,
        requireId: entry.bridgeFrom,
        fromKind: source?.kind ?? null,
        branch: source?.branch ?? node.branch,
        tier: -1,
        children: [],
      });
    }
    bridges.get(key).children.push(node.skillId);
  }

  // 橋渡しは本物の根のあと。**「まずこのツリーだけで始められる節」を先に見せる。**
  const anchors = [
    ...roots.sort((a, b) => orderNodes(a.node, b.node)),
    ...[...bridges.values()].sort((a, b) => {
      if (branchRank(a.branch) !== branchRank(b.branch)) return branchRank(a.branch) - branchRank(b.branch);
      return a.requireId.localeCompare(b.requireId);
    }),
  ];

  const childrenOf = new Map();
  for (const node of groupNodes) {
    const entry = structure.get(node.skillId);
    if (!entry.parent) continue;
    if (!childrenOf.has(entry.parent)) childrenOf.set(entry.parent, []);
    childrenOf.get(entry.parent).push(node.skillId);
  }
  for (const list of childrenOf.values()) {
    list.sort((a, b) => orderNodes(structure.get(a).node, structure.get(b).node));
  }

  // 深さ優先で上から並べる。**y は行番号そのもの**にする。こうすると
  //   - 同じ列で y が重ならない
  //   - 同じ親の子が連続した y に入る
  //   - 線が交差しない
  // の三つが組み方から出てくる（あとから座標を直して壊す余地が無い）。
  const rows = [];
  const byKey = new Map();
  const walk = (key, x, rails, isLast, parentKey, ancestors) => {
    const bridge = bridges.get(key);
    const entry = bridge ? null : structure.get(key);
    const children = bridge ? bridge.children : (childrenOf.get(key) ?? []);
    const row = {
      type: bridge ? "bridge" : "node",
      key,
      x,
      y: rows.length,
      rails: [...rails],
      last: isLast,
      parentKey,
      ancestors,
      children: [...children],
      descendants: [],
      node: entry?.node ?? null,
      skillId: bridge ? null : key,
      requireId: bridge ? bridge.requireId : null,
      fromKind: bridge ? bridge.fromKind : null,
      branch: bridge ? bridge.branch : entry.node.branch,
      bridgeFrom: entry?.bridgeFrom ?? null,
      extraRequires: entry?.extraRequires ?? [],
    };
    rows.push(row);
    byKey.set(key, row);
    const nextAncestors = [...ancestors, key];
    children.forEach((child, index) => {
      walk(child, x + 1, [...rails, !isLast], index === children.length - 1, key, nextAncestors);
    });
    for (const child of children) {
      row.descendants.push(child, ...byKey.get(child).descendants);
    }
    return row;
  };
  anchors.forEach((anchor, index) => {
    walk(anchor.key, 0, [], index === anchors.length - 1, null, []);
  });

  const depth = rows.reduce((max, row) => Math.max(max, row.x), 0);
  const forks = rows.filter((row) => row.children.length >= 2).length;
  return {
    kind: group.kind,
    label: group.label,
    resource: group.resource,
    summary: group.summary,
    depth,
    forks,
    rows,
    byKey,
    anchors: anchors.length,
    bridges: [...bridges.values()].map((bridge) => bridge.requireId),
    nodeCount: groupNodes.length,
  };
}

// **入口。**画面はこれを呼ぶ。`nodes` を絞れば、その範囲だけの森が出る。
export function buildSkillTreeLayout(nodes = SKILL_TREE_NODES) {
  const allBySkill = Object.fromEntries(SKILL_TREE_NODES.map((node) => [node.skillId, node]));
  for (const node of nodes) allBySkill[node.skillId] = node;
  return SKILL_TREE_GROUPS.map((group) => buildGroup(group, nodes, allBySkill));
}

// 全節ぶんの正準座標。**検査と、Stage をまたいだ話をするときはこれを見る。**
export const SKILL_TREE_LAYOUT = buildSkillTreeLayout(SKILL_TREE_NODES);

// ---------------------------------------------------------------- 検査
//
// **座標は組み方から出てくるので、普通は破れない。**破れるとしたら組み方を直したときで、
// そのとき静かに壊れるのが一番困る。ここは「座標が満たしているはずのこと」を、
// 出来上がった森に対して外から見る受け皿である。
// analysis/ecology-skill-tree-smoke.mjs が呼び、鳴ることも確かめてある。

// 分岐（子を2つ以上持つ節）の下限。**行動と反応は、役割の違う道が選べないと意味が無い。**
// 常設は前提を持たない棚なので分岐を求めない（issue #137 の x=3 / x=5 での大分岐は、
// 現行 content の深さが最大 4 列なので、content 側の再設計を待つ）。
const MIN_FORKS = { active: 2, reactive: 2, passive: 0 };
// 複数前提の合流は特別な連携技能に限る。**普通の派生に混ぜない。**
const MAX_MERGE_NODES = 8;

// `requireForks: false` は Stage ごとの部分森を見るとき用。序盤の Stage は pack が
// 数個しか入っていないので、分岐がまだ生えていなくてよい（座標の決まりは同じく見る）。
export function validateSkillTreeLayout(layout, nodes = SKILL_TREE_NODES, { requireForks = true } = {}) {
  const problems = [];

  // 循環。座標を組む前に、requires そのものを見る（循環していると森が組めない）。
  const bySkill = Object.fromEntries(nodes.map((node) => [node.skillId, node]));
  const mark = new Map();
  const visit = (skillId, trail) => {
    if (mark.get(skillId) === "done") return;
    if (mark.get(skillId) === "open") {
      problems.push(`前提が循環している: ${[...trail, skillId].join(" → ")}`);
      return;
    }
    mark.set(skillId, "open");
    for (const required of bySkill[skillId]?.requires ?? []) {
      if (bySkill[required]) visit(required, [...trail, skillId]);
    }
    mark.set(skillId, "done");
  };
  for (const node of nodes) visit(node.skillId, []);

  const merged = nodes.filter((node) => node.requires.length > 1);
  if (merged.length > MAX_MERGE_NODES) {
    problems.push(`複数前提の節が ${merged.length} 件ある（${MAX_MERGE_NODES} 件まで。`
      + `合流は特別な連携技能に限る）: ${merged.map((node) => node.skillId).join(", ")}`);
  }

  for (const group of layout) {
    const at = `${group.label}ツリー`;

    // 1. 座標重複。同じ列の同じ行に二つ置かない。
    const seen = new Map();
    for (const row of group.rows) {
      const key = row.x + "," + row.y;
      if (seen.has(key)) problems.push(`${at}: 座標 (${key}) に ${seen.get(key)} と ${row.key} が重なっている`);
      seen.set(key, row.key);
    }

    // 2. 前提の x 列。**子は必ず親の1列右。**
    for (const row of group.rows) {
      if (row.parentKey === null) {
        if (row.x !== 0) problems.push(`${at}: 根 ${row.key} が x=${row.x} に居る（根は x=0）`);
        continue;
      }
      const parent = group.byKey.get(row.parentKey);
      if (!parent) {
        problems.push(`${at}: ${row.key} の親 ${row.parentKey} が森に居ない`);
        continue;
      }
      if (row.x !== parent.x + 1) {
        problems.push(`${at}: ${row.key} が x=${row.x}、前提 ${row.parentKey} が x=${parent.x}（1列右ではない）`);
      }
    }

    // 3. 線の交差。同じ親の子が連続した y 範囲に入り、部分木どうしが重ならないこと。
    //    親→子の線が交差するのは、この二つのどちらかが破れたときだけである。
    for (const row of group.rows) {
      if (!row.children.length) continue;
      const childRows = row.children.map((key) => group.byKey.get(key));
      for (const child of childRows) {
        if (child.y <= row.y) problems.push(`${at}: ${child.key} が親 ${row.key} より上に居る（線が戻る）`);
      }
      const span = (key) => {
        const target = group.byKey.get(key);
        return [target.y, target.y + target.descendants.length];
      };
      for (let index = 1; index < row.children.length; index += 1) {
        const [, previousEnd] = span(row.children[index - 1]);
        const [start] = span(row.children[index]);
        if (start !== previousEnd + 1) {
          problems.push(`${at}: ${row.key} の子 ${row.children[index]} が連続した行に入っていない`
            + `（前の部分木は y=${previousEnd} で終わり、この子は y=${start}）`);
        }
      }
    }

    // 4. 分岐数。役割の違う道が選べること。
    const need = requireForks ? (MIN_FORKS[group.kind] ?? 0) : 0;
    if (group.forks < need) {
      problems.push(`${at}: 分岐（子を2つ以上持つ節）が ${group.forks} 件しかない（${need} 件以上ほしい）`);
    }
    if (!group.rows.length) problems.push(`${at}: 節が一つも無い`);
  }

  return problems;
}
