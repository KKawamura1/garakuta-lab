// **R8 §8.1 の anti-stall 不変条件を、content 形状から機械的に診断する。**
//
// R8 Implementation Phase 1 step 3:
//   「healを応急処置、補給治療、遠征中に戻らないchargeへ分類し、AP/RPだけで
//    古い損傷を反復回復する経路をvalidatorで拒否する。」
//
// v1 schema では active skill は `apCost`（毎round全回復するAP）だけを
// コストに持てる（`ecology/validate.mjs` の active skill 検査に costs 配列は無い。
// lose_hp / consume_barrier / wear_equipment 等の有限コストは reactive rule の
// `costs` にしか書けない）。したがって **heal effect を持つ active skill は、
// 構造上つねに「round ごとに戻る資源だけで発動できる heal」になる。**
//
// 敵を1体残して round を稼げば、この形の active heal は無制限に撃てる
// （AP が毎round戻るので）。これは R8 §8.1
// 「敵を一体残して追加roundを経過させても...次戦へ持ち越すHPは改善しない」
// に反する。
//
// 許可する形は2つだけ:
//   1. reactive rule で `damage_taken` を listenTo し、その chain 内でだけ
//      発火する（`limit: {scope: "chain", count: 1}` 等）。同じ被弾を
//      二重に治療できない。R8 §9.1 の「応急処置」。
//   2. RunState 側の有限資源（supplies）を消費する camp 治療。これは
//      battle engine の外（progression.mjs）で完結するので、この検査の対象外。
//
// 現状は `mend`（baseline）と `triage`（pack_care）が (1) にも (2) にも
// 当たらない active heal として検出される。これは意図的に緩めていない
// ——本票は「通った」ことを報告するのではなく、直すべき箇所を報告する。
// 詳細と提案は analysis/experiments/exp-18/R8_IMPLEMENTATION_PHASE0_FREEZE.md §3。
//
// **鳴ることを確かめてある**（末尾の自己検査）。

import { PLAYABLE_CONTENT } from "../ecology/content/index.mjs";

function healEffectsOf(definition) {
  const found = [];
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    if (node.type === "heal") found.push(node);
    for (const value of Object.values(node)) walk(value);
  };
  walk(definition);
  return found;
}

// reactive skill が「同じ被弾 chain 内だけ」に閉じているかどうか。
// listenTo が damage_taken 系か excess_healing（既に上流で damage 由来に
// 限定されている）で、chain 単位の limit を持つものだけを合格とする。
const SAFE_LISTEN_TO = new Set(["damage_taken", "excess_healing"]);

function auditActiveSkills(bundle) {
  const violations = [];
  for (const [id, skill] of Object.entries(bundle.activeSkills ?? {})) {
    if (healEffectsOf(skill).length === 0) continue;
    // active skill は v1 schema 上 apCost 以外の有限コストを持てない
    // （ecology/validate.mjs 656-682 を参照。costs 配列は reactive rule のみ）。
    violations.push({
      id,
      kind: "active",
      reason: "heal effect を持つ active skill は apCost（毎round回復）以外の"
        + "コストを持てず、round を稼げば無制限に発動できる",
    });
  }
  return violations;
}

function auditReactiveSkills(bundle) {
  const violations = [];
  for (const [id, skill] of Object.entries(bundle.reactiveSkills ?? {})) {
    if (healEffectsOf(skill).length === 0) continue;
    const rule = skill.rule ?? {};
    const chainScoped = rule.limit?.scope === "chain" && (rule.limit?.count ?? Infinity) <= 1;
    const safeListenTo = SAFE_LISTEN_TO.has(rule.listenTo);
    if (!safeListenTo || !chainScoped) {
      violations.push({
        id,
        kind: "reactive",
        reason: !safeListenTo
          ? `listenTo "${rule.listenTo}" が damage_taken / excess_healing のいずれでもない`
          : "chain 単位の limit（count 1以下）を持たない。同じ被弾を複数回治療できる可能性がある",
      });
    }
  }
  return violations;
}

function audit(bundle) {
  return [...auditActiveSkills(bundle), ...auditReactiveSkills(bundle)];
}

const violations = audit(PLAYABLE_CONTENT);

// 参照点。**この検査が本当に引っかかるのかを、ここで確かめる。**
{
  const badBundle = {
    activeSkills: {
      free_heal: { id: "free_heal", apCost: 1, effects: [{ type: "heal", amount: { type: "constant", value: 5 } }] },
    },
    reactiveSkills: {
      unbounded_heal: {
        id: "unbounded_heal",
        rule: {
          listenTo: "round_ended",
          effects: [{ type: "heal", amount: { type: "constant", value: 5 } }],
          limit: { scope: "battle", count: 99 },
        },
      },
      proper_emergency: {
        id: "proper_emergency",
        rule: {
          listenTo: "damage_taken",
          effects: [{ type: "heal", amount: { type: "event_value_scaled", key: "amount" } }],
          limit: { scope: "chain", count: 1 },
        },
      },
    },
  };
  const selfCheck = audit(badBundle);
  const flaggedIds = selfCheck.map((v) => v.id);
  const ok = flaggedIds.includes("free_heal") && flaggedIds.includes("unbounded_heal")
    && !flaggedIds.includes("proper_emergency");
  if (!ok) {
    console.error("ecology-anti-stall audit: 参照点が壊れている（既知の違反を検出できない、"
      + "または安全な形を誤検出した）。");
    process.exit(1);
  }
}

if (violations.length) {
  console.log("ecology-anti-stall audit: " + violations.length + " 件の anti-stall 違反候補:");
  for (const v of violations) {
    console.log(`  [${v.kind}] ${v.id}: ${v.reason}`);
  }
  console.log(
    "\nこれは意図的に非ゼロで終了する診断である。ファイル名を `*smoke*` にしていないのは"
    + "意図的で、analysis/check-all.sh の `ls analysis/*smoke*.mjs` 自動収集（push ごとの"
    + "fast path）に載せず、直すまで毎pushを赤くしないため。"
    + "\n詳細と修正案は analysis/experiments/exp-18/R8_IMPLEMENTATION_PHASE0_FREEZE.md §3。",
  );
  process.exit(1);
}

console.log("ecology-anti-stall audit: 違反なし。");
