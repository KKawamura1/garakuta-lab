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
  const fill = async () => {
    for (let i = 0; i < 5; i += 1) {
      const part = page.locator(".tray .chip, .inventory .chip, .part").first();
      if (await part.count() === 0) break;
      await part.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(60);
      const slot = page.locator(".slot").nth(i);
      if (await slot.count()) await slot.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(350);
  };
  await fill();

  // **勝てる盤面はここでは作れない。**
  // 手持ちの先頭5個をそのまま並べた盤面はまず負ける（表は勝てる並びが5〜12%になるよう
  // 調律してある）。種を引き直しても、決めているのは種ではなく並びなので変わらない。
  // 12回やり直して一度も勝てなかった。
  // **だから「勝てる盤面でしか起きないこと」は、ここではなく `analysis/smoke-skip.mjs` で見る。**
  // この道具が言えるのは、読み込める・置ける・予告が出る・例外が出ない、まで。

  const text = await page.locator("body").innerText();
  const line = re => (text.match(re) || ["—"])[0];
  console.log("版:", line(/[a-z]+-\d+\.\d+[^\n]*/));
  console.log("予告:", line(/(勝てる|負ける)[^\n]*/));
  console.log("暴走:", line(/暴走[^\n]*/));
  // 埋まっている枠＝`.slot` のうち `.empty` が付いていないもの。
  // 以前は `.slot .chip` を数えていて、そんな要素は無いので**常に0**だった。
  // 数え方が間違っている検査は、通っても落ちても何も言っていない。
  const total = await page.locator(".slot").count();
  const empty = await page.locator(".slot.empty").count();
  console.log("埋まった枠:", `${total - empty}/${total}`);
  // 同定の版だけの確認：伏せてあるか、当てる口があるか、13件から選べるか。
  if (query.includes("ident")) {
    console.log("伏せ字:", text.includes("？？？") ? "出ている" : "**出ていない**");
    const btn = page.getByRole("button", { name: "法則を当てる" });
    if (await btn.count()) {
      await btn.first().click();
      await page.waitForTimeout(300);
      console.log("候補の数:", await page.locator("#gameChoices button").count());
    } else {
      console.log("候補の数: **当てる口が無い**");
    }
  }
  // 連勝の版：戦って、飛ばしが起きるか。**固まらないことも見る。**
  if (query.includes("skip")) {
    // 手応えを選ばないと戦えない（そういう作りにしてある）。先に1つ選ぶ。
    const grip = page.getByRole("button", { name: "いくつか成立して選んだ" });
    if (await grip.count()) { await grip.first().click(); await page.waitForTimeout(200); }
    const fight = page.getByRole("button", { name: "この配置で戦う" });
    if (await fight.count()) {
      await fight.first().click();
      await page.waitForTimeout(2500);
      const next = page.getByRole("button", { name: /次へ|結果を見る/ });
      if (await next.count()) {
        await next.first().click({ timeout: 5000 });
        await page.waitForTimeout(1200);
      }
      const after = await page.locator("body").innerText();
      console.log("連勝表示:", (after.match(/\d+ strike![^\n]*/) || ["(出ず＝そのままでは勝てない盤面)"])[0]);
      console.log("進んだ戦闘:", (after.match(/第\d+戦[^\n]*/) || ["—"])[0]);
    } else {
      console.log("連勝表示: **戦うボタンが見つからない**");
    }
  }
  // **版の取り違え。**保存済みセッションがあるときに ?ruleset= で別の版を指したら、
  // 指した方が始まること。ここが効いていないと、作者は前のゲームを遊び続ける。
  if (process.env.CHECK_SWITCH) {
    await page.goto(`http://localhost:${PORT}/play/?ruleset=ident`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const after = await page.locator("body").innerText();
    const id = (after.match(/[a-z]+-\d+\.\d+/) || ["—"])[0];
    console.log("切り替え後の版:", id, id.startsWith("ident") ? "（指したとおり）" : "**指したのに変わっていない**");
  }
  console.log("エラー:", errs.length ? errs.slice(0, 4) : "なし");
  await browser.close();
  if (errs.length) process.exitCode = 1;
} finally {
  stop();
}
