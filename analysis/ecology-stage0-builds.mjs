// **Stage 0 の縦切り。ゴウとツグミの2人から、三つの違う戦い方が立ち上がるか。**
//
// issue #176（#165 段階2）。05-playtest-gates の合格目安は
//「ゴウ+ツグミで3つの異なる構成が第4〜6戦までに動く」「全構成が同じ主攻撃+回復で
// 倍率だけ違う、は失敗」である。**倍率違いを不合格にするには、数ではなく
// 出来事の種類を見るしかない**ので、ここでは三つの構成を data として宣言し、
// 同じ seed・同じ盤面で実際に engine へ通して、出てきた event 列を比べる。
//
// 見るのは次の五つ。**どれも fun の証明ではない**——「三つが同じ物になっていない」
// ことと、「宣言した核が第4〜6戦の時点で実際に取り切れる」ことの確認である。
//
//   1. 取得計画が Stage 0 の manifest と技能点の予算に収まる（#169 の予算監査と同じ数え方）
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

const STAGE = CAMPAIGN_STAGES[0];
const ROSTER = [...STAGE.castCharacterIds];
const SEED = "stage0-vertical-slice";
// 見るのは第6戦まで。**核の成立は第4〜6戦**という関門がそこで閉じる。
const LAST_ENCOUNTER = 6;

const nodeBySkill = Object.fromEntries(SKILL_TREE_NODES.map((node) => [node.skillId, node]));
const stageSkillIds = new Set(skillIdsForPacks(STAGE.enabledPackIds, STAGE.packDepths).all);
const starterOf = Object.fromEntries(CHARACTER_DEFINITIONS.map((entry) => [entry.id, entry]));

// ============================================================ 三つの構成
//
// **どれも「ゴウが前で受け、ツグミが後ろから技を通す」までは同じ。**
// 分かれるのは、その被害をどう扱うかと、そのために点をどこへ入れるかである。
//
//   守る  … 防壁で丸ごと吸う。吸い切った一撃は damage_taken すら起こさない
//   直す  … 反応で割合を返す。被弾のたびに鳴るので、細かい手数に強い
//   押す  … そもそも殴られる前に落とす。点を全部その一撃へ入れる
//
// **対抗軸はここにある。**防壁は「一撃が壁より小さいか」で勝ち負けが決まり、
// 治療は「一撃が何回来るか」で決まる。同じ盤面でも敵の出方が変われば入れ替わる。
//
// `plan` は取得順。`before` はその戦闘の**開始前**という意味で、`before: 1` は
// 出発時（勝利報酬がまだ0点）を指す。`level` は技能レベルを1段上げる（1点）。
const BUILDS = Object.freeze([
  Object.freeze({
    id: "push",
    displayName: "押し切る",
    question: "殴られる前に落とすなら、点は全部その一撃へ入る",
    // 発生源・変換器・利得先・制動（AGENTS.md「pack は…閉じたレシピにしない」）
    engine: Object.freeze({
      source: "無条件の一撃（確かな斬り・狙い撃ち）",
      converter: "腕力と技能レベル。条件を増やさず、量だけを厚くする",
      payoff: "round 数そのもの。落ちるのが早ければ、返す傷が生まれない",
      brake: "受けの厚い相手には引き算が効く。長引くと支えが何も無い",
    }),
    // 代替入口。**どちらから入っても核へ届く**（一本道にしない）。
    entries: Object.freeze(["foundation_might", "foundation_ap"]),
    core: Object.freeze({
      by: 4,
      warden: Object.freeze(["steady_cut", "foundation_might"]),
      mender: Object.freeze(["aimed_shot"]),
    }),
    plan: Object.freeze([
      Object.freeze({ before: 2, characterId: "warden", skillId: "foundation_might" }),
      Object.freeze({ before: 3, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 4, characterId: "mender", level: "aimed_shot" }),
      Object.freeze({ before: 5, characterId: "warden", skillId: "foundation_ap" }),
      Object.freeze({ before: 5, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 6, characterId: "mender", level: "aimed_shot" }),
    ]),
    // 装着と優先順位。**上から順に、使える最初の一本が出る。**
    tactics: Object.freeze({ warden: ["steady_cut"], mender: ["aimed_shot"] }),
    reactives: Object.freeze({ warden: ["mend"], mender: ["triage"] }),
  }),
  Object.freeze({
    id: "ward",
    displayName: "壁を張る",
    question: "吸い切った一撃は、そもそも起きなかったことになる",
    engine: Object.freeze({
      source: "ツグミの技術。防壁はすべて focus で伸びる",
      converter: "傷へ盾を → 長く守る（前提 Lv3）。開幕に消えない壁を置く",
      payoff: "壁が一撃を丸ごと吸うと damage_taken が出ない。返す傷が最初から無い",
      brake: "守りに使った round は殴れない。壁より大きい一撃は素通りする",
    }),
    entries: Object.freeze(["shield_the_wounded", "ward_ally"]),
    core: Object.freeze({
      by: 6,
      warden: Object.freeze(["steady_cut"]),
      mender: Object.freeze(["aimed_shot", "shield_the_wounded", "sustaining_ward", "field_dressing"]),
    }),
    plan: Object.freeze([
      Object.freeze({ before: 2, characterId: "mender", level: "shield_the_wounded" }),
      Object.freeze({ before: 3, characterId: "mender", level: "shield_the_wounded" }),
      Object.freeze({ before: 4, characterId: "mender", skillId: "sustaining_ward" }),
      Object.freeze({ before: 5, characterId: "mender", skillId: "field_dressing" }),
      Object.freeze({ before: 6, characterId: "mender", level: "sustaining_ward" }),
      Object.freeze({ before: 6, characterId: "mender", level: "field_dressing" }),
    ]),
    // **優先順位そのものが構成である。**開幕は消えない壁、深傷が出たら面の手当て、
    // それ以外は撃つ。長く守るは round 3 以降、まとめて手当ては半分以下の味方が
    // 居ないとき、どちらも自動で次の一本へ落ちる。
    tactics: Object.freeze({
      warden: ["steady_cut"],
      mender: ["sustaining_ward", "field_dressing", "aimed_shot"],
    }),
    reactives: Object.freeze({ warden: ["mend"], mender: ["triage"] }),
  }),
  Object.freeze({
    id: "mend",
    displayName: "返して繋ぐ",
    question: "受けた一撃を、受けたその拍で返す",
    engine: Object.freeze({
      source: "被弾そのもの（damage_taken）。誰が受けても鳴る",
      converter: "応急処置・応急手当が被弾量の割合を返し、揺れない手が守勢へ変える",
      payoff: "慣れた手つきが回復を集中へ繋ぐ。次の一撃・治療・防壁が厚くなる",
      brake: "反応点は round に戻るが、同じ被弾には一度きり。一撃が大きいほど取り逃す",
    }),
    entries: Object.freeze(["steady_under_fire", "steady_hands"]),
    core: Object.freeze({
      by: 5,
      warden: Object.freeze(["steady_cut", "emergency_treatment", "steady_under_fire"]),
      mender: Object.freeze(["aimed_shot", "triage", "foundation_focus", "steady_hands"]),
    }),
    plan: Object.freeze([
      Object.freeze({ before: 2, characterId: "warden", skillId: "emergency_treatment" }),
      Object.freeze({ before: 3, characterId: "warden", skillId: "steady_under_fire" }),
      Object.freeze({ before: 4, characterId: "mender", skillId: "foundation_focus" }),
      Object.freeze({ before: 5, characterId: "mender", skillId: "steady_hands" }),
      Object.freeze({ before: 5, characterId: "warden", skillId: "foundation_rp" }),
      Object.freeze({ before: 6, characterId: "mender", level: "triage" }),
    ]),
    tactics: Object.freeze({ warden: ["steady_cut"], mender: ["aimed_shot"] }),
    reactives: Object.freeze({
      warden: ["mend", "emergency_treatment", "steady_under_fire"],
      mender: ["triage", "emergency_treatment"],
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

// その節を開くのに要る技能点。**前提の閉包（要求 Lv 込み）を足す。**
// analysis/ecology-skill-catalog-smoke.mjs の `unlockBudget` と同じ数え方で、
// 同じ節を二度数えない。
function unlockBudget(skillId) {
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
    total += node.cost + (level - MIN_SKILL_LEVEL) * SKILL_LEVEL_COST;
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
    formation: { warden: "front_left", mender: "rear_right" },
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
    if (process.env.STAGE0_DUMP) {
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
  for (const skillId of build.entries) {
    if (!stageSkillIds.has(skillId)) {
      problems.push(`${at}: 代替入口 ${skillId} が ${STAGE.id} の manifest に無い`);
      continue;
    }
    // **どちらから入っても、核が揃う戦闘までに手が届くこと。**片方だけが安くて
    // もう片方が遠いなら、それは代替入口ではなく一本道の飾りである。
    const cost = unlockBudget(skillId);
    const affordable = pointsBefore(build.core.by);
    if (cost > affordable) {
      problems.push(`${at}: 代替入口 ${skillId} は ${cost}点かかるが、`
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
// 品は手で書かない。Stage 0 の報酬表がその seed で実際に出す2品をそのまま使う
// （pack_care と「傷の刻印」だけが有効なので、出るのは「回復を与えたとき」と
// 「HPダメージを受けたとき」を読む二系統になる）。
{
  const profile = newProfile();
  const run = newRun(profile, {
    campaignStageSequence: STAGE.sequence,
    runSeed: SEED,
    runId: SEED,
    roster: ROSTER,
  });
  const offers = rewardOffer(run, profile, 1).filter((offer) => offer.type === "equipment");
  const lowestRarity = RARITIES[0]?.id ?? "common";
  if (offers.length < 2) {
    problems.push(`第1戦の報酬に装備が ${offers.length} 品しか出ない（2品を見比べられない）`);
  } else {
    const pair = offers.slice(0, 2);
    for (const offer of pair) {
      if (offer.item.rarity !== lowestRarity) {
        problems.push(`代表装備 ${offer.item.definition.displayName} が低レア（${lowestRarity}）ではない`);
      }
    }
    // **持ち主を変える。**傷を読む品は前で受けるゴウ、手当てを読む品は治すツグミ。
    // どちらが誰の手で鳴るかは、その品が読む発生源が決めている。
    const reference = BUILDS[BUILDS.length - 1];
    const snapshots = planOf.get(reference.id);
    const baseline = signatureOf(playThrough(reference, snapshots));
    const carriedSignatures = pair.map((offer, slot) => {
      const characterId = slot === 0 ? "warden" : "mender";
      const rows = playThrough(reference, snapshots, {
        equipmentId: offer.equipmentId, item: offer.item, characterId,
      });
      const signature = signatureOf(rows);
      const added = onlyIn(signature, baseline);
      if (!added.length) {
        problems.push(`代表装備 ${offer.item.definition.displayName} を ${characterId} が持っても`
          + "出来事が何も変わらない（拾う前と同じ戦い方になる）");
      }
      if (process.env.STAGE0_DUMP) {
        console.log(` [装備] ${characterId} × ${offer.item.definition.displayName} → 追加 ${added.join(" / ")}`);
      }
      equipmentReport.push(`${offer.item.definition.displayName}（${characterId}・${added.length}種）`);
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
    console.error("ecology-stage0-builds: 参照点が壊れている（同じ集合の差が空にならない）");
    process.exit(1);
  }
  const different = new Set(["a", "c"]);
  if (!onlyIn(different, same).length) {
    console.error("ecology-stage0-builds: 参照点が壊れている（違う集合の差を検出できない）");
    process.exit(1);
  }
  // 取得計画の検算そのものが鳴ることを確かめる。**払えない計画は落ちる。**
  const broken = { ...BUILDS[0], id: "self-check", plan: [
    { before: 1, characterId: "warden", skillId: "foundation_might" },
    { before: 1, characterId: "warden", skillId: "foundation_ap" },
  ] };
  if (!applyPlan(broken).problems.length) {
    console.error("ecology-stage0-builds: 参照点が壊れている（予算超過の取得計画を検出できない）");
    process.exit(1);
  }
}

if (problems.length) {
  console.error("ecology-stage0-builds:\n  " + problems.join("\n  "));
  process.exit(1);
}

const shared = [...signatures.values()].reduce((total, signature) => {
  if (!total) return new Set(signature);
  return new Set([...total].filter((entry) => signature.has(entry)));
}, null);
console.log(
  `ecology-stage0-builds: ${STAGE.id} の三構成 — ${report.join(" / ")}。`
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
