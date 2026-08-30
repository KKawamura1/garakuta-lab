// ecology/mine.mjs — Gate F.
//
// Deterministic chain mining: run a small pool of loadouts through a small pool
// of battles and report what causal shapes came out. This finds nothing about
// fun. A fingerprint says "this shape of chain occurred", and deciding which
// shapes are worth building content around is the design lead's call (§20).

import { BATTLE_SCHEMA_VERSION, MINING_VERSION } from "./schema.mjs";
import { simulateBattle } from "./engine.mjs";

// §16 F — the fingerprint drops instance ids and event ids and keeps the shape:
// event type, source definition, the relation to the target, the rule or skill
// definition, the tags, and how deep in the causal tree the event sits.
export function fingerprintEventChain(battleResult) {
  const actorsById = new Map(battleResult.actors.map((actor) => [actor.instanceId, actor]));
  const eventsById = new Map(battleResult.events.map((event) => [event.id, event]));

  const depthOf = (event) => {
    let depth = 0;
    let current = event;
    while (current && current.parentEventId !== undefined) {
      const parent = eventsById.get(current.parentEventId);
      if (!parent || parent.chainId !== event.chainId) break;
      depth += 1;
      current = parent;
    }
    return depth;
  };

  const relationOf = (event) => {
    const target = actorsById.get(event.targetActorIds[0]);
    if (!target) return "none";
    const source = actorsById.get(event.sourceActorId);
    if (!source) return "unsourced";
    if (source.instanceId === target.instanceId) return "self";
    return source.side === target.side ? "same_side" : "opposing_side";
  };

  const chains = new Map();
  for (const event of battleResult.events) {
    const step = [
      event.type,
      actorsById.get(event.sourceActorId)?.definitionId ?? event.sourceDefinitionId ?? "-",
      relationOf(event),
      event.ruleId ?? event.skillId ?? "-",
      event.tags.length > 0 ? event.tags.join("+") : "-",
      depthOf(event),
    ].join(":");
    if (!chains.has(event.chainId)) chains.set(event.chainId, []);
    chains.get(event.chainId).push(step);
  }
  return [...chains.values()].map((steps) => steps.join(">"));
}

// Builds are enumerated in the order the pool lists its ids, so the same pool
// always produces the same builds in the same order.
export function enumerateBuilds(miningInput) {
  const builds = [];
  for (const characterId of miningInput.characterIds) {
    for (const activeSkillId of miningInput.activeSkillIds) {
      for (const reactiveSkillId of miningInput.reactiveSkillIds) {
        for (const equipmentId of miningInput.equipmentIds) {
          builds.push({
            buildId: `${characterId}.${activeSkillId}.${reactiveSkillId}.${equipmentId}`,
            characterId,
            activeSkillId,
            reactiveSkillId,
            equipmentId,
          });
        }
      }
    }
  }
  const limit = miningInput.maxBuilds ?? builds.length;
  return builds.slice(0, limit);
}

function battleInputFor(build, template, index) {
  return {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: `${template.battleId}_${index}`,
    maxRounds: template.maxRounds,
    objective: template.objective,
    allies: [
      {
        instanceId: "mine_ally",
        characterId: build.characterId,
        position: template.allyPosition ?? "front_left",
        tactics: [{ activeSkillId: build.activeSkillId, useWhen: [] }],
        reactiveSkillIds: [build.reactiveSkillId],
        equipment: [
          { instanceId: "mine_equipment", equipmentId: build.equipmentId, durability: template.durability ?? 2 },
        ],
      },
    ],
    enemies: template.enemies,
  };
}

export function mineBuilds(miningInput, contentBundle, options = {}) {
  const builds = enumerateBuilds(miningInput);
  const buildResults = [];
  const errors = [];
  const uniqueChainFingerprints = [];
  const seen = new Set();
  let battlesEvaluated = 0;

  for (const build of builds) {
    const performance = {
      wins: 0,
      roundsUsed: 0,
      hpLost: 0,
      equipmentWear: 0,
      actionPointsUnused: 0,
      reactionPointsUnused: 0,
    };
    const eventHistogram = {};
    const chainFingerprints = [];

    miningInput.battles.forEach((template, index) => {
      const input = battleInputFor(build, template, index);
      let result;
      try {
        result = simulateBattle(input, contentBundle, options);
      } catch (error) {
        // §16 F — errors are reported, never swallowed.
        errors.push({
          buildId: build.buildId,
          battleId: input.battleId,
          name: error.name,
          message: error.message,
          diagnostics: error.diagnostics ?? null,
          validationErrors: error.errors ?? null,
        });
        return;
      }
      battlesEvaluated += 1;
      if (result.result === "win") performance.wins += 1;
      performance.roundsUsed += result.roundsUsed;
      performance.hpLost += result.metrics.allyHpLost;
      performance.equipmentWear += result.metrics.equipmentWear;
      performance.actionPointsUnused += result.metrics.actionPointsUnused;
      performance.reactionPointsUnused += result.metrics.reactionPointsUnused;
      for (const [type, count] of Object.entries(result.metrics.eventCounts)) {
        eventHistogram[type] = (eventHistogram[type] ?? 0) + count;
      }
      for (const fingerprint of fingerprintEventChain(result)) {
        chainFingerprints.push(fingerprint);
        if (!seen.has(fingerprint)) {
          seen.add(fingerprint);
          uniqueChainFingerprints.push(fingerprint);
        }
      }
    });

    buildResults.push({ buildId: build.buildId, performance, eventHistogram, chainFingerprints });
  }

  return {
    miningVersion: MINING_VERSION,
    buildsEvaluated: builds.length,
    battlesEvaluated,
    buildResults,
    uniqueChainFingerprints,
    errors,
  };
}

