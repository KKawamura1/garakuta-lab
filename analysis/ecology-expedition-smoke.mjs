// **12戦の遠征が、実際に通せる形になっているか。**
//
// R7 §8 は「まず Difficulty 0 の reference encounter を固定し、unit 層を調整する」
// と決めている。ここはその reference を**測る側**で、調整はしない。
//
// 見るのは勝率ではない。次の3つだけを見る。
//
//   1. 12戦とも決着する（引き分け・膠着で止まらない）。
//   2. rank 0 を**通せる build が少なくとも一つある**。
//      これが無いと、難易度の解禁も活動資金の循環も動かない＝Phase B が死ぬ。
//   3. rank を上げると、同じ build の到達が伸びない（難易度が実際に効いている）。
//
// **reference build は「正解 build」ではない**（R6 §8）。広域・単体・防御という
// 別々の観測器で、全部を同じ勝率へ揃えることはしない。
//
// funを自動判定しない（R7 §7）。ここが言えるのは「通せる形かどうか」までである。

import { simulateBattle } from "../ecology/engine.mjs";
import { PLAYABLE_CONTENT } from "../ecology/content/index.mjs";
import {
  ENCOUNTERS_PER_RUN,
  MAX_DIFFICULTY_RANK,
  characterStats,
  composeEncounter,
  newProfile,
} from "../ecology/progression.mjs";
import { freshLoadout, makeExpeditionBattle } from "../ecology/playable-battles.mjs";

const problems = [];
const ROSTER = ["warden", "mender", "lancer", "scout", "guardian"];
const FORMATION = {
  warden: "front_left", lancer: "front_center", guardian: "front_right",
  mender: "rear_left", scout: "rear_right",
};
const profile = newProfile();

// 観測器。**技能点を配る順まで真似はしない**（それは遊ぶ人の判断）。
// 「初期のまま」「途中まで組んだ」「終盤まで組んだ」の3点を置いて、
// 遠征のどのあたりで build が要るのかを見る。
function build(kind) {
  const loadout = freshLoadout(ROSTER);
  if (kind === "starter") return loadout;

  loadout.tactics.warden = ["bulwark", "strike", "pierce_thrust"];
  // R8 Implementation Phase 1（続き）— mend/triage は reactive へ移った
  // ので、mender の active は strike + idle_shuffle、mend/triage は reactives へ。
  loadout.tactics.mender = ["strike", "idle_shuffle"];
  loadout.reactives.mender = ["mend", "triage"];
  loadout.tactics.lancer = ["strike", "heavy_swing", "rapid_cuts"];
  loadout.tactics.scout = ["mark_target", "reposition", "strike"];
  loadout.tactics.guardian = ["bulwark", "strike", "pierce_thrust"];
  for (const id of ROSTER) loadout.passives[id] = ["foundation_might", "foundation_vitality"];
  loadout.equipment.warden = ["standing_plate"];
  loadout.equipment.guardian = ["guard_lantern"];
  loadout.equipment.lancer = ["worn_greaves"];
  loadout.equipment.scout = ["tempo_buckle"];
  if (kind === "mid") return loadout;

  // 終盤：受けの厚い相手へ貫きと行・列、装備を2枠まで埋めた形。
  loadout.tactics.lancer = ["pierce_thrust", "heavy_swing", "rapid_cuts"];
  loadout.tactics.scout = ["row_sweep", "column_thrust", "strike"];
  loadout.reactives.warden = ["cover_ally", "brace_after_hit", "guard_step"];
  loadout.reactives.mender = ["overflow_care", "triage_relay", "urging"];
  loadout.reactives.lancer = ["counter_blow", "scavenge_ap", "damage_echo"];
  loadout.reactives.scout = ["guard_step", "counter_blow", "scavenge_ap"];
  loadout.reactives.guardian = ["cover_ally", "brace_after_hit", "damage_echo"];
  loadout.equipment.warden = ["standing_plate", "bastion_shell"];
  loadout.equipment.guardian = ["guard_lantern", "worn_greaves"];
  loadout.equipment.lancer = ["quickstrap", "tempo_buckle"];
  loadout.equipment.scout = ["reserve_coil"];
  return loadout;
}

// 一遠征を通す。**負けたらそこで止める**（補給の再挑戦はここでは使わない。
// 同じ入力で同じ結果になるので、再挑戦は編成を変えたときだけ意味がある）。
function runExpedition(loadout, rank) {
  const rows = [];
  for (let index = 1; index <= ENCOUNTERS_PER_RUN; index += 1) {
    const composed = composeEncounter(index, rank);
    const battle = makeExpeditionBattle(composed, ROSTER, loadout, "reference", FORMATION, {
      statsFor: (id) => characterStats(profile, id),
    });
    const result = simulateBattle(battle, PLAYABLE_CONTENT, { equipmentBreaks: false });
    rows.push({ index, kind: composed.kind, result: result.result, rounds: result.roundsUsed, reason: result.reason });
    if (result.result !== "win") break;
  }
  return rows;
}

const table = {};
for (const kind of ["starter", "mid", "late"]) {
  const loadout = build(kind);
  table[kind] = {};
  for (let rank = 0; rank <= MAX_DIFFICULTY_RANK; rank += 1) {
    const rows = runExpedition(loadout, rank);
    const cleared = rows.filter((row) => row.result === "win").length;
    table[kind][rank] = { cleared, rows };
    for (const row of rows) {
      // 引き分け・膠着で止まる戦闘があると、遠征が進まない。
      if (row.result === "draw" || row.reason === "stalemate") {
        problems.push(`${kind} / rank ${rank} / 第${row.index}戦が決着しない（${row.reason}）`);
      }
    }
  }
}

// 1. rank 0 を通せる build が少なくとも一つある。
const clearedAtZero = Object.entries(table)
  .filter(([, ranks]) => ranks[0].cleared === ENCOUNTERS_PER_RUN)
  .map(([kind]) => kind);
if (!clearedAtZero.length) {
  problems.push(
    "難易度0を通せる reference build が一つも無い。"
    + "難易度の解禁も活動資金の循環も始まらないので、encounter 層を見直すこと"
    + "（R7 §8：動かしてよい層は一度に一つ）。",
  );
}

// 2. rank を上げたら、同じ build の到達が伸びない。
for (const [kind, ranks] of Object.entries(table)) {
  for (let rank = 1; rank <= MAX_DIFFICULTY_RANK; rank += 1) {
    if (ranks[rank].cleared > ranks[0].cleared) {
      problems.push(`${kind} が rank ${rank} で rank 0 より先へ進んでいる（難易度が効いていない）`);
    }
  }
}

// 3. 初期構成のままで12戦を通せてしまわない。
//    通せるなら、遠征のあいだ何を組んでも同じということになる。
if (table.starter[0].cleared === ENCOUNTERS_PER_RUN) {
  problems.push("初期構成のまま12戦を通せてしまう（build が結果を動かしていない）");
}

const line = (kind) => Object.entries(table[kind])
  .map(([rank, entry]) => `r${rank}:${entry.cleared}`).join(" ");
console.log("  到達戦数（build × rank）");
for (const kind of ["starter", "mid", "late"]) console.log(`    ${kind.padEnd(8)} ${line(kind)}`);
console.log("  第12戦の決着:", table.late[0].rows.at(-1)?.result ?? "-",
  `${table.late[0].rows.at(-1)?.rounds ?? "-"}ラウンド`);

if (problems.length) {
  console.error("ecology-expedition smoke: 通らない。");
  for (const problem of problems) console.error("  - " + problem);
  process.exit(1);
}
console.log(
  `ecology-expedition smoke: ${ENCOUNTERS_PER_RUN}戦 × rank 0〜${MAX_DIFFICULTY_RANK} が決着し、`
  + `難易度0は ${clearedAtZero.join(" / ")} で通せる`,
);
