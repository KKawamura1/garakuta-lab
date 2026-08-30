// ecology/content/roster.mjs
//
// **編成画面から見た仲間。役割、図像、既定位置、初期の技能。**
// R7 Milestone 0 で playable-battles.mjs から分離した。**挙動は変えていない**
// （ecology/contract.test.mjs が分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 人物 担当だけ。engine・schema・共通registryは変更しない。

export const CHARACTER_DEFINITIONS = [
  {
    id: "warden",
    role: "守護",
    icon: "盾",
    defaultPosition: "front_left",
    summary: "被弾を受け止め、仲間が動く時間を作る。",
    starterTactics: ["bulwark", "strike"],
    starterReactives: ["brace_after_hit", "cover_ally"],
  },
  {
    id: "mender",
    role: "治療",
    icon: "手",
    defaultPosition: "rear_left",
    summary: "傷ついた仲間を立て直し、余った回復も無駄にしない。",
    starterTactics: ["mend", "triage"],
    starterReactives: ["overflow_care", "triage_relay"],
  },
  {
    id: "lancer",
    role: "攻撃",
    icon: "槍",
    defaultPosition: "front_right",
    summary: "弱った敵を仕留め、撃破から次の行動を引き出す。",
    starterTactics: ["strike", "heavy_swing"],
    starterReactives: ["scavenge_ap", "counter_blow"],
  },
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
    summary: "余った行動権を防壁に変え、長期戦を支える。",
    starterTactics: ["strike", "bulwark"],
    starterReactives: ["guard_step", "scavenge_ap"],
  },
  {
    id: "guardian",
    role: "庇護",
    icon: "庇",
    defaultPosition: "front_right",
    summary: "標的を引き受け、守りを攻撃へつなげる。",
    starterTactics: ["bulwark", "strike"],
    starterReactives: ["cover_ally", "brace_after_hit"],
  },
  {
    id: "arcanist",
    role: "準備攻撃",
    icon: "灯",
    defaultPosition: "rear_right",
    summary: "時間のかかる大技を、仲間の反応で完成させる。",
    starterTactics: ["heavy_swing", "steady_aim"],
    starterReactives: ["urging", "prep_spiral"],
  },
  {
    id: "tactician",
    role: "指揮",
    icon: "旗",
    defaultPosition: "rear_left",
    summary: "仲間へ行動権を渡し、遅い構成にも順番を作る。",
    starterTactics: ["relay_order", "mark_target"],
    starterReactives: ["guard_step", "triage_relay"],
  },
];
