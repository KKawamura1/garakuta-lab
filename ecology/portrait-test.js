import { portraitName, portraitSvg } from "./content/portraits.mjs";

const CHARACTERS = [
  { id: "mender", role: "支援" },
  { id: "warden", role: "大槌・前衛" },
  { id: "lancer", role: "槍・前衛" },
  { id: "guardian", role: "守り" },
  { id: "tactician", role: "参謀" },
];

const ROWS = [
  { id: "forecast", label: "予測セル相当", scope: "party-character-face", className: "portrait-calibration-forecast" },
  { id: "battle", label: "戦闘カード相当", scope: "unit-character-face", className: "portrait-calibration-battle" },
];

function esc(value) {
  return String(value).replace(/[&<>\"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[character]));
}

function faceWatermark(character, scope) {
  return "<span class=\"character-face-watermark " + scope + "\" data-character=\""
    + esc(character.id) + "\" aria-hidden=\"true\">"
    + portraitSvg(character.id, "neutral", { crop: "face" }) + "</span>";
}

function calibrationCell(character, row) {
  const name = portraitName(character.id);
  return "<article class=\"portrait-calibration-cell\" data-character=\"" + esc(character.id) + "\">"
    + "<div class=\"portrait-calibration-frame\">"
    + faceWatermark(character, row.scope)
    + "<span class=\"portrait-calibration-eye-line\" aria-hidden=\"true\"></span>"
    + "<div class=\"portrait-calibration-info\"><span class=\"portrait-calibration-bar\"><i></i></span>"
    + "<span>HP 110 / 300</span></div></div>"
    + "<div class=\"portrait-calibration-label\"><b>" + esc(name) + "</b><small>" + esc(character.role) + "</small></div>"
    + "</article>";
}

document.querySelector("#portrait-calibration-root").innerHTML = ROWS.map((row) =>
  "<section class=\"portrait-calibration-row " + row.className + "\" aria-labelledby=\"portrait-calibration-"
    + row.id + "\"><div class=\"portrait-calibration-row-head\"><h3 id=\"portrait-calibration-"
    + row.id + "\">" + row.label + "</h3><small>共通の顔補正を使用</small></div>"
    + "<div class=\"portrait-calibration-grid\">"
    + CHARACTERS.map((character) => calibrationCell(character, row)).join("")
    + "</div></section>"
).join("");
