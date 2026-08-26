import { getModule, VERSION, summary } from "./engine.mjs";

export const SCHEMA_VERSION = 4;
export const GAME_VERSION = VERSION;

const MARKER_LABELS = {
  spark: "ひらめいた",
  choice: "迷った",
  payoff: "きた！",
  friction: "つらい",
  unclear: "わからない",
  bored: "退屈",
  worry: "不安"
};

function nowIso() {
  return new Date().toISOString();
}

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ensureTelemetry(state, now = nowIso()) {
  state.telemetry ||= { runId: uuid(), startedAt: now, events: [], sentAt: null, error: null };
  state.telemetry.events ||= [];
  return state;
}

export function recordTelemetry(state, event, at = nowIso()) {
  ensureTelemetry(state, at);
  const events = state.telemetry.events;
  const seq = events.length ? events[events.length - 1].seq + 1 : 1;
  const entry = { seq, at, ...event };
  events.push(entry);
  return entry;
}

function clientFor(state) {
  const width = typeof innerWidth === "number" ? innerWidth : null;
  const height = typeof innerHeight === "number" ? innerHeight : null;
  return {
    language: typeof navigator !== "undefined" ? navigator.language : null,
    viewport: width && height ? `${width}x${height}` : null,
    standalone: typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches,
    seed: state.seed,
    ruleset: GAME_VERSION,
    head: "emberline"
  };
}

function buildList(slots = []) {
  return slots.map((moduleId, index) => ({
    slot: index,
    moduleId: moduleId || null,
    name: getModule(moduleId)?.name || null
  }));
}

export function buildPayload(state, options = {}) {
  ensureTelemetry(state);
  const events = state.telemetry.events || [];
  const moments = events
    .filter(event => event.type === "emotion_marked")
    .map(event => ({
      seq: event.seq,
      at: event.at || null,
      elapsedMs: event.at && state.telemetry.startedAt
        ? Math.max(0, new Date(event.at).getTime() - new Date(state.telemetry.startedAt).getTime())
        : 0,
      kind: event.kind,
      label: MARKER_LABELS[event.kind] || event.kind,
      phase: event.phase || "",
      note: event.note || ""
    }));
  const result = summary(state);
  return {
    runId: state.telemetry.runId,
    telemetryRunId: state.telemetry.runId,
    deviceId: options.deviceId || "emberline-test-device",
    schemaVersion: SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    startedAt: state.telemetry.startedAt || null,
    endedAt: state.endedAt || new Date().toISOString(),
    outcome: {
      won: result.won,
      reached: result.reached,
      hp: result.hull,
      reason: result.reason
    },
    build: buildList(result.slots),
    stats: {
      seed: state.seed,
      challenges: result.challenges,
      slots: result.slots,
      spark: result.spark,
      heat: result.heat,
      cleared: result.cleared,
      stageCount: result.reached,
      history: result.history.map(entry => ({
        stage: entry.stage,
        challengeId: entry.challengeId,
        chosenOffer: entry.chosenOffer,
        before: entry.before,
        after: entry.after,
        force: entry.force,
        guard: entry.guard,
        spark: entry.spark,
        heat: entry.heat,
        progress: entry.progress,
        need: entry.need,
        damage: entry.damage,
        cleared: entry.cleared,
        chainCount: entry.chainCount
      })),
      actionCount: events.filter(event => event.type === "module_chosen").length,
      reorderCount: events.filter(event => event.type === "slot_moved").length,
      skippedOfferCount: events.filter(event => event.type === "offer_skipped").length
    },
    answers: state.survey || {},
    client: clientFor(state),
    events,
    moments
  };
}

export async function sendEmberlineTelemetry(state) {
  ensureTelemetry(state);
  try {
    const { deviceIdForRun, sendPayload } = await import("../agent-view/sync.js");
    const result = await sendPayload(buildPayload(state, { deviceId: deviceIdForRun() }));
    if (result.ok) {
      state.telemetry.sentAt = nowIso();
      state.telemetry.error = null;
    } else {
      state.telemetry.error = result.error || "送信に失敗しました";
    }
    return result;
  } catch (error) {
    state.telemetry.error = error?.message || "送信モジュールを読み込めませんでした";
    return { ok: false, error: state.telemetry.error };
  }
}
