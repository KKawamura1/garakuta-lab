// **遊ぶ側から見た規則の版と、そのときの指紋。**
//
// 指紋は `analysis/rules-fingerprint.mjs` が挙動から計算する。
// **規則が変わったのに版が据え置きだと `analysis/smoke-version.mjs` が落ちる。**
// 落ちたら、版を上げてここを書き換える（何を変えたかも一緒に残す）。
//
// 履歴：
//   laws-0.1 … 最初の法則機関。1巡決着で無傷が取れてしまう穴があった
//   laws-0.2 … 敵に1巡上限、偏食を削除、天井を通さずに出す
export const RULES_VERSION = "laws-0.2";
export const RULES_FINGERPRINT = "e3ebc78d0c83";
