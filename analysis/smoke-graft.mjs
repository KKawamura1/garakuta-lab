import { strict as assert } from "node:assert";
import {
  VERSION, MAX_TURNS, MAX_HP, ACTIONS, MUTATIONS, ENEMIES,
  createGame, playAction, chooseMutation, serialize, deserialize, actionInfo
} from "../graft/engine.mjs";

// GRAFT 0.1 には検査が一つも無かった。**いま作者が遊んでいるのはこの版である。**
// `analysis/check-all.sh` を push ごとに走らせるようにしたのに、
// いちばん遊ばれている版がその外にいたら、関門を足した意味がない。

assert.equal(VERSION, "graft-0.1");
assert.equal(ACTIONS.length, 3, "行動は3つ");
assert.ok(MUTATIONS.length >= 1);
assert.ok(ENEMIES.length >= 1);

// 打てる行動のうち、敵を減らさないものを選ぶ（充電→遮蔽）。
// 充電は力が満杯だと打てないので、「いつでも打てる」前提では検査にならない。
function passiveAction(state) {
  for (const id of ["charge", "guard", "strike"]) {
    if (actionInfo(state, id).legal) return id;
  }
  return null;
}

// 同じ種は同じラン
{
  const play = seed => {
    let s = createGame(seed);
    const seen = [];
    for (let i = 0; i < 4 && !s.done && s.phase === "battle"; i += 1) {
      const id = passiveAction(s);
      assert.ok(id, "打てる行動が必ず一つはある");
      const r = playAction(s, id);
      assert.ok(r.ok, `${id} が打てる`);
      s = r.state;
      seen.push(`${id}:${s.turn}:${s.energy}:${s.enemy.hp}:${s.hp}`);
    }
    return seen.join("|");
  };
  assert.equal(play(4242), play(4242), "同じ種なら同じ経過");
}

// 保存と再開
{
  let s = createGame(11);
  s = playAction(s, "charge").state;
  const back = deserialize(serialize(s));
  assert.deepEqual(back, s, "保存して読み直しても同じ状態");
  assert.equal(deserialize('{"version":"graft-0.0"}'), null, "違う版の保存は読まない");
}

// **負けたときに、ログへ理由が残ること。**
//
// 2026-08-25、作者：「え、なんか負けた？もしかして時間制限がある？知らないけど」
// 制限巡数は画面に出ていたが、負けた瞬間には何も言われていなかった。
// 突破したときだけ log() を呼んでいたためである。
{
  // 充電と遮蔽だけを繰り返せば敵は減らないので、必ずどちらかの負け方で終わる。
  let s = createGame(7);
  let guard = 0;
  while (!s.done && guard < 40) {
    guard += 1;
    const id = passiveAction(s);
    if (id === "strike" || !id) break;
    const r = playAction(s, id);
    if (!r.ok) break;
    s = r.state;
  }
  assert.ok(s.done, "敵を殴らなければ、いつかは終わる");
  assert.equal(s.lastBattle.won, false);
  assert.ok(["turn_limit", "hp_zero"].includes(s.lastBattle.reason), "負けには理由が付く");
  assert.ok(s.turn <= MAX_TURNS, `巡は${MAX_TURNS}を超えない`);

  const last = s.log[s.log.length - 1];
  assert.ok(last, "ログが空で終わらない");
  assert.ok(/機関は停止した/.test(last.text), `負けた行がログの最後に残る（実際: ${last.text}）`);
  if (s.lastBattle.reason === "turn_limit") {
    assert.ok(last.text.includes(`${MAX_TURNS}巡`), "巡切れなら巡数を名指しする");
  } else {
    assert.ok(last.text.includes("HP"), "HP0ならそう言う");
  }
}

// 勝ったときは、これまでどおり突破が残る
{
  let s = createGame(3);
  let guard = 0;
  while (!s.done && s.phase === "battle" && guard < 40) {
    guard += 1;
    const info = actionInfo(s, "strike");
    const r = playAction(s, info.legal ? "strike" : "charge");
    if (!r.ok) break;
    s = r.state;
  }
  if (s.phase === "reward") {
    assert.ok(s.log.some(l => /突破/.test(l.text)), "突破したらそう書く");
    assert.ok(Array.isArray(s.offer) && s.offer.length > 0, "報酬に接ぎ木が出る");
    const pick = chooseMutation(s, s.offer[0], "strike");
    assert.ok(pick.ok, "接ぎ木を選べる");
    assert.equal(pick.state.phase, "battle", "選んだら次の戦闘へ進む");
    assert.ok(pick.state.hp <= MAX_HP, "回復しても最大HPは超えない");
  }
}

console.log("graft smoke: 決定性・保存・負けた理由のログ・報酬 OK");
