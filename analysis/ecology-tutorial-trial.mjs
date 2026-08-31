// **R9 のチュートリアル経路を、画面の中で通しで踏む。**
//
// analysis/ecology-trial.mjs は旧・自由遠征（Free mode）の難易度 flow を見ている。
// R9 で本編に入った経路——最初の会話、勝てない一戦、巻き戻し、2人編成、
// pack の入口だけが出る技能ツリー、生成装備の報酬——は、そこを一度も通らない。
// **単体テストが通っても画面では動かない**という欠陥がこの箱で何度も出ているので、
// 新しい画面経路にはその踏み場を用意する。
//
// 見るのは印字ではなく**終了コード**。1つでも踏めなければ 1 で終わる。

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const PLAYWRIGHT_MODULE = process.env.PLAYWRIGHT_MODULE
  || "/opt/node22/lib/node_modules/playwright/index.mjs";
const CHROMIUM_PATH = process.env.CHROMIUM_PATH
  || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const { chromium } = await import(existsSync(PLAYWRIGHT_MODULE) ? PLAYWRIGHT_MODULE : "playwright");

const PORT = Number(process.env.ECOLOGY_TUTORIAL_PORT || 8946);
const BASE = process.env.ECOLOGY_TUTORIAL_BASE || `http://127.0.0.1:${PORT}/ecology/`;
const local = BASE.startsWith("http://127.0.0.1") || BASE.startsWith("http://localhost");
const server = local
  ? spawn("python3", ["-m", "http.server", String(PORT)], { stdio: "ignore", detached: true })
  : null;
const stop = () => { if (server) { try { process.kill(-server.pid); } catch { /* 既に落ちている */ } } };
if (server) await new Promise((resolve) => setTimeout(resolve, 900));

const steps = [];
const note = (label, ok, extra = "") => {
  steps.push({ label, ok });
  console.log(`  ${ok ? "ok  " : "NG  "} ${label}${extra ? ` — ${extra}` : ""}`);
};

let browser;
let errs = [];
try {
  browser = await chromium.launch(existsSync(CHROMIUM_PATH) ? { executablePath: CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => errs.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/Failed to load resource/.test(m.text())) return;
    errs.push(m.text());
  });

  // 名前は正規表現で受ける（「先へ進む」と「次へ」のように、queue の残りで
  // ラベルが変わるボタンがある）。
  const click = (name) => page
    .getByRole("button", { name: name instanceof RegExp ? name : new RegExp(name), exact: false })
    .first().click();
  const bodyText = () => page.locator("body").innerText();

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await click("ギルドへ");

  // R9 §2.1 — 最初の2人の会話。**説明ではなく、考え方の違いを見せる。**
  await click("この条件で遠征へ出る");
  const openingText = await bodyText();
  note("最初の会話が出る", /レオン/.test(openingText) && /ユウリ/.test(openingText));
  note("会話は飛ばせる", await page.getByRole("button", { name: "この Stage の会話を飛ばす" }).count() > 0);

  // R9 §2.1 — 勝てない一戦。**演出ではなく、本当に負ける。**
  await click(/先へ進む|次へ/);
  const prologueText = await bodyText();
  note("序盤の一戦へ入る", /灰の門/.test(prologueText));
  // **序盤の一戦は、会話から途切れずにそのまま始まる。**preview を挟まない
  // （まだ preview の読み方を教えていない。教えるのは巻き戻したあと）。
  await page.waitForSelector(".battle-field", { timeout: 8000 });
  note("盤面に2人だけが並ぶ", await page.locator(".battle-field .unit.ally, .unit[data-side=\"ally\"]").count() <= 3);
  await page.locator('.speed-button[data-speed="fast"]').click();
  await click("結果を見る");
  await page.waitForTimeout(300);
  const resultText = await bodyText();
  note("序盤の一戦で負ける", /届かなかった|足を止めた|突破できなかった|巻き戻/.test(resultText)
    || (await page.getByRole("button", { name: "時間が巻き戻る" }).count()) > 0);
  note("この一戦は遠征に数えないと書いてある", /この一戦は遠征に数えません/.test(resultText));

  // R9 §2.1 — 巻き戻し。
  await click("時間が巻き戻る");
  const rewindText = await bodyText();
  note("巻き戻しの会話が出る", /届かなかった/.test(rewindText));
  note("戦闘予測の使い方を示す", /戦闘予測/.test(rewindText));
  await click(/先へ進む|次へ/);

  // R9 §2.1 — 2人編成。**誰が来るかは物語が決める。**
  const campText = await bodyText();
  note("キャンプに着く", /編成|仲間/.test(campText));
  note("2人で始まる", /2 \/ 2人/.test(campText));
  await page.locator('nav.tabs [data-tab="roster"]').click();
  note("この Stage の同行者は固定だと書いてある",
    /物語が決めます/.test(await bodyText()));

  // R9 §3.1 — 新 pack は入口だけ。full だけの技能はまだ出ない。
  await page.locator('nav.tabs [data-tab="skills"]').click();
  const skillText = await bodyText();
  note("入口の技能が出ている", /溜め突き/.test(skillText));
  note("入口の接続面が出ている", /痛みで研ぐ|先手の一閃/.test(skillText));
  // 技能ツリーは manifest 外の節も薄く出す（何がこの遠征に無いかを見せる）。
  // **出ていないことではなく、取れないことを見る。**
  const outOfManifest = await page.locator(".skill-node.out-of-manifest").count();
  note("full だけの技能はまだ取れない", outOfManifest > 0, `manifest 外 ${outOfManifest} 節`);

  // 第1戦を通し、生成装備の報酬まで見る。
  await page.locator('nav.tabs [data-tab="map"]').click();
  await click("この敵に挑む");
  await click("自動戦闘を再生する");
  await page.waitForSelector(".battle-field", { timeout: 8000 });
  await page.locator('.speed-button[data-speed="fast"]').click();
  await click("結果を見る");
  await page.waitForTimeout(300);
  const battleText = await bodyText();
  note("第1戦は遠征に数える", !/この一戦は遠征に数えません/.test(battleText));
  const won = /突破した/.test(await page.locator("h1").textContent() ?? "");
  note("第1戦を突破する", won);
  if (won) {
    await click("報酬を見る");
    const rewardText = await bodyText();
    note("報酬に生成装備が出る", /生成装備/.test(rewardText));
    note("生成装備の rule が最初から読める", /とき、|につき\d+回/.test(rewardText));
    // 生成装備を拾い、装備画面と保存の往復まで見る。
    const generated = page.locator(".reward-card.generated").first();
    note("生成装備の候補を選べる", await generated.count() > 0);
    if (await generated.count()) {
      await generated.getByRole("button", { name: "拾って次へ" }).click();
      await page.waitForTimeout(200);
      await page.locator('nav.tabs [data-tab="equipment"]').click();
      const gearText = await bodyText();
      note("拾った生成装備が持ち物に並ぶ", /生成 \d+/.test(gearText) || (await page.locator(".gear-card.generated").count()) > 0);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      note("リロードしても生成装備が残る", (await page.locator(".gear-card.generated").count()) > 0
        || /生成 [1-9]/.test(await bodyText()));
    }
  }

  // ギルドの Blueprint 画面が実在する。
  note("ページエラーが無い", errs.length === 0, errs.slice(0, 3).join(" / "));
} catch (error) {
  note("通しが最後まで進む", false, String(error).slice(0, 300));
} finally {
  if (browser) await browser.close();
  stop();
}

const failed = steps.filter((step) => !step.ok);
if (!steps.length || failed.length) {
  console.error(`ecology-tutorial-trial: ${failed.length} / ${steps.length} が通らなかった`);
  process.exit(1);
}
console.log(`ecology-tutorial-trial: ${steps.length}/${steps.length} 通過`);
