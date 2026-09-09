// ecology/hp-gauge.mjs — HPゲージの表示契約。
//
// 戦闘エンジンが渡す HP 内訳を、画面の4区分と低HP警告へ変換する。
// ここは engine の状態を変更しない純粋な表示投影なので、予測・本番の
// replay snapshot が同じなら同じ区分と警告になる。

// 低HP警告はゲージ内の色の意味を奪わないよう、カードの枠で表す。
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

export function hpAlertLabelFor(alert) {
  return HP_ALERT_LABELS[alert] ?? HP_ALERT_LABELS.normal;
}

// 区分の境界は原則として直角にする。ただし、プレイヤーが読むべき
// 「今回の攻撃の回復可能な終端」だけは丸める。赤が無いときは、黒の
// 手前にある最後の非黒区分を丸め、全損時だけ黒を丸める。
export function hpGaugeCornerRoles(actor = {}) {
  const state = hpGaugeState(actor);
  const amounts = HP_GAUGE_SEGMENT_KEYS.map((key) => state[key]);
  const firstVisibleIndex = amounts.findIndex((amount) => amount > 0);
  const firstVisible = firstVisibleIndex >= 0
    ? HP_GAUGE_SEGMENT_KEYS[firstVisibleIndex]
    : null;

  let rightRoundIndex = -1;
  for (let index = 0; index < HP_GAUGE_SEGMENT_KEYS.length - 1; index += 1) {
    if (amounts[index] > 0) rightRoundIndex = index;
  }
  if (rightRoundIndex < 0) rightRoundIndex = firstVisibleIndex;

  return {
    leftRound: firstVisible,
    rightRound: rightRoundIndex >= 0 ? HP_GAUGE_SEGMENT_KEYS[rightRoundIndex] : null,
  };
}
