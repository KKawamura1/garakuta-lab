// ecology/content/statuses.mjs
//
// **状態異常の表示名と規則。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。fixture 由来の2つ（隙・集中）は**挙動を変えていない**
// （ecology/contract.test.mjs が分離前の出力と深一致を見る）。
//
// R16 — **状態を3つ足した。**技能を大量に増やすとき、既存の「隙」「集中」だけを
// 相方にすると、どの新技能も「隙を付ける／集中を得る」の言い換えになる。
// 足したのは**軸の違う3つ**で、どれも engine 語彙を増やさない
// （damage_proposed への interrupt と round_ended への after だけで書けている）。
//
//   怯み staggered … **持ち主が出す**ダメージが減る。守りを攻めの手で作る軸。
//   守勢 warded   … **持ち主が受ける**ダメージが減る。防壁（総量）でも
//                   受け構え（回数）でもない三つ目の守り。細かい多段に強く、
//                   一撃の大技には弱い（減る量が固定だから）。
//   裂傷 bleeding … ラウンド終わりに一度だけ、段数ぶんの固定ダメージ。
//                   受けを無視するので、硬い相手へ通る細い線になる。
//
// **どれも round で消える。**待って積み上げる形にはしていない（AGENTS.md の
// anti-stall）。裂傷は「置いた round の終わりに一度」しか刻まない。
//
// engine・schema・共通registryは変更しない。

import { renamed, scaleFlatAmounts } from "./base.mjs";

export const STATUS_NAMES = {
  exposed: "隙",
  focused: "集中",
  staggered: "怯み",
  warded: "守勢",
  bleeding: "裂傷",
};

const statuses = renamed("statuses", STATUS_NAMES);

// 状態異常の増減も parameter 非依存の flat。隙も集中も、誰が持っても同じだけ動かす。
// **ここは fixture 由来の2つだけに掛ける。**下で足す3つは最終値で書いてある
// （10倍移行より後に生まれたので、旧尺度の値を持っていない）。
for (const definition of Object.values(statuses)) scaleFlatAmounts(definition);

const SELF_TARGET = { scope: "self", take: 1 };
const SELF_IS_EVENT_SOURCE = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_source" }], take: 1 },
};
const SELF_IS_EVENT_TARGET = {
  type: "target_exists",
  query: { scope: "self", filters: [{ type: "is_event_primary_target" }], take: 1 },
};

// 段数ぶんの固定量。**持ち主の parameter は読まない**（誰が持っても同じだけ動く）。
const perStack = (statusId, perStackAmount) => ({
  type: "status_stacks_scaled",
  subject: "self",
  statusId,
  numerator: perStackAmount,
  denominator: 1,
});

// 怯み — 持ち主が出すダメージが、1段につき8軽くなる。
// **「殴られる前に殴る」以外の止め方**を、攻め手側の語彙で作るためにある。
statuses.staggered = {
  id: "staggered",
  displayName: STATUS_NAMES.staggered,
  polarity: "negative",
  maxStacks: 2,
  duration: "round",
  rules: [{
    id: "staggered_rule",
    listenTo: "damage_proposed",
    timing: "interrupt",
    priority: 45,
    predicates: [SELF_IS_EVENT_SOURCE],
    costs: [],
    effects: [{
      type: "modify_pending_amount",
      operation: "decrease",
      amount: perStack("staggered", 8),
    }],
    limit: { scope: "chain", count: 1 },
  }],
  tags: ["playable", "debuff"],
};

// 守勢 — 持ち主が受けるダメージが、1段につき8軽くなる。
// **防壁・受け構えと三つ巴になる。**防壁は総量を、受け構えは回数を、
// 守勢は一撃ごとの厚みを引き受ける。だから多段に強く、大技には薄い。
statuses.warded = {
  id: "warded",
  displayName: STATUS_NAMES.warded,
  polarity: "positive",
  maxStacks: 2,
  duration: "round",
  rules: [{
    id: "warded_rule",
    listenTo: "damage_proposed",
    timing: "interrupt",
    priority: 45,
    predicates: [SELF_IS_EVENT_TARGET],
    costs: [],
    effects: [{
      type: "modify_pending_amount",
      operation: "decrease",
      amount: perStack("warded", 8),
    }],
    limit: { scope: "chain", count: 1 },
  }],
  tags: ["playable", "guard"],
};

// 裂傷 — ラウンド終わりに一度だけ、1段につき12。**受けを完全に無視する。**
// round で消えるので、待つほど増える形にはならない（AGENTS.md の anti-stall）。
statuses.bleeding = {
  id: "bleeding",
  displayName: STATUS_NAMES.bleeding,
  polarity: "negative",
  maxStacks: 3,
  duration: "round",
  rules: [{
    id: "bleeding_rule",
    listenTo: "round_ended",
    timing: "after",
    priority: 60,
    predicates: [],
    costs: [],
    effects: [{
      type: "deal_damage",
      target: SELF_TARGET,
      amount: perStack("bleeding", 12),
      guardPierceBps: 10_000,
      tags: ["bleed"],
    }],
    limit: { scope: "round", count: 1 },
  }],
  tags: ["playable", "debuff"],
};

export const STATUSES = statuses;
