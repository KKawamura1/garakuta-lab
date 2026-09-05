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
// **台詞は長く、会話は短く。**往復を増やさずに、一人の台詞へ情報を二つ三つ積む。
// 短い応酬だけで組むと、読み味は軽いが**何も伝わらない会話**になる。
//
// **行数のハードリミットは置かない（R13・作者判断）。**数で縛ると、一行に情報を
// 詰められない場面まで一律に切り詰めることになり、「短いが伝わっていない」が通る。
//
// 代わりに**厚みの勾配**を置く。**プレイヤーは物語を読みに来たのではなく、
// ゲームをしに来ている。**
//
//   Stage 0   … 一番薄い。まだ何も分かっていない人を待たせない
//   Stage 1〜3 … 人が増えるぶん厚くする。ここで初めて関係が動く
//   根城       … 一番厚い。**読みに行った人だけが開く場面**なので、長くてよい
//
// 「もう終わり？ もっと読みたいのに」で切り上げるのが正しいのは、序盤の話である。
//
// **属性を台詞で説明しない。**「私は賢いです」を言わせない。ヒバナは話す速度で、
// ツグミは観察の細かさで、ナギは手が止まらないことで、ゲンゾウは間の長さで見せる。
//
// **深さにも勾配を置く（R15・作者判断）。**厚み（行数）とは別の軸である。
// 望み・秘密・過去・後悔は**五人が揃ってから**出す。Stage 0 でそれを出すと、
// まだ誰のことも知らない読み手に重さだけが渡り、**人物の調子が沈む。**
// 立ち上がりで沈んだゴウは「無口で頼れる人」に読めるが、**それは別人である**
// （設定は「声がでかい。ガサツで、口が上手くて、調子がいい」）。
//
//   Stage 0   … 二人の**調子**だけ。掘らない
//   Stage 1〜3 … 関係が動く。ここから望みに触れてよい
//   根城       … 一番深い。秘密と過去はここに置く
//
// **人物はゲームのシステムを知らない。**彼らはそこに生きているだけで、
// 腕力・集中・受け・行動権・反応点・隊列・後列減衰・手番といった語は、
// **一人も知らないし、一度も使わない。**知っているのは坑の側の事実だけである
// （先見機で次の一戦が読めること、外へ出ると遠征の記憶が崩れること、遺装が崩れること）。
//
// 盤面の理屈を伝えたいときは、**規則ではなく観察を言わせる。**
//
//   × 「あなたの受けは一発ごとに引きます」      … guard の仕様
//   ○ 「細かいのを何発もらっても、傷が浅い。数えました」 … ツグミが見た事実
//   × 「後ろが一手ぶん得をします」              … 手番の勘定
//   ○ 「灰殻が揃ってそちらを向きます。その隙に、後ろが動けています」
//
// **数値と仕様を書く場所は台詞ではない。**名簿（character-lore.mjs の field）、
// footer / hint、技能説明はゲームがプレイヤーへ直接話す欄なので、そちらで書く。

import { narrate, say, stand } from "./beat.mjs";

export const DIALOGUE = Object.freeze({
  // ============================================================ Stage 0 — ゴウとツグミ
  //
  // **ここは掘らない（R15・作者判断）。**兄も、記憶の速さも、言い過ぎた後悔も、
  // 五人が揃ってから出す。Stage 0 が渡すのは二人の**調子**だけである。
  //
  //   ゴウ   … 声がでかい。減らず口。ツグミの世話焼きを嫌がらず、軽口で受け流す
  //   ツグミ … 早口。細かく見ている。心配を隠さず、ゴウにだけ丁寧語のまま軽口を返す
  //
  // **ゴウを素直に折らない（R15・作者指摘）。**初稿は開幕で「……はい」と折っていたが、
  // 直後に一分で立って先に行くので**言行が一致していない**うえ、読み手には
  // 大男が急にしおらしくなる理由が無い。「へいへい」は心配されるのを嫌がらないまま
  // 軽口で受け、結局一分で立つ返事なので、ここでやることと一致する。ツグミも糾弾せず、
  // 診察の申し出と「隠すのが下手」という親しい相手への軽口で返す。
  // 二人が対等だと見えるのは、互いに世話を焼き、遠慮なく茶化せるからである。
  //
  // **本当に折れるのは一度だけにする。**巻き戻したあとの「……ああ。今日は、三分待つ。」
  // が Stage 0 唯一の素直で、そこまで一度も折れていないから効く。
  //
  // R13 の初稿はここで兄の失踪を出していた。**開幕の一枚が喪失の場面になり、
  // ゴウが最初から寡黙になっていた**（作者評価・R15）。兄はゲンゾウが Stage 3 で
  // 出すので、伏線を Stage 0 に置く必要はない。
  //
  // ---- 「三分」は消さない（R15・作者指摘）------------------------------------
  //
  // 画面は**巻き戻す前の1戦目にだけ戦闘予測を出さない**（`app.js` の
  // `forecastVisible`「読めても直せない予測は、脅しにしかならない」）。
  // つまり一戦目は先見機が無い。**会話はその理由を持たなければならない。**
  //
  //   opening  … 校正まであと三分。ゴウは座るが、一分で立って先に行く
  //   defeat   … 読めないまま入ったので、ツグミが落ちる
  //   rewound  … 「今日は、三分待つ。」——ここで先見機が手に入る
  //   win      … 予測を見て立つ場所を変えると、同じ盤面が別の結果になる
  //
  // **負けたのはゴウが待たなかったからで、勝てるのは予測を見たからである。**
  // 三分・一分・「三分待つ」の三点を外すと、**理由の無い敗北**に戻る。
  stage_0_act1: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("warden", "right")]),
    lines: Object.freeze([
      narrate("浅いところの休み場。ゴウが腰を下ろすより先に、ツグミが帳面を開いて前へ回り込む。"),
      say("mender", "腕、上がってません。朝より二寸浅いです。座ってください。", "firm"),
      say("warden", "元気だなお前。ほら、上がる。上がってんだろ？", "smile"),
      say("mender", "上がってません。二寸です。", "firm"),
      say("warden", "……二寸なんか誤差だろ。", "wry"),
      say("mender", "誤差で死にます。器材は返せますが、体は返せませんので。", "calm"),
    ]),
  }),

  stage_0_act2: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("warden", "right")]),
    lines: Object.freeze([
      narrate("灰の斜面。ゴウが台帳を開いて、途中で放り出すように閉じた。"),
      say("warden", "地図はここまでだ。三つ目の門までは台帳にある。四つ目から先は、どいつも書いてねえ。", "neutral"),
      say("mender", "困りましたね。", "neutral"),
      say("warden", "何がだよ。誰も書いてねえってことは、そこにある物はまだ誰の物でもねえってことだろ。", "smile"),
      say("mender", "誰の物でもないのは、誰も持って帰れていないからです。", "firm"),
      say("warden", "じゃあ俺が一番だな。", "smile"),
    ]),
  }),

  stage_0_act3: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("warden", "抜けたら詰所だ。器材返して、借り消して、それから帰る。順番は変えられん。", "neutral"),
      say("mender", "前は先に寝ましたよね。籠の前で、立ったまま。", "wry"),
      say("warden", "……覚えてない。", "calm"),
      say("mender", "わたしが起こしました。三回ゆすって、駄目だったので頬を叩きました。", "wry"),
      say("warden", "叩いたのかよ！", "shock"),
      say("mender", "起きなかったので。覚えていなくて結構です。", "calm"),
    ]),
  }),

  stage_0_opening: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("warden", "よし行くぞ！ 今日は当たりだ、勘が言ってる。先見機、もう使えるか？", "smile"),
      say("mender", "校正中です。あと三分。その間に、右足を見せてください。", "calm"),
      say("warden", "三分かあ。先に様子だけ見てくる、ってのは？ ほら、歩けてるし。", "wry"),
      say("mender", "昨日も同じことを言っていました。宿の階段、二段目から下まで、ずっと右足をかばっていたのに。", "wry"),
      say("warden", "相変わらずよく見てんな、ツグミ。隠したつもりだったんだぞ。", "smile"),
      say("mender", "知っています。隠すのが下手なのも、いつものことです。三分で済ませますから、座ってください。", "smile"),
      say("warden", "へいへい。じゃあ頼む、先生。三分だけだぞ。", "smile"),
      narrate("坑の口から、ぬるい風が上がってくる。ゴウは座った。——一分で立って、先に行った。"),
      say("mender", "もう、ゴウ！ あと二分くらい待てたでしょう！", "firm"),
    ]),
  }),

  stage_0_prologue_defeat: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("warden", "right")]),
    lines: Object.freeze([
      say("mender", "……前に、出すぎ、ました。", "hurt"),
      say("warden", "ツグミ！ おい、目ぇ開けろ、こっち向け！", "shock", "impact"),
      narrate("腰の杭が鳴った。備蓄が一息で空になり、坑が来た道を逆にたどっていく。"),
    ]),
  }),

  stage_0_prologue_rewound: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("warden", "right")]),
    lines: Object.freeze([
      narrate("同じ朝。同じ光。ツグミが電極を持って背伸びしている。"),
      say("mender", "校正、あと三分です。ですから座ってくださいって、さっきから何度も——", "firm"),
      say("warden", "……杭、使った。", "worry"),
      say("mender", "……え。わたし、どうなりました。", "shock"),
      say("warden", "死んだ。", "calm"),
      say("mender", "……そうですか。覚えていないことでは泣けませんので、先に直します。先見機、貸してください。", "firm"),
      say("warden", "……ああ。今日は、三分待つ。", "calm"),
    ]),
  }),

  stage_0_prologue_win: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("warden", "right")]),
    lines: Object.freeze([
      say("mender", "……誰も落ちていません。敵の数も、並びも、さっきと同じなのに。", "shock"),
      say("warden", "だろ？ 立つ場所を変えた。それだけだ。同じ形で入れば、同じように終わる。", "smile"),
      say("mender", "「さっき」。", "neutral"),
      say("warden", "言ってねえ。", "wry"),
      say("mender", "言いました。二回。やっぱり、何かありましたね。", "firm"),
      say("warden", "……台帳には書かない。", "worry"),
    ]),
  }),

  stage_0_end: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("warden", "抜けたな！ 見たか、俺の勘。当たりだって言っただろ。", "smile"),
      say("mender", "勘ではありません。立つ場所を変えたからです。", "firm"),
      say("warden", "それを勘って言うんだよ。", "smile"),
      say("mender", "言いません。", "firm"),
      say("warden", "……ま、いい。この先は二人だと足りん。数じゃなくて、前で受ける役がいねえ。ひとり心当たりがある。頼むと断れねえ奴だ。腕は立つのに、断り方だけ知らねえんだよ。", "wry"),
      say("mender", "……それ、褒めてます？", "worry"),
    ]),
  }),

  // ============================================================ Stage 1 — ナギ
  stage_1_act1: Object.freeze({
    cast: Object.freeze([stand("lancer", "center"), stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("warden", "ナギ、前。", "neutral"),
      say("lancer", "えっ。あの、わたし、後ろのほうが……。", "shock"),
      say("mender", "後ろだと手が届きません。それと、あなたは細かいのを何発もらっても、傷が浅い。数えました。前に立って一番減らないのは、あなたです。", "calm"),
      say("lancer", "…………はい。理屈は、わかりました。", "worry"),
    ]),
  }),

  stage_1_act2: Object.freeze({
    cast: Object.freeze([stand("mender", "left"), stand("lancer", "right")]),
    lines: Object.freeze([
      narrate("ナギの肩当てに、浅いが長い裂け目がある。"),
      say("mender", "その傷、いま塞ぐ意味はありません。", "neutral"),
      say("lancer", "ですよね。だから言ってません。", "worry"),
      say("mender", "言わないのと、気づかれないのは別です。次に開いたら縫いますので、それまでは庇わないでください。", "calm"),
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
      say("warden", "いらねえよ。削るのはツグミがやる。お前は三発ぶん立っててくれれば、それでいい。", "wry"),
      say("mender", "傷は診ます。ただし戻せるのは、いま受けたぶんだけです。", "calm"),
      say("lancer", "……断る理由を考えてるんですけど、出てこないです。", "worry"),
      say("warden", "じゃあ決まりだ。", "smile"),
    ]),
  }),

  stage_1_end: Object.freeze({
    cast: Object.freeze([stand("lancer", "center"), stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("lancer", "うう……今日だけで、何発受けたと思ってるんですか……。", "hurt"),
      say("warden", "十一だ。数えてた。", "smile"),
      say("lancer", "数えてないで庇ってください！", "firm"),
      say("mender", "同意します。ちなみに十三です。二発は、本人が気づいていません。", "calm"),
    ]),
  }),

  // ============================================================ Stage 2 — ヒバナ
  stage_2_act1: Object.freeze({
    cast: Object.freeze([stand("guardian", "center"), stand("lancer", "left"), stand("warden", "right")]),
    lines: Object.freeze([
      narrate("崩れた回廊の脇。ヒバナが屈んで、割れた把手を布に包んでいる。"),
      say("guardian", "見て見て！ これ光るんだよ、こうやって傾けると！ ほら！", "smile"),
      say("lancer", "……光っては、ないです。", "neutral"),
      say("guardian", "光るってば！ さっきは光ったもん！", "firm"),
    ]),
  }),

  stage_2_act2: Object.freeze({
    cast: Object.freeze([stand("guardian", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("guardian", "ねえねえ、なんであたしが先に行くと、みんな早くなるの？", "neutral"),
      say("mender", "……なっていますね。あなたが飛び込むと、灰殻が揃ってそちらを向きます。その隙に、後ろが動けています。……理屈は、合っています。", "worry"),
      say("guardian", "りくつ？", "neutral"),
      say("mender", "……いえ。合っている、と言いました。", "calm"),
    ]),
  }),

  stage_2_act3: Object.freeze({
    cast: Object.freeze([stand("guardian", "left"), stand("lancer", "right")]),
    lines: Object.freeze([
      say("lancer", "ヒバナちゃん、そっちは危ないです。灰が薄いところは、下が抜けますから。", "worry"),
      say("guardian", "はーい！", "smile"),
      narrate("三歩で戻ってきて、また同じところへ走っていった。"),
      say("lancer", "……うう。聞いてはいるんです。聞いてはいるんですけど。", "hurt"),
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
      say("warden", "名前は。", "neutral"),
      say("guardian", "ヒバナ！", "smile"),
      say("mender", "照会は。", "neutral"),
      say("warden", "出ない。詰所にも協会にも、この歳の子の記録が一件も無い。拾われた記録も、生まれた記録もだ。", "calm"),
    ]),
  }),

  stage_2_end: Object.freeze({
    cast: Object.freeze([
      stand("guardian", "center"), stand("warden", "left"), stand("mender", "right"),
    ]),
    lines: Object.freeze([
      say("guardian", "……ないの？ あたしの、ない？", "worry"),
      say("warden", "ないな。", "neutral"),
      say("warden", "じゃあ今日から作る。名前と、歳と、拾った日と。全部こっちで書く。", "smile"),
    ]),
  }),

  // ============================================================ Stage 3 — ゲンゾウ
  stage_3_act1: Object.freeze({
    cast: Object.freeze([stand("tactician", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      narrate("焚き火の両側で、二人が別々の帳面を開いている。"),
      say("mender", "あなたも付けるんですね。", "neutral"),
      say("tactician", "出来事のほうを。何が起きて、何番目だったかを。", "calm"),
      say("mender", "わたしは人のほうです。誰が何時間寝て、何を食べて、どこまで腕が上がったか。……同じ火を囲んでいるのに、残るものが違いますね。", "wry"),
    ]),
  }),

  stage_3_act2: Object.freeze({
    cast: Object.freeze([stand("tactician", "center"), stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      say("tactician", "お兄様は、ご存命ですよ。", "calm"),
      say("warden", "……どこだ。", "shock"),
      say("tactician", "記録にございません。ですが、死亡の記録もございません。四十年ぶんの名簿は、わたくしが書き写しました。無い、ということだけは確かでございます。", "calm"),
      say("mender", "……それ、根拠になっていませんが。", "worry"),
    ]),
  }),

  stage_3_act3: Object.freeze({
    cast: Object.freeze([stand("guardian", "left"), stand("tactician", "right")]),
    lines: Object.freeze([
      say("guardian", "ゲンゾウのおじいちゃん、なんで殴らないの？", "neutral"),
      say("tactician", "持っておりませんので。", "calm"),
      say("guardian", "じゃあ、なに持ってるの！", "firm"),
      say("tactician", "盾と、名簿を。……どちらも、数を減らさないための物でございます。", "calm"),
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
      say("mender", "板、足りませんでしたね。あと二枚あれば、こちら側は塞がりました。", "neutral"),
      say("warden", "次で足りる。……たぶん。", "wry"),
      say("mender", "その「たぶん」を、わたしは三回聞きました。一回目が雨漏り、二回目が壁、三回目がここです。", "calm"),
      say("warden", "……三回とも直ってるだろ。", "smile"),
      say("mender", "半分ずつ。ええ、直っています。", "smile"),
      narrate("屋根の直っている側に、二人ぶんの寝床を作る。"),
      say("warden", "……悪くねえだろ。誰も見に来ねえ場所ってのは、そう無い。", "calm"),
      say("mender", "……それ、帳面に書いておきます。", "neutral"),
    ]),
  }),

  homestead_morning_fire: Object.freeze({
    cast: Object.freeze([stand("warden", "left"), stand("mender", "right")]),
    lines: Object.freeze([
      narrate("外がまだ暗いうちから、いい匂いがしている。火は既に熾きていて、鍋の位置が二度、直された跡がある。"),
      say("mender", "……なんですか、これは。", "shock"),
      say("warden", "飯。火の番はナギが長いからな。起きたやつが先に炊く決まりだ。", "neutral"),
      say("mender", "決まりは無いはずですが。それに、いつも起きているのはあなたです。", "neutral"),
      say("warden", "決まりにしたら守らなきゃならんだろ。面倒だ。", "wry"),
      say("mender", "……帳簿の字はあんなに汚いのに、塩は狂わないんですね。", "worry"),
      say("warden", "関係あるか。", "wry"),
      say("mender", "あります。手が正確な人は、大体どこか一つだけ雑です。", "calm"),
      say("mender", "……おかわりします。", "calm"),
    ]),
  }),

  homestead_shelf_rules: Object.freeze({
    cast: Object.freeze([stand("lancer", "left"), stand("guardian", "right")]),
    lines: Object.freeze([
      narrate("ナギが棚の前にいる。割れた把手を、少しだけ動かして戻した。"),
      say("guardian", "それ、さっきと同じとこじゃない？ 動かして、戻してる！", "neutral"),
      say("lancer", "違います。二寸ずれてました。ここは留め金、ここは札、と決まっているので。", "neutral"),
      say("guardian", "だれが決めたの、その二寸！", "firm"),
      say("lancer", "……わたし、だと思うんですけど。", "worry"),
      say("lancer", "決めた日のことは、覚えてないんです。手だけが場所を知っていて、勝手に直してしまうので。", "hurt"),
      narrate("棚の奥の札に、ナギの字で「絶対に捨てるな」と書いてある。日付は、どれも古い。"),
      say("guardian", "……じゃあ、いま決めたことにすれば？", "neutral"),
      say("lancer", "……そうします。今日、わたしが決めました。二寸です。", "smile"),
    ]),
  }),

  homestead_thick_book: Object.freeze({
    cast: Object.freeze([stand("tactician", "left"), stand("guardian", "right")]),
    lines: Object.freeze([
      narrate("ゲンゾウが厚いほうの帳面を開いている。ヒバナが横に座った。"),
      say("guardian", "それ、なに。", "neutral"),
      say("tactician", "戻らなかった方の記録です。協会へ出す用には数だけを、こちらには名前だけを写してございます。", "calm"),
      say("guardian", "……なんにん。", "shock"),
      say("tactician", "四百十二。読んだのは、その倍ございます。", "neutral"),
      say("guardian", "……ヒバナの名前は、ない？", "worry"),
      narrate("ゲンゾウは、ずいぶん長く黙っていた。"),
      say("tactician", "ございません。こちらには、戻らなかった方しか書きませんので。", "calm"),
      say("tactician", "あなたの名前は、薄いほうにございます。先月、わたくしが書き足しました。歳のところは、まだ空けてございますが。", "smile"),
      say("guardian", "じゅういち！ たぶん！", "firm"),
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
      say("mender", "四回目。日付も、そのとき何と言ったかも書いてあります。一回目が「確認のために」、二回目も「確認のために」でした。", "calm"),
      say("warden", "……こういうのは、書かなくていいんだよ。", "worry"),
      say("mender", "書きます。数にならないものだけ、消えてしまうので。", "neutral"),
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
      narrate("ゲンゾウは、六つ目の椅子に載った自分の鞄を、少しだけ端へ寄せた。"),
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
