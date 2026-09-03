// ecology/content/dialogue.mjs
//
// **会話定義の正本。**本編の物語、序盤の灰の門、根城の日常場面で
// 表示する台詞と地の文を、ここへ一箇所に集約する。
//
// 会話の本文や配役を変えるときは、このファイルだけを編集する。story.mjs と
// homestead.mjs には舞台・条件・表示順だけを置き、会話担当と
// システム担当が同じ行を触らないようにする。
//
// タイトル、場所、立ち位置、解禁条件、説明用 footer / hint、名簿の設定文は
// 会話本文ではないため、それぞれの定義ファイルに残す。

import { narrate, say, stand } from "./beat.mjs";

export const DIALOGUE = Object.freeze({
  stage_0_act1: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      narrate("ナズナが荷を下ろし、小さな帳面を開く。"),
      say("mender", "腕の上がり方が、朝より二寸浅い。……座ってください。", "neutral"),
      say("warden", "そこまで見なくていい。", "wry"),
      say("mender", "見るのが仕事です。器材は返しますが、体は返せませんから。", "calm"),
    ]),
  }),

  stage_0_act2: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("warden", "right")]),
    lines: Object.freeze([
      say("mender", "地図はここまででしたね。この先は。", "neutral"),
      say("warden", "三つ目の門までは台帳にある。四つ目から先は、誰も書いていない。", "neutral"),
      narrate("そこから先を、シキは少し長く喋った。ナズナは帳面に何も書かなかった。"),
    ]),
  }),

  stage_0_act3: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("warden", "抜けたら詰所。器材を返して、それから帰る。", "neutral"),
      say("mender", "順番を間違えないでくださいね。前は先に寝ました。", "wry"),
      say("warden", "……覚えてない。", "calm"),
    ]),
  }),

  stage_0_opening: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("warden", "今日は入口だけ。地図のある範囲で足りる。", "neutral"),
      say("mender", "あなたがそう言うとき、たいてい足りていません。", "wry"),
      narrate("灰の中で、シキの足が何かを踏んだ。掌に収まる、針の止まった計器。"),
      say("warden", "……動いてる。灰の中でだけ、みたい。", "shock"),
      say("mender", "拾い物は帳簿に。……影が来ます。二つ、いえ三つ。", "firm"),
    ]),
  }),

  stage_0_prologue_defeat: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("warden", "right")]),
    lines: Object.freeze([
      say("mender", "……前に、出すぎ、ました。", "hurt"),
      say("warden", "ナズナ！", "shock", "impact"),
      narrate("懐で計器が鳴った。止まっていた針が、来た道を逆にたどっていく。"),
    ]),
  }),

  stage_0_prologue_rewound: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      narrate("灰が渦を巻き、門の手前へ戻される。ナズナは何事もなく荷を担ぎ直している。"),
      say("warden", "……いまの、覚えてる？", "worry"),
      say("mender", "何がです？ 影が来ますよ、三つ。", "neutral"),
      say("warden", "そう。三つ。——ナズナ、あなたは下がって。", "firm"),
      say("mender", "後ろからでは、わたしの手は届きませんが。", "worry"),
      say("warden", "届く。あなたのは技だから。届かないのは、わたしのほう。", "calm"),
    ]),
  }),

  stage_0_prologue_win: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("warden", "right")]),
    lines: Object.freeze([
      say("mender", "……誰も倒れていません。さっきと同じ影なのに。", "shock"),
      say("warden", "立つ場所を変えただけ。それだけで、こうなる。", "calm"),
      say("mender", "「さっき」。やっぱり、何かありましたね。", "wry"),
      say("warden", "……帳簿には書かない。", "worry"),
    ]),
  }),

  stage_0_end: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("warden", "抜けた。この先は、わたしたちだけだと手が足りない。", "neutral"),
      say("mender", "心当たりが？", "neutral"),
      say("warden", "ひとり。速いけれど、誰とも組めていない人がいる。", "wry"),
    ]),
  }),

  stage_1_act1: Object.freeze({
    cast: Object.freeze([stand("lancer", "left"), stand("warden", "center"), stand("mender", "right")]),
    lines: Object.freeze([
      say("lancer", "次、俺が先に入る。", "firm"),
      say("warden", "わたしが先。あなたはその後ろ。", "neutral"),
      say("lancer", "……遅くならないか、それ。", "wry"),
      say("warden", "遅い分は、あなたが立っていられる時間で戻る。", "calm"),
    ]),
  }),

  stage_1_act2: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("lancer", "right")]),
    lines: Object.freeze([
      narrate("カイの脇腹に、浅いが長い裂け目がある。"),
      say("mender", "その傷、いま塞ぐ意味はない。", "neutral"),
      say("lancer", "だろ。だから言ってない。", "wry"),
      say("mender", "言わないのと、気づかれないのは、別です。", "calm"),
    ]),
  }),

  stage_1_act3: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("lancer", "right")]),
    lines: Object.freeze([
      say("lancer", "……あんた、なんで毎回そこに立つんだ。", "neutral"),
      say("warden", "そこが空いているから。", "neutral"),
      narrate("カイはそれ以上聞かなかった。理由はもう分かっていた。"),
    ]),
  }),

  stage_1_join: Object.freeze({
    cast: Object.freeze([stand("lancer", "center"), stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("lancer", "……本気か。俺は保たない。三戦ももたないぞ。", "wry"),
      say("warden", "保たないのは、後ろで受ける人がいなかったからでしょう。", "firm"),
      say("mender", "傷は診ます。ただし戻せるのは、いま受けたぶんだけ。", "calm"),
      say("lancer", "……前に出ていいのか。", "shock"),
      say("warden", "いい。倒れたら、そのとき考える。", "neutral"),
    ]),
  }),

  stage_1_end: Object.freeze({
    cast: Object.freeze([stand("lancer", "left"), stand("warden", "center"), stand("mender", "right")]),
    lines: Object.freeze([
      say("lancer", "前に出ると、こんなに通るのか。刃が軽い。", "smile"),
      say("warden", "軽いのは、あなたが後ろを気にしていないから。", "wry"),
      say("mender", "……そろそろ限界です。誰かが彼を庇わないと。", "worry"),
    ]),
  }),

  stage_2_act1: Object.freeze({
    cast: Object.freeze([
            stand("guardian", "center"), stand("lancer", "left"), stand("warden", "right"),
            stand("mender", "far_right"),
          ]),
    lines: Object.freeze([
      narrate("スミが屈んで、割れた把手を拾い、布に包んで懐へ入れる。"),
      say("lancer", "それ、金にならないぞ。", "neutral"),
      say("guardian", "売らない。", "calm"),
    ]),
  }),

  stage_2_act2: Object.freeze({
    cast: Object.freeze([stand("lancer", "left"), stand("guardian", "right")]),
    lines: Object.freeze([
      say("lancer", "今日、七回だ。数えてた。", "worry"),
      say("guardian", "八回。最初のは、あなたが見ていない。", "neutral"),
      say("lancer", "……次からは見る。", "wry"),
    ]),
  }),

  stage_2_act3: Object.freeze({
    cast: Object.freeze([
            stand("guardian", "center"), stand("warden", "left"), stand("mender", "far_left"),
            stand("lancer", "right"),
          ]),
    lines: Object.freeze([
      say("warden", "スミ。保証人の欄、書き足しておいた。", "neutral"),
      narrate("スミは何も言わずに、少しだけ笑った。隊の誰も、その顔を見たことがなかった。"),
      say("mender", "……帳面に書いておきます。", "smile"),
    ]),
  }),

  stage_2_join: Object.freeze({
    cast: Object.freeze([
            stand("guardian", "center"), stand("lancer", "left"), stand("warden", "right"),
            stand("mender", "far_right"),
          ]),
    lines: Object.freeze([
      say("guardian", "そこ、危ない。", "shock"),
      narrate("小柄な影が割り込み、カイへ飛んだ一撃を盾板で受ける。灰が跳ねた。", "impact"),
      say("lancer", "……なんで受けた。避ければよかっただろ。", "worry"),
      say("guardian", "受けた側は、次に何が来るか分かる。避けた側は分からない。", "calm"),
      // ナズナは人を数える側（R11 §5 レイ⇄ナズナ／シキ⇄ナズナ）。
      // **庇う理屈そのものではなく、その理屈が何度使われたかを見ている。**
      say("mender", "その理屈で、あなたは何度受けたんです。", "worry"),
      say("warden", "……その盾、詰所の備品でしょう。返す当てが無いなら、保証人はわたしが書く。", "wry"),
    ]),
  }),

  stage_2_end: Object.freeze({
    cast: Object.freeze([stand("guardian", "left"), stand("lancer", "right")]),
    lines: Object.freeze([
      say("guardian", "守るのは、守りたいからじゃない。そのあと誰が動けるかで決める。", "firm"),
      say("lancer", "……順番の話か。", "neutral"),
    ]),
  }),

  stage_3_act1: Object.freeze({
    cast: Object.freeze([stand("tactician", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      narrate("焚き火の両側で、二人が別々の帳面を開いている。"),
      say("mender", "あなたも付けるんですね。", "neutral"),
      say("tactician", "出来事のほうを。何が起きて、何番目だったか。", "calm"),
      say("mender", "わたしは人のほうです。同じ火を囲んでいるのに、残るものが違う。", "wry"),
    ]),
  }),

  stage_3_act2: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("tactician", "right")]),
    lines: Object.freeze([
      say("tactician", "潜行等級の申請、通しておきました。四つ目の門まで。", "neutral"),
      say("warden", "……頼んでいない。", "shock"),
      say("tactician", "ええ。ですが、あなたは奥が見たいのでしょう。稼ぎは、そのための手段だ。", "calm"),
      say("warden", "……台帳には書かないで。", "worry"),
    ]),
  }),

  stage_3_act3: Object.freeze({
    cast: Object.freeze([
            stand("warden", "center"), stand("lancer", "left"), stand("guardian", "far_left"),
            stand("tactician", "right"), stand("mender", "far_right"),
          ]),
    lines: Object.freeze([
      say("lancer", "一枠、余ってるな。ずっと。", "neutral"),
      say("guardian", "空いていたほうがいい。誰かが動ける。", "calm"),
      say("tactician", "同意します。埋まった隊は、そこから動けない。", "smile"),
    ]),
  }),

  stage_3_join: Object.freeze({
    cast: Object.freeze([
            stand("tactician", "center"), stand("lancer", "left"), stand("warden", "right"),
            stand("guardian", "far_left"), stand("mender", "far_right"),
          ]),
    lines: Object.freeze([
      say("tactician", "三、二、……いま。", "firm"),
      narrate("レイの合図で、カイの踏み込みが一拍早く入る。", "impact"),
      say("lancer", "早い。何をした。", "shock"),
      say("tactician", "あなたの番を、私の番と入れ替えました。増えてはいない。前に来ただけです。", "smile"),
      say("warden", "……協会の記録係が、なぜ灰の中に。", "worry"),
      say("tactician", "何百と読みました。読んだものを、一度でいいから自分の目で。", "calm"),
    ]),
  }),

  stage_3_end: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("lancer", "center"), stand("mender", "right")]),
    lines: Object.freeze([
      say("warden", "五人。これで、置いていく人を選ばなくて済む。", "smile"),
      say("lancer", "全員が同じことをするわけじゃない。置き場所と持ち物で変わる。", "wry"),
      say("mender", "……次は、誰かがまだ知らない使い方を見つける番。", "calm"),
    ]),
  }),

  homestead_first_night: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      narrate("籠に器材を入れ、二人ぶんの椅子を出す。屋根の半分から、まだ風が入る。"),
      say("mender", "板、足りませんでしたね。", "neutral"),
      say("warden", "次で足りる。……たぶん。", "wry"),
      say("mender", "その「たぶん」を、わたしは三回聞きました。", "calm"),
      say("warden", "……三回とも直ってる。", "smile"),
      say("mender", "半分ずつ。ええ、直っています。", "smile"),
    ]),
  }),

  homestead_morning_fire: Object.freeze({
    cast: Object.freeze([stand("lancer", "left"), stand("warden", "right"), stand("mender", "far_right")]),
    lines: Object.freeze([
      narrate("外がまだ暗いうちから、規則正しい音がしている。"),
      say("warden", "……カイ。火はもう起きてる。", "neutral"),
      say("lancer", "分かってる。手が空くと、考えるから。", "wry"),
      say("warden", "何を。", "neutral"),
      say("lancer", "……別に。灰の中でも同じだ。止まると、考える。", "worry"),
      narrate("シキは何も言わず、割った薪を運んだ。二往復ぶん、カイの手が空いた。"),
      say("mender", "腕、上がりすぎです。明日は割らせません。", "firm"),
      say("lancer", "……分かったよ。", "smile"),
    ]),
  }),

  homestead_shelf_rules: Object.freeze({
    cast: Object.freeze([
          stand("guardian", "center"), stand("lancer", "left"), stand("mender", "right"),
        ]),
    lines: Object.freeze([
      narrate("スミが棚の前にいる。割れた把手を、少しだけ動かして戻した。"),
      say("lancer", "……それ、さっきと同じ場所じゃないか？", "neutral"),
      say("guardian", "違う。二寸ずれてた。", "neutral"),
      say("lancer", "誰が決めたんだ、その二寸。", "wry"),
      say("guardian", "拾った順。左から。", "calm"),
      say("mender", "では、その一番左は。", "neutral"),
      say("guardian", "詰所の裏で拾った札。等級の申請を出した日に、落ちてた。", "neutral"),
      narrate("スミはそれ以上言わなかった。ナズナは記録帳に、日付だけを書いた。"),
      say("lancer", "……売らないんだったな。", "worry"),
      say("guardian", "うん。売ったら、順番が消える。", "smile"),
    ]),
  }),

  homestead_thick_book: Object.freeze({
    cast: Object.freeze([stand("tactician", "left"), stand("guardian", "right")]),
    lines: Object.freeze([
      narrate("レイが厚いほうの帳面を開いている。スミが横に座った。"),
      say("guardian", "それ、なに。", "neutral"),
      say("tactician", "戻らなかった人の記録です。協会の控えから、名前だけ写してある。", "calm"),
      say("guardian", "……何人。", "shock"),
      say("tactician", "四百十二。読んだのは、その倍あります。", "neutral"),
      narrate("スミは数を繰り返さなかった。帳面の縁を、指で押さえただけだった。"),
      say("tactician", "机の上では、全員が同じ大きさの字でした。", "worry"),
      say("guardian", "いまは。", "neutral"),
      say("tactician", "……違います。それが分かっただけでも、来た甲斐がある。", "smile"),
    ]),
  }),

  homestead_wrong_turn: Object.freeze({
    cast: Object.freeze([stand("tactician", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      narrate("器材を返して、四つ角を折れる。レイが先に立って、右へ曲がった。"),
      say("mender", "そちらは詰所へ戻ります。", "neutral"),
      say("tactician", "……ええ。確認のために一度戻ろうかと。", "calm"),
      say("mender", "四回目です。", "wry"),
      say("tactician", "三回目です。", "shock"),
      say("mender", "四回目。記録がありますので。", "calm"),
      narrate("レイは何か言いかけて、やめた。歩数は数えられるのに、曲がる方向だけが数にならない。"),
      say("tactician", "……その帳面、私の分は何が書いてあるんです。", "worry"),
      say("mender", "「よく数える。よく間違える。両方とも減らない」。", "smile"),
      say("tactician", "……正確ですね。", "wry"),
    ]),
  }),

  homestead_six_chairs: Object.freeze({
    cast: Object.freeze([
          stand("warden", "center"), stand("lancer", "left"), stand("guardian", "far_left"),
          stand("mender", "right"), stand("tactician", "far_right"),
        ]),
    lines: Object.freeze([
      narrate("卓に椅子が六つ。五人が座って、一つ余っている。"),
      say("lancer", "誰か来るのか。", "neutral"),
      say("warden", "予定は無い。", "neutral"),
      say("tactician", "空けておくのは悪くありません。隊も卓も、埋まると動けなくなる。", "smile"),
      say("mender", "……六枠に五人、と同じ話ですね。", "wry"),
      say("guardian", "うん。空いてるほうがいい。", "calm"),
      narrate("シキは目録の最後のページを開きかけて、閉じた。誰も何も言わなかった。"),
    ]),
  }),

});

export const DIALOGUE_IDS = Object.freeze(Object.keys(DIALOGUE));

function dialogueEntryFor(beatId) {
  const entry = DIALOGUE[beatId];
  if (!entry) throw new Error("dialogue: 未登録の断片 " + beatId);
  return entry;
}

export function dialogueFor(beatId) {
  return dialogueEntryFor(beatId).lines;
}

export function castFor(beatId) {
  return dialogueEntryFor(beatId).cast;
}
