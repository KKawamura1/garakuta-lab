// ecology/battle-fx.mjs — 盤面の層（`.battle-floats`）へ置く、一拍かぎりの演出。
//
// **ここには engine も state も入らない。**入力は「どの箱から」「どの箱へ」「どちらの型で」
// の三つだけで、出すのは DOM の札を一枚。だから ecology/fx-test.html（演出の見本）が、
// ゲームを一戦進めずに、本番と同じ経路・同じ CSS で同じ絵を出せる。
//
// 型（weapon / technique）の決め方は ecology/attack-style.mjs にある。

// 着弾の印が消えるまで。CSS の keyframe より長く取り、animation が終わってから外す。
export const IMPACT_MARK_MS = 620;
export const STRIKE_LINE_MS = 420;
export const MUZZLE_FLASH_MS = 300;

export function spawnStrikeLine(field, fromUnit, toUnit, style) {
  const host = field.querySelector(".battle-floats");
  if (!host || !fromUnit || !toUnit || fromUnit === toUnit) return;
  const fieldRect = field.getBoundingClientRect();
  const from = fromUnit.getBoundingClientRect();
  const to = toUnit.getBoundingClientRect();
  const x = from.left - fieldRect.left + from.width / 2;
  const y = from.top - fieldRect.top + from.height / 2;
  const dx = (to.left - fieldRect.left + to.width / 2) - x;
  const dy = (to.top - fieldRect.top + to.height / 2) - y;
  const length = Math.hypot(dx, dy);
  if (!(length > 1)) return;
  const node = document.createElement("i");
  // **線の飛び方はどちらの型でも同じ。**作者指摘 2026-09-14 —「相手に線が飛ぶ従来の
  // 攻撃モーションはかなりかっこいい」。弾道として光を一粒ずつ走らせると、同じ距離が
  // 遅く見えて、その速さが消える。型の差は着弾の印（×と星）が持ち、線は太さと色だけ変える。
  node.className = "strike-line" + (style ? " " + style : "");
  node.style.left = x + "px";
  node.style.top = y + "px";
  node.style.width = length + "px";
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  node.style.transform = "rotate(" + angle + "deg)";
  host.appendChild(node);
  setTimeout(() => node.remove(), STRIKE_LINE_MS);
  // 銃口の閃光は、線の根元から少しだけ前へ出す。**線とは別の札**にする——線は
  // clip-path で削られながら現れるので、同じ札へ乗せると閃光まで切り落とされる。
  if (style !== "technique") return;
  const muzzle = document.createElement("i");
  muzzle.className = "muzzle-flash";
  muzzle.style.left = (x + (dx / length) * 26) + "px";
  muzzle.style.top = (y + (dy / length) * 26) + "px";
  muzzle.style.transform = "rotate(" + angle + "deg)";
  host.appendChild(muzzle);
  setTimeout(() => muzzle.remove(), MUZZLE_FLASH_MS);
}

// 着弾の印。**箱の中ではなく盤面の層へ、箱よりひと回り大きく出す。**
// 作者試遊 2026-09-14 — 型の違いを箱の中（`.unit-fx`）だけで描いていたころは、
// 100×72 の枠と丸角に切られて、実機では「どちらも光る線が一本走る」にしか見えなかった。
// 印は枠の外へはみ出して置き、**斬撃は×、銃撃は一点で弾ける星**という形そのものを分ける。
export function spawnImpactMark(field, unit, style) {
  const host = field.querySelector(".battle-floats");
  if (!host || !unit || !style) return;
  const fieldRect = field.getBoundingClientRect();
  const rect = unit.getBoundingClientRect();
  const size = Math.max(88, Math.max(rect.width, rect.height) * 1.2);
  const node = document.createElement("i");
  node.className = "impact-mark " + style;
  node.style.left = (rect.left - fieldRect.left + rect.width / 2) + "px";
  node.style.top = (rect.top - fieldRect.top + rect.height / 2) + "px";
  node.style.width = size + "px";
  node.style.height = size + "px";
  node.style.marginLeft = (-size / 2) + "px";
  node.style.marginTop = (-size / 2) + "px";
  host.appendChild(node);
  setTimeout(() => node.remove(), IMPACT_MARK_MS);
}
