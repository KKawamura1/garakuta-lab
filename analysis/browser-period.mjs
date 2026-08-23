// **倍速のとき、周期の表示が全部そろっているか。**
//
// 作者の報告（2026-08-23、第1戦の「気持ち」）：
//   「倍速ルールの時、部品の説明が古いまま？（「枠4では1,5,…に作動する」のまま）」
// 位相表だけが `rules.periodOf` を見ていて、札・枠の一行・部品の説明は素の周期のままだった。
//
// **画面の側から見る**（学び#58）。ソースに `periodOf(` が在ることは、出ることではない。
// ここでは位相表が描いた作動巡回と、枠の一行が書いた作動巡回を**突き合わせる。**
//
// 使い方： node analysis/browser-period.mjs

import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { LAW_TABLE } from "../core/law-table.mjs";
import { LAWS } from "../core/laws.mjs";

const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PORT = 8934;

// 周期を変える法則を持つ組を探す。無ければ確かめるものが無い。
const periodLaws = Object.keys(LAWS).filter(id => LAWS[id].period);
const row = LAW_TABLE.find(v => v.laws.some(id => periodLaws.includes(id)));
if (!row) {
  console.log("browser-period: 周期を変える法則が表に無いので確かめるものが無い（合格）");
  process.exit(0);
}

const server = spawn("python3", ["-m", "http.server", String(PORT)], { stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-server.pid); } catch (_) {} };
await new Promise(r => setTimeout(r, 900));

let bad = 0;
try {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  await page.goto(`http://localhost:${PORT}/play/?ruleset=laws&laws=${row.laws.join(",")}`,
    { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  // 手持ちの先頭から5枠へ置く。
  for (let i = 0; i < 5; i += 1) {
    const part = page.locator(".part").first();
    if (await part.count() === 0) break;
    await part.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(60);
    await page.locator(".slot").nth(i).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(400);

  console.log("組:", row.laws.map(id => LAWS[id].name).join("＋"));

  // 位相表が塗った巡回（行ごと）。
  const grid = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".phase-grid .slot-label")];
    const all = [...document.querySelectorAll(".phase-grid > *")];
    return rows.map(label => {
      const start = all.indexOf(label);
      const cells = [];
      for (let k = start + 1; k < all.length; k += 1) {
        if (all[k].classList.contains("slot-label")) break;
        cells.push(all[k].classList.contains("fire"));
      }
      return { label: label.textContent, fires: cells.map((f, i) => (f ? i + 1 : 0)).filter(Boolean) };
    });
  });

  // 枠の一行が書いた作動巡回（「周2・1・3…巡目」）。
  const lines = await page.locator(".slot .meta").allInnerTexts();
  const names = await page.locator(".slot .name").allInnerTexts();

  lines.forEach((text, i) => {
    const gridRow = grid.find(g => g.label.startsWith(String(i + 1)));
    if (!gridRow || !gridRow.fires.length) return;
    // 「周2（素3）・2・4・6…巡目」から**作動巡回だけ**を取る。
    // 素の周期の併記も数字なので、先に落とさないと1つずれる（最初これで誤検出した）。
    const body = text.replace(/（素\d+）/, "").replace(/^周\d+・/, "");
    const said = text.includes("毎巡")
      ? gridRow.fires.slice(0, 3)
      : (body.match(/(\d+)/g) || []).map(Number);
    const want = gridRow.fires.slice(0, said.length);
    const ok = said.length && said.join(",") === want.join(",");
    if (!ok) bad += 1;
    console.log(`枠${i + 1} ${names[i] || ""}：一行「${text}」 位相表 ${gridRow.fires.join("・")} → ${ok ? "一致" : "**食い違い**"}`);
  });

  // 説明文が素の周期のままになっていないか（倍速で周期1になった部品に「2巡に1回」が残る）。
  const detail = await page.locator(".slot").first();
  await detail.click().catch(() => {});
  await page.waitForTimeout(250);
  const body = await page.locator("body").innerText();
  const stale = /（素\d+）/.test(body);
  console.log("素の周期を併記:", stale ? "出ている" : "（この枠は周期が変わっていない）");
  if (errs.length) { console.log("例外:", errs.join(" / ")); bad += 1; }
  await browser.close();
} finally { stop(); }

if (bad) { console.error(`browser-period: ${bad}件 食い違い`); process.exit(1); }
console.log("browser-period: 位相表と札と説明が一致 OK");
