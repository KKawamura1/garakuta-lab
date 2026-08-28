import fs from "node:fs";

const app = fs.readFileSync("scrapline/app.js", "utf8");
const css = fs.readFileSync("scrapline/styles.css", "utf8");
const sw = fs.readFileSync("scrapline/sw.js", "utf8");

const checks = [
  ["pointer path accepts mouse and touch input", app.includes('handle.addEventListener("pointerdown"') && !app.includes('event.pointerType === "mouse"')],
  ["pointer path tracks capture loss", app.includes('handle.addEventListener("lostpointercapture"')],
  ["pointer path chooses a nearby slot", app.includes("getBoundingClientRect") && app.includes("nearestDistance <= 90")],
  ["movement controls have visible labels", app.includes('class="move-label">左へ') && app.includes('class="move-label">右へ')],
  ["drag grip is a dedicated touch surface", css.includes("touch-action: none") && css.includes("position: static")],
  ["movement controls use a three-column grid", css.includes("grid-template-columns: repeat(3, minmax(0, 1fr))")],
  ["mobile controls have a fresh cache namespace", sw.includes('scrapline-static-v9')],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`mobile controls check failed: ${label}`);
}

console.log(`mobile controls smoke: ${checks.length} checks passed`);
