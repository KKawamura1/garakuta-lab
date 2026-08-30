// **テンポの約束を、散文ではなく本物の戦闘で確かめる。**
//
// 作者の指摘：「テンポが悪いので、行動権の消費、効果解決の終了など、
// アニメーションに出さなくていい部分はスキップしたり、並列処理したりしてもいい」
// 「主行動は必ずブロック、サブ行動は一部だけブロック（攻撃に合わせた自己回復は
// ブロックせずダメージと同時表示）、パッシブなどの非行動はブロックせず並列表示」
//
// ここはその規則が本当に成り立っているかを、7区画すべての実イベント列で見る。
// 拍の作り方を後から緩めたら鳴る。

import assert from "node:assert/strict";
import { simulateBattle } from "../ecology/engine.mjs";
import { PLAYABLE_CONTENT } from "../ecology/playable-content.mjs";
import { freshLoadout, makeBattle } from "../ecology/playable-battles.mjs";
import { BOARD_SKIP, buildBeats, beatDurationMs, eventSourceId } from "../ecology/replay-beats.mjs";

const roster = ["warden", "mender", "lancer", "scout"];
const formation = {
  warden: "front_left",
  lancer: "front_right",
  mender: "rear_left",
  scout: "rear_right",
};
const OPTIONS = { equipmentBreaks: false, captureReplaySnapshots: true };

const rows = [];
for (let stage = 1; stage <= 7; stage += 1) {
  const result = simulateBattle(
    makeBattle(stage, roster, freshLoadout(roster), "frontier-beats", formation),
    PLAYABLE_CONTENT,
    OPTIONS,
  );
  const events = result.events;
  const beats = buildBeats(events);
  const where = (message) => `${message}（第${stage}区画）`;

  assert.ok(beats.length > 0, where("拍がひとつも組まれていない"));

  // 1. 事務だけの拍を作らない。行動権の消費や解決の締めで画面を止めない。
  for (const beat of beats) {
    assert.equal(
      beat.events.every((event) => BOARD_SKIP.has(event.type)),
      false,
      where(`盤面に出さないイベントだけで拍を作っている: ${beat.events.map((e) => e.type).join(",")}`),
    );
  }

  // 2. 拍はイベント列を端まで覆い、後戻りしない。
  //    （覆えていないと、その先のログと状態が永久に出てこない）
  let previousTo = -1;
  for (const beat of beats) {
    assert.ok(beat.to >= previousTo, where("拍の到達位置が後戻りしている"));
    previousTo = beat.to;
  }
  assert.equal(previousTo, events.length - 1, where("最後のイベントまで拍が届いていない"));

  // 3. 主行動は必ず止める。action_started（ruleId 無し）は拍の先頭に立つ。
  const mainStarts = events.filter((event) => event.type === "action_started" && !event.ruleId);
  const impactHeads = new Set(beats.filter((beat) => beat.kind === "impact").map((beat) => beat.events[0].id));
  for (const event of mainStarts) {
    assert.ok(impactHeads.has(event.id), where(`主行動 ${event.id} が拍の先頭になっていない`));
  }
  assert.equal(mainStarts.length, beats.filter((b) => b.kind === "impact").length, where("主行動の数と着弾の拍の数が合わない"));

  // 4. 自分に向いたサブ行動は止めない。**必ず他の見せ場と同じ拍に乗る。**
  //    5. 他人に向いたサブ行動は止める。単独の拍になる。
  let selfRuleEffects = 0;
  let otherRuleEffects = 0;
  for (const beat of beats) {
    beat.events.forEach((event, indexInBeat) => {
      if (!event.ruleId) return;
      if (!["damage_taken", "healing_applied", "barrier_gained"].includes(event.type)) return;
      const targets = event.targetActorIds || [];
      const self = targets.length > 0 && targets.every((id) => id === eventSourceId(event));
      if (self) {
        selfRuleEffects += 1;
        assert.ok(
          indexInBeat > 0,
          where(`自分に向いたサブ行動 ${event.id} が単独の拍になっている（同時に出すはず）`),
        );
      } else {
        otherRuleEffects += 1;
        assert.equal(
          indexInBeat, 0,
          where(`他人に向いたサブ行動 ${event.id} が他の拍に紛れている（単独で見せるはず）`),
        );
      }
    });
  }

  // 6. テンポそのもの。**拍がイベント数の4割を超えたら、畳めていない。**
  const ratio = beats.length / events.length;
  assert.ok(
    ratio <= 0.4,
    where(`拍がイベントの${Math.round(ratio * 100)}%ある。事務を畳めていない`),
  );

  rows.push({
    stage,
    events: events.length,
    beats: beats.length,
    ratio,
    seconds: beats.reduce((sum, beat) => sum + beatDurationMs(beat), 0) / 1000,
    selfRuleEffects,
    otherRuleEffects,
  });
}

// **参照点。**規則が効いていることを、片側だけでなく両側で見る。
// 自分に向いたサブ行動と他人に向いたサブ行動が、どちらも実際に現れていること。
// 片方がゼロなら、上の assert は何も確かめていない。
const totalSelf = rows.reduce((sum, row) => sum + row.selfRuleEffects, 0);
const totalOther = rows.reduce((sum, row) => sum + row.otherRuleEffects, 0);
assert.ok(totalSelf > 0, "自分に向いたサブ行動が1件も無い。同時表示の規則を検査できていない");
assert.ok(totalOther > 0, "他人に向いたサブ行動が1件も無い。単独表示の規則を検査できていない");

for (const row of rows) {
  console.log(
    `  第${row.stage}区画 イベント${String(row.events).padStart(4)} → 拍${String(row.beats).padStart(4)}`
    + `（${String(Math.round(row.ratio * 100)).padStart(2)}%） 標準 ${row.seconds.toFixed(1)}秒`
    + ` サブ行動 自分${row.selfRuleEffects}/他人${row.otherRuleEffects}`,
  );
}
console.log(`ecology-beats smoke: 7区画で拍の規則が成り立っている（自分${totalSelf}件・他人${totalOther}件）`);
