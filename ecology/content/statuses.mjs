// ecology/content/statuses.mjs
//
// **状態異常の表示名。規則そのものは fixture 側にある。**
// R7 Milestone 0 で playable-content.mjs / playable-battles.mjs から
// 種類別へ分離した。**挙動は1バイトも変えていない**（ecology/contract.test.mjs が
// 分離前の出力と深一致を見る）。
//
// ここを触ってよいのは 統合 担当だけ。engine・schema・共通registryは変更しない。

import { renamed, scaleFlatAmounts } from "./base.mjs";

export const STATUS_NAMES = {
  exposed: "隙",
  focused: "集中",
};

export const STATUSES = renamed("statuses", STATUS_NAMES);

// 状態異常の増減も parameter 非依存の flat。隙も集中も、誰が持っても同じだけ動かす。
for (const definition of Object.values(STATUSES)) scaleFlatAmounts(definition);

