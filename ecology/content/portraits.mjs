// ecology/content/portraits.mjs
//
// **立ち絵。会話画面で「誰が喋っているか」を、名前より先に顔で見せる。**
//
// v1（〜2026-09）はここが SVG を文字列として組み立てる純関数だった。画像ファイルを
// 持たず、同じ id と同じ表情から同じ markup が出る決定的な生成で、表情差分も
// 「別画像」ではなく「同じ骨格の parameter 差」として持っていた。
//
// PR #143 で会話UI向けの暫定バストアップ（`docs/art/bustup_v0/`）ができたため、
// この関数はそちらの透過PNGを参照する形へ切り替えた（設計判断の変更。経緯は
// `docs/HISTORY.md` 3.32、方針は `docs/DESIGN.md` §10）。表情ごとの絵はまだ無いため、
// 現状は人物ごとに1枚の画像を全表情で共有する。表情差分ができたら、PORTRAITS の
// 画像参照を表情別の map に分ければよい。
//
// ここが持つのは**見た目だけ**である。engine・schema・content 契約には触れない。
// 人物設定は character-lore.mjs、人物の能力は characters.mjs、編成画面での役割は roster.mjs にある。
//

import { CHARACTER_NAMES } from "./character-lore.mjs";

export const PORTRAIT_VIEWBOX = "0 0 240 320";
export const PORTRAIT_FACE_VIEWBOX = "0 0 240 150";

// ---------------------------------------------------------------- 表情
//
// **今はまだ「別の絵」を持たない。**どのキーも同じ画像を指す（portraitSvg 参照）。
// 呼び出し側（beat.mjs / story.mjs）は、指定された表情がここに実在するかだけを見る。
export const EXPRESSIONS = Object.freeze({
  neutral: Object.freeze({}),
  firm: Object.freeze({}),
  worry: Object.freeze({}),
  smile: Object.freeze({}),
  calm: Object.freeze({}),
  shock: Object.freeze({}),
  wry: Object.freeze({}),
  hurt: Object.freeze({}),
});

// R16 — **画像で作り直すときに何枚要るか**は `analysis/PORTRAIT_EXPRESSIONS.md` にある
// （GitHub Issue #135）。台本 274 行での使用数を数えると、ゴウの `shock` が5役、
// ゲンゾウの `smile` が7役を兼ねている。共通12＋固有33の割り方をそちらへ書いた。
export const EXPRESSION_KEYS = Object.freeze(Object.keys(EXPRESSIONS));
export const DEFAULT_EXPRESSION = "neutral";

// ---------------------------------------------------------------- 人物ごとの見た目
//
// accent … UI の差し色。image … `docs/art/bustup_v0/` 以下の暫定バストアップ。
export const PORTRAITS = Object.freeze({
  warden: Object.freeze({ accent: "#91cbd5", image: "gou.png" }), // ゴウ
  mender: Object.freeze({ accent: "#9bd69e", image: "tsugumi.png" }), // ツグミ
  lancer: Object.freeze({ accent: "#e5a26b", image: "nagi.png" }), // ナギ
  guardian: Object.freeze({ accent: "#f2c14e", image: "hibana.png" }), // ヒバナ
  tactician: Object.freeze({ accent: "#d8d18a", image: "genzou.png" }), // ゲンゾウ
});

export const PORTRAIT_IDS = Object.freeze(Object.keys(PORTRAITS));

const PORTRAIT_IMAGE_BASE = "/docs/art/bustup_v0/";

export function portraitDef(characterId) {
  return PORTRAITS[characterId] ?? null;
}

export function portraitAccent(characterId) {
  return PORTRAITS[characterId]?.accent ?? "#e5b869";
}

export function portraitName(characterId) {
  return String(CHARACTER_NAMES[characterId] ?? characterId).split(" — ")[0];
}

// ---------------------------------------------------------------- 立ち絵本体
//
// **同じ引数からは同じ文字列が返る。**expression は表情ごとの画像ができるまでの
// 暫定として無視し、全表情が同じ画像を指す。options の crop=face は、盤面の背景用に
// 顔まわりだけを切り出すための表示上の指定で、画像そのものは共有する。
export function portraitSvg(characterId, expression = DEFAULT_EXPRESSION, options = {}) {
  const def = PORTRAITS[characterId];
  if (!def) return "";
  void expression;
  const viewBox = options.crop === "face" ? PORTRAIT_FACE_VIEWBOX : PORTRAIT_VIEWBOX;
  const rootAspect = options.crop === "face" ? "xMidYMid slice" : "xMidYMin slice";
  const label = portraitName(characterId);
  const src = PORTRAIT_IMAGE_BASE + def.image;
  return "<svg class=\"portrait-svg\" viewBox=\"" + viewBox + "\" role=\"img\""
    + " aria-label=\"" + label + "\" preserveAspectRatio=\"" + rootAspect + "\" focusable=\"false\">"
    + "<image href=\"" + src + "\" x=\"0\" y=\"0\" width=\"240\" height=\"320\""
    + " preserveAspectRatio=\"xMidYMin slice\"/>"
    + "</svg>";
}
