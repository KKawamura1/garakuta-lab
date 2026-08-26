import { BUILD_STAMP, VERSION, MAX_STAGES, carById } from "./engine.mjs";

export const SCRAPLINE_SCHEMA_VERSION = 4;
export const SCRAPLINE_GAME_VERSION = VERSION;

const MARKER_LABELS = {
  spark: "閃き",
  choice: "選択の手応え",
  payoff: "因果が返った",
  friction: "操作の摩擦",
  unclear: "何が起きたか不明",
  bored: "退屈",
};

function nowIso() {
  return new Date().toISOString();
}

function newRunId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ensureTelemetry(state, now = nowIso()) {
  state.telemetry ||= { runId: newRunId(), startedAt: now, events: [], sentAt: null, error: null, pending: false, attempts: 0, lastAttemptAt: null };
  state.telemetry.events ||= [];
  if (typeof state.telemetry.pending !== "boolean") state.telemetry.pending = false;
  if (!Number.isInteger(state.telemetry.attempts)) state.telemetry.attempts = 0;
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
    ruleset: SCRAPLINE_GAME_VERSION,
    head: "scrapline",
    build: BUILD_STAMP,
  };
}

function buildNameList(state) {
  return state.activeCars.map((id, slot) => {
    const car = carById(id);
    return { slot, carId: id, name: car.name, icon: car.icon };
  });
}

export function buildScraplinePayload(state, options = {}) {
  ensureTelemetry(state);
  const events = state.telemetry.events || [];
  const moments = (state.markers || []).slice(-200).map((marker, index) => ({
    seq: index + 1,
    at: marker.at || null,
    elapsedMs: marker.at && state.telemetry.startedAt
      ? Math.max(0, new Date(marker.at).getTime() - new Date(state.telemetry.startedAt).getTime())
      : 0,
    kind: marker.marker,
    label: MARKER_LABELS[marker.marker] || marker.marker,
    phase: marker.stage == null ? "" : `stage-${marker.stage}`,
    note: marker.note || "",
  }));
  return {
    runId: state.telemetry.runId,
    telemetryRunId: state.telemetry.runId,
    deviceId: options.deviceId || "scrapline-test-device",
    schemaVersion: SCRAPLINE_SCHEMA_VERSION,
    gameVersion: SCRAPLINE_GAME_VERSION,
    startedAt: state.telemetry.startedAt || state.startedAt || null,
    endedAt: state.endedAt || null,
    outcome: {
      won: Boolean(state.won),
      reached: state.stage,
      hp: state.hull,
      reason: state.reason,
    },
    build: buildNameList(state),
    stats: {
      seed: state.seed,
      starterPattern: state.starterPattern || state.activeCars[0] || null,
      stage: state.stage,
      maxStages: MAX_STAGES,
      hull: state.hull,
      armor: state.armor,
      storedMass: state.storedMass,
      activeCars: [...state.activeCars],
      carHistory: state.carHistory || [],
      battleHistory: state.battleHistory || [],
      moveCount: state.moveCount || 0,
      rebuildCount: state.rebuildCount || 0,
      previewCount: state.previewCount || 0,
      swapCount: state.swapCount || 0,
      telemetryAttempts: state.telemetry.attempts || 0,
    },
    answers: state.survey || {},
    client: clientFor(state),
    events: events.slice(-2000),
    moments,
  };
}

export async function sendScraplineTelemetry(state) {
  ensureTelemetry(state);
  state.telemetry.pending = true;
  state.telemetry.attempts += 1;
  state.telemetry.lastAttemptAt = nowIso();
  try {
    const { deviceIdForRun, sendPayload } = await import("../agent-view/sync.js");
    const result = await sendPayload(buildScraplinePayload(state, { deviceId: deviceIdForRun() }));
    if (result.ok) {
      state.telemetry.sentAt = nowIso();
      state.telemetry.error = null;
      state.telemetry.pending = false;
    } else {
      state.telemetry.error = result.error || "送信に失敗しました";
    }
    return result;
  } catch (error) {
    state.telemetry.error = error?.message || "送信モジュールを読み込めませんでした";
    return { ok: false, error: state.telemetry.error };
  }
}
