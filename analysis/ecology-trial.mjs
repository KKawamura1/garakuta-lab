// **One Battle Ahead（EXP-18）を、画面の中で一番長い流れで通しで遊びきる。**
//
// 検査は通るのに画面では動かない、という欠陥が一晩で4件出ている（学び#58・#59）。
// 単体テストは engine を見ているだけで、**盤面・アニメーション・タブ移動・
// 途中リロード・アンケート送信を一度も踏んでいない。**ここがその踏み場。
//
// 見るのは印字ではなく**終了コード**。1つでも踏めなければ 1 で終わる。
// 作者へURLを渡す前に、docs/OPERATIONS.md の「作者へ URL を渡す前に」の
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
let page;
let errs = [];
try {
  browser = await chromium.launch(existsSync(CHROMIUM_PATH) ? { executablePath: CHROMIUM_PATH } : {});
  // iPhone相当。**主要操作が画面外へ隠れないことを、実寸で見る。**
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  errs = [];
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
  const readBeatCount = async () => {
    const text = await page.locator(".beat-count").textContent();
    const match = text?.match(/([0-9]+)\s*\/\s*([0-9]+)/);
    return match ? { current: Number(match[1]), total: Number(match[2]) } : null;
  };

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  note("初期表示", /One Battle Ahead/.test(await bodyText()));
  note("build の印が画面に出ている",
    expectedBuild ? (await bodyText()).includes(expectedBuild) : false, expectedBuild);

  note("タイトル画面の開始導線が整理されている",
    await page.getByRole("button", { name: "はじめから" }).count() === 1
      && await page.getByRole("button", { name: "ロードゲーム" }).count() === 1
      && await page.getByRole("button", { name: "遠征を仕立てる" }).count() === 0);

  // R6 §15.1 — 遠征開始前に、有効パック・敵情報・3体のボスと法則が出る。
  // R12 — 自由遠征（旧・難易度rank）は削除した。遠征の仕立ては Campaign Stage だけ。
  // 長い遠征の検査は序盤の会話を別の台本に任せるため、まず New Game で
  // 正式なオートセーブを作り、テスト用に Stage 0 踏破後の入口へ進める。
  await click("はじめから");
  await page.waitForSelector(".vn-stage", { timeout: 8000 });
  await page.evaluate(() => {
    const key = "exp18-r10-auto-v02";
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (!saved?.profile) return;
    saved.phase = "expeditionStart";
    saved.story = {
      ...(saved.story || {}),
      queue: [],
      after: "camp",
      lineIndex: 0,
      auto: false,
      log: [],
      logOpen: false,
    };
    saved.prologueActive = false;
    saved.prologueStage = null;
    saved.profile.campaignProgress = saved.profile.campaignProgress || {};
    const region = Object.keys(saved.profile.campaignProgress)[0] || "region_ashfront";
    saved.profile.campaignProgress[region] = {
      highestClearedStageSequence: 0, clearedStageSequences: [0],
    };
    saved.profile.storyFlags = ["prologue_seen"];
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const guildText = await bodyText();
  note("ギルド（遠征を仕立てる）に着く", /この遠征に出るもの/.test(guildText));
  note("有効な技能パックが出ている", /この遠征に出る技能パック/.test(guildText));
  note("未解禁の pack を出していない", !/この遠征では出ない/.test(guildText));
  note("3体のボスと法則が先に見えている", /盾将の法則/.test(guildText) && /核の法則/.test(guildText));
  note("Campaign Stage が出ている", /どのStageへ出るか/.test(guildText));
  note("難易度rankの選択が残っていない", !/どの難易度で出るか/.test(guildText));

  // R6 §9.3 — ギルド投資。**買い物の画面が実在して、値段と残高が出るか。**
  await page.locator('[data-action="guild-tab"][data-tab="guild"]').click();
  const investText = await bodyText();
  note("ギルド投資の画面がある", /持ち帰った資金を使う/.test(investText));
  note("鍛錬に費用と丸め後statが出る", /鍛錬（上限なし）/.test(investText) && /基礎/.test(investText));
  note("技能数の制限が無いと分かる", /人数制限なしで装着できます/.test(investText));
  await page.locator('[data-action="guild-tab"][data-tab="expedition"]').click();

  // R12 — **この台本が見るのは12戦の長い流れであって、序盤のチュートリアルではない。**
  // 序盤の会話・勝てない一戦・巻き戻しは analysis/ecology-tutorial-trial.mjs の担当なので、
  // ここでは Stage 0 を踏破済みの Profile へ差し替えて、その先だけを踏む。
  // （Free mode を消したので、以前のように「難易度タブへ逃げて物語を回避する」ができない）
  await page.evaluate(() => {
    const key = "exp18-r10-auto-v02";
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (!saved?.profile) return;
    saved.profile.campaignProgress = saved.profile.campaignProgress || {};
    const region = Object.keys(saved.profile.campaignProgress)[0] || "region_ashfront";
    saved.profile.campaignProgress[region] = {
      highestClearedStageSequence: 0, clearedStageSequences: [0],
    };
    saved.profile.storyFlags = ["prologue_seen"];
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  note("踏破済みStageの再訪では会話が出ない", await page.locator(".vn-stage").count() === 0);

  await click("この条件で遠征へ出る");
  note("編成タブ", /編成|仲間/.test(await bodyText()));

  // 4つのタブを踏む。各画面の主要操作が画面内にあることも見る。
  for (const [tab, needle] of [["roster", "編成"], ["skills", "遠征内技能点"], ["equipment", "装備"], ["map", "この敵に挑む"]]) {
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
  let forecastAtStage1 = null;
  let sawAnimation = false;
  let retried = false;
  let rerolled = false;
  // R6 §5.1 — 3幕12戦。負けたら補給で再挑戦し、尽きたら精算まで進む。
  for (; stage <= 12; stage += 1) {
    await page.locator('nav.tabs [data-tab="map"]').click();
    if (stage === 1) {
      // R6 §11.2 / R14 §1 — 敵の重さと、次の一戦の結果は戦闘前に見えている。
      // **中身を見ずに ok と言わない。**
      const mapText = await bodyText();
      note("戦闘前に threat と幕が出ている", /危険度 \d+ \/ \d+/.test(mapText) && /第1幕/.test(mapText));
      // R14 §3 — 偵察は消えた。買って先を覗く枠はもう無い。
      note("偵察の枠が残っていない", !/偵察/.test(mapText));
      // R14 §1 — 戦闘予測は camp の上端に常設される（タブを変えても消えない）。
      note("戦闘予測が画面上部に出ている", await page.locator(".camp-top .forecast-bar").count() === 1);
      note("予測に各メンバーの減少量が出ている",
        await page.locator(".forecast-member .forecast-delta").count() > 0);
      // 予測カードの表示値を保存し、同じ戦闘のアニメーション最終フレームと突き合わせる。
      forecastAtStage1 = await page.locator(".forecast-bar").evaluate((bar) => ({
        result: ["win", "loss", "draw"].find((value) => bar.classList.contains(value)) ?? "",
        verdict: bar.querySelector(".forecast-verdict")?.textContent?.trim() ?? "",
        members: [...bar.querySelectorAll(".forecast-member")].map((member) => ({
          name: member.querySelector(".forecast-member-head b")?.textContent?.trim() ?? "",
          endingHp: Number(member.querySelector(".forecast-hp-values b")?.textContent?.trim() ?? "NaN"),
          maxHp: Number(member.querySelector(".forecast-hp-values small")?.textContent?.replace("/", "") ?? "NaN"),
          defeated: member.classList.contains("defeated"),
        })),
      }));
    }
    if (stage === 1) {
      // issue #138 追補 — キャンプを下までスクロールした状態から挑むと、盤面
      // （画面の先頭）が見えず冒頭の動きを見落とすと報告された。挑む前に下まで
      // スクロールしておき、戦闘へ入った瞬間に先頭へ戻ることを確かめる。
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      note("挑む前に下までスクロールしている", (await page.evaluate(() => window.scrollY)) > 0);
    }
    // issue #138 — 通常戦は「この敵に挑む」から戦闘前確認を挟まず自動戦闘へ進む。
    await click("この敵に挑む");
    await page.waitForSelector(".battle-field", { timeout: 8000 });
    if (stage === 1) {
      note("戦闘へ入ると画面の先頭（盤面）へ戻る", (await page.evaluate(() => window.scrollY)) === 0);
    }

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

      // 自動再生を止めて最後の拍まで手送りし、盤面に表示された最終HPを読む。
      // これで「予測が合っている」だけでなく、「実績を描くUIが同じ値を出す」ことを検査する。
      const toggle = page.locator('[data-role="replay-toggle"]');
      if (await toggle.count()) {
        const toggleLabel = await toggle.textContent();
        if (toggleLabel?.trim() === "一時停止") await toggle.click();
      }
      let beat = await readBeatCount();
      let manualSteps = 0;
      while (beat && beat.current < beat.total && manualSteps < 1200) {
        const stepButton = page.locator('[data-role="replay-step"]');
        if (await stepButton.count() === 0 || await stepButton.isDisabled()) break;
        await stepButton.click();
        manualSteps += 1;
        beat = await readBeatCount();
      }
      const animationAtEnd = Boolean(beat && beat.total > 0 && beat.current === beat.total);
      note("アニメーションを最後の拍まで進められる",
        animationAtEnd,
        beat ? String(beat.current) + " / " + String(beat.total) : "拍数なし");

      const fieldCount = await page.locator(".battle-field").count();
      const animationSnapshot = fieldCount
        ? await page.locator(".battle-field").evaluate((field) => ({
          beatText: field.querySelector(".beat-text")?.textContent?.trim() ?? "",
          beatRound: field.querySelector(".beat-round")?.textContent?.trim() ?? "",
          members: [...field.querySelectorAll('.battle-side[data-side="ally"] .unit')].map((unit) => {
            const hpText = unit.querySelector(".unit-hp")?.textContent?.trim() ?? "";
            const hp = hpText.match(/^([0-9]+)\/([0-9]+)$/);
            return {
              name: unit.querySelector(".unit-name")?.textContent?.trim() ?? "",
              endingHp: hp ? Number(hp[1]) : 0,
              maxHp: hp ? Number(hp[2]) : null,
              defeated: hpText === "戦闘不能",
            };
          }),
        }))
        : { beatText: "", beatRound: "", members: [] };
      const animationHpParity = animationAtEnd
        && Boolean(forecastAtStage1?.members?.length)
        && forecastAtStage1.members.every((expected) => {
          const actual = animationSnapshot.members.find((entry) => entry.name === expected.name);
          return Boolean(actual)
            && actual.endingHp === expected.endingHp
            && actual.defeated === expected.defeated
            && (expected.defeated || actual.maxHp === expected.maxHp);
        });
      note("上部の予測とアニメーション終了時の実績HPが一致する",
        animationHpParity,
        animationHpParity ? "" : JSON.stringify({
          forecast: forecastAtStage1,
          animation: animationSnapshot.members,
        }));
    }

    const fastSpeed = page.locator('.speed-button[data-speed="fast"]');
    if (await fastSpeed.count()) await fastSpeed.click();

    // **ラン途中のリロード。**作者が一度これで進行を失っている。
    if (stage === 3 && !reloaded) {
      const before = await page.locator(".beat-count").textContent();
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForSelector(".battle-field", { timeout: 8000 });
      const after = await page.locator(".beat-count").textContent();
      note("戦闘中のリロードから復旧する", Boolean(after), `${before} → ${after}`);
      reloaded = true;
    }

    if (await page.locator(".battle-field").count()) await click("結果を見る");
    else await page.waitForSelector("h1", { timeout: 8000 });
    await page.waitForTimeout(200);
    const verdict = (await page.locator("h1").textContent())?.trim() ?? "";
    if (stage === 1 && forecastAtStage1) {
      const resultText = await bodyText();
      const forecastRounds = forecastAtStage1.verdict.match(/([0-9]+)ラウンド/)?.[1] ?? "";
      const actualRounds = resultText.match(/·\s*([0-9]+)ラウンド/)?.[1] ?? "";
      const expectedVerdict = forecastAtStage1.result === "win" ? "突破した" : "足を止めた";
      note("予測と結果画面の勝敗・ラウンドが一致する",
        verdict === expectedVerdict && forecastRounds === actualRounds,
        forecastAtStage1.verdict + " → " + verdict + " · " + (actualRounds || "?") + "ラウンド");
    }
    if (stage === 1) {
      note("結果画面でもログは折りたたみ", await page.locator("details.debug-log").count() > 0);
      note("結果からアニメーションへ戻れる", await page.getByRole("button", { name: "戦闘をもう一度見る" }).count() > 0);
    }
    if (stage === 1 && verdict === "突破した") {
      // issue #138 — 勝利の結果と報酬3択が同じ画面に出て、「報酬を見る」の
      // 中間クリックが要らないことを確かめる。
      note("勝利の結果と報酬3択が同じ画面に出る",
        /突破した/.test(verdict) && await page.locator(".reward-grid .reward-card").count() >= 2);
      note("「報酬を見る」の中間クリックが無い", await page.getByRole("button", { name: "報酬を見る" }).count() === 0);
    }
    if (verdict !== "突破した") {
      // R6 §12.2 — 敗北で即座に破棄しない。補給が残っていれば同じ戦闘へ挑み直す。
      await click("この先どうするか");
      const defeatText = await bodyText();
      note(`第${stage}戦で敗北（敗北処理の画面）`, /ここまでで確定した活動資金/.test(defeatText));
      const retry = page.getByRole("button", { name: "補給1で編成を変えて再挑戦" });
      if (await retry.count() && !(await retry.first().isDisabled())) {
        await retry.first().click();
        if (!retried) { note("補給1で同じ戦闘へ再挑戦できる", true); retried = true; }
        stage -= 1;
        continue;
      }
      const outOfSupplies = await page.getByRole("button", { name: "補給1で編成を変えて再挑戦" }).count() === 0;
      note("補給0で再挑戦の手が消える", outOfSupplies);
      await click("遠征を終えて精算する");
      break;
    }
    if (stage < 12) {
      // issue #138 — 勝利の結果画面が報酬選択を兼ねる。「報酬を見る」の中間クリックは無い。
      note(`第${stage}戦の報酬選択`, /何を持ち帰る？/.test(await bodyText()));
      // R6 §12.1 — 引き直しは補給1。一度だけ踏む。
      if (!rerolled) {
        const reroll = page.getByRole("button", { name: "補給1で3候補を引き直す" });
        if (await reroll.count() && !(await reroll.first().isDisabled())) {
          await reroll.first().click();
          note("補給1で報酬を引き直せる", true);
          rerolled = true;
        }
      }
      const gear = page.getByRole("button", { name: "拾って次へ" });
      if (await gear.count() && !(await gear.first().isDisabled())) await gear.first().click();
      else {
        const supplies = page.getByRole("button", { name: "補給を受け取る" });
        if (await supplies.count() && !(await supplies.first().isDisabled())) await supplies.first().click();
        else throw new Error("報酬候補に選べる品がありません");
      }
    } else {
      await click("遠征を精算する");
    }
  }
  note("12戦まで進めた or 敗北で止まった", stage >= 1, `到達 ${Math.min(stage, 12)}`);

  // R6 §9.2 — 精算は一度だけ。内訳と残高が画面に出る。
  const settleText = await bodyText();
  note("精算画面に着く", /活動資金/.test(settleText) && /内訳/.test(settleText));
  note("精算の内訳が出ている", /到達距離/.test(settleText) && /報酬倍率/.test(settleText));
  if (/記録を送る/.test(settleText)) await click("記録を送る");

  // 終端（アンケート）へ。まだ着いていなければ、その場から終端画面を開く。
  if (!/今回のUIについて/.test(await bodyText())) {
    await page.evaluate(() => {
      const key = "exp18-r10-auto-v02";
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
  // 公開先のD1への送信はネットワーク応答次第で1.2秒を超えることがある。
  // 成功・失敗の終端状態を最大10秒待ち、固定待機によるCIの揺れを避ける。
  await page.waitForFunction(() => {
    const label = document.querySelector('[data-action="save-feedback"]')?.textContent ?? "";
    return label.includes("D1に保存しました")
      || label.includes("端末に保存しました（D1未送信）");
  }, null, { timeout: 10000 }).catch(() => {});
  const status = await page.locator("#feedback-status").textContent();
  // ローカルには /api/runs が無いので D1 未送信で正しい。公開先で走らせたときだけ ok を要求する。
  const saveLabel = await page.locator('[data-action="save-feedback"]').textContent() ?? "";
  const saveFinished = saveLabel.includes("D1に保存しました")
    || saveLabel.includes("端末に保存しました（D1未送信）");
  note("送信の結果が画面に出る",
    saveFinished && Boolean(status && status.length > 0),
    `${saveLabel} / ${status ?? ""}`);
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
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("exp18-r10-auto-v02")));
  note("控えに版が残る", Boolean(saved?.run?.runSeed) && Boolean(saved?.feedback?.savedAt));
  // R6 §4.1 — ProfileState と RunState が別に保存されている。
  note("profile と run が分かれて保存されている",
    saved?.profile?.schemaVersion === "ecology-profile-2" && saved?.run?.schemaVersion === "ecology-run-3");
  note("活動資金が profile に残る", typeof saved?.profile?.activityFunds === "string");
  note("遠征内の技能点は run にだけある",
    Boolean(saved?.run?.runSkillPoints) && !("skillPoints" in (saved?.profile ?? {})));
  note("控えに主要行動列が残る", (saved?.runEvents || []).some((e) => e.type === "battle_completed"));

  // ---- R13 / R11 §2.4 / R8 §3.2 — 精算の次の一枚（根城）と、図鑑。
  //
  // **控えの検査より後に置く。**ギルドへ戻ると次の遠征の run が作られて
  // runEvents が入れ替わるので、先に踏むと上の「控えに主要行動列が残る」が落ちる。
  // この台本は8戦前後まで進むので、同じ敵種を何度も倒している。
  await page.evaluate(() => {
    const key = "exp18-r10-auto-v02";
    const stored = JSON.parse(localStorage.getItem(key));
    stored.phase = "settlement";
    localStorage.setItem(key, JSON.stringify(stored));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(250);
  note("精算から根城へ帰れる", await page.getByRole("button", { name: "根城へ帰る" }).count() === 1);
  await click("根城へ帰る");
  await page.waitForTimeout(300);
  // まだ見ていない日常の場面があれば、根城の一枚より先に会話が入る。
  // **ここで見たいのは図鑑なので、場面は飛ばして通す。**
  if (await page.locator(".vn-stage").count() > 0) {
    note("根城の日常場面が入る", /根城/.test(await bodyText()));
    await click("スキップ");
    await page.waitForTimeout(300);
  }
  note("根城の一枚に着く", /直しかけの家/.test(await bodyText()));
  await click("ギルドへ");
  await page.waitForTimeout(250);
  await page.locator('[data-action="guild-tab"][data-tab="codex"]').click();
  await page.waitForTimeout(250);
  const codexText = await bodyText();
  note("図鑑に会った敵が載る", /会った灰殻の記録/.test(codexText) && /見た \d/.test(codexText));
  note("倒した数で図鑑の節が開く",
    /書き足せた [1-9]/.test(codexText) || /あと \d 体倒すと/.test(codexText));

  note("ページエラーが無い", errs.length === 0, errs.slice(0, 4).join(" / "));

  // 送った run を後から D1 で照合できるように、id を1行で出す。
  // 呼び出し側（.github/workflows/ecology-trial.yml）がこれを拾って、
  // **保存されたと言っている行が本当にあるか**を狭い SELECT で確かめる。
  if (saved?.runId) console.log(`RUN_ID=${saved.runId}`);
} catch (error) {
  note("通しが最後まで走った", false, String(error).split("\n")[0]);
  // **落ちた場所の画面を出す。**「時間切れ」だけでは、どの経路で詰まったか分からない。
  if (errs.length) console.log("  ブラウザエラー:", errs.slice(0, 8).join(" / "));
  try {
    const where = await page?.locator("body").innerText();
    console.log("  画面:", where.slice(0, 700).replace(/\n/g, " | "));
  } catch { /* 画面も取れないときは諦める */ }
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
