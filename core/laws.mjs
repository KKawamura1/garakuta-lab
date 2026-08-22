// LAWS 0.1「法則機関」— 1つの良い問題ではなく、問題を生む機械。
//
// 【なぜこの形か】RELAY 0.1 は初回の再プレイ度5（企画の記録）を取ったが、6ランで1まで落ちた。
//   作者の診断：「ゲームとしての面白さはまだ残っている。もう一回やっても、もうハイスコアが
//   二度と得られないという張り合いのなさが継続しない最大の理由」。
//   **面白さは作れていた。尽きたのは「始める理由」の方だった。**
//
// 【機構】毎ラン、法則を2つ引く。法則は1行で書ける規則で、機関の動き方を変える。
//   組が変われば最適な並びの「かたち」が変わるので、覚えた型は前提から崩れる。
//   記録も組ごとに持つので、**新しい組には常に未達成の記録がある。天井が退がり続ける。**
//
// 【評価器がゲームの部品になる】どの組を出してよいかは、生成条件（P10のT1〜T3）で
//   事前に検証する。通らない組は出さない。設計時の道具だった評価器が、ここで機械の一部になる。
//
// 中核（5枠・作動周期・枠で決まる位相・決定的・12巡・正確な予告）は RELAY から継承する。
// 作者の評価が高かった部分であり、「読むのは機械、探すのは人」の前提でもある。

import { PARTS, ENEMIES as BASE_ENEMIES, LINES, SLOT_COUNT, START_PARTS, RARE_RATE, MAX_CYCLES, firesOn }
  from "./relay.mjs";

export { PARTS, LINES, SLOT_COUNT, START_PARTS, RARE_RATE, MAX_CYCLES, firesOn };

// 法則。**1行で書けること**が条件（読む重さの上限。解く重さは削らない）。
//
// gain(ctx) は倍率を返す。ctx は、その巡回に作動する枠の集合を先に確定させてから渡すので、
// 「同じ巡回に何個作動するか」を条件にできる。返り値は掛け合わされる。
export const LAWS = {
  relay: {
    name: "継電", desc: "巡回の中で同じ系統がn個続いたとき、n個目の効果はn倍。",
    gain: ctx => ctx.chain
  },
  counter: {
    name: "反継電", desc: "巡回の中で直前と違う系統なら、効果は2倍。",
    gain: ctx => (ctx.position > 0 && ctx.prevLine !== ctx.line ? 2 : 1)
  },
  resonance: {
    name: "共鳴", desc: "同じ巡回に3つ以上作動したら、その巡回の効果はすべて2倍。",
    gain: ctx => (ctx.firingCount >= 3 ? 2 : 1)
  },
  silence: {
    name: "静粛", desc: "直前の巡回に休んでいた枠は、作動するとき効果が2倍。",
    gain: ctx => (ctx.restedLastCycle ? 2 : 1)
  },
  buildup: {
    name: "蓄積", desc: "同じ枠が作動するたび、その枠の効果が1回ぶんずつ増える（2回目は2倍）。",
    gain: ctx => ctx.activationsSoFar
  },
  balance: {
    name: "均衡", desc: "枠に撃・守・整の3系統がそろっているなら、すべての効果が2倍。",
    gain: ctx => (ctx.linesPresent >= 3 ? 2 : 1)
  },
  vanguard: {
    name: "先陣", desc: "その巡回で最初に作動する枠の効果は3倍。",
    gain: ctx => (ctx.position === 0 ? 3 : 1)
  },
  haste: {
    // 逆順（作動順を反転する）は単独では何も変えなかった（効果は互いに独立なので順序が効かない）。
    // 他の法則があって初めて意味を持つ法則は、**組の多様性を偽装する**ので表から外した。
    name: "倍速", desc: "すべての部品の作動周期が1短くなる（最短1）。",
    period: p => Math.max(1, p - 1)
  },
  reflect: {
    name: "反射", desc: "巡回の終わりに残った遮蔽は、半分が敵へ返る。",
    endOfCycle: ({ leftover, applyHit }) => (leftover > 1 ? applyHit(Math.floor(leftover / 2)) : 0)
  },
  // ここから下は**取引の法則**である。下がる条件と、狙えば上がる条件を必ず両方持つ。
  //
  // 最初は「同系統が続くと半分」のような**下がるだけの法則**を4つ置いていた。
  // 天井（無傷の到達率）を下げるために足したもので、遊ぶ側の理由が無かった。
  // 作者の指摘：「その分プラスの効果がないと、単に**ハズレルール**と感じてしまいます」。
  // **評価器の都合が設計に漏れた形**なので、全部「下がるが、条件を作れば上がる」へ組み替えた。
  // `analysis/smoke-laws.mjs` が、どの法則にも倍率1を超える条件があることを検査する。
  overload: {
    name: "過負荷", desc: "同じ巡回に3つ作動なら2倍。4つ以上なら半分。",
    gain: ctx => (ctx.firingCount === 3 ? 2 : ctx.firingCount >= 4 ? 0.5 : 1)
  },
  wear: {
    name: "消耗", desc: "同じ枠は作動するたび1割5分落ちる。1巡休むと2倍で復帰する。",
    gain: ctx => (ctx.restedLastCycle ? 2 : Math.max(0.3, 1 - (ctx.activationsSoFar - 1) * 0.15))
  },
  monotony: {
    name: "単調", desc: "同じ系統の2つ目は半分。3つ目以降は3倍。",
    gain: ctx => (ctx.chain === 2 ? 0.5 : ctx.chain >= 3 ? 3 : 1)
  },
  fade: {
    name: "減衰", desc: "1巡目は3倍。以後1巡ごとに1割ずつ弱くなる。",
    gain: ctx => (ctx.cycle === 1 ? 3 : Math.max(0.2, 1 - (ctx.cycle - 1) * 0.1))
  },
  bias: {
    name: "偏食", desc: "撃の効果は2倍、守と整の効果は半分。",
    gain: ctx => (ctx.line === "strike" ? 2 : 0.5)
  }
};

export const LAW_IDS = Object.keys(LAWS);

function emptyContribution(instance, parts) {
  return {
    id: instance.id, type: instance.type, name: parts[instance.type].name,
    activations: 0, idles: 0, damage: 0, shield: 0, healing: 0
  };
}

// 法則の組を受け取って、その組で動く simulateBattle を作る。
export function makeSimulate(lawIds) {
  const laws = lawIds.map(id => LAWS[id]).filter(Boolean);
  const orderLaw = laws.find(l => l.order)?.order || null;
  const periodLaws = laws.filter(l => l.period);
  const periodOf = part => periodLaws.reduce((p, law) => law.period(p), part.period);
  const gainLaws = laws.filter(l => l.gain);
  const endLaws = laws.filter(l => l.endOfCycle);

  return function simulateBattle({ slots, hp, maxHp, enemy, rng, parts = PARTS }) {
    const battle = { hp, enemyHp: enemy.hp, cycle: 0, uses: {}, rng };
    const contributions = new Map();
    const log = [];
    const activations = new Map();
    let firedLastCycle = new Set();

    const total = instance => {
      if (!contributions.has(instance.id)) contributions.set(instance.id, emptyContribution(instance, parts));
      return contributions.get(instance.id);
    };
    const applyHit = raw => {
      let value = Math.min(Math.round(raw), enemy.cap ?? 99);
      if ((enemy.floor || 0) > 0 && Math.round(raw) < enemy.floor) value = 1;
      value = Math.max(1, value);
      battle.enemyHp -= value;
      return value;
    };

    const linesPresent = new Set(slots.filter(Boolean).map(s => parts[s.type].line)).size;

    while (battle.hp > 0 && battle.enemyHp > 0 && battle.cycle < MAX_CYCLES) {
      battle.cycle += 1;
      let shield = 0;
      let previousLine = null;
      let chain = 0;

      // その巡回に作動する枠を先に確定させる。「同じ巡回に何個作動するか」を条件にできるようにするため。
      let firing = [];
      for (let i = 0; i < slots.length; i += 1) {
        if (slots[i] && firesOn(battle.cycle, i, periodOf(parts[slots[i].type]))) firing.push(i);
      }
      const firingCount = firing.length;
      if (orderLaw) firing = orderLaw(firing);
      const firedThisCycle = new Set(firing);

      slots.forEach((instance, i) => {
        if (instance && !firedThisCycle.has(i)) total(instance).idles += 1;
      });

      for (let n = 0; n < firing.length; n += 1) {
        const i = firing[n];
        const instance = slots[i];
        const part = parts[instance.type];
        const record = total(instance);
        record.activations += 1;
        activations.set(i, (activations.get(i) || 0) + 1);

        chain = previousLine === part.line ? chain + 1 : 1;
        const ctx = {
          part, line: part.line, slotIndex: i, position: n, cycle: battle.cycle,
          prevLine: previousLine, chain, firingCount, linesPresent,
          restedLastCycle: !firedLastCycle.has(i),
          activationsSoFar: activations.get(i)
        };
        previousLine = part.line;

        // 倍率は法則の積。自傷には乗らない（RELAY からの継承）。
        const gain = gainLaws.reduce((acc, law) => acc * law.gain(ctx), 1);

        const delta = part.run({ ...battle, instanceId: instance.id, uses: battle.uses, rng });
        let dealt = 0;
        if (delta.damage) dealt += applyHit(delta.damage * gain);
        if (delta.hits) delta.hits.forEach(h => { if (battle.enemyHp > 0) dealt += applyHit(h * gain); });
        const gained = Math.round((delta.shield || 0) * gain);
        if (gained) shield += gained;
        let healed = 0;
        if (delta.heal) {
          const before = battle.hp;
          battle.hp = Math.min(maxHp, battle.hp + Math.round(delta.heal * gain));
          healed = battle.hp - before;
          record.healing += healed;
        }
        if (delta.selfDamage) battle.hp -= delta.selfDamage;

        record.damage += dealt;
        record.shield += gained;
        log.push({
          cycle: battle.cycle, slot: i, part: part.name, type: instance.type, period: part.period,
          line: LINES[part.line], gain: Number(gain.toFixed(2)), relayed: gain > 1,
          effectivePeriod: periodOf(part),
          text: delta.text, damage: dealt, shieldGained: gained, healed,
          selfDamage: delta.selfDamage || 0,
          after: { shield, enemyHp: Math.max(0, battle.enemyHp), hp: Math.max(0, battle.hp) }
        });
        if (battle.enemyHp <= 0) break;
      }
      firedLastCycle = firedThisCycle;
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

      endLaws.forEach(law => {
        if (battle.enemyHp <= 0) return;
        const dealt = law.endOfCycle({ leftover: shield - blocked, applyHit, battle, enemy });
        if (dealt) {
          log.push({ cycle: battle.cycle, slot: null, part: law.name, type: "law",
            text: `${law.name}：${dealt}返した`, damage: dealt,
            after: { shield: 0, enemyHp: Math.max(0, battle.enemyHp), hp: Math.max(0, battle.hp) } });
        }
      });

      if (enemy.regen && battle.enemyHp > 0) {
        battle.enemyHp = Math.min(enemy.hp, battle.enemyHp + enemy.regen);
        log.push({ cycle: battle.cycle, slot: null, part: enemy.name, type: "enemy",
          text: `${enemy.regen}回復した`,
          after: { shield: 0, enemyHp: battle.enemyHp, hp: Math.max(0, battle.hp) } });
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
  };
}

// 敵ごとに別の倍率をかける。**一様な倍率では生成条件が通らない**ことが実測で分かっている
// （全45組が「締めると詰み」になった。RELAY 0.1 の実効比も 9.6/3.4/3.7/3.7/3.3/1.6 と一様ではない）。
// 敵の説明文は数値から作る。
//
// RELAY で一度やった失敗の再発防止である：敵を調律したのに説明文だけ古いまま残り、
// 「毎巡7」と書いてある敵が22殴ってくる状態になっていた。
// 法則機関では組ごとに数値が変わるので、**手で書いた説明文は必ずずれる。**
function traitFor(enemy) {
  const bits = [];
  bits.push(enemy.atkPeriod > 1 ? `${enemy.atkPeriod}巡に1回、${enemy.atk}の一撃。` : `毎巡${enemy.atk}。`);
  if (enemy.cap < 99) bits.push(`1回の命中は${enemy.cap}までしか通らない。大きい一撃ほど無駄が出る。`);
  if (enemy.floor) bits.push(`${enemy.floor}未満の命中は1に潰される。小突きが通らない。`);
  if (enemy.regen) bits.push(`さらに毎巡${enemy.regen}回復する。削る速さと耐える力の両方が要る。`);
  if (enemy.atk >= 30) bits.push("素のHPでは受け切れない。来る巡回に遮蔽を合わせるしかない。");
  return bits.join("");
}

export function scaleEnemies(scales, atkScales) {
  const list = Array.isArray(scales) ? scales : BASE_ENEMIES.map(() => scales);
  const atks = Array.isArray(atkScales) ? atkScales : BASE_ENEMIES.map(() => atkScales ?? 1);
  return BASE_ENEMIES.map((enemy, i) => {
    const scaled = {
      ...enemy,
      hp: Math.max(20, Math.round(enemy.hp * (list[i] ?? 1))),
      atk: Math.max(1, Math.round(enemy.atk * (atks[i] ?? 1))),
      regen: enemy.regen ? Math.max(1, Math.round(enemy.regen * (list[i] ?? 1))) : enemy.regen
    };
    return { ...scaled, trait: traitFor(scaled) };
  });
}

export const BASE = BASE_ENEMIES;

export const PREDICTIONS = ["負けそう", "ギリギリ", "勝てそう", "圧勝"];
export const WORRY_CATEGORIES = ["位相", "法則", "火力", "遮蔽", "耐久", "回復", "選択肢", "なし"];
export const UPDATE_KINDS = ["confirmed", "revalued_existing", "new_plan", "none"];
export const MARKER_KINDS = ["hit", "insight", "choice", "payoff", "friction", "unclear"];

export function predictionLevel(prediction) { return PREDICTIONS.indexOf(prediction); }
export function outcomeLevel(won, hp, cycles = 0) {
  if (!won) return 0;
  if (hp <= 8 || cycles >= MAX_CYCLES - 1) return 1;
  if (hp <= 20 || cycles >= Math.ceil(MAX_CYCLES * 0.65)) return 2;
  return 3;
}

// 等級。**天井は組ごとに別なので、更新できる記録が尽きない**（P12）。
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

// 法則の組から、遊べるルールセットを組み立てる。
// 敵の強さ（scale）は事前検証で決めた値をそのまま使う。ここで調整はしない。
export function makeLawRuleset(lawIds, scales, atkScales) {
  const laws = lawIds.map(id => ({ id, ...LAWS[id] }));
  const enemies = scaleEnemies(scales, atkScales);
  return {
    id: `laws-0.1:${lawIds.join("+")}`,
    variantId: lawIds.join("+"),
    laws,
    title: `法則機関 / ${laws.map(l => l.name).join("＋")}`,
    conceptsToHold: ["HP", "遮蔽は巡回の終わりに消える", "部品ごとの作動周期", "枠で位相がずれる（剰余）",
      ...laws.map(l => l.name), "敵の攻撃周期", "敵の修飾は1体1つ"],
    placementRule: "位相（作動巡回）と、法則が見る並びの関係",
    PARTS, ENEMIES: enemies, PREDICTIONS, WORRY_CATEGORIES, UPDATE_KINDS, MARKER_KINDS,
    SLOT_COUNT, START_PARTS, RARE_RATE, MAX_CYCLES,
    deterministic: true,
    MAX_HP: 30, REPAIR_HP: 5, WIN_HEAL: 3, REWARD_CHOICES: 3,
    slotLabel: "位相列",
    slotHint: "周期Pの部品を枠iに置くと (巡回-1)%P === i%P の巡回に作動する",
    simulateBattle: makeSimulate(lawIds),
    // 位相表が実際の作動巡回を描けるように、法則が変えた周期を外へ出す。
    periodOf: part => lawIds.map(id => LAWS[id]).filter(l => l && l.period)
      .reduce((p, law) => law.period(p), part.period),
    predictionLevel, outcomeLevel, firesOn, LINES, GRADES, gradeFor,
    startContract: types => {
      const count = line => types.filter(t => PARTS[t].line === line).length;
      return count("strike") >= 3 && count("guard") >= 2;
    },
    enemyView: enemy => ({
      name: enemy.name, hp: enemy.hp, atk: enemy.atk,
      攻撃周期: enemy.atkPeriod, 命中上限: enemy.cap >= 99 ? null : enemy.cap,
      命中下限: enemy.floor || null, 毎巡回復: enemy.regen || null, trait: enemy.trait
    }),
    rules: `【法則機関 / LAWS 0.1 遊び方】
- 部品で機関を組み、6戦を勝ち抜く。操作は構築のみで、戦闘は自動。
- 枠は5つ。周期Pの部品を枠iに置くと (巡回-1)%P === i%P の巡回に作動する（位相）。
- 巡回の中では枠1から順に作動する。
- 遮蔽は巡回の終わりに消える。敵は自分の攻撃周期の巡回に殴る。12巡で決着しなければ敗北。
- 勝つと HP+3。戦闘後、3つの候補から1つ受け取る。
- 等級（無傷／上々／及第／辛勝）がつく。**外しても罰は無い。**

【このランの法則】${laws.map(l => `\n- 【${l.name}】${l.desc}`).join("")}

法則はランごとに変わる。**組が変われば、最適な並びも、狙える記録も別物になる。**`
  };
}
