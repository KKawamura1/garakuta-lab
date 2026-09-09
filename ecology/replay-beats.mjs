// ecology/replay-beats.mjs — リプレイの「拍」を組む。
//
// **拍はイベント1件ではなく、見せ場1つ。**
// R5エンジンは1つの行動から十数件のイベントを出す。行動権の支払い、
// 解決の締め、提案値の記録まで全部を等間隔で流すと、
// **何が起きたかの山（ダメージ・撃破）が事務処理に埋もれてテンポが死ぬ。**
//
// 分け方はユニコーンオーバーロードの戦闘に倣う。あちらはアクティブスキルが
// AP、パッシブスキルがPPを使い、パッシブは条件で自動的に割り込む。制作陣自身が
// 「パッシブスキルによる割り込みがあるのでテンポを上げきれない」と言っている
// ——つまり**割り込みを止めるか流すかが、テンポそのもの**である。
//
// ここでの規則：
//   主行動（ruleId 無し）        … 必ず止める。宣言と着弾で2拍。
//   サブ行動（ruleId 有り）
//     自分に向いたもの           … 止めない。攻撃と同時に出す（攻撃に合わせた自己回復など）
//     他人に向いたもの           … 止めて単独で見せる（誰が誰を庇ったのかが要るため）
//   非行動（状態付与・装備摩耗） … 止めない。並べて出す。
//   事務（行動権・解決の締め等） … 盤面に出さない。デバッグログにだけ残る。
//
// エンジンには依存しない。イベントの配列だけを見る純関数なので、
// 分析用の replay-beats smoke が本物の戦闘で性質を検査できる。

import { EVENT_TYPES } from "./schema.mjs";

// 履歴・結果画面が独自の手書き whitelist を持つと、engine に追加された
// 敵の action_declared や防壁の帰結だけが画面から消える。schema の実装語彙を
// 正本にして、既知の event は全て履歴／replay の入力へ渡す。
export const REPLAY_EVENT_TYPES = new Set(EVENT_TYPES);

export function filterReplayEvents(events) {
  return (events || []).filter((event) => REPLAY_EVENT_TYPES.has(event?.type));
}

// 盤面に出さないもの。ログには残る。
export const BOARD_SKIP = new Set([
  "resource_refreshed",
  "resource_spent",
  "resource_gained",
  "resource_unused",
  "action_cost_paid",
  "action_resolved",
  "round_ended",
  "barrier_expired",
  "status_removed",
  "excess_damage",
  "excess_healing",
  "recovery_window_closed",
  "pending_amount_modified",
  "damage_proposed",
  "healing_proposed",
  "barrier_proposed",
  // R6 §6.7 — block の提案と消費は盤面に出さない。**止まった事実（damage_blocked）
  // だけが見せ場**で、charge の増減は箱の数字で分かる。
  "block_proposed",
  "block_spent",
]);

// 拍ごとの長さ（標準速度、ミリ秒）。
export const BEAT_MS = {
  opening: 620,
  round: 560,
  declare: 320,
  impact: 300,
  sub: 400,
  prepare: 420,
  move: 440,
  defeat: 700,
  blocked: 520,
  skipped: 340,
  ending: 900,
  other: 240,
};
// 主行動の着弾に効果が複数乗るときの足し分と、その上限。
export const EFFECT_MS = 170;
export const IMPACT_CAP_MS = 820;

const IMPACT_EFFECTS = new Set([
  "damage_taken",
  "damage_absorbed",
  "barrier_damaged",
  "barrier_broken",
  "healing_applied",
  "barrier_gained",
  "damage_blocked",
  "block_gained",
]);
const QUIET_EFFECTS = new Set(["status_added", "equipment_worn", "equipment_repaired", "equipment_broken"]);

// 踏み込みを伴うのは、行動が実際に着弾した拍だけに限る。
// action_started 単独は、準備行動の開始や回復・補助行動でも発生する。
export const STRIKE_IMPACT_EVENT_TYPES = new Set([
  "damage_taken",
  "damage_absorbed",
  "damage_blocked",
]);

export function beatHasStrikeImpact(beat) {
  return beat?.kind === "impact"
    && beat.events?.some((event) => STRIKE_IMPACT_EVENT_TYPES.has(event?.type));
}

export function eventSourceId(event) {
  return event?.sourceActorId || event?.actorId || event?.ownerActorId || null;
}

function isSelfTargeted(event) {
  const targets = event.targetActorIds || [];
  const source = eventSourceId(event);
  return targets.length > 0 && targets.every((id) => id === source);
}

export function buildBeats(events) {
  const beats = [];
  let current = null;
  let awaitingPreparationImpact = false;

  const open = (kind, event, index, ms) => {
    current = { kind, ms, from: index, to: index, events: [event] };
    beats.push(current);
    return current;
  };

  // 止めない足し方。いま開いている拍が無ければ直前の拍へ乗せる
  // （＝直前の見せ場と同時に出る）。連鎖が変わっていれば別の拍にする。
  const attach = (event, index, extraMs = 0) => {
    const target = current ?? beats[beats.length - 1];
    if (!target || target.events[0].chainId !== event.chainId) {
      return open("sub", event, index, BEAT_MS.sub);
    }
    target.events.push(event);
    target.to = Math.max(target.to, index);
    target.ms = Math.min(IMPACT_CAP_MS, target.ms + extraMs);
    return target;
  };

  // 盤面に出さないイベントでも、状態とログは進める。
  const carry = (index) => {
    const target = current ?? beats[beats.length - 1];
    if (target) target.to = Math.max(target.to, index);
  };

  events.forEach((event, index) => {
    if (BOARD_SKIP.has(event.type)) {
      // preparation_completed と着弾の間にある提案・精算イベントを、
      // 準備完了拍へ戻さない。次の実体イベントで着弾拍を開く。
      if (!awaitingPreparationImpact) carry(index);
      return;
    }
    switch (event.type) {
      case "battle_started":
        open("opening", event, index, BEAT_MS.opening);
        current = null;
        awaitingPreparationImpact = false;
        break;
      case "round_started":
        // ラウンド頭の自己バフはこの拍に同時に乗せたいので、閉じない。
        open("round", event, index, BEAT_MS.round);
        awaitingPreparationImpact = false;
        break;
      case "actor_activated":
        // 宣言の拍に畳む。単独では出さない。
        carry(index);
        awaitingPreparationImpact = false;
        break;
      case "action_declared":
        open("declare", event, index, BEAT_MS.declare);
        awaitingPreparationImpact = false;
        break;
      case "target_selected":
      case "target_changed":
        if (current && current.kind === "declare" && current.events[0].chainId === event.chainId) {
          attach(event, index);
        } else {
          open("declare", event, index, BEAT_MS.declare);
        }
        awaitingPreparationImpact = false;
        break;
      case "action_started":
        open("impact", event, index, BEAT_MS.impact);
        awaitingPreparationImpact = false;
        break;
      case "action_skipped":
      case "action_canceled":
      case "damage_skipped":
        open("skipped", event, index, BEAT_MS.skipped);
        current = null;
        awaitingPreparationImpact = false;
        break;
      case "preparation_started":
      case "preparation_advanced":
      case "preparation_interrupted":
        open("prepare", event, index, BEAT_MS.prepare);
        current = null;
        awaitingPreparationImpact = false;
        break;
      case "preparation_completed":
        open("prepare", event, index, BEAT_MS.prepare);
        current = null;
        awaitingPreparationImpact = true;
        break;
      case "actor_moved":
        open("move", event, index, BEAT_MS.move);
        current = null;
        awaitingPreparationImpact = false;
        break;
      case "actor_defeated":
        open("defeat", event, index, BEAT_MS.defeat);
        current = null;
        awaitingPreparationImpact = false;
        break;
      case "battle_ended":
        open("ending", event, index, BEAT_MS.ending);
        current = null;
        awaitingPreparationImpact = false;
        break;
      default:
        if (awaitingPreparationImpact) {
          // 完了後の実体イベントは準備完了とは別の拍にする。ダメージ系は
          // 着弾として impact、それ以外の完了効果は通常の sub として扱う。
          if (IMPACT_EFFECTS.has(event.type)) {
            open("impact", event, index, BEAT_MS.impact);
            awaitingPreparationImpact = false;
          } else {
            open("sub", event, index, BEAT_MS.sub);
          }
          break;
        }
        if (IMPACT_EFFECTS.has(event.type)) {
          if (!event.ruleId) attach(event, index, EFFECT_MS);
          else if (isSelfTargeted(event)) attach(event, index, 0);
          else open("sub", event, index, BEAT_MS.sub);
        } else if (QUIET_EFFECTS.has(event.type)) {
          attach(event, index, 0);
        } else {
          attach(event, index, 0);
        }
    }
  });

  return beats;
}

export function beatDurationMs(beat, factor = 1) {
  return Math.max(60, Math.round((beat?.ms ?? BEAT_MS.other) * factor));
}
