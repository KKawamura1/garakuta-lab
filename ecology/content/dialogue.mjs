// ecology/content/dialogue.mjs
//
// **会話定義の正本。**本編の物語、序盤の一戦、根城の日常場面で
// 表示する台詞と地の文を、ここへ一箇所に集約する。
//
// 会話の本文や配役を変えるときは、このファイルだけを編集する。story.mjs と
// homestead.mjs には舞台・条件・表示順だけを置き、会話担当と
// システム担当が同じ行を触らないようにする。
//
// タイトル、場所、立ち位置、解禁条件、説明用 footer / hint、名簿の設定文は
// 会話本文ではないため、それぞれの定義ファイルに残す。
//
// ---------------------------------------------------------------- R13 で全面的に書き直した
//
// 人物が5人とも入れ替わったので、28本すべてを書き直している
// （設計は `analysis/CAST_REBOOT_TWELVE_TOMORROWS.md`）。
//
// **台詞は長く、会話は短く。**旧稿は往復が多く、一往復あたりの中身が薄かった。
// 一人の台詞に情報を二つ三つ積み、往復の数を減らす。とくに序盤は、早くゲームを
// 触りたい人を待たせない。**「もう終わり？ もっと読みたいのに」で切り上げるのが正しい。**
// story.test.mjs の 2〜6行という縛りは、この方針とそのまま噛み合う。
//
// **属性を台詞で説明しない。**「私は賢いです」を言わせない。ヒバナは話す速度で、
// ツグミは観察の細かさで、ナギは手が止まらないことで、ゲンゾウは間の長さで見せる。

import { narrate, say, stand } from "./beat.mjs";

export const DIALOGUE = Object.freeze({
  // ============================================================ Stage 0 — ゴウとツグミ
  stage_0_act1: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("warden", "right")]),
    lines: Object.freeze([
      narrate("浅いところの休み場。ツグミが小さな帳面を開く。"),
      say("mender", "腕の上がり方が、朝より二寸浅いです。座ってください。", "neutral"),
      say("warden", "そこまで見なくていいって。", "wry"),
      say("mender", "見るのが仕事です。器材は返せますが、体は返せませんので。", "calm"),
    ]),
  }),

  stage_0_act2: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("warden", "right")]),
    lines: Object.freeze([
      say("mender", "地図はここまででしたね。この先は。", "neutral"),
      say("warden", "三つ目の門までは台帳にある。四つ目から先は、誰も書いてない。", "neutral"),
      narrate("そこから先を、ゴウは少し長く喋った。ツグミは帳面に何も書かなかった。"),
    ]),
  }),

  stage_0_act3: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("warden", "抜けたら詰所な。器材返して、それから帰る。", "neutral"),
      say("mender", "順番を間違えないでくださいね。前は先に寝ました。", "wry"),
      say("warden", "……覚えてない。", "calm"),
    ]),
  }),

  stage_0_opening: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("warden", "よし行くぞ。先見機は？", "neutral"),
      say("mender", "座ってください。", "firm"),
      say("warden", "いや、先見機。", "wry"),
      say("mender", "校正中です。あと三分。——それと、お兄さんの記録が出てから睡眠一時間減、朝食半分、脈が二。三分あるので座ってください。", "firm"),
      narrate("坑の口から、ぬるい風が上がってくる。ゴウは黙って座った。"),
      say("warden", "……はい。", "calm"),
    ]),
  }),

  stage_0_prologue_defeat: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("warden", "right")]),
    lines: Object.freeze([
      say("mender", "……前に、出すぎ、ました。", "hurt"),
      say("warden", "ツグミ！", "shock", "impact"),
      narrate("腰の杭が鳴った。備蓄が一息で空になり、坑が来た道を逆にたどっていく。"),
    ]),
  }),

  stage_0_prologue_rewound: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("warden", "right")]),
    lines: Object.freeze([
      narrate("同じ朝。同じ光。ツグミが電極を持って背伸びしている。"),
      say("mender", "座ってくださいって言って——", "firm"),
      say("warden", "……杭、使った。", "worry"),
      say("mender", "……わたし、どうなりました。", "shock"),
      say("warden", "死んだ。", "calm"),
      say("mender", "……そうですか。覚えていないことでは泣けませんので、先に直します。先見機、貸してください。", "firm"),
    ]),
  }),

  stage_0_prologue_win: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("warden", "right")]),
    lines: Object.freeze([
      say("mender", "……誰も落ちていません。さっきと同じ影なのに。", "shock"),
      say("warden", "立つ場所を変えただけだ。それだけで、こうなる。", "calm"),
      say("mender", "「さっき」。やっぱり、何かありましたね。", "wry"),
      say("warden", "……台帳には書かない。", "worry"),
    ]),
  }),

  stage_0_end: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("warden", "抜けた。この先は、二人だと手が足りないな。", "neutral"),
      say("mender", "心当たりが？", "neutral"),
      say("warden", "ひとり。頼むと断れない人がいる。", "wry"),
      say("mender", "……それ、褒めてます？", "worry"),
    ]),
  }),

  // ============================================================ Stage 1 — ナギ
  stage_1_act1: Object.freeze({
    cast: Object.freeze([stand("lancer", "center"), stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("warden", "ナギ、前。", "neutral"),
      say("lancer", "えっ。あの、わたし、後ろのほうが……。", "shock"),
      say("mender", "後ろだと届きません。それと、いまこの隊で一番硬いのはあなたです。", "calm"),
      say("lancer", "…………はい。", "worry"),
    ]),
  }),

  stage_1_act2: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("lancer", "right")]),
    lines: Object.freeze([
      narrate("ナギの肩当てに、浅いが長い裂け目がある。"),
      say("mender", "その傷、いま塞ぐ意味はありません。", "neutral"),
      say("lancer", "ですよね。だから言ってません。", "worry"),
      say("mender", "言わないのと、気づかれないのは別です。", "calm"),
    ]),
  }),

  stage_1_act3: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("lancer", "right")]),
    lines: Object.freeze([
      say("lancer", "……あの。なんで、毎回わたしなんでしょうか。", "worry"),
      say("warden", "断らないから。", "neutral"),
      say("lancer", "そこは嘘でもいいので、頼りにしてる、とか言ってください。", "worry"),
      say("warden", "頼りにしてる。", "neutral"),
    ]),
  }),

  stage_1_join: Object.freeze({
    cast: Object.freeze([stand("lancer", "center"), stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("lancer", "えっ。あの、わたしですか。火力とか、無いですけど……。", "shock"),
      say("warden", "いらねえよ。三発ぶん立っててくれれば、それでいい。", "wry"),
      say("mender", "傷は診ます。ただし戻せるのは、いま受けたぶんだけです。", "calm"),
      say("lancer", "……断る理由を考えてるんですけど、出てこないです。", "worry"),
      say("warden", "じゃあ決まりだ。", "smile"),
    ]),
  }),

  stage_1_end: Object.freeze({
    cast: Object.freeze([stand("lancer", "center"), stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("lancer", "うう……今日だけで、何発……。", "hurt"),
      say("warden", "十一だ。数えてた。", "smile"),
      say("lancer", "数えてないで庇ってください！", "firm"),
      say("mender", "同意します。", "calm"),
    ]),
  }),

  // ============================================================ Stage 2 — ヒバナ
  stage_2_act1: Object.freeze({
    cast: Object.freeze([stand("guardian", "center"), stand("lancer", "left"), stand("warden", "right")]),
    lines: Object.freeze([
      narrate("崩れた回廊の脇。小さい影が屈んで、割れた把手を布に包んだ。"),
      say("guardian", "見て見て！ これ、光る！", "smile"),
      say("lancer", "……光ってないです。", "neutral"),
      say("guardian", "光るってば！", "firm"),
    ]),
  }),

  stage_2_act2: Object.freeze({
    cast: Object.freeze([stand("guardian", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("guardian", "ねえ、なんであたしが先に行くと、みんな早くなるの？", "neutral"),
      say("mender", "……なってますね。理屈は。", "worry"),
      say("guardian", "りくつ？", "neutral"),
      say("mender", "……いえ。合ってます。", "calm"),
    ]),
  }),

  stage_2_act3: Object.freeze({
    cast: Object.freeze([stand("guardian", "left"), stand("lancer", "right")]),
    lines: Object.freeze([
      say("lancer", "ヒバナちゃん、そっち危ないです。", "worry"),
      say("guardian", "はーい！", "smile"),
      narrate("三歩で戻ってきて、また同じところへ走っていった。"),
      say("lancer", "……うう。聞いてない。", "hurt"),
    ]),
  }),

  stage_2_join: Object.freeze({
    cast: Object.freeze([
      stand("guardian", "center"), stand("lancer", "left"), stand("warden", "right"),
      stand("mender", "far_right"),
    ]),
    lines: Object.freeze([
      say("guardian", "こっち！ はやくはやく！", "firm"),
      narrate("小さい影が割り込み、ナギの襟をつかんで一歩ぶん引いた。灰が跳ねた。", "impact"),
      say("lancer", "えっ、えっ。", "shock"),
      say("warden", "……いま、当たる位置だったな。", "neutral"),
      say("guardian", "でしょ！ あたし、わかるの！", "smile"),
      say("mender", "説明になっていません。ですが、合っています。", "wry"),
    ]),
  }),

  stage_2_end: Object.freeze({
    cast: Object.freeze([
      stand("guardian", "center"), stand("warden", "left"), stand("mender", "right"),
    ]),
    lines: Object.freeze([
      say("warden", "名前は。", "neutral"),
      say("guardian", "ヒバナ！", "smile"),
      say("mender", "記録は。", "neutral"),
      say("warden", "無い。照会したが、一件も出ない。", "calm"),
      say("guardian", "……ないの？", "worry"),
      say("warden", "ないな。じゃあ今日から作る。", "smile"),
    ]),
  }),

  // ============================================================ Stage 3 — ゲンゾウ
  stage_3_act1: Object.freeze({
    cast: Object.freeze([stand("tactician", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      narrate("焚き火の両側で、二人が別々の帳面を開いている。"),
      say("mender", "あなたも付けるんですね。", "neutral"),
      say("tactician", "出来事のほうを。何が起きて、何番目だったかを。", "calm"),
      say("mender", "わたしは人のほうです。同じ火を囲んでいるのに、残るものが違う。", "wry"),
    ]),
  }),

  stage_3_act2: Object.freeze({
    cast: Object.freeze([stand("tactician", "center"), stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("tactician", "お兄様は、ご存命ですよ。", "calm"),
      say("warden", "……どこだ。", "shock"),
      say("tactician", "記録にございません。ですが、死亡もございません。", "calm"),
      say("mender", "……それ、根拠になっていませんが。", "worry"),
    ]),
  }),

  stage_3_act3: Object.freeze({
    cast: Object.freeze([stand("guardian", "left"), stand("tactician", "right")]),
    lines: Object.freeze([
      say("guardian", "ゲンゾウのおじいちゃん、なんで殴らないの？", "neutral"),
      say("tactician", "持っておりませんので。", "calm"),
      say("guardian", "じゃあ、なに持ってるの。", "neutral"),
      say("tactician", "盾と、名簿を。", "calm"),
    ]),
  }),

  stage_3_join: Object.freeze({
    cast: Object.freeze([
      stand("tactician", "center"), stand("warden", "left"), stand("mender", "right"),
      stand("lancer", "far_left"), stand("guardian", "far_right"),
    ]),
    lines: Object.freeze([
      say("tactician", "失礼いたします。中央観測院、記録主任のゲンゾウと申します。", "calm"),
      say("warden", "……じいさん、どっから入った。", "shock"),
      say("tactician", "扉から。鍵が壊れておりましたので、直しておきました。", "calm"),
      narrate("ゲンゾウが帽子を取って、丁寧に頭を下げる。"),
      say("tactician", "四十年、戻らなかった方の名前を書いてまいりました。もう、増やしたくないのです。こちらの欄も、あちらの欄も。", "calm"),
      say("lancer", "……あの。泣いていいですか。", "hurt"),
    ]),
  }),

  stage_3_end: Object.freeze({
    cast: Object.freeze([
      stand("warden", "center"), stand("guardian", "left"), stand("mender", "right"),
      stand("tactician", "far_right"),
    ]),
    lines: Object.freeze([
      say("warden", "五人。これで、置いていく奴を選ばなくて済む。", "smile"),
      say("guardian", "六人！ 椅子、六つあるもん！", "firm"),
      say("mender", "五人です。", "calm"),
      say("guardian", "えー。", "worry"),
      say("tactician", "六つ目は、わたくしの荷物が使っております。", "calm"),
      say("tactician", "……歳を取ると、荷物が増えますので。", "smile"),
    ]),
  }),

  // ============================================================ 根城の日常
  homestead_first_night: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      narrate("籠に器材を入れ、二人ぶんの椅子を出す。屋根の半分から、まだ風が入る。"),
      say("mender", "板、足りませんでしたね。", "neutral"),
      say("warden", "次で足りる。……たぶん。", "wry"),
      say("mender", "その「たぶん」を、わたしは三回聞きました。", "calm"),
      say("warden", "……三回とも直ってるだろ。", "smile"),
      say("mender", "半分ずつ。ええ、直っています。", "smile"),
    ]),
  }),

  homestead_morning_fire: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      narrate("外がまだ暗いうちから、いい匂いがしている。"),
      say("mender", "……なんですか、これは。", "shock"),
      say("warden", "飯。", "neutral"),
      say("mender", "字はあんなに汚いのに。", "worry"),
      say("warden", "関係あるか。", "wry"),
      say("mender", "……おかわりします。", "calm"),
    ]),
  }),

  homestead_shelf_rules: Object.freeze({
    cast: Object.freeze([stand("lancer", "left"), stand("guardian", "right")]),
    lines: Object.freeze([
      narrate("ナギが棚の前にいる。割れた把手を、少しだけ動かして戻した。"),
      say("guardian", "それ、さっきと同じとこじゃない？", "neutral"),
      say("lancer", "違います。二寸ずれてました。", "neutral"),
      say("guardian", "だれが決めたの、その二寸。", "firm"),
      say("lancer", "……わたし、だと思うんですけど。覚えてないんです。", "worry"),
      narrate("棚の奥の札に、ナギの字で「絶対に捨てるな」と書いてある。日付は、どれも古い。"),
    ]),
  }),

  homestead_thick_book: Object.freeze({
    cast: Object.freeze([stand("tactician", "left"), stand("guardian", "right")]),
    lines: Object.freeze([
      narrate("ゲンゾウが厚いほうの帳面を開いている。ヒバナが横に座った。"),
      say("guardian", "それ、なに。", "neutral"),
      say("tactician", "戻らなかった方の記録です。名前だけ写してございます。", "calm"),
      say("guardian", "……なんにん。", "shock"),
      say("tactician", "四百十二。読んだのは、その倍ございます。", "neutral"),
      say("guardian", "……ヒバナの名前は、ない？", "worry"),
    ]),
  }),

  homestead_wrong_turn: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      narrate("器材を返して、四つ角を折れる。ゴウが先に立って、右へ曲がった。"),
      say("mender", "そちらは詰所へ戻ります。", "neutral"),
      say("warden", "……ああ。確認のために、一回戻ろうかと。", "wry"),
      say("mender", "四回目です。", "calm"),
      say("warden", "三回目だ。", "firm"),
      say("mender", "四回目。記録がありますので。", "calm"),
    ]),
  }),

  homestead_six_chairs: Object.freeze({
    cast: Object.freeze([
      stand("warden", "center"), stand("guardian", "left"), stand("lancer", "far_left"),
      stand("tactician", "right"),
    ]),
    lines: Object.freeze([
      say("guardian", "ねえ、椅子が六つある！ だれか来るの？", "neutral"),
      say("warden", "予定は無い。拾ってきた椅子が、たまたま六だっただけだ。", "neutral"),
      say("lancer", "……荷物を置くのに、ちょうどいいんですよね。", "worry"),
      say("guardian", "えー！ もったいない！", "firm"),
      say("tactician", "もったいのうございますか。", "calm"),
      say("tactician", "では、そのうち埋まるということで。", "smile"),
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
