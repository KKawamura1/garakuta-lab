// ecology/content/roster.mjs
//
// **編成画面から見た仲間。役割、図像、既定位置、初期の技能。**
// R7 Milestone 0 で playable-battles.mjs から分離した。**挙動は変えていない**
// （ecology/contract.test.mjs が分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 人物 担当だけ。engine・schema・共通registryは変更しない。

// R11 — 本編5人を作り直した。**初期技能は、その人物が加入する Stage で
// 実際に引ける語彙だけで組む**（baseline ＋ その Stage までの pack core）。
//
//   Stage 0  baseline ＋ pack_edge core   … シキ・カイ
//   Stage 1  ＋ pack_wall core            … スミ
//   Stage 2  ＋ pack_tempo core           … レイ
//   Stage 3  ＋ pack_care core（pack_edge は full）… ナズナ
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
    summary: "隊で一番倒れにくい。受けた痛みを、そのまま返す側へ回す。",
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
    summary: "隊の火力そのもの。受けは無いに等しく、長くは立てない。",
    // 貫いて仕留める。両方とも腕力を読む weapon 攻撃。
    starterTactics: ["pierce_thrust", "finishing_thrust"],
    starterReactives: ["counter_blow", "scavenge_ap"],
  },
  {
    id: "guardian",
    role: "庇護",
    icon: "庇",
    defaultPosition: "front_center",
    summary: "標的を引き受け、一撃ずつ削り取る。**攻撃の行動を持たない。**",
    // **攻め手を一つも持たせない。**受けが18あるので多段が通らず、
    // 腕力16なので殴っても意味がない。この人の仕事は受けることだけである。
    starterTactics: ["bulwark", "brace_for_impact"],
    starterReactives: ["cover_ally", "guard_step"],
  },
  {
    id: "tactician",
    role: "指揮",
    icon: "旗",
    defaultPosition: "rear_left",
    summary: "誰より速く動き、順番と準備を仲間へ渡す。自分では削らない。",
    // 速度11・反応3。**反応点が1つ多いので、一巡に二度割り込める。**
    starterTactics: ["relay_order", "mark_target"],
    starterReactives: ["urging", "ap_loop"],
  },
  {
    id: "mender",
    role: "治療",
    icon: "手",
    defaultPosition: "rear_right",
    summary: "傷の連鎖を止める。集中が高いので、技でも削れるし、厚い防壁も張れる。",
    // R11 — **支援役が攻撃に参加できるようになった最初の人。**
    // crack_mark は technique 攻撃（集中48で読む）、shield_the_wounded も集中。
    // どちらも同じ数値が伸ばす。
    starterTactics: ["aimed_shot", "shield_the_wounded"],
    starterReactives: ["triage", "emergency_treatment"],
  },
  // ---- 本編に出ない同業者。Free / Endless から引ける ----
  {
    id: "scout",
    role: "機動",
    icon: "目",
    defaultPosition: "rear_right",
    summary: "敵の準備を読み、位置を変えて前線を整える。",
    starterTactics: ["mark_target", "reposition"],
    starterReactives: ["guard_step", "urging"],
  },
  {
    id: "pivot",
    role: "蓄積",
    icon: "環",
    defaultPosition: "rear_left",
    summary: "行動権を2つ持つ。余った権利を防壁へ変え、長期戦を支える。",
    starterTactics: ["strike", "bulwark"],
    starterReactives: ["guard_step", "scavenge_ap"],
  },
  {
    id: "arcanist",
    role: "準備攻撃",
    icon: "灯",
    defaultPosition: "rear_right",
    summary: "時間のかかる大技を、後列から通す。集中が隊で最も高い。",
    // R11 — 溜め系は technique 攻撃（集中）へ移った。**この人の役割は
    // ここで初めて数値的に成立する**（従来は腕力16で溜めていた）。
    starterTactics: ["heavy_swing", "steady_aim"],
    starterReactives: ["urging", "prep_spiral"],
  },
];
