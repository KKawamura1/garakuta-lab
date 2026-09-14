// ecology/fx-test.js — 攻撃演出の見本（DEVELOPMENT VIEW）。
//
// 作者指摘 2026-09-14 —「自分の環境の問題かもしれません。切り分けが必要なら、
// こちらで試せる切り分けの方法を教えてください」。その切り分け場がここである。
//
// **一戦も進めずに、本番と同じ経路で同じ絵を出す。**線と印は ecology/battle-fx.mjs の
// 同じ関数を呼び、箱と層の class は戦闘画面と同じ綴りを使い、CSS は同じ styles.css を読む。
// だからこの画面で出ないなら、原因は戦闘の側ではなく**端末か配信**にある。
//
// あわせて、絵が出ない側の原因になりうるものを最初に出す。
//
//   1. 「視差効果を減らす」…… 入っていると、演出は**動かない**（印と線は出たまま）
//   2. build の印 ……………… 見ている配信が、どの commit のものか
//   3. 型の表 ………………… どの技能がどちらの型か（attack-style.mjs の実物）

import { spawnImpactMark, spawnStrikeLine } from "./battle-fx.mjs";
import { buildAttackStyleIndex } from "./attack-style.mjs";
import { PLAYABLE_CONTENT } from "./playable-content.mjs";
import { BUILD, FINGERPRINT } from "../core/build.mjs";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
const STYLES = [
  { id: "weapon", label: "斬撃（腕力）", sample: "踏み込み斬り・通常攻撃", mark: "交差する二本の太刀（×）" },
  { id: "technique", label: "銃撃（技術）", sample: "狙い撃ち・溜め突き", mark: "芯から棘が伸びる星" },
];

function esc(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

function unitHtml(name, side) {
  return "<div class=\"unit hp-tone-green\" data-unit=\"" + esc(side) + "\" data-max-hp=\"100\">"
    + "<span class=\"unit-fx\" aria-hidden=\"true\">"
    + "<i class=\"fx-flash\"></i><i class=\"fx-ring\"></i><i class=\"fx-slash\"></i>"
    + "<i class=\"fx-shot\"></i><i class=\"fx-reticle\"></i>"
    + "</span>"
    + "<div class=\"unit-top\"><span class=\"unit-icon\">◆</span><b class=\"unit-name\">" + esc(name) + "</b></div>"
    + "<div class=\"unit-info-layer\"><div class=\"unit-cast\"></div>"
    + "<div class=\"unit-bar\" role=\"img\" aria-label=\"HP\"><span class=\"unit-fill\" style=\"width:62%\"></span></div>"
    + "<div class=\"unit-stats\"><span class=\"unit-hp\">62/100</span></div></div></div>";
}

function sideHtml(side, label, name) {
  return "<div class=\"battle-side\" data-side=\"" + esc(side) + "\">"
    + "<div class=\"battle-side-label\">" + esc(label) + "</div>"
    + "<div class=\"battle-row\"><div class=\"battle-row-label\">前列</div>"
    + "<div class=\"battle-units\">" + unitHtml(name, side)
    + "<div class=\"unit-empty\" aria-hidden=\"true\"></div><div class=\"unit-empty\" aria-hidden=\"true\"></div>"
    + "</div></div></div>";
}

const stage = document.getElementById("fx-stage");
stage.innerHTML = "<div class=\"battle-field\" aria-live=\"off\">"
  + sideHtml("enemy", "受ける側", "的")
  + "<div class=\"battle-beat\" data-kind=\"impact\"><span class=\"beat-round\">R1</span>"
  + "<p class=\"beat-text\">まだ何も出していません</p><span class=\"beat-count\">見本</span></div>"
  + sideHtml("ally", "出す側", "手")
  + "<div class=\"battle-floats\" aria-hidden=\"true\"></div>"
  + "</div>";

const field = stage.querySelector(".battle-field");
const source = field.querySelector("[data-unit=\"ally\"]");
const target = field.querySelector("[data-unit=\"enemy\"]");
const beatText = field.querySelector(".beat-text");

// 戦闘画面（syncBattleView）と同じ順番で、同じ class を付け外しする。
function clear() {
  for (const unit of [source, target]) {
    unit.classList.remove(
      "is-acting", "is-aimed", "is-striking", "is-hit", "hit-2", "hit-3",
      "strike-weapon", "strike-technique", "hit-weapon", "hit-technique",
    );
  }
}

function restart(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}

function fire(style) {
  clear();
  void field.offsetWidth;
  const spec = STYLES.find((entry) => entry.id === style);
  beatText.textContent = spec ? spec.label + " — " + spec.mark : "型なし";
  source.classList.add("is-acting");
  source.style.setProperty("--lunge-x", "0px");
  if (style) source.classList.add("strike-" + style);
  restart(source, "is-striking");
  target.classList.add("hit-3");
  if (style) target.classList.add("hit-" + style);
  restart(target, "is-hit");
  field.querySelectorAll(".strike-line, .muzzle-flash").forEach((node) => node.remove());
  spawnStrikeLine(field, source, target, style);
  spawnImpactMark(field, target, style);
}

const controls = document.createElement("div");
controls.className = "replay-controls";
for (const spec of STYLES) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button primary";
  button.textContent = spec.label + " を出す";
  button.addEventListener("click", () => fire(spec.id));
  controls.appendChild(button);
}
const plain = document.createElement("button");
plain.type = "button";
plain.className = "button";
plain.textContent = "型なし（裂傷など）";
plain.addEventListener("click", () => fire(null));
controls.appendChild(plain);

const loop = document.createElement("button");
loop.type = "button";
loop.className = "button";
let timer = null;
let turn = 0;
loop.textContent = "交互に繰り返す";
loop.addEventListener("click", () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    loop.textContent = "交互に繰り返す";
    return;
  }
  loop.textContent = "止める";
  fire(STYLES[turn++ % STYLES.length].id);
  timer = setInterval(() => fire(STYLES[turn++ % STYLES.length].id), 1100);
});
controls.appendChild(loop);
document.getElementById("fx-controls").appendChild(controls);

// ---------------------------------------------------------------- この端末の状態
const index = buildAttackStyleIndex(PLAYABLE_CONTENT);
const named = (id) => esc(PLAYABLE_CONTENT.activeSkills?.[id]?.displayName ?? id);
const styleLabel = (id) => STYLES.find((entry) => entry.id === index.get(id))?.label ?? "型なし";
const reduced = window.matchMedia(REDUCED_MOTION).matches;
document.getElementById("fx-environment").innerHTML = [
  "<p class=\"muted\"><b>視差効果を減らす：" + (reduced ? "入" : "切") + "</b>"
  + (reduced
    ? " — 端末の設定で動きを止めています。印と線は出ますが、<b>踏み込み・斬線・閃光は動きません。</b>"
      + "iPhone では［設定］→［アクセシビリティ］→［動作］→［視差効果を減らす］です。"
    : " — 演出は通常どおり動きます。") + "</p>",
  "<p class=\"muted\">build の印：<b>" + esc(BUILD) + "</b> ／ 内容契約：" + esc(FINGERPRINT) + "</p>",
  "<p class=\"muted\">型の実物（attack-style.mjs が content から引いた答え）："
  + ["strike", "aimed_shot", "rear_strike", "bulwark"].map((id) => named(id) + " → " + styleLabel(id)).join("／ ")
  + "</p>",
].join("");
