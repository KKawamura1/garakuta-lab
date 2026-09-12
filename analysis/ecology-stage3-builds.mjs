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
//
// ================================================================ issue #230
//
// **#176 はここまでだった。**取得計画が第6戦までしか無かったので、第7戦から先は
// 「点を余らせたまま進む」測定になり、三構成とも第7戦で全滅していた。遠征は12戦で
// 一つの単位なので、**取得計画も測定も12戦の長さで書く。**
//
// 足したのは三つ。
//
//   A. **通し。**一人ぶんの技能点は第12戦の開始前に13点そろう（通常1・幕ボス2）。
//      三構成とも、その13点を 2,3,4,5,5,6,7,8,9,9,10,11,12 の順で使い切る。
//      戦闘のあいだも本編と同じ形で通す——報酬は毎回「補給1」を取り（装備は取らない。
//      作者試遊の装備0/10と同じ条件）、倒れた味方から順に蘇生し、生存者が7割を
//      切ったら集中治療する。**補給は一戦に1つ・上限5**なので、有限の余白になる。
//   B. **余白。**勝敗だけでは楽勝と辛勝が同じ形で残る。各戦闘のラウンド数・隊の
//      残HP割合・未使用の技能点・手元の補給を持ち、上端（易しすぎ）と下端（届かない）
//      を両方とも言えるようにした。第7戦から先の勝敗は**測る対象**であって、
//      負けたこと自体は失敗ではない。失敗は「前に測った値と違うのに理由が無い」こと。
//      だから各構成は `through` に実測を持ち、そこからずれたら落ちる。
//   C. **名指しされた技能の実測。**PR #186 の作者試遊で強い／弱いと言われた
//      号令・急かす・盾の列・隙を刻む・意趣返しが、通しで何回鳴って何を出したかを
//      数える。直すかどうかは #150 / #189 / #128 で決める。ここは数えるところまで。

import {
  CAMPAIGN_STAGES,
  SKILL_TREE_NODES,
  skillIdsForPacks,
  unmetPrerequisites,
} from "../ecology/content/index.mjs";
import { MIN_SKILL_LEVEL } from "../ecology/schema.mjs";
import { SKILL_LEVEL_COST } from "../ecology/content/skill-levels.mjs";
import {
  CAMP_TREATMENTS,
  MAX_SUPPLIES,
  campTreat,
  commitBattleResult,
  newProfile,
  newRun,
  rewardOffer,
  skillPointsForClear,
} from "../ecology/progression.mjs";
import { CHARACTER_STATS } from "../ecology/content/characters.mjs";
import { RARITIES } from "../ecology/content/affixes.mjs";
import { expeditionEncounter } from "../ecology/content/expedition.mjs";
import { simulateNextBattle } from "../ecology/playable-battles.mjs";
import { CHARACTER_DEFINITIONS } from "../ecology/content/roster.mjs";
import { PLAYABLE_CONTENT } from "../ecology/playable-content.mjs";

const STAGE_SEQUENCE = 3;
const STAGE = CAMPAIGN_STAGES.find((stage) => stage.sequence === STAGE_SEQUENCE);
if (!STAGE) {
  throw new Error("Stage 3 is not defined in campaign stages");
}
const ROSTER = [...STAGE.castCharacterIds];
const SEED = "stage3-vertical-slice";
// **見るのは第12戦まで（issue #230）。**#176 の時点では第6戦で止めていたが、
// そこまでしか取得計画が無いと、第7戦以降は「点を余らせたまま進む」測定になり、
// 実際に三構成とも第7戦で全滅していた。**遠征は12戦で一つの単位**なので、
// 取得計画も測定もその長さで書く。`STAGE_BUILDS_LAST` で短くも長くもできる。
const LAST_ENCOUNTER = Number(process.env.STAGE_BUILDS_LAST ?? 12);
// 核の関門（第4〜6戦）が閉じる戦闘。ここまでは #176 の関門をそのまま守る。
const CORE_GATE_LAST = 6;

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
    // **通しの実測**（issue #230）。目標は第12戦の完走。ここに書くのは
    // 「いまどこまで行けるか」で、目標ではない。数値を動かしたらこの値も動くので、
    // **動かしたら差分の理由を PR に書く**（contract-snapshot と同じ扱い）。
    through: Object.freeze({ reaches: 9, ends: "round_limit" }),
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
      // **取得は配られ次第。**一人ぶんの技能点は通常戦1・幕ボス2で、第12戦の
      // 開始前に13点そろう。だからこの表は 2,3,4,5,5,6,7,8,9,9,10,11,12 の順で
      // 一手ずつ買う形になっている。**貯めない**（貯めた点は何もしない）。
      //
      // 刃で削るは「厚くする」側へ寄せる。装着した技能は毎ラウンド順送りで一本ずつ
      // しか出ないので（`chooseTactic`）、装着を増やすほど主砲の出番が割れる。
      // **同じ人物でも伸びる能力値が違う節は混ぜられない**——ゴウは腕力50・技術6で、
      // 前提として通っただけの後衛狩り（技術）を装着すればその拍は7しか出ない。
      // ナギは腕力16・技術30なので、逆に技術で伸びる後衛狩りが主砲になる。
      // 固定量回復の調整後、この通しでは倒れた仲間を作らず意趣返しが鳴らない。
      // 回復後も刃の反応線を実測できるよう、ヒバナ側は「止めを促す」を入れる。
      Object.freeze({ before: 2, characterId: "warden", skillId: "pierce_thrust" }),
      Object.freeze({ before: 3, characterId: "warden", skillId: "rear_hunt" }),
      Object.freeze({ before: 4, characterId: "warden", skillId: "guard_crush" }),
      Object.freeze({ before: 5, characterId: "warden", skillId: "foundation_might" }),
      Object.freeze({ before: 5, characterId: "warden", level: "guard_crush" }),
      Object.freeze({ before: 6, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 7, characterId: "warden", level: "guard_crush" }),
      Object.freeze({ before: 8, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 9, characterId: "warden", level: "guard_crush" }),
      Object.freeze({ before: 9, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 10, characterId: "warden", level: "guard_crush" }),
      Object.freeze({ before: 11, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 12, characterId: "warden", level: "guard_crush" }),
      Object.freeze({ before: 2, characterId: "lancer", skillId: "finishing_thrust" }),
      Object.freeze({ before: 3, characterId: "lancer", skillId: "hamstring" }),
      Object.freeze({ before: 4, characterId: "lancer", skillId: "execute_low" }),
      Object.freeze({ before: 5, characterId: "lancer", level: "rear_hunt" }),
      Object.freeze({ before: 5, characterId: "lancer", level: "rear_hunt" }),
      Object.freeze({ before: 6, characterId: "lancer", level: "execute_low" }),
      Object.freeze({ before: 7, characterId: "lancer", level: "rear_hunt" }),
      Object.freeze({ before: 8, characterId: "lancer", level: "hamstring" }),
      Object.freeze({ before: 9, characterId: "lancer", level: "rear_hunt" }),
      Object.freeze({ before: 9, characterId: "lancer", level: "execute_low" }),
      Object.freeze({ before: 10, characterId: "lancer", level: "rear_hunt" }),
      Object.freeze({ before: 11, characterId: "lancer", level: "execute_low" }),
      Object.freeze({ before: 12, characterId: "lancer", level: "hamstring" }),
      Object.freeze({ before: 2, characterId: "mender", skillId: "foundation_focus" }),
      Object.freeze({ before: 3, characterId: "mender", level: "aimed_shot" }),
      Object.freeze({ before: 4, characterId: "mender", level: "aimed_shot" }),
      Object.freeze({ before: 5, characterId: "mender", level: "aimed_shot" }),
      Object.freeze({ before: 5, characterId: "mender", level: "emergency_treatment" }),
      Object.freeze({ before: 6, characterId: "mender", level: "aimed_shot" }),
      Object.freeze({ before: 7, characterId: "mender", level: "triage" }),
      Object.freeze({ before: 8, characterId: "mender", level: "aimed_shot" }),
      Object.freeze({ before: 9, characterId: "mender", level: "emergency_treatment" }),
      Object.freeze({ before: 9, characterId: "mender", level: "aimed_shot" }),
      Object.freeze({ before: 10, characterId: "mender", level: "triage" }),
      Object.freeze({ before: 11, characterId: "mender", level: "aimed_shot" }),
      Object.freeze({ before: 12, characterId: "mender", level: "emergency_treatment" }),
      Object.freeze({ before: 2, characterId: "guardian", skillId: "opportunist" }),
      Object.freeze({ before: 3, characterId: "guardian", skillId: "whetted_by_pain" }),
      Object.freeze({ before: 4, characterId: "guardian", skillId: "finish_the_wounded" }),
      Object.freeze({ before: 5, characterId: "guardian", level: "opportunist" }),
      Object.freeze({ before: 5, characterId: "guardian", level: "finish_the_wounded" }),
      Object.freeze({ before: 6, characterId: "guardian", level: "opportunist" }),
      Object.freeze({ before: 7, characterId: "guardian", level: "finish_the_wounded" }),
      Object.freeze({ before: 8, characterId: "guardian", level: "opportunist" }),
      Object.freeze({ before: 9, characterId: "guardian", level: "finish_the_wounded" }),
      Object.freeze({ before: 9, characterId: "guardian", level: "opportunist" }),
      Object.freeze({ before: 10, characterId: "guardian", level: "finish_the_wounded" }),
      Object.freeze({ before: 11, characterId: "guardian", level: "opportunist" }),
      Object.freeze({ before: 12, characterId: "guardian", level: "finish_the_wounded" }),
      Object.freeze({ before: 2, characterId: "tactician", skillId: "steady_aim" }),
      Object.freeze({ before: 3, characterId: "tactician", skillId: "opportunist" }),
      Object.freeze({ before: 4, characterId: "tactician", skillId: "whetted_by_pain" }),
      Object.freeze({ before: 5, characterId: "tactician", skillId: "finish_the_wounded" }),
      Object.freeze({ before: 5, characterId: "tactician", level: "opportunist" }),
      Object.freeze({ before: 6, characterId: "tactician", level: "finish_the_wounded" }),
      Object.freeze({ before: 7, characterId: "tactician", level: "opportunist" }),
      Object.freeze({ before: 8, characterId: "tactician", level: "finish_the_wounded" }),
      Object.freeze({ before: 9, characterId: "tactician", level: "opportunist" }),
      Object.freeze({ before: 9, characterId: "tactician", level: "finish_the_wounded" }),
      Object.freeze({ before: 10, characterId: "tactician", level: "opportunist" }),
      Object.freeze({ before: 11, characterId: "tactician", level: "finish_the_wounded" }),
      Object.freeze({ before: 12, characterId: "tactician", level: "opportunist" }),
    ]),
    // **装着は短く。**順送りなので、装着した本数だけ主砲の出番が割れる。
    // 前提として通っただけの節は装着しない（通り道は目的地ではない）。
    tactics: Object.freeze({
      warden: ["guard_crush", "steady_cut"],
      mender: ["aimed_shot"],
      lancer: ["execute_low", "hamstring", "rear_hunt"],
      guardian: ["column_thrust"],
      tactician: ["steady_aim", "mark_target"],
    }),
    reactives: Object.freeze({
      warden: ["mend"],
      mender: ["triage", "emergency_treatment"],
      lancer: ["triage"],
      guardian: ["finish_the_wounded", "whetted_by_pain", "opportunist", "counter_blow", "scavenge_ap"],
      tactician: ["finish_the_wounded", "whetted_by_pain", "opportunist", "counter_blow", "scavenge_ap"],
    }),
  }),
  Object.freeze({
    id: "wall",
    displayName: "隊列で守る",
    // PR #255 — 補給が遠征あたり3個で固定になり（以前はこの検査が一戦ごとに
    // 報酬で補給1を取る前提で、遠征を通して最大11個まで使えた）、野営治療で
    // 戻せる量が減った。到達は第6戦のままだが、終わり方が時間切れから全滅へ
    // 変わった。**守る構成は測定区間の頭で止まる**という読みは変わらない。
    through: Object.freeze({ reaches: 6, ends: "wipe" }),
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
      // **止め続けるだけでは幕3を抜けない。**第10戦だけで敵の総HPは1632ある。
      // 守る構成にも「誰が削るのか」を決めた上で、止めた拍をその人へ渡す。
      // 削るのはナギ（技術30）の溜め突き——技術×5.5で、準備1回を挟んで165出る。
      // 前が保っているあいだだけ溜められる、という依存がそのまま構成の形になる。
      // 盾の列（強すぎると言われた側）はヒバナの主軸として通しに乗せる。
      // 回復量を固定し隊全体で上限を共有した後も、守り構成の看護を一人へ寄せないため、
      // ゲンゾウにも baseline の手当てを持たせる。
      // **前提 Lv の道**は最初の二手（傷へ盾を Lv3 → 長く守る）に残してある。
      Object.freeze({ before: 2, characterId: "guardian", skillId: "brace_for_impact" }),
      Object.freeze({ before: 3, characterId: "guardian", skillId: "bulwark_of_will" }),
      Object.freeze({ before: 4, characterId: "guardian", skillId: "shield_wall" }),
      Object.freeze({ before: 5, characterId: "guardian", skillId: "bracing_thrust" }),
      Object.freeze({ before: 5, characterId: "guardian", level: "shield_wall" }),
      Object.freeze({ before: 6, characterId: "guardian", level: "bracing_thrust" }),
      Object.freeze({ before: 7, characterId: "guardian", level: "shield_wall" }),
      Object.freeze({ before: 8, characterId: "guardian", level: "bracing_thrust" }),
      Object.freeze({ before: 9, characterId: "guardian", level: "shield_wall" }),
      Object.freeze({ before: 9, characterId: "guardian", level: "bracing_thrust" }),
      Object.freeze({ before: 10, characterId: "guardian", level: "shield_wall" }),
      Object.freeze({ before: 11, characterId: "guardian", level: "bracing_thrust" }),
      Object.freeze({ before: 12, characterId: "guardian", level: "shield_wall" }),
      Object.freeze({ before: 2, characterId: "lancer", skillId: "guard_the_marked" }),
      Object.freeze({ before: 3, characterId: "lancer", level: "heavy_swing" }),
      Object.freeze({ before: 4, characterId: "lancer", level: "heavy_swing" }),
      Object.freeze({ before: 5, characterId: "lancer", level: "heavy_swing" }),
      Object.freeze({ before: 5, characterId: "lancer", level: "heavy_swing" }),
      Object.freeze({ before: 6, characterId: "lancer", level: "heavy_swing" }),
      Object.freeze({ before: 7, characterId: "lancer", level: "heavy_swing" }),
      Object.freeze({ before: 8, characterId: "lancer", level: "heavy_swing" }),
      Object.freeze({ before: 9, characterId: "lancer", level: "heavy_swing" }),
      Object.freeze({ before: 9, characterId: "lancer", level: "heavy_swing" }),
      Object.freeze({ before: 10, characterId: "lancer", level: "brace_after_hit" }),
      Object.freeze({ before: 11, characterId: "lancer", level: "brace_after_hit" }),
      Object.freeze({ before: 12, characterId: "lancer", level: "brace_after_hit" }),
      Object.freeze({ before: 2, characterId: "mender", level: "shield_the_wounded" }),
      Object.freeze({ before: 3, characterId: "mender", level: "shield_the_wounded" }),
      Object.freeze({ before: 4, characterId: "mender", skillId: "sustaining_ward" }),
      Object.freeze({ before: 5, characterId: "mender", skillId: "field_dressing" }),
      Object.freeze({ before: 5, characterId: "mender", level: "sustaining_ward" }),
      Object.freeze({ before: 6, characterId: "mender", level: "field_dressing" }),
      Object.freeze({ before: 7, characterId: "mender", level: "aimed_shot" }),
      Object.freeze({ before: 8, characterId: "mender", level: "sustaining_ward" }),
      Object.freeze({ before: 9, characterId: "mender", level: "field_dressing" }),
      Object.freeze({ before: 9, characterId: "mender", level: "aimed_shot" }),
      Object.freeze({ before: 10, characterId: "mender", level: "sustaining_ward" }),
      Object.freeze({ before: 11, characterId: "mender", level: "aimed_shot" }),
      Object.freeze({ before: 12, characterId: "mender", level: "triage" }),
      Object.freeze({ before: 2, characterId: "tactician", skillId: "foundation_guard" }),
      Object.freeze({ before: 3, characterId: "tactician", skillId: "opening_guard" }),
      Object.freeze({ before: 4, characterId: "tactician", skillId: "aimed_shot" }),
      Object.freeze({ before: 5, characterId: "tactician", skillId: "ward_ally" }),
      Object.freeze({ before: 5, characterId: "tactician", level: "aimed_shot" }),
      Object.freeze({ before: 6, characterId: "tactician", level: "aimed_shot" }),
      Object.freeze({ before: 7, characterId: "tactician", level: "aimed_shot" }),
      Object.freeze({ before: 8, characterId: "tactician", level: "aimed_shot" }),
      Object.freeze({ before: 9, characterId: "tactician", level: "aimed_shot" }),
      Object.freeze({ before: 9, characterId: "tactician", level: "aimed_shot" }),
      Object.freeze({ before: 10, characterId: "tactician", level: "aimed_shot" }),
      Object.freeze({ before: 11, characterId: "tactician", level: "aimed_shot" }),
      Object.freeze({ before: 12, characterId: "tactician", level: "aimed_shot" }),
      Object.freeze({ before: 2, characterId: "warden", skillId: "spread_the_guard" }),
      Object.freeze({ before: 3, characterId: "warden", skillId: "brace_for_impact" }),
      Object.freeze({ before: 4, characterId: "warden", skillId: "bulwark_of_will" }),
      Object.freeze({ before: 5, characterId: "warden", skillId: "bracing_thrust" }),
      Object.freeze({ before: 5, characterId: "warden", level: "bracing_thrust" }),
      Object.freeze({ before: 6, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 7, characterId: "warden", level: "bracing_thrust" }),
      Object.freeze({ before: 8, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 9, characterId: "warden", level: "bracing_thrust" }),
      Object.freeze({ before: 9, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 10, characterId: "warden", level: "bracing_thrust" }),
      Object.freeze({ before: 11, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 12, characterId: "warden", level: "bracing_thrust" }),
    ]),
    tactics: Object.freeze({
      warden: ["bracing_thrust", "steady_cut"],
      mender: ["sustaining_ward", "field_dressing", "shield_the_wounded", "aimed_shot"],
      lancer: ["heavy_swing"],
      guardian: ["shield_wall", "bracing_thrust", "brace_for_impact"],
      tactician: ["ward_ally", "aimed_shot", "spread_the_guard", "relay_order"],
    }),
    reactives: Object.freeze({
      warden: ["mend"],
      mender: ["triage", "emergency_treatment"],
      lancer: ["barrier_stitch", "guard_the_marked", "last_stand", "cover_ally", "shield_handoff"],
      guardian: ["block_focus", "absorb_shock", "brace_after_hit", "scavenge_ap"],
      tactician: ["counterweight", "wall_reader", "block_focus", "absorb_shock", "brace_after_hit", "mend"],
    }),
  }),
  Object.freeze({
    id: "tempo",
    displayName: "順番を作る",
    through: Object.freeze({ reaches: 12, ends: "cleared" }),
    question: "遅い一撃に、どうやって手番を通すか",
    engine: Object.freeze({
      source: "行動権と準備（resource_gained / preparation_*）",
      converter: "号令と背を押すが手番を渡し、急かすが準備を一段進める",
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
      // **渡す手番を増やしても手数は増えない。**増やせるのは一撃の質と、準備が
      // 完成するまでの速さである。溜めるのは技術52のツグミひとり。
      // ゲンゾウは**急かす**（効果に対して前提が重いと言われた側）まで7点かけて
      // 伸ばす。急かすは準備を一段進めるので、**溜める人が居る構成でしか効かない。**
      // ヒバナは行動点2なので、号令（強すぎると言われた側）を渡してもまだ殴れる。
      Object.freeze({ before: 2, characterId: "mender", skillId: "steady_cut" }),
      Object.freeze({ before: 3, characterId: "mender", skillId: "heavy_swing" }),
      Object.freeze({ before: 4, characterId: "mender", skillId: "foundation_focus" }),
      Object.freeze({ before: 5, characterId: "mender", level: "heavy_swing" }),
      Object.freeze({ before: 5, characterId: "mender", level: "heavy_swing" }),
      Object.freeze({ before: 6, characterId: "mender", level: "heavy_swing" }),
      Object.freeze({ before: 7, characterId: "mender", level: "heavy_swing" }),
      Object.freeze({ before: 8, characterId: "mender", level: "heavy_swing" }),
      Object.freeze({ before: 9, characterId: "mender", level: "heavy_swing" }),
      Object.freeze({ before: 9, characterId: "mender", level: "heavy_swing" }),
      Object.freeze({ before: 10, characterId: "mender", level: "heavy_swing" }),
      Object.freeze({ before: 11, characterId: "mender", level: "heavy_swing" }),
      Object.freeze({ before: 12, characterId: "mender", level: "steady_cut" }),
      Object.freeze({ before: 2, characterId: "tactician", skillId: "hasten_ally" }),
      Object.freeze({ before: 3, characterId: "tactician", skillId: "foundation_ap" }),
      Object.freeze({ before: 4, characterId: "tactician", skillId: "triage" }),
      Object.freeze({ before: 5, characterId: "tactician", skillId: "watchful_care" }),
      Object.freeze({ before: 5, characterId: "tactician", skillId: "overflow_care" }),
      Object.freeze({ before: 6, characterId: "tactician", skillId: "triage_relay" }),
      Object.freeze({ before: 7, characterId: "tactician", skillId: "second_wind" }),
      Object.freeze({ before: 8, characterId: "tactician", skillId: "shared_pain" }),
      Object.freeze({ before: 9, characterId: "tactician", skillId: "urging" }),
      Object.freeze({ before: 9, characterId: "tactician", level: "triage" }),
      Object.freeze({ before: 10, characterId: "tactician", level: "triage" }),
      Object.freeze({ before: 11, characterId: "tactician", level: "triage" }),
      Object.freeze({ before: 12, characterId: "tactician", level: "triage" }),
      Object.freeze({ before: 2, characterId: "lancer", skillId: "long_swing" }),
      Object.freeze({ before: 3, characterId: "lancer", skillId: "hunt_the_slow" }),
      Object.freeze({ before: 4, characterId: "lancer", level: "hunt_the_slow" }),
      Object.freeze({ before: 5, characterId: "lancer", level: "rear_hunt" }),
      Object.freeze({ before: 5, characterId: "lancer", level: "hunt_the_slow" }),
      Object.freeze({ before: 6, characterId: "lancer", level: "rear_hunt" }),
      Object.freeze({ before: 7, characterId: "lancer", level: "hunt_the_slow" }),
      Object.freeze({ before: 8, characterId: "lancer", level: "rear_hunt" }),
      Object.freeze({ before: 9, characterId: "lancer", level: "hunt_the_slow" }),
      Object.freeze({ before: 9, characterId: "lancer", level: "rear_hunt" }),
      Object.freeze({ before: 10, characterId: "lancer", level: "hunt_the_slow" }),
      Object.freeze({ before: 11, characterId: "lancer", level: "rear_hunt" }),
      Object.freeze({ before: 12, characterId: "lancer", level: "hunt_the_slow" }),
      Object.freeze({ before: 2, characterId: "guardian", skillId: "rally_line" }),
      Object.freeze({ before: 3, characterId: "guardian", skillId: "relay_order" }),
      Object.freeze({ before: 4, characterId: "guardian", skillId: "drag_forward" }),
      Object.freeze({ before: 5, characterId: "guardian", level: "column_thrust" }),
      Object.freeze({ before: 5, characterId: "guardian", level: "column_thrust" }),
      Object.freeze({ before: 6, characterId: "guardian", level: "column_thrust" }),
      Object.freeze({ before: 7, characterId: "guardian", level: "column_thrust" }),
      Object.freeze({ before: 8, characterId: "guardian", level: "column_thrust" }),
      Object.freeze({ before: 9, characterId: "guardian", level: "column_thrust" }),
      Object.freeze({ before: 9, characterId: "guardian", level: "column_thrust" }),
      Object.freeze({ before: 10, characterId: "guardian", level: "column_thrust" }),
      Object.freeze({ before: 11, characterId: "guardian", level: "column_thrust" }),
      Object.freeze({ before: 12, characterId: "guardian", skillId: "foundation_might" }),
      Object.freeze({ before: 2, characterId: "warden", skillId: "foundation_might" }),
      Object.freeze({ before: 3, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 4, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 5, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 5, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 6, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 7, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 8, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 9, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 9, characterId: "warden", level: "steady_cut" }),
      Object.freeze({ before: 10, characterId: "warden", skillId: "first_blood" }),
      // PR #255 — **研ぎ澄ます（倒した拍で集中）をここから外した。**補給が
      // 遠征あたり3個で固定になって第10〜12戦の展開が変わり、この構成のゴウは
      // 止めを刺さなくなった（主砲はツグミの大溜めとナギ）。鳴らない節に点を
      // 払わせないため、ゴウの残りの点は前列で実際に鳴っている手当て（mend）へ回す。
      Object.freeze({ before: 11, characterId: "warden", level: "mend" }),
      Object.freeze({ before: 12, characterId: "warden", skillId: "foundation_vitality" }),
    ]),
    // **溜めは1回まで。**大溜め（準備3回）は行動権を4つ食うので、渡す側が毎ラウンド
    // 手番を捨てても間に合わない。渡した行動権で「準備1回の大技を毎ラウンド完成させる」
    // ところに利得を置く。
    tactics: Object.freeze({
      warden: ["steady_cut"],
      mender: ["heavy_swing"],
      // 準備狩りは条件つきで、溜めている敵が居る拍だけに出る。
      lancer: ["hunt_the_slow", "rear_hunt"],
      guardian: ["relay_order", "drag_forward", "rally_line", "column_thrust"],
      tactician: ["hasten_ally", "relay_order"],
    }),
    reactives: Object.freeze({
      warden: ["mend"],
      mender: ["triage", "emergency_treatment"],
      lancer: ["triage", "cover_ally"],
      guardian: ["scavenge_ap", "brace_after_hit"],
      // **痛みを分けるは装着しない。**発動ごとにHPを30払うので、急かすへの
      // 通り道として買うだけにする（通り道は目的地ではない）。
      tactician: ["urging", "second_wind", "triage_relay", "overflow_care",
        "watchful_care", "triage", "patient_step", "scavenge_ap"],
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

// **名指しされた技能の実測**（issue #230 の item 4）。三構成の通しをまとめて数える。
const yields = new Map();

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
  const fired = new Set();
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
      // **名指しされた技能の実測**（issue #230 の判定対象）。強い・弱いの印象を、
      // 「何回鳴って、何を出したか」に置き換える。反応は rule id で出るので両方見る。
      const source = event.skillId ?? event.ruleId ?? null;
      if (!source) continue;
      const tally = yields.get(source) ?? { types: new Map(), amount: 0 };
      tally.types.set(event.type, (tally.types.get(event.type) ?? 0) + 1);
      if (["damage_taken", "healing_applied", "barrier_gained", "resource_gained",
        "preparation_advanced", "status_added"].includes(event.type)) {
        tally.amount += Number(event.values?.amount ?? event.values?.stacks ?? 1);
      }
      yields.set(source, tally);
    }
    // **買った節が実際に鳴ったか。**技能は skillId、反応と常設は ruleId で数える。
    for (const event of result.events) {
      if (event.skillId) fired.add(event.skillId);
      if (event.ruleId) fired.add("rule:" + event.ruleId);
    }
    // **余白。**勝ったかどうかだけでは「楽勝だった」と「あと一撃だった」が同じ形で
    // 残る。issue #230 はその差を測るためにあるので、隊の残HP・使った round・
    // まだ使っていない技能点・手元の補給を、その戦闘の行として持つ。
    // **与えた／受けた量。**どちらが足りないのかを、勝敗とラウンド数だけでは
    // 切り分けられない（間に合わなかったのか、保たなかったのか）。
    let dealt = 0;
    let taken = 0;
    for (const event of result.events) {
      if (event.type !== "damage_taken") continue;
      const amount = Number(event.values?.amount ?? 0);
      if ((event.targetActorIds ?? []).some((id) => String(id).startsWith("a_"))) taken += amount;
      else dealt += amount;
    }
    const partyHp = ROSTER.reduce((total, id) => {
      const actor = result.actors.find((entry) => entry.instanceId === "a_" + id);
      return total + Math.max(0, actor?.hp ?? 0);
    }, 0);
    const down = ROSTER.filter((id) => {
      const actor = result.actors.find((entry) => entry.instanceId === "a_" + id);
      return (actor?.hp ?? 0) <= 0;
    });
    rows.push({
      index,
      result: result.result,
      rounds: result.roundsUsed,
      maxRounds: expeditionEncounter(index).maxRounds,
      hpBps: Math.round((partyHp * 10_000) / PARTY_MAX_HP),
      dealt,
      taken,
      down: down.length,
      unspent: Math.max(...ROSTER.map((id) => snapshot.budget - snapshot.spent[id])),
      supplies: run.supplies ?? 0,
      kinds,
      skills,
    });
    if (process.env.STAGE_BUILDS_DUMP) {
      const hp = result.actors.filter((a) => a.instanceId.startsWith("a_"))
        .map((a) => `${a.instanceId.slice(2)} ${a.hp}/${a.maxHp}`).join(" ");
      console.log(` [${build.id}] e${index} ${result.result} R${result.roundsUsed}`
        + ` 与${dealt} 受${taken} 補給${run.supplies ?? 0}`
        + ` 余り[${ROSTER.map((id) => snapshot.budget - snapshot.spent[id]).join(",")}] ${hp}`);
    }
    const committed = commitBattleResult(profile, run, index, result);
    run = committed.run;
    if (result.result !== "win") break;
    run = restBetweenBattles(run, profile, rows[rows.length - 1]);
  }
  rows.fired = fired;
  return rows;
}

// ---------------------------------------------------------------- 戦闘のあいだ
//
// **通しで測るなら、戦闘と戦闘のあいだも本編と同じ形で通さなければならない。**
// 第6戦までの測定では要らなかったが、遠征のHPは持ち越しで、戻す手段は三つしかない。
//
//   1. 第4戦・第8戦の幕ボスに勝った後の全回復（`isActBossFullHealIndex`）
//   2. 手持ちの補給を野営治療に使う（`campTreat`）
//   3. 戦闘中の回復技能
//
// PR #255 — **補給は遠征の開始時に固定される**ようになった（既定3・報酬では
// 増えない）。以前ここは「報酬を毎回補給1にする」と宣言して一戦ごとに足していたが、
// それはもう本編に無い経路なので、遠征を通して3つだけを配る形へ直した。装備は
// 取らない（作者試遊が装備 0/10 で第12戦まで行った条件の再現。装備の効き方は
// 下の代表装備の節で別に見る）。**回復の余白は遠征で合計3回**で、これが
// 「どこで使うか」という本編と同じ有限の判断になる。
//
// 使い方も宣言しておく。**倒れている味方から順に蘇生し、それが済んでから、
// 割合で一番深く傷ついた味方が半分を切っていれば集中治療する。**構成ごとに
// 変えない（変えると、構成の差なのか看護の差なのかが分からなくなる）。
const REVIVE_THRESHOLD_BPS = 7_000;
function restBetweenBattles(run, profile, row) {
  let next = run;
  for (const characterId of run.roster) {
    if ((next.supplies ?? 0) < 1) break;
    if ((next.currentHp?.[characterId] ?? 0) > 0) continue;
    const treated = campTreat(next, profile, "revive", [characterId]);
    if (treated.ok) next = treated.run;
  }
  while ((next.supplies ?? 0) >= 1) {
    const worst = [...run.roster]
      .filter((id) => (next.currentHp?.[id] ?? 0) > 0)
      .sort((a, b) => hpBpsOf(next, a) - hpBpsOf(next, b))[0];
    if (!worst || hpBpsOf(next, worst) >= REVIVE_THRESHOLD_BPS) break;
    const treated = campTreat(next, profile, "concentrated", [worst]);
    if (!treated.ok) break;
    next = treated.run;
  }
  row.suppliesAfterRest = next.supplies ?? 0;
  return next;
}

function hpBpsOf(run, characterId) {
  const maxHp = CHARACTER_STATS[characterId]?.maxHp ?? 1;
  return Math.round(((run.currentHp?.[characterId] ?? 0) * 10_000) / maxHp);
}

const PARTY_MAX_HP = ROSTER.reduce((total, id) => total + (CHARACTER_STATS[id]?.maxHp ?? 0), 0);

// ---------------------------------------------------------------- 買ったのに鳴らない節
//
// **点を払わせておいて何も返さない節は、罠である**（content/skill-levels.mjs が
// レベルについて同じことを言っている）。取得計画に書いた節は、6戦のあいだに一度は
// 鳴らなければならない。
//
// 実例：「余りを溜める」は `resource_unused`（行動権）を読むが、engine のフェーズは
// 「使える行動がある限り回る」うえ通常攻撃が常に出せるので、**行動権が余る局面が
// 構造的に起きない**。宣言だけを見ていると気づけないので、走らせて数える。
//
// 能力値だけを動かす常設（rule を持たない foundation_focus 等）は event を出さないので、
// ここでは鳴ったものとして扱う。**effect が rule で書かれている節だけ**を見る。
function silentPurchases(build, rows) {
  const silent = [];
  // 敗北で通しが途中終了した場合、まだ買っていない将来の手は判定しない。
  // その手を「買ったのに鳴らない」と数えると、未到達区間を死に技と誤認する。
  const lastEncounter = rows.at(-1)?.index;
  // **通り道は目的地ではない。**前提として通っただけの節は、その先の節が鳴って
  // いれば「使われた」と数える。そうしないと、前提を鳴らすためだけに装着を増やす
  // ことになり、順送りの `chooseTactic` では主砲の出番がそのぶん減る——
  // **検査が、弱い構成を作る方向へ圧力をかけてしまう。**
  // **人物ごとに数える。**同じ節でも、別の人物にとっては通り道でしかない。
  const key = (characterId, skillId) => `${characterId}/${skillId}`;
  const purchased = new Set(build.plan.filter((step) => step.skillId)
    .map((step) => key(step.characterId, step.skillId)));
  const leveled = new Set(build.plan.filter((step) => step.level)
    .map((step) => key(step.characterId, step.level)));
  const steppingStones = new Set();
  for (const step of build.plan) {
    if (!step.skillId) continue;
    for (const required of nodeBySkill[step.skillId]?.requires ?? []) {
      if (purchased.has(key(step.characterId, required.skillId))) {
        steppingStones.add(key(step.characterId, required.skillId));
      }
    }
  }
  for (const step of build.plan) {
    if (lastEncounter !== undefined && step.before > lastEncounter) continue;
    const skillId = step.skillId ?? step.level;
    // レベルを上げた節は「使うつもり」なので、通り道の免除を受けない。
    if (step.skillId && steppingStones.has(key(step.characterId, skillId))
      && !leveled.has(key(step.characterId, skillId))) continue;
    const definition = PLAYABLE_CONTENT.activeSkills?.[skillId]
      ?? PLAYABLE_CONTENT.reactiveSkills?.[skillId]
      ?? PLAYABLE_CONTENT.passiveSkills?.[skillId];
    if (!definition) continue;
    const ruleId = definition.rule?.id ?? null;
    if (!ruleId && !PLAYABLE_CONTENT.activeSkills?.[skillId]) continue; // 能力値だけの常設
    const rang = ruleId ? rows.fired.has("rule:" + ruleId) : rows.fired.has(skillId);
    if (!rang) silent.push(`第${step.before}戦前に ${step.characterId} が取る ${skillId}`);
  }
  return silent;
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
const margins = new Map();

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
  for (const line of silentPurchases(build, rows)) {
    const lastEncounter = rows.at(-1)?.index ?? LAST_ENCOUNTER;
    problems.push(`${at}: ${line} は、第${lastEncounter}戦までに一度も鳴らない`
      + "（点を払わせて何も返さない節を構成の核にしない）");
  }
  // ---- 通し（issue #230）
  //
  // **#176 の関門は第6戦で閉じる。**そこまでは「紙の上だけの構成を残さない」を
  // そのまま守る。第7戦から先は**測るための区間**であって、勝てないこと自体は
  // 失敗ではない——失敗は「前に測った値と違うのに、誰も理由を書いていない」ことである。
  const wins = rows.filter((row) => row.result === "win");
  const reached = wins.length;
  const last = rows[rows.length - 1];
  const ends = last.result === "win"
    ? (reached >= LAST_ENCOUNTER ? "cleared" : "short")
    : (last.rounds >= last.maxRounds ? "round_limit" : "wipe");
  if (reached < CORE_GATE_LAST) {
    problems.push(`${at}: 第${reached + 1}戦で ${last.result}。`
      + `**核の関門（第${CORE_GATE_LAST}戦）まで届いていない**ので、紙の上だけの構成である`);
  }
  if (reached !== build.through.reaches || ends !== build.through.ends) {
    problems.push(`${at}: 通しの実測が記録と違う（記録 第${build.through.reaches}戦・${build.through.ends}`
      + ` → 実測 第${reached}戦・${ends}）。`
      + "**数値か構成を動かしたなら through を更新し、その差分の理由を PR に書く**"
      + "（AGENTS.md「差分を見ずに更新しない」）");
  }
  const margin = {
    reached,
    ends,
    rounds: wins.reduce((total, row) => total + row.rounds, 0),
    minHpBps: wins.length ? Math.min(...wins.map((row) => row.hpBps)) : 0,
    // その戦闘に持ち込んだ手持ち。完走した戦闘の後の補給は数えない。
    supplies: last.supplies,
    unspent: last.unspent,
  };
  margins.set(build.id, margin);
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
  // 買ったのに鳴らない節を、実際に検出できることを確かめる。
  {
    const rows = [];
    rows.fired = new Set(["rule:foundation_ap_rule"]);
    const probe = { ...BUILDS[0], plan: [
      { before: 2, characterId: "tactician", skillId: "foundation_ap" },
      { before: 3, characterId: "tactician", skillId: "held_breath" },
    ] };
    const silent = silentPurchases(probe, rows);
    if (silent.length !== 1 || !silent[0].includes("held_breath")) {
      console.error("ecology-stage3-builds: 参照点が壊れている（鳴らない節を検出できない）");
      process.exit(1);
    }
  }

  // 通り道の免除が**人物ごと**であることを確かめる。ゴウの前提として通っただけの
  // 節は免除され、同じ節をレベルまで上げているナギのぶんは免除されない。
  {
    const rows = [];
    rows.fired = new Set();
    const probe = { ...BUILDS[0], plan: [
      { before: 2, characterId: "warden", skillId: "steady_cut" },
      { before: 3, characterId: "warden", skillId: "pierce_thrust" },
      { before: 4, characterId: "lancer", skillId: "steady_cut" },
      { before: 5, characterId: "lancer", level: "steady_cut" },
    ] };
    const silent = silentPurchases(probe, rows);
    const mentionsWardenStone = silent.some((line) => line.includes("warden") && line.includes("steady_cut"));
    const mentionsLancerLeveled = silent.some((line) => line.includes("lancer") && line.includes("steady_cut"));
    if (mentionsWardenStone || !mentionsLancerLeveled) {
      console.error("ecology-stage3-builds: 参照点が壊れている（通り道の免除が人物ごとになっていない）");
      process.exit(1);
    }
  }

  // 戦闘のあいだの看護が実際に効くことを確かめる。**倒れた味方が戻る。**
  {
    const profile = newProfile();
    const run = {
      ...newRun(profile, {
        campaignStageSequence: STAGE.sequence, runSeed: SEED, runId: SEED, roster: ROSTER,
      }),
      currentHp: { ...Object.fromEntries(ROSTER.map((id) => [id, CHARACTER_STATS[id].maxHp])), mender: 0 },
    };
    const rested = restBetweenBattles(run, profile, {});
    if ((rested.currentHp.mender ?? 0) <= 0) {
      console.error("ecology-stage3-builds: 参照点が壊れている（倒れた味方が野営で戻らない）");
      process.exit(1);
    }
    if ((rested.supplies ?? 0) !== 0) {
      console.error("ecology-stage3-builds: 参照点が壊れている（蘇生に補給を払っていない）");
      process.exit(1);
    }
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

// ---------------------------------------------------------------- 名指しされた技能（issue #230）
//
// **試遊の「強い／弱い」を、通しの実測へ置き換える。**PR #186 の作者試遊で名前が
// 挙がったのは、強い側が 号令・急かす・盾の列、弱い側が 隙を刻む・意趣返し。
// ここでは三構成の通しをまとめて、**何回鳴って、何を出したか**だけを出す。
// 判定（直すかどうか、どこで直すか）はこの数字を見て #150 / #189 / #128 で行う。
const NAMED_SKILLS = Object.freeze([
  Object.freeze({ id: "relay_order", label: "号令", unit: "行動権" }),
  Object.freeze({ id: "urging", ruleId: "urging_rule", label: "急かす", unit: "準備" }),
  Object.freeze({ id: "shield_wall", label: "盾の列", unit: "防壁" }),
  Object.freeze({ id: "mark_target", label: "隙を刻む", unit: "隙" }),
  Object.freeze({ id: "vengeful_step", ruleId: "vengeful_step_rule", label: "意趣返し", unit: "damage" }),
]);
// **一発火を一回として数える。**行動は宣言（`action_declared`）が一回、
// 反応は反応点の支払い（`resource_spent`）が一回に当たる。
const namedReport = NAMED_SKILLS.map((named) => {
  const tally = yields.get(named.ruleId ?? named.id) ?? { types: new Map(), amount: 0 };
  const fires = named.ruleId
    ? (tally.types.get("resource_spent") ?? 0)
    : (tally.types.get("action_declared") ?? 0);
  return `${named.label} ${fires}回・${named.unit}${tally.amount}`;
});
// 「灰の核心」は技能ではなく最終戦の敵である。到達した構成の第12戦を出す。
const finalRows = BUILDS.map((build) => played.get(build.id).find((row) => row.index === 12))
  .filter(Boolean);
console.log(
  `ecology-stage3-builds 名指しの実測（三構成の通し合計）: ${namedReport.join(" / ")}`
  + `。灰の核心（第12戦）へ届いたのは ${finalRows.length}構成で、`
  + (finalRows.length
    ? finalRows.map((row) => `${row.rounds}/${row.maxRounds}ラウンド・与${row.dealt}・受${row.taken}`).join("・")
    : "実測なし"),
);

// ---------------------------------------------------------------- 通しの余白（issue #230）
//
// **勝敗だけでは、楽勝と辛勝が同じ形で残る。**遠征12戦を通したときに、
// どれだけの余白（隊のHP・手元の補給・使っていない技能点）を残して終わるかを出す。
// 上端（余白が大きすぎる＝易しすぎ）も下端（届かない）も、ここを読めば言える。
//
// 条件は作者試遊と同じ**装備なし**で、報酬は毎回「補給1」を取り、倒れた味方から
// 順に蘇生、生存者が7割を切ったら集中治療、というひとつの看護方針で揃えてある。
const CEILING_MIN_HP_BPS = 6_000;
const CEILING_SUPPLIES = 3;
const ENDS_TEXT = Object.freeze({
  cleared: "完走", short: "途中で測定終了", round_limit: "時間切れ", wipe: "全滅",
});
const marginReport = BUILDS.map((build) => {
  const margin = margins.get(build.id);
  return `${build.displayName} 第${margin.reached}/${LAST_ENCOUNTER}戦（${ENDS_TEXT[margin.ends]}）`
    + `・${margin.rounds}ラウンド・最小HP${Math.round(margin.minHpBps / 100)}%`
    + `・残り補給${margin.supplies}・未使用${margin.unspent}点`;
});
const tooEasy = BUILDS.filter((build) => {
  const margin = margins.get(build.id);
  return margin.ends === "cleared" && margin.minHpBps >= CEILING_MIN_HP_BPS
    && margin.supplies >= CEILING_SUPPLIES;
});
console.log(
  `ecology-stage3-builds 通しの余白: ${marginReport.join(" / ")}`
  + `。上端の目安は「完走して最小HP${CEILING_MIN_HP_BPS / 100}%以上・補給${CEILING_SUPPLIES}以上が残る」で、`
  + (tooEasy.length
    ? `いま ${tooEasy.map((build) => build.displayName).join("・")} がそこに入っている（易しすぎる側）`
    : "いまそこに入る構成は無い")
  + `。下端の目安は第${LAST_ENCOUNTER}戦の完走で、届いていないのは `
  + (BUILDS.filter((build) => margins.get(build.id).ends !== "cleared")
    .map((build) => `${build.displayName}（第${margins.get(build.id).reached}戦）`).join("・") || "無い"),
);
