// ecology/content/beat.mjs
//
// **会話の断片を組み立てる道具。**本編と根城が同じ一行送りの画面を使うため、
// 話者・表情・立ち位置の検査をここへ集める。本文の正本は dialogue.mjs に置く。
//
// **二つ目の定義を作らない。**表示名の引き方・立ち絵の検査・立ち位置の語彙が
// 二重になると、片方だけ人物の改名や表情の追加に追随しなくなる。
//
//   line.who     … 話者の人物 id。null は地の文。
//   line.speaker … 表示名。characters.mjs の表から作るので、ここで綴り直さない。
//   line.emotion … 立ち絵の表情 id（portraits.mjs の EXPRESSIONS）。
//   line.fx      … 一行だけの演出（"impact" = 画面が一度揺れる）。
//   beat.cast    … その断片で舞台に立つ人物と、その立ち位置。
//   beat.mood    … 背景の色調 id。
//
// ここを触ってよいのは 物語 担当だけ。engine・schema・content 契約は変更しない。

import { CHARACTER_NAMES } from "./characters.mjs";
import { EXPRESSIONS, PORTRAITS } from "./portraits.mjs";

export const shortName = (characterId) =>
  String(CHARACTER_NAMES[characterId] ?? characterId).split(" — ")[0];

// 台詞。**表示名は表から引く。**ここで綴ると、人物の改名に追随できない。
export const say = (who, text, emotion = "neutral", fx = null) => {
  if (!PORTRAITS[who]) throw new Error("story: 立ち絵の無い話者 " + who);
  if (!EXPRESSIONS[emotion]) throw new Error("story: 未知の表情 " + emotion);
  return Object.freeze({ who, speaker: shortName(who), text, emotion, fx });
};

// 地の文。話者を持たない。**名前欄を出さずに、真ん中へ置く。**
export const narrate = (text, fx = null) => Object.freeze({ who: null, speaker: null, text, emotion: null, fx });

// 立ち位置。at は far_left / left / center / right / far_right。
// since はその行から舞台に現れる。
//
// R12 — **隊にいる人は、その場面に立っている。**加入の断片で舞台に出るのは
// 「喋る人」ではなく「そこに居る全員」である。3枠しか無かったころは、
// 4人目・5人目が配役ごと落ちて、加入済みの仲間が場面から消えていた
// （ナズナが Stage 2・3 の join から居なくなっていた。作者判断で修正）。
// 外側の2枠は一回り小さく、奥に立つ。**行数は増やさない。**
export const stand = (who, at, since = 0) => {
  if (!PORTRAITS[who]) throw new Error("story: 立ち絵の無い配役 " + who);
  return Object.freeze({ who, at, since });
};

export const beat = (id, title, options) => Object.freeze({
  id,
  title,
  mood: options.mood ?? "ash",
  place: options.place ?? "",
  cast: Object.freeze((options.cast ?? []).map((entry) => entry)),
  lines: Object.freeze(options.lines.map((line) => line)),
  footer: options.footer ?? null,
});

// 断片の何行目までを見たとき、舞台に誰が立っているか。
// **since を過ぎた配役だけを返す。**途中で現れる人物を作れるようにしてある。
export function castOnStage(beatEntry, lineIndex = Number.MAX_SAFE_INTEGER) {
  return (beatEntry?.cast ?? []).filter((entry) => (entry.since ?? 0) <= lineIndex);
}
