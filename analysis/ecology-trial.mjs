// **One Battle Ahead（EXP-18）を、画面の中で一番長い流れで通しで遊びきる。**
//
// 検査は通るのに画面では動かない、という欠陥が一晩で4件出ている（学び#58・#59）。
// 単体テストは engine を見ているだけで、**盤面・アニメーション・タブ移動・
// 途中リロード・アンケート送信を一度も踏んでいない。**ここがその踏み場。
//
// 見るのは印字ではなく**終了コード**。1つでも踏めなければ 1 で終わる。
// 作者へURLを渡す前に、docs/OPERATIONS.md の「作者へ URL を渡す前に」の
// 画面経路ぶんをここで先に潰す（公開先そのものへはこの環境から出られない）。

import { spawn, execFileSync, execSync } from "node:child_process";
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
if (local && !process.env.ECOLOGY_EXPECT_BUILD) {
  execFileSync(process.execPath, ["analysis/stamp.mjs"], { stdio: "ignore" });
}

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

const expectedBuild = process.env.ECOLOGY_EXPECT_BUILD || (() => {
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
  // プレビュー環境では、会話用のチェックポイント画像が配信対象から外れることがある。
  // 立ち絵の代替表示と会話操作は機能するため、機能経路の検査からはこの画像だけ外す。
  const checkpointArtwork = /\/docs\/art\/bustup_v0\/.*\.png$/;
  page.on("requestfailed", (r) => {
    if (!/favicon/.test(r.url()) && !checkpointArtwork.test(r.url())) errs.push(`失敗 ${r.url()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && !/favicon|\/api\//.test(r.url()) && !checkpointArtwork.test(r.url())) {
      errs.push(`${r.status()} ${r.url()}`);
    }
  });

  const click = (name) => page.getByRole("button", { name, exact: false }).first().click();
  const bodyText = () => page.locator("body").innerText();
  const buildStampText = () => page.locator(".build-stamp, footer").first().textContent();
  // 押せるものが画面の外に出ていないか。隠れていれば作者は押せない。
  const onScreen = async (selector) => page.locator(selector).first().evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.left >= -1 && box.right <= window.innerWidth + 1 && box.width > 0 && box.height > 0;
  });
  const appearsBefore = async (firstSelector, secondSelector) => page.locator(firstSelector).first().evaluate((first, selector) => {
    const second = document.querySelector(selector);
    return Boolean(second && (first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING));
  }, secondSelector);
  const readBeatCount = async () => {
    const text = await page.locator(".beat-count").textContent();
    const match = text?.match(/([0-9]+)\s*\/\s*([0-9]+)/);
    return match ? { current: Number(match[1]), total: Number(match[2]) } : null;
  };
  const readBarrierUi = () => page.locator(".battle-field").evaluate((field) => (
    [...field.querySelectorAll(".unit")].map((unit) => {
      const mark = unit.querySelector(".mark.barrier")?.textContent?.trim() ?? "";
      const match = mark.match(/^◈([0-9]+)$/);
      return {
        maxHp: Number(unit.dataset.maxHp ?? "0"),
        barrier: match ? Number(match[1]) : 0,
        width: Number.parseFloat(unit.querySelector(".unit-barrier-fill")?.style.width ?? "0"),
        hasFill: Boolean(unit.querySelector(".unit-barrier-fill")),
      };
    })
  ));
  const readHpGaugeUi = () => page.locator(".battle-field").evaluate((field) => (
    [...field.querySelectorAll(".unit")].map((unit) => {
      const segment = (selector) => {
        const element = unit.querySelector(selector);
        return {
          width: Number.parseFloat(element?.style.width ?? "0"),
          left: Number.parseFloat(element?.style.left ?? "0"),
          topLeft: element?.style.borderTopLeftRadius ?? "",
          topRight: element?.style.borderTopRightRadius ?? "",
          bottomLeft: element?.style.borderBottomLeftRadius ?? "",
          bottomRight: element?.style.borderBottomRightRadius ?? "",
        };
      };
      return {
        segments: {
          green: segment(".unit-fill"),
          recovered: segment(".unit-recovered"),
          recoverable: segment(".unit-recoverable"),
          unrecoverable: segment(".unit-unrecoverable"),
        },
      };
    })
  ));
  const expectedMapKinds = [
    "normal", "normal", "elite", "boss",
    "normal", "normal", "elite", "boss",
    "normal", "normal", "elite", "boss",
  ];
  const mapKindLabels = { normal: "通常", elite: "精鋭", boss: "ボス" };
  const mapStatusLabels = { done: "クリア済み", current: "現在地", unreached: "未到達" };
  const mapMarkers = { normal: "", elite: "◆", boss: "★" };
  const readMap = () => page.locator(".map-progress").evaluate((map) => (
    [...map.querySelectorAll(".map-node")].map((node) => ({
      index: Number(node.dataset.mapIndex ?? "0"),
      kind: node.dataset.mapKind ?? "",
      status: node.dataset.mapStatus ?? "",
      label: node.getAttribute("aria-label") ?? "",
      current: node.getAttribute("aria-current") ?? "",
      marker: node.querySelector(".map-kind-badge")?.textContent?.trim() ?? "",
      borderWidth: getComputedStyle(node).borderTopWidth,
      borderColor: getComputedStyle(node).borderTopColor,
      boxShadow: getComputedStyle(node).boxShadow,
    }))
  ));

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  note("初期表示", /One Battle Ahead/.test(await bodyText()));
  note("build の印が画面に出ている",
    expectedBuild ? (await buildStampText()).includes(expectedBuild) : false, expectedBuild);

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
    // This fixture skips the New Game opening; it is a normal/revisit run.
    saved.supplyTutorialRunId = null;
    saved.profile.campaignProgress = saved.profile.campaignProgress || {};
    const region = Object.keys(saved.profile.campaignProgress)[0] || "region_ashfront";
    saved.profile.campaignProgress[region] = {
      highestClearedStageSequence: 0, clearedStageSequences: [0],
    };
    // issue #240 — 必殺技チュートリアル（Stage 1 の第1戦）も**この台本の担当ではない**。
    // ここが見るのは12戦の長い流れなので、手取りの錠は済んだものとして入る
    // （錠そのものは analysis/ecology-tutorial-trial.mjs が踏む）。
    saved.profile.storyFlags = ["prologue_seen", "ultimate_lesson_seen"];
    // Keep the long-run trial outside the one-time New Game walkthrough.
    saved.supplyTutorialRunId = null;
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const guildText = await bodyText();
  note("ギルド（遠征の準備）に着く", /今回の遠征/.test(guildText));
  note("有効な技能パックが出ている", /有効な技能パック/.test(guildText));
  note("未解禁の pack を出していない", !/この遠征では出ない/.test(guildText));
  note("3体のボスと法則が先に見えている", /盾将の法則/.test(guildText) && /核の法則/.test(guildText));
  note("行き先の選択が出ている", /行き先を選ぶ/.test(guildText));
  note("難易度rankの選択が残っていない", !/どの難易度で出るか/.test(guildText));

  // R6 §9.3 — ギルド投資。**買い物の画面が実在して、値段と残高が出るか。**
  await page.locator('[data-action="guild-tab"][data-tab="guild"]').click();
  const investText = await bodyText();
  note("ギルド投資の画面がある", /資金を使う/.test(investText));
  note("鍛錬に費用と現在値が出る", /仲間を鍛える/.test(investText) && /基礎/.test(investText));
  note("初期SPアップが永続強化に出る", /初期SPアップ/.test(investText));
  note("投資の取り消し不可が分かる", /購入は取り消せません/.test(investText));
  await page.locator('[data-action="guild-tab"][data-tab="expedition"]').click();

  // R10 — タイトル画面は表示だけで、Continueの再開先にはならない。
  await click("タイトルへ");
  note("タイトルへ戻れる", await page.locator(".title-screen").count() === 1);
  note("タイトルからContinueを押せる",
    await page.locator('[data-action="continue-game"]:not([disabled])').count() === 1);
  await page.reload({ waitUntil: "networkidle" });
  note("タイトルへ戻った状態をリロードしても維持する",
    await page.locator(".title-screen").count() === 1);
  await click("つづきから");
  await page.waitForTimeout(300);
  note("Continueで遠征準備へ復帰する",
    await page.locator(".title-screen").count() === 0 && /今回の遠征/.test(await bodyText()));

  // 修正前に作られた、phase=intro だけのオートセーブも救済する。
  await page.evaluate(() => {
    const key = "exp18-r10-auto-v02";
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (!saved) return;
    saved.phase = "intro";
    delete saved.resumePhase;
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  await click("つづきから");
  await page.waitForTimeout(300);
  note("既存のオートセーブからも遠征準備へ復帰する",
    await page.locator(".title-screen").count() === 0 && /今回の遠征/.test(await bodyText()));

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
    // issue #240 — 必殺技チュートリアルの錠も、この台本の担当ではない（上と同じ理由）。
    saved.profile.storyFlags = ["prologue_seen", "ultimate_lesson_seen"];
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  note("再訪用の遠征準備画面に着く", await page.locator(".vn-stage").count() === 0);

  // issue #238 — **必殺技は Stage 1 から開く**ので、この台本も Stage 1 を選んで出る。
  // Stage 0（2人の導入）を選ぶと、必殺技の経路が一つも踏めない。
  const stage1Card = page.locator('[data-action="select-campaign-stage"][data-sequence="1"]');
  note("Stage 1 を選べる", await stage1Card.count() === 1);
  if (await stage1Card.count()) await stage1Card.click();
  await page.waitForTimeout(200);

  await click("この条件で遠征へ出る");
  await page.waitForSelector(".vn-stage", { timeout: 8000 });
  note("踏破済みStageの再訪でも開始会話が出る", await page.locator(".vn-stage").count() === 1);
  await click("スキップ");
  await page.waitForTimeout(300);
  note("キャンプに着く", /スキル|遠征/.test(await bodyText()));

  // issue #235 — タブは4枚（スキル・装備・補給・遠征）。編成タブは廃止し、隊列は
  // どのタブからでも上端の盤面の「⇅ 隊列」で組み替える。
  for (const [tab, needle] of [["skills", "技能点"], ["equipment", "装備"], ["supplies", "補給"], ["map", "この敵に挑む"]]) {
    await page.locator(`nav.tabs [data-tab="${tab}"]`).click();
    note(`タブ ${tab}`, new RegExp(needle).test(await bodyText()));
    if (tab === "skills") {
      note("技能ツリーを折りたためる",
        await page.locator("details.skill-tree-details").count() === 1);
    }
    if (tab === "equipment") {
      note("装備一覧を折りたためる",
        await page.locator("details.equipment-inventory").count() === 1);
    }
  }
  note("タブが画面内に収まる", await onScreen("nav.tabs"));

  // 技能を1つ解禁して装着する（スキルツリーの経路を踏む）。
  await page.locator('nav.tabs [data-tab="skills"]').click();
  const skillHelp = page.locator('details[data-help="skill-rules"]');
  if (await skillHelp.count()) {
    await skillHelp.locator("summary").click();
    note("技能数の制限が無いと分かる", /枠の上限はありません/.test(await bodyText()));
    await page.locator('nav.tabs [data-tab="equipment"]').click();
    await page.locator('nav.tabs [data-tab="skills"]').click();
    note("ヘルプの開閉状態を保つ", await page.locator('details[data-help="skill-rules"]').evaluate((element) => element.open));
  }
  // issue #236 — **取得と装着が一つの手であること**を、実際に取って確かめる。
  //
  // 技能点は0で始まり、戦闘をクリアして初めて貯まる（STARTING_RUN_SKILL_POINTS = 0）。
  // この台本はキャンプに着いた直後なので、そのままでは取得できる節が一つも無く、
  // **解禁の経路がこれまで一度も踏まれていなかった。**蘇生の検査と同じやり方で、
  // 保存に点を入れてから踏み、終わったら元へ戻す。
  const pointFixture = await page.evaluate(() => {
    const key = "exp18-r10-auto-v02";
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (!saved?.run) return null;
    const before = { ...saved.run.runSkillPoints };
    saved.run.runSkillPoints = Object.fromEntries(saved.run.roster.map((id) => [id, 9]));
    localStorage.setItem(key, JSON.stringify(saved));
    return { before };
  });
  if (pointFixture) {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await page.locator('nav.tabs [data-tab="skills"]').click();
    await page.waitForTimeout(200);
    const node = page.locator(".skill-node.available").first();
    note("技能点があれば取得できる節が出る", await node.count() > 0);
    if (await node.count()) {
      const unlockingName = (await node.locator(".node-copy b").innerText()).trim();
      await node.click();
      await page.waitForTimeout(150);
      const unlock = page.locator('[data-action="unlock-skill"]').first();
      note("取得の釦が出る", await unlock.count() > 0);
      if (await unlock.count()) {
        await unlock.click();
        await page.waitForTimeout(250);
        // **「装着する」という二手目は無い。**取った瞬間に装着行へ並び、オンで回り始める。
        note("取得と装着が一つの手である",
          await page.locator('[data-action="equip-skill"]').count() === 0);
        note("取得した技能がその場で装着行に並ぶ",
          await page.locator(".installed-row", { hasText: unlockingName }).count() > 0, unlockingName);
        note("取得した節は取得済みの印になる",
          await page.locator(".skill-node.equipped", { hasText: unlockingName }).count() > 0);
      }
    }
    // 直したら元へ戻す。**後続の検査は通常の遠征状態を前提にしている。**
    await page.evaluate((fixture) => {
      const key = "exp18-r10-auto-v02";
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (!saved?.run) return;
      saved.run.runSkillPoints = fixture.before;
      localStorage.setItem(key, JSON.stringify(saved));
    }, pointFixture);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);
  }
  note("スキルツリーのノードを選べる", await page.locator(".skill-node").count() > 0);

  // issue #238 / 作者指摘 2026-09-12 — 必殺技。**装着行の長押し一回で、この一戦の
  // 必殺になる。**釦を押す二手目は無くなったので、行そのものが押せることと、
  // もう一度の長押しで元へ戻ることを画面から踏む。
  const longPress = async (locator) => {
    const box = await locator.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(250);
  };
  const ultimateRow = page.locator(".installed-row[data-longpress]").first();
  note("装着行が長押しできる", await ultimateRow.count() === 1);
  if (await ultimateRow.count()) {
    note("必殺技の専用枠は画面に無い", await page.locator("section.ultimate-card").count() === 0);
    // 作者指摘 2026-09-13 — 残りは**人物ごと**に盤面のセルへ出す（隊の合計はやめた）。
    note("誰が必殺を残しているかが盤面に出る",
      await page.locator(".camp-top .party-ultimate.ready").count() > 0
        && await page.locator(".skill-points-badge .seal-pips").count() === 0);
    await longPress(ultimateRow);
    note("長押しだけでこの一戦の必殺になる",
      await page.locator(".installed-row.ultimate.armed").count() === 1);
    note("行に構えの印（✹）が出て、釦は無い",
      await page.locator(".installed-row.ultimate .ultimate-seal").count() === 1
        && await page.locator('[data-action="toggle-ultimate-armed"]').count() === 0);
    // 盤面の印は全員ぶん出ている（誰が残していて誰が使い終えたか）。構えた一人だけが
    // `armed` か `firing` になる。
    note("構えると盤面の印がその一人だけ変わる",
      await page.locator(".party-cell .party-ultimate.armed, .party-cell .party-ultimate.firing").count() === 1
        && await page.locator(".party-cell .party-ultimate").count() === 3);
    // 序盤の一戦では傷の条件が揃わないので、**予測が「出ない」と先に言う。**
    const armedTitle = await page.locator(".installed-row.ultimate").first().getAttribute("title");
    note("構えた時点で、この一戦で出るかどうかが読める",
      /この一戦で出る|条件が揃わない/.test(armedTitle ?? ""), armedTitle ?? "");
    await longPress(page.locator(".installed-row.ultimate").first());
    note("もう一度の長押しで構えが解ける", await page.locator(".installed-row.ultimate").count() === 0);
    // **構えたまま12戦へ入る。**放つ拍（カットイン、issue #242）は、条件が揃う一戦で
    // 画面から踏む。
    await longPress(page.locator(".installed-row[data-longpress]").first());
    note("構えたまま遠征へ入れる", await page.locator(".installed-row.ultimate.armed").count() === 1);
  }

  let ultimateSpentSeen = false;
  // issue #242 — 必殺の拍のカットイン。**予測が「この一戦で出る」と言った回**に、
  // 自動再生を止めて一手ずつ送り、その拍で演出が出ることを確かめる。
  let ultimateCutInSeen = false;
  let stage = 1;
  let reloaded = false;
  let forecastAtStage1 = null;
  let sawAnimation = false;
  let retried = false;
  let rerolled = false;
  let barrierSamples = [];
  let hpGaugeSamples = [];
  // R6 §5.1 — 3幕12戦。負けたら補給で再挑戦し、尽きたら精算まで進む。
  for (; stage <= 12; stage += 1) {
    await page.locator('nav.tabs [data-tab="map"]').click();
    const mapNodes = await readMap();
    const expectedStatuses = expectedMapKinds.map((_, offset) => {
      const step = offset + 1;
      return step < stage ? "done" : step === stage ? "current" : "unreached";
    });
    const mapLayoutOk = mapNodes.length === expectedMapKinds.length
      && mapNodes.every((node, offset) => (
        node.index === offset + 1
        && node.kind === expectedMapKinds[offset]
        && node.marker === mapMarkers[node.kind]
        && node.status === expectedStatuses[offset]
        && node.label.includes("第" + (offset + 1) + "戦")
        && node.label.includes(mapKindLabels[node.kind])
        && node.label.includes(mapStatusLabels[node.status])
        && node.current === (node.status === "current" ? "step" : "false")
      ));
    note(`第${stage}戦の12戦マップ構成`, mapLayoutOk);
    note(`第${stage}戦へ現在地が移動する`, mapNodes.filter((node) => node.status === "current").length === 1
      && mapNodes[stage - 1]?.status === "current");
    const currentNodes = mapNodes.filter((node) => node.status === "current");
    const otherNodes = mapNodes.filter((node) => node.status !== "current");
    note(`第${stage}戦の強い枠は現在地だけ`, currentNodes.length === 1
      && currentNodes[0].borderWidth === "2px"
      && currentNodes[0].boxShadow !== "none"
      && otherNodes.every((node) => node.borderWidth === "1px"));
    if (stage === 1) {
      // issue #236 — 凡例は畳んだ「遠征のルール」の中へ移した。各節が aria-label と
      // title で自分の状態を名乗るので、本文からは外してある。**消してはいない。**
      const expeditionHelp = page.locator('details[data-help="expedition-rules"]');
      if (await expeditionHelp.count() && !(await expeditionHelp.evaluate((element) => element.open))) {
        await expeditionHelp.locator("summary").click();
        await page.waitForTimeout(120);
      }
      const legend = await page.locator(".map-legend").innerText();
      note("進行状態と精鋭・ボスの凡例が出る",
        /クリア済み/.test(legend) && /現在地/.test(legend) && /未到達/.test(legend)
          && /精鋭/.test(legend) && /ボス/.test(legend));
      note("精鋭・ボスが小さな記号で示される",
        mapNodes[2]?.marker === "◆" && mapNodes[3]?.marker === "★"
          && mapNodes[6]?.marker === "◆" && mapNodes[7]?.marker === "★"
          && mapNodes[10]?.marker === "◆" && mapNodes[11]?.marker === "★");
    }
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
      // issue #159 — 上端の盤面は `POSITIONS` そのままの3列×2行で、**空き枠も残す**。
      // iPhone 幅（390px）で横へはみ出さず、3列が画面内に収まる。
      const boardCells = await page.locator(".camp-top .party-cell").count();
      const boardFilled = await page.locator(".camp-top .party-cell:not(.empty)").count();
      const rosterSize = await page.locator('.camp-top [data-action="select-character"], '
        + '.camp-top .party-cell:not(.empty)').count();
      note("上端は3列×2行の隊列盤で、空き枠も残す",
        boardCells === 6 && boardFilled > 0 && boardFilled === rosterSize,
        boardFilled + "/" + boardCells);
      note("盤面が iPhone 幅に横スクロールせず収まる",
        await onScreen(".camp-top .party-board")
          && await page.locator(".camp-top .party-board").evaluate((board) =>
            board.scrollWidth <= board.clientWidth + 1));
      note("戦闘タブの主操作が画面上部にある",
        await page.locator(".map-primary-action .button").count() === 1
          && await onScreen(".map-primary-action .button"));
      note("敵情報を折りたためる",
        await page.locator("details.enemy-details").count() === 1
          && await page.locator("details.enemy-details > summary").count() === 1);
      // 予測カードの表示値を保存し、同じ戦闘のアニメーション最終フレームと突き合わせる。
      forecastAtStage1 = await page.locator(".forecast-bar").evaluate((bar) => ({
        result: ["win", "loss", "draw"].find((value) => bar.classList.contains(value)) ?? "",
        verdict: bar.querySelector(".forecast-verdict")?.textContent?.trim() ?? "",
        members: [...bar.querySelectorAll(".forecast-member")].map((member) => ({
          // 名前は顔の上へ重ねず、セルの aria-label に残す。予測値の対応確認だけは続ける。
          name: member.closest(".party-cell")?.getAttribute("aria-label")?.split(" · ")[0] ?? "",
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
    // issue #242 — この一戦で必殺が本当に出るかは、挑む前に盤面の ✹ が言っている。
    const ultimateFiresThisBattle = !ultimateCutInSeen
      && await page.locator(".camp-top .party-ultimate.firing").count() > 0;
    // issue #138 — 通常戦は「この敵に挑む」から戦闘前確認を挟まず自動戦闘へ進む。
    // Campaignの幕間会話は再訪でも出るため、該当戦では同じ通常レンダラーを閉じてから戦闘へ進む。
    await click("この敵に挑む");
    await page.waitForFunction(
      () => Boolean(document.querySelector(".vn-stage, .battle-field")),
      null,
      { timeout: 8000 },
    );
    if (await page.locator(".vn-stage").count() > 0) {
      note(`第${stage}戦前の幕間会話が出る`, true);
      await click("スキップ");
      await page.waitForTimeout(300);
    }
    await page.waitForSelector(".battle-field", { timeout: 8000 });
    if (stage === 1) {
      note("戦闘へ入ると画面の先頭（盤面）へ戻る", (await page.evaluate(() => window.scrollY)) === 0);
    }

    // issue #242 — 必殺の拍だけ、盤面を止めて立ち絵と技能名を出す。**拍の並びは
    // 決定的**なので、自動再生を止めて手送りで探す（実時間の速さに依存しない）。
    if (ultimateFiresThisBattle) {
      const toggle = page.locator('[data-role="replay-toggle"]');
      if ((await toggle.textContent())?.trim() === "一時停止") await toggle.click();
      await page.waitForTimeout(120);
      let cutInText = null;
      for (let step = 0; step < 400 && cutInText === null; step += 1) {
        if (await page.locator(".ultimate-cutin.show").count()) {
          cutInText = await page.locator(".ultimate-cutin").innerText();
          break;
        }
        const forward = page.locator('[data-role="replay-step"]');
        if (await forward.count() === 0 || await forward.isDisabled()) break;
        await forward.click();
      }
      ultimateCutInSeen = cutInText !== null;
      note(`第${stage}戦の必殺の拍でカットインが出る`,
        ultimateCutInSeen && /必殺・/.test(cutInText ?? "")
          && await page.locator(".ultimate-cutin .cutin-traits span").count() > 0
          && await page.locator(".battle-field.ultimate-hold").count() === 1,
        (cutInText ?? "").replace(/\n/g, " · "));
      // **演出は飛ばせる。**一手進めれば着弾の拍へ移り、盤面は元の明るさへ戻る。
      const forward = page.locator('[data-role="replay-step"]');
      if (ultimateCutInSeen && await forward.count() && !(await forward.isDisabled())) {
        await forward.click();
        await page.waitForTimeout(120);
        note("カットインは一手送りで抜けられる",
          await page.locator(".ultimate-cutin.show").count() === 0
            && await page.locator(".battle-field.ultimate-hold").count() === 0);
      }
    }

    if (stage === 1) {
      note("盤面に味方と敵の箱が出る", await page.locator(".unit").count() >= 4);
      barrierSamples = [await readBarrierUi()];
      hpGaugeSamples = [await readHpGaugeUi()];
      note("HPバーの上に防壁バーがある",
        barrierSamples[0].length >= 4 && barrierSamples[0].every((entry) => entry.hasFill));
      note("再生の操作が画面内にある", await onScreen(".replay-transport"));
      note("ログは既定で閉じている", !(await page.locator("details.debug-log").first().evaluate((d) => d.open)));
      // ダメージ値が実際に浮くところまで見る（拍が進んでいる証拠）。
      for (let i = 0; i < 150 && !sawAnimation; i += 1) {
        if (await page.locator(".float").count() > 0) sawAnimation = true;
        else await page.waitForTimeout(100);
      }
      note("ダメージ値が対象の上に浮かぶ", sawAnimation);
      await page.locator("details.battle-history.debug-log > summary").click();
      note("デバッグログを開ける", await page.locator(".debug-log .event").count() > 0);

      // 自動再生を止めて最後の拍まで手送りし、盤面に表示された最終HPを読む。
      // これで「予測が合っている」だけでなく、「実績を描くUIが同じ値を出す」ことを検査する。
      const toggle = page.locator('[data-role="replay-toggle"]');
      if (await toggle.count()) {
        const toggleLabel = await toggle.textContent();
        if (toggleLabel?.trim() === "一時停止") await toggle.click();
      }
      let beat = await readBeatCount();
      barrierSamples.push(await readBarrierUi());
      hpGaugeSamples.push(await readHpGaugeUi());
      let manualSteps = 0;
      while (beat && beat.current < beat.total && manualSteps < 1200) {
        const stepButton = page.locator('[data-role="replay-step"]');
        if (await stepButton.count() === 0 || await stepButton.isDisabled()) break;
        await stepButton.click();
        manualSteps += 1;
        beat = await readBeatCount();
        barrierSamples.push(await readBarrierUi());
        hpGaugeSamples.push(await readHpGaugeUi());
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
              // 味方カードでは名前を顔へ重ねない。対応付け用の名前は、表示専用の
              // `.unit-name` ではなく、カード自身のアクセシブルなラベルから読む。
              name: unit.getAttribute("aria-label")?.trim()
                ?? unit.querySelector(".unit-name")?.textContent?.trim()
                ?? "",
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
      const barrierUiParity = barrierSamples.length > 0
        && barrierSamples.every((sample) => sample.length > 0 && sample.every((entry) => {
          const expected = entry.maxHp > 0 && entry.barrier > 0
            ? Math.min(100, (entry.barrier / entry.maxHp) * 100)
            : 0;
          return entry.hasFill
            && Number.isFinite(entry.width)
            && entry.width >= -0.01
            && entry.width <= 100.01
            && Math.abs(entry.width - expected) < 0.01;
        }));
      note("リプレイの各スナップショットで防壁バーが追従する",
        barrierUiParity,
        barrierUiParity ? "" : JSON.stringify(barrierSamples.at(-1)));

      const hpGaugeUnits = hpGaugeSamples.flat();
      const radius = (value) => value === "999px";
      const hpGaugeUiParity = hpGaugeUnits.length > 0 && hpGaugeUnits.every((entry) => {
        const keys = ["green", "recovered", "recoverable", "unrecoverable"];
        const segments = keys.map((key) => entry.segments[key]);
        const visible = segments.map((segment) => segment.width > 0.01);
        const firstVisible = visible.findIndex(Boolean);
        let rightRound = -1;
        for (let index = 0; index < visible.length - 1; index += 1) {
          if (visible[index]) rightRound = index;
        }
        if (rightRound < 0) rightRound = firstVisible;
        const leftOk = firstVisible >= 0
          && radius(segments[firstVisible].topLeft)
          && radius(segments[firstVisible].bottomLeft);
        const rightOk = rightRound >= 0
          && radius(segments[rightRound].topRight)
          && radius(segments[rightRound].bottomRight);
        const innerBoundariesSquare = segments.every((segment, index) => {
          if (!visible[index]) return true;
          const nextVisible = visible.slice(index + 1).some(Boolean);
          return nextVisible && index !== rightRound
            ? !radius(segment.topRight) && !radius(segment.bottomRight)
            : true;
        });
        const totalWidth = segments.reduce((sum, segment) => sum + segment.width, 0);
        const contiguous = segments.every((segment, index) => index === 0
          || Math.abs(segment.left - (segments[index - 1].left + segments[index - 1].width)) < 0.05);
        return Math.abs(totalWidth - 100) < 0.05
          && contiguous
          && leftOk
          && rightOk
          && innerBoundariesSquare;
      });
      note("HPゲージの区分幅・連続性・角丸が各スナップショットに追従する",
        hpGaugeUiParity,
        hpGaugeUiParity ? "" : JSON.stringify(hpGaugeUnits.at(-1)));
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
    else await page.waitForSelector(".verdict h2", { timeout: 8000 });
    await page.waitForTimeout(200);
    const verdict = (await page.locator(".verdict h2").textContent())?.trim() ?? "";
    if (stage === 1 && forecastAtStage1) {
      const resultText = await bodyText();
      const forecastRounds = forecastAtStage1.verdict.match(/([0-9]+)ラウンド/)?.[1] ?? "";
      const actualRounds = resultText.match(/·\s*([0-9]+)ラウンド/)?.[1] ?? "";
      const expectedVerdict = forecastAtStage1.result === "win" ? "突破した" : "足を止めた";
      note("予測と結果画面の勝敗・ラウンドが一致する",
        verdict === expectedVerdict && forecastRounds === actualRounds,
        forecastAtStage1.verdict + " → " + verdict + " · " + (actualRounds || "?") + "ラウンド");
    }
    // issue #238 — 放ったら、その結果画面で「印を払った」と分かる。
    if (!ultimateSpentSeen) {
      const sealLine = (await bodyText())
        .match(/✹ ([^ ]+) が必殺技を放ちました。この遠征ではもう放てません。(まだ残しているのは ([^ ]+) です。|隊の全員が放ち終えました。)/);
      if (sealLine) {
        ultimateSpentSeen = true;
        // **誰が放って、誰がまだ残しているか**を名前で出す（人数では誰の一回か分からない）。
        note(`第${stage}戦で放った仲間と、残している仲間の名前が結果画面に出る`,
          sealLine[1].length > 0 && !sealLine[1].includes(sealLine[3] ?? "\u0000"), sealLine[0]);
      }
    }
    if (stage === 1) {
      // issue #177 — **装着順が結果にどう出たか**を、文ではなく帯で見せる。
      // アクティブは順送りに回るので、ラウンドごとに何が鳴ったかを並べれば読める。
      const turnRows = await page.locator(".turn-strip .turn-row").count();
      const turnCells = await page.locator(".turn-strip .turn-cell").evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("title") ?? ""));
      note("誰がいつ何を出したかが帯で出る", turnRows > 0 && turnCells.length > 0
        && turnCells.every((title) => /ラウンド目/.test(title)),
        `${turnRows}人・${turnCells.length}拍`);
      note("結果画面でもログは折りたたみ", await page.locator("details.debug-log").count() > 0);
      note("結果からアニメーションへ戻れる", await page.getByRole("button", { name: "戦闘をもう一度見る" }).count() > 0);
      note("結果画面の主操作が詳細より前で見える",
        await page.locator(".result-primary-action .button").count() >= 1
          && await onScreen(".result-primary-action .button")
          && await appearsBefore(".result-primary-action", ".result-actors"));
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

  // issue #212 — 完走時の stageEnd は、精算カードではなく通常の
  // 立ち絵つき一行送りへ入る。途中で再読み込みしても同じ行へ復帰し、
  // SKIP 後はすでに確定済みの精算へ戻る。
  if (await page.locator(".vn-stage").count() > 0) {
    const stageEndLine = await page.locator(".vn-text").getAttribute("data-full");
    note("Stage終了会話が通常の一行送りで始まる",
      await page.locator(".vn-figure .portrait-svg").count() > 0
        && await page.getByRole("button", { name: "AUTO" }).count() === 1
        && await page.getByRole("button", { name: "スキップ" }).count() === 1);
    await page.reload({ waitUntil: "networkidle" });
    note("Stage終了会話を再読み込みから再開できる",
      await page.locator(".vn-stage").count() === 1
        && await page.locator(".vn-text").getAttribute("data-full") === stageEndLine);
    await click("スキップ");
  }

  // R6 §9.2 — 精算は一度だけ。内訳と残高が画面に出る。
  const settleText = await bodyText();
  note("精算画面に着く", /活動資金/.test(settleText) && /内訳/.test(settleText));
  note("精算の内訳が出ている", /到達距離/.test(settleText) && /報酬倍率/.test(settleText));
  note("精算後の主操作が上部にある",
    await page.locator(".settlement-primary-action .button.primary").count() === 1
      && await onScreen(".settlement-primary-action .button.primary")
      && await appearsBefore(".settlement-primary-action", ".settle-list"));
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
    saved?.profile?.schemaVersion === "ecology-profile-2" && saved?.run?.schemaVersion === "ecology-run-4");
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
