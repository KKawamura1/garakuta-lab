// **対を1組、通しで遊びきる。**作者が次にやるのがこれである。
//
// 対の流れは画面の中で一番長い：
//   1本目を遊ぶ → 終わる → 答え合わせ＋メモ → 2本目へ → 遊ぶ → 終わる → 強制選択 → 送信
// どこかで止まると、**遊び終えた1本目ごと無駄になる。**
//
// 勝つ必要は無い。負けてもランは終わるので、流れの確認にはそれで足りる。
// **速く通せる道を選ぶ**（勝てる並びを探すより、負けて終える方が速い）。

import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";

// **巻き戻ったツリーで測らない。**
// コンテナ再起動でツリーが古い版へ戻ることがあり（今夜だけで数回）、
// そのまま通しを走らせると**別のゲームを測って「壊れている」と読む。**実際に一度やった。
// 手元と origin が一致していなければ、測る前に止まる。
import { execSync } from "node:child_process";
{
  const local = execSync("git rev-parse HEAD").toString().trim();
  const remote = execSync("git rev-parse origin/claude/repository-inventory-yvut4e").toString().trim();
  if (local !== remote) {
    console.error("browser-trial: ツリーが origin と違う（巻き戻り？）。"
      + "`git fetch origin && git reset --hard origin/claude/repository-inventory-yvut4e` してから測ること。");
    process.exit(1);
  }
}

const PORT = 8943;
const server = spawn("python3", ["-m", "http.server", String(PORT)], { stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-server.pid); } catch (_) {} };
await new Promise(r => setTimeout(r, 900));

const steps = [];
const note = (label, ok, extra = "") => {
  steps.push({ label, ok });
  console.log(`  ${ok ? "ok  " : "NG  "} ${label}${extra ? ` — ${extra}` : ""}`);
};

try {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  page.on("requestfailed", r => errs.push(`失敗 ${r.url()}`));
  page.on("response", r => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });

  await page.goto(`http://localhost:${PORT}/play/?study`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  // ランを1本終える（勝っても負けても終わるまで押し続ける）。
  const playOneRun = async () => {
    for (let guard = 0; guard < 12; guard += 1) {
      const body = await page.locator("body").innerText();
      if (/1本目のひとこと|どちらが面白かった|この2本を比べて/.test(body)) return true;

      // 報酬が出ていれば取る。
      const reward = page.locator(".parts .part").first();
      if (await page.locator("h2", { hasText: "拾い物" }).count()) {
        if (await reward.count()) {
          await reward.click({ timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(250);
          const upd = page.getByRole("button", { name: "方針どおり" });
          if (await upd.count()) await upd.first().click({ timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(600);
        }
        continue;
      }
      // 再生中なら早送りして次へ。
      const ff = page.getByRole("button", { name: "早送り" });
      if (await ff.count()) { await ff.first().click().catch(() => {}); await page.waitForTimeout(400); }
      const next = page.getByRole("button", { name: /次へ|結果を見る/ });
      if (await next.count()) { await next.first().click().catch(() => {}); await page.waitForTimeout(600); continue; }

      // 構築中：空き枠を埋めて戦う。
      for (let i = 0; i < 5; i += 1) {
        const part = page.locator(".part").first();
        if (await part.count() === 0) break;
        await part.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(50);
        await page.locator(".slot").nth(i).click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(50);
      }
      const grip = page.getByRole("button", { name: "いくつか成立して選んだ" });
      if (await grip.count()) { await grip.first().click().catch(() => {}); await page.waitForTimeout(150); }
      const fight = page.getByRole("button", { name: "この配置で戦う" });
      if (await fight.count()) { await fight.first().click().catch(() => {}); await page.waitForTimeout(1200); continue; }
      await page.waitForTimeout(300);
    }
    return false;
  };

  {
    const first = await page.locator("body").innerText();
    console.log("  [開始直後の画面]", first.split("\n").filter(Boolean).slice(0, 8).join(" | "));
    console.log("  [ボタン]", (await page.locator("button:visible").allInnerTexts())
      .map(t => t.replace(/\s+/g, " ").slice(0, 18)).slice(0, 10).join(" / "));
  }
  note("1本目を終えられる", await playOneRun());
  const afterFirst = await page.locator("body").innerText();
  note("答え合わせが出る", /答え合わせ/.test(afterFirst));
  note("1本目のメモ欄が出る", /1本目のひとこと/.test(afterFirst));

  const memo = page.locator("input[type=text]").first();
  if (await memo.count()) await memo.fill("通し確認のメモ");
  const toSecond = page.getByRole("button", { name: "2本目へ" });
  note("「2本目へ」がある", await toSecond.count() > 0);
  if (await toSecond.count()) { await toSecond.first().click(); await page.waitForTimeout(900); }

  note("2本目を終えられる", await playOneRun());
  const afterSecond = await page.locator("body").innerText();
  note("比べる画面に1本目の控えが出る", /1本目/.test(afterSecond));

  // 強制選択に答える。
  // 強制選択は `<select>` である（ボタンではない）。**押せる形を決めつけない。**
  const selects = page.locator("select");
  const selectCount = await selects.count();
  note("強制選択の欄が出る", selectCount >= 2, `${selectCount}個`);
  for (let i = 0; i < selectCount; i += 1) {
    const opts = await selects.nth(i).locator("option").evaluateAll(
      list => list.map(o => o.value).filter(Boolean));
    if (opts.length) await selects.nth(i).selectOption(opts[0]).catch(() => {});
  }
  const boxes = page.locator("textarea, input[type=text]");
  for (let i = 0; i < await boxes.count(); i += 1) await boxes.nth(i).fill("通し確認").catch(() => {});

  const submit = page.getByRole("button", { name: /記録して送る|記録する|送る|送信/ });
  note("送信の口がある", await submit.count() > 0);
  if (await submit.count()) {
    await submit.first().click().catch(() => {});
    await page.waitForTimeout(1500);
    const done = await page.locator("body").innerText();
    // 送信先はこの環境から出られないので失敗する。**控えに残ることが確認したい点である。**
    note("送信を試みた跡が出る", /記録しました|送信|控え|保存/.test(done),
      (done.match(/[^\n]*記録[^\n]*/) || ["(文言なし)"])[0].slice(0, 40));
    const archived = await page.evaluate(() => {
      try { return (JSON.parse(localStorage.getItem("garakuta-play-finished")) || []).length; }
      catch { return -1; }
    });
    note("遊んだ対が控えに残る", archived >= 1, `${archived}件`);
  }

  console.log("");
  // 手元の静的サーバーは POST を受けないので `/api/runs` の 501 は当然出る。
  // **公開先では Pages Functions が受ける。**ここで数えると、毎回落ちる検査になる。
  const real = errs.filter(e => !/\/api\/runs|Unsupported method|favicon/.test(e));
  console.log("  例外:", real.length ? real.slice(0, 4) : "なし（/api/runs の 501 は手元では当然）");
  await browser.close();
  const bad = steps.filter(s => !s.ok);
  if (bad.length || real.length) {
    console.error(`trial 通し確認: ${bad.length}件が通らなかった`);
    process.exitCode = 1;
  } else {
    console.log("trial 通し確認: 対を1組、通しで遊びきれた OK");
  }
} finally {
  stop();
}
