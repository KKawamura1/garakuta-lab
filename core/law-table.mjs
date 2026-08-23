// 出してよい法則の組の表。**analysis/tune-laws.mjs が生成する。手で編集しない。**
//
// 生成条件（T1 詰みを作らない／T2 締まっている／T3 順序が効く）と、
// 天井の条件（最上位の等級が1戦で半数以上に到達されない）を通った組だけが載っている。

export const LAW_TABLE = [
 {
  "laws": [
   "vanguard",
   "haste"
  ],
  "name": "先陣＋倍速",
  "scales": [
   1.26,
   2.53,
   1.86,
   1.33,
   2.3,
   1.47
  ],
  "atkScales": [
   2.2,
   1.5,
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
   77,
   71,
   58,
   109,
   110,
   38
  ],
  "enemyHp": [
   482,
   536,
   536,
   436,
   756,
   282
  ],
  "safeRate": 1,
  "winMedian": 0.089,
  "decided": 1,
  "flawlessReach": 0.987,
  "ceilings": [
   0.987,
   0.905,
   0.357,
   0.882,
   0.766,
   0.88
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
   "fade"
  ],
  "name": "共鳴＋減衰",
  "scales": [
   0.65,
   1,
   0.65,
   0.6,
   0.68,
   0.71
  ],
  "atkScales": [
   1,
   1.5,
   1.5,
   2.2,
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
   71,
   58,
   66,
   66,
   38
  ],
  "enemyHp": [
   249,
   213,
   187,
   198,
   224,
   137
  ],
  "safeRate": 0.992,
  "winMedian": 0.089,
  "decided": 0.992,
  "flawlessReach": 0.191,
  "ceilings": [
   0.152,
   0,
   0.191,
   0.09,
   0.012,
   0
  ],
  "ceilingPassed": true
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
   "reflect",
   "monotony"
  ],
  "name": "反射＋単調",
  "scales": [
   0.73,
   0.9,
   0.69,
   0.75,
   0.8,
   0.68
  ],
  "atkScales": [
   1,
   1.5,
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
   42,
   58,
   66,
   66,
   38
  ],
  "enemyHp": [
   278,
   190,
   198,
   244,
   262,
   131
  ],
  "safeRate": 1,
  "winMedian": 0.076,
  "decided": 1,
  "flawlessReach": 0.691,
  "ceilings": [
   0.438,
   0.068,
   0.691,
   0.465,
   0.41,
   0.046
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "counter",
   "monotony"
  ],
  "name": "反継電＋単調",
  "scales": [
   0.98,
   1.06,
   1.14,
   0.69,
   1.02,
   1.02
  ],
  "atkScales": [
   1.5,
   2.2,
   1,
   2.2,
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
  "cycleCaps": [
   77,
   42,
   58,
   66,
   66,
   38
  ],
  "enemyHp": [
   375,
   224,
   329,
   226,
   336,
   196
  ],
  "safeRate": 1,
  "winMedian": 0.055,
  "decided": 1,
  "flawlessReach": 0.687,
  "ceilings": [
   0.639,
   0.431,
   0.438,
   0.687,
   0.402,
   0.395
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "counter",
   "fade"
  ],
  "name": "反継電＋減衰",
  "scales": [
   0.6,
   0.59,
   0.6,
   0.6,
   0.63,
   0.65
  ],
  "atkScales": [
   1,
   2.2,
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
   42,
   58,
   66,
   66,
   38
  ],
  "enemyHp": [
   231,
   126,
   175,
   198,
   209,
   125
  ],
  "safeRate": 0.983,
  "winMedian": 0.084,
  "decided": 0.983,
  "flawlessReach": 0.22,
  "ceilings": [
   0.111,
   0,
   0.22,
   0.1,
   0.068,
   0
  ],
  "ceilingPassed": true
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
   "monotony"
  ],
  "name": "均衡＋単調",
  "scales": [
   1.31,
   0.68,
   1.33,
   1.22,
   1.41,
   0.59
  ],
  "atkScales": [
   1.5,
   3.2,
   1,
   1,
   1,
   2.2
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
   128,
   42,
   58,
   66,
   66,
   38
  ],
  "enemyHp": [
   500,
   145,
   384,
   399,
   462,
   114
  ],
  "safeRate": 1,
  "winMedian": 0.071,
  "decided": 1,
  "flawlessReach": 0.793,
  "ceilings": [
   0.62,
   0.424,
   0.722,
   0.793,
   0.6,
   0.459
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "balance",
   "fade"
  ],
  "name": "均衡＋減衰",
  "scales": [
   0.65,
   1.17,
   0.8,
   0.6,
   0.6,
   0.75
  ],
  "atkScales": [
   1,
   1,
   1,
   2.2,
   2.2,
   1
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
   71,
   58,
   66,
   66,
   38
  ],
  "enemyHp": [
   249,
   248,
   231,
   198,
   198,
   144
  ],
  "safeRate": 0.992,
  "winMedian": 0.082,
  "decided": 0.992,
  "flawlessReach": 0.438,
  "ceilings": [
   0.438,
   0.012,
   0.191,
   0.3,
   0.046,
   0
  ],
  "ceilingPassed": true
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
   "overload",
   "wear"
  ],
  "name": "過負荷＋消耗",
  "scales": [
   0.63,
   0.6,
   0.71,
   0.88,
   1.58,
   1.42
  ],
  "atkScales": [
   3.2,
   3.2,
   2.2,
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
   42,
   58,
   66,
   66,
   64
  ],
  "enemyHp": [
   242,
   126,
   206,
   288,
   518,
   273
  ],
  "safeRate": 1,
  "winMedian": 0.114,
  "decided": 1,
  "flawlessReach": 0.922,
  "ceilings": [
   0.917,
   0.782,
   0.715,
   0.912,
   0.841,
   0.922
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "silence",
   "vanguard"
  ],
  "name": "静粛＋先陣",
  "scales": [
   1.18,
   1.53,
   1.61,
   1.23,
   1.92,
   1.85
  ],
  "atkScales": [
   2.2,
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
   77,
   42,
   58,
   66,
   66,
   64
  ],
  "enemyHp": [
   451,
   324,
   464,
   403,
   630,
   355
  ],
  "safeRate": 1,
  "winMedian": 0.113,
  "decided": 1,
  "flawlessReach": 0.996,
  "ceilings": [
   0.996,
   0.92,
   0.957,
   0.994,
   0.67,
   0.753
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
