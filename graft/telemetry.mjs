import { ENEMIES, VERSION, summary } from "./engine.mjs";

export const GRAFT_SCHEMA_VERSION = 4;
export const GRAFT_GAME_VERSION = `${VERSION}-graft`;

const MARKER_LABELS = {
  spark: "閃き",
  hesitate: "迷い",
  surge: "勢い",
  worry: "不安",
  bored: "退屈"
};

function nowIso() {
  return new Date().toISOString();
}

function newRunId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ensureTelemetry(state, now = nowIso()) {
  state.telemetry ||= {
    runId: newRunId(),
    startedAt: now,
    events: [],
    sentAt: null,
    error: null
  };
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

function compactHistory(state) {
  return (state.history || []).map(battle => ({
    battle: battle.battle,
    enemy: battle.enemy,
    won: battle.won,
    reason: battle.reason || null,
    turns: battle.turns,
    hpBefore: battle.hpBefore,
    hpAfter: battle.hpAfter,
    actions: battle.actions
  }));
}

function buildFor(state) {
  return Object.entries(state.actions || {}).map(([actionId, action]) => ({
    actionId,
    mutation: action.mutation || null
  }));
}

function clientFor(options = {}) {
  const width = options.viewport?.width ?? (typeof innerWidth === "number" ? innerWidth : null);
  const height = options.viewport?.height ?? (typeof innerHeight === "number" ? innerHeight : null);
  const language = options.language ?? (typeof navigator !== "undefined" ? navigator.language : null);
  const standalone = options.standalone ?? (
    typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches
  );
  return {
    language,
    viewport: width && height ? `${width}x${height}` : null,
    standalone: Boolean(standalone),
    seed: stateSeed(options),
    ruleset: GRAFT_GAME_VERSION,
    head: "graft"
  };
}

function stateSeed(options) {
  return options.seed ?? null;
}

export function buildGraftPayload(state, options = {}) {
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
  const compact = compactHistory(state);

  return {
    runId: state.telemetry.runId,
    telemetryRunId: state.telemetry.runId,
    deviceId: options.deviceId || "graft-test-device",
    schemaVersion: GRAFT_SCHEMA_VERSION,
    gameVersion: GRAFT_GAME_VERSION,
    startedAt: state.telemetry.startedAt || null,
    endedAt: state.endedAt || null,
    outcome: {
      won: result.won,
      reached: state.history?.length || 0,
      hp: state.hp,
      reason: state.endReason || null
    },
    build: buildFor(state),
    stats: {
      seed: state.seed,
      battles: state.history?.length || 0,
      history: compact,
      actionCount: events.filter(event => event.type === "action_chosen").length,
      mutationCount: events.filter(event => event.type === "mutation_chosen").length,
      mutations: result.mutations
    },
    answers: state.survey || {},
    client: clientFor({ ...options, seed: state.seed }),
    events,
    moments
  };
}

export async function sendGraftTelemetry(state) {
  ensureTelemetry(state);
  const { deviceIdForRun, sendPayload } = await import("../agent-view/sync.js");
  const payload = buildGraftPayload(state, { deviceId: deviceIdForRun() });
  const result = await sendPayload(payload);
  if (result.ok) {
    state.telemetry.sentAt = nowIso();
    state.telemetry.error = null;
  } else {
    state.telemetry.error = result.error || "送信に失敗しました";
  }
  return result;
}

export function enemyCount() {
  return ENEMIES.length;
}
