import { makeRng } from "./rng.mjs";

// BUS 0.2「帯域機関」
//
// 0.1 は「防御を有料にする」ことで装甲一択を崩そうとして、失敗した。
// 遮蔽板が60ラン中45ランで首位になり、ARC 0.1（0.417）より収束が強くなった（0.75）。
//
// 原因は、防御が無料だったことではなく **生存そのものが乗数** だったことにある。
// HPが尽きたら終わる以上、1巡生き延びれば列1本分の出力がまるごと増える。
// 帯域を払ってでも遮蔽を買うほうが得になる。
//
// 0.2 では制限巡回を入れて、生存の乗数を壊した。遮蔽板の首位は45/60から6/60へ落ちた。
// しかし支配が消えたのではなく、防御から火力へ移っただけだった（双撃腕と重鎚で50/60）。
//
// ここから読めたのは、**勝利条件がひとつしかない限り、支配軸もひとつになる** ということ。
// 0.3 は敵ごとに問いを変える。
//   - 撃破型：制限巡回のうちに削り切る。火力が要る。
//   - 耐久型：制限巡回のあいだ生き延びれば勝ち。削り切る必要がない。遮蔽と回復が要る。
// 一つの構成で両方は満たせないので、どちらへ寄せるか・報酬で何を補うかが判断になる想定。

export const RULESET_ID = "bus-0.3";
export const MAX_CYCLES = 12;
export const SLOT_COUNT = 5;
export const START_PARTS = 8;
export const RARE_RATE = 0.12;
export const BASE_BUS = 5;

export const PARTS = {
  tack: {
    name: "打鋲機", icon: "·", cost: 1, short: "安い連打", tags: ["攻撃", "軽量"],
    desc: "帯域1で3ダメージ。安いので帯域が細っても最後まで動く。",
    run: () => ({ damage: 3, text: "鋲を撃ち込んだ" })
  },
  hammer: {
    name: "重鎚", icon: "▮", cost: 3, short: "高い一撃", tags: ["攻撃", "重量"],
    desc: "帯域3で9ダメージ。一撃が大きいぶん、帯域を大きく食う。",
    run: () => ({ damage: 9, text: "重鎚を叩きつけた" })
  },
  awl: {
    name: "貫錐", icon: "↗", cost: 2, short: "減衰を無視", tags: ["攻撃", "貫通"],
    desc: "帯域2で5ダメージ。敵の減衰と上限を受けない。",
    run: () => ({ damage: 5, pierce: true, text: "隙間へ錐をねじ込んだ" })
  },
  rig: {
    name: "拡張架", icon: "╫", cost: 1, short: "帯域を広げる", tags: ["帯域"],
    desc: "帯域1を払い、この巡回の帯域を3増やす。差引で＋2。前に置くほど効く。",
    run: () => ({ bus: 3, text: "架を伸ばして帯域を広げた" })
  },
  plate: {
    name: "遮蔽板", icon: "▤", cost: 2, short: "この巡回だけ守る", tags: ["防御"],
    desc: "帯域2で遮蔽5。遮蔽は巡回の終わりに消える。毎回買い直す。",
    run: () => ({ shield: 5, text: "板を立てた" })
  },
  mirror: {
    name: "反射鏡", icon: "◺", cost: 2, short: "守って撃ち返す", tags: ["防御", "攻撃"],
    desc: "帯域2で遮蔽3。この巡回に反撃を受けると、敵へ4ダメージ返す。",
    run: () => ({ shield: 3, reflect: 4, text: "鏡面を敵へ向けた" })
  },
  splitter: {
    name: "分配器", icon: "⋔", cost: 1, short: "次を安くする", tags: ["帯域", "連携"],
    desc: "帯域1で、直後の部品の帯域費を2下げる（最低1）。重い部品の前に置く。",
    run: () => ({ discount: 2, text: "配管を次へ分けた" })
  },
  vent: {
    name: "逆流弁", icon: "◇", cost: 1, short: "余りを攻撃へ", tags: ["攻撃", "帯域"],
    desc: "帯域1。巡回の終わりに余った帯域1につき2ダメージ。埋めずに空ける構えになる。",
    run: () => ({ vent: 2, text: "逆流弁を開いた" })
  },
  drum: {
    name: "蓄圧筒", icon: "◍", cost: 1, short: "3回ためて放出", tags: ["攻撃", "蓄積"],
    desc: "帯域1で圧を1ためる。3たまると即座に14ダメージを放って0へ戻る。",
    run: s => {
      const charge = (s.uses[s.instanceId] || 0) + 1;
      s.uses[s.instanceId] = charge >= 3 ? 0 : charge;
      return charge >= 3
        ? ({ damage: 14, text: "圧を一気に放出した" })
        : ({ text: `圧を${charge}まで溜めた` });
    }
  },
  coil: {
    name: "冷却環", icon: "≡", cost: 2, short: "耐久を戻す", tags: ["回復"],
    desc: "帯域2でHPを4回復する。攻撃も守りもしないが、削られた分を買い戻せる。",
    run: () => ({ heal: 4, text: "熱を逃がして機体を整えた" })
  },
  twin: {
    name: "双撃腕", icon: "⋈", cost: 4, short: "最重量", tags: ["攻撃", "重量"],
    desc: "帯域4で6ダメージを2回。減衰は各回にかかる。帯域を広げないと動かない。",
    run: () => ({ hits: [6, 6], text: "二連撃を放った" })
  },
  surge: {
    name: "過負荷炉", icon: "✸", cost: 2, short: "無理に広げる", rare: true, tags: ["帯域", "レア"],
    desc: "帯域2を払い、この巡回の帯域を6増やす。差引で＋4だが、自分に2ダメージ。",
    run: () => ({ bus: 6, selfDamage: 2, text: "炉を過負荷で回した" })
  }
};

// goal: "kill" = 制限巡回のうちに削り切る / "survive" = 制限巡回を耐え切れば勝ち
export const ENEMIES = [
  { name: "試験球", face: "○", goal: "kill", hp: 20, atk: 4, soak: 0, cap: 99, window: 4,
    trait: "撃破：4巡以内に20を削る。帯域の配り方を確かめる相手。" },
  { name: "落盤帯", face: "▓", goal: "survive", hp: 999, atk: 5, soak: 0, cap: 99, window: 3,
    trait: "耐久：削る必要はない。3巡のあいだ毎巡5の落石に耐えれば勝ち。" },
  { name: "鈍甲亀", face: "▰", goal: "kill", hp: 30, atk: 5, soak: 3, cap: 99, window: 5,
    trait: "撃破：各命中から3を減らす。5巡以内。小さい打撃ほど損をする。" },
  { name: "分散膜", face: "◫", goal: "kill", hp: 34, atk: 5, soak: 0, cap: 6, window: 5,
    trait: "撃破：1回の命中は6までしか通らない。5巡以内。大きい一撃ほど無駄が出る。" },
  { name: "圧潰坑", face: "▨", goal: "survive", hp: 999, atk: 5, soak: 0, cap: 99, strikes: 2, window: 4,
    trait: "耐久：4巡のあいだ、毎巡5が2回来る。削っても止まらない。" },
  { name: "再生核", face: "◉", goal: "kill", hp: 44, atk: 6, soak: 2, cap: 99, regen: 3, window: 6,
    trait: "撃破：巡回ごとに3回復する。6巡以内に押し切れるか。" }
];

export const PREDICTIONS = ["負けそう", "ギリギリ", "勝てそう", "圧勝"];
export const WORRY_CATEGORIES = ["帯域", "火力", "遮蔽", "耐久", "順番", "選択肢", "なし"];
export const UPDATE_KINDS = ["confirmed", "revalued_existing", "new_plan", "none"];
export const MARKER_KINDS = ["hit", "insight", "choice", "payoff", "friction", "unclear"];

export function predictionLevel(prediction) { return PREDICTIONS.indexOf(prediction); }

export function outcomeLevel(won, hp) {
  if (!won) return 0;
  if (hp <= 10) return 1;
  if (hp < 24) return 2;
  return 3;
}

function emptyContribution(instance) {
  return {
    id: instance.id, type: instance.type, name: PARTS[instance.type].name,
    activations: 0, idles: 0, damage: 0, shield: 0, busMade: 0, busSpent: 0, healing: 0
  };
}

export function simulateBattle({ slots, hp, maxHp, enemy, rng }) {
  const battle = { hp, enemyHp: enemy.hp, cycle: 0, uses: {}, rng };
  const contributions = new Map();
  const log = [];
  let drained = 0;

  const total = instance => {
    if (!contributions.has(instance.id)) contributions.set(instance.id, emptyContribution(instance));
    return contributions.get(instance.id);
  };

  const applyHit = (raw, pierce) => {
    let value = raw;
    if (!pierce) {
      value = Math.min(value, enemy.cap ?? 99);
      value = Math.max(1, value - (enemy.soak || 0));
    }
    battle.enemyHp -= value;
    return value;
  };

  const window = Math.min(enemy.window || MAX_CYCLES, MAX_CYCLES);
  while (battle.hp > 0 && battle.enemyHp > 0 && battle.cycle < window) {
    battle.cycle += 1;
    drained = Math.min(3, drained + (enemy.drain || 0));
    let bus = Math.max(1, BASE_BUS - drained);
    let shield = 0;
    let reflect = 0;
    let vent = 0;
    let discount = 0;

    for (let i = 0; i < slots.length; i += 1) {
      const instance = slots[i];
      if (!instance) continue;
      const part = PARTS[instance.type];
      const cost = Math.max(1, part.cost - discount);
      discount = 0;
      const record = total(instance);
      if (cost > bus) {
        record.idles += 1;
        log.push({ cycle: battle.cycle, slot: i, part: part.name, type: instance.type, idle: true, cost,
          text: `帯域${cost}が要るが残り${bus}で動けない`, after: { bus, shield, enemyHp: Math.max(0, battle.enemyHp), hp: Math.max(0, battle.hp) } });
        continue;
      }
      bus -= cost;
      record.activations += 1;
      record.busSpent += cost;

      const context = { ...battle, instanceId: instance.id, uses: battle.uses, rng };
      const delta = part.run(context);
      let dealt = 0;
      if (delta.damage) dealt += applyHit(delta.damage, delta.pierce);
      if (delta.hits) delta.hits.forEach(h => { if (battle.enemyHp > 0) dealt += applyHit(h, delta.pierce); });
      if (delta.bus) { bus += delta.bus; record.busMade += delta.bus; }
      if (delta.shield) shield += delta.shield;
      if (delta.reflect) reflect += delta.reflect;
      if (delta.vent) vent += delta.vent;
      if (delta.discount) discount = delta.discount;
      if (delta.heal) { const before = battle.hp; battle.hp = Math.min(maxHp, battle.hp + delta.heal); record.healing += battle.hp - before; }
      if (delta.selfDamage) battle.hp -= delta.selfDamage;

      record.damage += dealt;
      record.shield += delta.shield || 0;
      log.push({ cycle: battle.cycle, slot: i, part: part.name, type: instance.type, cost,
        text: delta.text, damage: dealt,
        after: { bus, shield, enemyHp: Math.max(0, battle.enemyHp), hp: Math.max(0, battle.hp) } });
      if (battle.enemyHp <= 0) break;
    }

    if (battle.enemyHp > 0 && vent && bus > 0) {
      const burst = applyHit(vent * bus, false);
      log.push({ cycle: battle.cycle, slot: null, part: "逆流弁", type: "vent", text: `余った帯域${bus}を噴射（${burst}ダメージ）`, damage: burst,
        after: { bus: 0, shield, enemyHp: Math.max(0, battle.enemyHp), hp: Math.max(0, battle.hp) } });
      bus = 0;
    }
    if (battle.enemyHp <= 0) break;

    const strikes = enemy.strikes || 1;
    for (let s = 0; s < strikes && battle.hp > 0; s += 1) {
      const blocked = Math.min(shield, enemy.atk);
      shield -= blocked;
      const through = enemy.atk - blocked;
      battle.hp -= through;
      if (reflect && blocked > 0) battle.enemyHp -= reflect;
      log.push({ cycle: battle.cycle, slot: null, part: enemy.name, type: "enemy",
        text: `遮蔽で${blocked}防ぎ、HPへ${through}`, blocked, hpDamage: through,
        after: { bus: 0, shield, enemyHp: Math.max(0, battle.enemyHp), hp: Math.max(0, battle.hp) } });
    }
    if (enemy.regen && battle.enemyHp > 0) {
      battle.enemyHp = Math.min(enemy.hp, battle.enemyHp + enemy.regen);
      log.push({ cycle: battle.cycle, slot: null, part: enemy.name, type: "enemy",
        text: `${enemy.regen}回復した`, after: { bus: 0, shield: 0, enemyHp: battle.enemyHp, hp: Math.max(0, battle.hp) } });
    }
  }

  const finalHp = Math.max(0, Math.ceil(battle.hp));
  const survived = battle.hp > 0;
  const won = enemy.goal === "survive" ? survived : battle.enemyHp <= 0;
  return {
    won,
    cycles: battle.cycle,
    hp: finalHp,
    enemyHp: Math.max(0, battle.enemyHp),
    timedOut: enemy.goal !== "survive" && battle.enemyHp > 0 && survived,
    resources: [],
    contributions: [...contributions.values()],
    log
  };
}

export const BUS = {
  id: RULESET_ID,
  title: "帯域機関 / BUS 0.3",
  PARTS, ENEMIES, PREDICTIONS, WORRY_CATEGORIES, UPDATE_KINDS, MARKER_KINDS,
  SLOT_COUNT, START_PARTS, RARE_RATE, MAX_CYCLES,
  MAX_HP: 30, REPAIR_HP: 5, WIN_HEAL: 3, REWARD_CHOICES: 3,
  slotLabel: "機関列",
  slotHint: "枠1から順に作動。手前の部品ほど帯域を先に取る",
  simulateBattle, predictionLevel, outcomeLevel,
  enemyView: enemy => ({
    name: enemy.name, hp: enemy.hp, atk: enemy.atk,
    soak: enemy.soak || 0, cap: enemy.cap >= 99 ? null : enemy.cap,
    strikes: enemy.strikes || 1, window: enemy.window,
    goal: enemy.goal === "survive" ? "耐久" : "撃破",
    hp: enemy.goal === "survive" ? null : enemy.hp, trait: enemy.trait
  }),
  rules: `【帯域機関 / BUS 0.3 遊び方】
- 部品で機関を組み、6戦を勝ち抜く。操作は構築のみで、戦闘は自動。
- 機関列は5枠。毎巡回、枠1から枠5へ順に作動する。
- **帯域**：毎巡回のはじめに${BASE_BUS}。部品はそれぞれ帯域費を持ち、残り帯域が足りないと動かず空回りする。
- 手前の部品ほど先に帯域を取る。並び順が「誰が動けるか」を決める。
- **遮蔽は巡回の終わりに消える。** 守りたければ毎巡回、帯域を払い直す。
- 部品が動いた後、敵が反撃する。遮蔽が肩代わりし、余りはHPへ通る。
- **敵ごとに問いが違う。** 「撃破」は制限巡回のうちに削り切れば勝ち、「耐久」は制限巡回を生き延びれば勝ち。
- 耐久型は削っても止まらない。撃破型は生き延びても巡回が増えない。一つの構成で両方を満たすのは難しい。
- 敵の減衰は各命中から引かれ（最低1は通る）、上限は1回の命中で通る量を制限する。
- 勝利するとHPが3回復し、3候補から1個だけ拾える。全部見送ると修復材◆2。
- 予備部品を分解すると◆1。◆1でHPが5回復する。HPが尽きても敗北。`
};
