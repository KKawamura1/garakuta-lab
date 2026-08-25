import { GAME_VERSION, PART_BY_ID, SLOT_NAMES, summary } from "./engine.mjs";

export const SCHEMA_VERSION = 4;

function now() {
  return new Date().toISOString();
}

function ensure(state) {
  state.telemetry ||= { runId: state.runId, startedAt: state.startedAt, events: [], sentAt: null, error: null };
  state.telemetry.events ||= [];
  return state.telemetry;
}

export function record(state, event, at = now()) {
  const trace = ensure(state);
  const events = trace.events;
  const seq = events.length ? events[events.length - 1].seq + 1 : 1;
  const entry = { seq, at, ...event };
  events.push(entry);
  return entry;
}

function partName(id) {
  return PART_BY_ID[id]?.name || id || null;
}

function build(state) {
  return state.parts.map((partId, slot) => ({ slot, slotName: SLOT_NAMES[["eye", "heart", "hand"][slot]], partId, name: partName(partId) }));
}

export function buildPayload(state, options = {}) {
  const trace = ensure(state);
  const result = summary(state);
  const events = trace.events || [];
  const moments = events.filter(event => event.type === "emotion_marked").map(event => ({
    seq: event.seq,
    at: event.at || null,
    elapsedMs: event.at && trace.startedAt ? Math.max(0, new Date(event.at).getTime() - new Date(trace.startedAt).getTime()) : 0,
    kind: event.kind,
    label: event.label || event.kind,
    phase: event.phase || "",
    note: event.note || ""
  }));
  return {
    runId: state.runId,
    telemetryRunId: trace.runId || state.runId,
    deviceId: options.deviceId || "night-eater-test-device",
    schemaVersion: SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    startedAt: state.startedAt || trace.startedAt || null,
    endedAt: state.endedAt || now(),
    outcome: { won: result.won, reached: result.reached, hp: result.light, reason: result.reason },
    build: build(state),
    stats: {
      seed: state.seed,
      nightCount: result.reached,
      light: result.light,
      bond: result.bond,
      insight: result.insight,
      scars: result.scars,
      behavior: result.behavior,
      skills: result.skills,
      parts: result.parts,
      bag: result.bag,
      legacyUsed: result.legacyUsed,
      actionCount: events.filter(event => event.type === "command_chosen").length,
      installCount: events.filter(event => event.type === "part_installed").length,
      offerCount: events.filter(event => event.type === "offer_seen").length
    },
    answers: state.survey || {},
    client: {
      language: typeof navigator !== "undefined" ? navigator.language : null,
      viewport: typeof innerWidth === "number" && typeof innerHeight === "number" ? innerWidth + "x" + innerHeight : null,
      standalone: typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches,
      seed: state.seed,
      ruleset: GAME_VERSION,
      head: "night-eater"
    },
    events,
    moments
  };
}

export async function send(state) {
  ensure(state);
  try {
    const sync = await import("../agent-view/sync.js");
    const response = await sync.sendPayload(buildPayload(state, { deviceId: sync.deviceIdForRun() }));
    state.telemetry.sentAt = response.ok ? now() : null;
    state.telemetry.error = response.ok ? null : (response.error || "送信できませんでした");
    return response;
  } catch (error) {
    state.telemetry.error = error?.message || "記録モジュールを読み込めませんでした";
    return { ok: false, error: state.telemetry.error };
  }
}
