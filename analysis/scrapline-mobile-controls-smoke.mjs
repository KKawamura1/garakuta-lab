import fs from "node:fs";

const app = fs.readFileSync("scrapline/app.js", "utf8");
const css = fs.readFileSync("scrapline/styles.css", "utf8");
const sw = fs.readFileSync("scrapline/sw.js", "utf8");

const checks = [
  ["reordering uses direct button handlers", app.includes("function bindTrainControls") && app.includes('button.addEventListener("click"')],
  ["drag-and-drop is not required", !app.includes("data-drag-handle") && !app.includes("bindTrainDragging") && !css.includes(".drag-grip")],
  ["mobile train is stacked", css.includes("grid-template-columns: minmax(0, 1fr)") && css.includes("overflow: visible")],
  ["movement controls have visible labels", app.includes('class="move-label">左へ') && app.includes('class="move-label">右へ')],
  ["buttons have a touch target", css.includes("touch-action: manipulation") && css.includes("min-height: 38px")],
  ["movement controls use a three-column grid", css.includes("grid-template-columns: repeat(3, minmax(0, 1fr))")],
  ["mobile controls have a fresh cache namespace", sw.includes('scrapline-static-v10')],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`mobile controls check failed: ${label}`);
}

console.log(`mobile controls smoke: ${checks.length} checks passed`);
