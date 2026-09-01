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

// ---------------------------------------------------------------- 序盤の敗北（R9 §2.1）
//
// 「最初の戦闘で敗北し、時間が巻き戻る。戦闘予測を見ながら編成を変え、
//   予測どおりに勝利する。」
//
// **わざと負ける演出ではない。**決定的 engine で本当に負ける配置を初期値として
// 渡し、プレイヤーが一手だけ変えると本当に勝てるようにしてある。
// どちらも ecology/story.test.mjs が実際に走らせて確かめている。
//
//   既定（前列に二人並ぶ）        … 8 round で決着がつかず敗北。レオンが落ちる。
//   どちらかを後列へ下げる        … 7 round で勝利。
//
// 「後列狙いの敵がいるとき、前列に固まると二人とも同じ圧を受ける」という、
// この盤面でしか成立しない一つの問いに絞ってある。
export const PROLOGUE = Object.freeze({
  id: "prologue_ash_gate",
  name: "灰の門",
  description: "灰の中から、遠くを狙う影と、前を塞ぐ影が出てくる。",
  maxRounds: 8,
  rosterIds: Object.freeze(["lancer", "warden"]),
  // **初期配置がそのまま「まだ勝てない編成」。**巻き戻したあと、
  // プレイヤーはここを触る。
  formation: Object.freeze({ lancer: "front_left", warden: "front_right" }),
  enemies: Object.freeze([
    Object.freeze({ instanceId: "prologue_marksman", enemyActorId: "gray_marksman", position: "rear_left" }),
    Object.freeze({ instanceId: "prologue_guard", enemyActorId: "gray_guard", position: "front_center" }),
  ]),
  hint: "後列を狙う影がいる。前列に二人並ぶと、二人とも同じ圧を受ける。",
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
      cast: [stand("lancer", "left"), stand("warden", "right")],
      lines: [
        say("lancer", "先に行く。灰は待ってくれない。", "firm"),
        say("warden", "待って。何が出てくるか見てから決めたい。", "worry"),
        say("lancer", "見てるあいだに囲まれる。斬れば減る。それだけだ。", "wry"),
        say("warden", "減らないものもある。……行くなら、私が前に出る。", "firm"),
      ],
      footer: "二人の考え方は違う。どちらが正しいかは、盤面が決める。",
    }),
    prologueDefeat: beat("stage_0_prologue_defeat", "届かなかった", {
      mood: "defeat",
      place: "灰の門",
      cast: [stand("lancer", "left"), stand("warden", "right")],
      lines: [
        say("lancer", "……硬い。刃が滑る。", "hurt"),
        say("warden", "後ろから来てる。二人とも前に出すぎた。", "shock", "impact"),
        narrate("灰が渦を巻き、門の前に戻される。もう一度、同じ影が立っている。"),
      ],
      footer: "戦闘予測を開くと、次の一戦の結果が先に読める。編成を一つ変えて、予測がどう動くか見てほしい。",
    }),
    stageEnd: beat("stage_0_end", "門を抜けた", {
      mood: "dawn",
      place: "灰の門の先",
      cast: [stand("warden", "left"), stand("lancer", "right")],
      lines: [
        say("warden", "抜けた。あなたの言うとおり、斬れば減るものもあった。", "smile"),
        say("lancer", "お前が前に立ってなきゃ、俺の刃は届いてない。", "wry"),
        say("warden", "……次は、誰かを守りながら進むことになる。", "calm"),
      ],
      footer: "次の Stage では「かばう」という出来事が増える。",
    }),
  }),
  stage_1_wall: Object.freeze({
    join: beat("stage_1_join", "かばう手", {
      mood: "ash",
      place: "崩れた回廊",
      cast: [stand("guardian", "center"), stand("lancer", "left"), stand("warden", "right")],
      lines: [
        say("guardian", "そこ、危ない。", "shock"),
        narrate("ナギが割り込み、レオンへ飛んだ一撃を肩で受ける。", "impact"),
        say("lancer", "……なんで受けた。避ければよかっただろ。", "worry"),
        say("guardian", "受けた側は、次に何が来るか分かる。避けた側は分からない。", "calm"),
        say("warden", "受けることが、情報になる。", "neutral"),
      ],
      footer: "受け止めた結果は、集中（自分へ）か防壁（味方へ）のどちらかへ渡せる。",
    }),
    stageEnd: beat("stage_1_end", "誰を守るか", {
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
  stage_2_tempo: Object.freeze({
    join: beat("stage_2_join", "間合いと順番", {
      mood: "ash",
      place: "灰の谷",
      cast: [stand("tactician", "center"), stand("lancer", "left"), stand("guardian", "right")],
      lines: [
        say("tactician", "三、二、……いま。", "firm"),
        narrate("トワの合図で、レオンの溜めが一拍早く完成する。", "impact"),
        say("lancer", "早い。何をした。", "shock"),
        say("tactician", "あなたの番を、私の番と入れ替えた。増えてはいない。前に来ただけ。", "smile"),
        say("guardian", "……順番は、増やすものじゃなく、渡すもの。", "calm"),
      ],
      footer: "行動権は総量が増えない。誰へいつ渡すかだけが問題になる。",
    }),
    stageEnd: beat("stage_2_end", "渡せるもの", {
      mood: "dusk",
      place: "谷の終わり",
      cast: [stand("tactician", "left"), stand("warden", "right")],
      lines: [
        say("tactician", "渡せるのは順番だけじゃない。傷も渡せる。", "neutral"),
        say("warden", "……それは、渡された側が持たなきゃいけない。", "worry"),
      ],
      footer: "次の Stage では、傷そのものが遠征をまたいで残る意味を持つ。",
    }),
  }),
  stage_3_care: Object.freeze({
    join: beat("stage_3_join", "傷を抱えて進む", {
      mood: "ember",
      place: "野営の焚き火",
      cast: [stand("mender", "center"), stand("lancer", "left"), stand("guardian", "right")],
      lines: [
        say("mender", "その傷、いま塞ぐ意味はない。", "calm"),
        say("lancer", "は？ 治すのがあんたの仕事だろ。", "shock"),
        say("mender", "戻せるのは、いま受けたぶんだけ。古い傷は、次の一撃を減らすほうが早い。", "firm"),
        say("guardian", "……止めるのと、戻すのは違う。", "neutral"),
        say("mender", "そう。私は連鎖を止める役。", "smile"),
      ],
      footer: "応急処置は同じ一撃にしか効かない。待っても持ち越しHPは戻らない。",
    }),
    stageEnd: beat("stage_3_end", "五人になった", {
      mood: "dawn",
      place: "灰の縁",
      cast: [stand("warden", "left"), stand("lancer", "center"), stand("mender", "right")],
      lines: [
        say("warden", "五人。もう、誰かを外して進む必要はない。", "smile"),
        say("lancer", "全員が同じことをするわけじゃない。置き場所と持ち物で変わる。", "wry"),
        say("mender", "……次は、私たちの誰かが、まだ知らない使い方を見つける番。", "calm"),
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
