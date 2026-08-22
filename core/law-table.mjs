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
   "reflect",
   "monotony"
  ],
  "name": "反射＋単調",
  "scales": [
   0.41,
   0.26,
   0.51,
   0.67,
   0.84,
   0.83
  ],
  "atkScales": [
   2.2,
   3.2,
   1.5,
   1.5,
   1,
   1
  ],
  "modScales": [
   1,
   1,
   1,
   1.6,
   1,
   1
  ],
  "enemyHp": [
   156,
   56,
   148,
   219,
   275,
   159
  ],
  "safeRate": 1,
  "winMedian": 0.052,
  "decided": 1,
  "flawlessReach": 0.349
 },
 {
  "laws": [
   "counter",
   "bias"
  ],
  "name": "反継電＋偏食",
  "scales": [
   0.49,
   0.81,
   0.79,
   1.73,
   1.75,
   1.86
  ],
  "atkScales": [
   3.2,
   2.2,
   1.5,
   1.5,
   1,
   1
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
   188,
   171,
   228,
   567,
   576,
   358
  ],
  "safeRate": 1,
  "winMedian": 0.069,
  "decided": 1,
  "flawlessReach": 0.196
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
 },
 {
  "laws": [
   "relay",
   "monotony"
  ],
  "name": "継電＋単調",
  "scales": [
   0.45,
   0.29,
   1.12,
   1.03,
   1.1,
   1.24
  ],
  "atkScales": [
   3.2,
   3.2,
   1,
   1.5,
   1,
   1
  ],
  "modScales": [
   1,
   1,
   1,
   1,
   1,
   1
  ],
  "enemyHp": [
   173,
   61,
   322,
   338,
   362,
   238
  ],
  "safeRate": 1,
  "winMedian": 0.065,
  "decided": 1,
  "flawlessReach": 0.255
 },
 {
  "laws": [
   "relay",
   "overload"
  ],
  "name": "継電＋過負荷",
  "scales": [
   1.3,
   1.19,
   0.63,
   1.22,
   1.16,
   1.73
  ],
  "atkScales": [
   1,
   1.5,
   2.2,
   1.5,
   1.5,
   1
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
   496,
   253,
   182,
   399,
   380,
   332
  ],
  "safeRate": 1,
  "winMedian": 0.069,
  "decided": 1,
  "flawlessReach": 0.454
 }
];

export default LAW_TABLE;
