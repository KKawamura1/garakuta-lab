// ecology/content/enemies.mjs
//
// **敵 unit の定義と、その狙いの説明文。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。R23（第一部10 Stage 化）で、家系（family）ごとの表へ組み直した。
//
// engine・schema・共通registryは変更しない。
//
// ---------------------------------------------------------------- なぜ表へ組み直したか
//
// 旧実装には、**説明文と挙動が食い違う敵**が複数いた。原因は三つとも構造である。
//
//   1. `gray_echo`（反響体）の反応技能が、production では**空だった**。
//      chassis が持っていた `damage_echo` は fixture の termination 立会人
//      （費用なし・99回）なので、このファイルの末尾で一律に剥がしていた。
//      剥がした結果、「殴ると返ってくる」という噂・狙い・幕2ボスの法則・
//      精鋭戦「反響の坑道」が、**全部ただの殴り合い**になっていた。
//      → production 用の反撃（`counter_blow`、反応点1・chain1回）を持たせて、
//        文のほうではなく**挙動のほうを本当にする**。
//   2. `gray_runner`（走り手）と `gray_swarm`（群れ）は「速い」と書いてあるのに、
//      走者との差が maxHp だけだった。→ 速さは行動権（AP2）で表す。
//   3. 腕力・技術が**全個体で同じ値**だった（中立 40 × 出荷難度）。
//      「重い一撃の砕き手」と「後ろから撃つ後撃ち」が同じ打撃力だったので、
//      役割の違いが盤面に出ない。→ 家系と役割ごとに三能力を分ける。
//
// そして **狙いの説明文（ENEMY_TARGETING）は、ここの tactics から導出する**
// （`content/encounters.mjs`）。人が二箇所に書かないので、もう二度とずれない。
//
// ---------------------------------------------------------------- 家系（family）
//
// 第一部は10 Stage ある。Stage が進むと**別の家系**が出る。同じ敵を数だけ増やして
// 難度を作らない（AGENTS.md「敵は特定技能を要求せず、…性能軸を変える」）。
//
//   husk  灰殻 … Stage 0〜4。前で殴る・後ろから撃つ・守る・溜める・庇う・治す。
//                    Stage 1 からは単体ではなく、役割の組合せが文法の教材になる
//   dust  灰塵 … Stage 4〜。**対象数**。行・列・全体へ同時に来る。数で手数を削る
//   weave 灰織 … Stage 6〜。**位置と状態**。引きずり出す・怯ませる・裂く・隙を配る
//   forge 灰炉 … Stage 8〜。**受け無視と持久**。厚い受けと、受けを無視する一撃
//
// 新しい家系は**新語彙を一つも足していない**。既に公開済みの行動技能
//（薙ぎ払い・突き通し・引きずり出す・抉る・受け崩し…）を敵側から出しているだけである。

import { FIXTURE_CONTENT } from "../fixture-content.mjs";
import { LEGACY_COMBAT_SCALE, NEUTRAL_STAT, cloneEnemy, renamed } from "./base.mjs";

// **出荷している難度。** 1.0 のままだと、無作為に枠を埋めた編成が
// 半分以上の確率で7区画を完走し、設計された初期編成（耐久0.86倍）より強くなる。
// 1.2 倍にすると:
//   初期編成そのまま 0.72 → 負ける
//   全員へ常設2つ    0.84 → まだ負ける
//   さらに装備2つずつ 1.14 → 通る
//   無作為編成の中央値 0.88 → 通らない
// **「初期編成では勝てないが、もらった点をちゃんと配れば通る」**を数で置いた値。
export const SHIPPED_DIFFICULTY = 1.2;

// ---------------------------------------------------------------- 家系ごとの出力
//
// **Stage 帯を決める唯一のつまみ。**個体表（下）は「その家系の中での役割の差」を
// 書く場所で、**家系全体がどのくらい強いか**はここで決める。二つを混ぜると、
// 「盾兵を少し硬くしたい」のたびに全 Stage の難度が動いてしまう。
//
// 値は `analysis/ecology-campaign-curve.mjs` の実測で決めた soft data である。
// あの検査は10 Stage を同じ物差し（基準編成が一戦で受ける damage が隊の総HPの何割か）
// で並べるので、**ここを動かしたら必ず走らせて、曲線を書き直す。**
//
//   husk  … 灰殻帯の共通基準。Stage 3 の第7・8戦だけは、配置側で明示的に
//            HP と攻撃を上乗せする
//   dust  … Stage 4〜。灰殻より一段上
//   weave … Stage 6〜。さらに一段上
//   forge … Stage 8〜。第一部でいちばん重く、終盤のHPと攻撃を少し上乗せした
//
// **敵を隠れて自動強化しない**（AGENTS.md）。ここは player profile を1バイトも読まない、
// 家系ごとの固定値である。戦闘前の敵カードには、この値を掛けた後の数がそのまま出る。
export const FAMILY_POWER = Object.freeze({
  husk: Object.freeze({ hpBps: 10_000, offenseBps: 9_200, guardBps: 10_000 }),
  dust: Object.freeze({ hpBps: 12_100, offenseBps: 11_400, guardBps: 10_000 }),
  weave: Object.freeze({ hpBps: 10_000, offenseBps: 9_500, guardBps: 10_500 }),
  forge: Object.freeze({ hpBps: 10_600, offenseBps: 10_200, guardBps: 11_000 }),
});

// ---------------------------------------------------------------- 家系

export const ENEMY_FAMILIES = Object.freeze([
  Object.freeze({
    id: "husk",
    displayName: "灰殻",
    summary: "前で庇い、後ろで治し、刻印から多段を通す。灰の浅いところで戦い方を覚えている。",
    pressure: Object.freeze(["前列と後列の選び方", "庇護と治療の分業", "刻印から多段への連携"]),
  }),
  Object.freeze({
    id: "dust",
    displayName: "灰塵",
    summary: "一体ずつは軽い。行・列・全体へ同時に来るので、一人ずつ守っても間に合わない。",
    pressure: Object.freeze(["対象数", "多段で受け構えを剥がす", "隙の面展開"]),
  }),
  Object.freeze({
    id: "weave",
    displayName: "灰織",
    summary: "隊列と状態のほうへ手を出す。後ろへ下げた者が、下げた場所から引き出される。",
    pressure: Object.freeze(["位置を動かされる", "怯み・裂傷・隙", "後列への直接到達"]),
  }),
  Object.freeze({
    id: "forge",
    displayName: "灰炉",
    summary: "厚い受けと、受けを無視する一撃を同時に持つ。硬さで解いても、硬さでは守れない。",
    pressure: Object.freeze(["受け無視", "単発大威力", "持久と張り直し"]),
  }),
]);

export const ENEMY_FAMILY_BY_ID = Object.freeze(
  Object.fromEntries(ENEMY_FAMILIES.map((family) => [family.id, family])),
);

// ---------------------------------------------------------------- 個体表
//
// hp    … legacy 単位（LEGACY_COMBAT_SCALE 倍して出荷難度を掛ける）
// might / focus / guard … 中立 40 を基準にした値（出荷難度を掛ける）
// ap / rp … 行動権・反応点。**速さは ap で表す**（説明文だけの「速い」を作らない）
// threat … 遭遇の threat budget を算出する重み。**実測した重さの順**
// chassis … fixture のどの骨格から複製するか（engine が知っているのは骨格だけ）
//
// **完全上位互換を作らない**（AGENTS.md）。どの個体も、必ず一つは他より低い軸を持つ。

const UNITS = [
  // ============================================ 灰殻（husk）— Stage 0〜4
  // 走者 … いちばん軽い。数で来る
  { id: "gray_scrapper", family: "husk", chassis: "husk", name: "灰殻の走者",
    hp: 10, might: 40, focus: 34, guard: 0, ap: 1, rp: 0, threat: 1,
    tactics: ["front_strike"] },
  // 群れ … 走者より柔らかく、そのぶん軽い。増援の常連
  { id: "gray_swarm", family: "husk", chassis: "husk", name: "灰殻の群れ",
    hp: 7, might: 34, focus: 30, guard: 0, ap: 1, rp: 0, threat: 1,
    tactics: ["front_strike"] },
  // 走り手 … **一巡に二度動く。**一撃は走者より軽いので、受けの厚い相手には最も弱い
  { id: "gray_runner", family: "husk", chassis: "husk", name: "灰殻の走り手",
    hp: 9, might: 28, focus: 24, guard: 0, ap: 2, rp: 0, threat: 2,
    tactics: ["front_strike"] },
  // 刻み手 … 三段を一つの行動で出す。受けの低い相手へは走り手より重いが、
  // 受けの高い相手には三度引かれる。Stage 1 から多段対策を盤面へ出す。
  { id: "gray_razor", family: "husk", chassis: "husk_warden", name: "灰殻の刻み手",
    hp: 15, might: 44, focus: 28, guard: 1, ap: 1, rp: 0, threat: 4,
    tactics: ["barrage_strike", "front_strike"] },
  // 傷印 … 先に全員へ隙を配る。自分の一撃は軽いが、同じ round に続く味方の
  // 多段まで全hitが太くなる。個体ではなく行動順を含む編成で強さを作る役。
  { id: "gray_brand", family: "husk", chassis: "husk_marker", name: "灰殻の傷印",
    hp: 16, might: 32, focus: 48, guard: 2, ap: 1, rp: 0, threat: 5,
    tactics: ["mark_spread", "front_strike"] },
  // 後撃ち … 後列を抜く。前を固めただけでは通らない
  { id: "gray_marksman", family: "husk", chassis: "husk", name: "灰殻の後撃ち",
    hp: 11, might: 28, focus: 42, guard: 0, ap: 1, rp: 0, threat: 2,
    tactics: ["rear_strike"] },
  // 潜み手 … 後列を優先し、後列が空なら前列。後撃ちより硬いぶん重い
  { id: "gray_stalker", family: "husk", chassis: "husk", name: "灰殻の潜み手",
    hp: 13, might: 32, focus: 42, guard: 1, ap: 1, rp: 0, threat: 3,
    tactics: ["rear_strike", "front_strike"] },
  // 守衛 … 初手を守りに使う。急いでいる相手ほど嫌がる
  { id: "gray_guard", family: "husk", chassis: "husk_warden", name: "灰殻の守衛",
    hp: 18, might: 38, focus: 34, guard: 10, ap: 1, rp: 0, threat: 3,
    tactics: ["enemy_guard", "front_strike"] },
  // 籠り手 … 守衛より厚い防壁と、薄い打撃
  { id: "gray_shelter", family: "husk", chassis: "husk_warden", name: "灰殻の籠り手",
    hp: 21, might: 30, focus: 44, guard: 8, ap: 1, rp: 0, threat: 3,
    tactics: ["enemy_guard", "front_strike"] },
  // 抱え手 … 自分を狙わなかった攻撃を一巡に二度まで引き取る。
  // 自身の受けは厚いが火力は低い。先に倒すか、後列へ直接届く一撃で越える。
  { id: "gray_aegis", family: "husk", chassis: "husk_bulwark", name: "灰殻の抱え手",
    hp: 28, might: 34, focus: 40, guard: 16, ap: 1, rp: 2, threat: 6,
    tactics: ["enemy_guard", "front_strike"], reactives: ["cover_ally"] },
  // 縫い手 … 後列で、自分の側が受けた実HP damage を一巡に二度まで手当てする。
  // 自分へ薄い防壁を張るだけなので、後衛狩りで先に落とす価値が明確にある。
  { id: "gray_mender", family: "husk", chassis: "husk_warden", name: "灰殻の縫い手",
    hp: 16, might: 22, focus: 58, guard: 2, ap: 1, rp: 2, threat: 4,
    tactics: ["enemy_guard"], reactives: ["mend"] },
  // 砕き手 … 溜めてから重く来る。溜めている間は受けが薄い
  { id: "gray_breaker", family: "husk", chassis: "husk_warden", name: "灰殻の砕き手",
    hp: 20, might: 54, focus: 32, guard: 4, ap: 1, rp: 0, threat: 5,
    tactics: ["enemy_heavy", "front_strike"] },
  // 狩人 … こちらの準備を罰する
  { id: "gray_hunter", family: "husk", chassis: "husk_hunter", name: "灰殻の狩人",
    hp: 19, might: 46, focus: 36, guard: 2, ap: 1, rp: 0, threat: 5,
    tactics: ["hunt_the_slow", "front_strike"] },
  // 追い手 … 準備を罰し、後列を追う。そのぶん受けが薄い
  { id: "gray_harrower", family: "husk", chassis: "husk_hunter", name: "灰殻の追い手",
    hp: 17, might: 40, focus: 44, guard: 1, ap: 1, rp: 0, threat: 5,
    tactics: ["hunt_the_slow", "rear_strike", "front_strike"] },
  // 反響体 … **殴られると殴り返す。**手数で削るほどこちらが減る
  // 反応点は1。**一巡に一度だけ返す。**2にすると、多段で押す構成が返しだけで崩れて
  // 「多段をやめる」以外の答えが無くなる（Stage 3 の三構成を実測して決めた）。
  { id: "gray_echo", family: "husk", chassis: "husk_echo", name: "灰殻の反響体",
    hp: 20, might: 36, focus: 36, guard: 2, ap: 1, rp: 1, threat: 5,
    tactics: ["front_strike"], reactives: ["counter_blow"] },
  // 盾兵 … 灰殻でいちばん硬い。多段を誘う
  { id: "gray_bulwark", family: "husk", chassis: "husk_bulwark", name: "灰殻の盾兵",
    hp: 32, might: 40, focus: 38, guard: 14, ap: 1, rp: 0, threat: 7,
    tactics: ["enemy_guard", "front_strike"] },
  // 核 … 幕の奥に一つだけ。重い一撃と厚い受け
  { id: "ash_core", family: "husk", chassis: "husk_bulwark", name: "灰の核心",
    hp: 50, might: 44, focus: 50, guard: 12, ap: 1, rp: 0, threat: 12,
    tactics: ["enemy_heavy", "front_strike"] },

  // ============================================ 灰塵（dust）— Stage 4〜
  // 粒 … 灰塵の最小単位。走者より少しだけ重い
  { id: "dust_mote", family: "dust", chassis: "husk", name: "灰塵の粒",
    hp: 9, might: 42, focus: 36, guard: 0, ap: 1, rp: 0, threat: 1,
    tactics: ["front_strike"] },
  // 薙ぎ手 … 前列が2人以上なら行ごと薙ぐ。**前へ並べるほど痛い**
  { id: "dust_lash", family: "dust", chassis: "husk_warden", name: "灰塵の薙ぎ手",
    hp: 18, might: 46, focus: 40, guard: 4, ap: 1, rp: 0, threat: 5,
    tactics: ["row_sweep", "front_strike"] },
  // 突き手 … 同じ列の前後を貫く。**後ろへ下げても同じ列なら届く**
  { id: "dust_spire", family: "dust", chassis: "husk_warden", name: "灰塵の突き手",
    hp: 20, might: 44, focus: 44, guard: 6, ap: 1, rp: 0, threat: 5,
    tactics: ["column_thrust", "front_strike"] },
  // 顎 … 多段。**受け構えを剥がすが、受けの厚い相手には最も弱い**
  { id: "dust_maw", family: "dust", chassis: "husk_warden", name: "灰塵の顎",
    hp: 22, might: 40, focus: 38, guard: 4, ap: 1, rp: 0, threat: 5,
    tactics: ["barrage_strike", "front_strike"] },
  // 帳 … 自分の側へ受け構えを配る。削り切る手数を要求する
  { id: "dust_veil", family: "dust", chassis: "husk_bulwark", name: "灰塵の帳",
    hp: 24, might: 30, focus: 46, guard: 8, ap: 1, rp: 0, threat: 5,
    tactics: ["spread_the_guard", "front_strike"] },
  // 唱和 … 隙を面で配る。**次に来る一撃が全員ぶん重くなる**
  { id: "dust_choir", family: "dust", chassis: "husk_marker", name: "灰塵の唱和",
    hp: 21, might: 32, focus: 48, guard: 4, ap: 1, rp: 0, threat: 6,
    tactics: ["mark_spread", "front_strike"] },
  // 潮 … 灰塵の幕ボス。行と列の両方を持つ
  { id: "dust_tide", family: "dust", chassis: "husk_bulwark", name: "灰塵の潮",
    hp: 46, might: 50, focus: 50, guard: 10, ap: 1, rp: 0, threat: 12,
    tactics: ["row_sweep", "column_thrust", "front_strike"] },

  // ============================================ 灰織（weave）— Stage 6〜
  // 手繰り … **後ろへ下げた者を最前へ引きずり出す。**隠れ場所を消す
  { id: "weave_hand", family: "weave", chassis: "husk_warden", name: "灰織の手繰り",
    hp: 22, might: 44, focus: 42, guard: 6, ap: 1, rp: 0, threat: 6,
    tactics: ["drag_forward", "front_strike"] },
  // 結び手 … 怯ませて、こちらの出す damage を軽くする
  { id: "weave_knot", family: "weave", chassis: "husk_warden", name: "灰織の結び手",
    hp: 24, might: 46, focus: 44, guard: 8, ap: 1, rp: 0, threat: 6,
    tactics: ["hamstring", "front_strike"] },
  // 棘 … 裂傷。**ラウンド終わりに受けを無視して削る**ので、硬さでは止まらない
  { id: "weave_thorn", family: "weave", chassis: "husk_warden", name: "灰織の棘",
    hp: 26, might: 48, focus: 42, guard: 6, ap: 1, rp: 0, threat: 6,
    tactics: ["rend", "front_strike"] },
  // 見張り … 隙を刻み、その傷口を開く。二手で一つの形になる
  { id: "weave_eye", family: "weave", chassis: "husk_marker", name: "灰織の見張り",
    hp: 20, might: 38, focus: 50, guard: 4, ap: 1, rp: 0, threat: 6,
    tactics: ["mark_target", "crack_mark", "front_strike"] },
  // 遠手 … **後列へ直接届く。**前を固めても後ろが減る
  { id: "weave_reach", family: "weave", chassis: "husk", name: "灰織の遠手",
    hp: 22, might: 34, focus: 52, guard: 4, ap: 1, rp: 0, threat: 6,
    tactics: ["rear_hunt", "rear_strike"] },
  // 写し … 灰織の幕ボス。引き出してから殴り、殴られれば返す
  { id: "weave_mirror", family: "weave", chassis: "husk_echo", name: "灰織の写し",
    hp: 50, might: 50, focus: 52, guard: 12, ap: 1, rp: 2, threat: 13,
    tactics: ["drag_forward", "front_strike"], reactives: ["counter_blow"] },

  // ============================================ 灰炉（forge）— Stage 8〜
  // 錐 … 受けを6割無視する。硬さで解いた編成の裏
  { id: "forge_awl", family: "forge", chassis: "husk_warden", name: "灰炉の錐",
    hp: 26, might: 50, focus: 44, guard: 8, ap: 1, rp: 0, threat: 6,
    tactics: ["pierce_thrust", "front_strike"] },
  // 槌 … **受けも受け構えも完全に無視する。**守りでは減らない
  { id: "forge_hammer", family: "forge", chassis: "husk_warden", name: "灰炉の槌",
    hp: 30, might: 56, focus: 42, guard: 10, ap: 1, rp: 0, threat: 7,
    tactics: ["guard_crush", "front_strike"] },
  // 金床 … 受けが最も厚く、張り直す。持久の勝負になる
  { id: "forge_anvil", family: "forge", chassis: "husk_bulwark", name: "灰炉の金床",
    hp: 44, might: 42, focus: 46, guard: 20, ap: 1, rp: 0, threat: 9,
    tactics: ["enemy_guard", "front_strike"] },
  // 熾 … 手負いを仕留めに来る。**削られた者を後ろへ下げないと落ちる**
  { id: "forge_ember", family: "forge", chassis: "husk_hunter", name: "灰炉の熾",
    hp: 24, might: 52, focus: 46, guard: 6, ap: 1, rp: 0, threat: 7,
    tactics: ["execute_low", "finishing_thrust", "front_strike"] },
  // 鞴 … 自分の側の前列へ防壁を張る。削り切る手数を要求する
  { id: "forge_bellows", family: "forge", chassis: "husk_bulwark", name: "灰炉の鞴",
    hp: 28, might: 32, focus: 54, guard: 10, ap: 1, rp: 0, threat: 7,
    tactics: ["shield_wall", "front_strike"] },
  // 継ぎ手 … 灰殻の縫い手の終盤形。前列へ防壁を配り、抜けたdamageを三度まで戻す。
  // 後列へ置くことで、前列を正面から殴るだけの構成へ明確な時間圧力を掛ける。
  { id: "forge_mender", family: "forge", chassis: "husk_bulwark", name: "灰炉の継ぎ手",
    hp: 34, might: 24, focus: 70, guard: 8, ap: 1, rp: 3, threat: 9,
    tactics: ["shield_wall"], reactives: ["mend"] },
  // 抱壁 … 一巡に二度、後列への攻撃を高い受けで引き取る。自分を守るだけの金床と
  // 違い、継ぎ手や主心を狙う行動そのものへ割り込む。
  { id: "forge_aegis", family: "forge", chassis: "husk_bulwark", name: "灰炉の抱壁",
    hp: 52, might: 42, focus: 48, guard: 24, ap: 1, rp: 2, threat: 11,
    tactics: ["enemy_guard", "front_strike"], reactives: ["cover_ally"] },
  // 本体 … 第一部の終着。溜めた一撃と、受けを無視する一撃を両方持つ
  { id: "ash_furnace", family: "forge", chassis: "husk_bulwark", name: "灰炉の本体",
    hp: 62, might: 56, focus: 56, guard: 16, ap: 1, rp: 0, threat: 16,
    tactics: ["enemy_heavy", "guard_crush", "front_strike"] },
  // 主心 … 第一部の最終戦だけに出る完成形。一巡に二度動き、隙を配った直後の多段、
  // 溜め、裂傷、受け無視を順に切り替え、殴られれば一度だけ返す。
  // 特定技能を鍵にはせず、面回復・単発・後列到達・必殺の切りどころを同時に問う。
  { id: "ash_furnace_heart", family: "forge", chassis: "husk_bulwark", name: "灰炉の主心",
    hp: 100, might: 72, focus: 72, guard: 22, ap: 2, rp: 2, threat: 24,
    tactics: ["mark_spread", "barrage_strike", "enemy_heavy", "rend", "guard_crush", "front_strike"],
    reactives: ["counter_blow"] },
];

export const ENEMY_UNITS = Object.freeze(UNITS.map((unit) => Object.freeze({
  ...unit,
  tactics: Object.freeze([...unit.tactics]),
  reactives: Object.freeze([...(unit.reactives ?? [])]),
})));

export const ENEMY_UNIT_BY_ID = Object.freeze(
  Object.fromEntries(ENEMY_UNITS.map((unit) => [unit.id, unit])),
);

export const ENEMY_NAMES = Object.freeze({
  husk: "灰殻兵",
  husk_warden: "灰殻の見張り",
  still_husk: "動かない灰殻",
  husk_hunter: "灰殻の狩人",
  husk_bulwark: "灰殻の盾兵",
  husk_echo: "灰殻の反響体",
  husk_marker: "灰殻の標定手",
  ...Object.fromEntries(ENEMY_UNITS.map((unit) => [unit.id, unit.name])),
});

// 家系ごとの id 一覧。Stage 定義（campaign-stages.mjs）と図鑑がここを読む。
export const ENEMY_IDS_BY_FAMILY = Object.freeze(
  Object.fromEntries(ENEMY_FAMILIES.map((family) => [
    family.id,
    Object.freeze(ENEMY_UNITS.filter((unit) => unit.family === family.id).map((unit) => unit.id)),
  ])),
);

export function enemyFamilyOf(enemyActorId) {
  return ENEMY_UNIT_BY_ID[enemyActorId]?.family ?? null;
}

// R6 §11.2 — chassis、追加個体、mutation、boss law が budget を消費する。
// **個体の定義と同じ表から引く**ので、敵を足したのに重みを書き忘れる、が起きない。
export const ENEMY_THREAT_COST = Object.freeze(
  Object.fromEntries(ENEMY_UNITS.map((unit) => [unit.id, unit.threat])),
);

// ---------------------------------------------------------------- 組み立て

const enemyActors = renamed("enemyActors", ENEMY_NAMES);

const scaled = (value) => Math.round(value * SHIPPED_DIFFICULTY);

for (const unit of ENEMY_UNITS) {
  const power = FAMILY_POWER[unit.family];
  if (!power) throw new Error("enemies: 出力の決まっていない家系 " + unit.family);
  const withPower = (value, bps) => Math.round(value * SHIPPED_DIFFICULTY * bps / 10_000);
  enemyActors[unit.id] = cloneEnemy(unit.chassis, unit.id, unit.name, {
    maxHp: Math.round(unit.hp * LEGACY_COMBAT_SCALE * SHIPPED_DIFFICULTY * power.hpBps / 10_000),
    might: withPower(unit.might, power.offenseBps),
    focus: withPower(unit.focus, power.offenseBps),
    guard: withPower(unit.guard, power.guardBps),
    baseActionPoints: unit.ap,
    baseReactionPoints: unit.rp,
    tactics: unit.tactics.map((activeSkillId) => ({ activeSkillId, useWhen: [] })),
    reactiveSkillIds: [...unit.reactives],
  });
}

// fixture 由来の骨格（PROLOGUE の `husk` など、表に無い id）にも中立の値を置く。
// **表に載っている個体はここで上書きしない。**
for (const [id, definition] of Object.entries(enemyActors)) {
  if (ENEMY_UNIT_BY_ID[id]) continue;
  definition.maxHp = Math.round(definition.maxHp * LEGACY_COMBAT_SCALE * SHIPPED_DIFFICULTY);
  definition.might = scaled(NEUTRAL_STAT);
  definition.focus = scaled(NEUTRAL_STAT);
  definition.guard = 0;
}

// fixture の termination 立会人（費用なし・99回の `damage_echo` など）は
// production の敵へ入れない。**代わりが要る敵には、上の表で production の
// 反応技能（反応点を払う `counter_blow`）を明示的に持たせてある。**
const terminationReactiveIds = new Set(
  Object.entries(FIXTURE_CONTENT.reactiveSkills)
    .filter(([, definition]) => (definition.tags ?? []).includes("termination"))
    .map(([id]) => id),
);

for (const definition of Object.values(enemyActors)) {
  definition.reactiveSkillIds = (definition.reactiveSkillIds ?? [])
    .filter((id) => !terminationReactiveIds.has(id));
  definition.tags = (definition.tags ?? []).filter((tag) => tag !== "termination");
}

export const ENEMY_ACTORS = enemyActors;
