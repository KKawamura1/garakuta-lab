// MUTATE 0.1「変異機関」
// RELAY 0.1 の周期・位相・継電を維持し、ラン途中で既存部品の意味だけを変える。
// チップの判定は seed と部品IDから決定的に行うため、予告と実戦が一致する。

import { RELAY, firesOn } from "./relay.mjs";

export const MUTATION_CHIPS = {
  overclock: {
    name: "過速歯車",
    short: "周期−1・出力70%",
    description: "作動周期を1短くする（最短1）が、ダメージ・遮蔽・回復は70%。",
  },
  pressure: {
    name: "蓄圧筒",
    short: "周期＋1・出力180%",
    description: "作動周期を1長くするが、ダメージ・遮蔽・回復は180%。",
  },
  follow: {
    name: "追従軸",
    short: "左隣に50%で追加作動",
    description: "左隣の部品が作動したとき、50%で追加作動する。1巡1回まで。",
  },
};

const CHIP_ORDER = Object.keys(MUTATION_CHIPS);
const PARTS = RELAY.PARTS;
const ENEMIES = RELAY.ENEMIES.slice(0, 4);
const LINES = RELAY.LINES;

export function effectivePeriod(part, chip) {
  if (chip === "overclock") return Math.max(1, (part.period || 1) - 1);
  if (chip === "pressure") return (part.period || 1) + 1;
  return part.period || 1;
}

function outputScale(chip) {
  if (chip === "overclock") return 0.7;
  if (chip === "pressure") return 1.8;
  return 1;
}

function scaleDelta(delta, scale) {
  if (scale === 1) return delta;
  return {
    ...delta,
    damage: delta.damage === undefined ? delta.damage : delta.damage * scale,
    hits: delta.hits ? delta.hits.map(value => value * scale) : delta.hits,
    shield: delta.shield === undefined ? delta.shield : delta.shield * scale,
    heal: delta.heal === undefined ? delta.heal : delta.heal * scale,
    boost: delta.boost === undefined ? delta.boost : delta.boost * scale,
  };
}

function roll50(instanceId, cycle, slotIndex) {
  let h = 2166136261;
  const key = `${instanceId}:${cycle}:${slotIndex}`;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2 === 0;
}

function emptyContribution(instance, parts = PARTS) {
  return {
    id: instance.id, type: instance.type, name: parts[instance.type].name,
    activations: 0, idles: 0, relays: 0, damage: 0, shield: 0, healing: 0
  };
}

export function simulateBattle({ slots, hp, maxHp, enemy, rng, parts = PARTS }) {
  const battle = { hp, enemyHp: enemy.hp, cycle: 0, uses: {}, rng };
  const contributions = new Map();
  const log = [];
  const total = instance => {
    if (!contributions.has(instance.id)) contributions.set(instance.id, emptyContribution(instance, parts));
    return contributions.get(instance.id);
  };
  const applyHit = raw => {
    let value = Math.min(raw, enemy.cap ?? 99);
    if ((enemy.floor || 0) > 0 && raw < enemy.floor) value = 1;
    value = Math.max(1, value);
    battle.enemyHp -= value;
    return value;
  };

  while (battle.hp > 0 && battle.enemyHp > 0 && battle.cycle < RELAY.MAX_CYCLES) {
    battle.cycle += 1;
    let shield = 0;
    const shieldBy = new Map();
    let previousLine = null;
    let chain = 0;
    const active = [];

    for (let i = 0; i < slots.length; i += 1) {
      const instance = slots[i];
      if (!instance) continue;
      const base = parts[instance.type];
      if (!base) continue;
      const chip = instance.chip?.type;
      const period = effectivePeriod(base, chip);
      const follows = chip === "follow" && i > 0 && active[i - 1] && roll50(instance.id, battle.cycle, i);
      const fires = firesOn(battle.cycle, i, period) || follows;
      if (fires) active[i] = true;
      const record = total(instance);
      if (!fires) {
        record.idles += 1;
        continue;
      }
      record.activations += 1;
      const relayed = previousLine === base.line;
      chain = relayed ? chain + 1 : 1;
      const gain = chain;
      if (relayed) record.relays += 1;
      previousLine = base.line;

      const delta = scaleDelta(base.run({
        ...battle, instanceId: instance.id, uses: battle.uses, rng
      }), outputScale(chip));
      let dealt = 0;
      if (delta.damage) dealt += applyHit(delta.damage * gain);
      if (delta.hits) delta.hits.forEach(h => {
        if (battle.enemyHp > 0) dealt += applyHit(h * gain);
      });
      const gained = (delta.shield || 0) * gain;
      if (gained) {
        shield += gained;
        shieldBy.set(instance.id, (shieldBy.get(instance.id) || 0) + gained);
      }
      let healed = 0;
      if (delta.heal) {
        const before = battle.hp;
        battle.hp = Math.min(maxHp, battle.hp + delta.heal * gain);
        healed = battle.hp - before;
        record.healing += healed;
      }
      if (delta.selfDamage) battle.hp -= delta.selfDamage;
      record.damage += dealt;
      record.shield += gained;
      log.push({
        cycle: battle.cycle, slot: i, id: instance.id, part: base.name, type: instance.type,
        period, basePeriod: base.period, chip: chip || null, followed: Boolean(follows),
        line: LINES[base.line], relayed, gain, text: delta.text, damage: dealt,
        shieldGained: gained, healed, selfDamage: delta.selfDamage || 0,
        after: { shield, enemyHp: Math.max(0, battle.enemyHp), hp: Math.max(0, battle.hp) }
      });
      if (battle.enemyHp <= 0) break;
    }
    if (battle.enemyHp <= 0) break;

    let blocked = 0;
    if ((battle.cycle - 1) % (enemy.atkPeriod || 1) === 0) {
      blocked = Math.min(shield, enemy.atk);
      const through = enemy.atk - blocked;
      battle.hp -= through;
      log.push({
        cycle: battle.cycle, slot: null, part: enemy.name, type: "enemy",
        text: `遮蔽で${blocked}防ぎ、HPへ${through}`, blocked, hpDamage: through,
        after: { shield: 0, enemyHp: Math.max(0, battle.enemyHp), hp: Math.max(0, battle.hp) }
      });
    }

    const leftover = shield - blocked;
    const reflected = Math.floor(leftover / 2);
    if (reflected > 0 && battle.enemyHp > 0) {
      const dealt = applyHit(reflected);
      let assigned = 0;
      const entries = [...shieldBy.entries()];
      entries.forEach(([id, value], n) => {
        const share = n === entries.length - 1 ? dealt - assigned : Math.floor(dealt * value / shield);
        assigned += share;
        const record = [...contributions.values()].find(c => c.id === id);
        if (record) record.damage += share;
      });
      log.push({
        cycle: battle.cycle, slot: null, part: "反射", type: "reflect",
        text: `残った遮蔽${leftover}の半分が返った`, damage: dealt,
        after: { shield: 0, enemyHp: Math.max(0, battle.enemyHp), hp: Math.max(0, battle.hp) }
      });
    }
    if (enemy.regen && battle.enemyHp > 0) {
      battle.enemyHp = Math.min(enemy.hp, battle.enemyHp + enemy.regen);
      log.push({
        cycle: battle.cycle, slot: null, part: enemy.name, type: "enemy",
        text: `${enemy.regen}回復した`,
        after: { shield: 0, enemyHp: battle.enemyHp, hp: Math.max(0, battle.hp) }
      });
    }
  }

  return {
    won: battle.enemyHp <= 0,
    cycles: battle.cycle,
    hp: Math.max(0, Math.ceil(battle.hp)),
    enemyHp: Math.max(0, battle.enemyHp),
    timedOut: battle.cycle >= RELAY.MAX_CYCLES && battle.enemyHp > 0 && battle.hp > 0,
    contributions: [...contributions.values()],
    log
  };
}

export const MUTATE = {
  id: "mutate-0.1",
  title: "変異機関 / MUTATE 0.1",
  conceptsToHold: ["RELAYの周期・位相・継電", "チップで既存部品の意味が変わる", "チップは無料で移せる"],
  placementRule: RELAY.placementRule,
  PARTS, ENEMIES, PREDICTIONS: RELAY.PREDICTIONS, WORRY_CATEGORIES: RELAY.WORRY_CATEGORIES,
  UPDATE_KINDS: RELAY.UPDATE_KINDS, MARKER_KINDS: RELAY.MARKER_KINDS,
  SLOT_COUNT: RELAY.SLOT_COUNT, START_PARTS: RELAY.START_PARTS, RARE_RATE: RELAY.RARE_RATE,
  MAX_HP: RELAY.MAX_HP, REPAIR_HP: RELAY.REPAIR_HP, WIN_HEAL: RELAY.WIN_HEAL, REWARD_CHOICES: RELAY.REWARD_CHOICES,
  deterministic: true, MAX_CYCLES: RELAY.MAX_CYCLES, slotLabel: "変異駆動列",
  slotHint: "周期と位相を読み、チップの取り付け先を変えながら並べる",
  simulateBattle, predictionLevel: RELAY.predictionLevel, outcomeLevel: RELAY.outcomeLevel,
  gradeFor: RELAY.gradeFor, startContract: RELAY.startContract,
  chipTypes: MUTATION_CHIPS,
  chipAfterBattles: [1, 2],
  nextChip: ({ rng }) => CHIP_ORDER[Math.floor(rng() * CHIP_ORDER.length)],
  viewPart: instance => {
    const chip = instance.chip?.type ? MUTATION_CHIPS[instance.chip.type] : null;
    return chip ? {
      effectivePeriod: effectivePeriod(PARTS[instance.type], instance.chip.type),
      chip: { id: instance.chip.id, type: instance.chip.type, name: chip.name, short: chip.short, description: chip.description }
    } : {};
  },
  enemyView: RELAY.enemyView,
  rules: `【変異機関 / MUTATE 0.1 遊び方】
- RELAY 0.1の5枠・周期・位相・継電を土台に、4戦を勝ち抜く。
- 第1戦と第2戦の後に、変異チップを1個ずつ必ず得る。チップはランダムで、拒否・リロールできない。
- チップ取得時に、手持ちの部品を1つ選んで取り付ける。構築画面では、チップを別の部品へ無料で移せる。
- 1部品につけられるチップは1個。枠から外してもチップは失われない。
- 過速歯車：作動周期−1（最短1）、出力70%。蓄圧筒：作動周期＋1、出力180%。
- 追従軸：左隣が作動したとき50%で追加作動。1巡1回まで。追従軸同士も1巡の処理だけで、無限連鎖しない。
- 戦闘結果は決定的で、押す前に適用後の予告を見られる。専用演出・画像・音は無い。`,
  firesOn,
  periodOf: (part, chip) => effectivePeriod(part, chip),
};
