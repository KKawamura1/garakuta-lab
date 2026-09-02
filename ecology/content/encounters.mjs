// ecology/content/encounters.mjs
//
// **区画ごとの敵の配置。threat budget は Phase B まで入れない。**
// R7 Milestone 0 で playable-battles.mjs から分離した。Wave 1 の難度調整もここで行う。
//
// ここを触ってよいのは 敵・encounter 担当だけ。engine・schema・共通registryは変更しない。

import { LEGACY_COMBAT_SCALE } from "./base.mjs";
import { SHIPPED_DIFFICULTY } from "./enemies.mjs";

export const ENCOUNTERS = [
  {
    stage: 1,
    name: "灰の入口",
    description: "速い走り手が正面から来る二体。前列が受け、攻撃役が一体ずつ落とす。",
    enemies: [
      { instanceId: "e_runner_1", enemyActorId: "gray_runner", position: "front_left", hp: 12 },
      { instanceId: "e_runner_2", enemyActorId: "gray_runner", position: "front_right", hp: 12 },
    ],
    maxRounds: 6,
  },
  {
    stage: 2,
    name: "狩りの路地",
    description: "準備中の味方を追う追い手と、後列へ潜む潜み手。狙われる順番を読む。",
    enemies: [
      { instanceId: "e_harrower", enemyActorId: "gray_harrower", position: "front_left", hp: 18 },
      { instanceId: "e_stalker", enemyActorId: "gray_stalker", position: "rear_left", hp: 13 },
    ],
    maxRounds: 7,
  },
  {
    stage: 3,
    name: "崩れた盾列",
    description: "防壁で粘る籠り手と、重い一撃を準備する砕き手。受けるか先に崩すかを選ぶ。",
    enemies: [
      { instanceId: "e_shelter", enemyActorId: "gray_shelter", position: "front_left", hp: 20 },
      { instanceId: "e_breaker", enemyActorId: "gray_breaker", position: "front_right", hp: 22 },
    ],
    maxRounds: 8,
  },
  {
    stage: 4,
    name: "反響の坑道",
    description: "反響体と潜み手が別の列から圧をかける。単発の大打撃と回復を使い分ける。",
    enemies: [
      { instanceId: "e_echo", enemyActorId: "gray_echo", position: "front_left", hp: 20 },
      { instanceId: "e_stalker", enemyActorId: "gray_stalker", position: "rear_left", hp: 13 },
      { instanceId: "e_runner", enemyActorId: "gray_runner", position: "front_right", hp: 12 },
    ],
    maxRounds: 8,
  },
  {
    stage: 5,
    name: "灰の圧力",
    description: "重い盾、後衛を追う追い手、速い走り手。どの役割を厚くするかが問われる。",
    enemies: [
      { instanceId: "e_bulwark", enemyActorId: "gray_bulwark", position: "front_left", hp: 32 },
      { instanceId: "e_harrower", enemyActorId: "gray_harrower", position: "front_center", hp: 18 },
      { instanceId: "e_runner", enemyActorId: "gray_runner", position: "rear_right", hp: 12 },
    ],
    maxRounds: 9,
  },
  {
    stage: 6,
    name: "二つの狙い",
    description: "籠り手と反響体が前列を削り、潜み手と群れが後列を揺さぶる。配置そのものが防御になる。",
    enemies: [
      { instanceId: "e_shelter", enemyActorId: "gray_shelter", position: "front_left", hp: 20 },
      { instanceId: "e_stalker", enemyActorId: "gray_stalker", position: "rear_left", hp: 13 },
      { instanceId: "e_echo", enemyActorId: "gray_echo", position: "front_right", hp: 20 },
      { instanceId: "e_swarm", enemyActorId: "gray_swarm", position: "rear_right", hp: 8 },
    ],
    maxRounds: 10,
  },
  {
    stage: 7,
    name: "灰の核心",
    description: "準備する核心を止めながら、砕き手と籠り手を突破し、後列の潜み手と群れも抑える最終戦。",
    enemies: [
      { instanceId: "e_core", enemyActorId: "ash_core", position: "front_left", hp: 54 },
      { instanceId: "e_breaker", enemyActorId: "gray_breaker", position: "front_center", hp: 22 },
      { instanceId: "e_shelter", enemyActorId: "gray_shelter", position: "front_right", hp: 20 },
      { instanceId: "e_stalker", enemyActorId: "gray_stalker", position: "rear_left", hp: 13 },
      { instanceId: "e_swarm", enemyActorId: "gray_swarm", position: "rear_right", hp: 8 },
    ],
    maxRounds: 12,
  },
];

// R6 §4.4 — encounter が持つ hp も連続量なので10倍する。
// **敵定義の maxHp と同じ倍率**でないと、区画ごとに強さがずれる。
// **出荷難度も同じ倍率で掛ける**（enemies.mjs の SHIPPED_DIFFICULTY）。
// 定義の maxHp と初期hpがずれると、敵が上限より低いHPで湧く。
for (const encounter of ENCOUNTERS) {
  for (const enemy of encounter.enemies) {
    if (typeof enemy.hp === "number") enemy.hp = Math.round(enemy.hp * LEGACY_COMBAT_SCALE * SHIPPED_DIFFICULTY);
  }
}

// 敵ごとの狙いの説明文。engine の targetQuery を人の言葉へ写したもので、
// **規則そのものではない**（ずれたら enemies.mjs 側の定義が正）。
// R12 §4.B — **拾い屋のあいだで言われていること。**狙い（ENEMY_TARGETING）とは別に、
// 敵カードへもう一行だけ載せる。敵カードは戦闘前に必ず読まれるので、世界の側の声を
// 配るのに一番安い場所である。
//
// **灰殻が何なのかは説明しない**（R11 §2.1）。ここに書くのは詰所の台帳の書き方、
// 拾い屋の言い習わし、噂の類だけで、正体には触れない。**規則の言い換えも書かない**
// （それは ENEMY_TARGETING の仕事で、二重に書くと片方だけずれる）。
export const ENEMY_LORE = {
  husk: "台帳ではこれを「兵」と数えない。「一体」と書く。",
  husk_warden: "門の内側に立っていることが多い。誰の門なのかは、誰も知らない。",
  still_husk: "動かないものには手を出すな、と教わる。理由は教わらない。",
  husk_hunter: "こちらが何かを構えたときだけ、まっすぐ来る。",
  husk_bulwark: "殴った音が、金属でも石でもない。",
  husk_echo: "殴ると、殴った側が同じところを痛める。新人はここで一度辞める。",
  husk_marker: "見られた、と思ったら、もう囲まれている。",
  gray_scrapper: "灰の浅いところに一番多い。数だけはいくらでもいる。",
  gray_runner: "足音がしない。振り向いたときには間合いの内側にいる。",
  gray_marksman: "後ろに置いた者から減る。だから新人には前を任せる、と言う先達がいる。",
  gray_stalker: "隊列の後ろを覚えている、という言い方をする者がいる。",
  gray_guard: "最初の一手をいつも守りに使う。急いでいる相手ほど嫌がる。",
  gray_breaker: "溜めているあいだは静かで、そのぶん派手に来る。",
  gray_shelter: "先に殻を張る。剥がすまでのあいだが、こちらの持ち時間になる。",
  gray_hunter: "こちらの溜めを嫌う。準備している者から順に潰しに来る。",
  gray_harrower: "追う。逃げた先で待っていることがある、というのは噂のほう。",
  gray_echo: "反響体と呼ぶのは協会の呼び方で、拾い屋は「返す奴」と言う。",
  gray_bulwark: "壊しても張り直す。持久の勝負になると、たいてい先に人が折れる。",
  gray_swarm: "一体ずつは軽い。軽いものが同時に来ると、重い一撃より効く。",
  ash_core: "幕の奥に一つだけある。持ち帰った者はいるが、何だったかは書かれていない。",
};

export const ENEMY_TARGETING = {
  gray_scrapper: "前列の生存者を、左から狙う。",
  gray_runner: "前列の生存者を、速い順に狙う。",
  gray_marksman: "後列の生存者を優先して狙う。",
  gray_stalker: "まず後列を狙い、後列がいなければ前列を狙う。",
  gray_guard: "前列を狙い、最初の行動で防壁を張る。",
  gray_breaker: "重い一撃を準備して前列へ放ち、その後は前列を狙う。",
  gray_shelter: "最初に防壁を張り、その後は前列を狙う。",
  gray_hunter: "準備中の味方を見つければ先に狙う。いなければ前列。",
  gray_harrower: "準備中の味方を追い、後列、前列の順に狙う。",
  gray_echo: "前列を殴り、受けたダメージを反響する。",
  gray_bulwark: "防壁を張り直しながら前列を狙う。",
  gray_swarm: "速く動き、前列の生存者を狙う。",
  ash_core: "重い一撃を準備し、完成したら前列へ放つ。",
};
