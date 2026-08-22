// 出してよい法則の組の表。**analysis/tune-laws.mjs が生成する。手で編集しない。**
//
// 生成条件（T1 詰みを作らない／T2 締まっている／T3 順序が効く）と、
// 天井の条件（最上位の等級が1戦で半数以上に到達されない）を通った組だけが載っている。

export const LAW_TABLE = [
 {
  "laws": [
   "resonance",
   "bias"
  ],
  "name": "共鳴＋偏食",
  "scales": [
   0.72,
   0.66,
   1,
   0.92,
   0.9,
   1.27
  ],
  "atkScales": [
   3.2,
   3.2,
   1.5,
   3.2,
   2.2,
   2.2
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
   277,
   140,
   289,
   300,
   296,
   243
  ],
  "safeRate": 1,
  "winMedian": 0.094,
  "decided": 1,
  "flawlessReach": 0.402,
  "ceilings": [
   0.182,
   0.341,
   0.402,
   0.023,
   0.057,
   0.387
  ]
 },
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
  "flawlessReach": 0.38,
  "ceilings": [
   0.191,
   0.172,
   0.057,
   0.21,
   0.046,
   0.38
  ]
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
  "flawlessReach": 0.256,
  "ceilings": [
   0.023,
   0.09,
   0.057,
   0.068,
   0.111,
   0.256
  ]
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
  "flawlessReach": 0.437,
  "ceilings": [
   0.437,
   0.21,
   0.1,
   0.182,
   0.256,
   0.3
  ]
 }
];

export default LAW_TABLE;
