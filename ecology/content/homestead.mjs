// ecology/content/homestead.mjs
//
// **根城。R11 §2.4 が「日常の場面と設定の厚みはここに置く」と言った場所である。**
//
// R11 §9.4 は「現行の Camp には日常会話の置き場がない」を引き継ぎの筆頭に置いたが、
// R12 では手を付けなかった（新しい表示面と新しい会話の両方が要るので、安いほうの
// 名簿を先に試した）。ここがその続きである。
//
// ---------------------------------------------------------------- なぜ画面を足すか
//
// One Battle Ahead の画面は、全部「灰の中」か「詰所（ギルド）」だった。**帰る場所が無い。**
// R11 §2.4 が書いた「廃屋を直した家。拾ってきたもので少しずつ増えていく」は、
// 五人の来歴の受け皿として設計されていたのに、どこからも見えていなかった。
//
// 根城は精算のあとに必ず通る。**遠征と遠征のあいだの、灰が出てこない一枚**である。
//
// ---------------------------------------------------------------- 二つの層
//
//   FIXTURES … 家にあるもの。**会話ではない。**進行に応じて増える。
//              世界樹の迷宮でいえばギルドの部屋、ドラクエでいえば宿と酒場の一言。
//   SCENES   … 日常の場面。一行送りの会話で、**一度だけ**出る。
//
// **場面は行数を絞らない。**R9 §7 の「1断片2〜6行」は Stage の断片（opening /
// join / stageEnd / 幕間）の縛りで、そこは学習順を壊さないための上限である。
// 根城は戦闘と学習の外にあるので、同じ上限を持ち込む理由が無い（作者判断で、
// R9 の上限に縛られないことにした）。**ヒバナとゲンゾウの薄さ（R12 §5.3）はここで埋める。**
//
// ---------------------------------------------------------------- 開き方
//
// 場面は「その時点で条件を満たしている、まだ見ていない最初のもの」を一つだけ出す。
// **ランダムに引かない。**同じ進行なら同じ順で同じ場面が出る（決定性）。
//
// ここは根城の構造・解禁条件・演出メタデータだけを持つ。会話本文は dialogue.mjs、
// 家にあるものの名前と説明は world-lore.mjs に集約する。

import { beat } from "./beat.mjs";
import { castFor, dialogueFor } from "./dialogue.mjs";
import { HOMESTEAD_FIXTURE_LORE } from "./world-lore.mjs";

// ---------------------------------------------------------------- 家にあるもの
//
// **拾い物の家である。**買った物はほとんど無い。requires を満たしたものだけ出す。
//
//   requires.clearedStage … その Stage を越えている
//   requires.met          … その人物が隊にいる
//   requires.blueprints   … 設計図の archive がその件数以上ある

const fixture = (id, requires = {}) => {
  const lore = HOMESTEAD_FIXTURE_LORE[id];
  if (!lore) throw new Error("homestead: 未登録の備品設定 " + id);
  return Object.freeze({
    id,
    label: lore.label,
    lines: lore.lines,
    requires: Object.freeze({
      clearedStage: requires.clearedStage ?? -1,
      met: Object.freeze([...(requires.met ?? [])]),
      blueprints: requires.blueprints ?? 0,
    }),
  });
};


export const HOMESTEAD_FIXTURES = Object.freeze([
  fixture("house"),
  fixture("ledger"),
  fixture("records", { clearedStage: 0 }),
  fixture("hearth", { met: ["lancer"] }),
  fixture("shelf", { met: ["guardian"] }),
  fixture("two_books", { met: ["tactician"] }),
  fixture("gear_return", { clearedStage: 0 }),
  fixture("blueprint_wall", { blueprints: 3 }),
  fixture("empty_seat", { clearedStage: 3 }),
]);

// ---------------------------------------------------------------- 日常の場面
//
// **灰が出てこない場面だけを置く。**戦い方の説明もしない。会話本文は dialogue.mjs に置く。
// R12 §5.3 が「数で足りていない」と名指しした guardian と tactician を厚くしてある。

const scene = (id, title, options) => Object.freeze({
  id,
  requires: Object.freeze({
    clearedStage: options.clearedStage ?? -1,
    met: Object.freeze([...(options.met ?? [])]),
  }),
  beat: beat("homestead_" + id, title, {
    mood: options.mood ?? "dusk",
    place: options.place ?? "根城",
    cast: options.cast,
    lines: options.lines,
    footer: options.footer ?? null,
  }),
});

export const HOMESTEAD_SCENES = Object.freeze([
  // ---- Stage 0 を越えて帰った夜。**家がまだ二人ぶんしかない。**
  scene("first_night", "帰る場所のほう", {
    clearedStage: 0,
    mood: "dusk",
    place: "根城 · 土間",
    cast: castFor("homestead_first_night"),
    lines: dialogueFor("homestead_first_night"),
    footer: "帰る場所があると、撤退が判断になる。無ければ、ただの失敗になる。",
  }),

  // ---- ナギ加入後。**口の悪い二人が、飯で黙る話。**
  scene("morning_fire", "朝の匂い", {
    clearedStage: 1,
    met: ["lancer"],
    mood: "dawn",
    place: "根城 · 裏庭",
    cast: castFor("homestead_morning_fire"),
    lines: dialogueFor("homestead_morning_fire"),
  }),

  // ---- ヒバナ加入後。**台詞の薄い人物を、ここで厚くする（R12 §5.3）。**
  scene("shelf_rules", "棚の規則", {
    clearedStage: 2,
    met: ["guardian"],
    mood: "dusk",
    place: "根城 · 奥の棚",
    cast: castFor("homestead_shelf_rules"),
    lines: dialogueFor("homestead_shelf_rules"),
    footer: "拾った物には、拾った順という記録がある。売ると値段だけが残る。",
  }),

  // ---- ゲンゾウ加入後。**「読んだものを自分の目で」の内側（R11 §7）。**
  scene("thick_book", "厚いほうの帳面", {
    clearedStage: 3,
    met: ["tactician"],
    mood: "dusk",
    place: "根城 · 火のそば",
    cast: castFor("homestead_thick_book"),
    lines: dialogueFor("homestead_thick_book"),
    footer: "協会の記録には、誰がどこで戻らなかったかが書いてある。何を考えていたかは書いていない。",
  }),

  // ---- 帰り道。**重い場面のあとに、軽い場面を置く。**
  // R13 のゲンゾウ「全部数える」と、ツグミ「人のほうを記録する」の交差。
  scene("wrong_turn", "帰り道の一つ目", {
    clearedStage: 3,
    met: ["tactician", "mender"],
    mood: "dawn",
    place: "詰所から根城への道",
    cast: castFor("homestead_wrong_turn"),
    lines: dialogueFor("homestead_wrong_turn"),
    footer: "数えられるものと、数にならないものがある。どちらも記録には残る。",
  }),

  // ---- 五人が揃ったあと。**関係が行動になる（R12 §4.E-4 の続き）。**
  scene("six_chairs", "六つ目の椅子", {
    clearedStage: 3,
    met: ["warden", "mender", "lancer", "guardian", "tactician"],
    mood: "ember",
    place: "根城 · 卓",
    cast: castFor("homestead_six_chairs"),
    lines: dialogueFor("homestead_six_chairs"),
    footer: "六枠に五人。空きは足りなさではなく、動ける余地である。",
  }),
]);

// ---------------------------------------------------------------- 開くかどうか

function meetsRequirement(requires, context) {
  const highest = Number.isFinite(context.highestClearedStageSequence)
    ? context.highestClearedStageSequence
    : -1;
  if (highest < (requires.clearedStage ?? -1)) return false;
  const met = context.met instanceof Set ? context.met : new Set(context.met ?? []);
  if ((requires.met ?? []).some((id) => !met.has(id))) return false;
  if ((requires.blueprints ?? 0) > (context.blueprintCount ?? 0)) return false;
  return true;
}

// いま家にあるもの。**順番は定義順のまま**（増えた物が下に付く）。
export function revealedFixtures(context = {}) {
  return HOMESTEAD_FIXTURES.filter((entry) => meetsRequirement(entry.requires, context));
}

// まだ見ていない場面のうち、条件を満たす最初のもの。無ければ null。
// **引くのではなく、順に出す。**同じ進行なら同じ順で出る。
export function nextHomesteadScene(context = {}, seenIds = []) {
  const seen = seenIds instanceof Set ? seenIds : new Set(seenIds ?? []);
  return HOMESTEAD_SCENES.find((entry) => !seen.has(entry.id)
    && meetsRequirement(entry.requires, context)) ?? null;
}

// すでに見た場面（根城の画面から読み返せる）。**順番は定義順。**
export function seenHomesteadScenes(seenIds = []) {
  const seen = seenIds instanceof Set ? seenIds : new Set(seenIds ?? []);
  return HOMESTEAD_SCENES.filter((entry) => seen.has(entry.id));
}

export function homesteadScene(id) {
  return HOMESTEAD_SCENES.find((entry) => entry.id === id) ?? null;
}

// storyFlags へ押す既読印。**接頭辞を一箇所で決める**（app.js で綴らない）。
export const HOMESTEAD_FLAG_PREFIX = "homestead:";

export function homesteadFlag(id) {
  return HOMESTEAD_FLAG_PREFIX + id;
}

export function seenHomesteadIds(storyFlags = []) {
  return (storyFlags ?? [])
    .filter((flag) => typeof flag === "string" && flag.startsWith(HOMESTEAD_FLAG_PREFIX))
    .map((flag) => flag.slice(HOMESTEAD_FLAG_PREFIX.length));
}
