// エージェントと人間が同じ画面を見るための共有レンダラ。
// CLI（agents/session.mjs）、ターミナル版（agents/play.mjs）、
// ブラウザ版（agent-view/）はすべてこの関数だけを使う。表示を分岐させない。

export function padEnd(text, width) {
  let size = 0;
  for (const char of text) size += /[　-ヿ一-鿿＀-￯]/.test(char) ? 2 : 1;
  return text + " ".repeat(Math.max(1, width - size));
}

export // 周期を持つルールセットでは「この枠だと何巡目に動くか」が判断の中心になる。
// 部品の説明だけでは読めないので、枠ごとに展開して見せる。
function firingCycles(period, slotIndex, upTo = 9) {
  if (!period) return null;
  const cycles = [];
  for (let cycle = 1; cycle <= upTo; cycle += 1) {
    if ((cycle - 1) % period === slotIndex % period) cycles.push(cycle);
  }
  return period === 1 ? "毎巡" : `${cycles.join("・")}…巡目`;
}

function renderPart(part, prefix = "") {
  const cost = part.cost === undefined ? "" : `帯${part.cost} `;
  return `${prefix}${padEnd(`${part.icon} ${part.name}`, 18)}${padEnd(cost + part.short, 16)}${part.desc}`;
}

export function renderObservation(observation, extra = "") {
  const o = observation;
  const lines = [];
  lines.push(`[${o.ruleset} / seed ${o.seed}] 第${o.battleNumber}戦 / 全${o.totalBattles}戦   HP ${o.hp}/${o.maxHp}   修復材 ◆${o.scrap}   段階:${o.phase}`);
  if (o.upcomingEnemy) {
    const e = o.upcomingEnemy;
    const shown = Object.entries(e).filter(([k, v]) => !["name", "trait"].includes(k) && v !== null && v !== undefined)
      .map(([k, v]) => `${({ hp: "HP", atk: "攻撃", armor: "装甲", soak: "減衰", cap: "命中上限", strikes: "反撃回数", window: "制限巡回", goal: "目的" })[k] || k}${v}`).join(" ");
    lines.push(`次の敵：${e.name}  ${shown}`);
    lines.push(`  特徴：${e.trait}`);
  }
  lines.push("");
  lines.push(`${o.slotLabel || "駆動列"}（${o.slotHint || "枠1から順に作動"}）`);
  o.slots.forEach(slot => {
    if (!slot.part) { lines.push(`  ${slot.slot} （空き）`); return; }
    lines.push(`  ${slot.slot} ${renderPart(slot.part)}`);
    const when = firingCycles(slot.part.period, slot.slot - 1);
    if (when) lines.push(`      作動する巡回：${when}`);
  });
  lines.push("");
  lines.push(`予備部品（${o.inventory.length}個）`);
  if (!o.inventory.length) lines.push("  なし");
  o.inventory.forEach(part => lines.push(`  [${part.id}] ${renderPart(part)}`));

  if (o.offer) {
    lines.push("");
    lines.push("■ 報酬候補（1個だけ取得、または全部見送り）");
    o.offer.forEach(item => lines.push(`  ${item.choice}. ${renderPart(item.part)}`));
  }

  if (o.lastBattle) {
    const b = o.lastBattle;
    lines.push("");
    lines.push(`直前の戦闘：${b.enemy} に${b.won ? "勝利" : "敗北"}（${b.cycles}巡 / HP ${b.hpBefore}→${b.hpAfter} / 敵残HP ${b.enemyHpLeft}）`);
    lines.push(`  予想「${b.prediction}」→ 実際は ${({ better: "予想より良い", expected: "予想どおり", worse: "予想より悪い" })[b.surprise]}`);
    b.contributions.forEach(c => {
      const parts = [
        c.damage ? `攻撃${c.damage}` : "", c.shield ? `装甲${c.shield}` : "",
        c.powerMade ? `発電${c.powerMade}` : "", c.powerSpent ? `電力消費${c.powerSpent}` : "",
        c.heatMade ? `発熱${c.heatMade}` : "", c.heatCooled ? `冷却${c.heatCooled}` : "",
        c.healing ? `回復${c.healing}` : ""
      ].filter(Boolean).join(" ");
      lines.push(`    ${padEnd(c.name, 14)}${c.activations}回作動  ${parts}`);
    });
    if (b.leftoverPower !== undefined && b.leftoverHeat !== undefined) {
      lines.push(`    余り 電力${b.leftoverPower} 熱${b.leftoverHeat} 装甲${b.leftoverShield}`);
    }
    if (b.log?.length) {
      lines.push("  巡回ログ（人間版の戦闘表示と同じ範囲）");
      b.log.forEach(entry => lines.push(`    ${entry}`));
    }
  }

  if (o.done) {
    lines.push("");
    lines.push(o.won ? "■ ラン終了：全6戦を突破した。" : `■ ラン終了：第${o.battleNumber}戦で停止した。`);
    lines.push("  finish コマンドでアンケートを送って終了してください。");
  } else {
    lines.push("");
    lines.push("可能な行動（引数名は完全一致が必要）");
    o.legalActions.forEach(action => {
      const args = Object.entries(action.args || {}).map(([key, value]) => `${key}=${value}`).join(", ");
      lines.push(`  {"type":"${action.type}"${args ? `, ${args}` : ""}}${action.note ? `  ← ${action.note}` : ""}`);
    });
  }
  if (extra) lines.push("", extra);
  return lines.join("\n");
}
