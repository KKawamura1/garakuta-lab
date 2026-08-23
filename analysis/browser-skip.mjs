// **連勝の版の飛ばしを、ブラウザで通しで確かめる。**
//
// これは `analysis/browser-check.mjs` では確かめられなかった部分である。
// 飛ばしは「そのままの並びで次も勝てる」ときだけ起きるが、
// 手持ちを適当に並べた盤面はまず負ける（表は勝てる並びが5〜12%）。
// 12回やり直しても一度も条件に入らなかった。**起きないものを見て通しても、何も言っていない。**
//
// ここでは順番を逆にする：
//   1. 画面から種と法則を読む
//   2. **手元の中核で、勝てる並びを全列挙から1つ見つける**
//   3. その並びどおりに画面を操作して、戦って、飛ばしが起きるかを見る

import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn } from "node:child_process";
import { createRun } from "../core/run.mjs";
import { makeLawRuleset, SLOT_COUNT } from "../core/laws.mjs";
import { LAW_TABLE } from "../core/law-table.mjs";
import { allArrangements } from "../core/best-possible.mjs";
import { makeRng } from "../core/rng.mjs";

const PORT = 8937;
const server = spawn("python3", ["-m", "http.server", String(PORT)], { stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-server.pid); } catch (_) {} };
await new Promise(r => setTimeout(r, 900));

try {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on("pageerror", e => errs.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errs.push(m.text()); });

  let found = null;
  // 画面の種は乱数で決まるので、**勝てる並びが見つかる種に当たるまで引き直す。**
  for (let attempt = 0; attempt < 25 && !found; attempt += 1) {
    await page.goto(`http://localhost:${PORT}/play/?ruleset=skip`, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.removeItem("garakuta-play-session"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    const saved = await page.evaluate(() => localStorage.getItem("garakuta-play-session"));
    if (!saved) continue;
    const session = JSON.parse(saved);
    const v = LAW_TABLE.find(x => x.laws.join("+") === session.variant);
    if (!v) continue;

    const rules = makeLawRuleset(v.laws, v.scales, v.atkScales, v.modScales, v.cycleCaps, { skipWins: true });
    const run = createRun({ seed: session.seed, playerId: session.playerId, ruleset: rules });
    const o = run.observe();
    const owned = o.inventory.map(p => p.type);
    const e1 = rules.ENEMIES[0], e2 = rules.ENEMIES[1];
    if (owned.length < SLOT_COUNT || !e2) continue;

    // **第1戦に勝ち、かつ第2戦もそのまま勝てる並び**を探す。そこでしか飛ばしは起きない。
    for (const order of allArrangements(owned, SLOT_COUNT)) {
      const slots = order.map((t, i) => ({ id: `x${i}`, type: t }));
      const r1 = rules.simulateBattle({ slots, hp: o.hp, maxHp: o.maxHp, enemy: e1, rng: makeRng(1) });
      if (!r1.won) continue;
      const r2 = rules.simulateBattle({ slots, hp: r1.hp, maxHp: o.maxHp, enemy: e2, rng: makeRng(1) });
      if (!r2.won) continue;
      found = { order, names: order.map(t => rules.PARTS[t].name), seed: session.seed, laws: session.variant };
      break;
    }
  }

  if (!found) {
    console.log("勝てて次も抜けられる並びを持つ種に当たらなかった（25回）。確かめられていない");
    await browser.close();
    process.exit(1);
  }
  console.log(`種 ${found.seed} / ${found.laws}：${found.names.join("・")} なら第2戦も抜けるはず`);

  // その並びどおりに置く。部品は名前で選ぶ（同じ型が複数あってもどれでもよい）。
  for (let i = 0; i < found.names.length; i += 1) {
    const chip = page.locator(".part", { hasText: found.names[i] }).first();
    await chip.click({ timeout: 4000 });
    await page.waitForTimeout(70);
    await page.locator(".slot").nth(i).click({ timeout: 4000 });
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(400);
  const before = await page.locator("body").innerText();
  console.log("予告:", (before.match(/(勝てる|負ける)[^\n]*/) || ["—"])[0]);

  await page.getByRole("button", { name: "いくつか成立して選んだ" }).first().click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "この配置で戦う" }).first().click();
  await page.waitForTimeout(3000);
  // **再生が終わるまで「次へ」は出ない。**早送りで飛ばしてから待つ。
  // 前回はここで早すぎるクリックをしていて、まだ戦闘画面にいるのに
  // 「報酬が取れなかった」と読み違えていた（画面のボタンを出したら「早送り」が居た）。
  const ff = page.getByRole("button", { name: "早送り" });
  if (await ff.count()) { await ff.first().click().catch(() => {}); }
  const next = page.getByRole("button", { name: /次へ|結果を見る/ });
  await next.first().waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
  if (await next.count()) { await next.first().click(); await page.waitForTimeout(800); }
  // **報酬を取らないと構築へ戻らない。**飛ばしはそこで起きる。
  // 報酬は `.parts .part` を押し、そのあと「これを取ると、いまの方針は？」に答える。
  // **2段ある。**片方だけ押して「進んだ」と思っていたのが、前回の見落としだった。
  // （報酬の段階でも見出しは「第2戦」と出るので、画面の文字だけでは進んだか分からない。）
  const reward = page.locator(".parts .part").first();
  console.log("報酬候補の数:", await page.locator(".parts .part").count());
  if (await reward.count()) {
    await reward.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(300);
    const upd = page.getByRole("button", { name: "方針どおり" });
    if (await upd.count()) { await upd.first().click({ timeout: 4000 }).catch(() => {}); }
    await page.waitForTimeout(1500);
  }
  // 本当に構築へ戻ったか（＝報酬が終わったか）を、見出しではなく画面の作りで見る。
  const backToBuild = (await page.locator(".slot").count()) > 0;
  console.log("構築へ戻った:", backToBuild ? "はい" : "**いいえ（まだ報酬）**");
  if (!backToBuild) {
    console.log("画面のボタン:", (await page.locator("button:visible").allInnerTexts()).map(t => t.replace(/\s+/g, " ").slice(0, 24)).slice(0, 12));
  }

  // **連鎖したときに何が起きるかを追う。**飛ばしは報酬を取った直後に走るので、
  // 続けて飛べば「報酬 → 報酬 → …」と続き、構築画面が一度も出ないことがある。
  for (let round = 0; round < 5; round += 1) {
    const t = await page.locator("body").innerText();
    const wave = (t.match(/第\d+戦/) || ["—"])[0];
    const streak = (t.match(/\d+ strike!/) || [null])[0];
    const screen = /拾い物/.test(t) ? "報酬" : /戦う前に/.test(t) ? "構築" : /ラン終了/.test(t) ? "終了" : "その他";
    const st = JSON.parse(await page.evaluate(() => localStorage.getItem("garakuta-play-session")) || "{}");
    console.log(`   ${round}: ${screen} ${wave} 連勝=${st.streak ?? 0} 札=${streak || "なし"} 飛ばし記録=${(st.skipLog||[]).length}件`);
    if (screen !== "報酬") break;
    await page.locator(".parts .part").first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(250);
    const u = page.getByRole("button", { name: "方針どおり" });
    if (await u.count()) await u.first().click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(900);
  }

  const after = await page.locator("body").innerText();
  // **画面の文字だけで判定しない。**セッションに残る連勝数が、飛ばしが起きた証拠である。
  const state = JSON.parse(await page.evaluate(() => localStorage.getItem("garakuta-play-session")) || "{}");
  console.log("記録された連勝数:", state.streak ?? 0);
  const streak = (after.match(/\d+ strike![^\n]*/) || [null])[0];
  const wave = (after.match(/第\d+戦[^\n]*/) || ["—"])[0];
  console.log("連勝表示:", streak || "**出ていない**");
  console.log("いまの戦闘:", wave);
  console.log("エラー:", errs.length ? errs.slice(0, 3) : "なし");
  await browser.close();
  if (!(state.streak > 0) || errs.length) process.exitCode = 1;
} finally {
  stop();
}
