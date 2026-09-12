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

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  note("Continueは初回は無効", await page.locator('[data-action="continue-game"][disabled]').count() === 1);
  note("タイトル画面はメニューだけを表示する",
    await page.locator(".title-screen").count() === 1
      && !/戦闘は自動で進みます|Stageを越えるたび|活動資金と設計図/.test(await bodyText()));
  note("タイトル画面に遠征開始ボタンを置かない",
    await page.getByRole("button", { name: "遠征を仕立てる" }).count() === 0);
  note("Load Gameへ進める", await page.getByRole("button", { name: "ロードゲーム" }).count() === 1);
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
  // R12 — 倒れた会話は**再生を飛ばしても入る**。［結果を見る］で打ち切っても
  // ここへ来る（以前は再生が流れきったときにしか入らなかった）。
  await click("結果を見る");
  await page.waitForTimeout(300);
  note("倒れた拍で会話が入る", /届かなかった/.test(await bodyText()));
  // **門は最後の行でしか出ない**（途中の行で出すと、読み飛ばすための釦になる）。
  await tapStory();
  const gateButton = page.locator(".vn-gate .vn-gate-button");
  note("門は途中の行では出ない",
    await page.locator(".vn-gate").count() === 0
      && /2 \/ 3/.test(await page.locator(".vn-progress").innerText()));
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
  note("2人で始まる", /2人/.test(campText) && !/2 \/ 2人/.test(campText));
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
  const menderCell = page.locator('.camp-top .party-cell', { hasText: "ツグミ" }).first();
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
      .locator('.party-cell', { hasText: "ツグミ" }).count() === 1);
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
  note("次の一押し（この敵に挑む）が光る",
    await spot().count() === 1
      && await spot().first().getAttribute("data-action") === "begin-stage");
  // issue #138 / #235 — 戦闘前確認の画面（battlePreview）を無くしたので、巻き戻し直後に
  // 開く遠征タブで武器と技の違いをもう一度渡す。
  note("戦闘予測の使い方を示す",
    /戦闘予測/.test(placedText)
      && /腕力で振る武器は後列から出すと大きく落ち|技術で通す技は落ちない|後列/.test(placedText));
  note("ツグミが自分ではなくゴウを手当てすると示す",
    /応急手当は自分には効かず、被弾したゴウを後ろから手当てできる/.test(placedText));

  // issue #235 — 編成タブは廃止した。固定同行者の理由は遠征タブが一行で持つ。
  note("この Stage の同行者は固定だと書いてある",
    /物語が決めます/.test(await bodyText()));
  // issue #159 — 選べないものを「選べるように見えるカード」で出さない。
  note("固定の回は同行者の候補カードを出さない",
    await page.locator(".character-card").count() === 0
      && !/今回の同行者/.test(await bodyText()));

  // タブを変えても消えない（組み替えながら見るための帯である）。
  await page.locator('nav.tabs [data-tab="equipment"]').click();
  await page.waitForTimeout(150);
  note("装備タブでも予測が消えない", await page.locator(".camp-top .forecast-bar").count() === 1);
  const equipmentHelp = page.locator('details[data-help="equipment-rules"]');
  if (await equipmentHelp.count()) await equipmentHelp.locator("summary").click();
  note("装備は自由に付け外しできると書いてある", /装備は何度でも付け外しできます/.test(await bodyText()));

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
  note("手動セーブからCampへ戻れる", /同行者|仲間/.test(await bodyText()) && /2人/.test(await bodyText()));

  // R9 §3.1 / R11 §8.5 — Stage 0 の入口は pack_care「構えと手当て」。
  // **武器と技を一本ずつ**持つ二本が、この Stage の問いそのものである。
  await page.locator('nav.tabs [data-tab="skills"]').click();
  const skillHelp = page.locator('details[data-help="skill-rules"]');
  if (await skillHelp.count()) await skillHelp.locator("summary").click();
  const skillText = await bodyText();
  note("入口の技能が出ている", /確かな斬り/.test(skillText) && /狙い撃ち/.test(skillText));

  // issue #238 — **Stage 0 に必殺技は出さない。**武器と技の違い・隊列・応急手当を
  // 覚える回に、もう一つの仕組みを載せない。長押しの入口も、残り回数も、説明も出ない。
  note("Stage 0 では必殺技の長押しが無い",
    await page.locator(".installed-row[data-longpress]").count() === 0);
  note("Stage 0 では必殺技の残りを出さない",
    await page.locator(".skill-points-badge .seal-pips").count() === 0);
  note("Stage 0 では必殺技の説明も出さない",
    await page.locator('details[data-help="ultimate-rules"]').count() === 0
      && !/必殺/.test(skillText));

  // issue #177 — **1ラウンドに払える点**を見出しに出す。反応は上から順に払うので、
  // 点が尽きた行は同じラウンドでは出ない（その行に印が付く）。ゴウは行動点1・反応点2。
  const apPips = await page.locator(".slot-heading .slot-budget.ap .pips i").count();
  const rpPips = await page.locator(".slot-heading .slot-budget.rp .pips i").count();
  note("1ラウンドに払える点が装着の見出しに出る", apPips === 1 && rpPips === 2,
    `行動点 ${apPips} · 反応点 ${rpPips}`);
  note("装着した技能の消費が点で出る",
    await page.locator(".installed-copy .row-marks .pips i").count() > 0);

  // R19（issue #137）— ツリーは種別で切り替える。**行動の枝に RP の技能は混ざらない。**
  note("アクティブ／リアクティブ／パッシブを切り替えられる", await page.locator('[data-action="select-skill-kind"]').count() === 3);
  note("派生の線が引かれている", await page.locator(".skill-tree-forest .tree-lines path").count() > 0);
  await page.locator('[data-action="select-skill-kind"][data-kind="reactive"]').click();
  await page.waitForTimeout(150);
  const reactiveTreeText = await bodyText();
  note("入口の接続面が出ている", /応急|傷の見立て|かばう|受け身/.test(reactiveTreeText));

  // 節を押すと、前提ルートと派生先が強調され、そこから route を辿れる。
  // **根（mend）ではなく、その子（triage）を選ぶ。**根を選ぶと反応ツリー全体が
  // 派生先になり、落ちる節が無くなるため。
  const secondNode = page.locator('.skill-tree-forest [data-action="select-skill-node"]').nth(1);
  await secondNode.click();
  await page.waitForTimeout(150);
  note("選んだ節の前提と派生先が出る", await page.locator(".skill-route").count() > 0);
  note("前提ルート以外を落として見せる", await page.locator(".tree-cell.faded").count() > 0);

  // R19（issue #137）／issue #177 — 段は**素直に文字**で出す。ほとんどの節が Lv1 なので、
  // 目盛りにすると「1個だけ塗った10個の四角」が並んで読めなかった（作者指摘）。
  // 上限は添え字で、いまの段を主にする。取得していない節には出ない。
  const levels = await page.locator(".skill-tree-forest .level-tag").evaluateAll((nodes) =>
    nodes.map((node) => ({ now: node.childNodes[0]?.textContent ?? "", cap: node.querySelector("small")?.textContent ?? "" })));
  note("取得済みの節に段が文字で出る", levels.length > 0
    && levels.every((entry) => /^Lv\d+$/.test(entry.now.trim()) && /^\/\d+$/.test(entry.cap.trim())),
    `${levels.length} 件 · ${levels[0]?.now ?? ""}${levels[0]?.cap ?? ""}`);
  const flatNodes = await page.locator(".skill-tree-forest .skill-node").evaluateAll((nodes) =>
    nodes.filter((node) => !node.querySelector(".level-tag")).length);
  note("未取得・レベル無しの節には段が出ない", flatNodes > 0, `段なし ${flatNodes} 節`);

  // **丸は払うものだけ。**発動条件は技能名の下に短い薄字で書く（作者指摘）。
  const circles = await page.locator(".skill-tree-forest .firing-mark, .skill-tree-forest .trigger-mark").count();
  note("条件を表す丸や印を節に出していない", circles === 0, `${circles} 件`);
  const whens = await page.locator(".skill-tree-forest .node-when").allInnerTexts();
  note("発動条件が薄字の一行で読める", whens.length > 0 && whens.every((text) => text.trim().length > 0),
    `${whens.length} 件 · ${whens[0] ?? ""}`);
  // 段を上げる操作は**取得済みの節にだけ**出る。値段は釦に、変わる数はその隣に。
  // 規則そのもの（AP/RP は変わらない）は畳んだ「技能のルール」にあり、節では繰り返さない。
  await page.locator('.skill-tree-forest [data-action="select-skill-node"]').first().click();
  await page.waitForTimeout(150);
  const levelButton = await page.locator('.level-action [data-action="level-up-skill"]').count();
  const levelStep = await page.locator(".level-action .level-step").innerText().catch(() => "");
  note("取得済みの節に段の上げ方が出る", levelButton === 1 && /→/.test(levelStep),
    `${levelButton}件 · ${levelStep}`);

  // 記号の意味は畳んだ中に一度だけ。**節や装着行の上には出さない。**
  note("記号の意味が畳んで置いてある", await page.locator('details[data-help="skill-symbols"]').count() === 1);

  await page.locator('[data-action="select-skill-kind"][data-kind="active"]').click();
  await page.waitForTimeout(150);

  // issue #177 — **能力値を掛ける前の技能効果量**を出す。
  // ゴウの腕力50・技術6を先に掛けず、技能そのものの係数と能力値を見て、
  // 「どの能力値を伸ばすか」はプレイヤーが判断できるようにする。
  const yields = await page.locator(".skill-tree-forest .yield-chip").evaluateAll((nodes) =>
    nodes.map((node) => ({ label: node.getAttribute("aria-label") ?? "", text: node.textContent ?? "" })));
  note("能力値を掛ける前の技能効果量が節に出る", yields.length > 0
    && yields.every((entry) => /(腕力|技術|受け|最大HP)で伸びる/.test(entry.label))
    && yields.every((entry) => /効果/.test(entry.label) && /%/.test(entry.text)),
    `${yields.length} 件 · ${yields[0]?.text ?? ""}`);
  note("詳細欄に人物別の実数を繰り返さない",
    await page.locator(".skill-detail .skill-yield-readout").count() === 0);

  // 取得コストは取得済みのチェックと同じ実線四角、前提コストは破線四角。
  const costChains = await page.locator(".skill-tree-forest .node-cost-chain").evaluateAll((nodes) =>
    nodes.map((node) => ({
      prerequisite: Boolean(node.querySelector(".prerequisite-cost")),
      plus: Boolean(node.querySelector(".cost-plus")),
      acquisition: Boolean(node.querySelector(".acquisition-cost")),
    })));
  note("前提コストと取得コストを四角とプラスで分けて出す",
    costChains.some((entry) => entry.prerequisite && entry.plus && entry.acquisition),
    `${costChains.length} 件`);

  // テーマ（攻撃・守り・支援・指揮・基礎）で絞れる。押すと他のテーマが沈む。
  const branchChips = page.locator('[data-action="select-skill-branch"]');
  const chipCount = await branchChips.count();
  note("テーマの印で絞り込める", chipCount >= 2, `テーマ ${chipCount} 種`);
  const beforeFilter = await page.locator(".tree-cell.faded").count();
  await branchChips.first().click();
  await page.waitForTimeout(150);
  const afterFilter = await page.locator(".tree-cell.faded").count();
  note("テーマを選ぶと他のテーマが沈む", afterFilter > beforeFilter, `${beforeFilter} → ${afterFilter}`);
  await branchChips.first().click();
  await page.waitForTimeout(150);
  note("同じ印をもう一度押すと戻る", await page.locator(".tree-cell.faded").count() === beforeFilter);

  // R12 — **manifest に無い節は出さない。**Campaign の pack は累積するので、
  // manifest 外＝まだ物語が配っていない語彙になった（灰色で名前だけ見せない）。
  const outOfManifest = await page.locator(".skill-node.out-of-manifest").count();
  note("未解禁の技能を名前でも出さない", outOfManifest === 0, `manifest 外 ${outOfManifest} 節`);

  // R18 — 取得は取り消せず、装着後は順番とオン／オフを調整できる。
  note("技能を外すボタンが無い", await page.locator('[data-action="remove-skill"]').count() === 0);
  note("解禁のやり直しが無い", await page.locator('[data-action="reset-run-skills"]').count() === 0);
  note("取得を忘れられないと書いてある", /取得した技能は遠征中に忘れません/.test(skillText));
  note("技能数の上限が無いと書いてある", /枠の上限はありません/.test(skillText));
  note("装着済み技能をオン／オフできる", await page.locator('[data-action="toggle-skill"]').count() > 0);
  note("行動と反応の順番を変えられる",
    await page.locator('[data-action="move-skill"][data-kind="active"]').count() > 0
      && await page.locator('[data-action="move-skill"][data-kind="reactive"]').count() > 0);

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
      && (await page.locator(".member-context h3").innerText()).includes(otherSkillName)
      && (await page.locator('.camp-top .party-cell.selected').getAttribute("aria-label") ?? "")
        .startsWith(otherSkillName));
  note("技能タブで押しても隊列は動かない",
    JSON.stringify(await page.locator('.camp-top .party-cell').allTextContents())
      === JSON.stringify(skillFormationBefore));

  await page.locator('nav.tabs [data-tab="equipment"]').click();
  await page.waitForTimeout(200);
  note("装備タブに二つ目の仲間タブが無い", await page.locator(".member-tabs").count() === 0);
  note("装備タブは前のタブで選んだ人物を引き継ぐ",
    (await page.locator(".member-context h3").innerText()).includes(otherSkillName));
  const equipmentOtherCell = page.locator('.camp-top [data-action="select-character"]:not(.selected)').first();
  const equipmentOtherName = (await equipmentOtherCell.getAttribute("aria-label") ?? "").split(" · ")[0];
  const equipmentFormationBefore = await page.locator('.camp-top .party-cell').allTextContents();
  await equipmentOtherCell.click();
  await page.waitForTimeout(200);
  note("装備タブで装備対象を盤面から切り替えられる",
    Boolean(equipmentOtherName)
      && (await page.locator(".member-context h3").innerText()).includes(equipmentOtherName));
  note("装備タブで押しても隊列は動かない",
    JSON.stringify(await page.locator('.camp-top .party-cell').allTextContents())
      === JSON.stringify(equipmentFormationBefore));
  await page.locator('nav.tabs [data-tab="skills"]').click();
  await page.waitForTimeout(150);

  // ---- R11 §8.6 — 巻き戻したあとの再戦。**同じ盤面をもう一度戦う。**
  //
  // 隊列を直す一手は、camp へ着いた直後の手取りチュートリアルで既に踏んだ。
  // ここは**直した配置のまま、同じ盤面へ入り直す**ところだけを見る。
  // issue #138 — チュートリアルの再戦も含め、常に戦闘前確認を挟まず自動戦闘へ進む。
  await page.locator('nav.tabs [data-tab="map"]').click();
  await click("この敵に挑む");
  await waitForTutorialSelector(".battle-field");
  await page.locator('.speed-button[data-speed="fast"]').click();
  await click("結果を見る");
  await page.waitForTimeout(300);
  // 勝つと「同じ影、違う結果」の会話が入る。**結果画面より先にここへ来る。**
  note("隊列を直すと同じ盤面に勝てる", /同じ影、違う結果/.test(await bodyText()));
  await advanceStory();
  await page.waitForTimeout(200);
  // R11 §5 改 — **序盤の演出はここで終わる。**巻き戻したあとの勝利は、そのまま
  // 本編第1戦の結果画面になる（以前はここで一度キャンプへ戻し、フルスペックの
  // 「灰の入口」をもう一度戦わせてから報酬を出していた）。
  // 「この一戦は遠征に数えません」が消えていることまで見る。
  const resultAfterWinText = await bodyText();
  note("巻き戻しての勝利がそのまま本編第1戦の結果画面になる",
    !/この一戦は遠征に数えません/.test(resultAfterWinText));
  const won = /突破した/.test(await page.locator(".verdict h2").textContent() ?? "");
  note("第1戦を突破する", won);
  // 報酬を受け取るまでは、まだこの一戦の後始末が済んでいないので撤退できない。
  note("結果画面でもまだ撤退できない",
    await page.getByRole("button", { name: "安全に撤退する" }).count() === 0);
  if (won) {
    // issue #138 — 勝利の結果画面が報酬選択を兼ねる。「報酬を見る」の中間クリックは無い。
    const rewardText = resultAfterWinText;
    note("結果画面に報酬3択も一緒に出る", /何を持ち帰る？/.test(rewardText));
    note("報酬に装備が出る", /装備/.test(rewardText) && !/生成装備/.test(rewardText));
    // R13 — 報酬にも世界の側の声が一行ある（会話ではなく、拾い屋の言い習わし）。
    note("報酬に世界の声がある", /拾い屋|詰所|灰へ戻る/.test(rewardText));
    note("装備の rule が最初から読める", /とき、|につき\d+回/.test(rewardText));
    // 装備を拾い、装備画面と保存の往復まで見る。
    const equipmentButton = page.locator('.reward-card:has(.reward-kind.kind-equipment) button[data-action="take-reward"]').first();
    note("装備の候補を選べる", await equipmentButton.count() > 0);
    if (await equipmentButton.count()) {
      await equipmentButton.click();
      await page.waitForTimeout(200);
      const supplyTutorialText = await bodyText();
      note("最初の敵を倒した直後（報酬を受け取った直後）に補給タブが開く",
        await page.locator('nav.tabs [data-tab="supplies"].active').count() === 1
          && await page.locator(".supply-tutorial").count() === 1);
      const mapTab = page.locator('nav.tabs [data-tab="map"]');
      const equipmentTab = page.locator('nav.tabs [data-tab="equipment"]');
      note("開始補給はチュートリアル導入だけ1個",
        Number((await page.locator(".supplies-head b").innerText()).match(/補給 (\d+)/)?.[1] ?? -1) === 1);
      note("次の戦闘と他タブは指定操作まで閉じる",
        await mapTab.isDisabled() && await equipmentTab.isDisabled());
      note("補給チュートリアル中は撤退できない",
        await page.getByRole("button", { name: "安全に撤退する" }).count() === 0);
      note("集中治療を補給チュートリアルで案内する",
        await page.locator('[data-action="treat"][data-treatment="concentrated"]:not([disabled])').count() === 1
          && /手順 1\/2/.test(supplyTutorialText)
          && /集中治療/.test(supplyTutorialText));
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
      await page.locator('nav.tabs [data-tab="equipment"]').click();
      const gearText = await bodyText();
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

  // ---- Phase C — 拾った品が設計図として残り、次の遠征へ持ち込めるか。
  //
  // **画面の文言だけでなく、次の遠征の持ち物に実物が入るところまで見る。**
  // 安全撤退で精算まで一気に進む（R8 §10.3。撤退でも最大2件残る）。
  // issue #235 — 撤退は遠征タブが持つ（上端の常設ボタンは廃止した）。
  await page.locator('nav.tabs [data-tab="map"]').click();
  await page.waitForTimeout(150);
  await click("安全に撤退する");
  await page.waitForTimeout(300);
  const settleText = await bodyText();
  note("精算画面に着く", /安全に撤退した|遠征を終えた|遠征は途中で終わった/.test(settleText));
  note("設計図として残した品が出る", /設計図として残した品/.test(settleText));
  note("残した件数が出ている", /新しく残した|取得履歴を追加|残せる品がありません/.test(settleText));

  // R13 / R11 §2.4 — **精算の次は家である。**器材を返して、それから根城へ帰る。
  note("精算から根城へ帰れる", await page.getByRole("button", { name: "根城へ帰る" }).count() === 1);
  note("精算の締めの一行がある", /拾い屋の撤退は敗北ではない|台帳にはそう書く|詰所へ返し/.test(settleText));
  await click("根城へ帰る");
  await page.waitForTimeout(300);
  const homesteadText = await bodyText();
  note("根城の一枚に着く", /根城/.test(homesteadText) && /直しかけの家/.test(homesteadText));
  note("根城に名簿がある", /隊の名簿/.test(homesteadText));
  await click("ギルドへ");
  await page.waitForTimeout(250);
  await page.locator('[data-action="guild-tab"][data-tab="blueprints"]').click();
  await page.waitForTimeout(200);
  const archiveText = await bodyText();
  note("Blueprint archive の画面がある", /残した品の設計図/.test(archiveText));
  const carry = page.getByRole("button", { name: "この遠征へ持ち込む" });
  note("持ち込むボタンがある", await carry.count() > 0, archiveText.slice(0, 0));
  let carriedName = null;
  if (await carry.count()) {
    carriedName = await page.locator(".blueprint-card h3").first().innerText();
    await carry.first().click();
    await page.waitForTimeout(200);
    note("持込に切り替わる", /持込を外す/.test(await bodyText()));
    note("持込枠の数が出ている", /持込 1 \/ \d/.test(await bodyText()));
  }

  // 次の遠征を始めると、持ち込んだ品が最初から手元にある。
  await page.locator('[data-action="guild-tab"][data-tab="expedition"]').click();
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

  // 根城の日常場面。**Stage 0 を越えたので、一つ目が出ている。**
  const sceneButton = page.getByRole("button", { name: "今夜の場面を見る" });
  note("根城の場面へ入れる", await sceneButton.count() === 1);
  if (await sceneButton.count()) {
    await sceneButton.first().click();
    await waitForTutorialSelector(".vn-stage");
    note("根城の場面が会話として出る", /帰る場所のほう|土間/.test(await bodyText()));
    await click("スキップ");
    await page.waitForTimeout(250);
    const afterScene = await bodyText();
    note("場面のあとは根城へ戻る", /根城/.test(afterScene));
    note("見た場面を読み返せる", /根城での場面/.test(afterScene));
    note("同じ夜は二度出ない", await page.getByRole("button", { name: "今夜の場面を見る" }).count() === 0);
  }

  // ---- R13 / R8 §3.2 — 図鑑。**会った敵だけが載る。**
  await page.locator('[data-action="guild-tab"][data-tab="codex"]').click();
  await page.waitForTimeout(200);
  const codexText = await bodyText();
  note("図鑑の画面がある", /会った灰殻の記録/.test(codexText));
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
    note("Stage 1 は3人で始まる", /3人/.test(stage1Camp) && !/3 \/ 3人/.test(stage1Camp));

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
    await click("この敵に挑む");
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
