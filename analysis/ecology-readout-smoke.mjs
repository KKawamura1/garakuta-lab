// **技能・装備・常設技能の説明文が、実際の係数と食い違っていないか。**
//
// 2026-08-31、active skill の説明が6件ずれていた。うち5件は PR59 が係数を
// 変えたときからテキストが旧値のままで、**大溜めは実際 1000% なのに
// 「400%」と表示していた**。
//
// ずれる理由ははっきりしている。bpsForLegacyAmount(N) は「旧尺度の量 N」を
// 中立 parameter 40 に対する係数へ直す関数で、**N はそのまま % ではない**
// （bpsForLegacyAmount(10) は 100% ではなく 250%）。説明文を書くとき
// この N をそのまま % として写すと必ずずれる。
//
// **散文の約束では落ちる。押すたびに機械が見る。**
//
// active だけでなく、同じ移行を通った reactive、固定量を10倍した equipment、
// statBonus を持つ passive もここで読む。説明文に数値が書かれている場合は、
// 定義側の実効量と一致しなければ落とす。数値を書かない定性的な文は、別の
// 表示設計の判断なのでこの検査では勝手に補わない。
//
// **技能の「レベルで伸びる量」だけは、突き合わせをやめた**（issue #148）。
// 二つの場所に同じ数を書いておいて一致を見るより、**一箇所にしか書けなくする**
// ほうが強い。説明文は `{amount}` と書いて定義を指し、表示のときに実際の値
// （レベルを掛けたもの）が入る。だからここでは「一致するか」ではなく
// **「二重に書いていないか」**を見る（content/skill-levels.mjs の skillTextIssues）。
// 固定量——発動条件の閾値、後列減衰、AP / RP、装備の固定ダメージ——は言い回しが
// 単位ごとに変わるので文字のままで、これまでどおり突き合わせる。

import assert from "node:assert/strict";
import { PLAYABLE_CONTENT } from "../ecology/playable-content.mjs";
import {
  ACTIVE_META,
  EQUIPMENT_META,
  PASSIVE_META,
  REACTIVE_META,
} from "../ecology/content/skill-tree.mjs";
import { skillTextIssues } from "../ecology/content/skill-levels.mjs";

const META_BY_SECTION = {
  activeSkills: ACTIVE_META,
  reactiveSkills: REACTIVE_META,
  passiveSkills: PASSIVE_META,
  equipment: EQUIPMENT_META,
};
const drifted = [];
let checked = 0;
const checkedBySection = new Set();

function collectAmounts(value, found = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectAmounts(item, found);
    return found;
  }
  if (!value || typeof value !== "object") return found;
  if (value.amount && typeof value.type === "string") {
    found.push({ type: value.type, amount: value.amount, hitCount: value.hitCount ?? 1 });
  }
  for (const item of Object.values(value)) collectAmounts(item, found);
  return found;
}

function writtenPercentages(text) {
  return [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((match) => Number(match[1]));
}

function closeToAny(expected, written) {
  return written.some((value) => Math.abs(value - expected) < 1);
}

function row(section, id, meta, message, expected, written) {
  drifted.push({
    section,
    id,
    name: meta?.[0] ?? id,
    message,
    expected,
    written,
  });
}

for (const [section, metaById] of Object.entries(META_BY_SECTION)) {
  for (const [id, definition] of Object.entries(PLAYABLE_CONTENT[section] ?? {})) {
    const meta = metaById[id];
    if (!meta) continue;
    const text = String(meta[1]);
    const effects = collectAmounts(definition);

    // issue #148 — レベルで伸びる量は、説明文に数字で書かない。`{amount}` が定義を指す。
    // **二つの場所に同じ数を書かせない**ので、ずれようがない。ここで見るのは、
    // その約束から外れた書き方（数字で直接書いた／{amount} を書き忘れた／
    // 伸びる量を二つ持っている）だけである。
    if (section !== "equipment") {
      const issues = skillTextIssues(text, definition);
      if (issues.length) {
        checked += 1;
        checkedBySection.add(section);
        for (const issue of issues) row(section, id, meta, issue, "{amount}", writtenPercentages(text));
      } else if (text.includes("{amount}")) {
        checked += 1;
        checkedBySection.add(section);
      }
    }

    if (section === "equipment") {
      for (const effect of effects) {
        const pattern = effect.type === "deal_damage"
          ? /(\d+(?:\.\d+)?)\s*ダメージ/g
          : effect.type === "gain_barrier"
            ? /防壁\s*(\d+(?:\.\d+)?)/g
            : effect.type === "repair_equipment"
              ? /(?:耐久|装備を)\s*(\d+(?:\.\d+)?)\s*(?:を)?修理/g
              : effect.type === "gain_resource" && effect.resource === "action_points"
                ? /行動権(?:を|\+)\s*(\d+(?:\.\d+)?)/g
                : effect.type === "gain_resource" && effect.resource === "reaction_points"
                  ? /反応権(?:を|\+)\s*(\d+(?:\.\d+)?)/g
                  : null;
        if (!pattern || effect.amount?.type !== "constant") continue;
        const written = [...text.matchAll(pattern)].map((match) => Number(match[1]));
        if (!written.length) continue;
        checkedBySection.add(section);
        if (!closeToAny(effect.amount.value, written)) {
          row(
            section,
            id,
            meta,
            effect.type + " の固定量が説明文と一致しない",
            effect.amount.value,
            written,
          );
        }
      }
    }

    if (section === "passiveSkills") {
      const labels = { max_hp: "最大HP", might: "腕力", focus: "技術", guard: "受け" };
      for (const [stat, expected] of Object.entries(definition.statBonus ?? {})) {
        const label = labels[stat];
        if (!label) continue;
        checkedBySection.add(section);
        const found = text.match(new RegExp(
          label + "[^0-9]*([0-9]+(?:\\.[0-9]+)?)",
        ));
        const written = found ? [Number(found[1])] : [];
        if (!written.length || !closeToAny(expected, written)) {
          row(
            section,
            id,
            meta,
            stat + " の statBonus が説明文と一致しない",
            expected,
            written,
          );
        }
      }

      for (const effect of effects) {
        if (effect.type !== "gain_resource" && effect.type !== "gain_block") continue;
        if (effect.amount?.type !== "constant") continue;
        const pattern = effect.type === "gain_block"
          ? /受け構え[^0-9]*([0-9]+(?:\.[0-9]+)?)/g
          : effect.resource === "action_points"
            ? /行動権\s*\+?\s*([0-9]+(?:\.[0-9]+)?)/g
            : effect.resource === "reaction_points"
              ? /反応権\s*\+?\s*([0-9]+(?:\.[0-9]+)?)/g
              : null;
        if (!pattern) continue;
        checkedBySection.add(section);
        const written = [...text.matchAll(pattern)].map((match) => Number(match[1]));
        if (!written.length || !closeToAny(effect.amount.value, written)) {
          row(
            section,
            id,
            meta,
            effect.type + " の固定量が説明文と一致しない",
            effect.amount.value,
            written,
          );
        }
      }
    }
  }
}

// 既存の参照点は維持する。係数つきの active/reactive の説明を十分に
// 読めなくなった場合は、検査側の形が古いと判断して落とす。
assert.ok(
  checked >= 10,
  "係数つきの説明文が " + checked + " 件しか見つからない。読み出し側の形が変わった疑い",
);
for (const section of ["activeSkills", "reactiveSkills", "passiveSkills", "equipment"]) {
  assert.ok(checkedBySection.has(section), section + " の表示文を検査できていない");
}

assert.deepEqual(
  drifted,
  [],
  "説明文と係数・固定量がずれている定義がある:\n"
  + drifted.map((item) => {
    const expected = typeof item.expected === "object"
      ? JSON.stringify(item.expected)
      : item.expected + "%";
    return "  " + item.name + "(" + item.section + "." + item.id + "): " + item.message
      + " / 実際 " + expected + " / 説明文 " + (item.written.join("・") || "(数値なし)");
  }).join("\n")
  + "\n**bpsForLegacyAmount(N) の N はそのまま % ではない**（(10) は 250%）。実際の係数を書くこと",
);

console.log(
  "ecology readout smoke ok "
  + JSON.stringify({ checked, drifted: drifted.length, sections: [...checkedBySection] }),
);
