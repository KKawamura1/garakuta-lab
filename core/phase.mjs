// PHASE 0.1「位相機関」
//
// ARC 0.1 からの変更は一点だけ。BUS で三つ同時に変えて切り分けに困った反省による。
//
// 【変更】各部品は作動周期を持ち、**置いたスロットで作動する巡回がずれる**。
//   周期Pの部品を枠iに置くと、(巡回-1) % P === i % P の巡回にだけ動く。
//   敵も周期的に攻撃する。重い敵ほど間隔が空き、一撃が大きい。
//   遮蔽は巡回をまたいで残らない。
//
// 【狙い】防御が「常に正しい」ではなく「攻撃と位相が合った時だけ正しい」になる。
//   学習ログ#2・#3・#23の装甲支配は、防御が無条件に生存を買えたことに由来していた。
//   BUS 0.1で「有料にする」だけでは崩れず（乗数のままだった）、0.2で乗数を消すと
//   支配が火力へ移った。ここでは乗数を残したまま、**発動条件を配置に依存させる**。
//
// 【同時に狙う副作用】同じ部品でも枠を変えると別の巡回に動くので、
//   並べ替えが順序ではなく位相の選択になる。強い部品を3枚重ねても、
//   同位相に置けば単発の山、分散させれば毎巡の安定になり、どちらが正しいかは敵で変わる。

export const RULESET_ID = "phase-0.1";
export const MAX_CYCLES = 12;
export const SLOT_COUNT = 5;
export const START_PARTS = 8;
export const RARE_RATE = 0.12;

export const PARTS = {
  needle: {
    name: "針打機", icon: "·", period: 1, short: "毎巡の小突き", tags: ["攻撃", "毎巡"],
    desc: "毎巡回3ダメージ。小さいが必ず動く。",
    run: () => ({ damage: 3, text: "針を打ち込んだ" })
  },
  thin: {
    name: "薄板", icon: "▁", period: 1, short: "毎巡の薄い盾", tags: ["防御", "毎巡"],
    desc: "毎巡回、遮蔽3。遮蔽は巡回の終わりに消える。",
    run: () => ({ shield: 3, text: "薄板をかざした" })
  },
  feeder: {
    name: "送気管", icon: "→", period: 1, short: "次を+5", tags: ["連携", "毎巡"],
    desc: "毎巡回、この巡回で次に作動する部品の 攻撃・遮蔽・回復 をそれぞれ5増やす。多段は1発だけ。自傷には乗らない。",
    run: () => ({ boost: 5, text: "送気して次へ回した" })
  },
  striker: {
    name: "撃鉄", icon: "▪", period: 2, short: "2巡ごとの中打", tags: ["攻撃"],
    desc: "2巡に1回、9ダメージ。置いた枠で作動する巡回が変わる。",
    run: () => ({ damage: 9, text: "撃鉄が落ちた" })
  },
  thick: {
    name: "厚板", icon: "▂", period: 2, short: "2巡ごとの盾", tags: ["防御"],
    desc: "2巡に1回、遮蔽7。攻撃が来る巡回に合わせないと無駄になる。",
    run: () => ({ shield: 7, text: "厚板を立てた" })
  },
  intake: {
    name: "吸気筒", icon: "◠", period: 2, short: "2巡ごとに回復", tags: ["回復"],
    desc: "2巡に1回、HPを4回復する。",
    run: () => ({ heal: 4, text: "空気を取り込んだ" })
  },
  flurry: {
    name: "連打腕", icon: "≡", period: 2, short: "小刻みに3発", tags: ["攻撃", "多段"],
    desc: "2巡に1回、3ダメージを3発。1発ごとに減衰や上限を受ける。",
    run: () => ({ hits: [3, 3, 3], text: "腕が3度回った" })
  },
  maul: {
    name: "大槌", icon: "█", period: 3, short: "3巡ごとの一撃", tags: ["攻撃", "重量"],
    desc: "3巡に1回、18ダメージ。1発が大きいので上限のある敵には弱い。",
    run: () => ({ damage: 18, text: "大槌が振り下ろされた" })
  },
  barrier: {
    name: "障壁", icon: "▃", period: 3, short: "3巡ごとの大盾", tags: ["防御", "重量"],
    desc: "3巡に1回、遮蔽13。重い敵の攻撃巡回に合わせられるかがすべて。",
    run: () => ({ shield: 13, text: "障壁が展開した" })
  },
  bank: {
    name: "蓄電盤", icon: "▩", period: 3, short: "3巡ごとに攻防", tags: ["攻撃", "防御"],
    desc: "3巡に1回、11ダメージと遮蔽5。",
    run: () => ({ damage: 11, shield: 5, text: "蓄えた電を放った" })
  },
  collapse: {
    name: "崩落砲", icon: "‼", period: 3, short: "3巡ごとの特大", rare: true, tags: ["攻撃", "レア"],
    desc: "3巡に1回、28ダメージ。反動で自分に3ダメージ。",
    run: () => ({ damage: 28, selfDamage: 3, text: "崩落砲が唸った" })
  }
};

// atkPeriod = 敵が攻撃する間隔。1なら毎巡、3なら1・4・7巡目にだけ来る。
// cap = 1回の命中で通る上限 / floor = これ未満の命中は1に潰される。
export const ENEMIES = [
  { name: "試運転機", face: "○", hp: 36, atk: 6, atkPeriod: 1, cap: 99, floor: 0,
    trait: "毎巡6。位相の基本を確かめる相手。" },
  { name: "鎖甲", face: "▤", hp: 55, atk: 7, atkPeriod: 1, cap: 6, floor: 0,
    trait: "毎巡7。1回の命中は6までしか通らない。大きい一撃ほど無駄が出る。" },
  { name: "重槌鬼", face: "▼", hp: 65, atk: 22, atkPeriod: 3, cap: 99, floor: 0,
    trait: "3巡に1回、22の一撃。来る巡回に遮蔽を合わせられるか。" },
  { name: "硬芯", face: "◆", hp: 74, atk: 8, atkPeriod: 2, cap: 99, floor: 8,
    trait: "2巡に1回8。8未満の命中は1に潰される。小突きが効かない。" },
  { name: "双撃機", face: "≫", hp: 84, atk: 12, atkPeriod: 2, cap: 99, floor: 0,
    trait: "2巡に1回12。間隔が空くぶん一撃が重い。" },
  { name: "終端炉", face: "◉", hp: 106, atk: 11, atkPeriod: 1, cap: 99, floor: 0, regen: 5,
    trait: "毎巡11、さらに毎巡5回復する。削る速さと耐える力の両方が要る。" }
];

export const PREDICTIONS = ["負けそう", "ギリギリ", "勝てそう", "圧勝"];
export const WORRY_CATEGORIES = ["位相", "火力", "遮蔽", "耐久", "回復", "選択肢", "なし"];
export const UPDATE_KINDS = ["confirmed", "revalued_existing", "new_plan", "none"];
export const MARKER_KINDS = ["hit", "insight", "choice", "payoff", "friction", "unclear"];

export function predictionLevel(prediction) { return PREDICTIONS.indexOf(prediction); }
export function outcomeLevel(won, hp) {
  if (!won) return 0;
  if (hp <= 10) return 1;
  if (hp < 24) return 2;
  return 3;
}

// 枠iの周期P部品は (巡回-1) % P === i % P の巡回に作動する。
export function firesOn(cycle, slotIndex, period) {
  return (cycle - 1) % period === slotIndex % period;
}

function emptyContribution(instance, parts = PARTS) {
  return {
    id: instance.id, type: instance.type, name: parts[instance.type].name,
    activations: 0, idles: 0, damage: 0, shield: 0, healing: 0
  };
}

// parts を差し替えられるようにする。モジュール直下の PARTS を直接見ていると、
// 数値を振る実験が「効いていないのに完走してしまう」形で失敗する（実際に一度やった）。
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

  while (battle.hp > 0 && battle.enemyHp > 0 && battle.cycle < MAX_CYCLES) {
    battle.cycle += 1;
    let shield = 0;
    let boost = 0;

    for (let i = 0; i < slots.length; i += 1) {
      const instance = slots[i];
      if (!instance) continue;
      const part = parts[instance.type];
      const record = total(instance);
      if (!firesOn(battle.cycle, i, part.period)) {
        record.idles += 1;
        continue;
      }
      record.activations += 1;
      const delta = part.run({ ...battle, instanceId: instance.id, uses: battle.uses, rng });

      // 加算は攻撃・遮蔽・回復のどれにも同じく乗り、いずれかを出した部品が消費する。
      // 以前は攻撃にしか乗らず、回復だけの部品は消費もせずに次へ漏らしていた。
      // 説明文と実装が食い違っていたので、説明文の側へ揃えた。多段は1発だけ、自傷には乗らない。
      const usesBoost = Boolean(delta.damage || delta.hits || delta.shield || delta.heal);
      let dealt = 0;
      if (delta.damage) dealt += applyHit(delta.damage + boost);
      if (delta.hits) delta.hits.forEach((h, n) => { if (battle.enemyHp > 0) dealt += applyHit(h + (n === 0 ? boost : 0)); });
      const gained = delta.shield ? delta.shield + boost : 0;
      if (gained) shield += gained;
      if (delta.heal) {
        const before = battle.hp;
        battle.hp = Math.min(maxHp, battle.hp + delta.heal + boost);
        record.healing += battle.hp - before;
      }
      if (delta.selfDamage) battle.hp -= delta.selfDamage;
      const usedBoost = usesBoost ? boost : 0;
      if (usesBoost) boost = 0;
      if (delta.boost) boost = delta.boost;

      record.damage += dealt;
      record.shield += gained;
      log.push({ cycle: battle.cycle, slot: i, part: part.name, type: instance.type, period: part.period,
        text: delta.text, damage: dealt,
        shieldGained: gained, healed: delta.heal ? record.healing : 0,
        selfDamage: delta.selfDamage || 0, boostUsed: usedBoost, boostSet: delta.boost || 0,
        after: { shield, enemyHp: Math.max(0, battle.enemyHp), hp: Math.max(0, battle.hp) } });
      if (battle.enemyHp <= 0) break;
    }
    if (battle.enemyHp <= 0) break;

    if ((battle.cycle - 1) % (enemy.atkPeriod || 1) === 0) {
      const blocked = Math.min(shield, enemy.atk);
      const through = enemy.atk - blocked;
      battle.hp -= through;
      log.push({ cycle: battle.cycle, slot: null, part: enemy.name, type: "enemy",
        text: `遮蔽で${blocked}防ぎ、HPへ${through}`, blocked, hpDamage: through,
        after: { shield: 0, enemyHp: Math.max(0, battle.enemyHp), hp: Math.max(0, battle.hp) } });
    }
    if (enemy.regen && battle.enemyHp > 0) {
      battle.enemyHp = Math.min(enemy.hp, battle.enemyHp + enemy.regen);
      log.push({ cycle: battle.cycle, slot: null, part: enemy.name, type: "enemy",
        text: `${enemy.regen}回復した`, after: { shield: 0, enemyHp: battle.enemyHp, hp: Math.max(0, battle.hp) } });
    }
  }

  return {
    won: battle.enemyHp <= 0,
    cycles: battle.cycle,
    hp: Math.max(0, Math.ceil(battle.hp)),
    enemyHp: Math.max(0, battle.enemyHp),
    timedOut: battle.cycle >= MAX_CYCLES && battle.enemyHp > 0 && battle.hp > 0,
    contributions: [...contributions.values()],
    log
  };
}

export const PHASE = {
  id: RULESET_ID,
  conceptsToHold: ["HP", "遮蔽は巡回で消える", "部品ごとの作動周期", "枠で位相がずれる（剰余）", "敵の攻撃周期", "命中上限", "命中下限", "敵の毎巡回復"],
  placementRule: "位相（枠を変えると作動する巡回そのものが変わる）",
  title: "位相機関 / PHASE 0.1",
  PARTS, ENEMIES, PREDICTIONS, WORRY_CATEGORIES, UPDATE_KINDS, MARKER_KINDS,
  SLOT_COUNT, START_PARTS, RARE_RATE, MAX_CYCLES,
  // どの部品も rng を使わない。並びを決めれば結果は一意なので、画面は見積りではなく答えを出せる。
  deterministic: true,
  MAX_HP: 30, REPAIR_HP: 5, WIN_HEAL: 3, REWARD_CHOICES: 3,
  slotLabel: "位相列",
  slotHint: "周期Pの部品を枠iに置くと (巡回-1)%P === i%P の巡回に作動する",
  simulateBattle, predictionLevel, outcomeLevel,
  enemyView: enemy => ({
    name: enemy.name, hp: enemy.hp, atk: enemy.atk,
    攻撃周期: enemy.atkPeriod, 命中上限: enemy.cap >= 99 ? null : enemy.cap,
    命中下限: enemy.floor || null, 毎巡回復: enemy.regen || null, trait: enemy.trait
  }),
  rules: `【位相機関 / PHASE 0.1 遊び方】
- 部品で機関を組み、6戦を勝ち抜く。操作は構築のみで、戦闘は自動。
- 位相列は5枠。**各部品は作動周期を持つ。** 周期1は毎巡、周期2は2巡に1回、周期3は3巡に1回動く。
- **どの枠に置いたかで、作動する巡回がずれる。** 周期Pの部品を枠iに置くと、(巡回-1)%P === i%P の巡回に動く。
  例：周期3の部品は、枠1なら1・4・7巡目、枠2なら2・5・8巡目、枠3なら3・6・9巡目に動く。
- 同じ部品を複数持っていても、同じ位相に置けば単発の山、ずらせば毎巡の安定になる。
- **敵にも攻撃周期がある。** 間隔が空く敵ほど一撃が重い。遮蔽は巡回の終わりに消えるので、
  敵が殴ってくる巡回に遮蔽の位相を合わせないと、遮蔽は無駄になる。
- 敵の命中上限は1回の命中で通る量を制限し、命中下限より小さい命中は1に潰される。
- 勝利するとHPが3回復し、3候補から1個だけ拾える。全部見送ると修復材◆2。
- 予備部品を分解すると◆1。◆1でHPが5回復する。12巡で決着しなければ敗北。`
};
