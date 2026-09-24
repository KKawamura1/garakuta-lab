// ecology/attack-style.mjs — 攻撃の型（腕力＝斬撃／技術＝銃撃）を、イベント列から読む。
//
// 作者要望 2026-09-14「戦闘時の攻撃アニメーションを、腕力スキルと技術スキルで分けたい。
// 腕力は斬撃、技術は銃撃のイメージ」。
//
// **新しい event も新しい拍も増やさない。**演出の他の層（重さの三段・踏み込む向き・
// 浮く数字）と同じで、ここが読むのは engine が既に出しているイベント列と、content の
// 定義だけである。時計も乱数も入らないので、同じ seed・同じ入力からは同じ絵が同じ順で出る。
//
// 分け方は engine が既に持っている軸をそのまま絵にする（effects.mjs の afterRearFalloff）。
//
//   腕力（might）で伸びる攻撃 … 前へ出て当てる。後列から出すと 40% へ落ちる → 斬撃
//   技術（focus）で伸びる攻撃 … その場から届かせる。後列から出しても落ちない → 銃撃
//
// つまり「どこから出しても届くのか」という盤面の規則が、そのまま絵の違いになる。
// 型を持たないダメージ（裂傷・装備の破片のような定数・状態依存）は**攻撃ではない**ので、
// どちらの型も返さない。画面はそれを今までどおりの汎用の被弾として出す。

export const WEAPON_STYLE = "weapon";
export const TECHNIQUE_STYLE = "technique";

// content が effect へ直接書いている型。**書いてあればそれが正本。**
export function attackStyleOfTags(tags) {
  if (!Array.isArray(tags)) return null;
  if (tags.includes(TECHNIQUE_STYLE)) return TECHNIQUE_STYLE;
  if (tags.includes(WEAPON_STYLE)) return WEAPON_STYLE;
  return null;
}

// tag を書いていない古い定義のために、伸びる能力値から補う。
// 「同じ技能の中で might と focus を混ぜない」は content/base.mjs の規約なので、
// 技能ひとつにつき型はひとつに決まる。
export function attackStyleOfEffect(effect) {
  if (effect?.type !== "deal_damage") return null;
  const tagged = attackStyleOfTags(effect.tags);
  if (tagged) return tagged;
  const stat = effect.amount?.scalingStat;
  if (stat === "might") return WEAPON_STYLE;
  if (stat === "focus") return TECHNIQUE_STYLE;
  return null;
}

// 定義の中の deal_damage を、書かれている順に拾う。`effects` だけを辿ると
// **溜め技の `preparation.completionEffects` が丸ごと抜ける**（溜め突き・大溜めは
// 平常の effects が空で、着弾は完了効果の側にある）。入れ子の形に依存しないよう、
// content/weapon-*.mjs の定義を読むため、入れ子の効果を丸ごと歩く。
function collectDamageEffects(node, out = [], seen = new Set()) {
  if (!node || typeof node !== "object" || seen.has(node)) return out;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const entry of node) collectDamageEffects(entry, out, seen);
    return out;
  }
  if (node.type === "deal_damage") out.push(node);
  for (const value of Object.values(node)) collectDamageEffects(value, out, seen);
  return out;
}

function styleOfEffects(node) {
  for (const effect of collectDamageEffects(node)) {
    const style = attackStyleOfEffect(effect);
    if (style) return style;
  }
  return null;
}

function rulesOf(definition) {
  return [
    ...(definition?.rule ? [definition.rule] : []),
    ...(definition?.rules ?? []),
    ...(definition?.signatureRules ?? []),
    ...(definition?.intrinsicRules ?? []),
  ];
}

// 定義 ID と rule ID の両方を引ける表を一度だけ組む。イベントは技能なら `skillId`、
// 反応・装備・状態・敵の固有規則なら `ruleId` と `sourceDefinitionId` を持つので、
// どちらから引いても同じ答えになるようにしておく。
export function buildAttackStyleIndex(content) {
  const index = new Map();
  const add = (id, style) => {
    if (!id || !style || index.has(id)) return;
    index.set(id, style);
  };
  for (const definitions of Object.values(content ?? {})) {
    if (!definitions || typeof definitions !== "object") continue;
    for (const [id, definition] of Object.entries(definitions)) {
      if (!definition || typeof definition !== "object") continue;
      const rules = rulesOf(definition);
      add(id, styleOfEffects(definition) ?? rules.map(styleOfEffects).find(Boolean) ?? null);
      for (const rule of rules) add(rule?.id, styleOfEffects(rule));
    }
  }
  return index;
}

// 一件のイベントの型。**effect の tag が最優先**で、無ければ出どころの定義から引く。
export function attackStyleOfEvent(index, event) {
  if (!event) return null;
  const tagged = attackStyleOfTags(event.tags);
  if (tagged) return tagged;
  const lookup = index instanceof Map ? index : new Map();
  for (const id of [event.skillId, event.ruleId, event.sourceDefinitionId]) {
    const style = id ? lookup.get(id) : null;
    if (style) return style;
  }
  return null;
}

// 拍ひとつの型。着弾のイベントだけを見る（宣言や状態付与では絵を変えない）。
// 同じ拍に両方が混ざることは content の規約上ほぼ無いが、混ざったら**最初の着弾**を採る。
const IMPACT_TYPES = new Set(["damage_taken", "damage_absorbed", "damage_blocked"]);

export function beatAttackStyle(index, beat) {
  for (const event of beat?.events ?? []) {
    if (!IMPACT_TYPES.has(event?.type)) continue;
    const style = attackStyleOfEvent(index, event);
    if (style) return style;
  }
  return null;
}
