// RELAY 0.1「継電機関」
//
// PHASE 0.1 から引き継ぐもの：作動周期と、置いた枠で作動巡回がずれる位相。
// 作者の評価では、ここが面白さの中心だった（「配置が悩ましい」「敵によって同じ部品が入れ替わる」）。
//
// 【変更は一点】巡回の中で、**直前に作動した部品と同じ系統なら効果が2倍になる**（継電）。
//   系統は 撃・守・整 の3つ。巡回の最初の部品と、直前が別系統の部品は等倍。
//
// 【なぜ一点だけか】BUS で三つ同時に変えて切り分けに失敗した反省（学習#20）。
//
// 【なぜこの変更か】第6回で、PHASE の実質的な判断は最終戦にしか無いことが分かった。
//   勝てる並びの割合は戦闘別に 100 / 87 / 59 / 79 / 84 / 8 %。第1戦は6720通りが全部勝つ。
//   作者の求める形は「並びはきつめに、部品選択はゆるめに」（P10）。
//   継電は**部品集合を変えずに並びだけで結果を大きく動かす**ので、この要求に直接対応する。
//
// 【なぜ今なら許されるか】画面が実機の結果を即座に断定するようになった（第6回）。
//   作者の申告は「暗算はただの足し算で脳トレでつまらない、組み合わせを試すのは楽しい」。
//   検算を機械が引き受けるなら、**規則の帰結が暗算しづらいことはもうコストではない。**
//   原則：**読むのは機械、探すのは人。** 読む重さは削り（部品の説明は1行、敵の修飾は1つずつ）、
//   解く重さは削らない。

export const RULESET_ID = "relay-0.1";
export const MAX_CYCLES = 12;
export const SLOT_COUNT = 5;
export const START_PARTS = 8;
export const RARE_RATE = 0.12;

export const LINES = { strike: "撃", guard: "守", service: "整" };

// 系統は3つだけ。部品の説明は1行に収める（読む重さの上限）。
export const PARTS = {
  rivet: {
    name: "打鋲", icon: "·", line: "strike", period: 1, short: "毎巡の小突き", tags: ["撃", "毎巡"],
    desc: "毎巡回4ダメージ。",
    run: () => ({ damage: 4, text: "鋲を打ち込んだ" })
  },
  flurry: {
    name: "連射", icon: ":", line: "strike", period: 1, short: "毎巡3を2発", tags: ["撃", "毎巡"],
    desc: "毎巡回3ダメージを2発。",
    run: () => ({ hits: [3, 3], text: "連射した" })
  },
  twin: {
    name: "双撃", icon: "=", line: "strike", period: 2, short: "2巡ごと7を2発", tags: ["撃"],
    desc: "2巡に1回、7ダメージを2発。",
    run: () => ({ hits: [7, 7], text: "双撃が2発入った" })
  },
  auger: {
    name: "貫錐", icon: "†", line: "strike", period: 2, short: "2巡ごと11", tags: ["撃"],
    desc: "2巡に1回、11ダメージ。",
    run: () => ({ damage: 11, text: "錐がねじ込まれた" })
  },
  hammer: {
    name: "重鎚", icon: "▼", line: "strike", period: 3, short: "3巡ごと22", tags: ["撃"],
    desc: "3巡に1回、22ダメージ。",
    run: () => ({ damage: 22, text: "重鎚が振り下ろされた" })
  },
  collapse: {
    name: "崩落砲", icon: "◎", line: "strike", period: 4, short: "4巡ごと40", tags: ["撃", "希少"],
    desc: "4巡に1回、40ダメージ。", rare: true,
    run: () => ({ damage: 40, text: "崩落砲が吼えた" })
  },
  surge: {
    name: "過給器", icon: "!", line: "strike", period: 2, short: "2巡ごと16／自傷4", tags: ["撃"],
    desc: "2巡に1回、16ダメージ。自分も4受ける（自傷に倍率は乗らない）。",
    run: () => ({ damage: 16, selfDamage: 4, text: "過給して撃った" })
  },
  thin: {
    name: "薄殻", icon: "▁", line: "guard", period: 1, short: "毎巡の薄い盾", tags: ["守", "毎巡"],
    desc: "毎巡回、遮蔽4。",
    run: () => ({ shield: 4, text: "薄殻をかざした" })
  },
  thick: {
    name: "厚殻", icon: "▃", line: "guard", period: 2, short: "2巡ごと遮蔽11", tags: ["守"],
    desc: "2巡に1回、遮蔽11。",
    run: () => ({ shield: 11, text: "厚殻を立てた" })
  },
  deflect: {
    name: "偏向板", icon: "◤", line: "guard", period: 3, short: "3巡ごと遮蔽20", tags: ["守"],
    desc: "3巡に1回、遮蔽20。",
    run: () => ({ shield: 20, text: "偏向板が受け流した" })
  },
  feed: {
    name: "整流器", icon: "→", line: "service", period: 1, short: "毎巡の回復3", tags: ["整", "毎巡"],
    desc: "毎巡回、HP3回復。",
    run: () => ({ heal: 3, text: "整流して立て直した" })
  },
  loop: {
    name: "環流管", icon: "○", line: "service", period: 2, short: "2巡ごと回復5と遮蔽5", tags: ["整"],
    desc: "2巡に1回、HP5回復と遮蔽5。",
    run: () => ({ heal: 5, shield: 5, text: "環流が回った" })
  }
};

// 敵の修飾は1体につき1つだけにする（読む重さの上限）。
export const ENEMIES = [
  { name: "標的機", face: "○", hp: 383, atk: 7, atkPeriod: 1, cap: 99, floor: 0,
    trait: "毎巡7。継電の基本を確かめる相手。硬いので、連ねないと12巡で削り切れない。" },
  { name: "環甲", face: "▤", hp: 212, atk: 8, atkPeriod: 1, cap: 14, floor: 0,
    trait: "毎巡8。1回の命中は14までしか通らない。長い連鎖ほど上限で削られる。" },
  { name: "大顎", face: "▼", hp: 289, atk: 26, atkPeriod: 3, cap: 99, floor: 0,
    trait: "3巡に1回、26の一撃。来る巡回に遮蔽を合わせられるか。" },
  { name: "鋼芯", face: "◆", hp: 328, atk: 10, atkPeriod: 2, cap: 99, floor: 10,
    trait: "2巡に1回10。10未満の命中は1に潰される。連ねて倍にしないと小突きが通らない。" },
  { name: "双翼", face: "≫", hp: 329, atk: 15, atkPeriod: 2, cap: 99, floor: 0,
    trait: "2巡に1回15。間隔が空くぶん一撃が重い。" },
  { name: "再生炉", face: "◉", hp: 192, atk: 12, atkPeriod: 1, cap: 99, floor: 0, regen: 10,
    trait: "毎巡12、さらに毎巡10回復する。削る速さと耐える力の両方が要る。" }
];

export const PREDICTIONS = ["負けそう", "ギリギリ", "勝てそう", "圧勝"];
export const WORRY_CATEGORIES = ["位相", "継電", "火力", "遮蔽", "耐久", "回復", "選択肢", "なし"];
export const UPDATE_KINDS = ["confirmed", "revalued_existing", "new_plan", "none"];
export const MARKER_KINDS = ["hit", "insight", "choice", "payoff", "friction", "unclear"];

export function predictionLevel(prediction) { return PREDICTIONS.indexOf(prediction); }

// 残りHPだけで勝ち方を評価すると、RELAY では実態と合わない。
// 難易度の軸を耐久から時間へ移したので、**打切り間際の勝ちは無傷でも薄氷**である。
// 実測：作者の seed 23 第1戦は11巡・失点6で「圧勝」と表示されたが、
// 本人のマーカーは「1戦目からギリギリ」だった。巡回も見る。
export function outcomeLevel(won, hp, cycles = 0) {
  if (!won) return 0;
  if (hp <= 8 || cycles >= MAX_CYCLES - 1) return 1;
  if (hp <= 20 || cycles >= Math.ceil(MAX_CYCLES * 0.65)) return 2;
  return 3;
}

// 等級。**罰ではなく志である。** 外しても勝ちは勝ちで、ランは続く。
//
// 作者の指摘：「積み上げのないゲームで決断を大きく咎めるのは楽しみを奪う」。
// 実測でも、人間5ランはすべて勝ちで、このゲームは一度も咎めていなかった。
// 一方、勝つだけなら20回の無作為な並べ替えで96%到達するのに、無傷は31%にとどまる。
// **志を上げれば、罰を一切増やさずにガチャガチャを無力にできる。**
export const GRADES = [
  { rank: 4, label: "無傷", maxLost: 0 },
  { rank: 3, label: "上々", maxLost: 5 },
  { rank: 2, label: "及第", maxLost: 14 },
  { rank: 1, label: "辛勝", maxLost: Infinity }
];

export function gradeFor(won, hpLost) {
  if (!won) return { rank: 0, label: "敗北" };
  return GRADES.find(g => hpLost <= g.maxLost);
}

export function firesOn(cycle, slotIndex, period) {
  return (cycle - 1) % period === slotIndex % period;
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

  while (battle.hp > 0 && battle.enemyHp > 0 && battle.cycle < MAX_CYCLES) {
    battle.cycle += 1;
    let shield = 0;
    const shieldBy = new Map();
    // 継電は巡回ごとに切れる。巡回の最初の部品は常に等倍。
    let previousLine = null;
    let chain = 0;

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

      // 継電：巡回の中で同じ系統がn個続いたとき、n個目の効果はn倍。自傷には乗らない。
      //
      // 2倍固定から段階倍率へ変えたのは、生成条件を満たすためである。
      // 部品の攻撃力は4から40まで開いているので、集合ごとの上限が5倍ほど散らばり、
      // 「弱い引きでも勝てる敵HP」と「並みの並びが落ちる敵HP」が両立しなかった。
      // 段階倍率は、周期1の弱い部品ほど連ねられる（強い部品は周期が長く単独で動く）ので、
      // **上限の差を縮めながら、並び順の重みを増やす。** 作者の要求そのものに対応する。
      const relayed = previousLine === part.line;
      chain = relayed ? chain + 1 : 1;
      const gain = chain;
      if (relayed) record.relays += 1;
      previousLine = part.line;

      const delta = part.run({ ...battle, instanceId: instance.id, uses: battle.uses, rng });
      let dealt = 0;
      if (delta.damage) dealt += applyHit(delta.damage * gain);
      if (delta.hits) delta.hits.forEach(h => { if (battle.enemyHp > 0) dealt += applyHit(h * gain); });
      const gained = (delta.shield || 0) * gain;
      if (gained) { shield += gained; shieldBy.set(instance.id, (shieldBy.get(instance.id) || 0) + gained); }
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
      log.push({ cycle: battle.cycle, slot: i, part: part.name, type: instance.type, period: part.period,
        line: LINES[part.line], relayed, gain, text: delta.text, damage: dealt,
        shieldGained: gained, healed, selfDamage: delta.selfDamage || 0,
        after: { shield, enemyHp: Math.max(0, battle.enemyHp), hp: Math.max(0, battle.hp) } });
      if (battle.enemyHp <= 0) break;
    }
    if (battle.enemyHp <= 0) break;

    let blocked = 0;
    if ((battle.cycle - 1) % (enemy.atkPeriod || 1) === 0) {
      blocked = Math.min(shield, enemy.atk);
      const through = enemy.atk - blocked;
      battle.hp -= through;
      log.push({ cycle: battle.cycle, slot: null, part: enemy.name, type: "enemy",
        text: `遮蔽で${blocked}防ぎ、HPへ${through}`, blocked, hpDamage: through,
        after: { shield: 0, enemyHp: Math.max(0, battle.enemyHp), hp: Math.max(0, battle.hp) } });
    }

    // 【反射】巡回の終わりに使われずに残った遮蔽は、半分が敵へ返る。
    //
    // これは飾りではなく、生成条件を満たすために必要だった規則である。
    // 守だけの手札は敵を削る手段が無く、「どの部品を選択しても勝ちの目がある」（T1）と
    // 「並びはきつい」（T2）が両立しなかった。敵の数値では解けない形の不成立だった。
    //
    // 副作用の方が本題に近い：**守の部品は、敵の攻撃巡回に合えば盾、外れれば矛になる。**
    // 同じ部品が置き場所で役割ごと変わるので、位相の判断が「守るか殴るか」の判断になる。
    const leftover = shield - blocked;
    const reflected = Math.floor(leftover / 2);
    if (reflected > 0 && battle.enemyHp > 0) {
      const dealt = applyHit(reflected);
      // 寄与は、その巡回に遮蔽を出した部品へ按分する。
      let assigned = 0;
      const entries = [...shieldBy.entries()];
      entries.forEach(([id, value], n) => {
        const share = n === entries.length - 1 ? dealt - assigned : Math.floor(dealt * value / shield);
        assigned += share;
        const record = [...contributions.values()].find(c => c.id === id);
        if (record) record.damage += share;
      });
      log.push({ cycle: battle.cycle, slot: null, part: "反射", type: "reflect",
        text: `残った遮蔽${leftover}の半分が返った`, damage: dealt,
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

export const RELAY = {
  id: RULESET_ID,
  conceptsToHold: ["HP", "遮蔽は巡回の終わりに消える", "部品ごとの作動周期", "枠で位相がずれる（剰余）",
    "同系統が続くほど倍率が上がる（継電）", "余った遮蔽の半分が返る（反射）", "敵の攻撃周期", "敵の修飾は1体1つ"],
  placementRule: "位相（作動巡回）と 継電（巡回内で誰の次に動くか）の両方",
  title: "継電機関 / RELAY 0.1",
  PARTS, ENEMIES, PREDICTIONS, WORRY_CATEGORIES, UPDATE_KINDS, MARKER_KINDS,
  SLOT_COUNT, START_PARTS, RARE_RATE, MAX_CYCLES,
  // どの部品も rng を使わない。並びを決めれば結果は一意なので、画面は答えを断定できる。
  deterministic: true,
  MAX_HP: 30, REPAIR_HP: 5, WIN_HEAL: 3, REWARD_CHOICES: 3,
  slotLabel: "継電列",
  slotHint: "周期Pの部品を枠iに置くと (巡回-1)%P === i%P の巡回に作動する。同系統が続くほど倍率が上がる",
  simulateBattle, predictionLevel, outcomeLevel, firesOn, LINES, GRADES, gradeFor,
  // 初期手札の契約。撃3・守2を下限にする。これが無いと1〜2戦目で
  // 「締めると詰み、緩めると全部勝つ」の二択になり、T1とT2が両立しない（測定で判明）。
  startContract: types => {
    const count = line => types.filter(t => PARTS[t].line === line).length;
    return count("strike") >= 3 && count("guard") >= 2;
  },
  enemyView: enemy => ({
    name: enemy.name, hp: enemy.hp, atk: enemy.atk,
    攻撃周期: enemy.atkPeriod, 命中上限: enemy.cap >= 99 ? null : enemy.cap,
    命中下限: enemy.floor || null, 毎巡回復: enemy.regen || null, trait: enemy.trait
  }),
  rules: `【継電機関 / RELAY 0.1 遊び方】
- 部品で機関を組み、6戦を勝ち抜く。操作は構築のみで、戦闘は自動。
- 枠は5つ。周期Pの部品を枠iに置くと (巡回-1)%P === i%P の巡回に作動する（位相）。
- 巡回の中では枠1から順に作動する。
- 【継電】巡回の中で同じ系統（撃／守／整）がn個続いたとき、n個目の効果はn倍。
  系統が変わるとそこで切れて1倍に戻る。自傷には倍率が乗らない。
- 遮蔽は巡回の終わりに消える。敵は自分の攻撃周期の巡回に殴る。
- 【反射】巡回の終わりに使われず残った遮蔽は、その半分が敵へ返る。
  つまり守の部品は、敵の攻撃に合えば盾、外れれば矛になる。
- 12巡で決着しなければ打切り＝負け。
- 勝つと HP+3。戦闘後、3つの候補から1つ受け取る。
- 【等級】戦闘ごとに、失ったHPで 無傷／上々／及第／辛勝 がつく。敵ごとに自己最高が残る。
  **等級を外しても罰は無い。勝ちは勝ちで、ランはそのまま続く。**`
};
