import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { createRun } from "../core/run.mjs";
import { makeLawRuleset } from "../core/laws.mjs";
import { LAW_TABLE } from "../core/law-table.mjs";
import { makeRng } from "../core/rng.mjs";
import { searchPolicy } from "../agents/policies.mjs";

// **再読み込みでランが壊れてはいけない。**
//
// 実際に壊した：未挑戦の法則の組を優先する仕組みを入れたとき、
// 「どの組で始めたか」をセッションに書いていなかった。ラン中に記録が増えると
// 「未挑戦の組」が変わるので、再読み込みのたびに別の法則で再生され、
// 作者の進行中のランが第1戦で終了した。
//
// ここで固定するのは二つ。
//   1. 進行中のランは、法則を焼き付けて再生する（表が変わっても同じ規則で動く）。
//   2. 焼き付けが無い古いセッションは、記録済みの試行から元の組を突き止められる。

const app = readFileSync("play/app.js", "utf8");

assert.match(app, /session\.variantSpec/, "決めた法則をセッションに焼き付けること");
assert.match(app, /function inferVariant\(/, "焼き付けの無いセッションから法則を突き止められること");
assert.match(app, /pickVariant\(chosenSeed, played\)/, "未挑戦の組を選ぶのはランを始める瞬間だけ");
assert.ok(!/pickVariant\(session\.seed\)\s*;/.test(app), "毎回選び直してはいけない");

// どんな状態でも生の記録を取り出せること。壊れても記録は失われない。
assert.match(app, /生の記録を出す/, "生の記録を取り出す口が要る");
assert.match(app, /navigator\.clipboard\.writeText/, "写せるようにする");

// 推定が並んだときに黙って決めないこと。
// 2候補が同じだけ辻褄を合わせることがあり、先に見つけた方を採ると
// 「進行は戻ったのに法則だけ別物」という直しにくい状態になる（実際に起きた）。
assert.match(app, /function ambiguityCard\(/, "並んだら訊く画面が要る");
assert.match(app, /winners\.length === 1 \? winners\[0\]\.variant : null/, "並んだら推定しない");
assert.match(app, /searchParams\.get\("laws"\)|get\("laws"\)/, "法則を指定して直せる口が要る");
// **その口が実際に開くこと。** `?laws=relay+balance` は URLSearchParams が `+` を空白へ
// 復号するので、`+` しか受けない実装だと一致せず黙って無視される。説明文どおりに貼って
// 効かないなら、出口が無いのと同じである（事故の直後に人が使う唯一の手段なので、形だけの
// 存在確認では足りない）。区切りを緩めて受けていることを検査する。
assert.match(app, /split\(\/\[\+,\\s\]\+\/\)/, "?laws= が空白区切り（+ の復号形）を受けていない");

// 突き止めの仕組みが実際に効くか、実際に遊んだ形のセッションで確かめる。
//
// 手がかりは二つある。**本物の法則なら、記録された操作は全部通る**（弱い法則で再生すると
// 戦闘に負けてランが終わり、以後の操作が弾かれる）。試行の結果の一致は、それでも並ぶ候補を分ける。
if (LAW_TABLE.length >= 2) {
  const specOf = v => makeLawRuleset(v.laws, v.scales, v.atkScales, v.modScales, v.cycleCaps);
  const target = LAW_TABLE[1];
  const rules = specOf(target);

  // 「勝てる並びを探して戦う」を数戦ぶん、行動列として作る。
  // 素朴に並べると1戦目で負けて記録が短くなるので、並びを探す方策に遊ばせる。
  //
  // **単一の種に頼らないこと。** 生成条件を締めたら、方策が1戦目で落ちる種を引いて
  // この検査だけが落ちた。ここが確かめたいのは突き止めの仕組みであって難易度ではないので、
  // 十分な長さの記録が採れる種を探す。**採れなければ、そのとき初めて失敗とする。**
  const playFrom = seed => {
    const actions = [];
    const policy = searchPolicy({ ruleset: rules, tries: 400, satisfice: true });
    const run = createRun({ seed, playerId: "resume", ruleset: rules });
    let guard = 0;
    while (!run.done && guard < 200) {
      guard += 1;
      const o = run.observe();
      if (o.phase === "reward") {
        const take = policy.reward(o);
        actions.push(take); run.act(take);
        continue;
      }
      policy.build(o).forEach(a => { if (run.act(a).ok) actions.push(a); });
      const battle = policy.battle(run.observe());
      actions.push(battle);
      if (!run.act(battle).ok) break;
    }
    return { actions, seed };
  };
  let played = null;
  for (let i = 0; i < 40 && !played; i += 1) {
    const attempt = playFrom(4242 + i);
    if (attempt.actions.length > 10) played = attempt;
  }
  assert.ok(played, "40種のどれでも行動列が10手に届かない（方策が1戦目で落ちている）");
  const { actions, seed: playedSeed } = played;

  // 各候補で再生して、何手まで通るかを見る。
  const scores = LAW_TABLE.map(candidate => {
    const alt = specOf(candidate);
    const probe = createRun({ seed: playedSeed, playerId: "resume", ruleset: alt });
    let accepted = 0;
    for (const action of actions) { if (!probe.act(action).ok) break; accepted += 1; }
    return { id: candidate.laws.join("+"), accepted };
  });
  const self = scores.find(x => x.id === target.laws.join("+"));
  assert.equal(self.accepted, actions.length, "本人の法則なら全部通るはず");
  void makeRng;
}

console.log(`resume smoke: 進行中のランは法則を焼き付けて再生し、古いセッションは突き止められる OK`);
