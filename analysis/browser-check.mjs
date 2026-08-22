// 公開前に、実際のブラウザで開いて確かめる。
//
// **この環境からは公開先を取得できない**（egress ブロック）ので、確かめられるのは手元だけである。
// それでも「読み込めない」「置けない」「予告が出ない」は手元で捕まる。
//
// 使い方： node analysis/browser-check.mjs "?ruleset=cost"
//
// 一時置き場に書くと消える（コンテナ再起動で実際に消えた）。**道具はリポジトリに置く。**

import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";

const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PORT = 8931;
const query = process.argv[2] || "";

const server = spawn("python3", ["-m", "http.server", String(PORT)], { stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-server.pid); } catch (_) {} };
await new Promise(r => setTimeout(r, 900));

try {
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  page.on("pageerror", e => errs.push(String(e)));
  page.on("requestfailed", r => errs.push(`失敗: ${r.url()}`));

  await page.goto(`http://localhost:${PORT}/play/${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  // 手持ちの先頭から5枠へ置く。**置けること自体が確認事項。**
  for (let i = 0; i < 5; i += 1) {
    const part = page.locator(".tray .chip, .inventory .chip, .part").first();
    if (await part.count() === 0) break;
    await part.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(60);
    const slot = page.locator(".slot").nth(i);
    if (await slot.count()) await slot.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(400);

  const text = await page.locator("body").innerText();
  const line = re => (text.match(re) || ["—"])[0];
  console.log("版:", line(/(laws|cost|relay|phase|arc)-[\d.]+[^\n]*/));
  console.log("予告:", line(/(勝てる|負ける)[^\n]*/));
  console.log("暴走:", line(/暴走[^\n]*/));
  console.log("置けた枠:", await page.locator(".slot .chip, .slot .part").count());
  console.log("エラー:", errs.length ? errs.slice(0, 4) : "なし");
  await browser.close();
  if (errs.length) process.exitCode = 1;
} finally {
  stop();
}
