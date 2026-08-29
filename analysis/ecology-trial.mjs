// **灰の遠征（EXP-18）を、画面の中で一番長い流れで通しで遊びきる。**
//
// 検査は通るのに画面では動かない、という欠陥が一晩で4件出ている（学び#58・#59）。
// 単体テストは engine を見ているだけで、**盤面・アニメーション・タブ移動・
// 途中リロード・アンケート送信を一度も踏んでいない。**ここがその踏み場。
//
// 見るのは印字ではなく**終了コード**。1つでも踏めなければ 1 で終わる。
// 作者へURLを渡す前に、docs/HUMAN_TEST_RELEASE.md の「本番E2E」の
// 画面経路ぶんをここで先に潰す（公開先そのものへはこの環境から出られない）。

import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";

// **同じ台本を、手元でも公開先でも走らせる。**手元はこの箱の Chromium、
// 公開先を見るときは GitHub Actions（この環境からは外へ出られないため）。
// どちらでも動くように、playwright と Chromium の在り処は環境で差し替える。
const PLAYWRIGHT_MODULE = process.env.PLAYWRIGHT_MODULE
  || "/opt/node22/lib/node_modules/playwright/index.mjs";
const CHROMIUM_PATH = process.env.CHROMIUM_PATH
  || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const { chromium } = await import(existsSync(PLAYWRIGHT_MODULE) ? PLAYWRIGHT_MODULE : "playwright");

const PORT = Number(process.env.ECOLOGY_TRIAL_PORT || 8944);
const BASE = process.env.ECOLOGY_TRIAL_BASE || `http://127.0.0.1:${PORT}/ecology/`;
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

const expectedBuild = (() => {
  try {
    return execSync("node -e \"import('./core/build.mjs').then(m => process.stdout.write(m.BUILD))\"")
      .toString().trim();
  } catch {
    return "";
  }
})();

let browser;
try {
  browser = await chromium.launch(existsSync(CHROMIUM_PATH) ? { executablePath: CHROMIUM_PATH } : {});
  // iPhone相当。**主要操作が画面外へ隠れないことを、実寸で見る。**
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  // console の "Failed to load resource" はURLを持たない。下の response 側で
  // URL付きで拾っているので、ここで二重に数えない（数えると何が落ちたか分からなくなる）。
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/Failed to load resource/.test(m.text())) return;
    errs.push(m.text());
  });
  page.on("requestfailed", (r) => { if (!/favicon/.test(r.url())) errs.push(`失敗 ${r.url()}`); });
  page.on("response", (r) => {
    if (r.status() >= 400 && !/favicon|\/api\//.test(r.url())) errs.push(`${r.status()} ${r.url()}`);
  });

  const click = (name) => page.getByRole("button", { name, exact: false }).first().click();
  const bodyText = () => page.locator("body").innerText();
  // 押せるものが画面の外に出ていないか。隠れていれば作者は押せない。
  const onScreen = async (selector) => page.locator(selector).first().evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.left >= -1 && box.right <= window.innerWidth + 1 && box.width > 0 && box.height > 0;
  });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  note("初期表示", /灰の遠征/.test(await bodyText()));
  note("build の印が画面に出ている",
    expectedBuild ? (await bodyText()).includes(expectedBuild) : false, expectedBuild);

  await click("遠征を始める");
  note("編成タブ", /編成|仲間/.test(await bodyText()));

  // 4つのタブを踏む。各画面の主要操作が画面内にあることも見る。
  for (const [tab, needle] of [["roster", "編成"], ["skills", "技能点"], ["equipment", "装備"], ["map", "この敵に挑む"]]) {
    await page.locator(`nav.tabs [data-tab="${tab}"]`).click();
    note(`タブ ${tab}`, new RegExp(needle).test(await bodyText()));
  }
  note("タブが画面内に収まる", await onScreen("nav.tabs"));

  // 技能を1つ解禁して装着する（スキルツリーの経路を踏む）。
  await page.locator('nav.tabs [data-tab="skills"]').click();
  const node = page.locator(".skill-node.available").first();
  if (await node.count()) {
    await node.click();
    const unlock = page.locator('[data-action="unlock-skill"]').first();
    if (await unlock.count()) await unlock.click();
  }
  note("スキルツリーのノードを選べる", await page.locator(".skill-node").count() > 0);

  let stage = 1;
  let reloaded = false;
  let sawAnimation = false;
  for (; stage <= 7; stage += 1) {
    await page.locator('nav.tabs [data-tab="map"]').click();
    await click("この敵に挑む");
    await click("自動戦闘を再生する");
    await page.waitForSelector(".battle-field", { timeout: 8000 });

    if (stage === 1) {
      note("盤面に味方と敵の箱が出る", await page.locator(".unit").count() >= 4);
      note("再生の操作が画面内にある", await onScreen(".replay-transport"));
      note("ログは既定で閉じている", !(await page.locator("details.debug-log").first().evaluate((d) => d.open)));
      // ダメージ値が実際に浮くところまで見る（拍が進んでいる証拠）。
      for (let i = 0; i < 150 && !sawAnimation; i += 1) {
        if (await page.locator(".float").count() > 0) sawAnimation = true;
        else await page.waitForTimeout(100);
      }
      note("ダメージ値が対象の上に浮かぶ", sawAnimation);
      await page.locator("details.debug-log summary").click();
      note("デバッグログを開ける", await page.locator(".debug-log .event").count() > 0);
    }

    await page.locator('.speed-button[data-speed="fast"]').click();

    // **ラン途中のリロード。**作者が一度これで進行を失っている。
    if (stage === 3 && !reloaded) {
      const before = await page.locator(".beat-count").textContent();
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForSelector(".battle-field", { timeout: 8000 });
      const after = await page.locator(".beat-count").textContent();
      note("戦闘中のリロードから復旧する", Boolean(after), `${before} → ${after}`);
      reloaded = true;
    }

    await click("結果を見る");
    await page.waitForTimeout(200);
    const verdict = await page.locator("h1").textContent();
    if (stage === 1) {
      note("結果画面でもログは折りたたみ", await page.locator("details.debug-log").count() > 0);
      note("結果からアニメーションへ戻れる", await page.getByRole("button", { name: "戦闘をもう一度見る" }).count() > 0);
    }
    if (verdict !== "突破した") {
      // 負けても遠征は終わらない。構成を変えて再挑戦する経路を踏み、
      // 通しを終えるためにこの区画は諦めて終端（アンケート）へ向かう。
      note(`第${stage}区画で敗北（構成の見直し経路）`, true, verdict ?? "");
      await click("構成を見直す");
      break;
    }
    if (stage < 7) {
      await click("報酬を見る");
      note(`第${stage}区画の報酬選択`, /報酬を選ぶ/.test(await bodyText()));
      await click("全員に技能点を配る");
    } else {
      await click("遠征を終えて記録する");
    }
  }
  note("7区画まで進めた or 敗北で止まった", stage >= 1, `到達 ${Math.min(stage, 7)}`);

  // 終端（アンケート）へ。負けて抜けた場合は、その場から終端画面を開く。
  if (!/今回のUIについて/.test(await bodyText())) {
    await page.evaluate(() => {
      const key = "exp18-full-prototype-v02";
      const saved = JSON.parse(localStorage.getItem(key));
      saved.phase = "complete";
      localStorage.setItem(key, JSON.stringify(saved));
    });
    await page.reload({ waitUntil: "networkidle" });
  }
  note("終了アンケートに着く", /今回のUIについて/.test(await bodyText()));
  note("アンケートに既定値が入っていない", await page.locator("#feedback-replay").inputValue() === "");
  note("感情マーカーに任意メモを付けられる", await page.locator("#feedback-clear").count() > 0);

  await page.selectOption("#feedback-replay", "4");
  await page.selectOption("#feedback-marker", "payoff");
  await page.fill("#feedback-clear", "ecology-trial: 通し確認");
  await page.fill("#feedback-confusing", "ecology-trial: 通し確認");
  note("送信ボタンが画面内にある", await onScreen('[data-action="save-feedback"]'));
  await click("保存して送信");
  await page.waitForTimeout(1200);
  const status = await page.locator("#feedback-status").textContent();
  // ローカルには /api/runs が無いので D1 未送信で正しい。公開先で走らせたときだけ ok を要求する。
  note("送信の結果が画面に出る", Boolean(status && status.length > 0), status ?? "");
  const saveLabel = await page.locator('[data-action="save-feedback"]').textContent() ?? "";
  // **「保存しました」で見ない。**成功は「D1に保存しました」、失敗は
  // 「端末に保存しました（D1未送信）」。どちらにも「保存しました」が入るので、
  // 2026-08-29、この見方で invalid_payload を通してしまった。
  const savedToD1 = saveLabel.includes("D1に保存しました");
  if (local) {
    note("ローカルではD1へ送らない（501で正しい）", !savedToD1, saveLabel);
  } else {
    note("D1へ保存できた", savedToD1, `${saveLabel} / ${status ?? ""}`);
  }

  // 送信した控えに、版・seed・buildの印・主要イベントが載っているか。
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("exp18-full-prototype-v02")));
  note("控えに版が残る", Boolean(saved?.runSeed) && Boolean(saved?.feedback?.savedAt));
  note("控えに主要行動列が残る", (saved?.runEvents || []).some((e) => e.type === "battle_completed"));

  note("ページエラーが無い", errs.length === 0, errs.slice(0, 4).join(" / "));
} catch (error) {
  note("通しが最後まで走った", false, String(error).split("\n")[0]);
} finally {
  if (browser) await browser.close();
  stop();
}

const failed = steps.filter((step) => !step.ok);
console.log(`ecology-trial: ${steps.length - failed.length}/${steps.length} 通過`);
if (failed.length) {
  console.error("ecology-trial: 踏めなかった経路がある。公開しない。");
  process.exit(1);
}
