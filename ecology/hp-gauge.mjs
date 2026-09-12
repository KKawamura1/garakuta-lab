// ecology/hp-gauge.mjs — HPゲージの表示契約。
//
// 戦闘エンジンが渡す HP 内訳を、画面の4区分・低HP警告・絶対尺度のゲージ本数へ
// 変換する。ここは engine の状態を変更しない純粋な表示投影なので、予測・本番の
// replay snapshot が同じなら同じ区分と色になる。

// 比較は整数 basis points にして、55% / 25% の境界を含めて決定的にする。
export const HP_WARNING_BPS = 5500;
export const HP_CRITICAL_BPS = 2500;

export const HP_ALERTS = Object.freeze({
  normal: "normal",
  warning: "warning",
  critical: "critical",
});

export const HP_ALERT_LABELS = Object.freeze({
  normal: "",
  warning: "HP注意",
  critical: "HP危険域",
});

export const HP_TONES = Object.freeze({
  green: "green",
  yellow: "yellow",
  red: "red",
});

export const HP_GAUGE_SEGMENT_KEYS = Object.freeze([
  "green",
  "recovered",
  "recoverable",
  "unrecoverable",
]);

function nonNegativeFinite(value) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

// `green` は現在HPのうち今回の攻撃でまだ回復していない部分、
// `recovered` は同じ攻撃で回復した部分、`recoverable` はまだ回復できる
// ダメージ、`unrecoverable` は確定したダメージを表す。
export function hpGaugeState(actor = {}) {
  const maxHp = nonNegativeFinite(actor.maxHp);
  const currentHp = Math.min(maxHp, nonNegativeFinite(actor.hp));
  const recovered = Math.min(currentHp, nonNegativeFinite(actor.recoveredDamage));
  const recoverable = actor.alive
    ? Math.min(maxHp - currentHp, nonNegativeFinite(actor.recoverableDamage))
    : 0;
  const unrecoverable = Math.max(0, maxHp - currentHp - recoverable);
  return {
    maxHp,
    currentHp,
    green: Math.max(0, currentHp - recovered),
    recovered,
    recoverable,
    unrecoverable,
  };
}

export function hpAlertFor(actor = {}) {
  const { maxHp, currentHp } = hpGaugeState(actor);
  if (actor.alive === false || maxHp <= 0) return HP_ALERTS.normal;
  const hpBps = Math.floor((currentHp * 10000) / maxHp);
  if (hpBps <= HP_CRITICAL_BPS) return HP_ALERTS.critical;
  if (hpBps <= HP_WARNING_BPS) return HP_ALERTS.warning;
  return HP_ALERTS.normal;
}

// 残りHPの「割合」の色。issue #226 ではこれがバーの主色だったが、絶対尺度へ移した
// 後はバーの色を本数（`hpBarToneFor`）が持つので、こちらは **HP数値の警告色**だけを
// 担う。`hp_percent` は skill の predicate が 25/30/50/60/70% で読む量なので、
// 絶対量とは別の軸として盤面に残す。
// `green` は通常、`yellow` は55%以下、`red` は25%以下を表す。
export function hpToneFor(actor = {}) {
  const alert = hpAlertFor(actor);
  if (alert === HP_ALERTS.critical) return HP_TONES.red;
  if (alert === HP_ALERTS.warning) return HP_TONES.yellow;
  return HP_TONES.green;
}

export function hpAlertLabelFor(alert) {
  return HP_ALERT_LABELS[alert] ?? HP_ALERT_LABELS.normal;
}

// 区分の境界は原則として直角にする。ただし、プレイヤーが読むべき
// 「今回の攻撃の回復可能な終端」だけは丸める。赤が無いときは、黒の
// 手前にある最後の非黒区分を丸め、全損時だけ黒を丸める。
export function hpGaugeCornerRoles(actor = {}) {
  return hpBarCornerRoles(hpGaugeState(actor));
}

// ============================================================ 絶対尺度のHPゲージ（作者要望 2026-09-12）
//
// **割合ゲージは「同じ一撃」を人物ごとに違う長さで見せる。**最大HP幅で描くと、
// ゴウ(300)の40ダメージは13%、ツグミ(110)の40ダメージは36%になる。同じ攻撃なのに
// 前者は小さく見え、後者は致命に見えた。盤面で読みたいのは「あと何発耐えるか」なので、
// **1pxが表すHPを全員で同じにする**（＝絶対尺度）。
//
// ただしHPはいくらでも大きくなる。そこで `HP_BAR_UNIT` ごとにゲージを一本へ区切り、
// **いま居る一本だけを実寸で描き、残りの本数は小さな四角で上に並べる。**
// 一本ぶんの幅は全ユニットで同じなので、同じダメージは誰の盤面でも同じ幅だけ削れる。
//
//   本の色 … 0〜100 赤 / 100〜200 黄 / 200〜300 緑 / 300〜400 青 / 400〜 紫（以降は色を変えず本数だけ増える）
//
// 先例: バー自体の色が残量で変わるのは『レディストーカー 過去からの挑戦』、
// 本数を四角で数えるのは『ミスティッククエスト』。

export const HP_BAR_UNIT = 100;

// 5段目以降は紫のまま。**色を増やし続けると「色＝量」が読めなくなる**ので、
// 400以上は「紫＋四角の数」で量を出す。
export const HP_BAR_TIER_TONES = Object.freeze([
  "red",
  "yellow",
  "green",
  "blue",
  "violet",
]);

// 四角がこれを超えたら `◼×N` へ畳む。iPhoneの1セル幅に並べられる上限。
export const HP_BAR_MARKER_LIMIT = 6;

export const HP_BAR_MARKERS = Object.freeze({
  // 満タンで控えている本。削れると一つずつ消える
  stock: "stock",
  // すでに空だが、この攻撃の回復窓がまだ届く本
  recoverable: "recoverable",
  // 回復窓が閉じた本
  lost: "lost",
});

export function hpBarToneFor(tier) {
  const index = Number.isFinite(tier) ? Math.max(0, Math.floor(tier)) : 0;
  return HP_BAR_TIER_TONES[Math.min(index, HP_BAR_TIER_TONES.length - 1)];
}

// 最大HPを `HP_BAR_UNIT` ごとの本へ割る。最上位の本だけ端数の容量になる。
export function hpBarCount(maxHp) {
  const ceiling = nonNegativeFinite(maxHp);
  return Math.max(1, Math.ceil(ceiling / HP_BAR_UNIT));
}

// いま描く一本と、その上下に並ぶ四角を決める純粋な投影。
// 量はすべて「HP」で返し、画面側が `HP_BAR_UNIT` で割って幅にする。
export function hpGaugeBar(actor = {}) {
  const state = hpGaugeState(actor);
  const { maxHp, currentHp } = state;
  const tierCount = hpBarCount(maxHp);
  // 100ちょうどは「赤の満タン」にする。ここを黄の0本目にすると、満タンの人物が
  // 空のゲージで立つことになる。
  const activeTier = currentHp <= 0
    ? 0
    : Math.min(tierCount - 1, Math.ceil(currentHp / HP_BAR_UNIT) - 1);
  const floor = activeTier * HP_BAR_UNIT;
  const capacity = Math.max(0, Math.min(maxHp, floor + HP_BAR_UNIT) - floor);
  const within = Math.max(0, Math.min(capacity, currentHp - floor));

  // 4区分は「この一本の中の量」へ切り直す。回復窓が本をまたぐ分は四角側が受け持つ。
  const recovered = Math.min(within, state.recovered);
  const damage = Math.max(0, capacity - within);
  const recoverable = Math.min(damage, state.recoverable);
  const unrecoverable = Math.max(0, damage - recoverable);

  const markers = [];
  for (let tier = 0; tier < tierCount; tier += 1) {
    if (tier === activeTier) continue;
    let markerState = HP_BAR_MARKERS.stock;
    if (tier > activeTier) {
      markerState = currentHp + state.recoverable > tier * HP_BAR_UNIT
        ? HP_BAR_MARKERS.recoverable
        : HP_BAR_MARKERS.lost;
    }
    markers.push({ tier, state: markerState, tone: hpBarToneFor(tier) });
  }

  return {
    unit: HP_BAR_UNIT,
    maxHp,
    currentHp,
    tierCount,
    activeTier,
    tone: hpBarToneFor(activeTier),
    capacity,
    green: Math.max(0, within - recovered),
    recovered,
    recoverable,
    unrecoverable,
    markers,
    // 数える四角が多すぎる盤面では実物を並べず `◼×N` へ畳む。
    compact: markers.length > HP_BAR_MARKER_LIMIT,
    stockCount: markers.filter((marker) => marker.state === HP_BAR_MARKERS.stock).length,
    lostCount: markers.filter((marker) => marker.state !== HP_BAR_MARKERS.stock).length,
  };
}

// 角丸の意味は割合ゲージのときと同じで、対象が「一本の中の4区分」へ変わる。
export function hpBarCornerRoles(bar) {
  const amounts = HP_GAUGE_SEGMENT_KEYS.map((key) => bar[key]);
  const firstVisibleIndex = amounts.findIndex((amount) => amount > 0);
  let rightRoundIndex = -1;
  for (let index = 0; index < HP_GAUGE_SEGMENT_KEYS.length - 1; index += 1) {
    if (amounts[index] > 0) rightRoundIndex = index;
  }
  if (rightRoundIndex < 0) rightRoundIndex = firstVisibleIndex;
  return {
    leftRound: firstVisibleIndex >= 0 ? HP_GAUGE_SEGMENT_KEYS[firstVisibleIndex] : null,
    rightRound: rightRoundIndex >= 0 ? HP_GAUGE_SEGMENT_KEYS[rightRoundIndex] : null,
  };
}
