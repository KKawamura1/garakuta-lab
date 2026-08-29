import { ALLY_UNITS, DOCTRINES, ENEMY_UNITS, MISSIONS } from "./content.mjs";

function instantiate(definition, index, side) {
  return {
    ...definition,
    instanceId: `${definition.id}-${index + 1}`,
    side,
    hp: definition.maxHp,
    shield: 0,
    charge: 0,
  };
}

function living(units) {
  return units.filter((unit) => unit.hp > 0);
}

function front(units) {
  return living(units)[0] ?? null;
}

function rear(units) {
  return living(units).at(-1) ?? null;
}

function findByBaseId(units, unitId) {
  return living(units).find((unit) => unit.id === unitId) ?? null;
}

function objectiveMet(state) {
  if (state.mission.objective.type === "eliminate_all") {
    return living(state.enemies).length === 0;
  }
  if (state.mission.objective.type === "destroy_unit") {
    return !findByBaseId(state.enemies, state.mission.objective.unitId);
  }
  throw new Error(`Unknown objective: ${state.mission.objective.type}`);
}

function selectTarget(state, side, targetMode) {
  const targets = side === "ally" ? state.enemies : state.allies;
  if (targetMode === "front") return front(targets);
  if (targetMode === "rear") return rear(targets);
  if (targetMode === "objective_or_rear") {
    const objective = state.mission.objective;
    if (objective.type === "destroy_unit") {
      return findByBaseId(targets, objective.unitId) ?? rear(targets);
    }
    return rear(targets);
  }
  throw new Error(`Unknown target mode: ${targetMode}`);
}

function log(state, event) {
  state.events.push({ beat: state.beat, ...event });
}

function applyAttack(state, {
  attacker,
  targetMode,
  power,
  allowOverflow,
  originPower = power,
  explicitTarget = null,
}) {
  const target = explicitTarget ?? selectTarget(state, attacker.side, targetMode);
  if (!target) {
    log(state, { type: "attack_no_target", attacker: attacker.instanceId, power });
    return;
  }

  const armorBlocked = Math.min(power, target.armor);
  const afterArmor = Math.max(0, power - target.armor);
  const shieldBlocked = Math.min(afterArmor, target.shield);
  target.shield -= shieldBlocked;
  const afterShield = afterArmor - shieldBlocked;
  const hpBefore = target.hp;
  const hpDamage = Math.min(hpBefore, afterShield);
  target.hp -= hpDamage;
  const destroyed = target.hp <= 0;
  const overflow = destroyed ? Math.max(0, afterShield - hpBefore) : 0;

  log(state, {
    type: "attack",
    attacker: attacker.instanceId,
    target: target.instanceId,
    power,
    armorBlocked,
    shieldBlocked,
    hpDamage,
    hpAfter: Math.max(0, target.hp),
    destroyed,
    overflow,
  });

  if (attacker.side === "ally") {
    state.lastAllyAttack = { originPower, attacker: attacker.instanceId };
  }

  if (allowOverflow && overflow > 0 && front(state.enemies)) {
    log(state, { type: "overflow", attacker: attacker.instanceId, power: overflow });
    applyAttack(state, {
      attacker,
      targetMode: "front",
      power: overflow,
      allowOverflow: true,
      originPower,
    });
  }
}

function actAlly(state, unit, index) {
  const action = unit.action;
  if (action.type === "attack") {
    applyAttack(state, {
      attacker: unit,
      targetMode: action.target,
      power: action.power,
      allowOverflow: Boolean(state.doctrine.overflow),
    });
    return;
  }

  if (action.type === "echo") {
    const copied = state.lastAllyAttack;
    if (!copied) {
      log(state, { type: "echo_no_source", actor: unit.instanceId });
      return;
    }
    const power = Math.floor(copied.originPower / action.divisor);
    const count = state.doctrine.echoCount ?? 1;
    for (let i = 0; i < count && front(state.enemies); i += 1) {
      log(state, {
        type: "echo",
        actor: unit.instanceId,
        copiedFrom: copied.attacker,
        copyIndex: i + 1,
        copyCount: count,
        power,
      });
      applyAttack(state, {
        attacker: unit,
        targetMode: "front",
        power,
        allowOverflow: Boolean(state.doctrine.overflow),
        originPower: power,
      });
    }
    return;
  }

  if (action.type === "charge_next") {
    const target = state.allies.slice(index + 1).find((candidate) => candidate.hp > 0) ?? null;
    if (!target) {
      log(state, { type: "charge_no_target", actor: unit.instanceId });
      return;
    }
    target.charge += action.amount;
    log(state, {
      type: "charge",
      actor: unit.instanceId,
      target: target.instanceId,
      amount: action.amount,
      chargeAfter: target.charge,
    });
    return;
  }

  if (action.type === "charged_attack") {
    const spent = unit.charge;
    unit.charge = 0;
    const power = action.basePower + spent * action.powerPerCharge;
    log(state, { type: "consume_charge", actor: unit.instanceId, amount: spent, power });
    applyAttack(state, {
      attacker: unit,
      targetMode: action.target,
      power,
      allowOverflow: Boolean(state.doctrine.overflow),
    });
    return;
  }

  if (action.type === "shield_front") {
    const target = front(state.allies);
    if (!target) return;
    target.shield += action.amount;
    log(state, {
      type: "shield",
      actor: unit.instanceId,
      target: target.instanceId,
      amount: action.amount,
      shieldAfter: target.shield,
    });
    return;
  }

  throw new Error(`Unknown ally action: ${action.type}`);
}

function actEnemy(state, unit) {
  const action = unit.action;
  if (action.type === "attack") {
    applyAttack(state, {
      attacker: unit,
      targetMode: action.target,
      power: action.power,
      allowOverflow: false,
    });
    return;
  }
  if (action.type === "scheduled_barrage") {
    if (state.beat !== action.beat) {
      log(state, { type: "wait", actor: unit.instanceId, firesAtBeat: action.beat });
      return;
    }
    log(state, { type: "barrage", actor: unit.instanceId, power: action.power });
    for (const target of [...living(state.allies)]) {
      applyAttack(state, {
        attacker: unit,
        targetMode: "front",
        power: action.power,
        allowOverflow: false,
        explicitTarget: target,
      });
    }
    return;
  }
  throw new Error(`Unknown enemy action: ${action.type}`);
}

export function simulateBattle({ missionId, allyUnitIds, doctrineId = "none" }) {
  const mission = MISSIONS[missionId];
  const doctrine = DOCTRINES[doctrineId];
  if (!mission) throw new Error(`Unknown mission: ${missionId}`);
  if (!doctrine) throw new Error(`Unknown doctrine: ${doctrineId}`);
  if (!Array.isArray(allyUnitIds) || allyUnitIds.length < 1 || allyUnitIds.length > 3) {
    throw new Error("allyUnitIds must contain 1 to 3 units");
  }

  const allies = allyUnitIds.map((id, index) => {
    const definition = ALLY_UNITS[id];
    if (!definition) throw new Error(`Unknown ally unit: ${id}`);
    return instantiate(definition, index, "ally");
  });
  const enemies = mission.enemies.map((id, index) => instantiate(ENEMY_UNITS[id], index, "enemy"));
  const state = {
    mission,
    doctrine,
    allies,
    enemies,
    beat: 0,
    events: [],
    lastAllyAttack: null,
  };

  log(state, {
    type: "battle_start",
    missionId,
    allyUnitIds: [...allyUnitIds],
    doctrineId,
  });

  for (let beat = 1; beat <= mission.maxBeats; beat += 1) {
    state.beat = beat;
    state.lastAllyAttack = null;
    log(state, { type: "beat_start" });

    if (doctrine.braceShield) {
      const target = front(allies);
      if (target) {
        target.shield += doctrine.braceShield;
        log(state, {
          type: "brace",
          target: target.instanceId,
          amount: doctrine.braceShield,
          shieldAfter: target.shield,
        });
      }
    }

    for (let i = 0; i < allies.length; i += 1) {
      if (allies[i].hp > 0) actAlly(state, allies[i], i);
    }

    if (objectiveMet(state)) {
      log(state, { type: "battle_end", result: "win", reason: "objective_met" });
      return snapshot(state, "win", "objective_met");
    }

    for (const enemy of enemies) {
      if (enemy.hp > 0) actEnemy(state, enemy);
    }

    if (living(allies).length === 0) {
      log(state, { type: "battle_end", result: "loss", reason: "all_allies_destroyed" });
      return snapshot(state, "loss", "all_allies_destroyed");
    }
  }

  log(state, { type: "battle_end", result: "loss", reason: "deadline" });
  return snapshot(state, "loss", "deadline");
}

function snapshot(state, result, reason) {
  return {
    missionId: state.mission.id,
    doctrineId: state.doctrine.id,
    result,
    reason,
    beatsUsed: state.beat,
    allies: state.allies.map(({ instanceId, id, hp, shield, charge }) => ({
      instanceId,
      id,
      hp: Math.max(0, hp),
      shield,
      charge,
    })),
    enemies: state.enemies.map(({ instanceId, id, hp, shield }) => ({
      instanceId,
      id,
      hp: Math.max(0, hp),
      shield,
    })),
    events: state.events,
  };
}

export function simulateFronts(fronts) {
  const squadIds = fronts.map((frontInput) => frontInput.squadId);
  if (new Set(squadIds).size !== squadIds.length) {
    throw new Error("A squad cannot be assigned to more than one front");
  }
  const results = fronts.map(({ squadId, ...battleInput }) => ({
    squadId,
    battle: simulateBattle(battleInput),
  }));
  return { allWin: results.every(({ battle }) => battle.result === "win"), results };
}
