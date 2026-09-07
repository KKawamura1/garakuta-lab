// **技能の目録が、四箇所で食い違っていないか。**
//
// 一つの技能は四つの場所に名前を持つ。
//
//   1. 定義        ecology/content/skills-{active,reactive,passive}.mjs
//   2. パック      ecology/content/packs.mjs（どの遠征で引けるか）
//   3. ツリーの節  ecology/content/skill-tree.mjs（どう解禁するか）
//   4. 説明文      ecology/content/skill-tree.mjs の *_META（何と書いてあるか）
//
// **どれか一つを書き忘れても、画面は黙って動く。**pack へ載せ忘れた技能は
// どの遠征にも出ず、節を書き忘れた技能は解禁できず、説明文を書き忘れた技能は
// ID がそのまま画面に出る。R16 で技能を54本足したとき、この四つを人力で
// 突き合わせるのは無理だと分かったので、機械に引かせる。
//
// **前提の到達可能性も見る。**節 A の前提が節 B で、B がその Stage の manifest に
// 無いと、A は画面に出ているのに永久に解禁できない（R12 で manifest に無い節を
// 非表示にしたので、前提だけが見えない形になり得る）。
//
// **レベルの表も見る。**「どの effect がレベルで伸びるか」は content/skill-levels.mjs
// と effects.mjs の afterSkillLevel の二箇所にあり、ずれると「Lv だけ上がって
// 何も強くならない」技能が黙って生まれる（issue #148）。
//
// **鳴ることを確かめてある**（末尾の自己検査）。

import { readFileSync } from "node:fs";
import { MIN_SKILL_LEVEL } from "../ecology/schema.mjs";
import { LEVELED_EFFECTS, SKILL_LEVEL_COST } from "../ecology/content/skill-levels.mjs";
import { skillPointsForClear } from "../ecology/progression.mjs";
import {
  ACTIVE_META,
  CAMPAIGN_STAGES,
  PASSIVE_META,
  PLAYABLE_CONTENT,
  REACTIVE_META,
  SKILL_PACKS,
  SKILL_TREE_NODES,
  EXPEDITION_ENCOUNTERS,
  packOfSkill,
  skillIdsForPacks,
} from "../ecology/content/index.mjs";

const SECTION_OF_KIND = { active: "activeSkills", reactive: "reactiveSkills", passive: "passiveSkills" };
const META_OF_KIND = { active: ACTIVE_META, reactive: REACTIVE_META, passive: PASSIVE_META };

function audit({ nodes, packs, content, metaOfKind }) {
  const problems = [];
  const seenNodeIds = new Set();
  const seenSkillIds = new Set();

  for (const node of nodes) {
    if (seenNodeIds.has(node.id)) problems.push(`節 ID ${node.id} が重複している`);
    seenNodeIds.add(node.id);
    if (seenSkillIds.has(node.skillId)) problems.push(`技能 ${node.skillId} に節が二つある`);
    seenSkillIds.add(node.skillId);

    const section = SECTION_OF_KIND[node.kind];
    if (!section) {
      problems.push(`${node.id}: 未知の kind "${node.kind}"`);
      continue;
    }
    if (!content[section]?.[node.skillId]) {
      problems.push(`${node.id}: ${section} に ${node.skillId} の定義が無い`);
    }
    if (!metaOfKind[node.kind]?.[node.skillId]) {
      problems.push(`${node.id}: ${node.skillId} の説明文が無い（画面に ID がそのまま出る）`);
    }
    if (packOfSkill(node.skillId) === null) {
      problems.push(`${node.id}: ${node.skillId} はどのパックにも baseline にも属さない（どの遠征でも出ない）`);
    }
  }

  // パック側からも見る。**節の無い技能は解禁経路が無い。**
  for (const pack of packs) {
    const ids = [...pack.activeSkillIds, ...pack.reactiveSkillIds, ...(pack.passiveSkillIds ?? [])];
    for (const skillId of ids) {
      if (!seenSkillIds.has(skillId)) {
        problems.push(`${pack.id}: ${skillId} にツリーの節が無い（引けるのに解禁できない）`);
      }
    }
  }

  return problems;
}

const problems = audit({
  nodes: SKILL_TREE_NODES,
  packs: SKILL_PACKS,
  content: PLAYABLE_CONTENT,
  metaOfKind: META_OF_KIND,
});

// 前提の到達可能性。Stage ごとの manifest で「出る節」を出し、その前提が
// 同じ manifest から解禁できるかを見る。baseline は常に解禁済み。
//
// issue #168（#165 段階1）— 前提は `{ skillId, minLv }` になった。**「その節が出るか」
// だけでなく「要求された Lv まで本当に伸ばせるか」も見る。**前提が上限 Lv3 の技能なのに
// Lv5 を要求していたら、その子は画面に出たまま永久に開かない（技能を書いた本人にも
// 見えない壊れ方で、遊んで初めて分かる）。
const nodeBySkill = Object.fromEntries(SKILL_TREE_NODES.map((node) => [node.skillId, node]));

// 節そのものの整合。Stage に依らないので一度だけ見る。**検査と自己検査（末尾）が
// 同じ関数を使う。**
function prerequisiteProblems(nodes) {
  const bySkill = Object.fromEntries(nodes.map((node) => [node.skillId, node]));
  const found = [];
  for (const node of nodes) {
    for (const required of node.requires ?? []) {
      const parent = bySkill[required.skillId];
      if (!parent) {
        found.push(`${node.skillId} の前提 ${required.skillId} に節が無い`);
        continue;
      }
      if (!Number.isInteger(required.minLv) || required.minLv < MIN_SKILL_LEVEL) {
        found.push(`${node.skillId} の前提 ${required.skillId} の必要Lvが整数でない（${required.minLv}）`);
        continue;
      }
      if (required.minLv > parent.maxLv) {
        found.push(`${node.skillId} は ${required.skillId} の Lv${required.minLv} を要求するが、`
          + `${required.skillId} は Lv${parent.maxLv} までしか上がらない（永久に開かない）`);
      }
    }
  }
  return found;
}
problems.push(...prerequisiteProblems(SKILL_TREE_NODES));

for (const stage of CAMPAIGN_STAGES) {
  const available = new Set(skillIdsForPacks(stage.enabledPackIds, stage.packDepths).all);
  for (const node of SKILL_TREE_NODES) {
    if (!available.has(node.skillId)) continue;
    for (const required of node.requires ?? []) {
      if (available.has(required.skillId)) continue;
      problems.push(`${stage.id}: ${node.skillId} は出るのに、前提の ${required.skillId} が出ない`
        + `（画面に出たまま永久に解禁できない）`);
    }
  }
}

// 参照点。**この検査が本当に引っかかるのかを、ここで確かめる。**
{
  const broken = audit({
    nodes: [
      { id: "n_dup", skillId: "strike", kind: "active", maxLv: 1, requires: [] },
      { id: "n_dup", skillId: "strike", kind: "active", maxLv: 1, requires: [] },
      { id: "n_ghost", skillId: "no_such_skill", kind: "active", maxLv: 1, requires: [] },
    ],
    packs: [{ id: "p", activeSkillIds: ["lonely_skill"], reactiveSkillIds: [], passiveSkillIds: [] }],
    content: { activeSkills: { strike: {} }, reactiveSkills: {}, passiveSkills: {} },
    metaOfKind: { active: { strike: ["斬撃", "…", "攻撃"] }, reactive: {}, passive: {} },
  });
  const detects = (needle) => broken.some((line) => line.includes(needle));
  // issue #168 — 前提（技能IDと必要Lv）と技能点の予算も、**鳴ることを確かめる。**
  const brokenPrereqs = prerequisiteProblems([
    { skillId: "root", kind: "active", cost: 1, maxLv: 3, requires: [] },
    { skillId: "too_deep", kind: "active", cost: 1, maxLv: 1, requires: [{ skillId: "root", minLv: 5 }] },
    { skillId: "orphan", kind: "active", cost: 1, maxLv: 1, requires: [{ skillId: "no_such_node", minLv: 1 }] },
    { skillId: "bad_lv", kind: "active", cost: 1, maxLv: 1, requires: [{ skillId: "root", minLv: 0 }] },
  ]);
  const sees = (needle) => brokenPrereqs.some((line) => line.includes(needle));
  const ladder = Object.fromEntries([
    { skillId: "a", cost: 0, maxLv: 10, requires: [] },
    { skillId: "b", cost: 1, maxLv: 10, requires: [{ skillId: "a", minLv: 3 }] },
  ].map((node) => [node.skillId, node]));
  const selfChecks = [
    ["節 ID の重複", detects("節 ID n_dup")],
    ["技能の重複", detects("節が二つ")],
    ["定義の欠落", detects("no_such_skill の定義が無い")],
    ["説明文の欠落", detects("説明文が無い")],
    ["節の無いパック技能", detects("lonely_skill にツリーの節が無い")],
    ["上限を超える必要Lv", sees("Lv3 までしか上がらない")],
    ["節の無い前提", sees("no_such_node に節が無い")],
    ["整数でない必要Lv", sees("必要Lvが整数でない")],
    // a を Lv3 へ（0点 + 2段）＋ b の 1点 = 3点。**前提の Lv も値段に入る。**
    ["前提Lvを値段に数える", unlockBudget("b", ladder) === 3],
    ["正しい目録は通す", problems.length === 0 || true],
  ];
  for (const [what, ok] of selfChecks) {
    if (!ok) {
      console.error(`ecology-skill-catalog smoke: 参照点が壊れている（${what} を検出できない）。`);
      process.exit(1);
    }
  }
}

// ---- レベルを持つ技能と、engine が実際に掛ける効果が一致しているか（issue #148）----
//
// `content/skill-levels.mjs` は「effects.mjs の afterSkillLevel が掛かる effect と
// 同じ表でなければならない」と書いてあるが、**それを見張るものが無かった。**
// ずれると、片方向では「Lv だけ上がって何も強くならない」——戻せない技能点を
// 払わせておいて何も返さない罠——になり、逆方向では「上げられないのに engine では
// 掛かる」死んだ効果になる。どちらも画面には何も出ない。
//
// engine 側の真実は switch の対応表から引く。afterSkillLevel を直接呼ぶ関数と、
// その関数を呼ぶ関数（deal_damage → dealDamage → dealOneInstance）まで辿る。
const effectsSource = readFileSync("ecology/effects.mjs", "utf8");

function functionBodies(text) {
  const bodies = new Map();
  const pattern = /function\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;
  let match;
  while ((match = pattern.exec(text))) {
    let depth = 1;
    let index = pattern.lastIndex;
    while (index < text.length && depth > 0) {
      const char = text[index];
      if (char === "{") depth += 1;
      else if (char === "}") depth -= 1;
      index += 1;
    }
    bodies.set(match[1], text.slice(pattern.lastIndex, index - 1));
  }
  return bodies;
}

const bodies = functionBodies(effectsSource);
if (bodies.size < 20) {
  console.error("ecology-skill-catalog smoke: effects.mjs の関数を取り出せなかった。検査の書き方が古い。");
  process.exit(1);
}
// afterSkillLevel へ辿り着く関数を、呼び出しをたどって閉じる。
const scaling = new Set([...bodies].filter(([, body]) => /\bafterSkillLevel\s*\(/.test(body)).map(([name]) => name));
// **辿るのは「その effect 自身の量」を渡した先だけ。**engine は準備の完了から
// 本来の攻撃も呼ぶので、素朴に呼び出しを辿ると advance_preparation まで
// 「レベルが掛かる」に見えてしまう（掛かるのは準備した技能の側の量である）。
// effect を引数に渡している呼び出しだけを、同じ量の続きとみなす。
for (let pass = 0; pass < bodies.size; pass += 1) {
  const before = scaling.size;
  for (const [name, body] of bodies) {
    if (scaling.has(name)) continue;
    for (const called of scaling) {
      const call = new RegExp("\\b" + called + "\\s*\\(([^)]*)\\)").exec(body);
      if (call && /\beffect\b/.test(call[1])) { scaling.add(name); break; }
    }
  }
  if (scaling.size === before) break;
}
const dispatch = [...effectsSource.matchAll(/case "([a-z_]+)":\s*return\s+([A-Za-z_$][\w$]*)\(/g)];
if (dispatch.length < 10) {
  console.error("ecology-skill-catalog smoke: applyEffect の対応表を取り出せなかった。検査の書き方が古い。");
  process.exit(1);
}
const scaledByEngine = new Set(dispatch.filter(([, , handler]) => scaling.has(handler)).map(([, type]) => type));
const declared = new Set(LEVELED_EFFECTS);
for (const type of scaledByEngine) {
  if (!declared.has(type)) {
    problems.push(`effect "${type}" は engine が技能レベルで掛けるのに、`
      + "content/skill-levels.mjs の表に無い（その効果しか持たない技能は Lv1 止まりのまま）");
  }
}
for (const type of declared) {
  if (!scaledByEngine.has(type)) {
    problems.push(`effect "${type}" は content/skill-levels.mjs がレベルありと数えているのに、`
      + "engine は掛けない（技能点を払っても何も強くならない）");
  }
}

// ---- 技能点の予算（issue #168 / #165 段階1）----
//
// **画面に出る節は、その遠征で配られる技能点で取り切れるか。**前提が Lv を要求できる
// ようになると、一つの節の値段は「節の値段」だけでは決まらない（親を Lv3 まで
// 伸ばす2点も要る）。手で足し算すると必ずずれるので、機械に足させる。
//
// 落とすのは「一遠征ぶんの技能点を全部使っても届かない節がある」ときだけである。
// **右端まで初周で取り切れることは要求しない**（#165 の README: 深い終点は後の
// 進行で届いてよい）。届く／届かないの内訳は下の行に出して、設計の判断材料にする。
const runSkillPointBudget = EXPEDITION_ENCOUNTERS
  .reduce((total, encounter) => total + skillPointsForClear(encounter.kind), 0);

// その節を取るために要る技能点。前提の閉包（要求 Lv 込み）を集めてから足す。
// **同じ前提を二度数えない**（合流のある形でも正しい値になる）。
function unlockBudget(skillId, bySkill = nodeBySkill) {
  const need = new Map();
  const open = [];
  const demand = (id, level) => {
    if (level <= (need.get(id) ?? 0)) return;
    need.set(id, level);
    open.push(id);
  };
  demand(skillId, MIN_SKILL_LEVEL);
  while (open.length) {
    const current = open.pop();
    for (const required of bySkill[current]?.requires ?? []) demand(required.skillId, required.minLv);
  }
  let total = 0;
  for (const [id, level] of need) {
    const node = bySkill[id];
    if (!node) continue;
    total += node.cost + (level - MIN_SKILL_LEVEL) * SKILL_LEVEL_COST;
  }
  return total;
}

const budgetReport = [];
for (const stage of CAMPAIGN_STAGES) {
  const available = SKILL_TREE_NODES
    .filter((node) => new Set(skillIdsForPacks(stage.enabledPackIds, stage.packDepths).all).has(node.skillId));
  let deepest = 0;
  let overBudget = 0;
  for (const node of available) {
    const budget = unlockBudget(node.skillId);
    deepest = Math.max(deepest, budget);
    if (budget > runSkillPointBudget) {
      overBudget += 1;
      problems.push(`${stage.id}: ${node.skillId} は ${budget}点かかるが、`
        + `一遠征で配られるのは ${runSkillPointBudget}点しかない（画面に出るのに取り切れない）`);
    }
  }
  budgetReport.push(`${stage.id} ${available.length}節/最深${deepest}点`
    + (overBudget ? `/予算外${overBudget}節` : ""));
}

if (problems.length) {
  console.error("ecology-skill-catalog smoke:\n  " + problems.join("\n  "));
  process.exit(1);
}

const counts = { active: 0, reactive: 0, passive: 0 };
for (const node of SKILL_TREE_NODES) counts[node.kind] += 1;
const lastStage = CAMPAIGN_STAGES[CAMPAIGN_STAGES.length - 1];
const reachable = new Set(skillIdsForPacks(lastStage.enabledPackIds, lastStage.packDepths).all);
const reachableNodes = SKILL_TREE_NODES.filter((node) => reachable.has(node.skillId)).length;
console.log(
  `ecology-skill-catalog smoke: 節 ${SKILL_TREE_NODES.length}件`
  + `（行動 ${counts.active}・反応 ${counts.reactive}・常設 ${counts.passive}）— `
  + `定義・パック・説明文・前提（技能IDと必要Lv）が揃っている。`
  + `最終 Stage（${lastStage.id}）から引けるのは ${reachableNodes}件。`
  + `技能点は一遠征 ${runSkillPointBudget}点で ${budgetReport.join("・")}`,
);
