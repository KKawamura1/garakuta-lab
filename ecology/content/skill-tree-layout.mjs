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
//   y = 行。**最初の子は親と同じ行を継ぐ**（線がまっすぐ伸びる）。
//       二人目以降の子だけが新しい行へ下りる（前の兄弟の部分木の直後）。
//
// を与える。一人目まで下げると、枝分かれしていない一本道が無駄に段を食い、
// 「まっすぐ伸びる一本」と「実際に分かれる場所」の区別が付かない
// （report by 作者、2026-09-05）。**座標は手で書かない。**手で書くと `requires` を
// 直したときに黙ってずれる。代わりに、座標が満たすべき決まりを
// `validateSkillTreeLayout()` が機械で見る（analysis/ecology-skill-tree-smoke.mjs）。
//
// ## 三つのツリー
//
// 節は種別（アクティブ / リアクティブ / パッシブ）で三つのツリーに分かれる。AP を払うアクティブと RP を払う
// リアクティブが同じ枝に混ざっていると、「どっちの資源を伸ばす話なのか」が読めないためである。
//
// **前提は必ず同じ種別の中に置く。**種別をまたぐ前提（旧 R19 の「橋渡し」）は
// 分かりにくいので廃止した。`buildGroup()` は同じ種別に居ない前提を無視するので、
// 万一 skill-tree.mjs が種別をまたぐ前提を書いても、その節は前提なしの根として
// 扱われる（analysis/ecology-skill-tree-smoke.mjs が種別またぎの前提そのものを検出する）。
//
// engine・schema・共通registryは変更しない。

import { SKILL_TREE_NODES, requiredSkillIds } from "./skill-tree.mjs";

// ---------------------------------------------------------------- 表示語彙

// **三つのツリー。**順番は「まず何を出すか（アクティブ）→ 相手の手に何を返すか（リアクティブ）→
// いつでも効く土台（パッシブ）」。
export const SKILL_TREE_GROUPS = Object.freeze([
  Object.freeze({
    kind: "active",
    label: "アクティブ",
    resource: "AP",
    summary: "自分の手番で出す。上から順に、出せる最初の一つを試す。",
  }),
  Object.freeze({
    kind: "reactive",
    label: "リアクティブ",
    resource: "RP",
    summary: "相手や味方の出来事へ割り込む。同じ出来事は上から順に発火する。",
  }),
  Object.freeze({
    kind: "passive",
    label: "パッシブ",
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

// **並び順は宣言順そのもの。**R19（issue #137）で森を入れ子で書くようにしたので、
// skill-tree.mjs に書いた形が、そのまま上から下への並びになる。
// （以前は系統と tier で並べ替えていたが、それだと「設計者が意図した道の順」が消えた。）
const DECLARED_ORDER = new Map(SKILL_TREE_NODES.map((node, index) => [node.skillId, index]));
const declaredIndex = (skillId) => DECLARED_ORDER.get(skillId) ?? Number.MAX_SAFE_INTEGER;
function orderNodes(a, b) {
  return declaredIndex(a.skillId) - declaredIndex(b.skillId);
}

// 一つの種別ぶんの森を組む。`nodes` はその時点で画面に出す節だけでよい
// （manifest から外れた pack の節は渡ってこない）。前提は必ず同じ manifest に居ることを
// analysis/ecology-skill-catalog-smoke.mjs が保証しているので、親を失った子は出ない。
// **前提は必ず同じ種別の中に置く**（analysis/ecology-skill-tree-smoke.mjs が種別またぎの
// 前提を検出する）。ここは念のため、種別をまたぐ前提を「前提なしの根」として黙って
// 無視する（このツリーには存在しない節を親として辿らない、という安全側の扱い）。
function buildGroup(group, nodes) {
  const groupNodes = nodes.filter((node) => node.kind === group.kind).sort(orderNodes);
  const present = new Set(groupNodes.map((node) => node.skillId));

  // 構造上の親は「同じツリーに居る最初の前提」。それ以外の前提は合流として脇に置く。
  const structure = new Map();
  for (const node of groupNodes) {
    const inside = requiredSkillIds(node).filter((id) => present.has(id));
    structure.set(node.skillId, { node, parent: inside[0] ?? null, extraRequires: inside.slice(1) });
  }

  const roots = [];
  for (const node of groupNodes) {
    const entry = structure.get(node.skillId);
    if (entry.parent) continue;
    roots.push({ node, branch: node.branch, tier: node.tier });
  }
  const anchors = roots.sort((a, b) => orderNodes(a.node, b.node));

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

  // 深さ優先で上から並べる。**最初の子だけ親と同じ y を継ぐ**（枝分かれしていない
  // 一本道が、そのまままっすぐ右へ伸びる）。二人目以降の子は、前の兄弟の部分木が
  // 使い切った行の直後（`nextY`）に新しい行を取る。この組み方から
  //   - 同じ列で y が重ならない
  //   - 実際に分かれる場所だけが新しい行を生む
  //   - 線が交差しない
  // の三つが出てくる（あとから座標を直して壊す余地が無い）。`nextY` は
  // forEach の外側にある単一の可変カウンタで、再帰の中で消費されるたびに進む
  // ——だから「前の兄弟の部分木がどこまで使ったか」を、そのまま次の兄弟が引き継げる。
  const rows = [];
  const byKey = new Map();
  let nextY = 0;
  const walk = (key, x, y, rails, isLast, parentKey, ancestors) => {
    const entry = structure.get(key);
    const children = childrenOf.get(key) ?? [];
    const row = {
      type: "node",
      key,
      x,
      y,
      rails: [...rails],
      last: isLast,
      parentKey,
      ancestors,
      children: [...children],
      descendants: [],
      node: entry.node,
      skillId: key,
      branch: entry.node.branch,
      extraRequires: entry.extraRequires,
    };
    rows.push(row);
    byKey.set(key, row);
    const nextAncestors = [...ancestors, key];
    children.forEach((child, index) => {
      const childY = index === 0 ? y : nextY++;
      walk(child, x + 1, childY, [...rails, !isLast], index === children.length - 1, key, nextAncestors);
    });
    for (const child of children) {
      row.descendants.push(child, ...byKey.get(child).descendants);
    }
    return row;
  };
  // R19（issue #137）— x は 1 から数える（issue の「x=1: 基本スキル」に合わせる）。
  // 根も「新しい行を取る側」として nextY から引く（根どうしは行を共有しない）。
  anchors.forEach((anchor, index) => {
    walk(anchor.node.skillId, 1, nextY++, [], index === anchors.length - 1, null, []);
  });

  // 部分木が実際に使い切った最終行（`maxY`）。**子の数だけ増える `descendants.length`
  // ではもう数えられない**（最初の子は行を増やさないため）。配列は親が子より先に
  // 入っているので、逆順に見れば子の `maxY` から先に求まる。
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index];
    row.maxY = row.children.reduce((max, child) => Math.max(max, byKey.get(child).maxY), row.y);
  }

  const depth = rows.reduce((max, row) => Math.max(max, row.x), 1);
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
    nodeCount: groupNodes.length,
  };
}

// **入口。**画面はこれを呼ぶ。`nodes` を絞れば、その範囲だけの森が出る。
export function buildSkillTreeLayout(nodes = SKILL_TREE_NODES) {
  return SKILL_TREE_GROUPS.map((group) => buildGroup(group, nodes));
}

// 全節ぶんの正準座標。**検査と、Stage をまたいだ話をするときはこれを見る。**
export const SKILL_TREE_LAYOUT = buildSkillTreeLayout(SKILL_TREE_NODES);

// ---------------------------------------------------------------- 検査
//
// **座標は組み方から出てくるので、普通は破れない。**破れるとしたら組み方を直したときで、
// そのとき静かに壊れるのが一番困る。ここは「座標が満たしているはずのこと」を、
// 出来上がった森に対して外から見る受け皿である。
// analysis/ecology-skill-tree-smoke.mjs が呼び、鳴ることも確かめてある。

// 分岐（子を2つ以上持つ節）の下限。**アクティブとリアクティブは、役割の違う道が選べないと意味が無い。**
// パッシブは前提を持たない棚（詰み防止の基礎訓練）なので分岐も深さも求めない。
const MIN_FORKS = { active: 2, reactive: 2, passive: 0 };

// issue #137 §深さと分岐 — **x=3 と x=5 で主要ルートが2方向以上へ分かれ、
// 行動ツリーは x=10、リアクティブツリーは x=9 に複数の最終到達点がある。**
// issue #130 で termination fixture のリアクティブを本編から除外したため、
// リアクティブ側だけfixture由来の4節ぶん浅くなる。数だけの深さは、役割の違う道が
// 無ければ意味が無い。
const FORK_COLUMNS = [3, 5];
const FINAL_COLUMNS = Object.freeze({ active: 10, reactive: 9 });
const MIN_FINAL_NODES = 2;
// 深さを求めるツリー。パッシブは棚なので外す。
const DEEP_KINDS = new Set(["active", "reactive"]);
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
    for (const required of requiredSkillIds(bySkill[skillId])) {
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
        if (row.x !== 1) problems.push(`${at}: 根 ${row.key} が x=${row.x} に居る（根は x=1）`);
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

    // 3. 線の交差。**最初の子だけ親と同じ行を継いでよい**（まっすぐ伸びる一本道）。
    //    二人目以降の子は必ず親より下の行に居て、部分木どうしが重ならないこと。
    //    親→子の線が交差するのは、このどれかが破れたときだけである。
    for (const row of group.rows) {
      if (!row.children.length) continue;
      const childRows = row.children.map((key) => group.byKey.get(key));
      childRows.forEach((child, index) => {
        if (index === 0) {
          if (child.y !== row.y) {
            problems.push(`${at}: 最初の子 ${child.key} が親 ${row.key} と同じ行を継いでいない`
              + `（親 y=${row.y}、子 y=${child.y}）`);
          }
        } else if (child.y <= row.y) {
          problems.push(`${at}: ${child.key} が親 ${row.key} より上か同じ行に居る（線が戻る）`);
        }
      });
      const span = (key) => {
        const target = group.byKey.get(key);
        return [target.y, target.maxY];
      };
      for (let index = 1; index < row.children.length; index += 1) {
        const [, previousEnd] = span(row.children[index - 1]);
        const [start] = span(row.children[index]);
        if (start !== previousEnd + 1) {
          problems.push(`${at}: ${row.key} の子 ${row.children[index]} が前の部分木の直後から`
            + `始まっていない（前の部分木は y=${previousEnd} で終わり、この子は y=${start}）`);
        }
      }
    }

    // 4. 宣言した座標と、組み直した座標が一致すること。
    //    **content が持つ x は、森から出た値の写しである。**ずれたら、どちらかが嘘になる。
    for (const row of group.rows) {
      if (row.type !== "node") continue;
      const declared = row.node?.x;
      if (declared === undefined) continue;
      if (declared !== row.x) {
        problems.push(`${at}: ${row.key} の宣言 x=${declared} と、森から出た x=${row.x} が違う`);
      }
    }

    // 5. 分岐数。役割の違う道が選べること。
    const need = requireForks ? (MIN_FORKS[group.kind] ?? 0) : 0;
    if (group.forks < need) {
      problems.push(`${at}: 分岐（子を2つ以上持つ節）が ${group.forks} 件しかない（${need} 件以上ほしい）`);
    }
    if (!group.rows.length) problems.push(`${at}: 節が一つも無い`);

    // 6. issue #137 §深さと分岐 — x=3 と x=5 の大分岐、x=10 の複数到達点。
    //    部分森（Stage ごと）では見ない。まだ pack が来ていないだけなので。
    if (!requireForks || !DEEP_KINDS.has(group.kind)) continue;
    for (const column of FORK_COLUMNS) {
      const forked = group.rows.some((row) => row.x === column
        && (group.byKey.get(row.parentKey)?.children.length ?? 0) >= 2);
      if (!forked) {
        problems.push(`${at}: x=${column} で主要ルートが2方向へ分かれていない`
          + `（issue #137 §深さと分岐：x=3 が1回目、x=5 が2回目の役割分岐）`);
      }
    }
    const finalColumn = FINAL_COLUMNS[group.kind];
    const finals = group.rows.filter((row) => row.x === finalColumn);
    if (finals.length < MIN_FINAL_NODES) {
      problems.push(`${at}: x=${finalColumn} の最終到達点が ${finals.length} 件しかない`
        + `（${MIN_FINAL_NODES} 件以上。複数の到達点からビルドを選べること）`);
    }
  }

  return problems;
}
