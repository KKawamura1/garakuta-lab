// ecology/content/dossiers.mjs
//
// **読める設定。世界樹の迷宮のギルドカードにあたるもの（R12 §4.A）。**
//
// R11 §1 は愛着の源として「表情差分・仕草の豊かさ」と「設定の厚み（過去・好み・関係）」を
// 選び、**会話は増やさない**と決めた。だが実装されたのは前者だけで、R11 §2・§4・§5 に
// 書いた人物の中身は設計資料の中にしか無く、プレイヤーからは一行も読めなかった。
// ここはその移送先である。**新しく設定を作る場所ではない。**
//
// ---------------------------------------------------------------- 一度に語らない
//
// **全部を最初から開かない**（作者判断）。目録は、その人と何度灰へ入ったかで開く。
//
//   figure … 佇まいと喋り方。**加入した時点で読める。**
//   field  … 灰の中で分かること（経歴・拾った一品）。加入した Stage を越えると開く。
//   home   … 根城での姿。そのさらに次の Stage を越えると開く。
//   will   … その人が何を求めているか。**5人が揃うまで、誰の分も開かない。**
//            （最初から居る二人は先に home まで進むが、そこで止まる）
//
// R11 §7.1「will を台詞で説明させない。……それ以外は目録の最後のページで見せる」を、
// そのまま構造にしてある。**会話は will を一度しか言わない**（レイがシキに気づく
// Stage 3 の幕間）。残りはここで、しかも最後にだけ開く。
//
// 関係（bonds）は R11 §5。**相手が加入していて、遅いほうの加入 Stage を越えたとき**に開く。
// 誰と組んだかで読めるものが変わる、という形にしてある。
//
// ここを触ってよいのは 物語 担当だけ。engine・schema・content 契約は変更しない。

import { CHARACTER_NAMES } from "./characters.mjs";

// 節の並び。**開く順そのもの**なので、ここを入れ替えると開示順が変わる。
export const DOSSIER_SECTIONS = Object.freeze(["figure", "field", "home", "will"]);

export const DOSSIER_SECTION_HEADINGS = Object.freeze({
  figure: "佇まい",
  field: "灰の中では",
  home: "根城では",
  will: "この人が求めているもの",
});

const dossier = (id, joinStageSequence, options) => Object.freeze({
  id,
  joinStageSequence,
  age: options.age,
  origin: options.origin,
  sections: Object.freeze({
    figure: Object.freeze([...options.figure]),
    field: Object.freeze([...options.field]),
    home: Object.freeze([...options.home]),
    will: Object.freeze([...options.will]),
  }),
  bonds: Object.freeze((options.bonds ?? []).map((bond) => Object.freeze({ ...bond }))),
});

export const DOSSIERS = Object.freeze({
  // ---- Stage 0 から居る二人 ----
  warden: dossier("warden", 0, {
    age: "二十代半ば",
    origin: "この班を作った人",
    figure: [
      "背は高くない。肩と背中が厚い。左腕に当て革を重ねて巻いている。",
      "速いわけではなく、動かないほうを選んでいる。",
      "平時は短く、数字で喋る。——「補給は四つ。三つ使ったら戻る」",
    ],
    field: [
      "一人では持ち帰れない。一人では等級も上がらない。だから四人に声をかけた。",
      "灰の中でだけ針が動く、掌に収まる計器を首から下げている。",
      "潜行等級の証を兼ねているので、外しているところを誰も見たことがない。",
    ],
    home: [
      "帳簿をつけ、拾ってきた物の目録を作る。撤退の判断が早い現実主義者。",
      "ただし目録の最後のページにだけ、まだ行っていない場所の名前が書いてある。",
      "本人は隠せていると思っている。四人とも気づいている。",
    ],
    will: [
      "協会の地図は、灰の縁から数えて四つ目で終わっている。その先が見たい。",
      "奥へ入るには潜行等級が要り、等級には実績と金が要る。だから稼ぐ。",
      "稼ぎは手段で、目的は奥。その順序を、隊には言っていない。",
    ],
    bonds: [
      { with: "mender", lines: ["最初の二人。ナズナには体調を勝手に記録されている。"] },
      { with: "lancer", lines: ["誘った側と誘われた側。「保たないのは、後ろで受ける人がいなかったからだ」と言った。"] },
      { with: "guardian", lines: ["等級を持っていなかったスミの保証人になった。"] },
      { with: "tactician", lines: ["奥へ行きたいという欲に、最初に気づかれた相手。気づいたうえで等級を通されている。"] },
    ],
  }),
  mender: dossier("mender", 0, {
    age: "二十代後半",
    origin: "外で医者をしていた",
    figure: [
      "手際がいい。荷物が多い——薬包、計器、記録帳。片眼にレンズ付きの眼鏡。",
      "断定するので、冷たく聞こえる。——「その傷、いま塞ぐ意味はない」",
      "冷たいのではなく、正確なだけである。戻せるのは、いま受けたぶんだけだから。",
    ],
    field: [
      "外で医者をしていた。灰から帰った者を診続けて、外の医術では戻らない傷があると知った。",
      "診るために、自分で入ることにした。",
      "灰の傷を見るためのレンズは、灰から拾ったものである。",
    ],
    home: [
      "治療を断ることが多いので、冷たいと思われている。",
      "だが全員の体調を勝手に記録している。誰が何時間寝たか、何を食べたか。",
      "訊かれると「観察です」と言う。",
    ],
    will: [
      "灰の傷は、灰の中でしか分からない。",
      "だから外にいては、いつまでも分からない。",
    ],
    bonds: [
      { with: "warden", lines: ["最初の二人。「四つ目より奥」の話でシキの一文が長くなるのに気づいている。本人には言わない。"] },
      { with: "lancer", lines: ["言わないのと、気づかれないのは別だと言った相手。"] },
      { with: "guardian", lines: ["受けた回数を数えている。スミ本人よりも正確に。"] },
      { with: "tactician", lines: ["同じ夜に、別々の帳面を書く。レイは出来事を、ナズナは人を。"] },
    ],
  }),

  // ---- Stage 1 で加わる ----
  lancer: dossier("lancer", 1, {
    age: "二十歳前後",
    origin: "どの班からも断られていた",
    figure: [
      "細くて速い。傷が多い。手が荒れている。",
      "一人称は「俺」。短く、断定し、返事が早い。",
      "止まると考えてしまうので、止まらない。",
    ],
    field: [
      "速いが保たない。どの班からも「保たない」と断られていた。",
      "シキだけが「保たないのは、後ろで受ける人がいなかったからだ」と言った。",
      "灰から拾った刃を使う。外の鋼では出せない薄さで、よく欠ける。研ぎ直しても元には戻らない。",
    ],
    home: [
      "何でも速い。飯を食うのが異様に速く、詰所の書類を書くのも速く、そして間違える。",
      "一番先に寝て、一番先に起きる。朝の火を起こすのはいつも彼。",
      "誰もそれを頼んでいない。",
    ],
    will: [
      "速く終わらせたい。長く居たくない。",
      "灰の中で考える時間が、一番怖い。",
    ],
    bonds: [
      { with: "warden", lines: ["シキが受けるから自分が抜ける、と分かっている。口には出さない。"] },
      { with: "guardian", lines: ["庇われると怒る。速い人間と、避けない人間。"] },
    ],
  }),

  // ---- Stage 2 で加わる ----
  guardian: dossier("guardian", 2, {
    age: "十代半ば",
    origin: "詰所で器材を運んでいた",
    figure: [
      "隊で一番小さい。だが一番厚い盾板を担ぐ。協会の備品で、体格に合っていない。",
      "遅いのは重い物のせいではなく、単に急がないから。",
      "短く喋る。感情の起伏が声に出ない。——「そこ、危ない」",
    ],
    field: [
      "詰所で器材を運ぶ仕事をしていた。潜行等級を持っていなかった。",
      "シキが保証人になった。",
      "五人で唯一、灰から拾った物を何も持っていない。持ち物は全部、協会の備品である。",
    ],
    home: [
      "表情が薄く、痛がらない。",
      "だが拾ってきた物を棚に並べるのが好きで、並べ方に本人しか分からない規則がある。",
      "誰かが動かすと、黙って直す。棚は増えていく。",
    ],
    will: [
      "受けたい。",
      "受けた側にしか分からないことがあるから。",
    ],
    bonds: [
      { with: "warden", lines: ["入れてくれた人。"] },
      { with: "lancer", lines: ["庇うと怒られる。それでも庇う。"] },
    ],
  }),

  // ---- Stage 3 で加わる ----
  tactician: dossier("tactician", 3, {
    age: "三十歳前後",
    origin: "協会の記録係だった",
    figure: [
      "姿勢がいい。手が綺麗——現場の人間の手ではない。",
      "一人称は「私」。丁寧に、説明するように喋る。——「三、二、……いま」",
      "灰から拾った時計を持っている。外では狂う。",
    ],
    field: [
      "協会の記録係だった。何百という遠征記録を読み、誰がどこで何をして戻らなかったかを全部数えた。",
      "数えているうちに、机の上では分からないことがあると気づいた。",
      "等級の通し方を知っている。だからこの班に、一番実務的に効く。",
    ],
    home: [
      "全部数える。歩数も、残り補給も、誰が何回被弾したかも。",
      "なのに方向音痴で、帰り道で必ず一度曲がり損ねる。本人は認めない。",
      "記録は二冊つける。協会へ出す用と、自分用。自分用のほうが厚い。",
    ],
    will: [
      "読んだものを、自分の目で確かめたい。",
    ],
    bonds: [
      { with: "warden", lines: ["シキの欲に最初に気づいた。気づいたうえで、等級を通している。"] },
      { with: "mender", lines: ["同じ夜に、別々の帳面を書く。レイは出来事を、ナズナは人を。"] },
    ],
  }),
});

export const DOSSIER_IDS = Object.freeze(Object.keys(DOSSIERS));

export function dossierFor(characterId) {
  return DOSSIERS[characterId] ?? null;
}

export function dossierName(characterId) {
  return String(CHARACTER_NAMES[characterId] ?? characterId).split(" — ")[0];
}

// **どこまで開いているか。**0 は「まだ会っていない＝カードを出さない」。
//
//   1 … figure          加入した
//   2 … + field         加入した Stage を越えた
//   3 … + home          そのさらに次を越えた
//   4 … + will          5人が揃った
//
// 最後の Stage で加わる人物は、加入と同時に隊が揃うので一気に開く。
// **Stage 4 以降が実装されれば、そこは自然にばらける**（cap を外す必要はない）。
export function dossierRevealLevel(characterId, highestClearedStageSequence, options = {}) {
  const entry = DOSSIERS[characterId];
  if (!entry) return 0;
  if (options.met === false) return 0;
  const highest = Number.isFinite(highestClearedStageSequence) ? highestClearedStageSequence : -1;
  const finalStage = Number.isFinite(options.finalStageSequence) ? options.finalStageSequence : null;
  if (finalStage !== null && highest >= finalStage) return 4;
  const since = highest - entry.joinStageSequence;
  const opened = since < 0 ? 1 : since === 0 ? 2 : 3;
  // **will は隊が揃うまで開かない。**最初から居る二人は先に home まで開くが、
  // そこで止める（R11 §7.1「目録の最後のページで見せる」）。
  return finalStage === null ? Math.min(opened, DOSSIER_SECTIONS.length) : Math.min(opened, 3);
}

// その level で読める節の id。**並びは DOSSIER_SECTIONS のまま。**
export function revealedDossierSections(level) {
  return DOSSIER_SECTIONS.slice(0, Math.max(0, Math.min(DOSSIER_SECTIONS.length, level)));
}

// 読める関係。**相手が加入していて、遅いほうの加入 Stage を越えたとき**に開く。
export function revealedBonds(characterId, highestClearedStageSequence, metIds) {
  const entry = DOSSIERS[characterId];
  if (!entry) return [];
  const highest = Number.isFinite(highestClearedStageSequence) ? highestClearedStageSequence : -1;
  const met = metIds instanceof Set ? metIds : new Set(metIds ?? []);
  return entry.bonds.filter((bond) => {
    const other = DOSSIERS[bond.with];
    if (!other || !met.has(bond.with)) return false;
    return highest >= Math.max(entry.joinStageSequence, other.joinStageSequence);
  });
}
