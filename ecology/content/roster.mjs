// ecology/content/roster.mjs
//
// **編成画面から見た仲間。役割、図像、既定位置、初期の技能。人物紹介本文は character-lore.mjs。**
// R7 Milestone 0 で playable-battles.mjs から分離した。**挙動は変えていない**
// （ecology/contract.test.mjs が分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 人物 担当だけ。engine・schema・共通registryは変更しない。
import { CHARACTER_LORE } from "./character-lore.mjs";
// R11 — 本編5人を作り直した.**初期技能は、その人物が加入する Stage で
// 実際に引ける語彙だけで組む**（baseline ＋ その Stage までの pack core）。
//
//   Stage 0  baseline ＋ pack_care core   … シキ・ナズナ
//   Stage 1  ＋ pack_edge core            … カイ
//   Stage 2  ＋ pack_wall core            … スミ
//   Stage 3  ＋ pack_tempo core           … レイ
//
// **5人が別々の軸を持つ**ようにしてある（characters.mjs の CHARACTER_STATS 参照）。
// 特にシキとスミは、どちらも硬いが通る攻撃が違う。シキは HP が厚いので単発大威力に、
// スミは受けが高いので多段に強い。役割名もそこで分けている。
export const CHARACTER_DEFINITIONS = [
  {
    id: "warden",
    role: "重装",
    icon: "盾",
    defaultPosition: "front_left",
    summary: CHARACTER_LORE.warden.summary,
    // 受けて返す。counter_blow も whetted_by_pain も腕力を読むので、
    // **被弾がそのまま火力になる**。防壁は薄い（集中20）。
    starterTactics: ["steady_cut", "bulwark"],
    starterReactives: ["brace_after_hit", "mend"],
  },
  {
    id: "lancer",
    role: "攻撃",
    icon: "槍",
    defaultPosition: "front_right",
    summary: CHARACTER_LORE.lancer.summary,
    // 貫いて仕留める。両方とも腕力を読む weapon 攻撃。
    starterTactics: ["pierce_thrust", "finishing_thrust"],
    starterReactives: ["counter_blow", "scavenge_ap"],
  },
  {
    id: "guardian",
    role: "庇護",
    icon: "庇",
    defaultPosition: "front_center",
    summary: CHARACTER_LORE.guardian.summary,
    // **攻め手を一つも持たせない。**受けが26あるので多段が通らず、
    // 腕力16なので殴っても意味がない。この人の仕事は受けることだけである。
    starterTactics: ["bulwark", "brace_for_impact"],
    starterReactives: ["cover_ally", "guard_step"],
  },
  {
    id: "tactician",
    role: "指揮",
    icon: "旗",
    defaultPosition: "rear_left",
    summary: CHARACTER_LORE.tactician.summary,
    // 速度11・反応3。**反応点が1つ多いので、一巡に二度割り込める。**
    starterTactics: ["relay_order", "mark_target"],
    starterReactives: ["urging", "ap_loop"],
  },
  {
    id: "mender",
    role: "治療",
    icon: "手",
    defaultPosition: "rear_right",
    summary: CHARACTER_LORE.mender.summary,
    // R11 — **支援役が攻撃に参加できるようになった最初の人。**
    // aimed_shot は technique 攻撃（集中48で読む）、shield_the_wounded も集中。
    // どちらも同じ数値が伸ばす。
    starterTactics: ["aimed_shot", "shield_the_wounded"],
    starterReactives: ["triage", "emergency_treatment"],
  },
];
