// ecology/content/dossiers.mjs
//
// **名簿の表示・開示ロジック。設定本文は character-lore.mjs。**
//
// R11 §1 は愛着の源として「表情差分・仕草の豊かさ」と「設定の厚み（過去・好み・関係）」を
// 選び、**会話は増やさない**と決めた。だが実装されたのは前者だけで、R11 §2・§4・§5 に
// 書いた人物の中身は設計資料の中にしか無く、プレイヤーからは一行も読めなかった。
// 設定本文（名前、人物像、来歴、関係）は character-lore.mjs に集約し、
// ここはそれをどの順で開示するかだけを持つ。
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
// そのまま構造にしてある。**会話は will を一度しか言わない**（ゲンゾウがゴウに気づく
// Stage 3 の幕間）。残りはここで、しかも最後にだけ開く。
//
// 関係（bonds）は R11 §5。**相手が加入していて、遅いほうの加入 Stage を越えたとき**に開く。
// 誰と組んだかで読めるものが変わる、という形にしてある。
//
// ここを触ってよいのは 名簿 / 物語 担当だけ。設定本文は character-lore.mjs で編集する。

import { CHARACTER_LORE, CHARACTER_NAMES } from "./character-lore.mjs";

// 節の並び。**開く順そのもの**なので、ここを入れ替えると開示順が変わる。
export const DOSSIER_SECTIONS = Object.freeze(["figure", "field", "home", "will"]);

export const DOSSIER_SECTION_HEADINGS = Object.freeze({
  figure: "佇まい",
  field: "灰の中では",
  home: "根城では",
  will: "この人が求めているもの",
});

const dossier = (id, joinStageSequence) => {
  const lore = CHARACTER_LORE[id];
  if (!lore) throw new Error("dossiers: 未登録の人物 " + id);
  return Object.freeze({
    id,
    joinStageSequence,
    age: lore.age,
    origin: lore.origin,
    sections: Object.freeze({
      figure: lore.figure,
      field: lore.field,
      home: lore.home,
      will: lore.will,
    }),
    bonds: lore.bonds,
  });
};

export const DOSSIERS = Object.freeze({
  warden: dossier("warden", 0),
  mender: dossier("mender", 0),
  lancer: dossier("lancer", 1),
  guardian: dossier("guardian", 2),
  tactician: dossier("tactician", 3),
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
