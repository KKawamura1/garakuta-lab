import { buildSignature, GAME_VERSION, partName } from "./app-runtime.mjs";

export const SCHEMA_VERSION = 4;
const MARKER_LABELS = {
  spark: "ひらめいた",
  choice: "迷った",
  payoff: "きた！",
  friction: "つらい",
  unclear: "わからない",
  bored: "退屈",
  worry: "不安"
};

function now() {
  return new Date().toISOString();
}

function ensure(state) {
  state.telemetry ||= {
    runId: state.runId,
    startedAt: state.startedAt,
    events: [],
    sentAt: null,
    error: null
  };
  state.telemetry.events ||= [];
  return state.telemetry;
}

export function record(state, event, at = now()) {
  const trace = ensure(state);
  const events = trace.events;
  const seq = events.length ? events[events.length - 1].seq + 1 : 1;
  const entry = { seq: seq, at: at, ...event };
  events.push(entry);
  return entry;
}

function build(state) {
  return state.slots.map(function (partId, slot) {
    return {
      slot: slot,
      slotName: ["目", "胸", "手", "脚"][slot],
      partId: partId || null,
      name: partName(partId)
    };
  });
}

export function buildPayload(state) {
  const trace = ensure(state);
  const events = trace.events || [];
  const started = trace.startedAt ? new Date(trace.startedAt).getTime() : null;
  const moments = events.filter(function (event) {
    return event.type === "emotion_marked";
  }).map(function (event) {
    return {
      seq: event.seq,
      at: event.at || null,
      elapsedMs: event.at && started ? Math.max(0, new Date(event.at).getTime() - started) : 0,
      kind: event.kind,
      label: MARKER_LABELS[event.kind] || event.kind,
      phase: event.phase || "",
      note: event.note || ""
    };
  });

  return {
    runId: state.runId,
    telemetryRunId: state.runId,
    deviceId: deviceId(),
    schemaVersion: SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    startedAt: state.startedAt || trace.startedAt || null,
    endedAt: state.endedAt || now(),
    outcome: {
      won: Boolean(state.won),
      reached: state.history.length,
      hp: state.light,
      reason: state.endReason || null
    },
    build: build(state),
    stats: {
      seed: state.seed,
      light: state.light,
      maxLight: state.maxLight,
      stage: state.stage,
      routeHistory: state.history.map(function (item) {
        return {
          scene: item.scene,
          route: item.route,
          routeName: item.routeName,
          passed: item.passed,
          close: item.close,
          primary: item.primary,
          secondary: item.secondary,
          requirements: item.requirements,
          reward: item.reward
        };
      }),
      memories: state.memories.slice(),
      scars: state.scars,
      buildSignature: buildSignature(state.slots),
      actionCount: events.filter(function (event) {
        return event.type === "route_chosen" || event.type === "part_selected" || event.type === "part_installed" || event.type === "scene_started";
      }).length,
      routeCount: events.filter(function (event) {
        return event.type === "route_chosen";
      }).length,
      partChoiceCount: events.filter(function (event) {
        return event.type === "part_selected";
      }).length,
      installCount: events.filter(function (event) {
        return event.type === "part_installed";
      }).length,
      emotionCount: moments.length
    },
    answers: state.survey || {},
    client: {
      language: typeof navigator !== "undefined" ? navigator.language : null,
      viewport: typeof innerWidth === "number" && typeof innerHeight === "number" ? innerWidth + "x" + innerHeight : null,
      standalone: typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches,
      seed: state.seed,
      ruleset: GAME_VERSION,
      head: "kindling"
    },
    events: events,
    moments: moments
  };
}

function deviceId() {
  const key = "garakuta-lab-device-id";
  if (typeof localStorage === "undefined") return "kindling-test-device";
  let value = localStorage.getItem(key);
  if (!value) {
    value = "kindling-" + Math.random().toString(36).slice(2, 12);
    localStorage.setItem(key, value);
  }
  return value;
}

export async function send(state) {
  ensure(state);
  const payload = buildPayload(state);
  try {
    const sync = await import("../agent-view/sync.js");
    const result = await sync.sendPayload(payload);
    state.telemetry.sentAt = result.ok ? now() : null;
    state.telemetry.error = result.ok ? null : (result.error || "記録を保存できませんでした");
    return result;
  } catch (error) {
    state.telemetry.error = error && error.message ? error.message : "記録モジュールを読み込めませんでした";
    return { ok: false, error: state.telemetry.error };
  }
}
