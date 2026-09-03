// ecology/content/world-lore.mjs
//
// **世界観設定の正本。**地域、敵、根城に関する観察・説明文を
// 戦闘や進行のロジックから分離してここへ集約する。
//
// encounters.mjs / expedition.mjs / homestead.mjs は、構造・条件・
// ルールだけを持つ。設定本文を変更するときは、このファイルだけを編集する。
// ただし敵の噂・図鑑は、既存 content API の互換性を保つため encounters.mjs の
// 正本をここからまとめて参照する。

import { ENEMY_CODEX, ENEMY_LORE } from "./encounters.mjs";
export { ENEMY_CODEX, ENEMY_LORE };


export const REGION_LORE = Object.freeze({
  ash_frontier: Object.freeze({
    displayName: "灰の辺境",
    summary: "3幕12戦。4・8・12戦目にボスが立つ。",
    enemyFamilyText: "灰殻（husk）— 走者・後撃ち・守衛・狩人・反響体・盾兵・核",
  }),
});

const HOMESTEAD_FIXTURE_LORE_RAW = {
  house: {
    label: "直しかけの家",
    lines: [
    "灰の縁から二筋ぶん外れた廃屋。屋根の半分は元のままで、半分は拾ってきた板である。",
    "詰所からは遠い。遠いぶん、誰も見に来ない。",
  ],
  },
  ledger: {
    label: "帳簿と目録",
    lines: [
    "シキの帳簿。借りた器材、返した器材、残った借り。数字しか書いていない。",
    "同じ綴じの最後のほうに、拾った物の目録がある。",
  ],
  },
  records: {
    label: "体調の記録",
    lines: [
    "ナズナの記録帳。誰が何時間寝たか、何を食べたか、腕がどこまで上がるか。",
    "訊くと「観察です」と言う。訊かなければ何も言わない。",
  ],
  },
  hearth: {
    label: "朝の火",
    lines: [
    "一番先に起きた者が火を起こす決まりは無い。ただ、いつも同じ人が起こしている。",
    "カイは火の番が長い。座っていられないので、薪を割りに行ってしまう。",
  ],
  },
  shelf: {
    label: "棚",
    lines: [
    "スミが拾ってきた物が並んでいる。割れた把手、色の褪せた札、片方だけの留め金。",
    "並べ方に本人しか分からない規則がある。誰かが動かすと、黙って直す。",
    "棚は増えていく。今は三段ある。",
  ],
  },
  two_books: {
    label: "二冊の帳面",
    lines: [
    "レイの帳面は二冊ある。協会へ出す用と、自分用。",
    "厚いほうが自分用である。中身を見せてくれと言った者は、まだいない。",
  ],
  },
  gear_return: {
    label: "返す物の籠",
    lines: [
    "玄関の内側に、返す器材をまとめる籠がある。",
    "帰ったらまず籠、それから寝る。順番を間違えた者が一人だけいる。",
  ],
  },
  blueprint_wall: {
    label: "壁の写し",
    lines: [
    "拾った物の作りを写した紙が、壁に貼られていく。同じ物を二度拾えるとは限らないので、",
    "形のほうを残しておく。レイが言い出して、シキが場所を空けた。",
  ],
  },
  empty_seat: {
    label: "空いた席",
    lines: [
    "卓は六人ぶんある。拾ってきた椅子の数がたまたま六だっただけで、誰も理由を訊かない。",
    "一つは空いたままである。",
  ],
  },
};

export const HOMESTEAD_FIXTURE_LORE = Object.freeze(
  Object.fromEntries(
    Object.entries(HOMESTEAD_FIXTURE_LORE_RAW).map(([id, lore]) => [
      id,
      Object.freeze({
        label: lore.label,
        lines: Object.freeze([...lore.lines]),
      }),
    ]),
  ),
);

export const WORLD_LORE = Object.freeze({
  region: REGION_LORE,
  enemies: Object.freeze({ lore: ENEMY_LORE, codex: ENEMY_CODEX }),
  homestead: Object.freeze({ fixtures: HOMESTEAD_FIXTURE_LORE }),
});
