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
    (payload.schemaVersion < 2 || payload.telemetryRunId === payload.runId) &&
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
  if (length > MAX_BODY_BYTES) return json({ ok: false, error: "invalid_body_size" }, 413);

  let payload;
  try {
    // sendBeacon may use a request body without a Content-Length header. Read
    // and bound the actual UTF-8 bytes so pagehide checkpoints remain valid
    // without weakening the payload-size limit.
    const body = await context.request.text();
    if (!body || new TextEncoder().encode(body).byteLength > MAX_BODY_BYTES) {
      return json({ ok: false, error: "invalid_body_size" }, 413);
    }
    payload = JSON.parse(body);
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
      saved_at=excluded.saved_at,
      ended_at=COALESCE(excluded.ended_at, runs.ended_at),
      schema_version=MAX(runs.schema_version, excluded.schema_version),
      game_version=excluded.game_version,
      device_id=excluded.device_id,
      won=CASE WHEN excluded.event_count >= runs.event_count THEN excluded.won ELSE runs.won END,
      reached=CASE WHEN excluded.event_count >= runs.event_count THEN excluded.reached ELSE runs.reached END,
      final_hp=CASE WHEN excluded.event_count >= runs.event_count THEN excluded.final_hp ELSE runs.final_hp END,
      replay_score=excluded.replay_score,
      event_count=MAX(runs.event_count, excluded.event_count),
      moment_count=MAX(runs.moment_count, excluded.moment_count),
      outcome_json=CASE WHEN excluded.event_count >= runs.event_count THEN excluded.outcome_json ELSE runs.outcome_json END,
      build_json=CASE WHEN excluded.event_count >= runs.event_count THEN excluded.build_json ELSE runs.build_json END,
      stats_json=CASE WHEN excluded.event_count >= runs.event_count THEN excluded.stats_json ELSE runs.stats_json END,
      answers_json=excluded.answers_json,
      client_json=CASE WHEN excluded.event_count >= runs.event_count THEN excluded.client_json ELSE runs.client_json END,
      events_json=CASE WHEN excluded.event_count >= runs.event_count THEN excluded.events_json ELSE runs.events_json END
  `).bind(
    payload.runId, payload.deviceId, payload.schemaVersion, payload.gameVersion,
    payload.startedAt || null, payload.endedAt || null, savedAt,
    payload.outcome?.won ? 1 : 0, payload.outcome?.reached || 0, payload.outcome?.hp || 0,
    Number(payload.answers?.replay || 0), payload.events.length, payload.moments.length,
    JSON.stringify(payload.outcome || {}), JSON.stringify(payload.build || []),
    JSON.stringify(payload.stats || {}), JSON.stringify(payload.answers || {}),
    JSON.stringify(payload.client || {}), JSON.stringify(payload.events)
  );

  let existing;
  try {
    existing = await context.env.PLAYTEST_DB.prepare(
      "SELECT event_count, moment_count FROM runs WHERE run_id = ?"
    ).bind(payload.runId).first();
  } catch (error) {
    console.error(JSON.stringify({ event: "playtest_preflight_failed", runId: payload.runId, message: String(error) }));
    return json({ ok: false, error: "save_failed" }, 500);
  }

  const replaceMoments = !existing || payload.moments.length >= existing.moment_count;
  const momentStatements = replaceMoments ? [
    context.env.PLAYTEST_DB.prepare("DELETE FROM moments WHERE run_id = ?").bind(payload.runId),
    ...payload.moments.map(moment => context.env.PLAYTEST_DB.prepare(`
      INSERT INTO moments (run_id, event_seq, happened_at, elapsed_ms, kind, label, phase, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      payload.runId, moment.seq || 0, moment.at || null, moment.elapsedMs || 0,
      String(moment.kind || "").slice(0, 40), String(moment.label || "").slice(0, 40),
      String(moment.phase || "").slice(0, 40), String(moment.note || "").slice(0, 160)
    ))
  ] : [];

  const statements = [upsert, ...momentStatements];

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
