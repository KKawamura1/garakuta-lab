import { makeRng, pick } from "./rng.mjs";

export const RULESET_ID = "arc-0.1";
export const MAX_CYCLES = 12;
export const SLOT_COUNT = 5;
export const START_PARTS = 8;
export const RARE_RATE = 0.12;

export const PARTS = {
  spark: {
    name: "火花ノズル", icon: "✦", short: "小攻撃＋発電", tags: ["攻撃", "電力"],
    desc: "2ダメージを与え、電力を1得る。いつ置いても最低限働く。",
    run: () => ({ damage: 2, power: 1, text: "火花が敵を削り、電力を拾った" })
  },
  furnace: {
    name: "暴走炉", icon: "♨", short: "熱で威力上昇", tags: ["攻撃", "熱"],
    desc: "熱を2増やし、現在の熱に応じて1〜6ダメージ。冷やしても溜めても使える。",
    run: s => ({ damage: Math.min(6, 1 + Math.floor((s.heat + 2) / 2)), heat: 2, text: "炉が赤熱して殴りかかった" })
  },
  turbine: {
    name: "廃熱タービン", icon: "✺", short: "熱を発電へ", tags: ["熱", "電力", "冷却"],
    desc: "熱を1冷まし、電力を2得る。熱が4以上なら、さらに電力＋1。",
    run: s => ({ power: 2 + (s.heat >= 4 ? 1 : 0), cool: 1, text: "廃熱でタービンが回った" })
  },
  ram: {
    name: "電磁ラム", icon: "➤", short: "電力を打撃へ", tags: ["攻撃", "電力"],
    desc: "3ダメージ。電力を最大3消費し、その2倍を追加する。電力ゼロでも動く。",
    run: s => {
      const used = Math.min(3, s.power);
      return { damage: 3 + used * 2, power: -used, text: `電力${used}を叩き込んだ` };
    }
  },
  plating: {
    name: "即席装甲機", icon: "⬡", short: "電力で装甲追加", tags: ["防御", "電力"],
    desc: "装甲を3得る。電力があれば1消費し、さらに装甲＋3。",
    run: s => ({ shield: 3 + (s.power > 0 ? 3 : 0), power: s.power > 0 ? -1 : 0, text: "鉄板を前面へ溶接した" })
  },
  vent: {
    name: "破裂ベント", icon: "≋", short: "冷却量で攻撃", tags: ["攻撃", "熱", "冷却"],
    desc: "熱を最大4冷まし、冷ました量＋2ダメージ。熱がなくても2ダメージ。",
    run: s => {
      const cooled = Math.min(4, s.heat);
      return { damage: 2 + cooled, cool: cooled, text: `熱${cooled}を敵へ噴きつけた` };
    }
  },
  pulse: {
    name: "熱感知パルス", icon: "◎", short: "高熱で大爆発", tags: ["攻撃", "熱", "冷却"],
    desc: "通常は2ダメージ。熱が5以上なら8ダメージを与え、熱を2冷ます。",
    run: s => s.heat >= 5
      ? ({ damage: 8, cool: 2, text: "高熱を検知し、衝撃波を放った" })
      : ({ damage: 2, text: "小さな探査波を放った" })
  },
  battery: {
    name: "過充電池", icon: "▣", short: "大量発電", tags: ["電力", "防御"],
    desc: "電力を4得る。作動前から電力が4以上あれば、余剰で装甲も2得る。",
    run: s => ({ power: 4, shield: s.power >= 4 ? 2 : 0, text: "電力を乱暴に詰め込んだ" })
  },
  echo: {
    name: "残響コイル", icon: "∞", short: "直前の半分を再現", tags: ["複製", "万能"],
    desc: "直前の部品が生んだ正の効果を半分再現する。先頭なら2ダメージ。",
    run: s => {
      if (!s.last) return { damage: 2, text: "残響する物がないので直接ぶつけた" };
      const half = key => Math.max(0, Math.floor((s.last[key] || 0) / 2));
      return { damage: half("damage"), power: half("power"), heat: half("heat"), shield: half("shield"), heal: half("heal"), text: "直前の動作を弱く反響した" };
    }
  },
  recycler: {
    name: "小型再生機", icon: "♲", short: "少しずつ全体改善", tags: ["回復", "電力", "冷却"],
    desc: "HPを1回復し、電力を1得て、熱を1冷ます。地味だが腐らない。",
    run: () => ({ heal: 1, power: 1, cool: 1, text: "端材を全身へ配り直した" })
  },
  prism: {
    name: "装甲プリズム", icon: "◇", short: "装甲を攻撃へ", tags: ["攻撃", "防御"],
    desc: "2ダメージ。装甲があれば最大3消費し、その2倍を追加する。",
    run: s => {
      const used = Math.min(3, s.shield);
      return { damage: 2 + used * 2, shield: -used, text: `装甲${used}を光弾へ変えた` };
    }
  },
  mine: {
    name: "時限ボルト", icon: "◉", short: "2回ごとに爆発", tags: ["攻撃", "蓄積"],
    desc: "奇数回は2ダメージ、偶数回は11ダメージ。爆発後はまた2ダメージに戻る。",
    run: s => {
      const count = (s.uses[s.instanceId] || 0) + 1;
      s.uses[s.instanceId] = count;
      return count % 2 === 0
        ? ({ damage: 11, text: "ボルトが時間差で大爆発した" })
        : ({ damage: 2, text: "敵へ時限ボルトを打ち込んだ" });
    }
  },
  leech: {
    name: "吸着ドリル", icon: "⌾", short: "攻撃しながら防御", tags: ["攻撃", "防御"],
    desc: "3ダメージを与え、装甲を2得る。派手ではないが一つで攻防を担う。",
    run: () => ({ damage: 3, shield: 2, text: "削った破片を装甲へ貼り付けた" })
  },
  unstable: {
    name: "違法砲身", icon: "‼", short: "雑に強い不安定砲", tags: ["攻撃", "熱", "レア"],
    desc: "5〜11ダメージを与え、熱＋2。現在、熱そのものによるペナルティはない。",
    rare: true,
    run: s => ({ damage: 5 + Math.floor(s.rng() * 7), heat: 2, text: "違法砲身が轟音とともに暴れた" })
  }
};

export const ENEMIES = [
  { name: "スクラップ・ラット", face: "●", hp: 22, atk: 3, armor: 0, trait: "標準型。まず動作を確かめる相手。" },
  { name: "切断ドローン", face: "✕", hp: 34, atk: 5, armor: 0, trait: "攻撃力が高い。防御か速攻が欲しい。" },
  { name: "鋳鉄クラブ", face: "▰", hp: 43, atk: 5, armor: 2, trait: "装甲2。小さい攻撃を軽減する。" },
  { name: "焼却監視機", face: "▲", hp: 56, atk: 7, armor: 0, heat: 1, trait: "攻撃のたび、こちらの熱を1増やす。" },
  { name: "暴走ジャガー", face: "◆", hp: 72, atk: 7, armor: 1, rage: 2, trait: "各巡回で攻撃力＋2。長期戦ほど危険。" },
  { name: "廃都の中枢", face: "◈", hp: 94, atk: 10, armor: 2, rage: 1, trait: "装甲2・攻撃上昇。寄せ集めの最終試験。" }
];

export const PREDICTIONS = ["負けそう", "ギリギリ", "勝てそう", "圧勝"];
export const WORRY_CATEGORIES = ["装甲", "火力", "電力", "熱", "速度", "選択肢", "なし"];
export const UPDATE_KINDS = ["confirmed", "revalued_existing", "new_plan", "none"];
export const MARKER_KINDS = ["hit", "insight", "choice", "payoff", "friction", "unclear"];

export function predictionLevel(prediction) {
  return PREDICTIONS.indexOf(prediction);
}

export function outcomeLevel(won, hp) {
  if (!won) return 0;
  if (hp <= 10) return 1;
  if (hp < 24) return 2;
  return 3;
}

function emptyContribution(instance) {
  return {
    id: instance.id, type: instance.type, name: PARTS[instance.type].name,
    activations: 0, damage: 0, powerMade: 0, powerSpent: 0,
    heatMade: 0, heatCooled: 0, shield: 0, healing: 0
  };
}

export function simulateBattle({ slots, hp, maxHp, enemy, rng }) {
  const battle = {
    hp, power: 0, heat: 0, shield: 0, enemyHp: enemy.hp,
    uses: {}, last: null, cycle: 0, rng
  };
  const contributions = new Map();
  const log = [];

  const applyDelta = delta => {
    const armor = enemy.armor || 0;
    const raw = Math.max(0, delta.damage || 0);
    const actual = raw > 0 ? Math.max(1, raw - armor) : 0;
    battle.enemyHp -= actual;
    battle.power = Math.max(0, battle.power + (delta.power || 0));
    battle.heat = Math.max(0, battle.heat + (delta.heat || 0) - (delta.cool || 0));
    battle.shield = Math.max(0, battle.shield + (delta.shield || 0));
    battle.hp = Math.min(maxHp, battle.hp + (delta.heal || 0));
    return actual;
  };

  while (battle.hp > 0 && battle.enemyHp > 0 && battle.cycle < MAX_CYCLES) {
    battle.cycle += 1;
    for (let i = 0; i < slots.length; i += 1) {
      const instance = slots[i];
      if (!instance) continue;
      const part = PARTS[instance.type];
      const context = { ...battle, instanceId: instance.id, uses: battle.uses, rng };
      const delta = part.run(context);
      const actual = applyDelta(delta);
      battle.last = { ...delta, damage: actual };

      if (!contributions.has(instance.id)) contributions.set(instance.id, emptyContribution(instance));
      const total = contributions.get(instance.id);
      total.activations += 1;
      total.damage += actual;
      total.powerMade += Math.max(0, delta.power || 0);
      total.powerSpent += Math.max(0, -(delta.power || 0));
      total.heatMade += Math.max(0, delta.heat || 0);
      total.heatCooled += Math.max(0, delta.cool || 0);
      total.shield += Math.max(0, delta.shield || 0);
      total.healing += Math.max(0, delta.heal || 0);

      log.push({
        cycle: battle.cycle, slot: i, part: part.name, type: instance.type,
        text: delta.text, damage: actual,
        after: { hp: battle.hp, power: battle.power, heat: battle.heat, shield: battle.shield, enemyHp: Math.max(0, battle.enemyHp) }
      });
      if (battle.enemyHp <= 0) break;
    }
    if (battle.enemyHp <= 0) break;

    let attack = enemy.atk + (enemy.rage || 0) * (battle.cycle - 1);
    const blocked = Math.min(battle.shield, attack);
    battle.shield -= blocked;
    attack -= blocked;
    battle.hp -= attack;
    battle.heat += enemy.heat || 0;
    log.push({
      cycle: battle.cycle, slot: null, part: enemy.name, type: "enemy",
      text: `装甲で${blocked}防ぎ、HPへ${attack}ダメージ`, damage: 0,
      blocked, hpDamage: attack,
      after: { hp: Math.max(0, battle.hp), power: battle.power, heat: battle.heat, shield: battle.shield, enemyHp: Math.max(0, battle.enemyHp) }
    });
  }

  const finalHp = Math.max(0, Math.ceil(battle.hp));
  return {
    won: battle.enemyHp <= 0,
    cycles: battle.cycle,
    hp: finalHp,
    enemyHp: Math.max(0, battle.enemyHp),
    power: battle.power,
    heat: battle.heat,
    shield: battle.shield,
    timedOut: battle.cycle >= MAX_CYCLES && battle.enemyHp > 0 && battle.hp > 0,
    contributions: [...contributions.values()],
    log
  };
}
