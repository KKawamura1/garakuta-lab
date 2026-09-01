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
// ここを触ってよいのは 物語 担当だけ。engine・schema・content 契約は変更しない。

import { CHARACTER_NAMES } from "./characters.mjs";
import { EXPRESSIONS, PORTRAITS } from "./portraits.mjs";

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
//   両方を前列（既定）… ナズナが 2 round で落ちる。柔らかい技の担い手を前に置かない
//   ナズナを後列      … **誰も落ちずに勝つ。**これが正解
//   シキを後列        … 負ける。武器攻撃が後列から 40% になり、倒しきれない
//   両方を後列        … 負ける。前で受ける者がいないうえ、武器も落ちる
//
// 「柔らかい技は後ろ、硬い武器は前」が、説明文ではなく4通りの結果として出る。
//
// **表示は「ナズナが倒れた瞬間」で打ち切る**（ecology/app.js の truncateAtFall）。
// engine は最後まで走らせて本当に敗北を出しているが、プレイヤーには
// 時間切れまで見せない。ルールを知らない一戦目のテンポを守るため。
export const PROLOGUE = Object.freeze({
  id: "prologue_ash_gate",
  name: "灰の門",
  description: "灰の中から、遠くを狙う影と、前を塞ぐ影が出てくる。",
  maxRounds: 5,
  rosterIds: Object.freeze(["warden", "mender"]),
  // **初期配置がそのまま「まだ勝てない編成」。**ナズナが front_left なので
  // 先に狙われる。巻き戻したあと、プレイヤーはここを触る。
  formation: Object.freeze({ mender: "front_left", warden: "front_right" }),
  enemies: Object.freeze([
    Object.freeze({ instanceId: "prologue_marksman", enemyActorId: "gray_marksman", position: "rear_left" }),
    Object.freeze({ instanceId: "prologue_husk_a", enemyActorId: "husk", position: "front_center" }),
    Object.freeze({ instanceId: "prologue_husk_b", enemyActorId: "husk", position: "front_left" }),
  ]),
  hint: "後列を狙う影がいる。だが前に二人並べば、柔らかいほうから崩れる。",
  // 巻き戻したあとに出す一行。**答えは書かず、見る場所だけ示す。**
  retryHint: "戦闘予測で、次の一戦の結果が先に読める。誰をどちらの列に置くかで、予測がどう動くか見てほしい。",
});

// ---------------------------------------------------------------- 断片の組み立て

const shortName = (characterId) => String(CHARACTER_NAMES[characterId] ?? characterId).split(" — ")[0];

// 台詞。**表示名は表から引く。**ここで綴ると、人物の改名に追随できない。
const say = (who, text, emotion = "neutral", fx = null) => {
  if (!PORTRAITS[who]) throw new Error("story: 立ち絵の無い話者 " + who);
  if (!EXPRESSIONS[emotion]) throw new Error("story: 未知の表情 " + emotion);
  return Object.freeze({ who, speaker: shortName(who), text, emotion, fx });
};

// 地の文。話者を持たない。**名前欄を出さずに、真ん中へ置く。**
const narrate = (text, fx = null) => Object.freeze({ who: null, speaker: null, text, emotion: null, fx });

// 立ち位置。at は left / center / right。since はその行から舞台に現れる。
const stand = (who, at, since = 0) => {
  if (!PORTRAITS[who]) throw new Error("story: 立ち絵の無い配役 " + who);
  return Object.freeze({ who, at, since });
};

const beat = (id, title, options) => Object.freeze({
  id,
  title,
  mood: options.mood ?? "ash",
  place: options.place ?? "",
  cast: Object.freeze((options.cast ?? []).map((entry) => entry)),
  lines: Object.freeze(options.lines.map((line) => line)),
  footer: options.footer ?? null,
});

// ---------------------------------------------------------------- Stage ごとの断片

export const STORY_BEATS = Object.freeze({
  stage_0_edge: Object.freeze({
    opening: beat("stage_0_opening", "灰の入口", {
      mood: "ash",
      place: "灰の門の手前",
      cast: [stand("warden", "left"), stand("mender", "right")],
      lines: [
        say("warden", "今日は入口だけ。地図のある範囲で足りる。", "neutral"),
        say("mender", "あなたがそう言うとき、たいてい足りていません。", "wry"),
        narrate("灰の中で、シキの足が何かを踏んだ。掌に収まる、針の止まった計器。"),
        say("warden", "……動いてる。灰の中でだけ、みたい。", "shock"),
        say("mender", "拾い物は帳簿に。……影が来ます。二つ、いえ三つ。", "firm"),
      ],
      footer: "拾い屋の遠征は、器材を借りて、拾って帰り、器材を返すところまでが一往復。",
    }),
    prologueDefeat: beat("stage_0_prologue_defeat", "届かなかった", {
      mood: "defeat",
      place: "灰の門",
      cast: [stand("mender", "left"), stand("warden", "right")],
      lines: [
        say("mender", "……前に、出すぎ、ました。", "hurt"),
        say("warden", "ナズナ！", "shock", "impact"),
        narrate("懐で計器が鳴った。止まっていた針が、来た道を逆にたどっていく。"),
      ],
      footer: "灰から拾ったものが、拾った者の時間を巻き戻すことがある。詰所の台帳に、その報告は無い。",
    }),
    prologueRewound: beat("stage_0_prologue_rewound", "もう一度、門の前", {
      mood: "ash",
      place: "灰の門の手前",
      cast: [stand("warden", "left"), stand("mender", "right")],
      lines: [
        narrate("灰が渦を巻き、門の手前へ戻される。ナズナは何事もなく荷を担ぎ直している。"),
        say("warden", "……いまの、覚えてる？", "worry"),
        say("mender", "何がです？ 影が来ますよ、三つ。", "neutral"),
        say("warden", "そう。三つ。——ナズナ、あなたは下がって。", "firm"),
        say("mender", "後ろからでは、わたしの手は届きませんが。", "worry"),
        say("warden", "届く。あなたのは技だから。届かないのは、わたしのほう。", "calm"),
      ],
      footer: "腕力で振る武器は、後列から出すと大きく落ちる。集中で通す技は、後列からでも落ちない。",
    }),
    prologueWin: beat("stage_0_prologue_win", "同じ影、違う結果", {
      mood: "dawn",
      place: "灰の門",
      cast: [stand("mender", "left"), stand("warden", "right")],
      lines: [
        say("mender", "……誰も倒れていません。さっきと同じ影なのに。", "shock"),
        say("warden", "立つ場所を変えただけ。それだけで、こうなる。", "calm"),
        say("mender", "「さっき」。やっぱり、何かありましたね。", "wry"),
        say("warden", "……帳簿には書かない。", "worry"),
      ],
      footer: "同じ盤面でも、誰をどちらの列に置くかで結果が変わる。ここから先も、変えられるのはそこだけ。",
    }),
    stageEnd: beat("stage_0_end", "門を抜けた", {
      mood: "dawn",
      place: "灰の門の先",
      cast: [stand("warden", "left"), stand("mender", "right")],
      lines: [
        say("warden", "抜けた。この先は、わたしたちだけだと手が足りない。", "neutral"),
        say("mender", "心当たりが？", "neutral"),
        say("warden", "ひとり。速いけれど、誰とも組めていない人がいる。", "wry"),
      ],
      footer: "次の Stage では、条件と引き換えに大きく伸びる攻め筋が増える。",
    }),
  }),
  stage_1_wall: Object.freeze({
    join: beat("stage_1_join", "抜ける刃", {
      mood: "ash",
      place: "詰所の裏手",
      cast: [stand("lancer", "center"), stand("warden", "left"), stand("mender", "right")],
      lines: [
        say("lancer", "……本気か。俺は保たない。三戦ももたないぞ。", "wry"),
        say("warden", "保たないのは、後ろで受ける人がいなかったからでしょう。", "firm"),
        say("mender", "傷は診ます。ただし戻せるのは、いま受けたぶんだけ。", "calm"),
        say("lancer", "……前に出ていいのか。", "shock"),
        say("warden", "いい。倒れたら、そのとき考える。", "neutral"),
      ],
      footer: "溜めや条件を満たした一撃は、安定した一撃を大きく上回る。担い手が立っていられるあいだは。",
    }),
    stageEnd: beat("stage_1_end", "軽い刃", {
      mood: "dusk",
      place: "崩れた回廊",
      cast: [stand("lancer", "left"), stand("warden", "center"), stand("mender", "right")],
      lines: [
        say("lancer", "前に出ると、こんなに通るのか。刃が軽い。", "smile"),
        say("warden", "軽いのは、あなたが後ろを気にしていないから。", "wry"),
        say("mender", "……そろそろ限界です。誰かが彼を庇わないと。", "worry"),
      ],
      footer: "前に置けば落ち、後ろに置けば刃が鈍る。この二択は、次の Stage で解ける。",
    }),
  }),
  stage_2_tempo: Object.freeze({
    join: beat("stage_2_join", "かばう手", {
      mood: "ash",
      place: "崩れた回廊",
      cast: [stand("guardian", "center"), stand("lancer", "left"), stand("warden", "right")],
      lines: [
        say("guardian", "そこ、危ない。", "shock"),
        narrate("小柄な影が割り込み、カイへ飛んだ一撃を盾板で受ける。灰が跳ねた。", "impact"),
        say("lancer", "……なんで受けた。避ければよかっただろ。", "worry"),
        say("guardian", "受けた側は、次に何が来るか分かる。避けた側は分からない。", "calm"),
        say("warden", "その盾、詰所の備品でしょう。返す当てはあるの。", "wry"),
        say("guardian", "ない。だから、連れて行って。", "neutral"),
      ],
      footer: "受け止めた結果は、集中（自分へ）か防壁（味方へ）のどちらかへ渡せる。",
    }),
    stageEnd: beat("stage_2_end", "誰を守るか", {
      mood: "dusk",
      place: "回廊の出口",
      cast: [stand("guardian", "left"), stand("lancer", "right")],
      lines: [
        say("guardian", "守るのは、守りたいからじゃない。そのあと誰が動けるかで決める。", "firm"),
        say("lancer", "……順番の話か。", "neutral"),
      ],
      footer: "次の Stage では「順番」そのものを動かせるようになる。",
    }),
  }),
  stage_3_care: Object.freeze({
    join: beat("stage_3_join", "間合いと順番", {
      mood: "ash",
      place: "灰の谷",
      cast: [stand("tactician", "center"), stand("lancer", "left"), stand("warden", "right")],
      lines: [
        say("tactician", "三、二、……いま。", "firm"),
        narrate("レイの合図で、カイの踏み込みが一拍早く入る。", "impact"),
        say("lancer", "早い。何をした。", "shock"),
        say("tactician", "あなたの番を、私の番と入れ替えました。増えてはいない。前に来ただけです。", "smile"),
        say("warden", "……協会の記録係が、なぜ灰の中に。", "worry"),
        say("tactician", "何百と読みました。読んだものを、一度でいいから自分の目で。", "calm"),
      ],
      footer: "行動権は総量が増えない。誰へいつ渡すかだけが問題になる。",
    }),
    stageEnd: beat("stage_3_end", "五人になった", {
      mood: "dawn",
      place: "灰の縁",
      cast: [stand("warden", "left"), stand("lancer", "center"), stand("mender", "right")],
      lines: [
        say("warden", "五人。これで、置いていく人を選ばなくて済む。", "smile"),
        say("lancer", "全員が同じことをするわけじゃない。置き場所と持ち物で変わる。", "wry"),
        say("mender", "……次は、誰かがまだ知らない使い方を見つける番。", "calm"),
      ],
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

// 断片の何行目までを見たとき、舞台に誰が立っているか。
// **since を過ぎた配役だけを返す。**途中で現れる人物を作れるようにしてある。
export function castOnStage(beat, lineIndex = Number.MAX_SAFE_INTEGER) {
  return (beat?.cast ?? []).filter((entry) => (entry.since ?? 0) <= lineIndex);
}
