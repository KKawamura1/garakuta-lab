import { ARC } from "../core/arc.mjs";
import { makeRng } from "../core/rng.mjs";

const evalRng = () => makeRng(20260818);

function instances(observation) {
  const slots = observation.slots.map(s => (s.part ? { id: s.part.id, type: s.part.type } : null));
  const bench = observation.inventory.map(p => ({ id: p.id, type: p.type }));
  return { slots, bench };
}

function makeScore(ruleset) {
  return function score(slots, observation, enemy) {
    const result = ruleset.simulateBattle({
      slots, hp: observation.hp, maxHp: observation.maxHp, enemy, rng: evalRng()
    });
    return { value: (result.won ? 1000 : 0) + result.hp * 10 - result.enemyHp, result };
  };
}

function makeFullEnemy(ruleset) {
  return observation => ruleset.ENEMIES[observation.battleNumber - 1] || ruleset.ENEMIES[ruleset.ENEMIES.length - 1];
}

function predictionFor(result, hp) {
  if (!result.won) return "負けそう";
  if (result.hp <= 10) return "ギリギリ";
  if (result.hp < 24) return "勝てそう";
  return "圧勝";
}

// 不安の分類はルールセットごとに語彙が違う（ARCは「装甲」、PHASEは「遮蔽」）。
// 以前はARCの語彙を決め打ちしていたため、PHASEで負けを予測した瞬間に行動が弾かれ、
// そのランがそこで止まっていた。ルールセットの語彙に無い候補は捨てて選び直す。
function worryFor(result, slots, ruleset = ARC) {
  const allowed = ruleset.WORRY_CATEGORIES || [];
  const first = (...candidates) => candidates.find(c => allowed.includes(c)) || allowed[allowed.length - 1];
  if (!result.won) return result.timedOut ? first("火力") : first("装甲", "遮蔽", "耐久");
  if (result.hp <= 12) return first("装甲", "遮蔽", "耐久");
  if (result.cycles >= 6) return first("火力");
  if (result.power >= 6) return first("電力");
  if (result.heat >= 6) return first("熱");
  return first("なし");
}

export function naivePolicy({ ruleset = ARC } = {}) {
  const { SLOT_COUNT } = ruleset;
  return {
    id: "naive",
    build(observation) {
      const actions = [];
      const empty = observation.slots.filter(s => !s.part).map(s => s.slot);
      observation.inventory.slice(0, empty.length).forEach((part, i) => {
        actions.push({ type: "place", partId: part.id, slot: empty[i] });
      });
      return actions;
    },
    battle(observation) {
      return { type: "battle", prediction: "勝てそう", worry: "なし", worryText: "特に考えていない" };
    },
    reward(observation) {
      return { type: "take", choice: 1, reason: "先頭の候補を取る", update: "none", updateText: "" };
    }
  };
}

export function localSearchPolicy({ rounds = 3, ban = [], ruleset = ARC } = {}) {
  const { ENEMIES, simulateBattle, SLOT_COUNT } = ruleset;
  const allowed = part => part && !ban.includes(part.type);
  const score = makeScore(ruleset);
  const fullEnemy = makeFullEnemy(ruleset);
  return {
    id: ban.length ? `local-ban:${ban.join("+")}` : "local",
    build(observation) {
      const enemy = fullEnemy(observation);
      let { slots, bench } = instances(observation);
      const actions = [];
      bench = bench.filter(allowed);

      for (let round = 0; round < rounds; round += 1) {
        let best = { value: score(slots, observation, enemy).value, action: null, slots };
        for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
          for (let b = 0; b < bench.length; b += 1) {
            const candidate = [...slots];
            candidate[slot] = bench[b];
            const value = score(candidate, observation, enemy).value;
            if (value > best.value) best = { value, action: { type: "place", partId: bench[b].id, slot: slot + 1 }, slots: candidate, benchIndex: b, displaced: slots[slot] };
          }
        }
        for (let a = 0; a < SLOT_COUNT - 1; a += 1) {
          const candidate = [...slots];
          [candidate[a], candidate[a + 1]] = [candidate[a + 1], candidate[a]];
          const value = score(candidate, observation, enemy).value;
          if (value > best.value) best = { value, action: { type: "swap", slotA: a + 1, slotB: a + 2 }, slots: candidate };
        }
        if (!best.action) break;
        actions.push(best.action);
        if (best.action.type === "place") {
          bench = bench.filter((_, i) => i !== best.benchIndex);
          if (best.displaced) bench.push(best.displaced);
        }
        slots = best.slots;
      }
      return actions;
    },
    battle(observation) {
      const enemy = fullEnemy(observation);
      const { slots } = instances(observation);
      const { result } = score(slots, observation, enemy);
      return {
        type: "battle",
        prediction: predictionFor(result, observation.hp),
        worry: worryFor(result, slots, ruleset),
        worryText: `模擬戦の結果 敵残${result.enemyHp} / 自HP${result.hp}`
      };
    },
    reward(observation) {
      const enemy = fullEnemy(observation);
      const { slots } = instances(observation);
      let best = { value: -Infinity, choice: 1 };
      const offers = observation.offer.filter(item => allowed(item.part));
      (offers.length ? offers : observation.offer).forEach(item => {
        const candidate = { id: item.part.id, type: item.part.type };
        let bestForOffer = -Infinity;
        for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
          const trial = [...slots];
          trial[slot] = candidate;
          bestForOffer = Math.max(bestForOffer, score(trial, observation, enemy).value);
        }
        if (bestForOffer > best.value) best = { value: bestForOffer, choice: item.choice };
      });
      return { type: "take", choice: best.choice, reason: "次の一戦の模擬結果が最良", update: "confirmed", updateText: "" };
    }
  };
}


// 配置を探索する方策。
//
// 局所探索（1枠ずつ置き換えて改善する）は RELAY で1戦目から全滅した。
// 継電は**枠の並び全体**で価値が決まるので、1手ずつの改善では谷を越えられない。
// そして人間の側は、画面が並びの結果を即座に断定するので、実際に並びを試して探す。
// **代理は人間と同じ道具を持つべきである。** よって並びをサンプルして最良を選ぶ。
//
// 「何通り試すか」は代理の地平であり、設計変数として明示する（学習#27）。
// satisfice: 最初に勝てた並びで手を止める（人はふつう最適化せず、通る手を見つけたら進む）。
// 最良を選ぶ代理は、勝てる並びのうち最もHPが残るものを引き当てるので、
// **無傷率が跳ね上がって圧力の指標が消える。** 実測では4戦目の無傷率が 22% → 94% になった。
// 圧力を測りたいなら、代理は最適化ではなく充足で止めなければならない。
export function searchPolicy({ ruleset = ARC, tries = 4000, seed = 5, satisfice = false } = {}) {
  const { SLOT_COUNT } = ruleset;
  const score = makeScore(ruleset);
  const fullEnemy = makeFullEnemy(ruleset);

  // 相異なる型の並びを列挙し、多ければ一様にサンプルする。
  const candidates = (bench, rng) => {
    const byType = new Map();
    bench.forEach(item => { if (!byType.has(item.type)) byType.set(item.type, []); byType.get(item.type).push(item); });
    const kinds = [...byType.keys()];
    const counts = new Map(kinds.map(k => [k, byType.get(k).length]));
    const out = [];
    const cur = [];
    const walk = depth => {
      if (out.length >= 200000) return;
      if (depth === SLOT_COUNT) { out.push([...cur]); return; }
      kinds.forEach(kind => {
        if (!counts.get(kind)) return;
        counts.set(kind, counts.get(kind) - 1);
        cur.push(kind);
        walk(depth + 1);
        cur.pop();
        counts.set(kind, counts.get(kind) + 1);
      });
    };
    walk(0);
    if (out.length <= tries) return out;
    const picked = [];
    for (let i = 0; i < tries; i += 1) picked.push(out[Math.floor(rng() * out.length)]);
    return picked;
  };

  const bestOrder = (pool, observation, enemy) => {
    const rng = makeRng(seed);
    let best = { value: -Infinity, order: null };
    const list = candidates(pool, rng);
    for (const order of list) {
      const slots = order.map((type, i) => ({ id: `t${i}`, type }));
      const { value, result } = score(slots, observation, enemy);
      if (value > best.value) best = { value, order };
      if (satisfice && result.won) return best;
    }
    return best;
  };

  return {
    id: `search:${tries}${satisfice ? ":satisfice" : ""}`,
    build(observation) {
      const enemy = fullEnemy(observation);
      const { slots, bench } = instances(observation);
      const pool = [...slots.filter(Boolean), ...bench];
      if (pool.length < SLOT_COUNT) return [];
      const best = bestOrder(pool, observation, enemy);
      if (!best.order) return [];

      // 目標の並びへ移す。いったん全部外してから順に置くのが最も単純で、
      // 記録される操作の種類（remove/place）も実際の手順と一致する。
      const actions = [];
      slots.forEach((instance, i) => { if (instance) actions.push({ type: "remove", slot: i + 1 }); });
      const available = new Map();
      pool.forEach(item => { if (!available.has(item.type)) available.set(item.type, []); available.get(item.type).push(item); });
      best.order.forEach((type, i) => {
        const item = available.get(type).shift();
        actions.push({ type: "place", partId: item.id, slot: i + 1 });
      });
      return actions;
    },
    battle(observation) {
      const enemy = fullEnemy(observation);
      const { slots } = instances(observation);
      const { result } = score(slots, observation, enemy);
      return {
        type: "battle",
        prediction: predictionFor(result, observation.hp),
        worry: worryFor(result, slots, ruleset),
        worryText: `並びを試した結果 敵残${result.enemyHp} / 自HP${result.hp}`
      };
    },
    reward(observation) {
      const enemy = fullEnemy(observation);
      const { slots, bench } = instances(observation);
      const pool = [...slots.filter(Boolean), ...bench];
      let best = { value: -Infinity, choice: 1 };
      observation.offer.forEach(item => {
        const trial = [...pool, { id: item.part.id, type: item.part.type }];
        const found = bestOrder(trial, observation, enemy);
        if (found.value > best.value) best = { value: found.value, choice: item.choice };
      });
      return { type: "take", choice: best.choice, reason: "並びを探した結果いちばん良い", update: "confirmed", updateText: "" };
    }
  };
}

export const POLICIES = { naive: naivePolicy, local: localSearchPolicy, search: searchPolicy };
