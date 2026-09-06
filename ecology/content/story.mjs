// ecology/content/story.mjs
//
// **R9 §2 / §7 — 初期4 Stage をチュートリアルとして成立させる物語の断片。**
//
// 物語は説明文を増やすためではなく、pack の意味を人物の行動として見せるために使う
// （R9 §7）。だから、ここに置くのは次の三種類だけである。
//
//   opening   … 最初の2人が、互いの考え方の違いを見せる。
//   join      … 新しい人物が、既存の出来事を一度だけ意外な使い方で見せる。
//   stageEnd  … 次へ進む理由を短く示す。
//
// **正解を説明しない。**プレイヤーが予測した因果を、物語の側から補強するに留める
// （R9 §7 の最後）。
//
// R9 §8 — 2回目以降の遠征では、ここは飛ばせる。初回の学習順は固定してよいが、
// 既知になった後の再訪でチュートリアルがランの固定税になってはいけない。
//
// ---------------------------------------------------------------- 演出の持ち方
//
// 会話画面は立ち絵つきの一行送りになった（近年のスマホゲームの対話に合わせる）。
// **行数は増やさない。**増やしたのは「誰が、どんな顔で、どこに立っているか」だけで、
// 断片あたり 2〜6 行という R9 §7 の縛りはそのまま残す（story.test.mjs が見る）。
//
//   line.who     … 話者の人物 id。null は地の文。
//   line.speaker … 表示名。characters.mjs の表から作るので、ここで綴り直さない。
//   line.emotion … 立ち絵の表情 id（portraits.mjs の EXPRESSIONS）。
//   line.fx      … 一行だけの演出（"impact" = 画面が一度揺れる）。
//   beat.cast    … その断片で舞台に立つ人物と、その立ち位置。
//   beat.mood    … 背景の色調 id。
//
// ここは物語の構造と演出メタデータだけを持つ。会話本文は dialogue.mjs に集約する。

import { beat, castOnStage } from "./beat.mjs";
import { castFor, dialogueFor } from "./dialogue.mjs";

// ---------------------------------------------------------------- 序盤の敗北（R9 §2.1 / R11 §5）
//
// 「最初の戦闘で敗北し、時間が巻き戻る。戦闘予測を見ながら編成を変え、
//   予測どおりに勝利する。」
//
// **わざと負ける演出ではない。**決定的 engine で本当に負ける配置を初期値として
// 渡し、プレイヤーが一手だけ変えると本当に勝てる。ecology/story.test.mjs が
// 4通りすべてを実際に走らせて確かめている。
//
// R11 §5 — この一戦だけで、武器と技の違いの**両側**を教える。
//
//   両方を前列（既定）… ツグミが 2 round で落ちる。柔らかい技の担い手を前に置かない
//   ツグミを後列      … **余裕を残して勝つ。**これが正解。後列からゴウを応急手当できる
//   ゴウを後列        … 負ける。武器攻撃が後列から 40% になり、倒しきれない
//   両方を後列        … 負ける。前で受ける者がいないうえ、武器も落ちる
//
// 「柔らかい技は後ろ、硬い武器は前」に加え、後列のツグミが前衛をつなぐ因果が、説明文ではなく4通りの結果として出る。
//
// **表示は「ツグミが倒れた瞬間」で打ち切る**（ecology/app.js の truncateAtFall）。
// engine は最後まで走らせて本当に敗北を出しているが、プレイヤーには
// 時間切れまで見せない。ルールを知らない一戦目のテンポを守るため。
export const PROLOGUE = Object.freeze({
  id: "prologue_ash_gate",
  name: "灰の門",
  description: "灰の中から、遠くを狙う影と、前を塞ぐ影が出てくる。",
  maxRounds: 5,
  rosterIds: Object.freeze(["warden", "mender"]),
  // 位置の読み替えを主役にするため、12戦用の敵定義は変えず、この一戦だけ敵を軽くする。
  // HP 60%、前衛の攻撃115%。後列の marksman だけ73%に落とし、味方先行でも
  // 初期配置は崩れ、ツグミを後列へ置けば生き残れる差を残す。
  enemyScaling: Object.freeze({ maxHpBps: 6_000, offenseBps: 11_500 }),
  // **初期配置がそのまま「まだ勝てない編成」。**ツグミが front_left なので
  // 先に狙われる。巻き戻したあと、プレイヤーはここを触る。
  formation: Object.freeze({ mender: "front_left", warden: "front_right" }),
  enemies: Object.freeze([
    Object.freeze({
      instanceId: "prologue_marksman",
      enemyActorId: "gray_marksman",
      position: "rear_left",
      offenseBps: 7_300,
    }),
    Object.freeze({ instanceId: "prologue_husk_a", enemyActorId: "husk", position: "front_center" }),
    Object.freeze({ instanceId: "prologue_husk_b", enemyActorId: "husk", position: "front_left" }),
    Object.freeze({ instanceId: "prologue_husk_c", enemyActorId: "husk", position: "front_right" }),
  ]),
  hint: "後列を狙う影がいる。だが前に二人並べば、柔らかいほうから崩れる。",
  // 巻き戻したあとに出す一行。**答えは書かず、見る場所だけ示す。**
  retryHint: "戦闘予測で、次の一戦の結果が先に読める。前に立つ者と、後ろから仲間を手当てする者を決めて、予測がどう動くか見てほしい。",
});

// ---------------------------------------------------------------- 断片の組み立て
//
// beat / stand は content/beat.mjs にある。会話本文は dialogue.mjs から参照する。

// ---------------------------------------------------------------- Stage ごとの断片

export const STORY_BEATS = Object.freeze({
  stage_0_edge: Object.freeze({
    // ---- 幕の切れ目（R12 §4.C）。4・8・12戦目の前に置く ----
    act1: beat("stage_0_act1", "腕を借りる", {
      mood: "ash",
      place: "門を抜けて最初の休み場",
      cast: castFor("stage_0_act1"),
      lines: dialogueFor("stage_0_act1"),
    }),
    act2: beat("stage_0_act2", "四つ目の話", {
      mood: "dusk",
      place: "灰の斜面",
      cast: castFor("stage_0_act2"),
      lines: dialogueFor("stage_0_act2"),
    }),
    act3: beat("stage_0_act3", "帰り支度", {
      mood: "ember",
      place: "灰の門の内側",
      cast: castFor("stage_0_act3"),
      lines: dialogueFor("stage_0_act3"),
    }),
    opening: beat("stage_0_opening", "灰の入口", {
      mood: "ash",
      place: "灰の門の手前",
      cast: castFor("stage_0_opening"),
      lines: dialogueFor("stage_0_opening"),
      footer: "拾い屋の遠征は、器材を借りて、拾って帰り、器材を返すところまでが一往復。",
    }),
    prologueDefeat: beat("stage_0_prologue_defeat", "届かなかった", {
      mood: "defeat",
      place: "灰の門",
      cast: castFor("stage_0_prologue_defeat"),
      lines: dialogueFor("stage_0_prologue_defeat"),
      // R16追補（作者稿）— **杭は公的に存在する備品である。**そうでないと、この直後に
      // ツグミが「「杭」、使いました？」と名指しできない。初稿は「灰から拾ったもの」
      // 「詰所の台帳に、その報告は無い」と書いており、**誰も知らない品**になっていた。
      //
      // **引くのは持ち主で、死んだから戻るのではない**（作者指摘）。ゴウは巻き戻したいと
      // 思って引いた。平時の利用が許可されていないので、彼の「台帳にも書かねえ」は
      // 隠しごとであり、同時に拾い屋がみなやっていることでもある。
      footer: "杭は詰所が貸し出す備品である。坑の中で稀に採取できるが、安定した生産方法は確立されておらず、平時の利用は許可されていない。",
    }),
    prologueRewound: beat("stage_0_prologue_rewound", "もう一度、門の前", {
      mood: "ash",
      place: "灰の門の手前",
      cast: castFor("stage_0_prologue_rewound"),
      lines: dialogueFor("stage_0_prologue_rewound"),
      // R16追補（作者稿）— 初稿は「ツグミの応急手当は自分には効かず」まで書いていたが、
      // ここで渡したい指示は**ツグミを後ろへ下げること**である。手当ての向きは
      // `prologueWin` の footer が結果として見せる。
      // 語は画面の表記へ揃えた（スキル→技能、技術力→技術、行えない→届かない）。
      footer: "多くの攻撃は前列にしか届かない。後列に下がれば生存率は高まるが、腕力を参照する技能の威力は激減する。技術を参照する技能は、後列でも威力が落ちない。",
    }),
    prologueWin: beat("stage_0_prologue_win", "同じ影、違う結果", {
      mood: "dawn",
      place: "灰の門",
      cast: castFor("stage_0_prologue_win"),
      lines: dialogueFor("stage_0_prologue_win"),
      footer: "同じ状況でも、隊列が変われば結果が変わる。ツグミは後列に下がってゴウを治療し、ゴウは前列に出て敵の攻撃を受け止めた。未来が見えれば、結果は変えられる。",
    }),
    stageEnd: beat("stage_0_end", "今日はここまで", {
      mood: "dawn",
      place: "引き返す前の広間",
      cast: castFor("stage_0_end"),
      lines: dialogueFor("stage_0_end"),
      footer: "この先には、条件と引き換えに大きく伸びる攻め筋がある。",
    }),
  }),
  stage_1_wall: Object.freeze({
    act1: beat("stage_1_act1", "四度目の前", {
      mood: "ash",
      place: "崩れた階段の下",
      cast: castFor("stage_1_act1"),
      lines: dialogueFor("stage_1_act1"),
    }),
    act2: beat("stage_1_act2", "軽い、の中身", {
      mood: "dusk",
      place: "回廊の窪み",
      cast: castFor("stage_1_act2"),
      lines: dialogueFor("stage_1_act2"),
    }),
    act3: beat("stage_1_act3", "口に出さない", {
      mood: "ember",
      place: "灰の吹きだまり",
      cast: castFor("stage_1_act3"),
      lines: dialogueFor("stage_1_act3"),
    }),
    join: beat("stage_1_join", "抜ける刃", {
      mood: "ash",
      place: "詰所の裏手",
      cast: castFor("stage_1_join"),
      lines: dialogueFor("stage_1_join"),
      footer: "溜めや条件を満たした一撃は、安定した一撃を大きく上回る。担い手が立っていられるあいだは。",
    }),
    stageEnd: beat("stage_1_end", "軽い刃", {
      mood: "dusk",
      place: "崩れた回廊",
      cast: castFor("stage_1_end"),
      lines: dialogueFor("stage_1_end"),
      footer: "前で受ける者がいると、後ろの一撃が最後まで振り抜ける。誰が立つかで、誰が振れるかが決まる。",
    }),
  }),
  stage_2_tempo: Object.freeze({
    act1: beat("stage_2_act1", "拾う手", {
      mood: "ash",
      place: "回廊の脇",
      cast: castFor("stage_2_act1"),
      lines: dialogueFor("stage_2_act1"),
    }),
    act2: beat("stage_2_act2", "先に行くと", {
      mood: "dusk",
      place: "崩れた回廊",
      cast: castFor("stage_2_act2"),
      lines: dialogueFor("stage_2_act2"),
    }),
    act3: beat("stage_2_act3", "明かりが行った", {
      mood: "ember",
      place: "回廊の出口",
      cast: castFor("stage_2_act3"),
      lines: dialogueFor("stage_2_act3"),
    }),
    join: beat("stage_2_join", "かばう手", {
      mood: "ash",
      place: "崩れた回廊",
      // R12 — 4人目が加わる場面なので、舞台に立つのも4人。
      cast: castFor("stage_2_join"),
      lines: dialogueFor("stage_2_join"),
      // R16追補（作者指摘）— 初稿の「受け止めた結果は、集中か防壁へ渡せる」は、
      // **この場面（ヒバナがナギを引いた）とも Stage 2 の問い（隊列を動かして何を得るか）
      // とも噛み合っていなかった。**いま画面で起きたことを、そのまま指す。
      footer: "隊列は戦闘中にも入れ替わる。誰が前に立っているかで、狙われる者が変わる。",
    }),
    stageEnd: beat("stage_2_end", "紙の上にいない", {
      mood: "dusk",
      place: "詰所の窓口",
      cast: castFor("stage_2_end"),
      lines: dialogueFor("stage_2_end"),
      footer: "この先では「順番」そのものを動かせるようになる。",
    }),
  }),
  stage_3_care: Object.freeze({
    act1: beat("stage_3_act1", "二冊の帳面", {
      mood: "ash",
      place: "灰の谷の縁",
      cast: castFor("stage_3_act1"),
      lines: dialogueFor("stage_3_act1"),
    }),
    act2: beat("stage_3_act2", "四つ目より奥", {
      mood: "dusk",
      place: "谷底の風下",
      cast: castFor("stage_3_act2"),
      lines: dialogueFor("stage_3_act2"),
    }),
    act3: beat("stage_3_act3", "ばーん", {
      mood: "ember",
      place: "灰の縁",
      cast: castFor("stage_3_act3"),
      lines: dialogueFor("stage_3_act3"),
    }),
    join: beat("stage_3_join", "戸を叩く", {
      mood: "ash",
      place: "根城の戸口",
      // R12 — 5人が揃う場面。**加入済みの全員が立つ。**
      // 台詞は増やさない（R9 §7）。ヒバナとツグミは表情で応じる。
      cast: castFor("stage_3_join"),
      lines: dialogueFor("stage_3_join"),
      footer: "坑へ入った者の名は、帰ってきた欄と、戻らなかった欄に分かれて残る。どちらの欄も、増えるばかりで減ることがない。",
    }),
    stageEnd: beat("stage_3_end", "五人になった", {
      mood: "dawn",
      place: "灰の縁",
      cast: castFor("stage_3_end"),
      lines: dialogueFor("stage_3_end"),
      footer: "ここから先は、配置・技能・装備の差だけで役割を作る。",
    }),
  }),
});

// その Stage の断片。無ければ空を返す（Stage が増えても落ちない）。
export function storyBeatsForStage(stageId) {
  return STORY_BEATS[stageId] ?? {};
}

export function storyBeat(stageId, key) {
  return storyBeatsForStage(stageId)[key] ?? null;
}

// 舞台に誰が立っているかの判定は beat.mjs にある。**呼び先を変えずに再輸出する。**
export { castOnStage };
