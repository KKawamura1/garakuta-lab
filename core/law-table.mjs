// 出してよい法則の組の表。**analysis/tune-laws.mjs が生成する。手で編集しない。**
//
// 生成条件（T1 詰みを作らない／T2 締まっている／T3 順序が効く）と、
// 天井の条件（最上位の等級が1戦で半数以上に到達されない）を通った組だけが載っている。

export const LAW_TABLE = [
 {
  "laws": [
   "monotony",
   "bias"
  ],
  "name": "単調＋偏食",
  "scales": [
   0.53,
   0.59,
   1,
   0.62,
   0.79,
   0.98
  ],
  "atkScales": [
   2.2,
   2.2,
   1,
   2.2,
   1.5,
   1.5
  ],
  "modScales": [
   1,
   2.5,
   1,
   2.5,
   1,
   1
  ],
  "enemyHp": [
   204,
   125,
   288,
   202,
   261,
   188
  ],
  "safeRate": 1,
  "winMedian": 0.061,
  "decided": 1,
  "flawlessReach": 0.183
 },
 {
  "laws": [
   "relay",
   "bias"
  ],
  "name": "継電＋偏食",
  "scales": [
   0.99,
   0.75,
   1.34,
   0.99,
   1.04,
   1.3
  ],
  "atkScales": [
   1.5,
   2.2,
   1,
   2.2,
   1.5,
   1.5
  ],
  "modScales": [
   1,
   2.5,
   1,
   1,
   1,
   1
  ],
  "enemyHp": [
   380,
   158,
   388,
   325,
   343,
   250
  ],
  "safeRate": 1,
  "winMedian": 0.068,
  "decided": 1,
  "flawlessReach": 0.104
 }
];

export default LAW_TABLE;
