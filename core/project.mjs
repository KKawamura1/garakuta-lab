// 画面に出す「各巡回に何がどれだけ出るか」の見積り。
//
// これは表示の都合ではなくゲームの規則なので、コアへ置いて実機と突き合わせられるようにする。
// 表示側で独自に計算すると、説明文と実装が食い違うのと同じ形で静かにずれる（実際に一度やった）。
//
// 含むもの：作動周期と枠による位相、加算部品（次に作動する部品へ渡る）。
// 含まないもの：敵の減衰・命中上限・回復、自傷、HP上限による回復の頭打ち。

export function firesOn(cycle, slotIndex, period) {
  return (cycle - 1) % period === slotIndex % period;
}

function nominal(part, rng = () => 0.5) {
  const delta = part.run({ uses: {}, rng, instanceId: "projection" });
  return {
    dmg: (delta.damage || 0) + (delta.hits || []).reduce((a, b) => a + b, 0),
    shield: delta.shield || 0,
    heal: delta.heal || 0,
    boost: delta.boost || 0
  };
}

// slots: [{ type } | null]
export function projectCycles(slots, ruleset, cycles) {
  const out = [];
  for (let cycle = 1; cycle <= cycles; cycle += 1) {
    const row = { cycle, firing: 0, dmg: 0, shield: 0, heal: 0 };
    let boost = 0;
    slots.forEach((slot, index) => {
      if (!slot) return;
      const part = ruleset.PARTS[slot.type];
      if (!part || !firesOn(cycle, index, part.period || 1)) return;
      const nom = nominal(part);
      row.firing += 1;
      if (nom.dmg) row.dmg += nom.dmg + boost;
      if (nom.shield) row.shield += nom.shield + boost;
      if (nom.heal) row.heal += nom.heal + boost;
      if (nom.dmg || nom.shield || nom.heal) boost = 0;
      if (nom.boost) boost = nom.boost;
    });
    out.push(row);
  }
  return out;
}

// 素の合計で敵HPへ何巡目に届くか。届かなければ null と到達量を返す。
export function projectKill(slots, ruleset, enemyHp, limit) {
  const rows = projectCycles(slots, ruleset, limit);
  let acc = 0;
  for (const row of rows) {
    acc += row.dmg;
    if (acc >= enemyHp) return { cycle: row.cycle, total: acc };
  }
  return { cycle: null, total: acc };
}

export function markFor(part) {
  const nom = nominal(part);
  const kinds = [nom.dmg, nom.shield, nom.heal].filter(v => v > 0).length;
  if (nom.boost && !kinds) return `+${nom.boost}`;
  if (kinds !== 1) return "●";
  return String(nom.dmg || nom.shield || nom.heal);
}
