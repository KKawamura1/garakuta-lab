// **R11 のチュートリアル経路を、画面の中で通しで踏む。**
//
// analysis/ecology-trial.mjs は旧・自由遠征（Free mode）の難易度 flow を見ている。
// R11 で本編に入った経路——最初の会話、勝てない一戦、巻き戻し、2人編成、
// pack の入口だけが出る技能ツリー、装備の報酬——は、そこを一度も通らない。
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

// 作者指摘 2026-09-12 —「少なくとも iPhone 16e ではスクロールなしで選べてほしい」。
// 実機の Safari は 390x844 の CSS viewport のうち上下のバーでおよそ 660px しか
// 残さないので、**画面の高さではなくこの予算**で収まりを見る（PR #255）。
const SAFARI_VISIBLE_HEIGHT = 660;

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

  // 画面の状態遷移は、Chromium の起動速度や公開先の応答で数秒揺れる。
  // 個別の8秒待ちだと content の変更がなくても断続的に落ちるため、
  // selector の待機予算を一箇所へ集約する。短い環境では環境変数で調整できる。
  const configuredSelectorTimeout = Number(process.env.ECOLOGY_TUTORIAL_SELECTOR_TIMEOUT_MS);
  const tutorialSelectorTimeout = Number.isFinite(configuredSelectorTimeout)
    && configuredSelectorTimeout > 0
    ? configuredSelectorTimeout
    : 20_000;
  const waitForTutorialSelector = (selector) => page.waitForSelector(selector, {
    state: "visible",
    timeout: tutorialSelectorTimeout,
  });

  // 会話は一行送りになった。**舞台を叩くと進む**（文字送りの途中なら、
  // 一度目の操作で全文が出る）。画面が変わるまで叩き続ける。
  const tapStory = async () => {
    const stage = page.locator(".vn-stage");
    if (await stage.count() === 0) return false;
    await stage.first().click({ position: { x: 12, y: 12 } });
    await page.waitForTimeout(140);
    return true;
  };
  const advanceStory = async (limit = 30) => {
    for (let index = 0; index < limit; index += 1) {
      if (!(await tapStory())) return;
    }
  };
  // 条件を満たすまで叩く。**文字送りの速さに検査を依存させない**
  // （一度目の操作で全文が出るので、叩く回数は行の長さで変わる）。
  // 上限は断片の行数の倍を見込む。**行が一つ増えただけで届かなくなる値にしない**
  // （検査したいのは条件が満たされることで、何回で満たされるかではない）。
  const tapUntil = async (predicate, limit = 24) => {
    for (let index = 0; index < limit; index += 1) {
      if (await predicate()) return true;
      if (!(await tapStory())) return predicate();
    }
    return predicate();
  };

  // 作者試遊 2026-09-13 — 再生は**決着の帯で止まる。**戦闘を畳むには二手を踏む。
  //   ［一気に決着へ］… VICTORY / DEFEAT の拍まで早送りして、そこで止まる
  //   ［次へ］        … 次の場面（結果画面・キャンプ・精算・序盤の会話）へ出る
  // 既に決着まで見ている（自動再生が流れきった）ときは前者が出ないので、
  // 出ているほうだけを押す。
  const rushToVerdict = async () => {
    const rush = page.locator('[data-action="replay-verdict"]:not([hidden])');
    if (await rush.count() === 0) return false;
    await rush.first().click();
    await page.waitForTimeout(120);
    return true;
  };
  const finishReplay = async () => {
    await rushToVerdict();
    const next = page.locator('[data-action="replay-result"]:not([hidden])');
    await next.first().waitFor({ state: "visible", timeout: tutorialSelectorTimeout });
    await next.first().click();
  };

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  note("Continueは初回は無効", await page.locator('[data-action="continue-game"][disabled]').count() === 1);
  note("タイトル画面はメニューだけを表示する",
    await page.locator(".title-screen").count() === 1
      && !/戦闘は自動で進みます|Stageを越えるたび|活動資金と設計図/.test(await bodyText()));
  note("タイトル画面に遠征開始ボタンを置かない",
    await page.getByRole("button", { name: "遠征を仕立てる" }).count() === 0);
  note("保存枠へ進める", await page.getByRole("button", { name: "セーブデータを選ぶ" }).count() === 1);
  // R10 — New Gameは必ずCampaign Stage 0のopeningから始める。
  await click("はじめから");

  // R13 — 最初の2人の会話。**ゴウとツグミの考え方の違いを見せる。**
  await waitForTutorialSelector(".vn-stage");
  const openingLine = await page.locator(".vn-text").getAttribute("data-full");
  // 画面の構造で見る。**台詞の中身ではなく、一行送りの箱が立っているか。**
  note("最初の会話が出る",
    await page.locator(".vn-stage").count() === 1
      && await page.locator(".vn-box").count() === 1
      && (await page.locator(".vn-text").innerText()).trim().length > 0);
  note("会話は飛ばせる", await page.getByRole("button", { name: "スキップ" }).count() > 0);

  // 立ち絵つきの一行送り。**喋っている人だけが前に出る。**
  note("立ち絵が出る", await page.locator(".vn-figure .portrait-svg").count() >= 2);
  note("喋っている人が前に出ている", await page.locator(".vn-figure.speaking").count() === 1);
  note("話者の名前が出る", /ゴウ/.test(await page.locator(".vn-name").innerText()));
  note("一行ずつ進む", /1 \/ \d/.test(await page.locator(".vn-progress").innerText()));
  note("次の行へ進む", await tapUntil(async () => await page.locator(".vn-name").count() > 0
    && /ツグミ/.test(await page.locator(".vn-name").innerText())));
  note("履歴に前の行が残る", await page.locator('[data-action="story-log"]:not([disabled])').count() === 1);

  // R11 §2.1 — 勝てない一戦。**演出ではなく、本当に負ける。**
  await advanceStory();
  const prologueText = await bodyText();
  note("序盤の一戦へ入る", /灰の門/.test(prologueText));
  // **序盤の一戦は、会話から途切れずにそのまま始まる。**preview を挟まない
  // （まだ preview の読み方を教えていない。教えるのは巻き戻したあと）。
  await waitForTutorialSelector(".battle-field");
  note("盤面に2人だけが並ぶ", await page.locator(".battle-field .unit.ally, .unit[data-side=\"ally\"]").count() <= 3);
  // R11 §5 改 — チュートリアルのあいだはタイトルへ戻る・撤退する導線を出さない。
  note("序盤の一戦のあいだは撤退できない",
    await page.getByRole("button", { name: "安全に撤退する" }).count() === 0);
  // **序盤の一戦の途中でリロードする。**この箱では、戦闘中のリロードで進行を
  // 失う不具合が過去に出ている。物語から入る経路も同じ踏み場を通す。
  await page.reload({ waitUntil: "networkidle" });
  await waitForTutorialSelector(".battle-field");
  note("序盤の一戦の途中でリロードしても戻ってくる", /灰の門/.test(await bodyText()));
  await page.locator('.speed-button[data-speed="fast"]').click();
  // R14 §1.1 — **巻き戻す前の一戦には戦闘予測を出さない。**まだ巻き戻す力を
  // 持っていないので、読めても直せない。
  note("巻き戻す前の一戦には予測を出さない", await page.locator(".forecast-bar").count() === 0);
  // R11 §8.6 改 / 作者試遊 2026-09-11 — 序盤は3拍で進む。**結果画面を挟まない。**
  //   打ち切り → 会話「届かなかった」の最後の拍に被さる［時間が巻き戻る］
  //   → 会話「もう一度、門の前」 → キャンプ → **同じ盤面をもう一度** → 勝利
  //
  // R12 — 倒れた会話は**再生を飛ばしても入る**。［一気に決着へ］→［次へ］で
  // 打ち切ってもここへ来る（以前は再生が流れきったときにしか入らなかった）。
  //
  // 作者試遊 2026-09-13 — **飛ばしても次の場面へは出ない。**再生は終点の拍で止まり、
  // 会話へ渡すのは［次へ］を押したときだけである。
  //
  // この一戦だけは `truncateAtFall` で**倒れた拍で切ってある**（R11 §5）ので
  // `battle_ended` が無く、DEFEAT の帯は出ない。終点は「ツグミが倒れた」である。
  // 勝敗の帯そのものは、巻き戻したあとの勝利で見る。
  await rushToVerdict();
  note("飛ばした先で止まる（戦闘画面から勝手に出ない）",
    await page.locator(".battle-field").count() === 1
      && /届かなかった/.test(await bodyText()) === false
      && /倒れた/.test((await page.locator(".beat-text").textContent()) ?? ""));
  note("終点で止まったら［次へ］だけが出る",
    await page.locator('[data-action="replay-result"]:not([hidden])').count() === 1
      && await page.locator('[data-action="replay-verdict"]:not([hidden])').count() === 0);
  // 押すまで待っても次の場面へ出ない（以前はここで自動的に会話へ渡っていた）。
  await page.waitForTimeout(1400);
  note("押さずに待っても次の場面へ進まない",
    await page.locator(".battle-field").count() === 1
      && await page.locator('[data-action="replay-result"]:not([hidden])').count() === 1);
  await page.locator('[data-action="replay-result"]').first().click();
  await page.waitForTimeout(300);
  note("倒れた拍で会話が入る", /届かなかった/.test(await bodyText()));
  // **門は最後の行でしか出ない**（途中の行で出すと、読み飛ばすための釦になる）。
  //
  // **叩いた回数に検査を縛らない**（CI 2026-09-14）。文字送りの途中で叩くと、その一度は
  // 「全文を出す」に使われて行は進まない。公開先の通しは回線ぶんだけ遅いので、
  // 一度叩いて 2 / 3 に居るとは限らなかった。**中ほどの行へ着くまで叩いてから見る。**
  const gateButton = page.locator(".vn-gate .vn-gate-button");
  const reachedMiddleLine = await tapUntil(async () =>
    /2 \/ 3/.test(await page.locator(".vn-progress").innerText()));
  note("門は途中の行では出ない",
    reachedMiddleLine && await page.locator(".vn-gate").count() === 0);
  // 作者試遊 2026-09-11（issue #200 の続き）— **スキップは門まで飛ばして止まる。**
  // 門は押すまで越えない拍なので、スキップだけが越えられるのは筋が通らない。
  // 飛ばした行も履歴へ残るので、巻き戻しの逆走はその行を材料にできる。
  await click("スキップ");
  await page.waitForTimeout(300);
  note("スキップは門まで飛ばして止まる（越えない）",
    await gateButton.count() === 1 && await gateButton.isVisible()
      && /届かなかった/.test(await bodyText())
      && /3 \/ 3/.test(await page.locator(".vn-progress").innerText()));
  await page.locator('[data-action="story-log"]').first().click();
  await page.waitForTimeout(200);
  note("スキップで飛ばした行も履歴に残る", await page.locator(".vn-log-line").count() === 3);
  await page.locator('.vn-log [data-action="story-log"]').click();
  await page.waitForTimeout(200);
  note("序盤の一戦で負ける", /届かなかった/.test(await bodyText()));
  // **システム画面の一項目にしない。**結果画面（勝敗カード）を挟まず、会話の舞台に
  // 被せて出す。ど真ん中に一つだけで、ほかの操作を並べない。
  note("結果画面を挟まない",
    await page.locator(".verdict").count() === 0 && await page.locator(".vn-stage").count() === 1);
  note("釦は舞台に被さっている",
    await page.locator(".vn-stage .vn-gate").count() === 1
      && await page.locator(".vn-gate .button").count() === 1);
  note("門のあいだは進む合図を出さない",
    await page.locator(".vn-caret").count() === 0 && await page.locator(".vn-hint").count() === 0);
  // 舞台を叩いても越えられない。**押して越える拍である。**
  // 叩くのは舞台の隅（釦の上ではない）。門は舞台に被さっているので、隅を叩くと
  // 門の面が受け、そのまま舞台の「叩いて進む」へ落ちる——そこで止まることを見る。
  await tapStory();
  await page.waitForTimeout(250);
  note("舞台を叩いても門は越えない",
    await gateButton.count() === 1 && /届かなかった/.test(await bodyText()));

  // R11 §2.1 — 巻き戻し。敗北後は「もう一度、門の前」へ戻る。
  //
  // issue #200 — **押した瞬間に次の会話へ飛ばない。**読んだ行を逆順に消しながら
  // 画面ごと逆走する演出が一度だけ入り、それが終わってから会話が始まる。
  // ここで見るのは「演出が出る」「そのあいだ会話へ進んでいない」「逆走が、いま読んだ
  // 行を後ろから消している」「放っておけば自分で会話へ渡る」の四つである。
  const lastReadLine = await page.locator(".vn-text").getAttribute("data-full");
  await gateButton.click();
  await waitForTutorialSelector(".vn.rewind .rewind-stage");
  note("巻き戻しの演出が入る",
    await page.locator(".vn.rewind .rewind-stage").count() === 1
      && await page.locator(".rewind-mark").isVisible());
  note("演出のあいだは次の会話へ進まない", !/もう一度、門の前/.test(await bodyText()));
  // 逆走は末尾から消していくので、途中で捕らえた文字列は必ず読んだ行の前方一致になる。
  // **台詞の中身に検査を縛らない**（行を書き換えても、この性質は変わらない）。
  const reversedLine = await page.waitForFunction(() => {
    const shown = document.querySelector(".rewind-text")?.textContent ?? "";
    return shown.trim().length > 0 ? shown : false;
  }, null, { timeout: tutorialSelectorTimeout }).then((handle) => handle.jsonValue());
  note("逆走はいま読んだ行を後ろから消す",
    typeof lastReadLine === "string" && lastReadLine.startsWith(reversedLine),
    reversedLine);
  // 演出が流れきれば、押さなくても巻き戻し後の会話へ渡る。
  await page.waitForFunction(() => document.body.innerText.includes("もう一度、門の前"),
    null, { timeout: tutorialSelectorTimeout });
  const rewindText = await bodyText();
  note("巻き戻しの会話が出る", /もう一度、門の前/.test(rewindText));
  note("演出は一度だけで、会話には残らない", await page.locator(".vn.rewind").count() === 0);
  // 門の釦は、その下の舞台（story-advance）も鳴らしてしまう位置にある。止めていないと
  // 一押しで巻き戻しと「叩いて進む」が続けて起き、**時間が戻ったことを見せる一行目**
  // （「同じ朝。同じ光。」）が読み飛ばされる。
  note("巻き戻しの会話は一行目から始まる",
    /(^|[^\d])1 \/ \d/.test(await page.locator(".vn-progress").innerText()),
    await page.locator(".vn-progress").innerText());
  // 学びの一言は断片の最後の行で出る。**そこまで進めてから見る。**
  // R11 §8.6 — ここで渡すのは「武器と技の違いは立つ場所の違い」である。
  const sawNote = await tapUntil(async () => await page.locator(".vn-note").count() > 0);
  note("武器と技の違いを渡す", sawNote && /後列/.test(await bodyText()));
  await advanceStory();

  // R11 §2.1 — 2人編成。**誰が来るかは物語が決める。**
  const campText = await bodyText();
  note("キャンプに着く", /スキル|遠征/.test(campText));
  // issue #159 — 固定同行者の区画では人数を N/M で出さない（分母は「まだ入れられる」
  // と読めるが、その回は誰も足せない）。
  note("2人で始まる", await page.locator(".camp-top .party-cell:not(.empty)").count() === 2);
  // R14 §1 — 巻き戻したあとは、camp の上端に戦闘予測が常設される。
  // **予測が指すのは「灰の門」**である（12戦の第1戦ではない。同じ盤面をもう一度戦う）。
  note("巻き戻したあとは予測が出る", await page.locator(".camp-top .forecast-bar").count() === 1);
  note("予測は同じ盤面（灰の門）を指す",
    /灰の門/.test(await page.locator(".camp-top .forecast-title").innerText()));
  const rewoundVerdict = await page.locator(".camp-top .forecast-verdict").first().innerText();
  note("巻き戻し直後は負けた配置を引き継ぐ", /敗北/.test(rewoundVerdict), rewoundVerdict);
  note("各メンバーのHPと減少量が出ている",
    await page.locator(".forecast-member .forecast-hp-values").count() === 2
      && await page.locator(".forecast-member .forecast-delta").count() === 2);
  // issue #159 — 上端は `POSITIONS` そのままの3列×2行。**5人未満でも空き枠を残す**
  // ので、枠は常に6つあり、そのうち2つに人が入っている。
  note("上端は3列×2行の隊列盤で、空き枠も残る",
    await page.locator(".camp-top .party-board .party-row").count() === 2
      && await page.locator(".camp-top .party-cell").count() === 6
      && await page.locator(".camp-top .party-cell.empty").count() === 4);

  // ---- R11 §5 改（作者指摘 2026-09-12）— **手取りの隊列チュートリアル** ----------
  //
  // ここがチュートリアルの山である。engine は決定的なので、**隊列を直さなければ
  // 何度やっても同じように負ける。**ツグミを後列へ下げた一手だけが勝ちに変わる。
  // 会話が渡した「柔らかい技は後ろ、硬い武器は前」を、実際に操作して確かめる。
  //
  // その一手は**押す場所が光り、そこしか押せない**形で教える。三手が終わるまで
  // タブもセーブも押せないので、**この踏み場は camp へ着いた直後に置く**
  // （錠が外れるまでは、他の踏み場へ寄り道できない）。
  const blockedCount = async () => await page.locator("#app .tutorial-blocked").count();
  const spot = () => page.locator("#app .tutorial-spot");
  note("巻き戻し直後は隊列チュートリアルが出る",
    await page.locator(".formation-tutorial").count() === 1
      && /隊列チュートリアル/.test(await bodyText()));
  // 作者指摘 2026-09-15 — **貼りついた札の手前へ、何も来ない。**
  // 全戦盤は上端と同じ窓になり、見出しが z-index を持った。窓の中で重なりを閉じないと、
  // 札の下をくぐるはずの見出しが札の手前へ出る（札と同じ z-index 2 で、DOM 上は後）。
  // 送り具合で重なり方が変わるので、**実際に重なった位置だけ**を見て、その点の
  // 一番手前が札かを確かめる。
  let overlapSeen = false;
  let overlapOk = true;
  for (const offset of [80, 120, 160, 200]) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "auto" }), offset);
    await page.waitForTimeout(150);
    const seen = await page.evaluate(() => {
      const card = document.querySelector(".camp-view > .tutorial-note-card.pinned");
      const head = document.querySelector(".encounter-archive .encounter-console");
      if (!card || !head) return null;
      const cardBox = card.getBoundingClientRect();
      const headBox = head.getBoundingClientRect();
      if (headBox.bottom < cardBox.top || headBox.top > cardBox.bottom) return null;
      return [0.2, 0.5, 0.8].every((ratio) => {
        const element = document.elementFromPoint(
          headBox.left + headBox.width * ratio,
          Math.min(headBox.top + headBox.height / 2, cardBox.bottom - 2),
        );
        return Boolean(element) && (element === card || card.contains(element));
      });
    });
    if (seen === null) continue;
    overlapSeen = true;
    if (!seen) overlapOk = false;
  }
  note("貼りついた手引きの札の手前へ全戦盤の見出しが出ない", overlapSeen && overlapOk,
    overlapSeen ? "" : "重なる送り位置が見つからなかった");
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
  await page.waitForTimeout(200);
  note("手順1は「⇅ 隊列」だけが光る",
    await spot().count() === 1
      && await spot().first().getAttribute("data-action") === "toggle-formation-mode");
  note("手順1では他のタブを押せない",
    await page.locator('nav.tabs [data-tab="skills"]').isDisabled()
      && await page.locator('nav.tabs [data-tab="equipment"]').isDisabled());
  note("手順1では戦闘へ進めない",
    await page.locator('[data-action="begin-stage"]').isDisabled()
      && await blockedCount() > 0);
  // 光っていない場所は押しても何も起きない（押せる形と経路の両方で塞いでいる）。
  await page.locator('[data-action="begin-stage"]').click({ force: true }).catch(() => {});
  await page.waitForTimeout(150);
  note("光っていない場所を押しても戦闘は始まらない",
    await page.locator(".battle-field").count() === 0
      && await page.locator(".formation-tutorial").count() === 1);

  // issue #235 — 編成タブは廃止した。隊列はどのタブからでも上端の「⇅ 隊列」で入る。
  await page.locator('.camp-top [data-action="toggle-formation-mode"]').click();
  await page.waitForTimeout(150);
  // R14 §1 — **予測は隊列を動かした瞬間に付いてくる。**
  //
  // 巻き戻した直後は、最初に負けた配置（ツグミもゴウも前列）を引き継ぐ。
  // ここで既に「勝利」が出ていたら、何も変えずに勝てる抜け道が残っている。
  const verdict = async () => (await page.locator(".forecast-verdict").first().innerText());
  const wrongVerdict = await verdict();
  note("負けた配置のままでは予測が敗北", /敗北/.test(wrongVerdict), wrongVerdict);

  // issue #159 / #235 — 隊列は**上端の共通盤面からしか**動かせない。二つ目の隊列盤も
  // キャラクターカードも無い（同じ仲間を選ぶ表示が複数あると、どこで何を選んだのかを
  // 画面ごとに探し直すことになる）。
  // UIでは顔を主役にするため、セル内へ名前を描画しない。人物の対応付けは
  // 表示文言ではなく、画面が持つ安定した character id で行う。
  const menderCell = page.locator('.camp-top .party-cell[data-character="mender"]').first();
  note("上端の盤面のセルが隊列操作そのものである",
    await menderCell.getAttribute("data-action") === "place-character");
  note("手順2は動かす仲間のセルだけが光る",
    await spot().count() === 1
      && await spot().first().getAttribute("data-character") === "mender");
  note("手順2では前列のゴウを押せない",
    await page.locator('.camp-top [data-action="place-character"][data-character="warden"]')
      .isDisabled());
  await menderCell.click();
  await page.waitForTimeout(150);
  note("押した仲間のセルが選択状態になる",
    await page.locator('.camp-top .party-cell.selected').count() === 1
      && /移動先の枠へ/.test(await bodyText()));
  note("手順3は後列の空き枠だけが光る",
    await spot().count() === 3
      && (await spot().evaluateAll((cells) =>
        cells.every((cell) => cell.dataset.row === "rear" && !cell.dataset.character))));
  await page.locator('.camp-top [data-action="place-character"][data-position="rear_right"]').click();
  await page.waitForTimeout(200);
  const placedText = await bodyText();
  note("ツグミを後列へ下げられる",
    await page.locator('.camp-top .party-row').nth(1)
      .locator('.party-cell[data-character="mender"]').count() === 1);
  // 錠が外れた盤面では、同じ `selected` が「いま中身を見ている人」を指す。
  // ここで見るのは**隊列の選択**が解けたかどうかなので、置く操作の側で数える。
  note("移動を終えると隊列の選択が解ける",
    await page.locator('.camp-top [data-action="place-character"].selected').count() === 0
      && !/移動先の枠へ/.test(placedText));
  // **一手戻すと、その場で予測が勝利へ変わる。**これがこの遠征の中心の操作である。
  const rightVerdict = await verdict();
  note("一手直すとその場で予測が勝利へ変わる", /勝利/.test(rightVerdict), rightVerdict);
  // 教え終わったら錠は外れる。**教えるのは一手であって、遠征の触り方ではない。**
  note("一手が済むと錠が外れる",
    await blockedCount() === 0
      && !(await page.locator('nav.tabs [data-tab="skills"]').isDisabled()));
  note("一手が済むと盤面は通常へ戻る",
    await page.locator('.camp-top [data-action="place-character"]').count() === 0
      && await page.locator('.camp-top [data-action="select-character"]').count() === 2);
  note("次の一押し（この敵との実戦へ進む）が光る",
    await spot().count() === 1
      && await spot().first().getAttribute("data-action") === "begin-stage");
  // issue #138 / #235 — 戦闘前確認の画面（battlePreview）を無くしたので、巻き戻し直後に
  // 開く遠征タブで武器と技の違いをもう一度渡す。
  note("戦闘予測の使い方を示す",
    /戦闘予測/.test(placedText)
      && /腕力で振る武器は後列から出すと大きく落ち|技術で通す技は落ちない|後列/.test(placedText));
  note("ツグミが自分ではなくゴウを手当てすると示す",
    /応急手当は自分には効かず、被弾したゴウを後ろから手当てできる/.test(placedText));

  // issue #235 / 作者要望 2026-09-14 — 同行者を選べる場面がないため、欄ごと表示しない。
  note("固定の回は同行者の候補カードを出さない",
    await page.locator(".character-card").count() === 0
      && !/今回の同行者|同行者/.test(await bodyText()));

  // タブを変えても消えない（組み替えながら見るための帯である）。
  await page.locator('nav.tabs [data-tab="equipment"]').click();
  await page.waitForTimeout(150);
  note("装備タブでも予測が消えない", await page.locator(".camp-top .forecast-bar").count() === 1);
  const equipmentHelp = page.locator('details[data-help="equipment-rules"]');
  if (await equipmentHelp.count()) await equipmentHelp.locator("summary").click();
  // 作者要望 2026-09-13 — ルールは段落から記号つきの段へ移した。同じ事実を、
  // 段の綴り（見出し「付け外し」＋値「何度でも」）で見る。
  const equipmentRuleText = await bodyText();
  note("装備は自由に付け外しできると書いてある",
    /付け外し/.test(equipmentRuleText) && /何度でも/.test(equipmentRuleText));

  // ---- 作者要望 2026-09-17 — **補給チュートリアルより前は、補給が動かない。** ----
  //
  // 補給チュートリアル（二戦目の後）は「集中治療へ1個使う」まで進まないと錠が外れず、
  // そのあいだ他タブも撤退も閉じている。**そこへ補給0で着くと詰む。**着き方は
  // 一戦目の再挑戦だけではなく、二戦目の前の全体手当・二戦目の再挑戦もあった。
  // 用途を一つずつ塞ぐのをやめ、手引きより前は補給タブごと閉じている。
  note("手引きより前は補給タブが押せない",
    await page.locator('nav.tabs [data-tab="supplies"]').isDisabled());
  await page.locator('nav.tabs [data-tab="supplies"]').click({ force: true }).catch(() => {});
  await page.waitForTimeout(150);
  note("押しても補給の画面へ入れない",
    await page.locator(".supplies-head").count() === 0
      && await page.locator('[data-action="treat"]').count() === 0);
  note("補給の残りはタブの札で読める",
    /3\/3/.test(await page.locator('nav.tabs [data-tab="supplies"]').innerText()));

  // R10 / issue #235 — Campではオートセーブとは別に手動枠へ保存できる。
  // セーブは遠征タブが持つ（**離脱ではないので、物語の最中でも触れる**）。
  await page.locator('nav.tabs [data-tab="map"]').click();
  await page.waitForTimeout(150);
  note("物語の最中でも撤退はできない",
    await page.getByRole("button", { name: "安全に撤退する" }).count() === 0);
  await click("セーブ / ロード");
  note("セーブ画面へ進める", /セーブ \/ ロード/.test(await bodyText()));
  await page.locator('[data-action="save-slot"][data-slot="1"]').click();
  await page.waitForTimeout(200);
  note("手動セーブ枠へ保存できる", /手動セーブ枠 1 に保存しました/.test(await bodyText()));
  await page.locator('[data-action="load-slot"][data-slot="1"]').click();
  await page.waitForTimeout(200);
  note("手動セーブからCampへ戻れる", await page.locator(".camp-top .forecast-bar").count() === 1);

  // Stage 5 h — 390px 幅で人物ごとの武器技能一覧を確認する。
  // 旧skill tree / level / pack UIはすでに切り替え済みなので、今の武器Run操作と
  // 初期20節の表示境界、そしてStage 0で必殺を見せないことを実際のDOMで確かめる。
  await page.locator('nav.tabs [data-tab="skills"]').click();
  const skillHelp = page.locator('details[data-help="stage5-skill-rules"]');
  if (await skillHelp.count()) await skillHelp.locator("summary").click();
  const skillText = await bodyText();
  const stage5Nodes = page.locator(".stage5-skill-card");
  note("初期20節だけが技能一覧に出る", await stage5Nodes.count() === 20,
    `節 ${await stage5Nodes.count()}`);
  note("Stage 5の主軸・反応・常時の区分が出る",
    await page.locator(".stage5-kind.kind-active").count() > 0
      && await page.locator(".stage5-kind.kind-reactive").count() > 0
      && await page.locator(".stage5-kind.kind-passive").count() > 0);
  note("人物ごとの主軸・反応優先列・常時技能が読める",
    /主軸/.test(skillText) && /反応優先列/.test(skillText) && /常時/.test(skillText));
  note("技能一覧に旧skill treeとskill levelの操作が無い",
    await page.locator('[data-action="select-skill-kind"], [data-action="select-skill-view"], [data-action="level-skill"]').count() === 0);
  note("Stage 0では必殺技の長押しが無い",
    await page.locator(".stage5-skill-select[data-longpress]").count() === 0);
  note("Stage 0では必殺技の残りと説明を出さない",
    await page.locator(".camp-top .party-ultimate").count() === 0
      && await page.locator('details[data-help="ultimate-rules"]').count() === 0
      && !/必殺/.test(skillText));
  note("取得・予約・主軸・反応優先順位の操作がある",
    await page.locator('[data-action="acquire-weapon-skill"]').count() > 0
      && await page.locator('[data-action="reserve-weapon-skill"]').count() > 0
      && await page.locator('[data-action="select-weapon-primary"]').count() > 0
      && await page.locator('[data-action="move-weapon-priority"]').count() > 0);
  const stage5Shape = await page.locator(".stage5-skill-catalog").evaluate((catalog) => ({
    overflow: catalog.scrollWidth - catalog.clientWidth,
    cards: [...catalog.querySelectorAll(".stage5-skill-card")].filter((card) => {
      const box = card.getBoundingClientRect();
      return box.left >= -1 && box.right <= window.innerWidth + 1;
    }).length,
    total: catalog.querySelectorAll(".stage5-skill-card").length,
  }));
  note("390pxの技能一覧が横へはみ出さない",
    stage5Shape.overflow <= 1 && stage5Shape.cards === stage5Shape.total,
    `${stage5Shape.cards} / ${stage5Shape.total}節 · ${stage5Shape.overflow}px`);
  const stickyBands = await page.evaluate(() => [...document.querySelectorAll(".camp-view *")]
    .filter((element) => {
      const style = getComputedStyle(element);
      if (style.position !== "sticky") return false;
      const box = element.getBoundingClientRect();
      return box.height > 0 && box.width > window.innerWidth / 2;
    })
    .map((element) => (typeof element.className === "string" ? element.className.split(" ")[0] : element.tagName)));
  note("技能点の帯を別のsticky要素として増やさない", !stickyBands.includes("skill-build-summary"),
    stickyBands.join(" / ") || "なし");

  // ---- issue #159 — **仲間を選ぶ経路は上端の盤面ただ一つ。**技能タブ・装備タブは
  // 自前の仲間タブを持たず、盤面のセルで対象を切り替える。押しても隊列は動かない。
  note("技能タブに二つ目の仲間タブが無い", await page.locator(".member-tabs").count() === 0);
  const skillTargetCells = page.locator('.camp-top [data-action="select-character"]');
  note("技能タブでは盤面が人物選択になる", await skillTargetCells.count() === 2);
  const skillFormationBefore = await page.locator('.camp-top .party-cell').allTextContents();
  const otherSkillCell = page.locator('.camp-top [data-action="select-character"]:not(.selected)').first();
  const otherSkillName = (await otherSkillCell.getAttribute("aria-label") ?? "").split(" · ")[0];
  await otherSkillCell.click();
  await page.waitForTimeout(200);
  note("技能タブで対象人物を盤面から切り替えられる",
    Boolean(otherSkillName)
      && (await page.locator(".member-context .character-panel-name").innerText()).includes(otherSkillName)
      && (await page.locator('.camp-top .party-cell.selected').getAttribute("aria-label") ?? "")
        .startsWith(otherSkillName));
  note("技能タブで押しても隊列は動かない",
    JSON.stringify(await page.locator('.camp-top .party-cell').allTextContents())
      === JSON.stringify(skillFormationBefore));

  await page.locator('nav.tabs [data-tab="equipment"]').click();
  await page.waitForTimeout(200);
  note("装備タブに二つ目の仲間タブが無い", await page.locator(".member-tabs").count() === 0);
  note("装備タブは前のタブで選んだ人物を引き継ぐ",
    (await page.locator(".member-context .character-panel-name").innerText()).includes(otherSkillName));
  const equipmentOtherCell = page.locator('.camp-top [data-action="select-character"]:not(.selected)').first();
  const equipmentOtherName = (await equipmentOtherCell.getAttribute("aria-label") ?? "").split(" · ")[0];
  const equipmentFormationBefore = await page.locator('.camp-top .party-cell').allTextContents();
  await equipmentOtherCell.click();
  await page.waitForTimeout(200);
  note("装備タブで装備対象を盤面から切り替えられる",
    Boolean(equipmentOtherName)
      && (await page.locator(".member-context .character-panel-name").innerText()).includes(equipmentOtherName));
  note("装備タブで押しても隊列は動かない",
    JSON.stringify(await page.locator('.camp-top .party-cell').allTextContents())
      === JSON.stringify(equipmentFormationBefore));
  await page.locator('nav.tabs [data-tab="skills"]').click();
  await page.waitForTimeout(150);

  // ---- 作者要望 2026-09-17 — **一戦目の再挑戦は補給を取らない。** --------------
  //
  // 負ける配置を作り直すと隊列チュートリアルの錠が戻ってしまうので、敗北画面だけを
  // 保存へ置いて入る（見たいのは再挑戦の値段であって、負け方ではない）。
  await page.evaluate(() => {
    const key = "exp18-r10-auto-v02";
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (!saved?.run) return;
    saved.phase = "defeat";
    saved.lastResult = {
      result: "loss", roundsUsed: 5, reason: "party_wiped",
      metrics: { allyHpLost: 410, enemyHpLost: 120, reactionsFired: 1, equipmentWear: 0 },
      actors: [], equipment: [], events: [],
    };
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const firstDefeatText = await bodyText();
  note("一戦目で負けても再挑戦の手が残る", /編成を変えて再挑戦/.test(firstDefeatText));
  note("一戦目の再挑戦に補給の値段が付かない", !/補給1で編成を変えて再挑戦/.test(firstDefeatText));
  note("敗北画面が、止まった一戦の名前と番号を揃えて出す",
    /灰の門 · 第1戦/.test(firstDefeatText),
    firstDefeatText.match(/.{0,6}· 第\d+戦/)?.[0] ?? "");
  note("払わないことを敗北画面が言う",
    /補給を使うのは補給チュートリアルからです/.test(firstDefeatText));
  await click(/編成を変えて再挑戦/);
  await page.waitForTimeout(350);
  note("一戦目の再挑戦で補給が減らない",
    /3\/3/.test(await page.locator('nav.tabs [data-tab="supplies"]').innerText()));

  // ---- R11 §8.6 — 巻き戻したあとの再戦。**同じ盤面をもう一度戦う。**
  //
  // 隊列を直す一手は、camp へ着いた直後の手取りチュートリアルで既に踏んだ。
  // ここは**直した配置のまま、同じ盤面へ入り直す**ところだけを見る。
  // issue #138 — チュートリアルの再戦も含め、常に戦闘前確認を挟まず自動戦闘へ進む。
  await page.locator('nav.tabs [data-tab="map"]').click();
  await click("この敵との実戦へ進む");
  await waitForTutorialSelector(".battle-field");
  await page.locator('.speed-button[data-speed="fast"]').click();
  // 作者試遊 2026-09-13 — ［一気に決着へ］の行き先は **VICTORY の帯**である。
  // そこで止まり、帯は押すまで消えない（流れて消えると勝敗を読み落とす）。
  await rushToVerdict();
  note("飛ばした先が VICTORY の帯になる",
    await page.locator(".battle-banner.show.win.hold").count() === 1
      && /VICTORY/.test(await page.locator(".battle-banner").innerText())
      && await page.locator(".battle-field").count() === 1);
  await page.waitForTimeout(1200);
  note("VICTORY の帯は押すまで消えない",
    await page.locator(".battle-banner.show.win").count() === 1
      && await page.evaluate(() => {
        const word = document.querySelector(".battle-banner b");
        return word ? Number(getComputedStyle(word).opacity) > .9 : false;
      }));
  note("決着で止まったら前進の釦は［次へ］だけ",
    await page.locator('[data-action="replay-result"]:not([hidden])').count() === 1
      && await page.locator('[data-action="replay-verdict"]:not([hidden])').count() === 0);
  await page.locator('[data-action="replay-result"]').first().click();
  await page.waitForTimeout(300);
  // 勝つと「同じ影、違う結果」の会話が入る。**結果画面より先にここへ来る。**
  note("隊列を直すと同じ盤面に勝てる", /同じ影、違う結果/.test(await bodyText()));
  await advanceStory();
  await page.waitForTimeout(200);
  // R11 §5 改 — **序盤の演出はここで終わる。**巻き戻したあとの勝利は、そのまま
  // 本編第1戦の勝利になる（以前はここで一度キャンプへ戻し、フルスペックの
  // 「灰の入口」をもう一度戦わせてから報酬を出していた）。
  //
  // PR #255 — 第1戦は通常戦なので装備の候補は出ない。**結果画面も挟まず**、
  // そのままキャンプへ戻り、直前の一戦の一行と補給チュートリアルが出る。
  const resultAfterWinText = await bodyText();
  note("巻き戻しての勝利がそのまま本編第1戦になる",
    !/この一戦は遠征に数えません/.test(resultAfterWinText));
  const completedEncounter = page.locator(
    '.encounter-archive [data-action="inspect-encounter"][data-encounter="1"]');
  const completedEncounterLabel = await completedEncounter.getAttribute("aria-label") ?? "";
  const won = /クリア済み/.test(completedEncounterLabel);
  note("第1戦を突破する", won, completedEncounterLabel);
  note("通常戦の勝利は結果画面を挟まずキャンプへ戻る",
    won && await page.locator(".reward-choices").count() === 0
      && await page.locator("nav.tabs").count() === 1);
  if (won) {
    // ---- 作者要望 2026-09-14 — **一戦目の後は技能の取得・予約。** ----------------
    //
    // 教える順は「一戦目前: 隊列 → 一戦目後: 技能 → 二戦目後: 補給」。ここは
    // その二つ目で、**入った1点をその場で使わせる**七手を踏む。押す場所はタブ・
    // 上端の盤面・技能ツリーの節・地図の下端に貼りつく操作盤に散っているので、
    // **どこを押すのかが段の側に無いと探し回る**（作者指摘 2026-09-14、二度目）。
    {
      const skillTab = page.locator('nav.tabs [data-tab="skills"]');
      const mapTabDuringSkill = page.locator('nav.tabs [data-tab="map"]');
      const skillCard = page.locator(".skill-tutorial");
      const skillSpot = () => page.locator("#app .tutorial-spot");
      const unlockKey = "warhammer:R";
      const reserveKey = "warhammer:A1";
      const pointsReadout = () => page.locator(".stage5-member-line").innerText();
      note("第1戦の直後は遠征タブのまま、技能の札が出る",
        await page.locator('nav.tabs [data-tab="map"].active').count() === 1
          && await skillCard.count() === 1);
      note("Stage 5技能チュートリアルは七手で、最初に技能タブを開く",
        /手順 1\/7/.test(await skillCard.innerText())
          && await skillSpot().count() === 1
          && await skillSpot().first().getAttribute("data-tab") === "skills");
      note("手順1では戦闘へ進めない",
        await page.locator('[data-action="begin-stage"]').isDisabled());
      await page.locator('nav.tabs [data-tab="equipment"]').click({ force: true }).catch(() => {});
      await page.waitForTimeout(150);
      note("光っていないタブを押しても技能チュートリアルに留まる",
        /手順 1\/7/.test(await skillCard.innerText())
          && await page.locator('nav.tabs [data-tab="map"].active').count() === 1);
      await skillSpot().first().click();
      await page.waitForTimeout(200);
      note("スキルタブを押すと技能一覧へ入る",
        await skillTab.evaluate((tab) => tab.classList.contains("active"))
          && /手順 2\/7/.test(await skillCard.innerText()));
      note("チュートリアル中は遠征と補給タブを閉じる",
        await mapTabDuringSkill.isDisabled()
          && await page.locator('nav.tabs [data-tab="supplies"]').isDisabled());
      note("札は固定帯の下へ貼りつく",
        await page.locator(".camp-view > .tutorial-note-card").evaluate((card) =>
          getComputedStyle(card).position === "sticky"));
      note("手順2は払う相手（ツグミ）のセルだけが光る",
        await skillSpot().count() === 1
          && await skillSpot().first().getAttribute("data-action") === "select-character"
          && await skillSpot().first().getAttribute("data-character") === "mender");
      await skillSpot().first().click();
      await page.waitForTimeout(200);
      note("ツグミを選ぶと人物別技能一覧へ切り替わる",
        /ツグミ/.test(await page.locator(".stage5-member-line").innerText())
          && /手順 3\/7/.test(await skillCard.innerText()));
      note("手順3は取得する武器節だけが光る",
        await skillSpot().count() === 1
          && await skillSpot().first().getAttribute("data-action") === "select-weapon-node"
          && await skillSpot().first().getAttribute("data-node") === unlockKey);
      await page.locator(`.stage5-skill-card[data-node-key="${reserveKey}"] [data-action="select-weapon-node"]`)
        .click({ force: true }).catch(() => {});
      await page.waitForTimeout(150);
      note("光っていない節を押しても段は進まない",
        /手順 3\/7/.test(await skillCard.innerText()));
      await skillSpot().first().click();
      await page.waitForTimeout(250);
      note("手順4は武器節の取得操作だけが光る",
        /手順 4\/7/.test(await skillCard.innerText())
          && await skillSpot().count() === 1
          && await skillSpot().first().getAttribute("data-action") === "acquire-weapon-skill"
          && await skillSpot().first().getAttribute("data-node") === unlockKey);
      const pointsBefore = /未使用 1点/.test(await pointsReadout());
      await page.setViewportSize({ width: 390, height: SAFARI_VISIBLE_HEIGHT });
      await page.waitForTimeout(200);
      const unlockSpotBox = await skillSpot().first().boundingBox();
      note("660pxの表示高でも次の取得操作が画面内にある",
        Boolean(unlockSpotBox) && unlockSpotBox.y >= 0 && unlockSpotBox.y + unlockSpotBox.height <= SAFARI_VISIBLE_HEIGHT,
        unlockSpotBox ? `${Math.round(unlockSpotBox.y)}–${Math.round(unlockSpotBox.y + unlockSpotBox.height)}px` : "対象なし");
      await page.setViewportSize({ width: 390, height: 844 });
      await skillSpot().first().click();
      await page.waitForTimeout(250);
      const pointsAfter = /未使用 0点/.test(await pointsReadout());
      note("取得で人物の技能点が1点減る", pointsBefore && pointsAfter);
      note("取得した主軸技能がその場で使用中になる",
        await page.locator(`.stage5-skill-card[data-node-key="${unlockKey}"] .stage5-state`).innerText()
          === "主軸に設定中");
      note("手順5は次に予約する節だけが光る",
        /手順 5\/7/.test(await skillCard.innerText())
          && await skillSpot().count() === 1
          && await skillSpot().first().getAttribute("data-node") === reserveKey);
      note("いま予約する理由を札が説明する",
        /今ある点は使い切りました/.test(await skillCard.innerText())
          && /自動で取得される/.test(await skillCard.innerText()));
      await skillSpot().first().click();
      await page.waitForTimeout(200);
      note("手順6は技能の取得予約だけが光る",
        /手順 6\/7/.test(await skillCard.innerText())
          && await skillSpot().count() === 1
          && await skillSpot().first().getAttribute("data-action") === "reserve-weapon-skill"
          && await skillSpot().first().getAttribute("data-node") === reserveKey);
      await skillSpot().first().click();
      await page.waitForTimeout(250);
      note("予約先がStage 5のRunに表示される",
        await page.locator(".stage5-reservation").count() === 1
          && /予約:/.test(await page.locator(".stage5-reservation").innerText()));
      note("手順7はもう一人（ゴウ）のセルだけが光る",
        /手順 7\/7/.test(await skillCard.innerText())
          && await skillSpot().count() === 1
          && await skillSpot().first().getAttribute("data-character") === "warden");
      await skillSpot().first().click();
      await page.waitForTimeout(250);
      note("技能の受け渡し後は錠が外れてゴウへ移る",
        await page.locator("#app .tutorial-blocked").count() === 0
          && await mapTabDuringSkill.isEnabled()
          && /ゴウ/.test(await page.locator(".stage5-member-line").innerText()));
      await page.locator('nav.tabs [data-tab="map"]').click();
      await page.waitForTimeout(150);
      await page.locator(
        '.encounter-archive [data-action="inspect-encounter"][data-encounter="2"]').click();
      await page.waitForTimeout(200);
      note("最後は光らせず自分で選ばせる",
        await skillSpot().count() === 0
          && /自分で決める|あなたが決める/.test(await skillCard.innerText()));
      note("ゴウにも人物別技能点が残る",
        /未使用 1点/.test(await pointsReadout()));
      await page.locator(`.stage5-skill-card[data-node-key="${unlockKey}"] [data-action="select-weapon-node"]`).click();
      await page.waitForTimeout(200);
      note("Stage 5の技能節を選択して詳細を開ける",
        await page.locator(`.stage5-skill-card[data-node-key="${unlockKey}"].selected`).count() === 1);
      await page.locator('.camp-top [data-action="select-character"][data-character="mender"]').click();
      await page.waitForTimeout(200);
      note("終わったあとにツグミを選び直しても錠は戻らない",
        await page.locator("#app .tutorial-blocked").count() === 0
          && await skillSpot().count() === 0);
      note("取得した主軸技能と予約先が保存されている",
        await page.locator(`.stage5-skill-card[data-node-key="${unlockKey}"] .stage5-state`).innerText()
          === "主軸に設定中"
          && await page.locator(".stage5-reservation").count() === 1);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      note("リロード後も主軸・予約と済んだ段が残る",
        await page.locator(`.stage5-skill-card[data-node-key="${unlockKey}"] .stage5-state`).innerText()
          === "主軸に設定中"
          && await page.locator(".stage5-reservation").count() === 1
          && await page.locator("#app .tutorial-blocked").count() === 0);
      await page.locator('nav.tabs [data-tab="equipment"]').click();
      await page.waitForTimeout(150);
      note("終わったあとは他のタブへも移れる",
        await page.locator('nav.tabs [data-tab="equipment"].active').count() === 1
          && await page.locator(".skill-tutorial").count() === 1);
      note("技能チュートリアルのあとも補給タブは閉じている",
        await page.locator('nav.tabs [data-tab="supplies"]').isDisabled());
      await page.locator('nav.tabs [data-tab="supplies"]').click({ force: true }).catch(() => {});
      await page.waitForTimeout(150);
      note("二戦目の前に野営治療へ入れない",
        await page.locator('[data-action="treat"]').count() === 0
          && await page.locator('nav.tabs [data-tab="supplies"].active').count() === 0);
    }

    // ---- 二戦目。**勝つと補給チュートリアルが出る。** --------------------------
    await page.locator('nav.tabs [data-tab="map"]').click();
    await page.waitForTimeout(150);
    note("技能チュートリアルは一度きり（次の一戦へ出ると消える）",
      await page.locator(".skill-tutorial").count() === 1);
    // 二戦目の再挑戦も、手引きより前なので補給を取らない（3回負けてから勝つと
    // 補給0で手引きへ着く、という三つ目の道を塞いである）。敗北画面だけを置いて見る。
    await page.evaluate(() => {
      const key = "exp18-r10-auto-v02";
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (!saved?.run) return;
      saved.phase = "defeat";
      saved.lastResult = {
        result: "loss", roundsUsed: 8, reason: "party_wiped",
        metrics: { allyHpLost: 300, enemyHpLost: 200, reactionsFired: 2, equipmentWear: 0 },
        actors: [], equipment: [], events: [],
      };
      localStorage.setItem(key, JSON.stringify(saved));
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    const secondDefeatText = await bodyText();
    note("二戦目の再挑戦にも補給の値段が付かない",
      /編成を変えて再挑戦/.test(secondDefeatText) && !/補給1で編成を変えて再挑戦/.test(secondDefeatText));
    note("二戦目の敗北画面も名前と番号が揃う", /狩りの路地 · 第2戦/.test(secondDefeatText),
      secondDefeatText.match(/.{0,8}· 第\d+戦/)?.[0] ?? "");
    await click(/編成を変えて再挑戦/);
    await page.waitForTimeout(350);
    note("二戦目の再挑戦でも補給が減らない",
      /3\/3/.test(await page.locator('nav.tabs [data-tab="supplies"]').innerText()));
    await page.locator('nav.tabs [data-tab="map"]').click();
    await page.waitForTimeout(150);
    await click("この敵との実戦へ進む");
    await waitForTutorialSelector(".battle-field");
    const secondFast = page.locator('.speed-button[data-speed="fast"]');
    if (await secondFast.count()) await secondFast.click();
    await finishReplay();
    await page.waitForTimeout(400);
    if (await page.locator(".vn-stage").count() > 0) {
      await click("スキップ");
      await advanceStory();
    }
    await page.waitForTimeout(300);
    note("第2戦のあとに技能チュートリアルは出ない",
      await page.locator(".skill-tutorial").count() === 0);
    {
      const supplyCard = page.locator(".supply-tutorial");
      const supplyTab = page.locator('nav.tabs [data-tab="supplies"]');
      const mapTab = page.locator('nav.tabs [data-tab="map"]');
      const equipmentTab = page.locator('nav.tabs [data-tab="equipment"]');
      const tutorialSpot = page.locator(".tutorial-spot");
      // 作者指摘 2026-09-14 — **「補給」というものがある、から教える。**
      note("二戦目の直後は遠征タブのまま、補給の札が出る",
        await page.locator('nav.tabs [data-tab="map"].active').count() === 1
          && await supplyCard.count() === 1);
      note("補給チュートリアルは三手で、一手目は補給タブ",
        /手順 1\/3/.test(await supplyCard.innerText())
          && await tutorialSpot.count() === 1
          && await tutorialSpot.getAttribute("data-tab") === "supplies");
      note("補給が何なのかを札が説明する",
        /遠征へ持ってきた/.test(await supplyCard.innerText())
          && /再挑戦/.test(await supplyCard.innerText())
          && /取り合います/.test(await supplyCard.innerText()));
      note("補給チュートリアル中は戦闘へ進めない",
        await page.locator('[data-action="begin-stage"]').isDisabled());
      await tutorialSpot.first().click();
      await page.waitForTimeout(200);
      note("補給タブを押すと補給の画面が開く",
        await supplyTab.evaluate((tab) => tab.classList.contains("active"))
          && /手順 2\/3/.test(await supplyCard.innerText()));
      // PR #255 — 補給はシナリオを通して3個で固定。表記も残り/総数（3/3）にした。
      note("開始補給は固定の3個で、表記も残り/総数になっている",
        /補給 3 \/ 3/.test(await page.locator(".supplies-head b").innerText()));
      note("補給タブの札も残り/総数で出る",
        /3\/3/.test(await supplyTab.innerText()));
      note("次の戦闘と他タブは指定操作まで閉じる",
        await mapTab.isDisabled() && await equipmentTab.isDisabled());
      note("補給チュートリアル中は撤退できない",
        await page.getByRole("button", { name: "安全に撤退する" }).count() === 0);
      note("集中治療を補給チュートリアルで案内する",
        await page.locator('[data-action="treat"][data-treatment="concentrated"]:not([disabled])').count() === 1
          && /集中治療/.test(await supplyCard.innerText()));
      note("補給の手順2は光る集中治療だけを押せる",
        await tutorialSpot.count() === 1
          && await tutorialSpot.getAttribute("data-action") === "treat"
          && await tutorialSpot.getAttribute("data-treatment") === "concentrated");
      await mapTab.click({ force: true }).catch(() => {});
      await page.waitForTimeout(120);
      note("光っていない遠征タブを押しても補給チュートリアルに留まる",
        await page.locator(".supply-tutorial").count() === 1
          && await page.locator('nav.tabs [data-tab="supplies"].active').count() === 1);
      const suppliesBefore = Number((await page.locator(".supplies-head b").innerText()).match(/補給 (\d+)/)?.[1] ?? -1);
      const treatmentButton = page.locator('[data-action="treat"][data-treatment="concentrated"]:not([disabled])');
      if (await treatmentButton.count()) {
        await treatmentButton.click();
        await page.waitForTimeout(200);
        const suppliesBeforeTarget = Number((await page.locator(".supplies-head b").innerText()).match(/補給 (\d+)/)?.[1] ?? -1);
        const targetButtons = page.locator('[data-action="select-treatment-target"]');
        note("治療結果の前に対象選択を要求する",
          await targetButtons.count() > 0
            && suppliesBeforeTarget === suppliesBefore
            && /対象を1人/.test(await bodyText()));
        note("補給の手順3は光る負傷者セルだけを押せる",
          await tutorialSpot.count() > 0
            && await tutorialSpot.evaluateAll((elements) => elements.every((element) =>
              element.dataset.action === "select-treatment-target"
                && element.dataset.treatment === "concentrated")));
        if (await targetButtons.count()) {
          await targetButtons.first().click();
          await page.waitForTimeout(200);
          const suppliesAfter = Number((await page.locator(".supplies-head b").innerText()).match(/補給 (\d+)/)?.[1] ?? -1);
          note("対象を確定すると補給を1つ消費する", suppliesBefore >= 1 && suppliesAfter === suppliesBefore - 1);
          note("治療対象と結果を表示する",
            await page.locator(".supply-treatment-result").count() === 1
              && /傷ついた味方を回復できました。これで次も戦えます。/.test(await bodyText()));
          note("補給チュートリアル完了で次戦タブを戻せる", await mapTab.isEnabled());
          await page.reload({ waitUntil: "networkidle" });
          await page.waitForTimeout(250);
          note("補給チュートリアル完了と結果が保存される",
            await page.locator(".supply-tutorial").count() === 0
              && await page.locator(".supply-treatment-result").count() === 1);
        }
      }
      // PR #255 — **装備を選ぶのはボス戦を突破したあとだけ。**第4戦（盾将の門）
      // まで進めて、そこで候補が出ること、iPhone 16e の画面にスクロールなしで
      // 収まること、拾った品が持ち物へ入ることを順に見る。
      await page.evaluate(() => {
        const key = "exp18-r10-auto-v02";
        const saved = JSON.parse(localStorage.getItem(key) || "null");
        if (!saved?.run) return;
        saved.run.encounterIndex = 4;
        localStorage.setItem(key, JSON.stringify(saved));
      });
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      await page.locator('nav.tabs [data-tab="map"]').click();
      await click("この敵との実戦へ進む");
      await page.waitForTimeout(300);
      // 第4戦の前には幕の断片が入る。飛ばしてそのまま自動戦闘へ渡る。
      if (await page.locator(".vn-stage").count() > 0) {
        await click("スキップ");
        await page.waitForTimeout(200);
      }
      await waitForTutorialSelector(".battle-field");
      const bossFast = page.locator('.speed-button[data-speed="fast"]');
      if (await bossFast.count()) await bossFast.click();
      await finishReplay();
      await waitForTutorialSelector(".reward-choices");
      const rewardText = await bodyText();
      const choices = await page.locator(".reward-choices .reward-choice").count();
      note("ボス戦の突破で装備の候補が出る",
        choices >= 2 && /どちらを持ち帰る？/.test(rewardText), `候補 ${choices} 件`);
      note("候補は装備だけで、補給は混ざらない",
        await page.getByRole("button", { name: "補給を受け取る" }).count() === 0);
      // R13 — 報酬にも世界の側の声が一行ある（会話ではなく、拾い屋の言い習わし）。
      note("報酬に世界の声がある", /拾い屋|詰所|灰へ戻る|持ち帰れた者はいない/.test(rewardText));
      // 作者指摘 2026-09-12 — 2枚とも、スクロールなしで選べること。
      const rewardFits = await page.evaluate(() => {
        const cards = [...document.querySelectorAll(".reward-choices .reward-choice")];
        if (!cards.length) return null;
        return {
          bottom: Math.round(Math.max(...cards.map((card) => card.getBoundingClientRect().bottom))),
          viewport: window.innerHeight,
          scrollY: Math.round(window.scrollY),
        };
      });
      // **iPhone 16e の実機は、CSS viewport の 844px 全部を見せない。**Safari の
      // 上下のバーでおよそ 660px しか残らないので、そこを予算にする
      //（trial の viewport は 390x844 なので、`window.innerHeight` では緩すぎる）。
      note("装備の候補がスクロールなしで全部選べる",
        Boolean(rewardFits) && rewardFits.scrollY === 0
          && rewardFits.bottom <= Math.min(rewardFits.viewport, SAFARI_VISIBLE_HEIGHT),
        rewardFits ? `末尾 ${rewardFits.bottom}px / 予算 ${SAFARI_VISIBLE_HEIGHT}px` : "");
      // 作者試遊 2026-09-12 —「結局、条件と消費も見ないと選べないです」。
      const ruleHeads = await page.locator(".reward-choice .reward-rule-head").allTextContents();
      note("いつ発火するかが畳まずに出ている",
        ruleHeads.length >= choices && ruleHeads.every((text) => /とき|直前|開始時|round/.test(text)),
        (ruleHeads[0] ?? "").replace(/\s+/g, " ").slice(0, 60));
      note("何を払うかと何回かが畳まずに出ている",
        ruleHeads.some((text) => /耐久|HP|防壁|反応点/.test(text))
          && ruleHeads.every((text) => /につき\d+回/.test(text)));
      note("常時効果と発火効果を見分けられる",
        await page.locator(".reward-choice .effect-always").count() === choices);
      // 畳んだ段には全文（同じ材料から組んだ一文）が入っている。
      const rewardFull = page.locator(".reward-choice .reward-full").first();
      note("装備の全文を拾う前に読める", await rewardFull.count() > 0);
      if (await rewardFull.count()) {
        await rewardFull.locator("summary").click();
        await page.waitForTimeout(120);
        note("全文に条件と発火回数が書いてある", /とき|につき\d+回/.test(await rewardFull.innerText()));
      }
      const equipmentButton = page.locator('.reward-choice button[data-action="take-reward"]').first();
      note("装備の候補を選べる", await equipmentButton.count() > 0);
      if (await equipmentButton.count()) {
        await equipmentButton.click();
        await page.waitForTimeout(250);
        await page.locator('nav.tabs [data-tab="equipment"]').click();
        await page.waitForTimeout(150);
        const gearCardTexts = await page.locator(".gear-card").allTextContents();
        note("拾った装備が持ち物に並ぶ", gearCardTexts.length > 0
          && gearCardTexts.every((text) => !/生成装備|生成 [1-9]/.test(text)));
        await page.reload({ waitUntil: "networkidle" });
        await page.waitForTimeout(300);
        const reloadedGearCardTexts = await page.locator(".gear-card").allTextContents();
        note("リロードしても装備が残る", reloadedGearCardTexts.length > 0
          && reloadedGearCardTexts.every((text) => !/生成装備|生成 [1-9]/.test(text)));

      }
    }
  }

  // ---- Phase C — 拾った品が設計図として残り、次の遠征へ持ち込めるか。
  //
  // **画面の文言だけでなく、次の遠征の持ち物に実物が入るところまで見る。**
  //
  // PR #255 — 設計図を持ち帰れるのは**12戦を抜けて生還したときだけ**になった
  // （勝利1・撤退0・敗北0）。ここは同時に、12戦目のボス報酬（受け取ったら次の戦闘
  // ではなく精算へ渡し、候補を作り直さない）と、issue #151 の「残す設計図を選ぶ」
  // 画面を踏む場所でもある。2人編成の Stage 0 では第12戦に実際には勝てないので、
  // 結果画面の状態を直接置いて画面経路だけを通す。
  await page.evaluate(() => {
    const key = "exp18-r10-auto-v02";
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (!saved?.run) return;
    saved.run.encounterIndex = 12;
    saved.phase = "result";
    saved.rewardOffer = [];
    saved.rewardTakenAtEncounter = null;
    saved.lastResult = {
      result: "win", roundsUsed: 4, reason: "all_enemies_defeated",
      metrics: { allyHpLost: 40, enemyHpLost: 300, reactionsFired: 2, equipmentWear: 1 },
      actors: [], equipment: [], events: [],
    };
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  note("12戦目のボスでも装備の候補が出る",
    await page.locator(".reward-choices .reward-choice").count() >= 2
      && /選んだ品は精算で残す設計図の候補になります/.test(await bodyText()));
  const lastTake = page.locator('.reward-choice button[data-action="take-reward"]').first();
  if (await lastTake.count()) {
    await lastTake.click();
    await page.waitForTimeout(250);
    note("最終戦の候補は一度きりで、受け取ると精算へ渡す",
      await page.locator(".reward-choices").count() === 0
        && await page.getByRole("button", { name: "遠征を精算する" }).count() === 1);
  }
  await click("遠征を精算する");
  await page.waitForTimeout(350);

  // issue #151 — 残せる件数（勝利1）より多く見つけているので、何を残すかを選ばせる。
  if (await page.locator(".keep-list").count() > 0) {
    const keepText = await bodyText();
    const keepCards = await page.locator(".keep-card").count();
    note("残す設計図を選ぶ画面に着く",
      /残す設計図を選ぶ/.test(keepText) && keepCards >= 2 && /設計図は最大 1 件/.test(keepText),
      `候補 ${keepCards} 件`);
    note("選ばなかった品は残らないと書いてある", /選ばなかった品は残りません/.test(keepText));
    note("候補の全文を残す前に読める",
      await page.locator(".keep-card .reward-full").count() === keepCards);
    note("上限ぶんが最初から選ばれている", await page.locator(".keep-card.selected").count() === 1);
    // 押すと入れ替わる。等級順では残らない品も選べる。
    await page.locator(".keep-card.selected .keep-main").first().click();
    await page.waitForTimeout(150);
    note("選択を外せる", await page.locator(".keep-card.selected").count() === 0);
    await page.locator(".keep-card:not(.selected) .keep-main").first().click();
    await page.waitForTimeout(150);
    note("外した枠へ別の品を選べる", await page.locator(".keep-card.selected").count() === 1);
    await page.locator('[data-action="confirm-blueprint-keep"]').click();
    await page.waitForTimeout(350);
  }
  // 完走したので Stage 終了の会話が入る。**飛ばして確定済みの精算へ戻る。**
  if (await page.locator(".vn-stage").count() > 0) {
    note("完走すると Stage 終了の会話が入る", true);
    await click("スキップ");
    await page.waitForTimeout(350);
  }
  const settleText = await bodyText();
  note("精算画面に着く", /安全に撤退した|遠征を終えた|遠征は途中で終わった/.test(settleText));
  note("設計図として残した品が出る", /設計図として残した品/.test(settleText));
  note("残した件数が出ている", /新しく残した|取得履歴を追加|残せる品がありません/.test(settleText));
  note("選んだ1件だけを残したと出る", /選んだ 1 品だけを残しました/.test(settleText), 
    (settleText.match(/この遠征で見つけた装備 \d+ 品のうち、[^。]+。/)?.[0] ?? "").slice(0, 80));

  // R13 / R11 §2.4 — **精算の次は家である。**器材を返して、それから根城へ帰る。
  note("精算から根城へ帰れる", await page.getByRole("button", { name: "根城へ帰る" }).count() === 1);
  note("精算の締めの一行がある", /拾い屋の撤退は敗北ではない|台帳にはそう書く|詰所へ返し/.test(settleText));
  await click("根城へ帰る");
  await page.waitForTimeout(300);
  // R13 — 根城の日常場面。**Stage 0 を越えたので、一つ目が帰った夜に出る。**
  // 精算から根城へ帰る一押しが、そのまま場面の入口になる（別の釦を作らない）。
  note("完走した夜に根城の場面が入る", await page.locator(".vn-stage").count() === 1);
  if (await page.locator(".vn-stage").count() > 0) {
    note("根城の場面が会話として出る", /帰る場所のほう|土間/.test(await bodyText()));
    await click("スキップ");
    await page.waitForTimeout(350);
  }
  const homesteadText = await bodyText();
  note("根城の一枚に着く", /根城/.test(homesteadText) && /直しかけの家/.test(homesteadText));
  note("根城に名簿がある", /隊の名簿/.test(homesteadText));
  await click("ギルドへ");
  await page.waitForTimeout(250);
  await page.locator('[data-action="guild-tab"][data-tab="blueprints"]').click();
  await page.waitForTimeout(200);
  const archiveText = await bodyText();
  note("Blueprint archive の画面がある",
    /設計図のルール/.test(archiveText) && await page.locator(".blueprint-card").count() > 0);
  const carry = page.getByRole("button", { name: "この遠征へ持ち込む" });
  note("持ち込むボタンがある", await carry.count() > 0, archiveText.slice(0, 0));
  let carriedName = null;
  if (await carry.count()) {
    carriedName = await page.locator(".blueprint-card h3").first().innerText();
    await carry.first().click();
    await page.waitForTimeout(200);
    note("持込に切り替わる", /持込を外す/.test(await bodyText()));
    // 作者指摘 2026-09-15（三度目）— 持込の数は見出しではなく**札の meta** が出す
    // （見出し「残した品の設計図」は札の言い直しなので落とした）。
    note("持込枠の数が札に出ている",
      /^持込 1\/\d$/.test((await page.locator('[data-fx-watch="guild-tab-meta:blueprints"]')
        .innerText()).trim()));
  }

  // 次の遠征を始めると、持ち込んだ品が最初から手元にある。
  await page.locator('[data-action="guild-tab"][data-tab="expedition"]').click();
  await page.waitForTimeout(200);
  // Stage 0 を完走したので、行き先の初期選択は Stage 1 になっている。
  // ここで見たいのは **Stage 0 の再訪**なので、明示的に選び直す。
  const stageZero = page.locator('[data-action="select-campaign-stage"][data-sequence="0"]');
  note("クリア済みの Stage を選び直せる", await stageZero.count() === 1);
  if (await stageZero.count()) {
    await stageZero.click();
    await page.waitForTimeout(200);
  }
  await click("この条件で遠征へ出る");
  // Stage 0の再訪でも、openingは同じ会話として出る。序盤の一戦は
  // 専用チュートリアルなので初回だけで、再訪では会話を飛ばしてキャンプへ戻る。
  await page.waitForTimeout(300);
  if (await page.locator(".vn-stage").count() > 0) {
    const revisitOpeningLine = await page.locator(".vn-text").getAttribute("data-full");
    note("Stage 0再訪でも開始会話が同じ", revisitOpeningLine === openingLine);
    await click("スキップ");
    await page.waitForTimeout(300);
  }
  await page.locator('nav.tabs [data-tab="equipment"]').click();
  await page.waitForTimeout(200);
  const carriedText = await bodyText();
  note("持ち込んだ品が次の遠征の手元にある", /持込/.test(carriedText));
  if (carriedName) {
    note("持ち込んだ品の名前が一致する",
      carriedText.includes(carriedName.replace(/\s*(並|上|希|遺物)\s*$/, "").trim()),
      carriedName);
  }

  // ---- R11 §2.1 — Stage 1 の加入。Stage 0 をクリアした Profile を差し込んで見る
  // （12戦を通すのはこの台本の仕事ではない）。
  await page.evaluate(() => {
    const key = "exp18-r10-auto-v02";
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (!saved?.profile) return;
    saved.profile.campaignProgress = saved.profile.campaignProgress || {};
    const region = Object.keys(saved.profile.campaignProgress)[0] || "region_ashfront";
    saved.profile.campaignProgress[region] = {
      highestClearedStageSequence: 0, clearedStageSequences: [0],
    };
    saved.phase = "expeditionStart";
    saved.selectedCampaignStageSequence = 0;
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await page.reload({ waitUntil: "networkidle" });
  const stageCards = page.locator('[data-action="select-campaign-stage"][data-sequence="1"]');
  note("Stage 1 が開く", await stageCards.count() > 0);

  // ---- R12 §4.E-1 — 未公開の情報を出していないか（作者判断）
  const guildText = await bodyText();
  note("自由遠征の選択が残っていない", !/自由遠征|どの難易度で出るか/.test(guildText));
  note("次の加入者の名前を先に出さない", !/ヒバナ が加わる|ゲンゾウ が加わる/.test(guildText));
  note("未解禁の pack を名前で出さない", !/この遠征では出ない/.test(guildText));
  note("本編に出ない同業者が消えている", !/トキ|ヨリ|アカリ/.test(guildText));

  // ---- R13 / R12 §4.A — 根城（家にあるもの）と名簿（読める設定）。
  // **名簿は根城の中にある。**一度に全部は開かない。
  await page.locator('[data-action="guild-tab"][data-tab="homestead"]').click();
  await page.waitForTimeout(200);
  const homeText = await bodyText();
  note("根城の画面がある", /根城/.test(homeText) && /直しかけの家/.test(homeText));
  note("家にあるものが読める", /帳簿と目録/.test(homeText));
  note("まだ増えていないものは出ない", !/棚の規則|壁の写し/.test(homeText));
  note("名簿の画面がある", /隊の名簿/.test(homeText));
  note("加入した人物の欄が読める", /ゴウ/.test(homeText) && /ツグミ/.test(homeText));
  note("まだ会っていない人物の欄は出ない", !/ゲンゾウ/.test(homeText));
  note("開いていない節があると分かる", /まだ書かれていない節/.test(homeText));
  note("will はまだ開いていない", !/この人が求めているもの/.test(homeText));
  note("Stage 0 を越えた分だけ節が開く", /灰の中では/.test(homeText));

  // 根城の日常場面は、帰った夜に一本だけ出る（上で踏んだ）。ここでは**二度目が
  // 出ないこと**と、読み返せることを見る。
  note("見た場面を読み返せる", /根城での場面/.test(homeText));
  note("同じ夜は二度出ない", await page.getByRole("button", { name: "今夜の場面を見る" }).count() === 0);

  // ---- R13 / R8 §3.2 — 図鑑。**会った敵だけが載る。**
  await page.locator('[data-action="guild-tab"][data-tab="codex"]').click();
  await page.waitForTimeout(200);
  const codexText = await bodyText();
  note("図鑑の画面がある", /詰所へ出す控えの写し/.test(codexText));
  note("会った敵が載っている", /灰殻/.test(codexText) && /見た \d/.test(codexText));
  note("まだ倒していない敵の噂は出ない", !/幕の奥に一つだけある/.test(codexText));
  await page.locator('[data-action="guild-tab"][data-tab="expedition"]').click();
  await page.waitForTimeout(200);
  if (await stageCards.count()) {
    await stageCards.first().click();
    await page.waitForTimeout(200);
    await click("この条件で遠征へ出る");
    const joinText = await bodyText();
    note("Stage 1 の加入の会話が出る", /ナギ/.test(joinText));
    note("加入の会話も飛ばせる", await page.getByRole("button", { name: "スキップ" }).count() > 0);
    note("加入する人物の立ち絵が出る", await page.locator('.vn-figure[data-character="lancer"]').count() === 1);
    await click("スキップ");
    await page.waitForTimeout(250);
    const stage1Camp = await bodyText();
    // issue #240 — Stage 1 の camp は必殺技チュートリアルの錠が掛かった技能タブで開く。
    // **人数は盤面で数える**（どのタブでも同じ盤面が上端に貼りついている）。
    note("Stage 1 は3人で始まる",
      await page.locator(".camp-top button.party-cell").count() === 3
        && !/3 \/ 3人/.test(stage1Camp));

    // ---- Stage 5 h — Stage 1 の第1戦で武器Runの必殺技を試す。 ------------------
    // ナギの長槍Rを選び、長押しすると予測と本番が同じ必殺結果へ切り替わる。
    // 見た目・勝利時の消費・保存後の再開まで、390x844で一度通す。
    const pressDown = async (locator) => {
      await locator.scrollIntoViewIfNeeded();
      await locator.hover();
      await page.mouse.down();
    };
    const longPress = async (locator) => {
      await pressDown(locator);
      await page.waitForTimeout(700);
      await page.mouse.up();
      await page.waitForTimeout(250);
    };
    const lessonKey = "long_spear:R";
    note("必殺技チュートリアルの札が出る", await page.locator(".ultimate-tutorial").count() === 1);
    note("構える前の予測は敗北", /いまの予測\s*敗北/.test(await bodyText()));
    note("錠の最中は技能タブに留まる",
      await page.locator('nav.tabs [data-tab="skills"].active').count() === 1
        && await page.locator('nav.tabs [data-tab="map"]').isDisabled());
    const lessonCell = page.locator(".camp-top .party-cell.tutorial-spot");
    note("光るのは構える仲間のセルだけ", await lessonCell.count() === 1
      && await lessonCell.first().getAttribute("data-character") === "lancer");
    await lessonCell.first().click();
    await page.waitForTimeout(250);
    const lessonRow = page.locator(`.stage5-skill-card[data-node-key="${lessonKey}"] .stage5-skill-select`);
    note("光るのは長槍Rの技能カードだけ", await lessonRow.count() === 1
      && await lessonRow.first().evaluate((row) => row.classList.contains("tutorial-spot")));
    note("必殺にできるカードは長押し可能", await page.locator(
      `.stage5-skill-card[data-node-key="${lessonKey}"] .stage5-skill-select[data-longpress="toggle-stage5-ultimate"]`).count() === 1);
    note("Stage 1の技能一覧に初期20節を保つ", await page.locator(".stage5-skill-card").count() === 20);
    if (await lessonRow.count()) {
      await pressDown(lessonRow.first());
      // CSSの進行値は幅で測る。帯はJSの450msと揃い、タップを長押しと誤判定しない。
      const fill = await lessonRow.first().evaluate((row) => new Promise((resolve) => {
        const samples = [];
        const read = () => {
          const style = getComputedStyle(row, "::after");
          const width = Number.parseFloat(style.width);
          const total = row.getBoundingClientRect().width;
          samples.push({
            pressing: row.classList.contains("pressing"),
            shown: style.content !== "none",
            progress: Number.isFinite(width) && total > 0 ? width / total : NaN,
            animation: style.animationName,
          });
          if (samples.length < 6) requestAnimationFrame(read);
          else resolve(samples);
        };
        requestAnimationFrame(read);
      }));
      const grew = fill.filter((entry) => entry.pressing && entry.shown && Number.isFinite(entry.progress));
      note("長押し中は指の下で帯が伸びる",
        grew.length >= 2
          && grew.every((entry) => entry.animation === "stage5-long-press")
          && grew.at(-1).progress > grew[0].progress,
        grew.length ? `${Math.round(grew[0].progress * 100)}% → ${Math.round(grew.at(-1).progress * 100)}%` : JSON.stringify(fill[0]));
      await page.mouse.up();
      await page.waitForTimeout(160);
      note("途中で離すと帯だけ消えて必殺は構えない",
        await page.locator(".stage5-skill-select.pressing").count() === 0
          && await page.locator(".stage5-skill-card.ultimate-armed").count() === 0);

      await longPress(lessonRow.first());
      note("構えると盤面にナギの印が出る",
        await page.locator(".camp-top .party-ultimate.firing").count() === 1);
      note("構えると予測が勝利に変わる", /いまの予測\s*勝利/.test(await bodyText()));
      note("構えても技能タブから動かない",
        await page.locator('nav.tabs [data-tab="skills"].active').count() === 1);
      note("長押しだけでこの一戦の必殺になる",
        await page.locator(`.stage5-skill-card[data-node-key="${lessonKey}"].ultimate-armed.ultimate-firing`).count() === 1
          && await page.locator('[data-action="toggle-ultimate-armed"]').count() === 0);
      note("構えたカードに発動予定の印が出る",
        await page.locator(`.stage5-skill-card[data-node-key="${lessonKey}"] .stage5-ultimate-seal.firing`).count() === 1);
      const mapTabSpot = page.locator('nav.tabs [data-tab="map"].tutorial-spot');
      note("次に光るのは遠征タブ", await mapTabSpot.count() === 1);
      note("三手目のあいだ、遠征以外のタブは押せない",
        await page.locator('nav.tabs [data-tab="equipment"]').isDisabled());
      await mapTabSpot.click();
      await page.waitForTimeout(250);
      note("遠征を開くと挑戦操作が光り、錠が外れる",
        await page.locator('[data-action="begin-stage"].tutorial-spot').count() === 1
          && await page.locator('nav.tabs [data-tab="equipment"]:disabled').count() === 0);
      note("必殺技の一戦が第1戦として出る", /塞ぐ二枚/.test(await bodyText()));
      await click("この敵との実戦へ進む");
      await waitForTutorialSelector(".battle-field");
      await page.locator('[data-role="replay-toggle"]').click();
      await page.waitForTimeout(150);
      let cutInText = null;
      for (let step = 0; step < 160 && cutInText === null; step += 1) {
        if (await page.locator(".ultimate-cutin.show").count()) {
          cutInText = await page.locator(".ultimate-cutin").innerText();
          break;
        }
        const forward = page.locator('[data-role="replay-step"]');
        if (await forward.isDisabled()) break;
        await forward.click();
        await page.waitForTimeout(40);
      }
      note("必殺の拍でカットインが出る", cutInText !== null && /必殺・/.test(cutInText ?? ""), cutInText ?? "");
      note("カットインに立ち絵と変換の印が出る",
        await page.locator(".ultimate-cutin .portrait-svg").count() === 1
          && await page.locator(".ultimate-cutin .cutin-traits span").count() > 0);
      note("カットイン中に盤面の通常情報が沈む",
        await page.locator(".battle-field.ultimate-hold").count() === 1);
      await page.locator('[data-role="replay-back"]').click();
      await page.waitForTimeout(150);
      note("一手戻すとカットインも閉じる", await page.locator(".ultimate-cutin.show").count() === 0);
      await page.locator('.speed-button[data-speed="fast"]').click();
      await finishReplay();
      await page.waitForTimeout(400);
      const spentState = await page.evaluate(() => {
        const saved = JSON.parse(localStorage.getItem("exp18-r10-auto-v02") || "null");
        const run = saved?.run?.weaponRun;
        return run ? {
          selected: run.ultimateState.selectedSkillKeyByCharacter.lancer,
          armed: run.ultimateState.armedByCharacter.lancer,
          spent: run.ultimateState.spentCharacterIds.includes("lancer"),
          seen: saved.profile.storyFlags.includes("ultimate_lesson_seen"),
        } : null;
      });
      note("勝利時だけ必殺をStage 5のRunへ記録し、チュートリアルを完了する",
        spentState?.selected === lessonKey && spentState?.armed === true
          && spentState?.spent === true && spentState?.seen === true);
      const clearedNodes = page.locator('.encounter-archive .map-node.done');
      await clearedNodes.last().click();
      note("必殺を構えた第1戦に勝てる",
        await page.locator(".encounter-projection.record .encounter-report.recorded").count() === 1);
      note("必殺の一戦の後も装備候補を出さない",
        await page.locator(".reward-choices").count() === 0);
      note("必殺技チュートリアルは一度きり",
        await page.locator(".ultimate-tutorial").count() === 0);
      note("放ったナギだけが使用済み、他の二人は残数あり",
        await page.locator(".camp-top .party-ultimate.spent").count() === 1
          && await page.locator(".camp-top .party-ultimate.ready").count() === 2);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      note("リロードしても必殺の使用済み印とチュートリアル完了が残る",
        await page.locator(".camp-top .party-ultimate.spent").count() === 1
          && await page.locator(".camp-top .party-ultimate.ready").count() === 2
          && await page.locator(".ultimate-tutorial").count() === 0);
    }

    // ---- R12 §4.E-1 — 編成画面が「後で加入する仲間」を出していないこと。
    await page.locator('nav.tabs [data-tab="map"]').click();
    await page.waitForTimeout(150);
    const rosterText = await bodyText();
    note("後で加入する仲間を出さない", !/後で加入する仲間/.test(rosterText));

    // ---- issue #159 — 補給タブの盤面。**通常はセルを押しても何も起きない**（誰を
    // 選ぶ場面でもないので、押せる形にしない）。単体治療・蘇生を選んだあいだだけ
    // 対象選択になり、対象になり得ない仲間は**押せない状態で残る**。
    //
    // 戦闘不能者が出る場面は通しでは滅多に来ないので、保存を直接いじって
    // 「一人が倒れていて補給がある」状態を作る（第4戦の幕の断片と同じやり方）。
    const revivalFixture = await page.evaluate(() => {
      const key = "exp18-r10-auto-v02";
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (!saved?.run?.roster?.length || !saved.run.currentHp) return null;
      const restore = { currentHp: { ...saved.run.currentHp }, supplies: saved.run.supplies };
      const downed = saved.run.roster[saved.run.roster.length - 1];
      saved.run.currentHp = { ...saved.run.currentHp, [downed]: 0 };
      saved.run.supplies = 3;
      localStorage.setItem(key, JSON.stringify(saved));
      return { downed, restore };
    });
    if (revivalFixture) {
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(300);
      await page.locator('nav.tabs [data-tab="supplies"]').click();
      await page.waitForTimeout(200);
      note("通常の補給タブでは盤面のセルを押せない",
        await page.locator('.camp-top button.party-cell').count() === 0
          && await page.locator('.camp-top .party-cell').count() === 6);
      await page.locator('[data-action="treat"][data-treatment="revive"]:not([disabled])').click();
      await page.waitForTimeout(250);
      const pickable = page.locator('.camp-top .party-cell.pickable');
      note("蘇生を選ぶと盤面が対象選択になる",
        await pickable.count() === 1
          && await page.locator('.camp-top .party-cell.unpickable').count() === 2
          && /蘇生/.test(await page.locator(".camp-top .party-note.picking").innerText()));
      note("対象選択中はやめる手段が出ている",
        await page.locator('.camp-top [data-action="cancel-treatment-target"]').count() === 1);
      const suppliesBeforeRevive = Number(
        (await page.locator(".supplies-head b").innerText()).match(/補給 (\d+)/)?.[1] ?? -1);
      await pickable.first().click();
      await page.waitForTimeout(300);
      const suppliesAfterRevive = Number(
        (await page.locator(".supplies-head b").innerText()).match(/補給 (\d+)/)?.[1] ?? -1);
      note("蘇生の対象を盤面から明示的に選んで確定できる",
        await page.locator(".supply-treatment-result").count() === 1
          && suppliesBeforeRevive >= 1 && suppliesAfterRevive === suppliesBeforeRevive - 1);
      // 直したら元へ戻す。**後続の検査は通常の遠征状態を前提にしている。**
      await page.evaluate((fixture) => {
        const key = "exp18-r10-auto-v02";
        const saved = JSON.parse(localStorage.getItem(key) || "null");
        if (!saved?.run) return;
        saved.run.currentHp = fixture.restore.currentHp;
        saved.run.supplies = fixture.restore.supplies;
        localStorage.setItem(key, JSON.stringify(saved));
      }, revivalFixture);
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(300);
    }

    // ---- R12 §4.B — 敵カードの「拾い屋のあいだで言われていること」。
    await page.locator('nav.tabs [data-tab="map"]').click();
    await page.waitForTimeout(150);
    note("敵カードに拾い屋の言い分が出る", await page.locator(".enemy-lore").count() > 0);

    // ---- R12 §4.C — 幕の断片。第4戦の前に入る（再訪でも同じ）。
    await page.evaluate(() => {
      const key = "exp18-r10-auto-v02";
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (!saved?.run) return;
      saved.run.encounterIndex = 4;
      localStorage.setItem(key, JSON.stringify(saved));
    });
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await page.locator('nav.tabs [data-tab="map"]').click();
    await click("この敵との実戦へ進む");
    await page.waitForTimeout(300);
    note("幕の切れ目で会話が入る", await page.locator(".vn-stage").count() > 0);
    note("幕の断片も飛ばせる", await page.getByRole("button", { name: "スキップ" }).count() > 0);
    await click("スキップ");
    // issue #138 — 幕の会話のあとも、戦闘前確認を挟まずそのまま自動戦闘へ進む。
    await waitForTutorialSelector(".battle-field");
    note("幕の会話のあとは戦闘前確認を挟まず自動戦闘へ渡す", await page.locator(".battle-field").count() > 0);
  }

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
