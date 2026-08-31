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
// ここを触ってよいのは 物語 担当だけ。engine・schema・content 契約は変更しない。

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

const beat = (id, title, lines, footer = null) => Object.freeze({
  id, title, lines: Object.freeze(lines.map((line) => Object.freeze(line))), footer,
});

// ---------------------------------------------------------------- Stage ごとの断片

export const STORY_BEATS = Object.freeze({
  stage_0_edge: Object.freeze({
    opening: beat("stage_0_opening", "灰の入口", [
      { speaker: "レオン", text: "先に行く。灰は待ってくれない。" },
      { speaker: "ユウリ", text: "待って。何が出てくるか見てから決めたい。" },
      { speaker: "レオン", text: "見てるあいだに囲まれる。斬れば減る。それだけだ。" },
      { speaker: "ユウリ", text: "減らないものもある。……行くなら、私が前に出る。" },
    ], "二人の考え方は違う。どちらが正しいかは、盤面が決める。"),
    prologueDefeat: beat("stage_0_prologue_defeat", "届かなかった", [
      { speaker: "レオン", text: "……硬い。刃が滑る。" },
      { speaker: "ユウリ", text: "後ろから来てる。二人とも前に出すぎた。" },
      { speaker: null, text: "灰が渦を巻き、門の前に戻される。もう一度、同じ影が立っている。" },
    ], "戦闘予測を開くと、次の一戦の結果が先に読める。編成を一つ変えて、予測がどう動くか見てほしい。"),
    stageEnd: beat("stage_0_end", "門を抜けた", [
      { speaker: "ユウリ", text: "抜けた。あなたの言うとおり、斬れば減るものもあった。" },
      { speaker: "レオン", text: "お前が前に立ってなきゃ、俺の刃は届いてない。" },
      { speaker: "ユウリ", text: "……次は、誰かを守りながら進むことになる。" },
    ], "次の Stage では「かばう」という出来事が増える。"),
  }),
  stage_1_wall: Object.freeze({
    join: beat("stage_1_join", "かばう手", [
      { speaker: "ナギ", text: "そこ、危ない。" },
      { speaker: null, text: "ナギが割り込み、レオンへ飛んだ一撃を肩で受ける。" },
      { speaker: "レオン", text: "……なんで受けた。避ければよかっただろ。" },
      { speaker: "ナギ", text: "受けた側は、次に何が来るか分かる。避けた側は分からない。" },
      { speaker: "ユウリ", text: "受けることが、情報になる。" },
    ], "受け止めた結果は、集中（自分へ）か防壁（味方へ）のどちらかへ渡せる。"),
    stageEnd: beat("stage_1_end", "誰を守るか", [
      { speaker: "ナギ", text: "守るのは、守りたいからじゃない。そのあと誰が動けるかで決める。" },
      { speaker: "レオン", text: "……順番の話か。" },
    ], "次の Stage では「順番」そのものを動かせるようになる。"),
  }),
  stage_2_tempo: Object.freeze({
    join: beat("stage_2_join", "間合いと順番", [
      { speaker: "トワ", text: "三、二、……いま。" },
      { speaker: null, text: "トワの合図で、レオンの溜めが一拍早く完成する。" },
      { speaker: "レオン", text: "早い。何をした。" },
      { speaker: "トワ", text: "あなたの番を、私の番と入れ替えた。増えてはいない。前に来ただけ。" },
      { speaker: "ナギ", text: "……順番は、増やすものじゃなく、渡すもの。" },
    ], "行動権は総量が増えない。誰へいつ渡すかだけが問題になる。"),
    stageEnd: beat("stage_2_end", "渡せるもの", [
      { speaker: "トワ", text: "渡せるのは順番だけじゃない。傷も渡せる。" },
      { speaker: "ユウリ", text: "……それは、渡された側が持たなきゃいけない。" },
    ], "次の Stage では、傷そのものが遠征をまたいで残る意味を持つ。"),
  }),
  stage_3_care: Object.freeze({
    join: beat("stage_3_join", "傷を抱えて進む", [
      { speaker: "ミナ", text: "その傷、いま塞ぐ意味はない。" },
      { speaker: "レオン", text: "は？ 治すのがあんたの仕事だろ。" },
      { speaker: "ミナ", text: "戻せるのは、いま受けたぶんだけ。古い傷は、次の一撃を減らすほうが早い。" },
      { speaker: "ナギ", text: "……止めるのと、戻すのは違う。" },
      { speaker: "ミナ", text: "そう。私は連鎖を止める役。" },
    ], "応急処置は同じ一撃にしか効かない。待っても持ち越しHPは戻らない。"),
    stageEnd: beat("stage_3_end", "五人になった", [
      { speaker: "ユウリ", text: "五人。もう、誰かを外して進む必要はない。" },
      { speaker: "レオン", text: "全員が同じことをするわけじゃない。置き場所と持ち物で変わる。" },
      { speaker: "ミナ", text: "……次は、私たちの誰かが、まだ知らない使い方を見つける番。" },
    ], "ここから先は、配置・技能・装備の差だけで役割を作る。"),
  }),
});

// その Stage の断片。無ければ空を返す（Stage が増えても落ちない）。
export function storyBeatsForStage(stageId) {
  return STORY_BEATS[stageId] ?? {};
}

export function storyBeat(stageId, key) {
  return storyBeatsForStage(stageId)[key] ?? null;
}
