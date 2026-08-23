// LAWS 0.3「法則機関」— 1つの良い問題ではなく、問題を生む機械。
//
// 【0.1 からの変更】規則が実質変わったので版を上げた。**版を据え置くと記録が混ざる。**
//   - 敵に「1巡に通る合計の上限」を入れた。0.1 では24戦中20戦が1巡で決着しており、
//     敵は巡回の終わりに殴るので**1巡で倒せば一度も攻撃されない**（1巡決着の85%が無傷、
//     2巡以上は0%）。周期も位相ずれも12巡の打切りも、第2戦以降まるごと迂回されていた。
//   - 偏食（撃×2、守整×0.5）を削除した。部品選択の法則であり、
//     企画の出発点「部品選択はゆるめに」に反していた。作者の4ラン全部で否定された。
//   - 天井（P12-b）を通さないまま出している（作者の判断。agents/PROTOCOL.md の逸脱記録）。
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
  // 【削除した法則：偏食（撃×2、守と整×0.5）】
  // 作者の4ラン全部で否定された。「火力以外の手段が否定されてつまらなかった」
  // 「偏食はクソゲーとわかったラン」「このルール、火力しか使えねえ。やるかやられるかだ」。
  //
  // **これは部品選択の法則だった。** この企画の出発点は
  // 「並びはきつめに、**部品選択はゆるめに**」であり、ゆるめる側を締めていた。
  // 上振れ（撃×2）を持つので「ハズレ法則の禁止」は素通りする。**上振れがあることと、
  // 選択肢が残ることは別の量である。** 倍率が部品の素性だけで決まる法則は、ここには置かない。
  //
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
// 位相を外した作動判定。**T3（並び順が効く）の Recall テスト用。**
//
// 位相こそが「並び順が効く」の本体である。周期Pの部品を枠iに置くと (巡回-1)%P === i%P の
// 巡回に作動する、という規則が、同じ持ち物でも並べ方で結果を変えている。
// 法則を順序非依存のもの（共鳴＝作動数、均衡＝系統が揃っているか）に替えるだけでは足りず、
// **枠の意味そのものを消さないと T3 は破れない。**
// こちらでは、周期Pの部品はどの枠にあっても同じ巡回（1, 1+P, 1+2P …）に作動する。
export function firesOnFlat(cycle, slotIndex, period) {
  return (cycle - 1) % period === 0;
}

// **暴走**（`overdrive`）。速さが安全を買えなくする仕掛け。
//
// いまの骨格では、敵は巡回の終わりに殴り、**とどめの巡回では殴ってこない**（学び#54）。
// つまり「受ける攻撃の回数 ＝ 生き延びた巡回の数」で、**速く倒すことがそのまま防御**である。
// 実測でも、並びの速さ順位と安全さ順位の相関は**どの法則の組でも正のまま**だった
// （`analysis/TRADEOFF.md`。敵を強くしても相関は動かず、無傷が珍しくなるだけ）。
//
// 暴走は、**1巡に出した力が閾値を超えたら、超過分の一部を自分が受ける。**
// 遮蔽で受け止められるので、遮蔽が「敵の一撃」と「自分の暴走」に**取り合いになる。**
// **とどめの巡回でも起こる。**ここを免除すると、速く倒すことがまた無料になり、代償が消える。
export function makeSimulate(lawIds, { phaseless = false, overdrive = null } = {}) {
  const fires = phaseless ? firesOnFlat : firesOn;
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
    // 1巡に通る合計ダメージの上限。**これが無いと、位相の仕組みが丸ごと迂回される。**
    //
    // 実測（作者の4ラン）：24戦中20戦が1巡で決着し、そのうち85%が無傷だった。
    // 敵は巡回の終わりに殴るので、**1巡で倒せば敵は一度も攻撃しない。**
    // つまり無傷は防御で取られていたのではなく、敵の行動前に殺すことで取られていた。
    // 2巡以上かかった4戦の無傷は0%である。
    // 周期も位相ずれも12巡の打切りも、1巡で終わる戦闘では何の意味も持たない。
    let dealtThisCycle = 0;
    // 暴走の閾値は敵ごと。**1巡に通せる上限に対する割合**で決めるので、
    // 敵が大きくなっても「出しすぎ」の意味が変わらない。
    const overdriveThreshold = overdrive
      ? Math.max(1, Math.round((enemy.cycleCap || enemy.hp) * overdrive.frac)) : 0;
    const applyHit = raw => {
      let value = Math.min(Math.round(raw), enemy.cap ?? 99);
      if ((enemy.floor || 0) > 0 && Math.round(raw) < enemy.floor) value = 1;
      value = Math.max(1, value);
      if (enemy.cycleCap) value = Math.max(0, Math.min(value, enemy.cycleCap - dealtThisCycle));
      dealtThisCycle += value;
      battle.enemyHp -= value;
      return value;
    };

    const linesPresent = new Set(slots.filter(Boolean).map(s => parts[s.type].line)).size;

    while (battle.hp > 0 && battle.enemyHp > 0 && battle.cycle < MAX_CYCLES) {
      battle.cycle += 1;
      dealtThisCycle = 0;
      let shield = 0;
      let previousLine = null;
      let chain = 0;

      // その巡回に作動する枠を先に確定させる。「同じ巡回に何個作動するか」を条件にできるようにするため。
      let firing = [];
      for (let i = 0; i < slots.length; i += 1) {
        if (slots[i] && fires(battle.cycle, i, periodOf(parts[slots[i].type]))) firing.push(i);
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

      // **暴走は、敵の生死より先に判定する。**
      // ここを `enemyHp <= 0` の後ろに置くと、1巡で倒し切った並びだけが代償を免れ、
      // 「速ければ無料」がそのまま戻ってくる。それでは何も変わらない。
      if (overdrive && dealtThisCycle > overdriveThreshold) {
        const excess = dealtThisCycle - overdriveThreshold;
        const raw = Math.max(1, Math.ceil(excess * overdrive.rate));
        const absorbed = Math.min(shield, raw);
        shield -= absorbed;
        const through = raw - absorbed;
        battle.hp -= through;
        log.push({ cycle: battle.cycle, slot: null, part: "暴走", type: "law",
          text: `暴走：${dealtThisCycle}出して${overdriveThreshold}超過、遮蔽で${absorbed}受け止め、HPへ${through}`,
          blocked: absorbed, hpDamage: through,
          after: { shield, enemyHp: Math.max(0, battle.enemyHp), hp: Math.max(0, battle.hp) } });
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
export const CYCLE_CAP_RATIO = 1 / 3;

function traitFor(enemy) {
  const bits = [];
  if (enemy.cycleCap) bits.push(`1巡に通るのは合計${enemy.cycleCap}まで。最低${Math.ceil(enemy.hp / enemy.cycleCap)}巡かかる。`);
  bits.push(enemy.atkPeriod > 1 ? `${enemy.atkPeriod}巡に1回、${enemy.atk}の一撃。` : `毎巡${enemy.atk}。`);
  if (enemy.cap < 99) bits.push(`1回の命中は${enemy.cap}までしか通らない。大きい一撃ほど無駄が出る。`);
  if (enemy.floor) bits.push(`${enemy.floor}未満の命中は1に潰される。小突きが通らない。`);
  if (enemy.regen) bits.push(`さらに毎巡${enemy.regen}回復する。削る速さと耐える力の両方が要る。`);
  if (enemy.atk >= 30) bits.push("素のHPでは受け切れない。来る巡回に遮蔽を合わせるしかない。");
  return bits.join("");
}

// 命中上限（cap）と命中下限（floor）も振る。
//
// これは範囲の追加であって、閾値の緩和ではない。理由：**上限と下限は「1回の命中の大きさ」への
// 条件だが、法則はまさにその大きさを掛け算で動かす。** 継電（×n）や単調（×3）の下では
// 環甲の上限14は RELAY のときより遥かに強く効き、逆に鋼芯の下限10はほとんど効かない。
// 素の値のままだと、環甲だけがどの組でも帯（T2）に入らず、**91組すべてがそこで落ちた。**
// 敵の性格を組ごとに保つには、性格を決めている数値も一緒に振るしかない。
// **締めつけ**（`squeeze`）。敵が毎巡回復するので、**遅く行くと削り切れない。**
//
// 暴走だけでは代償が請求されない場面がある。実測（`analysis/run-viability.mjs`）：
// 失点が最小になる並びを選び続けると **48回中46回完走、平均残HP 30.0**——
// つまり**遅く行けば無傷でいられる。**代償は速さを欲しがったときだけ請求されていた。
//
// Into the Breach の形（「全部は守れない」）にするには、**遅い方も塞ぐ**必要がある。
// 毎巡回復は「速く削らないと勝てない」を作り、暴走は「速く削ると自分が削れる」を作る。
// 両側から挟むと、**どちらかを諦める以外に道が無くなる。**
export function scaleEnemies(scales, atkScales, modScales, cycleCaps, regenFrac = 0) {
  const list = Array.isArray(scales) ? scales : BASE_ENEMIES.map(() => scales);
  const atks = Array.isArray(atkScales) ? atkScales : BASE_ENEMIES.map(() => atkScales ?? 1);
  const mods = Array.isArray(modScales) ? modScales : BASE_ENEMIES.map(() => modScales ?? 1);
  const caps = Array.isArray(cycleCaps) ? cycleCaps : BASE_ENEMIES.map(() => cycleCaps);
  return BASE_ENEMIES.map((enemy, i) => {
    const mod = mods[i] ?? 1;
    const scaled = {
      ...enemy,
      hp: Math.max(20, Math.round(enemy.hp * (list[i] ?? 1))),
      atk: Math.max(1, Math.round(enemy.atk * (atks[i] ?? 1))),
      cap: enemy.cap < 99 ? Math.max(2, Math.round(enemy.cap * mod)) : enemy.cap,
      // 1巡に通る合計の上限。**HPに対する比で持つので、敵を調律しても最低巡回数が変わらない。**
      // 1/3 なら、どんな並びでも倒すのに最低4巡かかる。
      cycleCap: caps[i] ?? Math.max(4, Math.round(enemy.hp * (list[i] ?? 1) * CYCLE_CAP_RATIO)),
      floor: enemy.floor ? Math.max(2, Math.round(enemy.floor * mod)) : enemy.floor,
      regen: regenFrac > 0
        ? Math.max(1, Math.round(enemy.hp * (list[i] ?? 1) * regenFrac))
        : (enemy.regen ? Math.max(1, Math.round(enemy.regen * (list[i] ?? 1))) : enemy.regen)
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

// **速さで付ける等級。**
//
// 作者の感情マーカーが、登録した最上位等級（無傷）ではなく**撃破巡回**を指していた：
//   「巡数更新オウケーイ」「作戦勝ちで5ターン勝利！アツい」「さすがに理論値では？？」
//   最良の瞬間は「何巡で達成するかも保存されてると途中で気づいて、記録をもっと詰めたくなった」。
// **何を最上位に置くかで、狙う対象が変わるのではないか**を試すための等級である。
//
// 閾値は実測で決めた。同じ盤面で、勝てた並びのうち
//   無傷 50.1% / 上々 69.7% / 及第 82.8%
//   7巡以内 46.0% / 8巡以内 63.4% / 9巡以内 79.5%
// **珍しさを揃えてある。**片側だけ最上位が簡単だと、比べているものが変わってしまう。
export const SPEED_GRADES = [
  { rank: 4, label: "電光", maxCycles: 7 },
  { rank: 3, label: "迅速", maxCycles: 8 },
  { rank: 2, label: "順当", maxCycles: 9 },
  { rank: 1, label: "辛勝", maxCycles: Infinity }
];

export function gradeFor(won, hpLost) {
  if (!won) return { rank: 0, label: "敗北" };
  return GRADES.find(g => hpLost <= g.maxLost);
}
export function speedGradeFor(won, hpLost, cycles) {
  if (!won) return { rank: 0, label: "敗北" };
  return SPEED_GRADES.find(g => cycles <= g.maxCycles);
}

// 法則の組から、遊べるルールセットを組み立てる。
// 敵の強さ（scale）は事前検証で決めた値をそのまま使う。ここで調整はしない。
// 出荷する暴走の設定。**画面と検査が同じものを見るように、ここ1か所に置く。**
// 「1巡上限の半分を超えたら、超えた分がそのまま返る」＝暗算できる形。
// 実測：相関 +0.30 → −0.26、詰みなし100%（`analysis/TRADEOFF.md`）。
export const OVERDRIVE = { frac: 0.5, rate: 1.0 };

export function makeLawRuleset(lawIds, scales, atkScales, modScales, cycleCaps, options = {}) {
  const phaseless = Boolean(options.phaseless);
  const bySpeed = options.gradeBy === "speed";
  const overdrive = options.overdrive || null;
  // **同定の版**（型2、`analysis/KNOWLEDGE_SURVEY.md`）。法則の名前と説明を伏せる。
  // NetHack の「赤い薬が何かは毎回違う」と同じで、**覚えるのは事実ではなく確かめ方**になる。
  // 尽きる未知（初見だけ）ではなく、**毎ラン引き直される未知**である。
  const hidden = Boolean(options.hidden);
  // **連勝機関**（作者の提案、0.5節）。同じ並びのまま次も勝てるなら戦闘を飛ばす。
  // 報酬は時間が浮くことだけで、ゲーム内の見返りは与えない。
  const skipWins = Boolean(options.skipWins);
  const regenFrac = Number(options.regenFrac || 0);
  // **版の名札と版のIDは、同じ1か所から作る。**別々に書くと片方だけ直して食い違う。
  const versionTag = regenFrac > 0 && overdrive ? "squeeze-0.1"
    : overdrive ? "cost-0.1" : hidden ? "ident-0.2" : skipWins ? "skip-0.2" : "laws-0.4";
  const versionName = regenFrac > 0 && overdrive ? "締付機関"
    : overdrive ? "代償機関" : hidden ? "同定機関" : skipWins ? "連勝機関" : "法則機関";
  const laws = lawIds.map(id => ({ id, ...LAWS[id] }));
  // 戦闘数を減らせるようにする。**対で比べるときは1本を短くしないと、作者の時間が倍要る。**
  // 3戦なら、いままで1ラン遊んでいた時間で対が1つ回る。
  const all = scaleEnemies(scales, atkScales, modScales, cycleCaps, regenFrac);
  const enemies = options.enemyCount ? all.slice(0, options.enemyCount) : all;
  return {
    id: `${versionTag}:${lawIds.join("+")}`,
    hidden, skipWins,
    // **画面に出してよい版の名前。**
    // 見出しは `rules.id` をそのまま出していたので、伏せた版でも
    // `ident-0.1:reflect+monotony` と**答えが書いてあった。**
    // 記録や通報には法則入りの id を使い続ける（あとで突き合わせるのに要る）。
    publicId: hidden ? `${versionTag}（法則は伏せてある）` : null,
    variantId: lawIds.join("+"),
    laws,
    // **版の名前は、版ごとに変える。**
    // ここが「法則機関」に固定されていたので、見出しも遊び方も全部の版で同じ文言になり、
    // 作者の報告どおり「変わってるのか変わってないのか分からない」状態だった。
    // 小さなIDだけが変わっていて、目に入る大きな文字は一つも変わっていなかった。
    title: `${versionName} / ${hidden ? "？？？" : laws.map(l => l.name).join("＋")}`,
    conceptsToHold: ["HP", "遮蔽は巡回の終わりに消える", "部品ごとの作動周期", "枠で位相がずれる（剰余）",
      ...laws.map(l => l.name), "敵の攻撃周期", "敵の修飾は1体1つ"],
    placementRule: "位相（作動巡回）と、法則が見る並びの関係",
    PARTS, ENEMIES: enemies, PREDICTIONS, WORRY_CATEGORIES, UPDATE_KINDS, MARKER_KINDS,
    SLOT_COUNT, START_PARTS, RARE_RATE, MAX_CYCLES,
    deterministic: true,
    MAX_HP: 30, REPAIR_HP: 5, WIN_HEAL: 3, REWARD_CHOICES: 3,
    slotLabel: "位相列",
    // 暴走があるなら、握っておくものが1つ増える。**隠すと理不尽になる。**
    ...(regenFrac > 0 ? { regenHint: `敵は毎巡、最大HPの${(regenFrac * 100).toFixed(1)}%を回復する。遅いと削り切れない` } : {}),
    ...(overdrive ? { overdriveHint: `1巡に${Math.round(overdrive.frac * 100)}%（1巡上限に対して）を超えて出すと、超過分の${Math.round(overdrive.rate * 100)}%が自分へ返る。遮蔽で受け止められる` } : {}),
    slotHint: phaseless
      ? "周期Pの部品は、どの枠にあっても 1, 1+P, 1+2P … 巡目に作動する（枠の位置は作動巡回に影響しない）"
      : "周期Pの部品を枠iに置くと (巡回-1)%P === i%P の巡回に作動する",
    phaseless,
    simulateBattle: makeSimulate(lawIds, { phaseless, overdrive }),
    overdrive,
    // 位相表が実際の作動巡回を描けるように、法則が変えた周期を外へ出す。
    periodOf: part => lawIds.map(id => LAWS[id]).filter(l => l && l.period)
      .reduce((p, law) => law.period(p), part.period),
    predictionLevel, outcomeLevel, firesOn: phaseless ? firesOnFlat : firesOn, LINES,
    gradeBy: bySpeed ? "speed" : "damage",
    GRADES: bySpeed ? SPEED_GRADES : GRADES,
    gradeFor: bySpeed ? speedGradeFor : gradeFor,
    startContract: types => {
      const count = line => types.filter(t => PARTS[t].line === line).length;
      // **整も1枚は保証する。** 均衡は「撃・守・整がそろっているなら2倍」だが、
      // 契約が撃3・守2しか保証していなかったので、**整が1枚も来ない局面が3割あり、
      // そこでは達成する手段が無かった**（作者の報告：「ルールが均衡なのに達成する手段がない」）。
      // 契約はもともと生成条件を両立させるために置いてある。条件を足したなら契約も直す。
      return count("strike") >= 3 && count("guard") >= 2 && count("service") >= 1;
    },
    enemyView: enemy => ({
      name: enemy.name, hp: enemy.hp, atk: enemy.atk,
      攻撃周期: enemy.atkPeriod, 命中上限: enemy.cap >= 99 ? null : enemy.cap,
      命中下限: enemy.floor || null, 毎巡上限: enemy.cycleCap || null,
      毎巡回復: enemy.regen || null, trait: enemy.trait
    }),
    rules: `【${versionName} ${versionTag} 遊び方】
- 部品で機関を組み、6戦を勝ち抜く。操作は構築のみで、戦闘は自動。
- 枠は5つ。${phaseless
  ? "周期Pの部品は、どの枠にあっても 1, 1+P, 1+2P … 巡目に作動する。"
  : "周期Pの部品を枠iに置くと (巡回-1)%P === i%P の巡回に作動する（位相）。"}
- 巡回の中では枠1から順に作動する。
- 遮蔽は巡回の終わりに消える。敵は自分の攻撃周期の巡回に殴る。12巡で決着しなければ敗北。
- **敵には「1巡に通る合計の上限」がある。**一撃で倒し切ることはできないので、殴られる巡回が必ず来る。
- 勝つと HP+3。戦闘後、3つの候補から1つ受け取る。${overdrive ? `
- **暴走：1巡に出した力が「その敵の1巡上限の半分」を超えると、超えた分がそのまま自分へ返る。**
  遮蔽で受け止められる。とどめの巡回でも起こる。**速く倒すほど、自分が削れる。**` : ""}${regenFrac > 0 ? `
- **敵は毎巡、最大HPの${(regenFrac * 100).toFixed(1)}%を回復する。遅いと削り切れない。**
  速く出せば暴走で自分が削れ、遅く行けば敵が回復する。**どちらかを諦めることになる。**` : ""}${skipWins ? `
- **触らずに次も勝てるなら、その戦闘は飛ばす（N strike!）。**
  ゲーム内の見返りは無く、浮くのは時間だけ。失ったHPはそのまま入る。` : ""}${hidden ? `
- **このランの法則は伏せてある。**並べて、予告の数字が素の合計とどうずれるかを見て当てる。
  外しても罰は無い。何度でも言える。` : ""}
- 等級（${bySpeed ? "電光／迅速／順当／辛勝＝**何巡で倒したか**" : "無傷／上々／及第／辛勝＝**どれだけ削られずに勝ったか**"}）がつく。**外しても罰は無い。**

【このランの法則】${hidden
  ? "\n- **伏せてある。**遊び方の画面にも書かない。並べて、結果から当てること。"
  : laws.map(l => `\n- 【${l.name}】${l.desc}`).join("")}

法則はランごとに変わる。**組が変われば、最適な並びも、狙える記録も別物になる。**`
  };
}
