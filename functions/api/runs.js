const MAX_BODY_BYTES = 750_000;
const ALLOWED_HOSTS = new Set(["garakuta-lab.pages.dev"]);

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function validOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && (ALLOWED_HOSTS.has(url.hostname) || url.hostname.endsWith(".garakuta-lab.pages.dev"));
  } catch (_) {
    return false;
  }
}

function validPayload(payload) {
  return payload &&
    typeof payload.runId === "string" && payload.runId.length >= 8 && payload.runId.length <= 80 &&
    typeof payload.deviceId === "string" && payload.deviceId.length >= 8 && payload.deviceId.length <= 80 &&
    Number.isInteger(payload.schemaVersion) &&
    typeof payload.gameVersion === "string" && payload.gameVersion.length <= 40 &&
    Array.isArray(payload.events) && payload.events.length <= 2000 &&
    Array.isArray(payload.moments) && payload.moments.length <= 200;
}

export async function onRequestPost(context) {
  if (!validOrigin(context.request)) return json({ ok: false, error: "origin_not_allowed" }, 403);
  if (!context.env.PLAYTEST_DB) return json({ ok: false, error: "database_not_configured" }, 503);

  const contentType = context.request.headers.get("Content-Type") || "";
  const length = Number(context.request.headers.get("Content-Length") || 0);
  if (!contentType.startsWith("application/json")) return json({ ok: false, error: "json_required" }, 415);
  if (!length || length > MAX_BODY_BYTES) return json({ ok: false, error: "invalid_body_size" }, 413);

  let payload;
  try {
    payload = await context.request.json();
  } catch (_) {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!validPayload(payload)) return json({ ok: false, error: "invalid_payload" }, 400);

  const savedAt = new Date().toISOString();
  const upsert = context.env.PLAYTEST_DB.prepare(`
    INSERT INTO runs (
      run_id, device_id, schema_version, game_version, started_at, ended_at, saved_at,
      won, reached, final_hp, replay_score, event_count, moment_count,
      outcome_json, build_json, stats_json, answers_json, client_json, events_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(run_id) DO UPDATE SET
      saved_at=excluded.saved_at, ended_at=excluded.ended_at, won=excluded.won,
      reached=excluded.reached, final_hp=excluded.final_hp, replay_score=excluded.replay_score,
      event_count=excluded.event_count, moment_count=excluded.moment_count,
      outcome_json=excluded.outcome_json, build_json=excluded.build_json,
      stats_json=excluded.stats_json, answers_json=excluded.answers_json,
      client_json=excluded.client_json, events_json=excluded.events_json
  `).bind(
    payload.runId, payload.deviceId, payload.schemaVersion, payload.gameVersion,
    payload.startedAt || null, payload.endedAt || null, savedAt,
    payload.outcome?.won ? 1 : 0, payload.outcome?.reached || 0, payload.outcome?.hp || 0,
    Number(payload.answers?.replay || 0), payload.events.length, payload.moments.length,
    JSON.stringify(payload.outcome || {}), JSON.stringify(payload.build || []),
    JSON.stringify(payload.stats || {}), JSON.stringify(payload.answers || {}),
    JSON.stringify(payload.client || {}), JSON.stringify(payload.events)
  );

  const statements = [
    upsert,
    context.env.PLAYTEST_DB.prepare("DELETE FROM moments WHERE run_id = ?").bind(payload.runId),
    ...payload.moments.map(moment => context.env.PLAYTEST_DB.prepare(`
      INSERT INTO moments (run_id, event_seq, happened_at, elapsed_ms, kind, label, phase, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      payload.runId, moment.seq || 0, moment.at || null, moment.elapsedMs || 0,
      String(moment.kind || "").slice(0, 40), String(moment.label || "").slice(0, 40),
      String(moment.phase || "").slice(0, 40), String(moment.note || "").slice(0, 160)
    ))
  ];

  try {
    await context.env.PLAYTEST_DB.batch(statements);
    console.log(JSON.stringify({ event: "playtest_saved", runId: payload.runId, events: payload.events.length, moments: payload.moments.length }));
    return json({ ok: true, runId: payload.runId, savedAt });
  } catch (error) {
    console.error(JSON.stringify({ event: "playtest_save_failed", runId: payload.runId, message: String(error) }));
    return json({ ok: false, error: "save_failed" }, 500);
  }
}

export function onRequest() {
  return json({ ok: false, error: "method_not_allowed" }, 405);
}
