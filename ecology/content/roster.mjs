// ecology/content/roster.mjs
//
// **編成画面から見た仲間。役割、図像、既定位置、初期の技能。人物紹介本文は character-lore.mjs。**
// R7 Milestone 0 で playable-battles.mjs から分離した。**挙動は変えていない**
// （ecology/contract.test.mjs が分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 人物 担当だけ。engine・schema・共通registryは変更しない。
import { CHARACTER_LORE } from "./character-lore.mjs";
// R13 — 新5人（ゴウ／ツグミ／ナギ／ヒバナ／ゲンゾウ）へ差し替えた。**engine の id は
// 据え置きなので、id の語義と中身は一致しない**（`lancer` が受け役、`guardian` が遊撃役）。
// id は技能・pack・contract の対応を保つ鍵であって役割名ではない（characters.mjs 参照）。
//
// **初期技能は、その人物が加入する Stage で実際に引ける語彙だけで組む**
// （baseline ＋ その Stage までの pack core）。
//
//   Stage 0  baseline ＋ pack_care core   … ゴウ・ツグミ
//   Stage 1  ＋ pack_edge core            … ナギ
//   Stage 2  ＋ pack_wall core            … ヒバナ
//   Stage 3  ＋ pack_tempo core           … ゲンゾウ
//
// baseline の `strike` は **skill slot を消費せず必ず出る**（skills-active.mjs の
// coreStrike）ので、初期装着へ入れない。`bulwark` と `mend` は常に解禁済みだが、
// 装着すると枠を一つ使う。
//
// **技能は数値の傾きに合わせて選ぶ。**攻撃は might（武器）と focus（技）に分かれ
// （skills-active.mjs の TECHNIQUE_SKILL_IDS）、防壁と一部の反応も focus を読む
// （skills-reactive.mjs の REACTIVE_SCALING）。**読まない数値の技能を初期装着に
// 置かない。**置くと、枠を一つ潰した状態で遠征が始まる。
export const CHARACTER_DEFINITIONS = [
  {
    id: "warden",
    role: "強打",
    icon: "拳",
    defaultPosition: "front_left",
    summary: CHARACTER_LORE.warden.summary,
    // ゴウ … 腕力50・技術6。**技を持たない人。**
    // Stage 0 に腕力で読む技能は steady_cut しか無く、他（bulwark・aimed_shot・
    // shield_the_wounded）は全部 focus を読むので、**active は一本だけにしてある。**
    // 枠を埋めるより空けておくほうが強い。腕力の攻撃は `strike` が枠外で出る。
    starterTactics: ["steady_cut"],
    // 受けが1なので細かい攻撃が全部通る。**受けた瞬間に自分を繋ぎ、余った分は隣へ渡す。**
    // どちらも focus を読まない（回復は受けたダメージ比・R11 §4）。
    starterReactives: ["mend", "overflow_care"],
  },
  {
    id: "mender",
    role: "医術",
    icon: "手",
    defaultPosition: "rear_right",
    summary: CHARACTER_LORE.mender.summary,
    // ツグミ … 技術52。**隊の主火力かつ治療役。**aimed_shot は technique 攻撃なので
    // 後列からでも威力が落ちず、shield_the_wounded の防壁も同じ数値で伸びる。
    // HP110・受け2なので、前へ出すと本当に落ちる（序章がそれを教える）。
    starterTactics: ["aimed_shot", "shield_the_wounded"],
    // 応急手当は自分以外の味方だけを治す。後列から前衛を支えるため、自己回復は初期装備に置かない。
    starterReactives: ["triage"],
  },
  {
    id: "lancer",
    role: "庇護",
    icon: "盾",
    defaultPosition: "front_center",
    summary: CHARACTER_LORE.lancer.summary,
    // ナギ … 受け24・技術30。**guard は hit ごとの固定軽減なので、受けは装備せずに効く。**
    // だから active は攻めに使える。どちらも technique なので技術30で読む。
    starterTactics: ["heavy_swing", "rear_hunt"],
    // **止めた回数がそのまま仕事になる。**受けが高いほど damage_blocked が出るので、
    // shield_handoff が回り、止めるたびに一番弱い者へ盾が渡る。庇って、受けて、治す。
    starterReactives: ["shield_handoff", "triage"],
  },
  {
    id: "guardian",
    role: "遊撃",
    icon: "風",
    defaultPosition: "rear_center",
    summary: CHARACTER_LORE.guardian.summary,
    // ヒバナ … 行動権2。**一巡に二度動けるのはこの人だけで、意味は「往復できる」こと。**
    // reposition で入り、column_thrust で列を薙ぎ、また戻る。一撃は隊で最弱なので、
    // 位置替えそのものではなく、**寄せてから列で薙ぐ**ところに利得を置く。
    starterTactics: ["reposition", "column_thrust"],
    // HP120・受け3の紙なので、**踏み込んだ先で受けないための二本**にする。
    starterReactives: ["scavenge_ap", "brace_after_hit"],
  },
  {
    id: "tactician",
    role: "指揮",
    icon: "筆",
    defaultPosition: "rear_left",
    summary: CHARACTER_LORE.tactician.summary,
    // ゲンゾウ … 反応点4。**自分からは動かず、読んでから割り込む。**
    // 反応点が二つ多いので、一巡に何度も割り込める。patient_step は準備の完了を読んで
    // 行動権を拾い、block_focus は防いだ拍に集中を積む。どちらも「先に動かない」形。
    starterTactics: ["relay_order", "mark_target"],
    starterReactives: ["patient_step", "block_focus"],
  },
];
