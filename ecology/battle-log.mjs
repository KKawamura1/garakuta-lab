// ecology/battle-log.mjs — 戦闘盤面の中央に出す短い要約。
//
// engine の eventText は履歴と技術ログで因果を追うための詳細文であり、
// そのまま同じ拍へ並べると iPhone 幅では主な出来事が埋もれる。ここでは
// event 列から「主行動」と「最も重要な結果」を一つだけ選ぶ。詳細な event 列は
// replay-beats と履歴側に残るので、中央表示の短文化で診断情報を失わない。

import { eventSourceId } from "./replay-beats.mjs";

// 390px 前後の中央ログで、固定名を含む代表的な文が2行へ収まるための目安。
// これは表示を途中で切る上限ではなく、要約が長くなりすぎていないかを検査する契約。
export const CENTRAL_LOG_MAX_CHARS = 48;

const OUTCOME_PRIORITY = Object.freeze([
  "damage_absorbed",
  "damage_taken",
  "damage_blocked",
  "damage_skipped",
  "healing_applied",
  "barrier_gained",
  "barrier_damaged",
  "barrier_broken",
  "actor_defeated",
  "status_added",
  "block_gained",
  "equipment_worn",
  "equipment_broken",
  "equipment_repaired",
  "actor_moved",
]);

const ACTION_TYPES = new Set([
  "action_declared",
  "target_selected",
  "target_changed",
  "action_started",
]);

const REASON_LABELS = Object.freeze({
  no_target: "対象なし",
  cost: "資源不足",
  rule: "反応で取消",
  no_usable_tactic: "行動なし",
  target_defeated: "対象撃破",
  target_unavailable: "対象なし",
});

function valuesOf(event) {
  return event?.values || {};
}

function skillIdOf(event) {
  const values = valuesOf(event);
  return values.activeSkillId || values.skillId || event?.activeSkillId || event?.skillId || null;
}

function targetsOf(event) {
  return event?.targetActorIds || event?.targetIds || [];
}

function uniqueIds(events) {
  const ids = [];
  for (const event of events) {
    for (const id of targetsOf(event)) {
      if (id && !ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

function firstDefined(events, read) {
  for (const event of events) {
    const value = read(event);
    if (value) return value;
  }
  return null;
}

function actorName(options, id) {
  return id ? String(options.actorName?.(id) ?? id) : "";
}

function skillName(options, event) {
  const id = skillIdOf(event);
  if (!id) return "";
  return String(options.skillName?.(id) ?? id);
}

function formatTargets(ids, sourceId, options) {
  if (!ids.length) return "";
  if (sourceId && ids.length === 1 && ids[0] === sourceId) return "自分";
  if (options.targetName) return String(options.targetName(ids, sourceId));
  return ids.map((id) => actorName(options, id)).join("・");
}

function sourceFor(events) {
  return firstDefined(events, (event) => eventSourceId(event));
}

function skillEventFor(events) {
  return events.find((event) => skillIdOf(event)) || null;
}

function contextFor(events, options) {
  const sourceId = sourceFor(events);
  const skillEvent = skillEventFor(events);
  const targets = uniqueIds(events);
  return {
    sourceId,
    source: actorName(options, sourceId),
    skill: skillEvent ? skillName(options, skillEvent) : "",
    targets,
    target: formatTargets(targets, sourceId, options),
  };
}

function contextForEvent(event, context, options, targetOverride = null) {
  const sourceId = eventSourceId(event) || context.sourceId;
  const eventTargets = targetsOf(event);
  const ids = targetOverride?.length
    ? targetOverride
    : eventTargets.length ? [...new Set(eventTargets)] : context.targets;
  const resolvedSkill = skillName(options, event) || context.skill;
  return {
    sourceId,
    source: actorName(options, sourceId) || context.source,
    skill: resolvedSkill,
    targets: ids,
    target: formatTargets(ids, sourceId, options),
  };
}

function actionLabel(context) {
  let line = context.source || "行動";
  if (context.skill) line += "：" + context.skill;
  if (context.target) line += " → " + context.target;
  return line;
}

function actionPrefix(context) {
  let line = context.source || "行動";
  if (context.skill) line += "：" + context.skill;
  if (context.target) line += " → " + context.target;
  return line;
}

function amountOf(event, fallback = 0) {
  const values = valuesOf(event);
  return values.actual ?? values.amount ?? values.proposed ?? fallback;
}

function reasonOf(event) {
  const reason = valuesOf(event).reason;
  return reason ? "（" + (REASON_LABELS[reason] ?? reason) + "）" : "";
}

function statusName(options, event) {
  const id = valuesOf(event).statusId;
  return id ? String(options.statusName?.(id) ?? id) : "状態";
}

function causeName(options, event) {
  const cause = options.causeName?.(event);
  return cause ? String(cause) : "";
}

function shortEventText(event, context, options, targetOverride = null) {
  const current = contextForEvent(event, context, options, targetOverride);
  const prefix = actionPrefix(current);
  const amount = amountOf(event);
  const values = valuesOf(event);
  switch (event.type) {
    case "battle_started":
      return "戦闘開始";
    case "round_started":
      return "R" + (event.round ?? values.round ?? "-") + "開始";
    case "action_declared":
    case "target_selected":
    case "target_changed":
    case "action_started":
      return actionLabel(current);
    case "action_skipped":
    case "action_canceled":
      return prefix + " 不発" + reasonOf(event);
    case "preparation_started":
      return prefix + " 準備開始";
    case "preparation_advanced":
      return prefix + " 準備中";
    case "preparation_completed":
      return prefix + " 準備完了";
    case "preparation_interrupted":
      return prefix + " 準備中断";
    case "damage_taken":
      return prefix + " " + amount + "ダメージ";
    case "damage_absorbed": {
      const finalDamage = values.finalDamage ?? 0;
      return prefix + " 防壁" + amount + "吸収・" + finalDamage + "ダメージ";
    }
    case "damage_blocked":
      return prefix + " 受けで無効";
    case "damage_skipped":
      return prefix + " 不発" + reasonOf(event);
    case "healing_applied":
      return prefix + " " + (values.actual ?? amount) + "回復";
    case "barrier_gained":
      return prefix + " 防壁" + amount;
    case "barrier_damaged":
      return prefix + " 防壁" + amount + "吸収";
    case "barrier_broken":
      return prefix + " 防壁破壊";
    case "block_gained":
      return prefix + " 受け構え" + amount;
    case "status_added":
      return prefix + " " + statusName(options, event) + "付与";
    case "actor_defeated":
      return (current.target || current.source || "対象") + " 撃破";
    case "equipment_worn": {
      const cause = causeName(options, event);
      return (current.source || "誰か") + " 装備反応" + (cause ? "（" + cause + "）" : "");
    }
    case "equipment_broken":
      return (current.source || "誰か") + " 装備破損";
    case "equipment_repaired":
      return (current.source || "誰か") + " 装備修理";
    case "actor_moved":
      return (current.source || "誰か") + " 位置変更";
    case "battle_ended":
      return "戦闘終了・" + (values.result || "決着");
    default:
      return actionLabel(current);
  }
}

function outcomeEvent(events) {
  for (const type of OUTCOME_PRIORITY) {
    const event = events.find((entry) => entry.type === type);
    if (event) return event;
  }
  return null;
}

function visibleEvent(events) {
  return events.find((event) => !ACTION_TYPES.has(event.type))
    || events.find((event) => ACTION_TYPES.has(event.type))
    || events[0];
}

export function summarizeBattleBeat(beat, options = {}) {
  const events = beat?.events || [];
  if (!events.length) return "戦闘開始";

  const context = contextFor(events, options);
  if (beat.kind === "declare") {
    const action = events.find((event) => event.type === "action_declared")
      || events.find((event) => ACTION_TYPES.has(event.type))
      || events[0];
    return actionLabel(contextForEvent(action, context, options, context.targets));
  }

  const outcome = outcomeEvent(events);
  const outcomeTargets = outcome
    ? uniqueIds(events.filter((event) => event.type === outcome.type))
    : [];
  const targets = outcomeTargets.length > 1 ? outcomeTargets : null;
  return shortEventText(outcome || visibleEvent(events), context, options, targets) || "戦況が変化";
}
