// **縦切り。5人が揃った Stage 3 から、三つの違う戦い方が立ち上がるか。**
//
// issue #176（#165 段階2）。05-playtest-gates の合格目安は「3つの異なる構成が
// 第4〜6戦までに動く」「全構成が同じ主攻撃+回復で倍率だけ違う、は失敗」である。
// **倍率違いを不合格にするには、数ではなく出来事の種類を見るしかない**ので、
// ここでは三つの構成を data として宣言し、同じ seed・同じ盤面で実際に engine へ
// 通して、出てきた event 列を比べる。
//
// **場所は Stage 0 ではなく Stage 3 である**（作者判断）。2人・1pack の Stage 0 は
// 「単純に勝てる導入」に振り、語彙が揃って選択肢が本当に分かれるのは5人・4pack の
// Stage 3 だからである。Stage 0 で三構成を作ると、盤面を難しくする方向でしか
// 差を作れず、導入として本末転倒になる。
//
// 見るのは次の五つ。**どれも fun の証明ではない**——「三つが同じ物になっていない」
// ことと、「宣言した核が第4〜6戦の時点で実際に取り切れる」ことの確認である。
//
//   1. 取得計画が Stage 3 の manifest と技能点の予算に収まる（#169 の予算監査と同じ数え方）
//   2. 宣言した核が、宣言した戦闘までに揃う（第4〜6戦まで。最終戦の報酬待ちは失格）
//   3. 各構成に代替入口が2つ以上あり、どちらから入っても核へ届く
//   4. 同じ seed・同じ敵に対して、三構成の event 列が**種類の水準で**違う
//   5. 三構成とも第6戦まで実際に勝ち切る（紙の上だけの構成を残さない）
//
// **鳴ることを確かめてある**（末尾の自己検査）。

import {
  CAMPAIGN_STAGES,
  SKILL_TREE_NODES,
  skillIdsForPacks,
  unmetPrerequisites,
} from "../ecology/content/index.mjs";
import { MIN_SKILL_LEVEL } from "../ecology/schema.mjs";
import { SKILL_LEVEL_COST } from "../ecology/content/skill-levels.mjs";
import {
  commitBattleResult,
  newProfile,
  newRun,
  rewardOffer,
  skillPointsForClear,
} from "../ecology/progression.mjs";
import { RARITIES } from "../ecology/content/affixes.mjs";
import { expeditionEncounter } from "../ecology/content/expedition.mjs";
import { simulateNextBattle } from "../ecology/playable-battles.mjs";
import { CHARACTER_DEFINITIONS } from "../ecology/content/roster.mjs";

const STAGE_SEQUENCE = 3;
const STAGE = CAMPAIGN_STAGES.find((stage) => stage.sequence === STAGE_SEQUENCE);
if (!STAGE) {
  throw new Error("Stage 3 is not defined in campaign stages");
}
const ROSTER = [...STAGE.castCharacterIds];
const SEED = "stage3-vertical-slice";
// 見るのは第6戦まで。**核の成立は第4〜6戦**という関門がそこで閉じる。
// `STAGE_BUILDS_LAST` で伸ばせるが、取得計画は第6戦までしか書いていないので、
// それ以降は「点を余らせたまま進む」測定になる（通しのバランスはここの仕事ではない）。
const LAST_ENCOUNTER = Number(process.env.STAGE_BUILDS_LAST ?? 6);

const nodeBySkill = Object.fromEntries(SKILL_TREE_NODES.map((node) => [node.skillId, node]));
const stageSkillIds = new Set(skillIdsForPacks(STAGE.enabledPackIds, STAGE.packDepths).all);
const starterOf = Object.fromEntries(CHARACTER_DEFINITIONS.map((entry) => [entry.id, entry]));

// ============================================================ 三つの構成
//
// **5人と4 pack が揃った盤面から、三つの engine を立てる。**
// 分かれ目は「敵の一撃をどう無力化するか」ではなく、**何を主な出来事にするか**である。
//
//   刃で削る   … 当てた一撃そのものを重くし、怯みで相手の出力を細くする
//   隊列で守る … 受け止めた回数を資源にし、止めた拍から盾と集中が回る
//   順番を作る … 行動権と準備を作り替え、遅い大技に手番を通す
//
// `plan` は取得順。`before` はその戦闘の**開始前**という意味で、`before: 1` は
// 出発時（勝利報酬がまだ0点）を指す。`level` は技能レベルを1段上げる（1点）。
// **初期技能とその前提は無償**なので、plan に書くのは買い足す分だけである。
const BUILDS = Object.freeze([
  Object.freeze({
    id: "edge",
    displayName: "刃で削る",
    question: "硬い相手を抜くか、相手の出力そのものを細くするか",
    engine: Object.freeze({
      source: "当たった一撃（damage_taken を出す側）",
      converter: "受け崩し・貫き突きが受けを無視し、足を払うが怯みへ変える",
      payoff: "怯みは相手が**出す**ダメージを削る。倒す前から被害が減る",
      brake: "怯みはラウンドで消える。硬い相手ほど、抜く一撃に手番を先に払う",
    }),
    entries: Object.freeze([
      Object.freeze({ characterId: "warden", skillId: "pierce_thrust" }),
      Object.freeze({ characterId: "lancer", skillId: "finishing_thrust" }),
    ]),
    core: Object.freeze({
      by: 5,
      warden: Object.freeze(["pierce_thrust", "rear_hunt", "guard_crush"]),
      lancer: Object.freeze(["finishing_thrust", "hamstring"]),
      mender: Object.freeze([]),
      guardian: Object.freeze([]),
      tactician: Object.freeze([]),
    }),
    plan: Object.freeze([
      Object.freeze({ before: 2, characterId: "warden", skillId: "pierce_thrust" }),
      Object.freeze({ before: 3, characterId: "warden", skillId: "rear_hunt" }),
      Object.freeze({ before: 4, characterId: "warden", skillId: "guard_crush" }),
      Object.freeze({ before: 4, characterId: "lancer", skillId: "finishing_thrust" }),
      Object.freeze({ before: 5, characterId: "lancer", skillId: "hamstring" }),
      Object.freeze({ before: 6, characterId: "warden", skillId: "foundation_might" }),
    ]),
    tactics: Object.freeze({
      warden: ["guard_crush", "rear_hunt", "pierce_thrust", "steady_cut"],
      mender: ["aimed_shot"],
      lancer: ["hamstring", "finishing_thrust", "pierce_thrust"],
      guardian: ["pierce_thrust", "steady_cut"],
      tactician: ["mark_target"],
    }),
    reactives: Object.freeze({
      warden: ["mend"],
      mender: ["triage", "emergency_treatment"],
      lancer: ["triage"],
      guardian: ["counter_blow", "scavenge_ap"],
      tactician: ["counter_blow", "scavenge_ap"],
    }),
  }),
  Object.freeze({
    id: "wall",
    displayName: "隊列で守る",
    question: "止めた回数を、次の何に変えるか",
    engine: Object.freeze({
      source: "受け構えで一撃を止めた拍（damage_blocked / block_spent）",
      converter: "受けの受け渡しが盾を配り、受け返しの集中が集中へ変える",
      payoff: "止めるほど前列が保ち、止めた拍が別の役割の資源になる",
      brake: "受け構えは回数。多段に剥がされ、反応点も止めるたびに減る",
    }),
    entries: Object.freeze([
      Object.freeze({ characterId: "guardian", skillId: "brace_for_impact" }),
      Object.freeze({ characterId: "lancer", skillId: "guard_the_marked" }),
      Object.freeze({ characterId: "mender", skillId: "sustaining_ward" }),
    ]),
    core: Object.freeze({
      by: 5,
      warden: Object.freeze([]),
      lancer: Object.freeze(["guard_the_marked"]),
      guardian: Object.freeze(["brace_for_impact", "bulwark_of_will"]),
      tactician: Object.freeze(["opening_guard"]),
      mender: Object.freeze(["sustaining_ward"]),
    }),
    plan: Object.freeze([
      Object.freeze({ before: 2, characterId: "guardian", skillId: "brace_for_impact" }),
      Object.freeze({ before: 3, characterId: "guardian", skillId: "bulwark_of_will" }),
      Object.freeze({ before: 4, characterId: "lancer", skillId: "guard_the_marked" }),
      Object.freeze({ before: 4, characterId: "tactician", skillId: "foundation_guard" }),
      Object.freeze({ before: 5, characterId: "tactician", skillId: "opening_guard" }),
      // **前提 Lv の道。**傷へ盾を Lv3 まで厚くして初めて、戦闘のあいだ消えない壁が置ける。
      Object.freeze({ before: 3, characterId: "mender", level: "shield_the_wounded" }),
      Object.freeze({ before: 4, characterId: "mender", level: "shield_the_wounded" }),
      Object.freeze({ before: 5, characterId: "mender", skillId: "sustaining_ward" }),
      Object.freeze({ before: 6, characterId: "guardian", skillId: "shield_wall" }),
    ]),
    tactics: Object.freeze({
      warden: ["steady_cut"],
      mender: ["sustaining_ward", "shield_the_wounded", "aimed_shot"],
      lancer: ["heavy_swing", "pierce_thrust"],
      guardian: ["shield_wall", "bulwark_of_will", "brace_for_impact", "spread_the_guard"],
      tactician: ["spread_the_guard", "relay_order"],
    }),
    reactives: Object.freeze({
      warden: ["mend"],
      mender: ["triage", "emergency_treatment"],
      lancer: ["guard_the_marked", "cover_ally", "shield_handoff"],
      guardian: ["brace_after_hit", "scavenge_ap"],
      tactician: ["block_focus", "absorb_shock", "brace_after_hit"],
    }),
  }),
  Object.freeze({
    id: "tempo",
    displayName: "順番を作る",
    question: "遅い一撃に、どうやって手番を通すか",
    engine: Object.freeze({
      source: "行動権と準備（resource_gained / preparation_*）",
      converter: "号令と背を押すが手番を渡し、狙いを澄ますが集中を積む",
      payoff: "大溜めのような遅い一撃が、削られる前に完成する",
      brake: "渡しただけで手数は増えない。渡した側はその round を捨てている",
    }),
    entries: Object.freeze([
      Object.freeze({ characterId: "mender", skillId: "heavy_swing" }),
      Object.freeze({ characterId: "tactician", skillId: "hasten_ally" }),
    ]),
    // **溜め突きは技（focus）で伸びる。**腕力50・技術6のゴウが溜めても何も起きない。
    // 隊で技術が一番高いのはツグミ（52）なので、**溜めるのは主火力の後衛**である。
    // 背を押す（隊列の最後へ行動権）は、その後衛へ渡すためにある。
    core: Object.freeze({
      by: 5,
      warden: Object.freeze([]),
      mender: Object.freeze(["steady_cut", "heavy_swing"]),
      lancer: Object.freeze([]),
      guardian: Object.freeze([]),
      tactician: Object.freeze(["hasten_ally", "foundation_ap"]),
    }),
    plan: Object.freeze([
      Object.freeze({ before: 2, characterId: "mender", skillId: "steady_cut" }),
      Object.freeze({ before: 3, characterId: "mender", skillId: "heavy_swing" }),
      Object.freeze({ before: 4, characterId: "tactician", skillId: "hasten_ally" }),
      Object.freeze({ before: 5, characterId: "tactician", skillId: "foundation_ap" }),
      Object.freeze({ before: 5, characterId: "mender", skillId: "foundation_focus" }),
      Object.freeze({ before: 6, characterId: "tactician", skillId: "held_breath" }),
    ]),
    // **溜めは1回まで。**大溜め（準備3回）は行動権を4つ食うので、渡す側が毎ラウンド
    // 手番を捨てても間に合わない。渡した行動権で「準備1回の大技を毎ラウンド完成させる」
    // ところに利得を置く。
    tactics: Object.freeze({
      warden: ["steady_cut"],
      mender: ["heavy_swing", "aimed_shot"],
      // **溜めるのは一人だけ。**二人が同時に溜めると、渡せる行動権が足りない。
      // 後衛狩りは条件つきなので、後列の敵が居る拍だけ出て、居なければ貫き突きへ落ちる。
      lancer: ["rear_hunt", "pierce_thrust"],
      guardian: ["column_thrust", "steady_cut"],
      // **背を押すを毎ラウンド出し続けるのがこの構成の本体。**隊列の最後＝溜めている
      // 後衛へ行動権が渡り、準備1回の大技が毎ラウンド完成する。渡す側は手番を捨てて
      // いるので手数は増えない。増えるのは一撃の質である。
      tactician: ["hasten_ally", "relay_order"],
    }),
    reactives: Object.freeze({
      warden: ["mend"],
      mender: ["triage", "emergency_treatment"],
      lancer: ["triage", "cover_ally"],
      guardian: ["scavenge_ap", "brace_after_hit"],
      tactician: ["patient_step", "scavenge_ap"],
    }),
  }),
]);

// ============================================================ 取得の帳簿
//
// 一遠征の技能点は #169 の予算監査と同じ数え方で出す。**その戦闘の開始前に
// 配られているのは、その一つ前までの勝利報酬だけ。**
function pointsBefore(index) {
  let total = 0;
  for (let i = 1; i < index; i += 1) total += skillPointsForClear(expeditionEncounter(i).kind);
  return total;
}

// その節を開くのに、**その人物があと何点払うか。**前提の閉包（要求 Lv 込み）を
// 足す数え方は analysis/ecology-skill-catalog-smoke.mjs の `unlockBudget` と同じで、
// 違うのは**初期技能ぶんを引く**ところ。加入時に無償で開いている節は、代替入口の
// 値段には入らない（入れると「ナギは既に持っているのに高い」と出る）。
function residualBudget(characterId, skillId) {
  const owned = starterClosure(characterId);
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
    for (const required of nodeBySkill[current]?.requires ?? []) demand(required.skillId, required.minLv);
  }
  let total = 0;
  for (const [id, level] of need) {
    const node = nodeBySkill[id];
    if (!node) continue;
    // 初期技能は Lv1 で開いている。要求がそれを超えるぶんだけ払う。
    const from = owned.has(id) ? MIN_SKILL_LEVEL : 0;
    if (from === 0) total += node.cost;
    total += Math.max(0, level - Math.max(from, MIN_SKILL_LEVEL)) * SKILL_LEVEL_COST;
  }
  return total;
}

// 初期技能は無償で、前提の閉包ごと開いている（playable-battles.mjs の
// initialUnlockedSkills と同じ考え方をここでも使う）。
function starterClosure(characterId) {
  const starter = starterOf[characterId];
  const seen = new Set();
  const open = ["strike", "mend", "bulwark", ...starter.starterTactics, ...starter.starterReactives];
  while (open.length) {
    const skillId = open.pop();
    if (seen.has(skillId)) continue;
    seen.add(skillId);
    for (const required of nodeBySkill[skillId]?.requires ?? []) open.push(required.skillId);
  }
  return seen;
}

// 取得計画を1手ずつ適用する。**払えない・前提が足りない・Stage に無い手は
// そこで問題として返す**（黙って飛ばすと、後の戦闘が嘘の編成で走る）。
function applyPlan(build) {
  const problems = [];
  const owned = Object.fromEntries(ROSTER.map((id) => [id, starterClosure(id)]));
  const levels = Object.fromEntries(ROSTER.map((id) => [id, {}]));
  const spent = Object.fromEntries(ROSTER.map((id) => [id, 0]));
  const at = `${build.id}`;

  const levelOf = (characterId, skillId) => (owned[characterId].has(skillId)
    ? (levels[characterId][skillId] ?? MIN_SKILL_LEVEL)
    : 0);

  const steps = [...build.plan].sort((a, b) => a.before - b.before);
  const snapshots = new Map();
  let cursor = 0;
  for (let index = 1; index <= LAST_ENCOUNTER; index += 1) {
    const budget = pointsBefore(index);
    while (cursor < steps.length && steps[cursor].before === index) {
      const step = steps[cursor];
      cursor += 1;
      const characterId = step.characterId;
      const skillId = step.skillId ?? step.level;
      const node = nodeBySkill[skillId];
      if (!node) {
        problems.push(`${at}: ${skillId} という節が無い`);
        continue;
      }
      if (!stageSkillIds.has(skillId)) {
        problems.push(`${at}: ${skillId} は ${STAGE.id} の manifest に無い`);
        continue;
      }
      if (step.level) {
        if (!owned[characterId].has(skillId)) {
          problems.push(`${at}: 第${index}戦前に ${characterId} が未取得の ${skillId} を伸ばそうとしている`);
          continue;
        }
        const next = levelOf(characterId, skillId) + 1;
        if (next > node.maxLv) {
          problems.push(`${at}: ${skillId} は Lv${node.maxLv} が上限なのに Lv${next} を要求している`);
          continue;
        }
        levels[characterId][skillId] = next;
        spent[characterId] += SKILL_LEVEL_COST;
      } else {
        if (owned[characterId].has(skillId)) {
          problems.push(`${at}: ${characterId} は ${skillId} を既に持っている（点の二重払い）`);
          continue;
        }
        const unmet = unmetPrerequisites(node, (required) => levelOf(characterId, required));
        if (unmet.length) {
          problems.push(`${at}: 第${index}戦前の ${characterId} は ${skillId} の前提`
            + `（${unmet.map((entry) => `${entry.skillId} Lv${entry.minLv}`).join("・")}）を満たしていない`);
          continue;
        }
        owned[characterId].add(skillId);
        spent[characterId] += node.cost;
      }
      if (spent[characterId] > budget) {
        problems.push(`${at}: 第${index}戦前に ${characterId} が ${spent[characterId]}点使っているが、`
          + `配られているのは ${budget}点しかない`);
      }
    }
    snapshots.set(index, {
      owned: Object.fromEntries(ROSTER.map((id) => [id, new Set(owned[id])])),
      levels: structuredClone(levels),
      spent: { ...spent },
      budget,
    });
  }
  return { problems, snapshots };
}

// ============================================================ 実際に走らせる
//
// **preview も本番も通る simulateNextBattle をそのまま使う。**この検査のためだけの
// 戦闘経路は作らない（作ると、検査が通っても画面が動かない形が生まれる）。
function loadoutFor(build, snapshot) {
  const pick = (characterId, ids) => ids.filter((id) => snapshot.owned[characterId].has(id));
  return {
    tactics: Object.fromEntries(ROSTER.map((id) => [id, pick(id, build.tactics[id] ?? [])])),
    reactives: Object.fromEntries(ROSTER.map((id) => [id, pick(id, build.reactives[id] ?? [])])),
    passives: Object.fromEntries(ROSTER.map((id) => [id, [...snapshot.owned[id]]
      .filter((skillId) => nodeBySkill[skillId]?.kind === "passive")])),
    equipment: Object.fromEntries(ROSTER.map((id) => [id, []])),
  };
}

function playThrough(build, snapshots, carried = null) {
  const profile = newProfile();
  let run = newRun(profile, {
    campaignStageSequence: STAGE.sequence,
    runSeed: SEED,
    runId: `${SEED}-${build.id}`,
    roster: ROSTER,
  });
  // 代表装備。**遠征ごとの生成品は content bundle に無い**ので、run が定義そのものを
  // 抱える（progression.runContentBundle が読む唯一の場所）。
  if (carried) {
    run = {
      ...run,
      inventory: [...run.inventory, carried.equipmentId],
      generatedEquipment: { ...run.generatedEquipment, [carried.equipmentId]: carried.item },
    };
  }
  const rows = [];
  for (let index = 1; index <= LAST_ENCOUNTER; index += 1) {
    const snapshot = snapshots.get(index);
    const loadout = loadoutFor(build, snapshot);
    if (carried) loadout.equipment[carried.characterId] = [carried.equipmentId];
    run = {
      ...run,
      loadout,
      runSkillLevels: structuredClone(snapshot.levels),
    };
    const { result } = simulateNextBattle(run, profile, index);
    const kinds = new Map();
    const skills = new Map();
    for (const event of result.events) {
      kinds.set(event.type, (kinds.get(event.type) ?? 0) + 1);
      // **「どの技能から、どの種類の出来事が出たか」**を鍵にする。量は入れない。
      const from = event.skillId ?? event.sourceDefinitionId ?? event.ruleId ?? null;
      if (from) skills.set(`${event.type}<${from}`, (skills.get(`${event.type}<${from}`) ?? 0) + 1);
    }
    rows.push({ index, result: result.result, rounds: result.roundsUsed, kinds, skills });
    if (process.env.STAGE_BUILDS_DUMP) {
      const hp = result.actors.filter((a) => a.instanceId.startsWith("a_"))
        .map((a) => `${a.instanceId.slice(2)} ${a.hp}/${a.maxHp}`).join(" ");
      console.log(` [${build.id}] e${index} ${result.result} R${result.roundsUsed} ${hp}`);
    }
    const committed = commitBattleResult(profile, run, index, result);
    run = committed.run;
    if (result.result !== "win") break;
  }
  return rows;
}

// **「倍率だけ違う」を落とすための比べ方。**
// 事件の数ではなく、「どの技能から、どの種類の出来事が出たか」の集合を比べる。
// 量が違うだけなら集合は一致するので、ここで落ちる。
function signatureOf(rows) {
  const signature = new Set();
  for (const row of rows) for (const key of row.skills.keys()) signature.add(key);
  return signature;
}

function onlyIn(a, b) {
  return [...a].filter((entry) => !b.has(entry));
}

// ============================================================ 検査
const problems = [];
const report = [];
const signatures = new Map();
const played = new Map();
const planOf = new Map();
const equipmentReport = [];

for (const build of BUILDS) {
  const at = build.id;
  if (build.entries.length < 2) {
    problems.push(`${at}: 代替入口が ${build.entries.length} つしかない（一本道にしない）`);
  }
  for (const entry of build.entries) {
    if (!stageSkillIds.has(entry.skillId)) {
      problems.push(`${at}: 代替入口 ${entry.skillId} が ${STAGE.id} の manifest に無い`);
      continue;
    }
    if (!ROSTER.includes(entry.characterId)) {
      problems.push(`${at}: 代替入口 ${entry.skillId} の担い手 ${entry.characterId} が ${STAGE.id} の編成に居ない`);
      continue;
    }
    // **どちらから入っても、核が揃う戦闘までに手が届くこと。**片方だけが安くて
    // もう片方が遠いなら、それは代替入口ではなく一本道の飾りである。
    const cost = residualBudget(entry.characterId, entry.skillId);
    const affordable = pointsBefore(build.core.by);
    if (cost > affordable) {
      problems.push(`${at}: 代替入口 ${entry.characterId} の ${entry.skillId} は ${cost}点かかるが、`
        + `核が揃う第${build.core.by}戦の時点で配られているのは ${affordable}点しかない`);
    }
  }
  for (const key of ["source", "converter", "payoff", "brake"]) {
    if (!build.engine?.[key]) problems.push(`${at}: engine の ${key} が書かれていない`);
  }

  const { problems: planProblems, snapshots } = applyPlan(build);
  problems.push(...planProblems);

  // 核が第4〜6戦の時点で揃っているか。**第12戦の勝利報酬でやっと解放は失格。**
  if (build.core.by < 4 || build.core.by > 6) {
    problems.push(`${at}: 核の成立を第${build.core.by}戦と宣言している（第4〜6戦の関門の外）`);
  }
  const coreSnapshot = snapshots.get(build.core.by);
  for (const characterId of ROSTER) {
    for (const skillId of build.core[characterId] ?? []) {
      if (!coreSnapshot.owned[characterId].has(skillId)) {
        problems.push(`${at}: 第${build.core.by}戦の時点で ${characterId} が核の ${skillId} を持っていない`);
      }
    }
  }

  planOf.set(build.id, snapshots);
  const rows = playThrough(build, snapshots);
  played.set(build.id, rows);
  const lost = rows.find((row) => row.result !== "win");
  if (lost) problems.push(`${at}: 第${lost.index}戦で ${lost.result}（紙の上だけの構成を残さない）`);
  if (rows.length < LAST_ENCOUNTER) {
    problems.push(`${at}: 第${LAST_ENCOUNTER}戦まで届いていない`);
  }
  signatures.set(build.id, signatureOf(rows));

  const spent = coreSnapshot.spent;
  report.push(`${build.displayName}（核は第${build.core.by}戦・`
    + ROSTER.map((id) => `${id} ${spent[id]}点`).join("／")
    + `・${rows.length}戦 ${rows.reduce((total, row) => total + row.rounds, 0)}ラウンド）`);
}

// 三構成が、同じ seed・同じ敵に対して違う出来事を出しているか。
for (const a of BUILDS) {
  for (const b of BUILDS) {
    if (a.id >= b.id) continue;
    const left = onlyIn(signatures.get(a.id), signatures.get(b.id));
    const right = onlyIn(signatures.get(b.id), signatures.get(a.id));
    if (!left.length || !right.length) {
      problems.push(`${a.id} と ${b.id} の event 列が種類の水準で違わない`
        + `（${a.id} だけ ${left.length}件／${b.id} だけ ${right.length}件）。`
        + "倍率だけの違いは不合格（05-playtest-gates）");
    }
  }
}

// ============================================================ 代表装備（05-playtest-gates）
//
// 合格の目安は「**低レアの異なる2品で、次のSP配分か配置/優先順位が変わる**」で、
// 失敗例は「レア度が高いものへ交換するだけ」である。だから見るのは強さではなく、
// **二品が別の出来事を起こし、別の人物の手で鳴ること。**
//
// 品は手で書かない。その Stage の報酬表が、その seed で実際に出す低レア2品を使う。
{
  const profile = newProfile();
  const run = newRun(profile, {
    campaignStageSequence: STAGE.sequence,
    runSeed: SEED,
    runId: SEED,
    roster: ROSTER,
  });
  // **一戦目だけを見ない。**報酬表は Stage が進むほど上のレア度も出すので、
  // 序盤の数戦から**低レアの品を拾い出す**（実際に拾える2品を見比べるため）。
  const offers = [];
  for (let index = 1; index <= 3; index += 1) {
    for (const offer of rewardOffer(run, profile, index)) {
      if (offer.type !== "equipment") continue;
      if (offers.some((seen) => seen.equipmentId === offer.equipmentId)) continue;
      offers.push(offer);
    }
  }
  // **「低レア」は下から2段まで。**Stage 3 の報酬表は最初の一戦から rare を出すので、
  // 最下位ちょうどを要求すると、その Stage で実際に拾える品を見られない。
  const lowRarities = new Set(RARITIES.slice(0, 2));
  if (offers.length < 2) {
    problems.push(`序盤3戦の報酬に装備が ${offers.length} 品しか出ない（2品を見比べられない）`);
  } else {
    const pair = offers.filter((offer) => lowRarities.has(offer.item.rarity)).slice(0, 2);
    if (pair.length < 2) {
      problems.push(`序盤3戦の報酬に低レアの装備が ${pair.length} 品しか出ない`);
    }
    for (const offer of pair) {
      if (!lowRarities.has(offer.item.rarity)) {
        problems.push(`代表装備 ${offer.item.definition.displayName} が低レア（${[...lowRarities].join("・")}）ではない`);
      }
    }
    // **持ち主を変える。**傷を読む品は前で受けるゴウ、手当てを読む品は治すツグミ。
    // どちらが誰の手で鳴るかは、その品が読む発生源が決めている。
    // **誰がどの構成で持つかは、品の側が決める。**「自分が動いたとき」を読む品は
    // 隊列を動かす構成の遊撃の手で、「回復を与えたとき」を読む品は治す人の手で
    // 初めて鳴る。だから構成と持ち主を総当たりし、**鳴る組み合わせが一つも無ければ**
    // その品を落とす（拾っても何も起きない品を残さない）。
    //
    // 鳴る組み合わせがどれかは、そのまま「この品を拾ったら、どの方針へ寄せるか」
    // である（05-playtest-gates の「次のSP配分か配置/優先順位が変わる」）。
    const carriedSignatures = pair.map((offer) => {
      let found = null;
      for (const build of BUILDS) {
        const buildSnapshots = planOf.get(build.id);
        const buildBaseline = signatureOf(playThrough(build, buildSnapshots));
        for (const characterId of ROSTER) {
          const signature = signatureOf(playThrough(build, buildSnapshots, {
            equipmentId: offer.equipmentId, item: offer.item, characterId,
          }));
          const added = onlyIn(signature, buildBaseline);
          if (!added.length) continue;
          found = { build, characterId, signature, added };
          break;
        }
        if (found) break;
      }
      if (!found) {
        problems.push(`代表装備 ${offer.item.definition.displayName} は、`
          + "どの構成の誰が持っても出来事が何も変わらない（拾っても戦い方が動かない）");
        return new Set();
      }
      const { build, characterId, signature, added } = found;
      if (process.env.STAGE_BUILDS_DUMP) {
        console.log(` [装備] ${build.displayName} の ${characterId} × ${offer.item.definition.displayName}`
          + ` → 追加 ${added.join(" / ")}`);
      }
      equipmentReport.push(`${offer.item.definition.displayName}（${build.displayName}の${characterId}・${added.length}種）`);
      return signature;
    });
    if (!onlyIn(carriedSignatures[0], carriedSignatures[1]).length
      || !onlyIn(carriedSignatures[1], carriedSignatures[0]).length) {
      problems.push("代表装備2品が同じ出来事しか起こさない（レア度を上げ替えるだけの品になっている）");
    }
  }
}

// 前提 Lv を要求する節が、この Stage の実データに最低1つあること（#169 の
// `needsParentLv` が、まだどこからも使われていない状態を終わらせる）。
const leveledPrereqs = SKILL_TREE_NODES.filter((node) => stageSkillIds.has(node.skillId)
  && node.requires.some((required) => required.minLv > MIN_SKILL_LEVEL));
if (!leveledPrereqs.length) {
  problems.push(`${STAGE.id}: 前提 Lv を要求する節が一つも無い（needsParentLv が実データで通らない）`);
}
// その節が、宣言した取得計画のどれかで実際に開かれていること。
const leveledIds = new Set(leveledPrereqs.map((node) => node.skillId));
const usedLeveled = BUILDS.some((build) => build.plan
  .some((step) => step.skillId && leveledIds.has(step.skillId)));
if (!usedLeveled) {
  problems.push("前提 Lv を要求する節を、どの構成も取得計画に入れていない");
}

// ---------------------------------------------------------------- 自己検査
{
  const same = new Set(["a", "b"]);
  if (onlyIn(same, same).length !== 0) {
    console.error("ecology-stage3-builds: 参照点が壊れている（同じ集合の差が空にならない）");
    process.exit(1);
  }
  const different = new Set(["a", "c"]);
  if (!onlyIn(different, same).length) {
    console.error("ecology-stage3-builds: 参照点が壊れている（違う集合の差を検出できない）");
    process.exit(1);
  }
  // 取得計画の検算そのものが鳴ることを確かめる。**払えない計画は落ちる。**
  const broken = { ...BUILDS[0], id: "self-check", plan: [
    { before: 1, characterId: "warden", skillId: "foundation_might" },
    { before: 1, characterId: "warden", skillId: "foundation_ap" },
  ] };
  if (!applyPlan(broken).problems.length) {
    console.error("ecology-stage3-builds: 参照点が壊れている（予算超過の取得計画を検出できない）");
    process.exit(1);
  }
}

if (problems.length) {
  console.error("ecology-stage3-builds:\n  " + problems.join("\n  "));
  process.exit(1);
}

const shared = [...signatures.values()].reduce((total, signature) => {
  if (!total) return new Set(signature);
  return new Set([...total].filter((entry) => signature.has(entry)));
}, null);
console.log(
  `ecology-stage3-builds: ${STAGE.id} の三構成 — ${report.join(" / ")}。`
  + `共通の出来事 ${shared.size}種、構成ごとに固有の出来事 `
  + BUILDS.map((build) => {
    const others = BUILDS.filter((other) => other.id !== build.id)
      .map((other) => signatures.get(other.id));
    const own = [...signatures.get(build.id)]
      .filter((entry) => others.every((signature) => !signature.has(entry)));
    return `${build.displayName} ${own.length}種`;
  }).join("・")
  + `。代表装備 ${equipmentReport.join("・")}`
  + `。前提 Lv を要求する節 ${leveledPrereqs.map((node) => node.skillId).join("・")} が実データで通っている`,
);
