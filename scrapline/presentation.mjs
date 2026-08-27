/**
 * Pure presentation decisions shared by the browser and Node regressions.
 * Keeping these decisions out of DOM code makes experimental disclosure,
 * scale direction, causal selection, and full-run showcase selection testable.
 */

export const SURVEY_SCALES = Object.freeze({
  fun: Object.freeze({ low: "退屈だった", high: "面白かった" }),
  replay: Object.freeze({ low: "一度で十分", high: "もう一度試したい" }),
});

function replayVolleyKey(event) {
  return Number.isInteger(event?.wave) && Number.isInteger(event?.volley)
    ? `${event.wave}:${event.volley}`
    : null;
}

export function selectReplayEvents(events = [], maxFrames = 32) {
  if (events.length <= maxFrames) return events;
  const safeMax = Math.max(2, maxFrames);
  const selected = new Set();
  const add = (index) => {
    if (index >= 0 && index < events.length && selected.size < safeMax) selected.add(index);
  };

  add(0);
  add(events.length - 1);
  events.forEach((event, index) => {
    if (["wave_clear", "mutual_destruction", "car_stolen_confirmed"].includes(event.type)) add(index);
  });

  const bestFire = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.type === "fire")
    .sort((a, b) => {
      const score = ({ event }) => (event.spectacle?.level || 0) * 100
        + (event.spectacle?.projectileCount || event.projectiles?.length || 0) * 8
        + (event.spectacle?.returning || 0) * 12
        + (event.spectacle?.molten || 0) * 10;
      return score(b) - score(a) || b.index - a.index;
    })[0];
  const bestKey = replayVolleyKey(bestFire?.event);
  if (bestKey) {
    const chainTypes = new Set(["volley", "car", "loop", "fire", "enemy_approach", "return", "return_reprocess", "enemy_shell", "enemy_attack", "impact_splash", "impact_blocked"]);
    events.forEach((event, index) => {
      if (replayVolleyKey(event) === bestKey && chainTypes.has(event.type)) add(index);
    });
    events
      .map((event, index) => ({ event, index }))
      .filter(({ event }) => replayVolleyKey(event) === bestKey && event.type === "impact")
      .sort((a, b) => eventDamage(b.event) - eventDamage(a.event) || b.index - a.index)
      .slice(0, 3)
      .forEach(({ index }) => add(index));
  }

  const priority = {
    battle_start: 260,
    battle_end: 255,
    return_reprocess: 245,
    return: 235,
    impact_splash: 225,
    car_stolen: 220,
    enemy_attack: 215,
    enemy_shell: 205,
    impact_blocked: 200,
    impact: 190,
    fire: 180,
    enemy_approach: 170,
    loop: 165,
    car: 155,
    collector_gain: 145,
    enemy_recover: 140,
    enemy_repelled: 135,
    repair: 120,
    volley: 100,
  };
  events
    .map((event, index) => ({ event, index, score: priority[event.type] || 0 }))
    .filter(({ index }) => !selected.has(index))
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .forEach(({ index }) => add(index));

  return [...selected].sort((a, b) => a - b).map((index) => events[index]);
}

export function reportDisclosure(report, revealed = false) {
  if (!report || !revealed) {
    return {
      revealed: false,
      outcome: null,
      hullAfter: null,
      highlights: [],
      canContinue: false,
    };
  }
  return {
    revealed: true,
    outcome: report.outcome || (report.won ? "won" : "lost"),
    hullAfter: report.hullAfter,
    highlights: causalHighlights(report),
    canContinue: true,
  };
}

function eventDamage(event) {
  return Math.max(0, Number(event?.damage) || 0);
}

function eventProjectiles(event) {
  return event?.projectiles?.length || event?.afterProjectiles?.length || event?.spectacle?.projectileCount || 0;
}

function transformationScore(event) {
  if (!event) return -1;
  if (event.type === "return_reprocess") return 150 + eventProjectiles(event) * 5 + (event.spectacle?.level || 0) * 8;
  if (event.type === "impact_splash") return 125 + eventDamage(event) * 8;
  if (event.type === "collector_gain") return 105 + (Number(event.amount) || 0) * 5;
  if (event.type === "return") return 95 + eventProjectiles(event) * 3;
  if (event.type === "loop") return 85;
  if (event.type === "car" && event.before !== event.after) return 55 + eventProjectiles(event) * 2;
  return -1;
}

function consequenceScore(event, report) {
  if (!event) return -1;
  if (event.type === "car_stolen_confirmed") return 170;
  if (event.type === "enemy_attack") return 110 + eventDamage(event) * 12;
  if (event.type === "impact_splash") return 100 + eventDamage(event) * 10;
  if (event.type === "impact") return 80 + eventDamage(event) * 10;
  if (event.type === "impact_blocked") return report?.won ? 45 : 115;
  if (event.type === "enemy_recover") return 90;
  if (event.type === "enemy_repelled") return 75;
  return -1;
}

function bestEvent(events, score) {
  return events
    .map((event, index) => ({ event, index, score: score(event) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || b.index - a.index)[0]?.event || null;
}

function outcomeEvent(report, events) {
  const outcome = report?.outcome || (report?.won ? "won" : "lost");
  if (outcome === "mutual") {
    return {
      type: "mutual_destruction",
      target: report.challenge,
      damage: Math.max(0, Number(report.hullBefore) || 0),
      note: "敵を破壊した直後、列車の車体も0になった",
    };
  }
  if (outcome === "won") {
    const clear = [...events].reverse().find((event) => event.type === "wave_clear");
    return clear || { type: "battle_end", won: true, reason: "区画を突破" };
  }
  return bestEvent(events, (event) => {
    if (event.type === "car_stolen_confirmed") return 170;
    if (event.type === "enemy_attack") return 130 + eventDamage(event) * 12;
    if (event.type === "impact_blocked") return 120;
    if (event.type === "battle_end") return 80;
    return -1;
  }) || { type: "battle_end", won: false, reason: report?.reason || "列車が止まった" };
}

export function causalHighlights(report) {
  const events = report?.events || [];
  if (!events.length) return [];
  const selected = [];
  const add = (event) => {
    if (!event || selected.includes(event) || selected.length >= 3) return;
    selected.push(event);
  };

  // First explain the most distinctive mechanism, then its strongest
  // consequence, and finally the actual run outcome. On a loss, wave_clear is
  // never used as the outcome because an intermediate kill is not a victory.
  add(bestEvent(events, transformationScore));
  add(bestEvent(events, (event) => consequenceScore(event, report)));
  add(outcomeEvent(report, events));

  if (selected.length < 3) {
    events.slice().reverse().forEach((event) => {
      if (["wave_clear", "battle_end"].includes(event.type) && !report.won) return;
      if (["car", "loop", "impact", "impact_splash", "impact_blocked", "return", "return_reprocess", "collector_gain", "enemy_recover", "enemy_repelled", "car_stolen_confirmed", "enemy_attack"].includes(event.type)) add(event);
    });
  }
  return selected;
}

export function showcaseScore(report) {
  if (!report) return -1;
  const events = report.events || [];
  const fire = events.filter((event) => event.type === "fire").reduce((best, event) => {
    const score = (event.spectacle?.level || 0) * 30
      + (event.spectacle?.projectileCount || event.projectiles?.length || 0) * 6
      + (event.spectacle?.returning || 0) * 12
      + (event.spectacle?.molten || 0) * 10;
    return Math.max(best, score);
  }, 0);
  const consequences = events.reduce((total, event) => total
    + (["impact", "impact_splash"].includes(event.type) ? eventDamage(event) * 4 : 0)
    + (event.type === "return_reprocess" ? 35 + eventProjectiles(event) * 3 : 0)
    + (event.type === "wave_clear" ? 18 : 0), 0);
  return fire + consequences;
}

export function showcaseReport(report) {
  if (!report) return report;
  const events = report.events || [];
  const fires = events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => event.type === "fire");
  if (!fires.length) return report;
  const best = fires.sort((a, b) => {
    const aReport = { ...report, events: events.slice(Math.max(0, a.index - 8), a.index + 18) };
    const bReport = { ...report, events: events.slice(Math.max(0, b.index - 8), b.index + 18) };
    return showcaseScore(bReport) - showcaseScore(aReport) || b.index - a.index;
  })[0];
  let start = best.index;
  while (start > 0 && !["volley", "battle_start"].includes(events[start - 1].type)) start -= 1;
  let end = best.index + 1;
  while (end < events.length && !["volley", "battle_end"].includes(events[end].type) && end - start < 28) end += 1;
  return { ...report, events: events.slice(start, end) };
}

export function bestShowcaseReport(reports = []) {
  return reports
    .filter(Boolean)
    .map((report, index) => ({ report: showcaseReport(report), index }))
    .sort((a, b) => showcaseScore(b.report) - showcaseScore(a.report) || b.index - a.index)[0]?.report || null;
}
