// ecology/content/expedition.mjs
//
// **3幕12戦の遠征、敵の threat cost、変異、難易度 0〜5。R6 §5.1 / §11 / §13。**
// R7 Milestone 4（Phase B）で新設した。
//
// ここに**新しい敵定義は1件も無い**。使うのは Phase A までに公開済みの
// 7 chassis だけで、幕ごとの重さは「何体を、どう並べ、どの変異を載せるか」で作る。
// R7 §5 Milestone 4 は「Phase A で固定済みの語彙だけ」を並列拡張の条件にしていて、
// 作者 Gate の前に敵を量産することを禁じている（R7 §11 の停止条件）。
//
// 地域の世界観本文は world-lore.mjs に置く。
import { REGION_LORE } from "./world-lore.mjs";
// ---------------------------------------------------------------- threat cost
//
// R6 §11.2 — chassis、追加個体、mutation、boss law が budget を消費する。
// **値は soft data**（R7 §4.2）。遊んでから動かす前提で、動かしたら build の印が変わる。
//
// 決め方：Phase A の7区画を実測した重さの順に並べ、最も軽い走者を 1 とした。
// 走者1 → 後撃ち2 → 守衛3 / 反響体3 → 狩人4 → 盾兵5 → 核8。
export const ENEMY_THREAT_COST = Object.freeze({
  gray_scrapper: 1,
  gray_marksman: 2,
  gray_guard: 3,
  gray_echo: 3,
  gray_hunter: 4,
  gray_bulwark: 5,
  ash_core: 8,
});

// ---------------------------------------------------------------- 変異
//
// R6 §11.1 — EnemyMutationDef。**Phase B の変異は stat patch だけ**にする。
// rule を足す変異（tacticPatch / ruleIds）は新しい語彙を敵側へ入れることになり、
// R7 §5 は「新語彙を必要とする content は先行実装せず、mechanics pack として
// 一系統ずつ追加する」と決めている。だから Phase B では、
// **戦闘前に全部見える数値の変異**に限る。
//
// bps は base stat に対する倍率（10_000 = 等倍）、flat は加算。
// 適用順は「倍率 → 加算 → round-half-up」で、常に base から計算する
// （R6 §9.5 と同じ理由。買った順や読み込み順で複利差を作らない）。
export const ENEMY_MUTATIONS = Object.freeze({
  swift: Object.freeze({
    id: "swift", displayName: "逸り", threatCost: 1,
    patch: Object.freeze({ might: { flat: 6 } }),
    previewText: "腕力+6。一撃が重くなる。",
  }),
  hardened: Object.freeze({
    id: "hardened", displayName: "硬化", threatCost: 2,
    patch: Object.freeze({ guard: { flat: 6 } }),
    previewText: "受け+6。多段が通りにくくなる。単発と貫きで抜く。",
  }),
  heavy_hand: Object.freeze({
    id: "heavy_hand", displayName: "重手", threatCost: 2,
    patch: Object.freeze({ might: { bps: 13_000 }, focus: { bps: 13_000 } }),
    previewText: "腕力・技術が3割増える。受け切るより先に落とす。",
  }),
  resilient: Object.freeze({
    id: "resilient", displayName: "厚み", threatCost: 3,
    patch: Object.freeze({ maxHp: { bps: 13_000 } }),
    previewText: "最大HPが3割増える。削り切る手数が要る。",
  }),
});

// budget の余りを変異へ回すときの順。**seed ではなく固定順**にする理由は、
// 難易度が上がったときに何が増えたのかを作者が一目で言えるようにするため。
// 同じ rank なら毎回同じ変異が付き、rank を上げた分だけ増える。
export const MUTATION_SPEND_ORDER = Object.freeze(["swift", "hardened", "heavy_hand", "resilient"]);
export const MAX_MUTATIONS_PER_UNIT = 2;

// ---------------------------------------------------------------- boss law
//
// R6 §11.3 — 各 boss は公開された法則を1個持ち、遠征開始時から見える。
// **Phase B の boss law は、その chassis が既に持っている振る舞いの公開と、
// それを支える数値変異である。**新しい rule はまだ足さない（上の変異と同じ理由）。
// 「三つの異なる対応方法」は counters に書き、遠征開始画面へそのまま出す。
export const BOSS_LAWS = Object.freeze({
  law_bulwark_wall: Object.freeze({
    id: "law_bulwark_wall", displayName: "盾将の法則", threatCost: 5,
    patch: Object.freeze({ guard: { flat: 8 }, maxHp: { bps: 14_000 } }),
    previewText: "防壁を張り直しながら前列を叩く。受けが厚く、一撃ごとに削られる。",
    counters: Object.freeze([
      "貫き突きで受けを6割無視する",
      "単発の大打撃で、受けの引き算を一度で済ませる",
      "防壁と身代わりで前列を保たせ、round をかけて削る",
    ]),
  }),
  law_echo_return: Object.freeze({
    id: "law_echo_return", displayName: "反響の法則", threatCost: 6,
    patch: Object.freeze({ might: { bps: 13_000 }, maxHp: { bps: 15_000 } }),
    previewText: "殴られた痛みを反響して返す。手数で削るほど、こちらも減る。",
    counters: Object.freeze([
      "多段をやめ、単発の大打撃で殴る回数を減らす",
      "余剰治療と応急手当で、返ってくる分を先に埋める",
      "防壁を厚くして、反響そのものを吸う",
    ]),
  }),
  law_core_charge: Object.freeze({
    id: "law_core_charge", displayName: "核の法則", threatCost: 8,
    patch: Object.freeze({ focus: { bps: 13_000 }, guard: { flat: 6 }, maxHp: { bps: 14_000 } }),
    previewText: "重い一撃を溜め、完成したら前列へ放つ。準備中は殴られやすい。",
    counters: Object.freeze([
      "準備狩りで、溜めている間に叩く",
      "身代わりで受け手を選び、放たれた一撃を分散させる",
      "位置替えで前列を入れ替え、傷んだ人物を後ろへ下げる",
    ]),
  }),
});

// ---------------------------------------------------------------- 12戦
//
// R6 §5.1 — 3幕、合計12戦。1〜3、5〜7、9〜11 は通常または精鋭。4、8、12 はボス。
//
// `threatBudget` は **rank 0 でちょうど使い切る値**にしてある。
// つまり rank 0 は「設計したそのままの編成」で、増援も余り変異も出ない。
// R7 §8 が「まず Difficulty 0 の reference encounter を固定する」と言っているのは
// これのことで、難易度は rank 層が budget を足した分だけ増える。
//
// `reinforcements` は余り budget が最初に買うもの。5体を超えないので、
// 5体編成の戦闘では余りは変異へ回る（そうしないと rank を上げても何も起きない）。
const ENCOUNTERS_RAW = [
  {
    index: 1, act: 1, kind: "normal", name: "灰の入口",
    description: "正面から来る二体。前列が受け、攻撃役が一体ずつ落とす。",
    enemies: [
      { enemyActorId: "gray_scrapper", position: "front_left" },
      { enemyActorId: "gray_scrapper", position: "front_right" },
    ],
    reinforcements: [{ enemyActorId: "gray_scrapper", position: "rear_left" }],
    maxRounds: 8,
  },
  {
    index: 2, act: 1, kind: "normal", name: "狩りの路地",
    description: "後列を狙う射手が混じる。前だけ固めても通らない。",
    enemies: [
      { enemyActorId: "gray_scrapper", position: "front_left" },
      { enemyActorId: "gray_scrapper", position: "front_right" },
      { enemyActorId: "gray_marksman", position: "rear_left" },
    ],
    reinforcements: [{ enemyActorId: "gray_marksman", position: "rear_right" }],
    maxRounds: 8,
  },
  {
    index: 3, act: 1, kind: "elite", name: "崩れた盾列",
    description: "受けの厚い守衛が二体。多段では削り切れない。",
    enemies: [
      { enemyActorId: "gray_guard", position: "front_left" },
      { enemyActorId: "gray_guard", position: "front_right" },
      { enemyActorId: "gray_scrapper", position: "rear_left" },
    ],
    reinforcements: [{ enemyActorId: "gray_marksman", position: "rear_right" }],
    maxRounds: 9,
  },
  {
    index: 4, act: 1, kind: "boss", name: "盾将の門",
    description: "第1幕のボス。受けの厚い盾将と、その足元を固める二体。",
    bossLawId: "law_bulwark_wall",
    enemies: [
      { enemyActorId: "gray_bulwark", position: "front_center", boss: true },
      { enemyActorId: "gray_scrapper", position: "front_left" },
      { enemyActorId: "gray_marksman", position: "rear_left" },
    ],
    reinforcements: [{ enemyActorId: "gray_scrapper", position: "front_right" }],
    maxRounds: 12,
  },
  {
    index: 5, act: 2, kind: "normal", name: "灰の圧力",
    description: "重い盾、狩人、反響体、射手。どの役割を厚くするかが問われる。",
    enemies: [
      { enemyActorId: "gray_bulwark", position: "front_left" },
      { enemyActorId: "gray_hunter", position: "front_right" },
      { enemyActorId: "gray_echo", position: "rear_left" },
      { enemyActorId: "gray_marksman", position: "rear_right" },
    ],
    reinforcements: [{ enemyActorId: "gray_scrapper", position: "front_center" }],
    maxRounds: 10,
  },
  {
    index: 6, act: 2, kind: "normal", name: "二つの狙い",
    description: "前列を削る守衛と、準備中を狙う狩人。隊列そのものが防御になる。",
    enemies: [
      { enemyActorId: "gray_guard", position: "front_left" },
      { enemyActorId: "gray_guard", position: "front_center" },
      { enemyActorId: "gray_echo", position: "front_right" },
      { enemyActorId: "gray_hunter", position: "rear_left" },
      { enemyActorId: "gray_marksman", position: "rear_right" },
    ],
    reinforcements: [],
    maxRounds: 10,
  },
  {
    index: 7, act: 2, kind: "elite", name: "反響の坑道",
    description: "殴るほど返ってくる二体。手数を出すほど自分が減る。",
    enemies: [
      { enemyActorId: "gray_bulwark", position: "front_left" },
      { enemyActorId: "gray_echo", position: "front_center" },
      { enemyActorId: "gray_echo", position: "front_right" },
      { enemyActorId: "gray_hunter", position: "rear_left" },
      { enemyActorId: "gray_marksman", position: "rear_right" },
    ],
    reinforcements: [],
    maxRounds: 11,
  },
  {
    index: 8, act: 2, kind: "boss", name: "反響体の巣",
    description: "第2幕のボス。返しの本体を、護衛ごと崩す。",
    bossLawId: "law_echo_return",
    enemies: [
      { enemyActorId: "gray_echo", position: "front_center", boss: true },
      { enemyActorId: "gray_guard", position: "front_left" },
      { enemyActorId: "gray_guard", position: "front_right" },
      { enemyActorId: "gray_hunter", position: "rear_left" },
      { enemyActorId: "gray_marksman", position: "rear_right" },
    ],
    reinforcements: [],
    maxRounds: 13,
  },
  {
    index: 9, act: 3, kind: "normal", name: "盾の回廊",
    description: "厚い前列が三枚。抜けないなら、行と列で薙ぐ。",
    enemies: [
      { enemyActorId: "gray_bulwark", position: "front_left" },
      { enemyActorId: "gray_bulwark", position: "front_right" },
      { enemyActorId: "gray_hunter", position: "front_center" },
      { enemyActorId: "gray_hunter", position: "rear_left" },
      { enemyActorId: "gray_hunter", position: "rear_right" },
    ],
    reinforcements: [],
    maxRounds: 12,
  },
  {
    index: 10, act: 3, kind: "normal", name: "灰の重列",
    description: "盾が三枚並ぶ。単発で一枚ずつ落とすか、列ごと貫くか。",
    enemies: [
      { enemyActorId: "gray_bulwark", position: "front_left" },
      { enemyActorId: "gray_bulwark", position: "front_center" },
      { enemyActorId: "gray_bulwark", position: "front_right" },
      { enemyActorId: "gray_hunter", position: "rear_left" },
      { enemyActorId: "gray_hunter", position: "rear_right" },
    ],
    reinforcements: [],
    maxRounds: 13,
  },
  {
    index: 11, act: 3, kind: "elite", name: "核の前庭",
    description: "核が護衛を連れて出てくる。ボスの予行になる。",
    enemies: [
      { enemyActorId: "ash_core", position: "front_center" },
      { enemyActorId: "gray_bulwark", position: "front_left" },
      { enemyActorId: "gray_bulwark", position: "front_right" },
      { enemyActorId: "gray_hunter", position: "rear_left" },
      { enemyActorId: "gray_marksman", position: "rear_right" },
    ],
    reinforcements: [],
    maxRounds: 13,
  },
  {
    index: 12, act: 3, kind: "boss", name: "灰の核心",
    description: "最終戦。溜めを止めながら、厚い前列を突破する。",
    bossLawId: "law_core_charge",
    enemies: [
      { enemyActorId: "ash_core", position: "front_center", boss: true },
      { enemyActorId: "gray_bulwark", position: "front_left" },
      { enemyActorId: "gray_bulwark", position: "front_right" },
      { enemyActorId: "gray_guard", position: "rear_left" },
      { enemyActorId: "gray_hunter", position: "rear_right" },
    ],
    reinforcements: [],
    maxRounds: 15,
  },
];

// threat budget は手で書かない。**編成から算出する**ので、
// 敵を1体足したのに budget を直し忘れる、が起きない。
function baseThreatOf(encounter) {
  let total = 0;
  for (const enemy of encounter.enemies) {
    total += ENEMY_THREAT_COST[enemy.enemyActorId] ?? 0;
    if (enemy.boss && encounter.bossLawId) total += BOSS_LAWS[encounter.bossLawId].threatCost;
  }
  return total;
}

export const EXPEDITION_ENCOUNTERS = Object.freeze(
  ENCOUNTERS_RAW.map((encounter) => Object.freeze({
    ...encounter,
    threatBudget: baseThreatOf(encounter),
    enemies: Object.freeze(encounter.enemies.map((enemy) => Object.freeze({ ...enemy }))),
    reinforcements: Object.freeze(encounter.reinforcements.map((enemy) => Object.freeze({ ...enemy }))),
  })),
);

export const ENCOUNTERS_PER_RUN = EXPEDITION_ENCOUNTERS.length;
export const ACT_BOSS_INDEXES = Object.freeze([4, 8, 12]);

// ---------------------------------------------------------------- 地域
export const REGION = Object.freeze({
  id: "ash_frontier",
  displayName: REGION_LORE.ash_frontier.displayName,
  summary: REGION_LORE.ash_frontier.summary,
  enemyFamilyIds: Object.freeze(["husk"]),
  enemyFamilyText: REGION_LORE.ash_frontier.enemyFamilyText,
  // R6 §5.2 の regionLawIds。**Phase B では法則を1つも足していない**ので空にする。
  // 空の実装や架空 id を先に置かない（R7 §4.3）。
  regionLawIds: Object.freeze([]),
  rewardTableId: "equipment_1",
  actBossIds: Object.freeze(["gray_bulwark", "gray_echo", "ash_core"]),
  actBossLawIds: Object.freeze(["law_bulwark_wall", "law_echo_return", "law_core_charge"]),
});

// ---------------------------------------------------------------- 難易度
//
// R6 §13.2 — DifficultyDef を data で持つ。**Phase B は 0〜5 だけ**（§17.2）。
// 6〜20 は同じ schema で足す。値は R6 §13.2 の例をそのまま累積させたもので、
// 実装側で勝手な倍率を積んでいない。
//
// R6 §9.6 — rank は活動資金で買えず、一つ前の rank をクリアしたときだけ開く。
export const DIFFICULTIES = Object.freeze([
  Object.freeze({
    rank: 0, threatBudgetDelta: 0, startingSupplies: 0,
    eliteMutationCount: 0, bossMutationCount: 0, normalMaxRoundsDelta: 0,
    encounterModifiers: Object.freeze([]),
    summary: "基準。設計したままの編成で戦う。",
  }),
  Object.freeze({
    rank: 1, threatBudgetDelta: 1, startingSupplies: 0,
    eliteMutationCount: 0, bossMutationCount: 0, normalMaxRoundsDelta: 0,
    encounterModifiers: Object.freeze(["threat_budget_plus_1"]),
    summary: "全戦闘の threat budget +1。増援か変異が一つ増える。",
  }),
  Object.freeze({
    rank: 2, threatBudgetDelta: 1, startingSupplies: 0,
    eliteMutationCount: 1, bossMutationCount: 0, normalMaxRoundsDelta: 0,
    encounterModifiers: Object.freeze(["threat_budget_plus_1", "elite_mutation_plus_1"]),
    summary: "上に加えて、精鋭へ変異 +1。",
  }),
  Object.freeze({
    rank: 3, threatBudgetDelta: 1, startingSupplies: 0,
    eliteMutationCount: 1, bossMutationCount: 0, normalMaxRoundsDelta: -1,
    encounterModifiers: Object.freeze(["threat_budget_plus_1", "elite_mutation_plus_1", "normal_rounds_minus_1"]),
    summary: "上に加えて、通常戦の round 上限 -1。",
  }),
  Object.freeze({
    rank: 4, threatBudgetDelta: 1, startingSupplies: 0,
    eliteMutationCount: 1, bossMutationCount: 1, normalMaxRoundsDelta: -1,
    encounterModifiers: Object.freeze([
      "threat_budget_plus_1", "elite_mutation_plus_1", "normal_rounds_minus_1", "boss_mutation_plus_1",
    ]),
    summary: "上に加えて、各ボスへ変異 +1。",
  }),
  Object.freeze({
    rank: 5, threatBudgetDelta: 1, startingSupplies: 0,
    eliteMutationCount: 1, bossMutationCount: 1, normalMaxRoundsDelta: -1,
    encounterModifiers: Object.freeze([
      "threat_budget_plus_1", "elite_mutation_plus_1", "normal_rounds_minus_1", "boss_mutation_plus_1",
    ]),
    summary: "上に加えて、開始補給の基準値は0のまま。",
  }),
]);

export const MAX_DIFFICULTY_RANK = DIFFICULTIES.length - 1;

export function difficultyDef(rank) {
  return DIFFICULTIES[Math.max(0, Math.min(MAX_DIFFICULTY_RANK, Math.floor(rank ?? 0)))];
}

export function expeditionEncounter(index) {
  return EXPEDITION_ENCOUNTERS[Math.max(0, Math.min(ENCOUNTERS_PER_RUN - 1, index - 1))];
}

export function actOf(index) {
  return expeditionEncounter(index).act;
}
