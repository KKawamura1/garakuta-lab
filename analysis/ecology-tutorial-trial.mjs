// **R11 のチュートリアル経路を、画面の中で通しで踏む。**
//
// analysis/ecology-trial.mjs は旧・自由遠征（Free mode）の難易度 flow を見ている。
// R11 で本編に入った経路——最初の会話、勝てない一戦、巻き戻し、2人編成、
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
  const tapUntil = async (predicate, limit = 12) => {
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
  note("Load Gameへ進める", await page.getByRole("button", { name: "セーブを選ぶ" }).count() === 1);
  // R10 — New Gameは必ずCampaign Stage 0のopeningから始める。
  await click("はじめから");

  // R13 — 最初の2人の会話。**ゴウとツグミの考え方の違いを見せる。**
  await page.waitForSelector(".vn-stage", { timeout: 8000 });
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
  await page.waitForSelector(".battle-field", { timeout: 8000 });
  note("盤面に2人だけが並ぶ", await page.locator(".battle-field .unit.ally, .unit[data-side=\"ally\"]").count() <= 3);
  // **序盤の一戦の途中でリロードする。**この箱では、戦闘中のリロードで進行を
  // 失う不具合が過去に出ている。物語から入る経路も同じ踏み場を通す。
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector(".battle-field", { timeout: 8000 });
  note("序盤の一戦の途中でリロードしても戻ってくる", /灰の門/.test(await bodyText()));
  await page.locator('.speed-button[data-speed="fast"]').click();
  // R14 §1.1 — **巻き戻す前の一戦には戦闘予測を出さない。**まだ巻き戻す力を
  // 持っていないので、読めても直せない。
  note("巻き戻す前の一戦には予測を出さない", await page.locator(".forecast-bar").count() === 0);
  // R11 §8.6 — 序盤は4拍で進む。
  //   打ち切り → 会話「届かなかった」 → 結果画面の［時間が巻き戻る］
  //   → 会話「もう一度、門の前」 → キャンプ → **同じ盤面をもう一度** → 勝利
  //
  // R12 — 倒れた会話は**再生を飛ばしても入る**。［結果を見る］で打ち切っても
  // 結果画面より先にここへ来る（以前は再生が流れきったときにしか入らなかった）。
  await click("結果を見る");
  await page.waitForTimeout(300);
  note("倒れた拍で会話が入る", /届かなかった/.test(await bodyText()));
  await advanceStory();
  await page.waitForTimeout(200);
  const resultText = await bodyText();
  note("序盤の一戦で負ける", /届かなかった|足を止めた|突破できなかった|巻き戻/.test(resultText)
    || (await page.getByRole("button", { name: "時間が巻き戻る" }).count()) > 0);
  note("この一戦は遠征に数えないと書いてある", /この一戦は遠征に数えません/.test(resultText));

  // R11 §2.1 — 巻き戻し。敗北後は「もう一度、門の前」へ戻る。
  await click("時間が巻き戻る");
  const rewindText = await bodyText();
  note("巻き戻しの会話が出る", /もう一度、門の前/.test(rewindText));
  // 学びの一言は断片の最後の行で出る。**そこまで進めてから見る。**
  // R11 §8.6 — ここで渡すのは「武器と技の違いは立つ場所の違い」である。
  const sawNote = await tapUntil(async () => await page.locator(".vn-note").count() > 0);
  note("武器と技の違いを渡す", sawNote && /後列/.test(await bodyText()));
  await advanceStory();

  // R11 §2.1 — 2人編成。**誰が来るかは物語が決める。**
  const campText = await bodyText();
  note("キャンプに着く", /編成|仲間/.test(campText));
  note("2人で始まる", /2 \/ 2人/.test(campText));
  await page.locator('nav.tabs [data-tab="roster"]').click();
  note("この Stage の同行者は固定だと書いてある",
    /物語が決めます/.test(await bodyText()));

  // R14 §1 — 巻き戻したあとは、camp の上端に戦闘予測が常設される。
  // **予測が指すのは「灰の門」**である（12戦の第1戦ではない。同じ盤面をもう一度戦う）。
  note("巻き戻したあとは予測が出る", await page.locator(".camp-top .forecast-bar").count() === 1);
  note("予測は同じ盤面（灰の門）を指す", /戦闘予測 · 灰の門/.test(await bodyText()));
  note("各メンバーのHPと減少量が出ている",
    await page.locator(".forecast-member .forecast-hp-values").count() === 2
      && await page.locator(".forecast-member .forecast-delta").count() === 2);
  // タブを変えても消えない（組み替えながら見るための帯である）。
  await page.locator('nav.tabs [data-tab="equipment"]').click();
  await page.waitForTimeout(150);
  note("装備タブでも予測が消えない", await page.locator(".camp-top .forecast-bar").count() === 1);
  note("装備は自由に付け外しできると書いてある", /装備は何度でも付け外しできます/.test(await bodyText()));

  // R10 — Campではオートセーブとは別に手動枠へ保存できる。
  await click("セーブ / ロード");
  note("セーブ画面へ進める", /セーブ \/ ロード/.test(await bodyText()));
  await page.locator('[data-action="save-slot"][data-slot="1"]').click();
  await page.waitForTimeout(200);
  note("手動セーブ枠へ保存できる", /手動セーブ枠 1 に保存しました/.test(await bodyText()));
  await page.locator('[data-action="load-slot"][data-slot="1"]').click();
  await page.waitForTimeout(200);
  note("手動セーブからCampへ戻れる", /編成|仲間/.test(await bodyText()) && /2 \/ 2人/.test(await bodyText()));

  // R9 §3.1 / R11 §8.5 — Stage 0 の入口は pack_care「構えと手当て」。
  // **武器と技を一本ずつ**持つ二本が、この Stage の問いそのものである。
  await page.locator('nav.tabs [data-tab="skills"]').click();
  const skillText = await bodyText();
  note("入口の技能が出ている", /確かな斬り/.test(skillText) && /狙い撃ち/.test(skillText));
  note("入口の接続面が出ている", /応急|傷の見立て|かばう|受け身/.test(skillText));
  // R12 — **manifest に無い節は出さない。**Campaign の pack は累積するので、
  // manifest 外＝まだ物語が配っていない語彙になった（灰色で名前だけ見せない）。
  const outOfManifest = await page.locator(".skill-node.out-of-manifest").count();
  note("未解禁の技能を名前でも出さない", outOfManifest === 0, `manifest 外 ${outOfManifest} 節`);

  // R14 §2 — 技能は取り直せない。**外す操作も、解禁のやり直しも画面に無い。**
  note("技能を外すボタンが無い", await page.locator('[data-action="remove-skill"]').count() === 0);
  note("解禁のやり直しが無い", await page.locator('[data-action="reset-run-skills"]').count() === 0);
  note("取り直せないと書いてある", /技能は取り直せません/.test(skillText));
  note("装着済みの技能に固定の印がある", await page.locator(".installed-row .locked-mark").count() > 0);

  // ---- R11 §8.6 — 巻き戻したあとの再戦。**同じ盤面をもう一度戦う。**
  //
  // ここがチュートリアルの山である。engine は決定的なので、**隊列を直さなければ
  // 何度やっても同じように負ける。**ツグミを後列へ下げた一手だけが勝ちに変わる。
  // 会話が渡した「柔らかい技は後ろ、硬い武器は前」を、実際に操作して確かめる。
  await page.locator('nav.tabs [data-tab="roster"]').click();
  // R14 §1 — **予測は隊列を動かした瞬間に付いてくる。**
  //
  // まずツグミを前列へ出す（ゴウと入れ替わる）。content/story.mjs が言うとおり、
  // 柔らかい技の担い手を前に置き、武器を後ろへ下げた形は負ける。
  // ここが「勝利」のままなら、予測は別の盤面を走らせている
  // （R14 以前は、この画面の予測が12戦の第1戦を試算していた）。
  const verdict = async () => (await page.locator(".forecast-verdict").first().innerText());
  await page.locator('[data-action="select-formation-character"][data-character="mender"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-action="place-character"][data-position="front_left"]').click();
  await page.waitForTimeout(200);
  const wrongVerdict = await verdict();
  note("柔らかいほうを前へ出すと予測が敗北へ変わる", /敗北/.test(wrongVerdict), wrongVerdict);

  await page.locator('[data-action="select-formation-character"][data-character="mender"]').click();
  await page.waitForTimeout(150);
  await page.locator('[data-action="place-character"][data-position="rear_right"]').click();
  await page.waitForTimeout(200);
  const placedText = await bodyText();
  note("ツグミを後列へ下げられる", /後列/.test(placedText));
  // **一手戻すと、その場で予測が勝利へ変わる。**これがこの遠征の中心の操作である。
  const rightVerdict = await verdict();
  note("一手直すとその場で予測が勝利へ変わる", /勝利/.test(rightVerdict), rightVerdict);

  await page.locator('nav.tabs [data-tab="map"]').click();
  await click("この敵に挑む");
  // 再戦は予測画面を挟む。**巻き戻したあとに初めて preview の読み方を教える**ので、
  // ここで武器と技の違いがもう一度渡っているかを見る。
  const retryPreviewText = await bodyText();
  note("戦闘予測の使い方を示す",
    /戦闘予測/.test(retryPreviewText)
      && /腕力で振る武器は後列から出すと大きく落ち|集中で通す技は落ちない|後列/.test(retryPreviewText));
  await click("自動戦闘を再生する");
  await page.waitForSelector(".battle-field", { timeout: 8000 });
  await page.locator('.speed-button[data-speed="fast"]').click();
  await click("結果を見る");
  await page.waitForTimeout(300);
  // 勝つと「同じ影、違う結果」の会話が入る。**結果画面より先にここへ来る。**
  note("隊列を直すと同じ盤面に勝てる", /同じ影、違う結果/.test(await bodyText()));
  await advanceStory();
  await page.waitForTimeout(200);
  await page.waitForSelector('nav.tabs [data-tab="map"]', { timeout: 8000 });
  // **序盤の演出はここで終わる。**以降は本編の第1戦なので、
  // 「この一戦は遠征に数えません」が消えていることまで見る。
  const mainCampText = await bodyText();
  note("序盤の演出が終わってキャンプへ出る", /編成|仲間|出発前/.test(mainCampText));
  note("序盤演出を終えて本編へ戻る", !/この一戦は遠征に数えません/.test(mainCampText));

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
    // R13 — 報酬画面にも世界の側の声が一行ある（会話ではなく、拾い屋の言い習わし）。
    note("報酬画面に世界の声がある", /拾い屋|詰所|灰へ戻る/.test(rewardText));
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

  // ---- Phase C — 拾った品が設計図として残り、次の遠征へ持ち込めるか。
  //
  // **画面の文言だけでなく、次の遠征の持ち物に実物が入るところまで見る。**
  // 安全撤退で精算まで一気に進む（R8 §10.3。撤退でも最大2件残る）。
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
  // 2周目の Stage 0 はまだクリアしていないので、会話と序盤の一戦は出ない
  // （storyFlags に既読印が残っている）。
  await page.waitForTimeout(300);
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
    const key = "exp18-r10-auto-v01";
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
    await page.waitForSelector(".vn-stage", { timeout: 8000 });
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
    note("Stage 1 は3人で始まる", /3 \/ 3人/.test(stage1Camp));

    // ---- R12 §4.E-1 — 編成画面が「後で加入する仲間」を出していないこと。
    await page.locator('nav.tabs [data-tab="roster"]').click();
    await page.waitForTimeout(150);
    const rosterText = await bodyText();
    note("後で加入する仲間を出さない", !/後で加入する仲間/.test(rosterText));

    // ---- R12 §4.B — 敵カードの「拾い屋のあいだで言われていること」。
    await page.locator('nav.tabs [data-tab="map"]').click();
    await page.waitForTimeout(150);
    note("敵カードに拾い屋の言い分が出る", await page.locator(".enemy-lore").count() > 0);

    // ---- R12 §4.C — 幕の断片。第4戦の前に一度だけ入る。
    await page.evaluate(() => {
      const key = "exp18-r10-auto-v01";
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
    await page.waitForTimeout(250);
    note("幕の会話のあとは戦闘予測へ渡す", /自動戦闘を再生する|戦闘予測|この戦闘/.test(await bodyText()));
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
