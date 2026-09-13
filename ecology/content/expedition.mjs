// ecology/content/expedition.mjs
//
// **Stage ごとの3幕12戦、敵の threat cost、変異、難易度 0〜5。R6 §5.1 / §11 / §13。**
//
// ---------------------------------------------------------------- R23 で変えたこと
//
// **12戦の中身が Stage ごとに分かれた。**
//
// 以前は `EXPEDITION_ENCOUNTERS` という**一組しか無く**、Stage 0 から Stage 3 まで
// 同じ12戦を、人数に合わせて切り詰めて遊んでいた。Stage が進んでも出てくる敵も
// 並びも同じで、増えるのは味方の人数だけだったので、**第2 Stage 以降が調整されて
// いないのではなく、そもそも別物として存在していなかった。**
//
// いま Stage は `STAGE_ENCOUNTERS` に自分の12戦を持つ。第一部は10 Stage で、
// 進むごとに別の家系（灰殻 → 灰塵 → 灰織 → 灰炉）が入る。
// **家系ごとに圧力の軸が違う**（`content/enemies.mjs` の ENEMY_FAMILIES）ので、
// 「同じ敵が数だけ増える」形の難度上昇にはならない。
//
// また、Stage が名乗る `enemyFamilyIds` / `actBossIds` / `actBossLawIds` は、
// **その Stage の12戦から導出する**（`content/campaign-stages.mjs`）。
// 手で書いた placeholder が実際の盤面とずれる、が構造として起きない。
//
// 地域の世界観本文は world-lore.mjs に置く。
import { ENEMY_THREAT_COST } from "./enemies.mjs";
import { REGION_LORE } from "./world-lore.mjs";

export { ENEMY_THREAT_COST };

// ---------------------------------------------------------------- 変異
//
// R6 §11.1 — EnemyMutationDef。**変異は stat patch だけ**にする。
// rule を足す変異は新しい語彙を敵側へ入れることになるので、
// **戦闘前に全部見える数値の変異**に限る。
//
// bps は base stat に対する倍率（10_000 = 等倍）、flat は加算。
// 適用順は「倍率 → 加算 → round-half-up」で、常に base から計算する。
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
export const MUTATION_SPEND_ORDER = Object.freeze(["swift", "hardened", "heavy_hand", "resilient"]);
export const MAX_MUTATIONS_PER_UNIT = 2;

// ---------------------------------------------------------------- boss law
//
// R6 §11.3 — 各 boss は公開された法則を1個持ち、遠征開始時から見える。
// **boss law は、その chassis が既に持っている振る舞いの公開と、それを支える
// 数値変異である。**新しい rule は足さない（上の変異と同じ理由）。
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
    previewText: "殴られると反応点1で殴り返す。手数で削るほど、こちらも減る。",
    counters: Object.freeze([
      "多段をやめ、単発の大打撃で殴る回数を減らす",
      "余剰治療と応急手当で、返ってくる分を先に埋める",
      "防壁を厚くして、返ってくる一撃そのものを吸う",
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
  // ---- R23 追加。第一部の後半 Stage が使う。
  law_breaker_swing: Object.freeze({
    id: "law_breaker_swing", displayName: "砕きの法則", threatCost: 4,
    patch: Object.freeze({ might: { bps: 14_000 }, maxHp: { bps: 13_000 } }),
    previewText: "溜めては重く振る。溜めている間は受けが薄い。",
    counters: Object.freeze([
      "準備狩りで、振り下ろす前に止める",
      "受け構えを配って、単発の一撃を一度だけ消す",
      "傷んだ前衛を位置替えで下げ、当たる相手を選ぶ",
    ]),
  }),
  law_harrower_chase: Object.freeze({
    id: "law_harrower_chase", displayName: "追い手の法則", threatCost: 5,
    patch: Object.freeze({ focus: { bps: 14_000 }, maxHp: { bps: 13_000 } }),
    previewText: "準備中の者を先に潰し、いなければ後列を追う。後ろが安全でなくなる。",
    counters: Object.freeze([
      "準備の要らない技能で押し、狙われる理由を作らない",
      "身代わりで後衛への一撃を前で受ける",
      "受けの厚い人物を後列へ置いて、追わせても割に合わなくする",
    ]),
  }),
  law_choir_mark: Object.freeze({
    id: "law_choir_mark", displayName: "唱和の法則", threatCost: 6,
    patch: Object.freeze({ focus: { bps: 14_000 }, maxHp: { bps: 14_000 } }),
    previewText: "隙を面で配る。次に来る一撃が、全員ぶん重くなる。",
    counters: Object.freeze([
      "払いのけるで、自分に付いた隙を落とす",
      "配り手を先に落として、隙の供給を止める",
      "防壁と守勢を重ね、重くなった一撃ごと吸う",
    ]),
  }),
  law_veil_guard: Object.freeze({
    id: "law_veil_guard", displayName: "帳の法則", threatCost: 6,
    patch: Object.freeze({ focus: { bps: 13_000 }, guard: { flat: 6 }, maxHp: { bps: 15_000 } }),
    previewText: "自分の側へ受け構えを配り続ける。削り切る手数が要る。",
    counters: Object.freeze([
      "多段で受け構えを剥がしてから、本命を通す",
      "受け崩しで受け構えごと無視する",
      "配り手を先に落として、構えの供給を止める",
    ]),
  }),
  law_dust_tide: Object.freeze({
    id: "law_dust_tide", displayName: "潮の法則", threatCost: 9,
    patch: Object.freeze({ might: { bps: 13_000 }, focus: { bps: 13_000 }, maxHp: { bps: 15_000 } }),
    previewText: "行を薙ぎ、列を貫く。前へ二人並べても、後ろへ下げても同時に届く。",
    counters: Object.freeze([
      "前列を一人にして、行の薙ぎが割に合わない形にする",
      "同じ列に二人を重ねず、貫きの的を減らす",
      "面の回復と防壁で、まとめて受けた分をまとめて戻す",
    ]),
  }),
  law_knot_stagger: Object.freeze({
    id: "law_knot_stagger", displayName: "結びの法則", threatCost: 6,
    patch: Object.freeze({ might: { bps: 13_000 }, guard: { flat: 6 }, maxHp: { bps: 14_000 } }),
    previewText: "怯みを重ねて、こちらの出す damage を段ごとに軽くする。",
    counters: Object.freeze([
      "手数ではなく一撃の大きさで押し、軽減の回数を減らす",
      "怯みの付いていない人物へ行動権を渡す",
      "受け無視の技能で、軽減の掛からない damage を作る",
    ]),
  }),
  law_thorn_bleed: Object.freeze({
    id: "law_thorn_bleed", displayName: "棘の法則", threatCost: 6,
    patch: Object.freeze({ might: { bps: 14_000 }, maxHp: { bps: 14_000 } }),
    previewText: "裂傷を刻む。裂傷はラウンド終わりに、受けを無視して削る。",
    counters: Object.freeze([
      "硬さではなく回復で戻す。受けでは裂傷が減らない",
      "短い round で決め、刻まれる回数そのものを減らす",
      "傷の深い人物を後ろへ下げ、重ねて刻ませない",
    ]),
  }),
  law_weave_mirror: Object.freeze({
    id: "law_weave_mirror", displayName: "写しの法則", threatCost: 10,
    patch: Object.freeze({ focus: { bps: 13_000 }, guard: { flat: 6 }, maxHp: { bps: 15_000 } }),
    previewText: "後列で最もHPの低い者を最前へ引き出し、殴られれば返す。隠れ場所が消える。",
    counters: Object.freeze([
      "後列で一番柔らかい人物を作らない。HPを揃えて引き出す的を消す",
      "引き出されたその round に位置替えで戻す",
      "多段をやめ、返ってくる回数を減らす",
    ]),
  }),
  law_anvil_hold: Object.freeze({
    id: "law_anvil_hold", displayName: "金床の法則", threatCost: 8,
    patch: Object.freeze({ guard: { flat: 10 }, maxHp: { bps: 16_000 } }),
    previewText: "受けが最も厚く、防壁を張り直す。持久の勝負になる。",
    counters: Object.freeze([
      "受け崩しで、受けも受け構えも無視する",
      "貫き突きで受けを6割無視し、一撃を大きくする",
      "補給と回復を先に整えて、長い round に耐える形を作る",
    ]),
  }),
  law_hammer_break: Object.freeze({
    id: "law_hammer_break", displayName: "槌の法則", threatCost: 7,
    patch: Object.freeze({ might: { bps: 14_000 }, maxHp: { bps: 14_000 } }),
    previewText: "受けも受け構えも無視して叩く。守りでは damage が減らない。",
    counters: Object.freeze([
      "防壁（barrier）で受け止める。受け無視は barrier までは無視しない",
      "回復で戻す。減らせないぶん、戻す側で釣り合わせる",
      "短い round で落とし、振られる回数を減らす",
    ]),
  }),
  law_forge_furnace: Object.freeze({
    id: "law_forge_furnace", displayName: "炉の法則", threatCost: 12,
    patch: Object.freeze({ might: { bps: 13_000 }, focus: { bps: 13_000 }, guard: { flat: 8 }, maxHp: { bps: 16_000 } }),
    previewText: "溜めた一撃と、受けを無視する一撃を交互に出す。硬さでも回復でも、片方だけでは足りない。",
    counters: Object.freeze([
      "準備狩りで溜めを止め、受け無視のほうへ守りを集める",
      "防壁と回復を両方持ち、二種類の damage を別々に受ける",
      "必殺を残しておき、溜めが完成する round に合わせて落とす",
    ]),
  }),
});

// ---------------------------------------------------------------- 12戦
//
// R6 §5.1 — 3幕、合計12戦。1〜3、5〜7、9〜11 は通常または精鋭。4、8、12 はボス。
//
// `threatBudget` は **rank 0 でちょうど使い切る値**にしてあり、編成から算出する
// （手で書かないので、敵を1体足したのに budget を直し忘れる、が起きない）。
// `reinforcements` は余り budget が最初に買うもの。
//
// 位置は二文字で書く。F=前列 / R=後列、L=左 / C=中央 / R=右。
// 先頭が boss（`*`）。**少人数 Stage は後ろの枠から落ちる**ので、その Stage で
// 一番見せたい個体を前のほうへ書く（progression.mjs の composeEncounter）。
const POSITIONS = Object.freeze({
  FL: "front_left", FC: "front_center", FR: "front_right",
  RL: "rear_left", RC: "rear_center", RR: "rear_right",
});

function slot(token) {
  const boss = token.endsWith("*");
  const body = boss ? token.slice(0, -1) : token;
  const [enemyActorId, code] = body.split("@");
  const position = POSITIONS[code];
  if (!position) throw new Error("expedition: 未知の位置コード " + code + "（" + token + "）");
  if (!Object.hasOwn(ENEMY_THREAT_COST, enemyActorId)) {
    throw new Error("expedition: 表に無い敵 " + enemyActorId);
  }
  return boss ? { enemyActorId, position, boss: true } : { enemyActorId, position };
}

// index / kind / act は並びから決める。**手で番号を振らない。**
function stageEncounters(rows) {
  if (rows.length !== 12) throw new Error("expedition: 12戦でない Stage がある（" + rows.length + "戦）");
  return rows.map((row, offset) => {
    const index = offset + 1;
    const act = index <= 4 ? 1 : index <= 8 ? 2 : 3;
    const kind = index % 4 === 0 ? "boss" : index % 4 === 3 ? "elite" : "normal";
    const enemies = row.enemies.map(slot);
    const reinforcements = (row.reinforcements ?? []).map(slot);
    let threatBudget = 0;
    for (const enemy of enemies) {
      threatBudget += ENEMY_THREAT_COST[enemy.enemyActorId] ?? 0;
      if (enemy.boss && row.bossLawId) threatBudget += BOSS_LAWS[row.bossLawId].threatCost;
    }
    if (kind === "boss" && !row.bossLawId) throw new Error("expedition: ボス戦に法則が無い " + row.name);
    if (kind === "boss" && !enemies.some((enemy) => enemy.boss)) {
      throw new Error("expedition: ボスの居ないボス戦 " + row.name);
    }
    return {
      index, act, kind,
      name: row.name,
      description: row.description,
      bossLawId: row.bossLawId ?? null,
      maxRounds: row.maxRounds,
      threatBudget,
      enemies: Object.freeze(enemies.map((enemy) => Object.freeze(enemy))),
      reinforcements: Object.freeze(reinforcements.map((enemy) => Object.freeze(enemy))),
    };
  }).map((encounter) => {
    if (encounter.enemies.length > 5) throw new Error("expedition: 敵が6体以上 " + encounter.name);
    const positions = new Set(encounter.enemies.map((enemy) => enemy.position));
    if (positions.size !== encounter.enemies.length) {
      throw new Error("expedition: 位置が重複している " + encounter.name);
    }
    return Object.freeze(encounter);
  });
}

// R6 §11.2「base budget は単調増加」を、**通常戦の列とボス戦の列に分けて**見る。
//
// 旧実装は12戦を一列で見ていた。boss law の threatCost が boss の budget に乗るので、
// 一列で単調増加を要求すると「第2幕の最初の通常戦は、第1幕のボスより重くなければ
// ならない」ことになり、**幕の切り替わりで必ず一段跳ね上がる**。敵の水増しでしか
// 満たせない条件で、幕の頭が息を抜く場所であるという構成とも噛み合わない。
//
// いま見るのは三つ:
//   1. 通常戦・精鋭戦の budget が、12戦の並び順に単調増加する（9戦の列）
//   2. ボス戦の budget が、幕を追って単調増加する（3戦の列）
//   3. 各幕のボスは、その幕のどの通常戦より重い
// 旧 Stage 0 の数値はこの三つを全部満たしていたので、**契約を緩めたのではなく、
// 同じことを boss law の重みに引きずられずに言い直した**だけである。
function auditBudgetLadder(rows, label) {
  const normals = rows.filter((row) => row.kind !== "boss");
  for (let i = 1; i < normals.length; i += 1) {
    if (normals[i].threatBudget > normals[i - 1].threatBudget) continue;
    throw new Error(`expedition(${label}): 通常戦の threat budget が前より重くない — `
      + `${normals[i - 1].name} ${normals[i - 1].threatBudget} → ${normals[i].name} ${normals[i].threatBudget}`);
  }
  const bosses = rows.filter((row) => row.kind === "boss");
  for (let i = 1; i < bosses.length; i += 1) {
    if (bosses[i].threatBudget > bosses[i - 1].threatBudget) continue;
    throw new Error(`expedition(${label}): ボス戦の threat budget が前の幕より重くない — `
      + `${bosses[i - 1].name} ${bosses[i - 1].threatBudget} → ${bosses[i].name} ${bosses[i].threatBudget}`);
  }
  for (const boss of bosses) {
    const inAct = normals.filter((row) => row.act === boss.act);
    const heaviest = Math.max(...inAct.map((row) => row.threatBudget));
    if (boss.threatBudget > heaviest) continue;
    throw new Error(`expedition(${label}): 幕${boss.act}のボス ${boss.name} が、`
      + `その幕の通常戦（最大 ${heaviest}）より軽い（${boss.threatBudget}）`);
  }
  return rows;
}

// ================================================================ Stage 0 — 灰の入口
//
// **導入。**2人編成で遊ぶので、composeEncounter が後ろの枠から切り詰める。
// 前のほうに書いた個体がそのまま「2人で会う敵」になる。
const STAGE_0 = stageEncounters([
  { name: "灰の入口", maxRounds: 8,
    description: "正面から来る走者が二体。前列が受け、攻撃役が一体ずつ落とす。",
    enemies: ["gray_scrapper@FL", "gray_scrapper@FR"],
    reinforcements: ["gray_scrapper@RL"] },
  { name: "狩りの路地", maxRounds: 8,
    description: "後列を狙う後撃ちが混じる。前だけ固めても通らない。",
    enemies: ["gray_scrapper@FL", "gray_scrapper@FR", "gray_marksman@RL"],
    reinforcements: ["gray_marksman@RR"] },
  { name: "崩れた盾列", maxRounds: 9,
    description: "受けの厚い守衛が二体。多段では削り切れない。",
    enemies: ["gray_guard@FL", "gray_guard@FR", "gray_scrapper@RL"],
    reinforcements: ["gray_marksman@RR"] },
  { name: "盾将の門", maxRounds: 12, bossLawId: "law_bulwark_wall",
    description: "第1幕のボス。盾兵と、その足元を固める走者と後撃ち。",
    enemies: ["gray_bulwark@FC*", "gray_scrapper@FL", "gray_marksman@RL"],
    reinforcements: ["gray_scrapper@FR"] },
  { name: "灰の圧力", maxRounds: 10,
    description: "盾兵、狩人、反響体、後撃ち。どの役割を厚くするかが問われる。",
    enemies: ["gray_bulwark@FL", "gray_hunter@FR", "gray_echo@RL", "gray_marksman@RR"],
    reinforcements: ["gray_scrapper@FC"] },
  { name: "二つの狙い", maxRounds: 10,
    description: "前列を削る守衛と、準備中を狙う狩人。後ろで反響体と盾兵が控える。",
    enemies: ["gray_guard@FL", "gray_guard@FC", "gray_echo@FR", "gray_hunter@RL", "gray_bulwark@RR"] },
  { name: "反響の坑道", maxRounds: 11,
    description: "殴ると殴り返す反響体が二体。手数を出すほど自分が減る。",
    enemies: ["gray_bulwark@FL", "gray_echo@FC", "gray_echo@FR", "gray_hunter@RL", "gray_marksman@RR"] },
  { name: "反響体の巣", maxRounds: 13, bossLawId: "law_echo_return",
    description: "第2幕のボス。返しの本体を、守衛と盾兵ごと崩す。",
    enemies: ["gray_echo@FC*", "gray_guard@FL", "gray_guard@FR", "gray_hunter@RL", "gray_bulwark@RR"] },
  { name: "盾の回廊", maxRounds: 12,
    description: "厚い盾兵が三体、狩人が二体。抜けないなら、行と列で薙ぐ。",
    enemies: ["gray_bulwark@FL", "gray_bulwark@FR", "gray_hunter@FC", "gray_hunter@RL", "gray_bulwark@RR"] },
  { name: "灰の重列", maxRounds: 13,
    description: "盾兵が四体並ぶ。単発で一枚ずつ落とすか、列ごと貫くか。",
    enemies: ["gray_bulwark@FL", "gray_bulwark@FC", "gray_bulwark@FR", "gray_bulwark@RL", "gray_hunter@RR"] },
  { name: "核の前庭", maxRounds: 13,
    description: "核心が盾兵を三体連れて出てくる。ボスの予行になる。",
    enemies: ["ash_core@FC", "gray_bulwark@FL", "gray_bulwark@FR", "gray_bulwark@RL", "gray_hunter@RR"] },
  { name: "灰の核心", maxRounds: 15, bossLawId: "law_core_charge",
    description: "最終戦。核心の溜めを止めながら、厚い前列を突破する。",
    enemies: ["ash_core@FC*", "gray_bulwark@FL", "gray_bulwark@FR", "gray_guard@RL", "gray_hunter@RR"] },
]);

// ================================================================ Stage 1 — 抜ける刃
//
// **問い「誰が前に立つと、誰が振り抜けるか」。**走り手（一巡に二度動くが一撃は軽い）が
// 「受けの薄い人物を前に置くと壊れる」を出し、籠り手が「厚い受けに手数は通らない」を出す。3人。
const STAGE_1 = stageEncounters([
  { name: "焼けた段", maxRounds: 8,
    description: "走者と群れ。数は多いが、一体ずつは軽い。",
    enemies: ["gray_scrapper@FL", "gray_scrapper@FR", "gray_swarm@RL"],
    reinforcements: ["gray_swarm@RR"] },
  { name: "走る影", maxRounds: 8,
    description: "走り手が二体。一巡に二度動くので、受けの薄い前衛から削られる。",
    enemies: ["gray_runner@FL", "gray_runner@FR", "gray_scrapper@RL"],
    reinforcements: ["gray_runner@RR"] },
  { name: "二つの射線", maxRounds: 9,
    description: "後撃ちが二体。守衛が前を塞いでいるあいだに、後列が減る。",
    enemies: ["gray_marksman@RL", "gray_marksman@RR", "gray_guard@FL", "gray_scrapper@FR"],
    reinforcements: ["gray_scrapper@FC"] },
  { name: "砕きの頭", maxRounds: 12, bossLawId: "law_breaker_swing",
    description: "第1幕のボス。砕き手が溜めて振る。走り手と後撃ちが足元を固める。",
    enemies: ["gray_breaker@FC*", "gray_runner@FL", "gray_runner@FR", "gray_marksman@RL"],
    reinforcements: ["gray_swarm@RR"] },
  { name: "籠る殻", maxRounds: 10,
    description: "籠り手が二体、砕き手が一体。先に防壁を張るので、剥がすまでが持ち時間になる。",
    enemies: ["gray_shelter@FL", "gray_breaker@FR", "gray_shelter@FC", "gray_guard@RL", "gray_marksman@RR"] },
  { name: "前と後ろ", maxRounds: 10,
    description: "砕き手が二体で溜める。籠り手と守衛が前を厚くし、走り手が隙間を走る。",
    enemies: ["gray_breaker@FC", "gray_breaker@FL", "gray_shelter@FR", "gray_guard@RL", "gray_runner@RR"] },
  { name: "押し込みの路", maxRounds: 11,
    description: "盾兵と守衛が前を塞ぎ、砕き手が溜める。押し切るか、受け切るか。",
    enemies: ["gray_bulwark@FL", "gray_breaker@FC", "gray_guard@FR", "gray_guard@RL", "gray_runner@RR"] },
  { name: "籠りの奥", maxRounds: 13, bossLawId: "law_bulwark_wall",
    description: "第2幕のボス。盾兵が張り直し、籠り手が二体で時間を稼ぐ。",
    enemies: ["gray_bulwark@FC*", "gray_shelter@FL", "gray_shelter@FR", "gray_marksman@RL", "gray_runner@RR"] },
  { name: "灰の坂", maxRounds: 12,
    description: "盾兵二体と砕き手二体。厚さと重さが同時に来る。",
    enemies: ["gray_bulwark@FL", "gray_bulwark@FR", "gray_breaker@FC", "gray_breaker@RL", "gray_guard@RR"] },
  { name: "重なる殻", maxRounds: 13,
    description: "盾兵が三枚並ぶ。手数では剥がれない。",
    enemies: ["gray_bulwark@FL", "gray_bulwark@FC", "gray_bulwark@FR", "gray_breaker@RL", "gray_guard@RR"] },
  { name: "門の手前", maxRounds: 13,
    description: "盾兵三体に砕き手が二体。溜めが同時に完成する round がある。",
    enemies: ["gray_bulwark@FL", "gray_bulwark@FC", "gray_bulwark@FR", "gray_breaker@RL", "gray_breaker@RR"] },
  { name: "抜ける刃", maxRounds: 15, bossLawId: "law_core_charge",
    description: "最終戦。核心の溜めと、盾兵・籠り手の厚み。どこか一枚を抜く。",
    enemies: ["ash_core@FC*", "gray_bulwark@FL", "gray_bulwark@FR", "gray_shelter@RL", "gray_runner@RR"] },
]);

// ================================================================ Stage 2 — 動く隊列
//
// **問い「隊列を動かして、何を得るか」。**潜み手と追い手が「後ろへ下げれば安全」を壊す。
// 庇う・位置替えが初めて割に合う盤面。4人。
const STAGE_2 = stageEncounters([
  { name: "影の路地", maxRounds: 8,
    description: "潜み手が後列から入る。走者が前を塞いでいるあいだに、後ろが減る。",
    enemies: ["gray_stalker@RL", "gray_scrapper@FL", "gray_scrapper@FR"],
    reinforcements: ["gray_swarm@FC"] },
  { name: "追われる", maxRounds: 9,
    description: "追い手は準備中の者から潰しに来る。準備の要る技能を出す順が問われる。",
    enemies: ["gray_harrower@RL", "gray_scrapper@FL", "gray_runner@FR", "gray_swarm@RR"] },
  { name: "崩れた盾列", maxRounds: 9,
    description: "守衛が前を厚くし、潜み手が後列を抜く。前だけ守っても足りない。",
    enemies: ["gray_guard@FL", "gray_guard@FR", "gray_stalker@RL", "gray_marksman@RR"],
    reinforcements: ["gray_scrapper@FC"] },
  { name: "追い手の頭", maxRounds: 12, bossLawId: "law_harrower_chase",
    description: "第1幕のボス。追い手が準備を潰し、守衛が前を塞ぐ。",
    enemies: ["gray_harrower@FC*", "gray_guard@FL", "gray_stalker@RL", "gray_marksman@RR"],
    reinforcements: ["gray_runner@FR"] },
  { name: "割れた列", maxRounds: 10,
    description: "守衛が前を厚くし、追い手が後列を狙う。受け手を選ぶ round が要る。",
    enemies: ["gray_guard@FL", "gray_harrower@RL", "gray_guard@FC", "gray_shelter@FR", "gray_stalker@RR"] },
  { name: "挟み", maxRounds: 10,
    description: "追い手が二体、後ろから。守衛と砕き手が前を塞ぐ。",
    enemies: ["gray_harrower@RL", "gray_harrower@RR", "gray_guard@FL", "gray_breaker@FC", "gray_stalker@FR"] },
  { name: "挟撃の坑", maxRounds: 11,
    description: "砕き手が二体、追い手が二体、守衛が一体。庇う相手を毎 round 選び直す。",
    enemies: ["gray_breaker@FL", "gray_harrower@RL", "gray_harrower@RR", "gray_guard@FC", "gray_breaker@FR"] },
  { name: "盾将の門", maxRounds: 13, bossLawId: "law_bulwark_wall",
    description: "第2幕のボス。盾兵が張り直し、砕き手と追い手が両側から入る。",
    enemies: ["gray_bulwark@FC*", "gray_breaker@FL", "gray_stalker@RL", "gray_harrower@RR"] },
  { name: "深い路地", maxRounds: 12,
    description: "盾兵が一体、追い手が二体。砕き手と守衛が前を埋める。後列に置いた人物ほど狙われる。",
    enemies: ["gray_bulwark@FL", "gray_harrower@RL", "gray_harrower@RR", "gray_breaker@FC", "gray_guard@FR"] },
  { name: "盾と追い手", maxRounds: 13,
    description: "盾兵が二体、追い手が二体、潜み手が一体。時間が味方しない。",
    enemies: ["gray_bulwark@FL", "gray_bulwark@FR", "gray_harrower@RL", "gray_harrower@RR", "gray_stalker@FC"] },
  { name: "核の気配", maxRounds: 13,
    description: "盾兵が二体、砕き手が一体、追い手が二体。最終戦の予行になる。",
    enemies: ["gray_bulwark@FL", "gray_bulwark@FR", "gray_breaker@FC", "gray_harrower@RL", "gray_harrower@RR"] },
  { name: "動く隊列", maxRounds: 15, bossLawId: "law_core_charge",
    description: "最終戦。核心の溜めが完成する前に、前列を入れ替えながら削り切る。",
    enemies: ["ash_core@FC*", "gray_bulwark@FL", "gray_breaker@FR", "gray_harrower@RL"] },
]);

// ================================================================ Stage 3 — 間合いと順番
//
// **問い「誰がいつ動くと得か」。**狩人が準備を罰し、反響体が手数を罰する。
// 順番と一撃の大きさを両方触れるようになった5人で解く。
const STAGE_3 = stageEncounters([
  { name: "灰の圧力", maxRounds: 9,
    description: "狩人が準備を潰す。走者が二体、その足元を固める。",
    enemies: ["gray_hunter@FL", "gray_scrapper@FC", "gray_scrapper@FR"] },
  { name: "返す殻", maxRounds: 9,
    description: "反響体が二体。多段で削ると、返ってくる回数もそのぶん増える。",
    enemies: ["gray_echo@FL", "gray_echo@FR", "gray_scrapper@FC"] },
  { name: "二つの狙い", maxRounds: 10,
    description: "狩人と反響体。準備の要る技能を出した round に、まとめて来る。",
    enemies: ["gray_hunter@FL", "gray_echo@FC", "gray_guard@FR", "gray_marksman@RL"] },
  { name: "反響体の巣", maxRounds: 12, bossLawId: "law_echo_return",
    description: "第1幕のボス。返しの本体を、狩人と守衛ごと崩す。",
    enemies: ["gray_echo@FC*", "gray_hunter@FL", "gray_guard@FR", "gray_scrapper@RL"] },
  { name: "盾と返し", maxRounds: 10,
    description: "盾兵の厚みと反響体の返し。手数でも単発でも、片方だけでは足りない。",
    enemies: ["gray_bulwark@FL", "gray_echo@FC", "gray_hunter@FR", "gray_stalker@RL"] },
  { name: "溜めを読む", maxRounds: 10,
    description: "狩人がこちらの溜めを潰し、潜み手が後ろを狙う。盾兵と守衛が二体で前を塞ぐ。",
    enemies: ["gray_bulwark@FL", "gray_guard@FC", "gray_guard@FR", "gray_hunter@RL", "gray_stalker@RR"] },
  { name: "反響の坑道", maxRounds: 11,
    description: "反響体が二体、盾兵と守衛が一体ずつ。殴る回数そのものが代償になる。",
    enemies: ["gray_bulwark@FL", "gray_guard@FC", "gray_marksman@FR", "gray_echo@RL", "gray_echo@RR"] },
  { name: "盾将の門", maxRounds: 13, bossLawId: "law_bulwark_wall",
    description: "第2幕のボス。盾兵が張り直し、反響体と狩人が round を伸ばす。",
    enemies: ["gray_bulwark@FC*", "gray_guard@FL", "gray_echo@FR", "gray_hunter@RL"] },
  { name: "盾の回廊", maxRounds: 12,
    description: "盾兵が二体、守衛が一体、狩人と追い手が一体ずつ。抜けないなら、行と列で薙ぐ。",
    enemies: ["gray_bulwark@FL", "gray_bulwark@FR", "gray_guard@FC", "gray_hunter@RL", "gray_harrower@RR"] },
  { name: "灰の重列", maxRounds: 13,
    description: "盾兵が三体、守衛と反響体が一体ずつ。単発で一枚ずつ落とすか、列ごと貫くか。",
    enemies: ["gray_bulwark@FL", "gray_bulwark@FC", "gray_bulwark@FR", "gray_guard@RL", "gray_echo@RR"] },
  { name: "核の前庭", maxRounds: 13,
    description: "核心が盾兵を二体連れて立つ。狩人と反響体が後ろに付く。ボスの予行になる。",
    enemies: ["ash_core@FC", "gray_bulwark@FL", "gray_bulwark@FR", "gray_hunter@RL", "gray_echo@RR"] },
  { name: "灰の核心", maxRounds: 15, bossLawId: "law_core_charge",
    description: "最終戦。核心の溜めを止め、反響体を残さずに厚い前列を抜く。",
    enemies: ["ash_core@FC*", "gray_bulwark@FL", "gray_echo@RL", "gray_hunter@RR"] },
]);

// ================================================================ Stage 4 — 灰塵の底
//
// **問い「一人ずつ守っても間に合わないとき、何を選ぶか」。**灰塵が入る。
// 行・列・全体へ同時に来るので、一点の守りでは足りなくなる。
const STAGE_4 = stageEncounters([
  { name: "灰の敷居", maxRounds: 9,
    description: "灰殻の守衛と走者、後撃ちと走り手。ここまでは知っている盤面である。",
    enemies: ["gray_guard@FL", "gray_scrapper@FR", "gray_scrapper@FC", "gray_marksman@RL", "gray_runner@RR"] },
  { name: "粒が立つ", maxRounds: 9,
    description: "灰塵の粒が三体。灰殻の砕き手と守衛が、その後ろに立つ。",
    enemies: ["dust_mote@FL", "dust_mote@FC", "dust_mote@FR", "gray_breaker@RL", "gray_guard@RR"] },
  { name: "横に払う", maxRounds: 10,
    description: "薙ぎ手が二体。前列に二人並べた round だけ、行ごと払われる。",
    enemies: ["dust_lash@FL", "dust_lash@FR", "dust_mote@FC", "gray_breaker@RL"] },
  { name: "盾将の門", maxRounds: 12, bossLawId: "law_bulwark_wall",
    description: "第1幕のボス。盾兵の厚みに、薙ぎ手の行攻撃が重なる。",
    enemies: ["gray_bulwark@FC*", "dust_lash@FL", "dust_mote@FR", "gray_guard@RL"] },
  { name: "抜ける線", maxRounds: 10,
    description: "突き手が三体。列の前後を貫くので、後ろへ下げても同じ列なら届く。",
    enemies: ["dust_spire@FL", "dust_spire@FC", "dust_spire@FR", "dust_mote@RL", "gray_guard@RR"] },
  { name: "刻む顎", maxRounds: 10,
    description: "顎が三体、突き手が一体。多段で刻まれ、受け構えから先に剥がれる。",
    enemies: ["dust_maw@FL", "dust_maw@FC", "dust_maw@FR", "dust_spire@RL", "gray_marksman@RR"] },
  { name: "帳のむこう", maxRounds: 11,
    description: "帳が自分の側へ受け構えを配り、唱和が隙を配る。削り切る手数を先に用意する。",
    enemies: ["dust_veil@FL", "dust_spire@FC", "dust_lash@FR", "dust_maw@RL", "dust_choir@RR"] },
  { name: "唱和の輪", maxRounds: 13, bossLawId: "law_choir_mark",
    description: "第2幕のボス。唱和が隙を面で配り、帳が自分の側を守る。",
    enemies: ["dust_choir@FC*", "dust_veil@FL", "dust_lash@FR", "dust_maw@RL", "dust_mote@RR"] },
  { name: "灰塵の壁", maxRounds: 12,
    description: "帳が二体、唱和が一体、盾兵が一体。配られた構えを剥がしてからでないと通らない。",
    enemies: ["dust_veil@FL", "dust_veil@FR", "dust_choir@FC", "gray_bulwark@RL", "dust_maw@RR"] },
  { name: "行と列", maxRounds: 13,
    description: "薙ぎ手が行を、突き手が列を取る。盾兵が二体、その後ろで待つ。",
    enemies: ["dust_lash@FL", "dust_spire@FC", "dust_choir@FR", "gray_bulwark@RL", "gray_bulwark@RR"] },
  { name: "潮の前", maxRounds: 13,
    description: "潮が出てくる。薙ぎ手・突き手・帳・唱和が、その両側を埋める。",
    enemies: ["dust_tide@FC", "dust_lash@FL", "dust_spire@FR", "dust_veil@RL", "dust_choir@RR"] },
  { name: "灰塵の潮", maxRounds: 15, bossLawId: "law_dust_tide",
    description: "最終戦。潮が行と列の両方を取る。並べ方そのものが解答になる。",
    enemies: ["dust_tide@FC*", "dust_lash@FL", "dust_spire@FR", "dust_veil@RL", "dust_maw@RR"] },
]);

// ================================================================ Stage 5 — 数の坂
//
// **問い「面で来る圧力に、面で返すか、一点で返すか」。**灰塵が主役になり、
// 灰殻は幕の終わりにだけ残る。
const STAGE_5 = stageEncounters([
  { name: "粒の斜面", maxRounds: 9,
    description: "粒が四体、唱和が一体。数を先に減らすか、まとめて受けるか。",
    enemies: ["dust_mote@FL", "dust_mote@FC", "dust_mote@FR", "dust_mote@RL", "dust_choir@RR"] },
  { name: "払いの段", maxRounds: 10,
    description: "薙ぎ手が二体。前列を一人にすると、行の薙ぎが割に合わなくなる。",
    enemies: ["dust_lash@FL", "dust_lash@FR", "dust_mote@FC", "dust_mote@RL", "gray_marksman@RR"] },
  { name: "貫きの段", maxRounds: 11,
    description: "突き手が三体。同じ列に二人を重ねると、二人ぶん通る。",
    enemies: ["dust_spire@FL", "dust_spire@FC", "dust_spire@FR", "dust_choir@RL", "dust_mote@RR"] },
  { name: "帳の主", maxRounds: 13, bossLawId: "law_veil_guard",
    description: "第1幕のボス。帳が構えを配り続け、顎が二体でこちらの構えを剥がす。薙ぎ手が行を払う。",
    enemies: ["dust_veil@FC*", "dust_maw@FL", "dust_maw@FR", "dust_choir@RR", "dust_lash@RL"] },
  { name: "顎の群れ", maxRounds: 11,
    description: "顎が三体、唱和と薙ぎ手が一体ずつ。受けの厚い人物だけが多段を止められる。",
    enemies: ["dust_maw@FL", "dust_maw@FC", "dust_maw@FR", "dust_choir@RL", "dust_lash@RR"] },
  { name: "唱和と行", maxRounds: 11,
    description: "唱和が隙を配り、薙ぎ手が行を払う。重くなった一撃が面で来る。",
    enemies: ["dust_choir@RL", "dust_choir@RR", "dust_lash@FL", "dust_lash@FC", "dust_spire@FR"] },
  { name: "厚い帳", maxRounds: 12,
    description: "帳が二体、唱和が三体。構えを剥がす手数か、構えを無視する一撃か。",
    enemies: ["dust_veil@FL", "dust_veil@FR", "dust_choir@FC", "dust_choir@RL", "dust_choir@RR"] },
  { name: "灰塵の潮", maxRounds: 13, bossLawId: "law_dust_tide",
    description: "第2幕のボス。潮の両側を、帳と顎と唱和と突き手が固める。",
    enemies: ["dust_tide@FC*", "dust_veil@FL", "dust_maw@FR", "dust_choir@RL", "dust_spire@RR"] },
  { name: "崩れの坂", maxRounds: 12,
    description: "薙ぎ手・突き手・唱和が並び、盾兵が一体だけ混じる。三種類の当たり方が同じ round に来る。",
    enemies: ["dust_lash@FL", "dust_spire@FC", "dust_choir@FR", "dust_choir@RL", "gray_bulwark@RR"] },
  { name: "灰の厚み", maxRounds: 13,
    description: "唱和が三体、帳が一体、盾兵が一体。長引くほど不利になる。",
    enemies: ["dust_choir@FL", "dust_choir@FC", "dust_choir@FR", "dust_veil@RL", "gray_bulwark@RR"] },
  { name: "核と塵", maxRounds: 14,
    description: "核心の溜めに、帳・唱和・薙ぎ手・突き手が重なる。守る場所が二つある。",
    enemies: ["ash_core@FC", "dust_veil@FL", "dust_choir@FR", "dust_lash@RL", "dust_spire@RR"] },
  { name: "灰の核心", maxRounds: 15, bossLawId: "law_core_charge",
    description: "最終戦。核心が溜めるあいだ、潮と薙ぎ手が行と列を取り続ける。帳と唱和が後ろを固める。",
    enemies: ["ash_core@FC*", "dust_tide@FL", "dust_veil@FR", "dust_choir@RL", "dust_lash@RR"] },
]);

// ================================================================ Stage 6 — 織りの回廊
//
// **問い「置いた場所を動かされても、成り立つ配置か」。**灰織が入る。
// 手繰りが後列の柔らかい人物を最前へ引き出すので、「後ろに置けば安全」が終わる。
const STAGE_6 = stageEncounters([
  { name: "手が伸びる", maxRounds: 9,
    description: "手繰りが、後列で最もHPの低い人物を最前へ引き出す。粒が二体、後撃ちが一体。",
    enemies: ["weave_hand@FL", "dust_mote@FC", "dust_mote@FR", "gray_marksman@RL"] },
  { name: "結ばれる", maxRounds: 10,
    description: "結び手が二体。怯みが重なると、こちらの出す damage が段ごとに軽くなる。",
    enemies: ["weave_knot@FL", "weave_knot@FR", "dust_mote@FC", "gray_marksman@RL"] },
  { name: "見張りの目", maxRounds: 11,
    description: "見張りが二体で隙を刻み、結び手が怯ませる。二手で一つの形になっている。",
    enemies: ["weave_eye@RL", "weave_eye@RR", "weave_knot@FL", "dust_mote@FC", "gray_marksman@FR"] },
  { name: "棘の主", maxRounds: 12, bossLawId: "law_thorn_bleed",
    description: "第1幕のボス。棘の裂傷は受けを無視する。硬さでは止まらない。",
    enemies: ["weave_thorn@FC*", "weave_hand@FL", "weave_knot@FR", "dust_mote@RR"] },
  { name: "遠い手", maxRounds: 11,
    description: "遠手が二体、後列へ直接届く。前を固めた意味が、ここで一度消える。",
    enemies: ["weave_reach@RL", "weave_reach@RR", "weave_hand@FL", "weave_knot@FC", "dust_mote@FR"] },
  { name: "引き出される", maxRounds: 11,
    description: "手繰りが三体。引き出された人物を、その round のうちに戻せるか。",
    enemies: ["weave_hand@FL", "weave_hand@FC", "weave_hand@FR", "weave_eye@RL", "gray_stalker@RR"] },
  { name: "織りの奥", maxRounds: 12,
    description: "棘が二体。裂傷が重なると、受けの厚い人物から順に減る。",
    enemies: ["weave_thorn@FL", "weave_thorn@FR", "weave_eye@FC", "weave_reach@RL", "weave_hand@RR"] },
  { name: "塵と織りの境", maxRounds: 14, bossLawId: "law_dust_tide",
    description: "第2幕のボス。潮が面を取り、手繰りと棘と見張りが隊列と傷を触る。",
    enemies: ["dust_tide@FC*", "weave_hand@FL", "weave_thorn@FR", "weave_eye@RL"] },
  { name: "裂けた列", maxRounds: 13,
    description: "棘が一体、結び手が二体、遠手が一体。盾兵が一体だけ前に残る。",
    enemies: ["weave_thorn@FL", "weave_knot@FC", "weave_knot@FR", "weave_reach@RL", "gray_bulwark@RR"] },
  { name: "織りと盾", maxRounds: 13,
    description: "手繰りの引き出しに、棘の裂傷と結び手の怯みが重なる。盾兵が二体、前を止める。",
    enemies: ["weave_hand@FL", "weave_thorn@FC", "weave_knot@FR", "gray_bulwark@RL", "gray_bulwark@RR"] },
  { name: "写しの前庭", maxRounds: 14,
    description: "写しが棘・結び手・見張り・遠手を連れて立つ。ボスの予行になる。",
    enemies: ["weave_mirror@FC", "weave_thorn@FL", "weave_knot@FR", "weave_eye@RL", "weave_reach@RR"] },
  { name: "織りの回廊", maxRounds: 15, bossLawId: "law_weave_mirror",
    description: "最終戦。写しが引き出しては返す。隠れ場所を作らない並べ方で解く。",
    enemies: ["weave_mirror@FC*", "weave_thorn@FL", "weave_hand@FR", "weave_eye@RL"] },
]);

// ================================================================ Stage 7 — ほどける隊列
//
// **問い「状態と位置を同時に崩されたとき、何から直すか」。**灰織と灰塵が混ざる。
// 直す手が一つしか無い round に、何を優先するかだけが残る。
const STAGE_7 = stageEncounters([
  { name: "塵と糸", maxRounds: 10,
    description: "手繰りが引き出し、薙ぎ手が行を払う。引き出された先が払われる。",
    enemies: ["weave_hand@FL", "dust_lash@FR", "dust_mote@FC", "dust_mote@RL"] },
  { name: "怯みの列", maxRounds: 11,
    description: "結び手が二体、遠手が一体。怯みが重なると、こちらの一撃がどれも軽くなる。",
    enemies: ["weave_knot@FL", "weave_knot@FC", "weave_reach@RL", "dust_mote@FR"] },
  { name: "裂いて薙ぐ", maxRounds: 12,
    description: "棘が二体、薙ぎ手と唱和が一体ずつ。受けでも回復でも、片方だけでは足りない。",
    enemies: ["weave_thorn@FL", "dust_lash@FC", "weave_thorn@FR", "dust_choir@RL", "dust_mote@RR"] },
  { name: "結びの主", maxRounds: 13, bossLawId: "law_knot_stagger",
    description: "第1幕のボス。結び手が怯みを重ね、手繰りと棘と遠手が形を崩す。",
    enemies: ["weave_knot@FC*", "weave_hand@FL", "weave_thorn@FR", "weave_reach@RL"] },
  { name: "遠くから", maxRounds: 11,
    description: "遠手が二体、突き手が一体。後列に安全な枠が無くなる。",
    enemies: ["weave_reach@RL", "weave_reach@RR", "dust_spire@FL", "weave_knot@FC", "gray_stalker@FR"] },
  { name: "ほどける", maxRounds: 13,
    description: "手繰り・棘・結び手・見張り・遠手。灰織の五手が一度に揃う。",
    enemies: ["weave_hand@FL", "weave_thorn@FC", "weave_knot@FR", "weave_eye@RL", "weave_reach@RR"] },
  { name: "面と糸", maxRounds: 13,
    description: "潮の面と、棘の裂傷と、結び手の怯み。三つとも別の直し方が要る。",
    enemies: ["dust_tide@FC", "weave_thorn@FL", "weave_knot@FR", "weave_reach@RL", "dust_mote@RR"] },
  { name: "灰織の写し", maxRounds: 14, bossLawId: "law_weave_mirror",
    description: "第2幕のボス。写しが引き出しては返す。棘と薙ぎ手と遠手が面を作る。",
    enemies: ["weave_mirror@FC*", "weave_thorn@FL", "dust_lash@FR", "weave_reach@RR"] },
  { name: "引いて刻む", maxRounds: 13,
    description: "潮が面を取り、手繰りが引き出し、顎が多段で刻む。見張りが隙を配る。",
    enemies: ["dust_tide@FC", "weave_hand@FL", "weave_eye@FR", "dust_choir@RL", "dust_maw@RR"] },
  { name: "塵の波と糸", maxRounds: 14,
    description: "潮が面を作り、棘が二体で刻む。唱和が二体、隙を足す。",
    enemies: ["dust_tide@FC", "weave_thorn@FL", "weave_thorn@FR", "dust_choir@RL", "dust_choir@RR"] },
  { name: "核の影", maxRounds: 14,
    description: "核心の溜めに、写しの引き出しと棘の裂傷と遠手の射線が重なる。",
    enemies: ["ash_core@FC", "weave_mirror@FL", "weave_thorn@FR", "weave_reach@RL"] },
  { name: "ほどける隊列", maxRounds: 16, bossLawId: "law_core_charge",
    description: "最終戦。核心が溜めるあいだ、灰織が隊列と状態を崩し続ける。",
    enemies: ["ash_core@FC*", "weave_thorn@FL", "weave_hand@FR", "weave_reach@RL", "weave_eye@RR"] },
]);

// ================================================================ Stage 8 — 灰炉の門
//
// **問い「硬さで解けない相手を、何で解くか」。**灰炉が入る。受けを無視する一撃と、
// 受けが最も厚い個体が同じ盤面に立つ。守りの厚みだけでは両方に効かない。
const STAGE_8 = stageEncounters([
  { name: "熱のない門", maxRounds: 10,
    description: "錐が三体。受けを6割無視して突くので、受けの厚い人物ほど当てにできなくなる。",
    enemies: ["forge_awl@FL", "forge_awl@FR", "forge_awl@FC", "dust_mote@RL"] },
  { name: "槌の音", maxRounds: 11,
    description: "槌が二体。受けも受け構えも無視するので、減らせるのは防壁と回復だけになる。",
    enemies: ["forge_hammer@FL", "forge_hammer@FR", "forge_awl@FC", "dust_mote@RL", "gray_marksman@RR"] },
  { name: "金床の前", maxRounds: 12,
    description: "金床が二体。受けを張り直すので、持久の勝負になる。",
    enemies: ["forge_anvil@FL", "forge_anvil@FR", "forge_awl@FC", "dust_mote@RL", "gray_marksman@RR"] },
  { name: "槌の主", maxRounds: 13, bossLawId: "law_hammer_break",
    description: "第1幕のボス。槌が守りを飛ばし、金床が時間を伸ばす。熾が手負いを拾う。",
    enemies: ["forge_hammer@FC*", "forge_anvil@FL", "forge_awl@FR", "forge_ember@RL"] },
  { name: "熾を拾う", maxRounds: 11,
    description: "熾が三体。HPの低い人物が居るかぎり、そこへ最も重く入る。",
    enemies: ["forge_ember@FL", "forge_ember@FC", "forge_ember@FR", "forge_awl@RL", "dust_mote@RR"] },
  { name: "鞴と金床", maxRounds: 12,
    description: "鞴が二体、自分の側の前列へ防壁を張る。金床が二体でそれを抱える。",
    enemies: ["forge_bellows@RL", "forge_bellows@RR", "forge_anvil@FL", "forge_anvil@FC", "dust_mote@FR"] },
  { name: "炉の口", maxRounds: 13,
    description: "金床の厚み、槌の受け無視、錐の貫き、鞴の防壁、熾の追い打ち。五つが同時に来る。",
    enemies: ["forge_anvil@FL", "forge_hammer@FC", "forge_awl@FR", "forge_bellows@RL", "forge_ember@RR"] },
  { name: "金床の主", maxRounds: 14, bossLawId: "law_anvil_hold",
    description: "第2幕のボス。金床が張り直し続ける。補給と回復が先に尽きるほうが負ける。",
    enemies: ["forge_anvil@FC*", "forge_hammer@FL", "forge_awl@FR", "forge_bellows@RL", "forge_ember@RR"] },
  { name: "削れない列", maxRounds: 14,
    description: "金床が二体、槌が一体、鞴と熾が後ろ。受け崩しか貫き突きが無いと round が尽きる。",
    enemies: ["forge_anvil@FL", "forge_anvil@FC", "forge_hammer@FR", "forge_bellows@RL", "forge_ember@RR"] },
  { name: "受けを抜く", maxRounds: 14,
    description: "金床が三体、鞴と槌が後ろ。受けを上げても、上げた分がそのまま無視される。",
    enemies: ["forge_anvil@FL", "forge_anvil@FC", "forge_anvil@FR", "forge_bellows@RL", "forge_hammer@RR"] },
  { name: "本体の前庭", maxRounds: 15,
    description: "灰炉の本体が出てくる。金床と槌と鞴と熾が、その両側を固める。",
    enemies: ["ash_furnace@FC", "forge_anvil@FL", "forge_hammer@FR", "forge_bellows@RL", "forge_ember@RR"] },
  { name: "灰炉の門", maxRounds: 16, bossLawId: "law_forge_furnace",
    description: "最終戦。本体は溜めた一撃と受け無視の一撃を交互に出す。守り方を二つ持つ。",
    enemies: ["ash_furnace@FC*", "forge_anvil@FL", "forge_hammer@FR", "forge_bellows@RL"] },
]);

// ================================================================ Stage 9 — 炉の底
//
// **第一部の終わり。**四つの家系が全部出る。ここまでに覚えた解き方を、
// 一つの遠征の中で持ち替えられるかだけを問う。
const STAGE_9 = stageEncounters([
  { name: "四つの気配", maxRounds: 11,
    description: "盾兵・薙ぎ手・棘・錐。四つの家系が一体ずつ、同じ盤面に立つ。",
    enemies: ["gray_bulwark@FL", "dust_lash@FC", "weave_thorn@FR", "forge_awl@RL"] },
  { name: "灰殻の残り", maxRounds: 11,
    description: "盾兵・反響体・追い手・砕き手・狩人。最初に覚えた圧力が、厚くなって戻る。",
    enemies: ["gray_bulwark@FL", "gray_echo@FC", "gray_harrower@FR", "gray_breaker@RL", "gray_hunter@RR"] },
  { name: "塵の総出", maxRounds: 13,
    description: "唱和が三体、薙ぎ手と突き手が一体ずつ。灰塵の面が揃う。",
    enemies: ["dust_choir@FL", "dust_choir@FC", "dust_choir@FR", "dust_lash@RL", "dust_spire@RR"] },
  { name: "灰塵の潮", maxRounds: 14, bossLawId: "law_dust_tide",
    description: "第1幕のボス。潮が面を取り、顎と薙ぎ手と帳と唱和が構えを取り合う。",
    enemies: ["dust_tide@FC*", "dust_maw@FL", "dust_lash@FR", "dust_veil@RL", "dust_choir@RR"] },
  { name: "織りの総出", maxRounds: 12,
    description: "手繰り・棘・結び手・見張り・遠手。灰織の五手が揃う。",
    enemies: ["weave_hand@FL", "weave_thorn@FC", "weave_knot@FR", "weave_eye@RL", "weave_reach@RR"] },
  { name: "写しと糸", maxRounds: 13,
    description: "写しが引き出し、手繰り・棘・結び手・遠手が形を崩し続ける。",
    enemies: ["weave_mirror@FC", "weave_hand@FL", "weave_thorn@FR", "weave_knot@RL", "weave_reach@RR"] },
  { name: "織りと炉", maxRounds: 14,
    description: "写しの引き出しと、槌の受け無視。鞴の防壁と棘の裂傷が、その間を埋める。",
    enemies: ["weave_mirror@FC", "forge_hammer@FL", "weave_thorn@FR", "forge_bellows@RL", "weave_reach@RR"] },
  { name: "灰織の写し", maxRounds: 15, bossLawId: "law_weave_mirror",
    description: "第2幕のボス。写しが引き出しては返し、槌がその先を叩く。",
    enemies: ["weave_mirror@FC*", "weave_thorn@FL", "forge_hammer@FR", "weave_eye@RL", "weave_reach@RR"] },
  { name: "炉の底", maxRounds: 14,
    description: "金床が三体、槌と鞴が一体ずつ。受け無視と厚みが同時に来る。",
    enemies: ["forge_anvil@FL", "forge_anvil@FC", "forge_anvil@FR", "forge_hammer@RL", "forge_bellows@RR"] },
  { name: "全部来る", maxRounds: 15,
    description: "金床の厚み、潮の面、写しの引き出し、鞴の防壁、棘の裂傷。四つの家系が一度に来る。",
    enemies: ["forge_anvil@FL", "dust_tide@FC", "weave_mirror@FR", "forge_bellows@RL", "weave_thorn@RR"] },
  { name: "核と炉", maxRounds: 15,
    description: "核心の溜めに、金床の厚みと槌の受け無視と写しの引き出しが重なる。",
    enemies: ["ash_core@FC", "forge_anvil@FL", "forge_hammer@FR", "weave_mirror@RL", "forge_bellows@RR"] },
  { name: "炉の底の本体", maxRounds: 18, bossLawId: "law_forge_furnace",
    description: "第一部の最終戦。本体・金床・槌・写し・潮。覚えた解き方を全部持ち替える。",
    enemies: ["ash_furnace@FC*", "forge_anvil@FL", "forge_hammer@FR", "weave_mirror@RL", "dust_tide@RR"] },
]);

// ---------------------------------------------------------------- Stage ごとの12戦
//
// **Stage の数がここで決まる。**campaign-stages.mjs はこの並びの長さを読む。
export const STAGE_ENCOUNTERS = Object.freeze([
  STAGE_0, STAGE_1, STAGE_2, STAGE_3, STAGE_4,
  STAGE_5, STAGE_6, STAGE_7, STAGE_8, STAGE_9,
].map((stage, sequence) => Object.freeze(auditBudgetLadder(stage, "stage_" + sequence))));

export const STAGE_COUNT = STAGE_ENCOUNTERS.length;

export function encountersForStage(sequence) {
  const clamped = Math.max(0, Math.min(STAGE_COUNT - 1, Math.floor(sequence ?? 0)));
  return STAGE_ENCOUNTERS[clamped];
}

// 旧来の名前。**Stage 0 の12戦**を指す（Stage を渡さない呼び出しの既定）。
export const EXPEDITION_ENCOUNTERS = STAGE_ENCOUNTERS[0];

export const ENCOUNTERS_PER_RUN = EXPEDITION_ENCOUNTERS.length;
export const ACT_BOSS_INDEXES = Object.freeze([4, 8, 12]);

export function expeditionEncounter(index, stageSequence = 0) {
  const encounters = encountersForStage(stageSequence);
  return encounters[Math.max(0, Math.min(ENCOUNTERS_PER_RUN - 1, index - 1))];
}

export function actOf(index) {
  return expeditionEncounter(index).act;
}

// その Stage に出る敵 id（増援も数える）。Stage 定義の `enemyFamilyIds` と
// 図鑑の解禁条件が、**実際に出る敵からしか作られない**ようにするための一箇所。
export function enemyIdsForStage(sequence) {
  const ids = new Set();
  for (const encounter of encountersForStage(sequence)) {
    for (const enemy of encounter.enemies) ids.add(enemy.enemyActorId);
    for (const enemy of encounter.reinforcements) ids.add(enemy.enemyActorId);
  }
  return [...ids];
}

// その Stage の幕ボス（4・8・12戦目）と、その法則。
export function actBossesForStage(sequence) {
  return ACT_BOSS_INDEXES.map((index) => {
    const encounter = expeditionEncounter(index, sequence);
    const boss = encounter.enemies.find((enemy) => enemy.boss);
    return { index, enemyActorId: boss?.enemyActorId ?? null, bossLawId: encounter.bossLawId };
  });
}

// ---------------------------------------------------------------- 地域
export const REGION = Object.freeze({
  id: "ash_frontier",
  displayName: REGION_LORE.ash_frontier.displayName,
  summary: REGION_LORE.ash_frontier.summary,
  enemyFamilyIds: Object.freeze(["husk", "dust", "weave", "forge"]),
  enemyFamilyText: REGION_LORE.ash_frontier.enemyFamilyText,
  regionLawIds: Object.freeze([]),
  rewardTableId: "equipment_1",
  actBossIds: Object.freeze(["gray_bulwark", "gray_echo", "ash_core"]),
  actBossLawIds: Object.freeze(["law_bulwark_wall", "law_echo_return", "law_core_charge"]),
});

// ---------------------------------------------------------------- 難易度
//
// R6 §13.2 — DifficultyDef を data で持つ。**0〜5 だけ**。
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
