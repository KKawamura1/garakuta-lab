// ecology/content/packs.mjs
//
// 装備packの正本。一遠征で引ける装備と affix family の分類だけを持つ。
// プレイヤー技能は weapon-trees.mjs / skill-packs.mjs が管理するため、
// このファイルに技能IDや技能レベルを置かない。

// pack が攻撃の主役を担えるかどうか。Campaign の manifest 検査が読む。
export const PACK_COMBAT_ROLES = Object.freeze([
  "primary_offense",
  "offensive_hybrid",
  "support",
]);

// R9 の Stage 表現に残る入口／全体の深さ。装備pack自身には技能の段階を
// 持たせず、campaign-stages.mjs が装備poolの導入順を表示するために使う。
export const PACK_DEPTHS = Object.freeze(["core", "full"]);

const EQUIPMENT_PACK_DEFINITIONS = [
  {
    id: "pack_edge",
    displayName: "刃と撃破",
    summary: "単発・多段・貫通で、受けの厚い相手をどう抜くかを問う。",
    combatRole: "primary_offense",
    tags: ["attack", "execute"],
  },
  {
    id: "pack_care",
    displayName: "構えと手当て",
    summary: "装備の防壁と手当てで、傷の連鎖を止める。",
    combatRole: "offensive_hybrid",
    tags: ["heal", "overflow"],
  },
  {
    id: "pack_wall",
    displayName: "防壁と隊列",
    summary: "誰が前に立つかと、隊列を読む装備を揃える。",
    combatRole: "offensive_hybrid",
    tags: ["barrier", "formation"],
  },
  {
    id: "pack_tempo",
    displayName: "行動権と準備",
    summary: "準備と順番を支える装備を揃える。",
    combatRole: "offensive_hybrid",
    tags: ["tempo", "preparation"],
  },
  {
    id: "pack_barrage",
    displayName: "連撃と刻印",
    summary: "多段と刻印に反応する装備を揃える。",
    combatRole: "primary_offense",
    tags: ["attack", "onhit", "mark"],
  },
  {
    id: "pack_relay",
    displayName: "余波と受け渡し",
    summary: "起きた出来事を別の役割へ渡す装備を揃える。",
    combatRole: "support",
    tags: ["relay", "handoff", "crosscut"],
  },
].map((pack) => Object.freeze({
  ...pack,
  tags: Object.freeze([...pack.tags]),
  kind: "equipment",
}));

export const EQUIPMENT_PACKS = Object.freeze(EQUIPMENT_PACK_DEFINITIONS);

export const EQUIPMENT_PACK_BY_ID = Object.freeze(
  Object.fromEntries(EQUIPMENT_PACKS.map((pack) => [pack.id, pack])),
);

// UIの「pack」表示は当面この別名を使えるようにする。ただし中身は装備pack
// のみで、技能packとの共有registryにはしない。
export const PACK_BY_ID = EQUIPMENT_PACK_BY_ID;
