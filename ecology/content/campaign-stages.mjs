// ecology/content/campaign-stages.mjs
//
// **Campaign Stage の固定定義。R8 §4, §5.1-5.4。**
// R8 Implementation Phase 1 step 1/2 で新設した。
//
// Campaign は「難易度 rank」ではなく、Stage ごとに固有のパック構成を持つ
// （R8 §1.1）。ここで定義するのは Stage 0〜3 だけである
// （R8 §2「次に行う実装」step 2、§18 Implementation Phase 1 step 1）。
// Stage 4 以降は、Stage 0〜3 の作者評価（Gate 2）を経てから設計する
// （R8 §5 の表は「実装開始用の具体案」であり、本ファイルの対象外）。
//
// Free / Endless の random manifest（`makeManifest`, progression.mjs）は
// このファイルと独立に存在し続ける。campaign 専用の固定 manifest だけを
// ここで作る（R8 §1.2「seedはcampaignのpack選択には使わない」）。
//
// engine・schema は変更しない。

import { MANIFEST_VERSION } from "../schema.mjs";
import { AFFIX_FAMILIES } from "./affixes.mjs";
import { BASELINE_ACTIVE_SKILL_IDS, PACK_BY_ID, SKILL_PACKS } from "./packs.mjs";
import { REGION, actBossesForStage, enemyIdsForStage } from "./expedition.mjs";
import { enemyFamilyOf } from "./enemies.mjs";
import { WEAPONS, WEAPON_IDS_BY_CHARACTER, weaponIdsForCharacterIds } from "./weapon-trees.mjs";

// ---------------------------------------------------------------- ラダーの型（R8 §4.2 / R9 §3）
//
// **R8 と R9 で有効パック数の作り方が違う。黙って片方へ寄せない。**
//
//   R8 §4.2「有効パック数を徐々に増やす」… activePackCount = 1 + ceil(sequence/2)
//     → 1, 2, 2, 3, 3, 4, 4。§4.3「過去パックは単純累積させない」で、
//       Stage ごとに一部の過去パックを引き上げる（回転）。
//   R9 §3「初期4Stageのチュートリアル化」… 累積。1, 2, 3, 4。
//     → 「チュートリアル中に以前の語彙を入れ替えず、基本packを土台として
//        少しずつ積む構成を第一候補とする」（R9 §3）。
//
// 初期4 Stage は R9 の累積を採る。**Stage 4 以降は R8 の回転へ戻す**ので、
// 式そのものは両方残し、Stage 定義が `ladderMode` でどちらを名乗るかを決める。
// 差分と影響は docs/HISTORY.md §3.2。
export const LADDER_MODES = Object.freeze(["tutorial", "campaign"]);
export const TUTORIAL_MAX_SEQUENCE = 3;

export function activePackCountForSequence(sequence, mode = "tutorial") {
  if (mode === "tutorial") return sequence + 1;
  // R23 — 第2章（Stage 4〜9）。**回転（入れ替え）は採らなかった。**
  //
  // R8 §4.2 の回転は「一度に扱う語彙を増やしすぎない」ための仕組みだが、
  // 技能点は一遠征15点で固定なので、pack が増えても**同時に取れる技能の数は
  // 増えない**（analysis/ecology-skill-catalog-smoke.mjs）。増えるのは選択肢の
  // ほうだけである。そこから覚えた pack を取り上げると、「前の Stage で組んだ形が
  // 今回は作れない」という理由だけの難度になり、作者が嫌う方向に寄る。
  // だから **Stage 4・5 で残り2 pack を足し切り、以降は6 pack のまま**にして、
  // 新しさは相手の家系（灰塵・灰織・灰炉）の側で出す。
  return Math.min(6, sequence + 1);
}

// R23 — **`activityFundMultiplierBps` は Stage ごとの払いである。**
// 以前は全 Stage が 10_000（等倍）で、しかも**どこからも読まれていなかった**。
// いまは `progression.newRun` が遠征開始時に ledger へ写し、精算でそのまま掛かる。
//
// 値は Stage 番号の一次式ではなく、`analysis/ecology-campaign-curve.mjs` が測った
// 難度指数に合わせてある（R8 §3.7「報酬倍率をStage番号の一次式にはしない」）。
//
//   Stage  0    1    2    3    4    5    6    7    8    9
//   指数  931  914 1196  989 1277 1455 1611 2047 2201 2779
//   倍率  1.0  1.7  2.4  3.3  4.4  5.9  7.9 10.5 13.8 17.5
//
// **危ないところほど払いが大きい。**同じ Stage を繰り返すより次へ進むほうが
// 資金効率が良いので、稼ぎのための周回で遊びが伸びない。

// R9 §2 — **初期4 Stage は、5人とゲームの文法を覚えるチュートリアルとして扱う。**
// 2人で始め、Stage を一つ進むごとに1人が加わり、Stage 3で5人が揃う。
// 加入する人物は pack の所有者ではない（`joiningCharacterId` は「その pack の
// 分かりやすい入口を持つ人」であって、その pack を独占しない）。
//
// `packDepths` は R9 §3.1 の「累積させる」を実装する。新 pack はその Stage では
// core（入口）だけ、次の Stage から full。**前に覚えた技能は消えない。**
//
// issue #172 — `id` は旧来 `stage_0_edge` のように pack 由来の語尾（edge / wall /
// tempo / care）を持っていたが、途中で pack の追加順（care → edge → wall → tempo）
// を変えたときに語尾を追随させず、一つずつずれていた。pack 構成は今後も変わり得るので、
// **ID の語尾に特定の pack を意味させない。**単純な連番 `stage_N` へ改名した。
// 旧 ID は Blueprint 取得履歴・装備 provenance（`campaignStageId`）に保存済みなので、
// `RETIRED_CAMPAIGN_STAGE_IDS` へ理由と displayName を残す（AGENTS.md「RETIRED_IDS は
// 理由付きで残す」）。ゲーム進行そのもの（campaignProgress）は `campaignStageSequence`
// という数のほうを使っており、この ID には依存しない。
const stage = (definition) => Object.freeze({
  ...definition,
  id: "stage_" + definition.sequence,
  castCharacterIds: Object.freeze([...definition.castCharacterIds]),
  // R25設計PR #287 §8・§12 — 武器は加入済み人物の署名武器・副武器を累積して開示する。
  // 人物のcastを正本にし、Stage番号から別に武器を推測しない。
  enabledWeaponIds: Object.freeze(weaponIdsForCharacterIds(definition.castCharacterIds)),
  returningPackIds: Object.freeze([...definition.returningPackIds]),
  enabledPackIds: Object.freeze([...definition.enabledPackIds]),
  packDepths: Object.freeze({ ...definition.packDepths }),
  pressureTags: Object.freeze([...definition.pressureTags]),
  learningGoals: Object.freeze([...definition.learningGoals]),
  // **敵・幕ボス・法則は宣言しない。その Stage の12戦から導出する**（R23）。
  // 以前は REGION の値を placeholder として全 Stage が名乗っていたので、
  // Stage 4 以降を作ると同時に嘘になる欄だった。
  enemyFamilyIds: Object.freeze([...new Set(
    enemyIdsForStage(definition.sequence).map((id) => enemyFamilyOf(id)).filter(Boolean),
  )]),
  actBossIds: Object.freeze(actBossesForStage(definition.sequence).map((entry) => entry.enemyActorId)),
  actBossLawIds: Object.freeze(actBossesForStage(definition.sequence).map((entry) => entry.bossLawId)),
  stageLawIds: Object.freeze([]),
  newEnemyFamilyId: definition.newEnemyFamilyId ?? null,
  newPackId: definition.newPackId ?? null,
  joiningCharacterId: definition.joiningCharacterId ?? null,
  activityFundMultiplierBps: definition.activityFundMultiplierBps,
});

const ALL_PACK_IDS = Object.freeze([
  "pack_care", "pack_edge", "pack_wall", "pack_tempo", "pack_barrage", "pack_relay",
]);
const FULL_CAST = Object.freeze(["warden", "mender", "lancer", "guardian", "tactician"]);
const allFull = (ids) => Object.fromEntries(ids.map((id) => [id, "full"]));

export const CAMPAIGN_STAGES = Object.freeze([
  // ======================================== 第1章：五人が揃うまで（チュートリアル）
  //
  //   0 ゴウ＋ツグミ … 武器（腕力）と技（技術）の違い＝立つ場所の違い
  //   1 ＋ナギ       … 前に立てる人が来て、刃が届く
  //   2 ＋ヒバナ     … 行動権2の遊撃。隊列を動かすこと自体は割に合わない
  //   3 ＋ゲンゾウ   … 順番そのものを触れるようになる
  stage({
    sequence: 0, ladderMode: "tutorial",
    displayName: "Stage 0 — 灰の入口",
    question: "武器と技の違いは、立つ場所の違い",
    newAxis: "灰殻の文法（前で受ける・後ろから撃つ）",
    partySize: 2,
    castCharacterIds: ["warden", "mender"],
    joiningCharacterId: null,
    newPackId: "pack_care",
    returningPackIds: [],
    enabledPackIds: ["pack_care"],
    packDepths: { pack_care: "core" },
    activePackCount: 1,
    pressureTags: ["guard", "block", "small_group"],
    learningGoals: [
      "武器（腕力）の攻撃は後列から出すと大きく落ち、技（技術）は落ちない（R11 §5）",
      "だから前列と後列の選択は、守りの話であると同時に火力の話でもある",
      "**敵は届く範囲で最もHPの低い者を狙う。**前へ出した柔らかい者ほど先に殴られる",
      "**主火力のツグミが一番柔らかい。**前に出すと本当に落ち、後ろへ下げれば武器は届かない",
      "回復は「HPを戻す役」ではなく「損傷の連鎖を止める役」（R8 §9.4）",
    ],
    activityFundMultiplierBps: 10_000,
  }),
  stage({
    sequence: 1, ladderMode: "tutorial",
    displayName: "Stage 1 — 抜ける刃",
    question: "誰が前に立つと、誰が振り抜けるか",
    newAxis: "刃と撃破（pack_edge）／走り手・籠り手・砕き手",
    partySize: 3,
    castCharacterIds: ["warden", "mender", "lancer"],
    joiningCharacterId: "lancer",
    newPackId: "pack_edge",
    returningPackIds: ["pack_care"],
    enabledPackIds: ["pack_care", "pack_edge"],
    packDepths: { pack_care: "full", pack_edge: "core" },
    activePackCount: 2,
    pressureTags: ["position", "burst", "row_column"],
    learningGoals: [
      "溜め・条件・貫通は、成立すれば安定した一撃を大きく上回る（R9 §3）",
      "ナギは受けが桁違いで、hit ごとの固定軽減なので**多段がそのまま止まる**",
      "**走り手は一巡に二度動く。**受けの薄い人物を前へ置くと、そこだけが壊れる",
      "**庇う技はこの Stage から来る。**ナギが狙いを引き受けるので、前に立つ人と後列の技を組み合わせる",
    ],
    activityFundMultiplierBps: 17_000,
  }),
  stage({
    sequence: 2, ladderMode: "tutorial",
    displayName: "Stage 2 — 動く隊列",
    question: "隊列を動かして、何を得るか",
    newAxis: "防壁と隊列（pack_wall）／潜み手・追い手",
    partySize: 4,
    castCharacterIds: ["warden", "mender", "lancer", "guardian"],
    joiningCharacterId: "guardian",
    newPackId: "pack_wall",
    returningPackIds: ["pack_care", "pack_edge"],
    enabledPackIds: ["pack_care", "pack_edge", "pack_wall"],
    packDepths: { pack_care: "full", pack_edge: "full", pack_wall: "core" },
    activePackCount: 3,
    pressureTags: ["cover", "position", "row_column"],
    learningGoals: [
      "身代わり・受け構え・防壁が、被害を「消す」のではなく「移す」（R9 §3）",
      "**位置替えそれ自体は割に合わない。**必ず誰かと入れ替わり、前列は先に狙われる",
      "**追い手と潜み手は後列を追う。**後ろへ下げるだけでは安全にならない",
      "ヒバナは行動権が二つあるので往復できる。寄せて行・列で薙ぐと初めて得になる",
      "刃 pack が full になり、前 Stage の技能に新しい使い道が出る（R9 §3.1）",
    ],
    activityFundMultiplierBps: 24_000,
  }),
  stage({
    sequence: 3, ladderMode: "tutorial",
    displayName: "Stage 3 — 間合いと順番",
    question: "誰がいつ動くと得か",
    newAxis: "行動権と準備（pack_tempo）／狩人・反響体",
    partySize: 5,
    castCharacterIds: [...FULL_CAST],
    joiningCharacterId: "tactician",
    newPackId: "pack_tempo",
    returningPackIds: ["pack_care", "pack_edge", "pack_wall"],
    enabledPackIds: ["pack_care", "pack_edge", "pack_wall", "pack_tempo"],
    packDepths: {
      pack_care: "full", pack_edge: "full", pack_wall: "full", pack_tempo: "core",
    },
    activePackCount: 4,
    pressureTags: ["preparation", "ap_pressure", "attrition"],
    learningGoals: [
      "行動権を渡すと、遅い構成にも大技の手番が通る（R9 §3）",
      "ゲンゾウは反応点が二つ多い。**自分から動かず、読んでから何度も割り込める**",
      "**反響体は殴られると殴り返す。**手数で削る構成には、返しぶんの代償が付く",
      "5人が揃い、配置・技能・装備の差だけで役割を作れるか（R9 §2.1）",
    ],
    activityFundMultiplierBps: 33_000,
  }),

  // ======================================== 第2章：五人で灰の奥へ（Stage 4〜9）
  //
  // **人は増えない。増えるのは語彙（pack）と、相手の性能軸（家系）である。**
  // Stage 4・5 で最後の2 pack が入り、Stage 6・8 で新しい家系が入る。
  // Stage 7・9 は新規導入を持たず、**組み合わせだけが新しい**（`newAxis` に書く）。
  stage({
    sequence: 4, ladderMode: "campaign",
    displayName: "Stage 4 — 灰塵の底",
    question: "一人ずつ守っても間に合わないとき、何を選ぶか",
    newAxis: "連撃と刻印（pack_barrage）／灰塵（行・列・全体）",
    partySize: 5,
    castCharacterIds: [...FULL_CAST],
    newPackId: "pack_barrage",
    newEnemyFamilyId: "dust",
    returningPackIds: ["pack_care", "pack_edge", "pack_wall", "pack_tempo"],
    enabledPackIds: ["pack_care", "pack_edge", "pack_wall", "pack_tempo", "pack_barrage"],
    packDepths: {
      pack_care: "full", pack_edge: "full", pack_wall: "full",
      pack_tempo: "full", pack_barrage: "full",
    },
    activePackCount: 5,
    pressureTags: ["row_column", "block", "mark"],
    learningGoals: [
      "灰塵は行・列・全体へ同時に来る。**一人を厚くする守りが初めて足りなくなる**",
      "多段（連撃）は受け構えを剥がすのに強く、受けの厚い相手には最も弱い",
      "唱和が配る「隙」は、払いのけるで落とすか、配り手を先に落とすかで消える",
      "前列へ二人並べるかどうかが、そのまま薙ぎの当たり方を決める",
    ],
    activityFundMultiplierBps: 44_000,
  }),
  stage({
    sequence: 5, ladderMode: "campaign",
    displayName: "Stage 5 — 数の坂",
    question: "面で来る圧力に、面で返すか、一点で返すか",
    newAxis: "余波と受け渡し（pack_relay）／灰塵が主役になる",
    partySize: 5,
    castCharacterIds: [...FULL_CAST],
    newPackId: "pack_relay",
    returningPackIds: ["pack_care", "pack_edge", "pack_wall", "pack_tempo", "pack_barrage"],
    enabledPackIds: [...ALL_PACK_IDS],
    packDepths: allFull(ALL_PACK_IDS),
    activePackCount: 6,
    pressureTags: ["row_column", "attrition", "handoff"],
    learningGoals: [
      "**技能の語彙はここで出揃う。**以降の Stage で増えるのは相手の性能軸だけ",
      "余波と受け渡しは、自分の不利で他人の有利を買う。面の被害を一点へ集める形",
      "帳の配る受け構えは、多段で剥がすか、受け崩しで無視するかの二択になる",
      "面で受けた被害を面で戻すか、削られる前に一点を落とすか",
    ],
    activityFundMultiplierBps: 59_000,
  }),
  stage({
    sequence: 6, ladderMode: "campaign",
    displayName: "Stage 6 — 織りの回廊",
    question: "置いた場所を動かされても、成り立つ配置か",
    newAxis: "灰織（位置と状態を触る）",
    partySize: 5,
    castCharacterIds: [...FULL_CAST],
    newEnemyFamilyId: "weave",
    returningPackIds: [...ALL_PACK_IDS],
    enabledPackIds: [...ALL_PACK_IDS],
    packDepths: allFull(ALL_PACK_IDS),
    activePackCount: 6,
    pressureTags: ["position", "status", "reach"],
    learningGoals: [
      "**手繰りは後列で最もHPの低い者を最前へ引き出す。**隠れ場所という考え方が終わる",
      "怯み・裂傷・隙は、それぞれ別の直し方が要る。硬さで一括には受けられない",
      "遠手は後列へ直接届く。前を固めることの意味が、ここで一度崩れる",
      "HPを揃えて並べると、引き出される的そのものが消える",
    ],
    activityFundMultiplierBps: 79_000,
  }),
  stage({
    sequence: 7, ladderMode: "campaign",
    displayName: "Stage 7 — ほどける隊列",
    question: "状態と位置を同時に崩されたとき、何から直すか",
    newAxis: "組み合わせ（灰織＋灰塵）。新しい語彙も新しい家系も入らない",
    partySize: 5,
    castCharacterIds: [...FULL_CAST],
    returningPackIds: [...ALL_PACK_IDS],
    enabledPackIds: [...ALL_PACK_IDS],
    packDepths: allFull(ALL_PACK_IDS),
    activePackCount: 6,
    pressureTags: ["position", "status", "row_column"],
    learningGoals: [
      "直す手が一つしか無い round に、位置と状態のどちらを先に直すか",
      "面（灰塵）と点（灰織）が同時に来ると、片方の対策がもう片方の隙になる",
      "**怯みは段ごとに軽くする。**手数で押す構成ほど、重ねられた怯みで失速する",
      "必殺をどこで切るかが、初めて「勝敗」ではなく「消耗」の問題になる",
    ],
    activityFundMultiplierBps: 105_000,
  }),
  stage({
    sequence: 8, ladderMode: "campaign",
    displayName: "Stage 8 — 灰炉の門",
    question: "硬さで解けない相手を、何で解くか",
    newAxis: "灰炉（受け無視と持久）",
    partySize: 5,
    castCharacterIds: [...FULL_CAST],
    newEnemyFamilyId: "forge",
    returningPackIds: [...ALL_PACK_IDS],
    enabledPackIds: [...ALL_PACK_IDS],
    packDepths: allFull(ALL_PACK_IDS),
    activePackCount: 6,
    pressureTags: ["guard_ignore", "attrition", "burst"],
    learningGoals: [
      "**槌は受けも受け構えも無視する。**減らせるのは防壁（barrier）と回復だけになる",
      "金床は受けが最も厚い。受け崩しか貫き突きが無いと、round のほうが先に尽きる",
      "熾は手負いを仕留めに来る。削られた人物を後ろへ下げる判断が毎 round 要る",
      "守りを一種類だけ厚くする構成は、ここで初めて成立しなくなる",
    ],
    activityFundMultiplierBps: 138_000,
  }),
  stage({
    sequence: 9, ladderMode: "campaign",
    displayName: "Stage 9 — 炉の底",
    question: "覚えた解き方を、一つの遠征の中で持ち替えられるか",
    newAxis: "総復習（四家系が全部出る）。新しい語彙も新しい家系も入らない",
    partySize: 5,
    castCharacterIds: [...FULL_CAST],
    returningPackIds: [...ALL_PACK_IDS],
    enabledPackIds: [...ALL_PACK_IDS],
    packDepths: allFull(ALL_PACK_IDS),
    activePackCount: 6,
    pressureTags: ["guard_ignore", "row_column", "position", "attrition"],
    learningGoals: [
      "幕ごとに家系が変わる。**同じ編成のまま12戦を通せない**",
      "補給・必殺・持込 Blueprint を、どの幕へ残すかが最後の判断になる",
      "第一部の最終戦は、溜めた一撃と受け無視の一撃を交互に出す",
      "ここまでの9 Stage で作った常設の強さが、そのまま余白として効く",
    ],
    activityFundMultiplierBps: 175_000,
  }),
]);

// R9 §2.1 — チュートリアルの人数。Stage の定義から引く一箇所。
export function partySizeForStage(sequence) {
  return campaignStageDef(sequence).partySize;
}

export const CAMPAIGN_STAGE_BY_SEQUENCE = Object.freeze(
  Object.fromEntries(CAMPAIGN_STAGES.map((stage) => [stage.sequence, stage])),
);
export const CAMPAIGN_STAGE_BY_ID = Object.freeze(
  Object.fromEntries(CAMPAIGN_STAGES.map((stage) => [stage.id, stage])),
);
export const MAX_CAMPAIGN_STAGE_SEQUENCE = CAMPAIGN_STAGES.length - 1;

// R23 — **五人が揃い、そこから一つ先まで行った Stage。**名簿の最後の節（will）は
// ここで開く（`content/dossiers.mjs`）。以前は「最後の Stage」を渡していたが、
// 第一部が10 Stage になった時点で、それは Stage 9 のクリアを意味する。
// 元の意図は「隊が揃ったら開く」であり、`dossiers.mjs` のコメントも
// 「Stage 4 以降が実装されれば、そこは自然にばらける」と書いていた。**ここがその点である。**
export const FULL_PARTY_STAGE_SEQUENCE = CAMPAIGN_STAGES
  .filter((stage) => stage.joiningCharacterId)
  .reduce((latest, stage) => Math.max(latest, stage.sequence), 0);
export const DOSSIER_FINAL_STAGE_SEQUENCE =
  Math.min(MAX_CAMPAIGN_STAGE_SEQUENCE, FULL_PARTY_STAGE_SEQUENCE + 1);

// issue #172 — 改名前の Stage ID。保存済みの Blueprint 取得履歴・装備 provenance
// （`campaignStageId`）はこの ID を持ったままなので、黙って消さず displayName を
// 残す。**別内容への再利用は禁止**（AGENTS.md「RETIRED_IDS は理由付きで残す」）。
export const RETIRED_CAMPAIGN_STAGE_IDS = Object.freeze({
  stage_0_edge: {
    since: "issue-172", sequence: 0, displayName: "Stage 0 — 灰の入口",
    reason: "ID の語尾が、その Stage で追加される pack と一つずれていた。"
      + "pack 構成は今後も変わり得るので、ID に pack 名を持たせない連番 stage_0 へ改名した。",
  },
  stage_1_wall: {
    since: "issue-172", sequence: 1, displayName: "Stage 1 — 抜ける刃",
    reason: "stage_0_edge と同じ理由。連番 stage_1 へ改名した。",
  },
  stage_2_tempo: {
    since: "issue-172", sequence: 2, displayName: "Stage 2 — 動く隊列",
    reason: "stage_0_edge と同じ理由。連番 stage_2 へ改名した。",
  },
  stage_3_care: {
    since: "issue-172", sequence: 3, displayName: "Stage 3 — 間合いと順番",
    reason: "stage_0_edge と同じ理由。連番 stage_3 へ改名した。",
  },
});

// 現行 ID・旧 ID のどちらからも表示名を引く。Blueprint の由来表示
// （app.js の blueprintOriginText）が、改名前に保存された記録でも
// 「見つからない」にならないようにするための一箇所。
export function campaignStageDisplayNameFor(id) {
  return CAMPAIGN_STAGE_BY_ID[id]?.displayName ?? RETIRED_CAMPAIGN_STAGE_IDS[id]?.displayName ?? null;
}

export function campaignStageDef(sequence) {
  const clamped = Math.max(0, Math.min(MAX_CAMPAIGN_STAGE_SEQUENCE, Math.floor(sequence ?? 0)));
  return CAMPAIGN_STAGE_BY_SEQUENCE[clamped];
}

// R8 §4.1 — Campaign では manifest の pack 構成を random にしない。
// seed は敵順・報酬・装備roll等へは使うが、pack 選択には使わない
// （R8 §1.2「seedは...campaignのpack選択には使わない」）。
export function campaignManifestForStage(sequence, seed) {
  const stage = campaignStageDef(sequence);
  return {
    manifestVersion: MANIFEST_VERSION,
    seed: String(seed),
    regionId: REGION.id,
    campaignStageId: stage.id,
    campaignStageSequence: stage.sequence,
    baselineSkillIds: [...BASELINE_ACTIVE_SKILL_IDS],
    // R25 — 武器はpackとは別に固定する。加入済み人物の武器を全戦で開示する。
    enabledWeaponIds: [...stage.enabledWeaponIds],
    enabledPackIds: [...stage.enabledPackIds],
    // R9 §3.1 — 新 pack はその Stage では core（入口）だけを出し、
    // 次の Stage から full になる。**前に覚えた技能は消えない。**
    packDepths: { ...stage.packDepths },
    ladderMode: stage.ladderMode,
    partySize: stage.partySize,
    castCharacterIds: [...stage.castCharacterIds],
    // R8 §13.2 — Phase C。Stage の pack が、その Stage で拾える装備の
    // affix family を決める。**Stage 番号では決めない**（pack が意味の単位）。
    enabledAffixFamilyIds: AFFIX_FAMILIES
      .filter((family) => family.packId === null || stage.enabledPackIds.includes(family.packId))
      .map((family) => family.id),
    enemyFamilyIds: [...stage.enemyFamilyIds],
    actBossIds: [...stage.actBossIds],
    actBossLawIds: [...stage.actBossLawIds],
    regionLawIds: [...stage.stageLawIds],
    rewardTableId: REGION.rewardTableId,
  };
}

// ---------------------------------------------------------------- 16.1 manifestラダー検査
//
// R8 §16.1。CampaignStageDef の並びが契約を満たすかを、機械的に検査する。
// **fun の証明ではない**——構造が壊れていないことだけを見る。
export function auditCampaignManifestLadder(stages = CAMPAIGN_STAGES) {
  const problems = [];
  const introducedBy = new Map(); // packId -> 最初に newPackId として現れた sequence
  const introducedFamilyBy = new Map(); // familyId -> 最初に出てきた sequence
  const introducedWeaponBy = new Map(); // weaponId -> 最初にmanifestへ出た sequence
  let lastPrimaryOffenseSequence = null;

  const sorted = [...stages].sort((a, b) => a.sequence - b.sequence);
  for (const stage of sorted) {
    const path = `${stage.id} (sequence ${stage.sequence})`;
    const previous = sorted.find((entry) => entry.sequence === stage.sequence - 1);

    // R25設計PR #287 §8・§12 — manifestの武器はcastと完全一致させる。
    // `sequence >= 2` のような暫定条件へ戻ると、人物加入と武器入口がずれる。
    const actualWeaponIds = Array.isArray(stage.enabledWeaponIds) ? stage.enabledWeaponIds : [];
    const expectedWeaponIds = weaponIdsForCharacterIds(stage.castCharacterIds);
    const sameIds = (actual, expected) => actual.length === expected.length
      && actual.every((id, index) => id === expected[index]);
    if (!sameIds(actualWeaponIds, expectedWeaponIds)) {
      problems.push(`${path}: enabledWeaponIds が加入済み人物の署名武器・副武器と一致しない`);
    }
    if (new Set(actualWeaponIds).size !== actualWeaponIds.length) {
      problems.push(`${path}: enabledWeaponIds に重複がある`);
    }
    for (const weaponId of actualWeaponIds) {
      if (!WEAPONS[weaponId]) {
        problems.push(`${path}: 未登録の武器 "${weaponId}" がenabledWeaponIdsにある`);
        continue;
      }
      if (!introducedWeaponBy.has(weaponId)) introducedWeaponBy.set(weaponId, stage.sequence);
    }
    const previousWeaponIds = previous?.enabledWeaponIds ?? [];
    const addedWeaponIds = actualWeaponIds.filter((id) => !previousWeaponIds.includes(id));
    const expectedAddedWeaponIds = stage.sequence === 0
      ? expectedWeaponIds
      : (stage.joiningCharacterId ? (WEAPON_IDS_BY_CHARACTER[stage.joiningCharacterId] ?? []) : []);
    if (!sameIds(addedWeaponIds, expectedAddedWeaponIds)) {
      problems.push(`${path}: 今Stageで追加される武器が加入人物の2武器と一致しない`);
    }

    // 新 pack は、あるなら一度だけ初登場し、必ず有効。**Stage 7・9 のように
    // 新 pack を持たない Stage がある**ので、宣言そのものは任意にした。
    // ただし「何も新しくない Stage」は作らない——`newAxis` が空の Stage は落とす。
    if (!stage.newAxis) problems.push(`${path}: その Stage で新しくなるもの（newAxis）が宣言されていない`);
    if (stage.newPackId) {
      if (!stage.enabledPackIds.includes(stage.newPackId)) {
        problems.push(`${path}: newPackId "${stage.newPackId}" が enabledPackIds に無い`);
      }
      if (introducedBy.has(stage.newPackId)) {
        problems.push(`${path}: newPackId "${stage.newPackId}" は sequence ${introducedBy.get(stage.newPackId)} で既出`);
      } else {
        introducedBy.set(stage.newPackId, stage.sequence);
      }
    }
    // 新しい家系も、初登場は一度きり。**その Stage の12戦に本当に出ていること**を見る
    // （宣言だけして盤面に出ない、が起きない）。
    if (stage.newEnemyFamilyId) {
      if (introducedFamilyBy.has(stage.newEnemyFamilyId)) {
        problems.push(`${path}: 家系 "${stage.newEnemyFamilyId}" は sequence ${introducedFamilyBy.get(stage.newEnemyFamilyId)} で既出`);
      } else {
        introducedFamilyBy.set(stage.newEnemyFamilyId, stage.sequence);
      }
      if (!stage.enemyFamilyIds.includes(stage.newEnemyFamilyId)) {
        problems.push(`${path}: 家系 "${stage.newEnemyFamilyId}" を名乗っているが、12戦に1体も出ていない`);
      }
    }
    // 過去に出た家系を、あとの Stage が名乗り直していない（導出しているので普通は起きない）。
    for (const familyId of stage.enemyFamilyIds) {
      if (familyId === stage.newEnemyFamilyId) continue;
      const introducedAt = introducedFamilyBy.get(familyId);
      if (introducedAt === undefined) introducedFamilyBy.set(familyId, stage.sequence);
    }

    // 幕ボスと法則は12戦から導出しているので、**空が混じっていないこと**だけ見る。
    if (stage.actBossIds.length !== 3 || stage.actBossIds.some((id) => !id)) {
      problems.push(`${path}: 幕ボスが3体そろっていない`);
    }
    if (stage.actBossLawIds.length !== 3 || stage.actBossLawIds.some((id) => !id)) {
      problems.push(`${path}: 幕ボスの公開法則が3つそろっていない`);
    }

    // enabledPackIds は newPackId と returningPackIds から成る。
    const expectedEnabled = new Set([...(stage.newPackId ? [stage.newPackId] : []), ...stage.returningPackIds]);
    const actualEnabled = new Set(stage.enabledPackIds);
    if (expectedEnabled.size !== actualEnabled.size
      || [...expectedEnabled].some((id) => !actualEnabled.has(id))) {
      problems.push(`${path}: enabledPackIds が newPackId + returningPackIds と一致しない`);
    }

    // 有効pack数が、その Stage が名乗るラダーの式と一致する。
    if (!LADDER_MODES.includes(stage.ladderMode)) {
      problems.push(`${path}: ladderMode "${stage.ladderMode}" が未知`);
    }
    const expectedCount = activePackCountForSequence(stage.sequence, stage.ladderMode);
    if (stage.activePackCount !== expectedCount || stage.enabledPackIds.length !== expectedCount) {
      problems.push(`${path}: activePackCount が ${expectedCount} でない`
        + `（宣言 ${stage.activePackCount}、enabledPackIds.length ${stage.enabledPackIds.length}）`);
    }

    // R9 §2.1 — チュートリアルは2人から始めて Stage ごとに1人増え、Stage 3で5人。
    if (stage.ladderMode === "tutorial") {
      const expectedParty = Math.min(5, stage.sequence + 2);
      if (stage.partySize !== expectedParty) {
        problems.push(`${path}: partySize が ${expectedParty} でない（宣言 ${stage.partySize}）`);
      }
      if (stage.castCharacterIds.length !== stage.partySize) {
        problems.push(`${path}: castCharacterIds の人数が partySize と合わない`);
      }
      if (stage.sequence > 0) {
        if (!stage.joiningCharacterId) problems.push(`${path}: 加入する人物が宣言されていない`);
        else if (!stage.castCharacterIds.includes(stage.joiningCharacterId)) {
          problems.push(`${path}: 加入する人物 "${stage.joiningCharacterId}" が cast に居ない`);
        }
      }
      // 累積: 前 Stage の enabledPackIds を全部持っている（入れ替えない）。
      const previous = sorted.find((entry) => entry.sequence === stage.sequence - 1);
      if (previous) {
        for (const packId of previous.enabledPackIds) {
          if (!stage.enabledPackIds.includes(packId)) {
            problems.push(`${path}: チュートリアル中に pack "${packId}" が引き上げられている（R9 §3.1 は累積）`);
          }
        }
        for (const characterId of previous.castCharacterIds) {
          if (!stage.castCharacterIds.includes(characterId)) {
            problems.push(`${path}: チュートリアル中に "${characterId}" が抜けている（R9 §2.1 は仲間外れを作らない）`);
          }
        }
      }
      // 新 pack は core で入り、以前の pack は full になっている。
      if (stage.packDepths[stage.newPackId] !== "core") {
        problems.push(`${path}: 新 pack "${stage.newPackId}" が core で入っていない`);
      }
      for (const packId of stage.returningPackIds) {
        if (stage.packDepths[packId] !== "full") {
          problems.push(`${path}: 過去 pack "${packId}" が full になっていない（R9 §3.1）`);
        }
      }
      // どの Stage にも攻撃の主役が居る（累積なので pack_edge が残り続ける）。
      //
      // **例外は導入 Stage（sequence 0）だけ。**この検査のすぐ下のコメントが
      // 「stage_0 のように新規導入 Stage が hybrid のとき」を想定と書いているのに、
      // 判定側がそれを許していなかった。R11 §5 で Stage 0 は「条件のない一撃を
      // 武器と技で一本ずつ」に絞った導入になり、primary_offense はナギと一緒に
      // Stage 1 で来る。baseline の斬撃・防壁・応急は manifest に関わらず必ず
      // 引けるので（packs.mjs の BASELINE_*）、行動不能な人物は作られない。
      const hasPrimary = stage.enabledPackIds
        .some((packId) => PACK_BY_ID[packId]?.combatRole === "primary_offense");
      const hasHybrid = stage.enabledPackIds
        .some((packId) => PACK_BY_ID[packId]?.combatRole === "offensive_hybrid");
      if (!hasPrimary && !(stage.sequence === 0 && hasHybrid)) {
        problems.push(`${path}: primary_offense pack が残っていない`);
      }
    }

    // R23 — 第2章（campaign）。人は増えず、語彙は減らない。
    if (stage.ladderMode === "campaign") {
      if (stage.partySize !== 5) problems.push(`${path}: 第2章の人数は5でなければならない`);
      if (stage.joiningCharacterId) problems.push(`${path}: 第2章で新しく加入する人物は居ない`);
      const previous = sorted.find((entry) => entry.sequence === stage.sequence - 1);
      if (previous) {
        for (const packId of previous.enabledPackIds) {
          if (stage.enabledPackIds.includes(packId)) continue;
          problems.push(`${path}: pack "${packId}" が引き上げられている（第2章は語彙を取り上げない）`);
        }
      }
      for (const [packId, depth] of Object.entries(stage.packDepths)) {
        if (depth !== "full") problems.push(`${path}: 第2章の pack "${packId}" は full で出る（core は導入 Stage だけ）`);
      }
      // 新 pack も新しい家系も無い Stage は、**組み合わせが新しいことを明示する**。
      if (!stage.newPackId && !stage.newEnemyFamilyId && !/組み合わせ|総復習/.test(stage.newAxis)) {
        problems.push(`${path}: 新 pack も新しい家系も無いのに、何が新しいのかが書かれていない`);
      }
    }

    // future packが早いStageへ漏れない: returningPackIds は「それより前の
    // sequence で newPackId として既出」のものだけ。
    for (const packId of stage.returningPackIds) {
      const introducedAt = introducedBy.get(packId);
      if (introducedAt === undefined || introducedAt >= stage.sequence) {
        problems.push(`${path}: returningPackIds に含む "${packId}" は、まだこの Stage より前で初登場していない`);
      }
    }

    // 参照する pack が SKILL_PACKS に実在し、role を宣言している。
    for (const packId of stage.enabledPackIds) {
      const pack = PACK_BY_ID[packId];
      if (!pack) {
        problems.push(`${path}: pack "${packId}" が SKILL_PACKS に存在しない`);
        continue;
      }
      if (!pack.combatRole) problems.push(`${path}: pack "${packId}" が combatRole を宣言していない`);
    }

    // 全manifestにprimary offenseまたは許可されたoffensive hybridがある。
    const roles = stage.enabledPackIds.map((id) => PACK_BY_ID[id]?.combatRole).filter(Boolean);
    const hasPrimary = roles.includes("primary_offense");
    const hasHybrid = roles.includes("offensive_hybrid");
    if (!hasPrimary && !hasHybrid) {
      problems.push(`${path}: primary_offense も offensive_hybrid も含まない manifest`);
    }
    // 幕1（Stage自体の最初の局面）だけは offensive_hybrid 代替を許すが、
    // それは stage_0 のように新規導入 Stage が hybrid のときの話であって、
    // ここでは「stage 自体に攻撃役が居るか」だけを見る（R8 §6.5）。

    // 有効パック4以上では、primary offenseまたはoffensive hybridを二つ以上含める。
    if (stage.enabledPackIds.length >= 4) {
      const offenseRoleCount = roles.filter((role) => role === "primary_offense" || role === "offensive_hybrid").length;
      if (offenseRoleCount < 2) {
        problems.push(`${path}: 有効パック4以上なのに攻撃roleを持つpackが2つ未満`);
      }
    }

    // primary offenseを少なくとも3Stageに一つ新規導入する。
    if (stage.newPackId && PACK_BY_ID[stage.newPackId]?.combatRole === "primary_offense") {
      if (lastPrimaryOffenseSequence !== null && stage.sequence - lastPrimaryOffenseSequence > 3) {
        problems.push(`${path}: 直前の primary_offense 新規導入（sequence ${lastPrimaryOffenseSequence}）から3Stageを超えている`);
      }
      lastPrimaryOffenseSequence = stage.sequence;
    }
  }

  // catalogへ登録した武器は、未実装でもシナリオの解禁計画から漏らさない。
  // content moduleが追加されるまでは、app側がIMPLEMENTED_WEAPON_IDSで表示を抑える。
  for (const weaponId of Object.keys(WEAPONS)) {
    if (!introducedWeaponBy.has(weaponId)) {
      problems.push(`武器 "${weaponId}" がCampaign manifestへ一度も導入されていない`);
    }
  }

  // 同Stage・異seedでpack構成が一致する（決定性）。
  for (const stage of sorted) {
    const a = campaignManifestForStage(stage.sequence, "seed-a");
    const b = campaignManifestForStage(stage.sequence, "seed-b");
    if (JSON.stringify(a.enabledPackIds) !== JSON.stringify(b.enabledPackIds)
      || JSON.stringify(a.packDepths) !== JSON.stringify(b.packDepths)) {
      problems.push(`${stage.id}: seed を変えると enabledPackIds が変わった（campaign は pack 選択に seed を使わない契約）`);
    }
  }

  return problems;
}
