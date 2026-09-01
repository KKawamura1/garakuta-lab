// ecology/content/portraits.mjs
//
// **立ち絵。会話画面で「誰が喋っているか」を、名前より先に顔で見せる。**
//
// 画像ファイルは置かない。SVG を文字列として組み立てる。理由は三つある。
//
//   1. この repo は決定的であることを前提にしている。立ち絵も、同じ id と
//      同じ表情から同じ markup が出る純関数にしておく。
//   2. 端末（iPhone）で開くのが本番なので、追加のネットワーク往復を作らない。
//   3. 表情差分を「別画像」ではなく「同じ骨格の paramater 差」で持てる。
//      喜怒哀楽を足すのに新しい素材を待たなくてよい。
//
// ここが持つのは**見た目だけ**である。engine・schema・content 契約には触れない。
// 人物の能力は characters.mjs、編成画面での役割は roster.mjs にある。
//
// ここを触ってよいのは 人物 / 物語 担当だけ。

import { CHARACTER_NAMES } from "./characters.mjs";

export const PORTRAIT_VIEWBOX = "0 0 240 320";

// ---------------------------------------------------------------- 表情
//
// **表情は「別の絵」ではなく、同じ顔に載る数値の組。**
//   eye     … 瞼の開き（1 が既定、0 で閉じる）
//   browY   … 眉の高さ（＋で下がる＝力む、−で上がる＝驚く）
//   browTilt… 眉の内側の上がり（＋で困り眉、−で怒り眉）
//   mouth   … 口の形の id
export const EXPRESSIONS = Object.freeze({
  neutral: Object.freeze({ eye: 1.00, browY: 0, browTilt: 0, mouth: "neutral" }),
  firm: Object.freeze({ eye: 0.86, browY: 3, browTilt: -11, mouth: "firm" }),
  worry: Object.freeze({ eye: 0.94, browY: -1, browTilt: 12, mouth: "worry" }),
  smile: Object.freeze({ eye: 0.46, browY: -2, browTilt: 5, mouth: "smile", arc: true }),
  calm: Object.freeze({ eye: 0.00, browY: -1, browTilt: 4, mouth: "soft", closed: true }),
  shock: Object.freeze({ eye: 1.34, browY: -7, browTilt: 7, mouth: "open" }),
  wry: Object.freeze({ eye: 0.78, browY: 1, browTilt: -4, mouth: "wry" }),
  hurt: Object.freeze({ eye: 0.30, browY: 2, browTilt: 13, mouth: "worry", closed: false }),
});

export const EXPRESSION_KEYS = Object.freeze(Object.keys(EXPRESSIONS));
export const DEFAULT_EXPRESSION = "neutral";

// ---------------------------------------------------------------- 肌と髪の色
const SKIN = Object.freeze({
  light: Object.freeze({ base: "#f1d6c0", shade: "#d7ae95", line: "#3b2a23" }),
  mid: Object.freeze({ base: "#e6c0a3", shade: "#c69a7b", line: "#3b2a23" }),
  tan: Object.freeze({ base: "#cfa47f", shade: "#ac7e5b", line: "#33231b" }),
  pale: Object.freeze({ base: "#f4dfd2", shade: "#dcbcaa", line: "#3b2a23" }),
});

// ---------------------------------------------------------------- 骨格の定数
//
// 顔の中心線・目の高さなど、全員で共有する。**顔ごとに骨格を変えない。**
// 個性は髪・装い・色・小物で出す（差分の管理数を増やさないため）。
const HEAD = Object.freeze({
  cx: 120, top: 62, bottom: 180, left: 74, right: 166,
  eyeY: 128, eyeDx: 21, browY: 110, mouthY: 158,
});

const round = (value) => Math.round(value * 100) / 100;

// 髪の房。**根元から毛先へ尖らせる。**tips は毛先の座標列で、
// 房の間は根元へ戻る。style ごとに tips の並びだけを変える。
function hairMass({ top = 52, left = 68, right = 172, base = 126, tips }) {
  const parts = [
    "M " + left + "," + base,
    "C " + (left - 5) + "," + (top + 34) + " " + (left + 14) + "," + top + " " + HEAD.cx + "," + top,
    "C " + (right - 14) + "," + top + " " + (right + 5) + "," + (top + 34) + " " + right + "," + base,
  ];
  for (let index = tips.length - 1; index >= 0; index -= 1) {
    const tip = tips[index];
    const previous = tips[index + 1];
    const fromX = previous ? previous.x : right;
    const controlX = round((fromX + tip.x) / 2);
    parts.push("Q " + controlX + "," + round(tip.y - (tip.curl ?? 20)) + " " + tip.x + "," + round(tip.y));
  }
  parts.push("Z");
  return parts.join(" ");
}

const tip = (x, y, curl) => ({ x, y, curl });

// 房の並び。**style の違いはここだけ。**
const FRINGES = Object.freeze({
  // 短く跳ねる。前へ落ちる毛が少ない。
  spiky: [tip(80, 118, 26), tip(96, 104, 30), tip(112, 116, 26), tip(128, 100, 32), tip(146, 114, 26), tip(160, 122, 22)],
  // 真ん中で分ける。額が見える。
  parted: [tip(80, 124, 16), tip(96, 112, 22), tip(112, 92, 26), tip(130, 94, 26), tip(148, 114, 22), tip(162, 126, 16)],
  // 目の上でまっすぐ切り揃える。
  blunt: [tip(82, 122, 10), tip(98, 124, 10), tip(114, 125, 10), tip(130, 125, 10), tip(146, 123, 10), tip(160, 120, 12)],
  // 片側へ流す。
  swept: [tip(80, 108, 24), tip(98, 118, 24), tip(116, 126, 22), tip(134, 128, 20), tip(150, 122, 22), tip(162, 110, 24)],
  // ゆるく波打つ。
  wave: [tip(80, 120, 20), tip(94, 130, 16), tip(110, 118, 22), tip(126, 130, 16), tip(142, 118, 22), tip(160, 126, 18)],
  // 長く落ちる。左右が目尻まで来る。
  veil: [tip(78, 136, 14), tip(96, 118, 24), tip(114, 108, 28), tip(132, 112, 26), tip(150, 124, 22), tip(164, 138, 14)],
});

// 頭の後ろの毛量。長さで印象を変える。
function backHair(length) {
  if (length === "none") return "";
  const bottom = { short: 168, medium: 214, long: 272 }[length] ?? 190;
  return "M 120,50 C 160,50 182,80 180,124 C 180,150 176," + (bottom - 40) + " 172," + bottom
    + " L 150," + bottom + " C 158," + (bottom - 60) + " 158,120 152,102"
    + " L 88,102 C 82,120 82," + (bottom - 60) + " 90," + bottom
    + " L 68," + bottom + " C 64," + (bottom - 40) + " 60,150 60,124 C 58,80 80,50 120,50 Z";
}

// 束ねた髪。肩の外側へ流す。
function sideTail(side, colors) {
  const flip = side === "left" ? -1 : 1;
  const x = HEAD.cx + flip * 46;
  return "<path d=\"M " + x + ",100 C " + (x + flip * 30) + ",120 " + (x + flip * 34) + ",184 "
    + (x + flip * 20) + ",244 C " + (x + flip * 12) + ",268 " + (x + flip * 4) + ",280 " + (x - flip * 2) + ",290"
    + " C " + (x + flip * 14) + ",244 " + (x + flip * 18) + ",172 " + (x + flip * 2) + ",122 Z\" fill=\"" + colors.shade + "\"/>";
}

// ---------------------------------------------------------------- 人物ごとの絵
//
// **役割の読み取りやすさを優先する。**前で受ける人は肩が広く、
// 後ろから支える人は襟が高い、という程度の差を付ける。
export const PORTRAITS = Object.freeze({
  warden: Object.freeze({
    accent: "#91cbd5", skin: SKIN.mid,
    hair: Object.freeze({ base: "#3f5a63", shade: "#2c4149", light: "#5d7f89" }),
    garb: Object.freeze({ cloak: "#27414a", trim: "#91cbd5", inner: "#16272d" }),
    fringe: "parted", back: "medium", tail: null, shoulder: 1.06, collar: "high",
    accessory: "pauldron",
  }),
  mender: Object.freeze({
    accent: "#9bd69e", skin: SKIN.light,
    hair: Object.freeze({ base: "#6d5a44", shade: "#4d3f2f", light: "#8e7859" }),
    garb: Object.freeze({ cloak: "#2c3a2c", trim: "#9bd69e", inner: "#1a231a" }),
    fringe: "blunt", back: "short", tail: null, shoulder: 0.92, collar: "shawl",
    accessory: "kerchief",
  }),
  lancer: Object.freeze({
    accent: "#e5a26b", skin: SKIN.tan,
    hair: Object.freeze({ base: "#8a3f2c", shade: "#5f2a1d", light: "#b45c3f" }),
    garb: Object.freeze({ cloak: "#3a2a24", trim: "#e5a26b", inner: "#221814" }),
    fringe: "spiky", back: "none", tail: null, shoulder: 1.0, collar: "open",
    accessory: "strap",
  }),
  scout: Object.freeze({
    accent: "#c0a7e5", skin: SKIN.light,
    hair: Object.freeze({ base: "#4a4460", shade: "#332f45", light: "#6c6488" }),
    garb: Object.freeze({ cloak: "#2a2637", trim: "#c0a7e5", inner: "#171522" }),
    fringe: "swept", back: "short", tail: null, shoulder: 0.9, collar: "open",
    accessory: "visor",
  }),
  pivot: Object.freeze({
    accent: "#e5b869", skin: SKIN.mid,
    hair: Object.freeze({ base: "#7a6236", shade: "#564427", light: "#9c8049" }),
    garb: Object.freeze({ cloak: "#3a3220", trim: "#e5b869", inner: "#221d13" }),
    fringe: "wave", back: "medium", tail: null, shoulder: 1.02, collar: "shawl",
    accessory: "satchel",
  }),
  guardian: Object.freeze({
    accent: "#a8b6bb", skin: SKIN.tan,
    hair: Object.freeze({ base: "#48575b", shade: "#2c3639", light: "#6c7d81" }),
    garb: Object.freeze({ cloak: "#2b3538", trim: "#a8b6bb", inner: "#1a2224" }),
    fringe: "veil", back: "short", tail: null, shoulder: 1.12, collar: "hood",
    accessory: "pauldron",
  }),
  arcanist: Object.freeze({
    accent: "#8fa8e5", skin: SKIN.pale,
    hair: Object.freeze({ base: "#2b3f6b", shade: "#1c2b4b", light: "#455f95" }),
    garb: Object.freeze({ cloak: "#232b42", trim: "#8fa8e5", inner: "#151a29" }),
    fringe: "veil", back: "long", tail: null, shoulder: 0.88, collar: "high",
    accessory: "circlet",
  }),
  tactician: Object.freeze({
    accent: "#d8d18a", skin: SKIN.light,
    hair: Object.freeze({ base: "#a08a4f", shade: "#75633a", light: "#c4ad6c" }),
    garb: Object.freeze({ cloak: "#33372a", trim: "#d8d18a", inner: "#1e211a" }),
    fringe: "parted", back: "short", tail: "right", shoulder: 0.94, collar: "high",
    accessory: "sash",
  }),
});

export const PORTRAIT_IDS = Object.freeze(Object.keys(PORTRAITS));

export function portraitDef(characterId) {
  return PORTRAITS[characterId] ?? null;
}

export function portraitAccent(characterId) {
  return PORTRAITS[characterId]?.accent ?? "#e5b869";
}

export function portraitName(characterId) {
  return String(CHARACTER_NAMES[characterId] ?? characterId).split(" — ")[0];
}

// ---------------------------------------------------------------- 部品

function shoulders(def) {
  const spread = def.shoulder ?? 1;
  const outer = round(120 + 112 * spread);
  const outerLeft = round(120 - 112 * spread);
  const shoulderY = 208;
  const inner = 152;
  const innerLeft = 88;
  return "M " + outerLeft + ",320 C " + round(outerLeft + 6) + "," + (shoulderY + 34) + " "
    + round(innerLeft - 18) + "," + shoulderY + " " + innerLeft + ",196"
    + " L " + inner + ",196 C " + round(inner + 18) + "," + shoulderY + " " + round(outer - 6) + ","
    + (shoulderY + 34) + " " + outer + ",320 Z";
}

function collar(def) {
  const { trim, inner } = def.garb;
  if (def.collar === "high") {
    return "<path d=\"M 96,196 L 144,196 L 150,232 C 136,244 104,244 90,232 Z\" fill=\"" + inner + "\"/>"
      + "<path d=\"M 96,196 L 120,236 L 144,196\" fill=\"none\" stroke=\"" + trim + "\" stroke-width=\"3\" stroke-linejoin=\"round\" opacity=\".85\"/>";
  }
  if (def.collar === "shawl") {
    return "<path d=\"M 92,198 C 104,226 136,226 148,198 L 168,214 C 152,252 88,252 72,214 Z\" fill=\"" + inner + "\"/>"
      + "<path d=\"M 92,198 C 104,226 136,226 148,198\" fill=\"none\" stroke=\"" + trim + "\" stroke-width=\"3\" opacity=\".8\"/>";
  }
  if (def.collar === "hood") {
    return "<path d=\"M 60,240 C 62,180 84,150 120,148 C 156,150 178,180 180,240 L 156,240 C 152,196 140,176 120,174 C 100,176 88,196 84,240 Z\" fill=\""
      + inner + "\" opacity=\".95\"/>"
      + "<path d=\"M 84,240 C 88,196 100,176 120,174 C 140,176 152,196 156,240\" fill=\"none\" stroke=\"" + trim + "\" stroke-width=\"2\" opacity=\".55\"/>";
  }
  return "<path d=\"M 100,196 L 120,244 L 140,196 L 156,204 L 132,262 L 108,262 L 84,204 Z\" fill=\"" + inner + "\"/>"
    + "<path d=\"M 100,196 L 120,244 L 140,196\" fill=\"none\" stroke=\"" + trim + "\" stroke-width=\"2.5\" stroke-linejoin=\"round\" opacity=\".75\"/>";
}

function accessory(def) {
  const { trim } = def.garb;
  switch (def.accessory) {
    case "pauldron":
      return "<path d=\"M 178,214 C 206,222 218,246 220,272 L 172,254 C 172,236 174,224 178,214 Z\" fill=\""
        + def.garb.cloak + "\" stroke=\"" + trim + "\" stroke-width=\"2\" opacity=\".95\"/>";
    case "kerchief":
      return "<path d=\"M 76,102 C 92,74 148,74 164,102 L 168,88 C 148,58 92,58 72,88 Z\" fill=\"" + trim + "\" opacity=\".85\"/>"
        + "<circle cx=\"166\" cy=\"96\" r=\"7\" fill=\"" + trim + "\" opacity=\".85\"/>";
    case "strap":
      return "<path d=\"M 86,204 L 108,196 L 166,320 L 140,320 Z\" fill=\"" + trim + "\" opacity=\".5\"/>";
    case "visor":
      return "<path d=\"M 72,104 L 168,104 L 168,116 L 72,116 Z\" fill=\"" + trim + "\" opacity=\".55\"/>"
        + "<path d=\"M 68,110 L 172,110\" stroke=\"" + trim + "\" stroke-width=\"3\" opacity=\".9\"/>";
    case "satchel":
      return "<path d=\"M 24,266 L 74,252 L 84,300 L 34,318 Z\" fill=\"" + def.garb.inner + "\" stroke=\"" + trim + "\" stroke-width=\"2\" opacity=\".9\"/>";
    case "circlet":
      return "<path d=\"M 80,100 C 96,88 144,88 160,100\" fill=\"none\" stroke=\"" + trim + "\" stroke-width=\"3\"/>"
        + "<path d=\"M 120,84 L 126,96 L 120,104 L 114,96 Z\" fill=\"" + trim + "\"/>";
    case "sash":
      return "<path d=\"M 148,200 L 172,208 L 152,320 L 126,320 Z\" fill=\"" + trim + "\" opacity=\".45\"/>";
    default:
      return "";
  }
}

function eyes(def, mood) {
  const { line } = def.skin;
  const open = Math.max(0, mood.eye);
  const parts = [];
  for (const side of [-1, 1]) {
    const cx = HEAD.cx + side * HEAD.eyeDx;
    if (mood.closed || open <= 0.02) {
      parts.push("<path d=\"M " + (cx - 10) + "," + HEAD.eyeY + " Q " + cx + "," + (HEAD.eyeY + 7) + " "
        + (cx + 10) + "," + HEAD.eyeY + "\" fill=\"none\" stroke=\"" + line + "\" stroke-width=\"2.6\" stroke-linecap=\"round\"/>");
      continue;
    }
    const ry = round(7 * open);
    if (mood.arc) {
      parts.push("<path d=\"M " + (cx - 10) + "," + round(HEAD.eyeY + 2) + " Q " + cx + "," + round(HEAD.eyeY - 9 * open) + " "
        + (cx + 10) + "," + round(HEAD.eyeY + 2) + "\" fill=\"none\" stroke=\"" + line + "\" stroke-width=\"2.6\" stroke-linecap=\"round\"/>");
      continue;
    }
    parts.push("<ellipse cx=\"" + cx + "\" cy=\"" + HEAD.eyeY + "\" rx=\"9.5\" ry=\"" + ry + "\" fill=\"#f6f2ea\"/>");
    parts.push("<circle cx=\"" + round(cx + side * 1.2) + "\" cy=\"" + HEAD.eyeY + "\" r=\"" + round(Math.min(ry, 5.2)) + "\" fill=\"" + def.accent + "\"/>");
    parts.push("<circle cx=\"" + round(cx + side * 1.2) + "\" cy=\"" + HEAD.eyeY + "\" r=\"" + round(Math.min(ry, 5.2) * 0.5) + "\" fill=\"" + line + "\"/>");
    parts.push("<circle cx=\"" + round(cx - 2) + "\" cy=\"" + round(HEAD.eyeY - 2.4) + "\" r=\"1.6\" fill=\"#ffffff\" opacity=\".9\"/>");
    parts.push("<path d=\"M " + (cx - 10) + "," + round(HEAD.eyeY - ry + 1) + " Q " + cx + "," + round(HEAD.eyeY - ry - 3) + " "
      + (cx + 10) + "," + round(HEAD.eyeY - ry + 1) + "\" fill=\"none\" stroke=\"" + line + "\" stroke-width=\"2.4\" stroke-linecap=\"round\"/>");
  }
  return parts.join("");
}

function brows(def, mood) {
  const color = def.hair.shade;
  const parts = [];
  for (const side of [-1, 1]) {
    const cx = HEAD.cx + side * HEAD.eyeDx;
    const innerX = round(cx + side * -11);
    const outerX = round(cx + side * 11);
    const y = HEAD.browY + mood.browY;
    const innerY = round(y - mood.browTilt);
    const outerY = round(y + mood.browTilt * 0.35);
    parts.push("<path d=\"M " + innerX + "," + innerY + " Q " + cx + "," + round((innerY + outerY) / 2 - 4)
      + " " + outerX + "," + outerY + "\" fill=\"none\" stroke=\"" + color + "\" stroke-width=\"4\" stroke-linecap=\"round\"/>");
  }
  return parts.join("");
}

function mouth(def, mood) {
  const { line } = def.skin;
  const y = HEAD.mouthY;
  const stroke = (d) => "<path d=\"" + d + "\" fill=\"none\" stroke=\"" + line + "\" stroke-width=\"2.6\" stroke-linecap=\"round\"/>";
  switch (mood.mouth) {
    case "firm": return stroke("M 108," + (y + 1) + " L 132," + (y - 1));
    case "worry": return stroke("M 110," + (y + 3) + " Q 120," + (y - 4) + " 130," + (y + 3));
    case "smile": return stroke("M 107," + (y - 3) + " Q 120," + (y + 9) + " 133," + (y - 3));
    case "soft": return stroke("M 111," + (y - 1) + " Q 120," + (y + 5) + " 129," + (y - 1));
    case "wry": return stroke("M 107," + (y + 1) + " Q 118," + (y + 5) + " 133," + (y - 4));
    case "open":
      return "<ellipse cx=\"120\" cy=\"" + (y + 3) + "\" rx=\"7\" ry=\"9\" fill=\"#3b2119\"/>"
        + "<path d=\"M 114," + (y + 8) + " Q 120," + (y + 12) + " 126," + (y + 8) + "\" fill=\"#c46a63\"/>";
    default: return stroke("M 110," + y + " Q 120," + (y + 3) + " 130," + y);
  }
}

function blush(def, mood) {
  if (!mood.arc && mood.mouth !== "smile" && mood.mouth !== "soft") return "";
  return "<ellipse cx=\"92\" cy=\"144\" rx=\"9\" ry=\"4.5\" fill=\"" + def.accent + "\" opacity=\".22\"/>"
    + "<ellipse cx=\"148\" cy=\"144\" rx=\"9\" ry=\"4.5\" fill=\"" + def.accent + "\" opacity=\".22\"/>";
}

function head(def) {
  const { base, shade, line } = def.skin;
  return "<path d=\"M 120,68 C 152,68 166,92 166,120 C 166,154 146,180 120,180 C 94,180 74,154 74,120 C 74,92 88,68 120,68 Z\" fill=\""
    + base + "\"/>"
    + "<path d=\"M 120,180 C 146,180 166,154 166,120 C 166,142 150,166 120,170 Z\" fill=\"" + shade + "\" opacity=\".55\"/>"
    + "<ellipse cx=\"72\" cy=\"132\" rx=\"7\" ry=\"11\" fill=\"" + base + "\"/>"
    + "<ellipse cx=\"168\" cy=\"132\" rx=\"7\" ry=\"11\" fill=\"" + base + "\"/>"
    + "<path d=\"M 118,140 L 114,150 L 122,150\" fill=\"none\" stroke=\"" + line + "\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" opacity=\".55\"/>"
    + "<path d=\"M 104,182 L 136,182 L 136,200 L 104,200 Z\" fill=\"" + shade + "\"/>";
}

// ---------------------------------------------------------------- 立ち絵本体
//
// **同じ引数からは同じ文字列が返る。**uid は SVG 内部の gradient id を
// 一意にするためだけに使い、無ければ人物 id と表情から決める。
export function portraitSvg(characterId, expression = DEFAULT_EXPRESSION, options = {}) {
  const def = PORTRAITS[characterId];
  if (!def) return "";
  const mood = EXPRESSIONS[expression] ?? EXPRESSIONS[DEFAULT_EXPRESSION];
  const uid = String(options.uid ?? (characterId + "-" + expression)).replace(/[^A-Za-z0-9_-]/g, "");
  const gradient = "pg-" + uid;
  const hairPath = hairMass({ tips: FRINGES[def.fringe] ?? FRINGES.parted });
  const back = backHair(def.back);
  const label = portraitName(characterId);

  return "<svg class=\"portrait-svg\" viewBox=\"" + PORTRAIT_VIEWBOX + "\" role=\"img\""
    + " aria-label=\"" + label + "\" preserveAspectRatio=\"xMidYMax meet\" focusable=\"false\">"
    + "<defs><linearGradient id=\"" + gradient + "\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\">"
    + "<stop offset=\"0\" stop-color=\"" + def.garb.cloak + "\"/>"
    + "<stop offset=\"1\" stop-color=\"" + def.garb.inner + "\"/></linearGradient></defs>"
    + "<g class=\"portrait-body\">"
    + (back ? "<path d=\"" + back + "\" fill=\"" + def.hair.shade + "\"/>" : "")
    + (def.tail ? sideTail(def.tail, def.hair) : "")
    + "<path d=\"" + shoulders(def) + "\" fill=\"url(#" + gradient + ")\"/>"
    + collar(def)
    + head(def)
    // **髪は顔の下に敷く。**前髪で眉を隠すと、表情の差が読めなくなる。
    + "<path d=\"" + hairPath + "\" fill=\"" + def.hair.base + "\"/>"
    + "<path d=\"M 120,52 C 96,54 82,72 78,96\" fill=\"none\" stroke=\"" + def.hair.light + "\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\".7\"/>"
    + brows(def, mood)
    + eyes(def, mood)
    + mouth(def, mood)
    + blush(def, mood)
    + accessory(def)
    // 逆光の縁。**暗い背景から人物を起こす。**
    + "<path d=\"" + shoulders(def) + "\" fill=\"none\" stroke=\"" + def.accent + "\" stroke-width=\"2\" opacity=\".28\"/>"
    + "</g></svg>";
}
