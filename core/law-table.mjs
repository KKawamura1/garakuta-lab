// 出してよい法則の組の表。**analysis/tune-laws.mjs が生成する。手で編集しない。**
//
// 生成条件（T1 詰みを作らない／T2 締まっている／T3 順序が効く）と、
// 天井の条件（最上位の等級が1戦で半数以上に到達されない）を通った組だけが載っている。

export const LAW_TABLE = [
 {
  "laws": [
   "resonance",
   "vanguard"
  ],
  "name": "共鳴＋先陣",
  "scales": [
   1.31,
   2.15,
   2.49,
   1.53,
   1.98,
   2.05
  ],
  "atkScales": [
   3.2,
   2.2,
   1,
   3.2,
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
  "cycleCaps": [
   77,
   71,
   96,
   66,
   66,
   64
  ],
  "enemyHp": [
   502,
   455,
   720,
   502,
   652,
   394
  ],
  "safeRate": 1,
  "winMedian": 0.063,
  "decided": 1,
  "flawlessReach": 0.887,
  "ceilings": [
   0.827,
   0.887,
   0.546,
   0.648,
   0.478,
   0.357
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "resonance",
   "reflect"
  ],
  "name": "共鳴＋反射",
  "scales": [
   1.09,
   0.72,
   1.52,
   0.76,
   1.55,
   0.65
  ],
  "atkScales": [
   2.2,
   3.2,
   1,
   3.2,
   1.5,
   2.2
  ],
  "modScales": [
   1,
   1.6,
   1,
   1.6,
   1,
   1
  ],
  "cycleCaps": [
   77,
   42,
   58,
   66,
   110,
   38
  ],
  "enemyHp": [
   416,
   152,
   440,
   248,
   508,
   125
  ],
  "safeRate": 1,
  "winMedian": 0.067,
  "decided": 1,
  "flawlessReach": 0.82,
  "ceilings": [
   0.707,
   0.82,
   0.568,
   0.643,
   0.357,
   0.41
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "resonance",
   "overload"
  ],
  "name": "共鳴＋過負荷",
  "scales": [
   1.08,
   1.62,
   0.7,
   1.42,
   1.77,
   1.82
  ],
  "atkScales": [
   3.2,
   2.2,
   2.2,
   3.2,
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
  "cycleCaps": [
   77,
   42,
   58,
   66,
   66,
   64
  ],
  "enemyHp": [
   414,
   342,
   202,
   464,
   582,
   348
  ],
  "safeRate": 1,
  "winMedian": 0.056,
  "decided": 1,
  "flawlessReach": 0.776,
  "ceilings": [
   0.736,
   0.776,
   0.657,
   0.605,
   0.699,
   0.722
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "counter",
   "vanguard"
  ],
  "name": "反継電＋先陣",
  "scales": [
   1.22,
   1.79,
   1.58,
   0.75,
   1.72,
   1.75
  ],
  "atkScales": [
   2.2,
   2.2,
   1,
   3.2,
   1,
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
  "cycleCaps": [
   77,
   71,
   58,
   66,
   66,
   64
  ],
  "enemyHp": [
   465,
   378,
   456,
   246,
   566,
   336
  ],
  "safeRate": 1,
  "winMedian": 0.078,
  "decided": 1,
  "flawlessReach": 0.945,
  "ceilings": [
   0.908,
   0.726,
   0.695,
   0.945,
   0.528,
   0.54
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "counter",
   "overload"
  ],
  "name": "反継電＋過負荷",
  "scales": [
   0.81,
   1.21,
   1.34,
   0.77,
   1.61,
   1.55
  ],
  "atkScales": [
   3.2,
   2.2,
   1,
   3.2,
   1,
   1
  ],
  "modScales": [
   1,
   1.6,
   1,
   2.5,
   1,
   1
  ],
  "cycleCaps": [
   77,
   42,
   58,
   66,
   66,
   64
  ],
  "enemyHp": [
   309,
   257,
   386,
   253,
   528,
   298
  ],
  "safeRate": 1,
  "winMedian": 0.059,
  "decided": 1,
  "flawlessReach": 0.815,
  "ceilings": [
   0.625,
   0.77,
   0.815,
   0.722,
   0.648,
   0.726
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "balance",
   "vanguard"
  ],
  "name": "均衡＋先陣",
  "scales": [
   1.45,
   2.03,
   2.59,
   1.61,
   2.45,
   1.33
  ],
  "atkScales": [
   3.2,
   3.2,
   1,
   3.2,
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
  "cycleCaps": [
   77,
   71,
   96,
   66,
   110,
   38
  ],
  "enemyHp": [
   555,
   429,
   748,
   528,
   806,
   256
  ],
  "safeRate": 1,
  "winMedian": 0.052,
  "decided": 1,
  "flawlessReach": 0.796,
  "ceilings": [
   0.77,
   0.796,
   0.67,
   0.699,
   0.465,
   0.657
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "balance",
   "reflect"
  ],
  "name": "均衡＋反射",
  "scales": [
   1.14,
   0.66,
   1.57,
   0.85,
   1.41,
   1.65
  ],
  "atkScales": [
   2.2,
   3.2,
   1,
   3.2,
   1.5,
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
  "cycleCaps": [
   77,
   42,
   58,
   66,
   66,
   64
  ],
  "enemyHp": [
   437,
   139,
   452,
   278,
   462,
   317
  ],
  "safeRate": 1,
  "winMedian": 0.073,
  "decided": 1,
  "flawlessReach": 0.89,
  "ceilings": [
   0.887,
   0.86,
   0.699,
   0.89,
   0.452,
   0.316
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "relay",
   "reflect"
  ],
  "name": "継電＋反射",
  "scales": [
   0.98,
   1.61,
   1.03,
   0.96,
   1.04,
   0.85
  ],
  "atkScales": [
   1,
   1,
   1,
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
  "cycleCaps": [
   77,
   71,
   96,
   66,
   66,
   38
  ],
  "enemyHp": [
   375,
   340,
   297,
   316,
   342,
   163
  ],
  "safeRate": 1,
  "winMedian": 0.063,
  "decided": 1,
  "flawlessReach": 0.662,
  "ceilings": [
   0.424,
   0.265,
   0.662,
   0.395,
   0.438,
   0.274
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "relay",
   "counter"
  ],
  "name": "継電＋反継電",
  "scales": [
   1.19,
   1.3,
   1.3,
   0.75,
   1.59,
   1.15
  ],
  "atkScales": [
   1.5,
   2.2,
   1,
   2.2,
   1,
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
  "cycleCaps": [
   128,
   71,
   58,
   66,
   110,
   38
  ],
  "enemyHp": [
   456,
   275,
   375,
   246,
   522,
   220
  ],
  "safeRate": 1,
  "winMedian": 0.057,
  "decided": 1,
  "flawlessReach": 0.802,
  "ceilings": [
   0.76,
   0.472,
   0.595,
   0.802,
   0.417,
   0.417
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "relay",
   "overload"
  ],
  "name": "継電＋過負荷",
  "scales": [
   0.83,
   1.34,
   0.98,
   1.51,
   1.13,
   1.35
  ],
  "atkScales": [
   2.2,
   1.5,
   1,
   1.5,
   1.5,
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
  "cycleCaps": [
   77,
   42,
   58,
   109,
   66,
   64
  ],
  "enemyHp": [
   318,
   284,
   282,
   496,
   372,
   259
  ],
  "safeRate": 1,
  "winMedian": 0.063,
  "decided": 1,
  "flawlessReach": 0.825,
  "ceilings": [
   0.438,
   0.395,
   0.825,
   0.424,
   0.417,
   0.465
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "buildup",
   "balance"
  ],
  "name": "蓄積＋均衡",
  "scales": [
   2.07,
   1.97,
   3.02,
   2.07,
   2.2,
   1.35
  ],
  "atkScales": [
   3.2,
   3.2,
   1.5,
   4.5,
   2.2,
   3.2
  ],
  "modScales": [
   1,
   2.5,
   1,
   1.6,
   1,
   1
  ],
  "cycleCaps": [
   77,
   42,
   96,
   66,
   66,
   38
  ],
  "enemyHp": [
   791,
   417,
   872,
   680,
   722,
   259
  ],
  "safeRate": 1,
  "winMedian": 0.109,
  "decided": 1,
  "flawlessReach": 1,
  "ceilings": [
   1,
   1,
   1,
   0.911,
   0.985,
   0.967
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "silence",
   "buildup"
  ],
  "name": "静粛＋蓄積",
  "scales": [
   2.26,
   1.9,
   1.85,
   2.88,
   2.27,
   1.47
  ],
  "atkScales": [
   3.2,
   3.2,
   1.5,
   2.2,
   1,
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
  "cycleCaps": [
   128,
   42,
   58,
   109,
   66,
   38
  ],
  "enemyHp": [
   864,
   403,
   533,
   945,
   746,
   282
  ],
  "safeRate": 1,
  "winMedian": 0.117,
  "decided": 1,
  "flawlessReach": 1,
  "ceilings": [
   1,
   1,
   1,
   0.998,
   0.699,
   0.736
  ],
  "ceilingPassed": false
 }
];

export default LAW_TABLE;
