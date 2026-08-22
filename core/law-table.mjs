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
   1.63,
   1.33,
   2.26,
   1.75
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
   473,
   436,
   744,
   336
  ],
  "safeRate": 1,
  "winMedian": 0.093,
  "decided": 1,
  "flawlessReach": 0.987,
  "ceilings": [
   0.987,
   0.905,
   0.666,
   0.882,
   0.799,
   0.879
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
   0.73,
   1.52,
   0.76,
   1.55,
   1.1
  ],
  "atkScales": [
   2.2,
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
   154,
   440,
   248,
   508,
   210
  ],
  "safeRate": 1,
  "winMedian": 0.067,
  "decided": 1,
  "flawlessReach": 0.856,
  "ceilings": [
   0.707,
   0.856,
   0.568,
   0.643,
   0.357,
   0.568
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
   0.78,
   0.63
  ],
  "atkScales": [
   1,
   1.5,
   1.5,
   2.2,
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
   255,
   122
  ],
  "safeRate": 0.992,
  "winMedian": 0.086,
  "decided": 0.992,
  "flawlessReach": 0.191,
  "ceilings": [
   0.152,
   0,
   0.191,
   0.09,
   0,
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
   1.59,
   1.4,
   1.77,
   1.4
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
   42,
   58,
   66,
   66,
   38
  ],
  "enemyHp": [
   414,
   342,
   459,
   458,
   582,
   268
  ],
  "safeRate": 1,
  "winMedian": 0.056,
  "decided": 1,
  "flawlessReach": 0.776,
  "ceilings": [
   0.736,
   0.776,
   0.715,
   0.625,
   0.699,
   0.74
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
   0.59
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
   114
  ],
  "safeRate": 1,
  "winMedian": 0.071,
  "decided": 1,
  "flawlessReach": 0.691,
  "ceilings": [
   0.438,
   0.068,
   0.691,
   0.465,
   0.41,
   0.023
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
   1.15,
   0.68,
   1.02,
   1.34
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
   64
  ],
  "enemyHp": [
   375,
   224,
   332,
   224,
   336,
   256
  ],
  "safeRate": 1,
  "winMedian": 0.053,
  "decided": 1,
  "flawlessReach": 0.687,
  "ceilings": [
   0.639,
   0.431,
   0.445,
   0.687,
   0.402,
   0.452
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
   0.64,
   0.59
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
   210,
   114
  ],
  "safeRate": 0.983,
  "winMedian": 0.077,
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
   2.58,
   1.61,
   2.45,
   1.27
  ],
  "atkScales": [
   3.2,
   3.2,
   1,
   3.2,
   1.5,
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
   744,
   528,
   806,
   244
  ],
  "safeRate": 1,
  "winMedian": 0.052,
  "decided": 1,
  "flawlessReach": 0.796,
  "ceilings": [
   0.77,
   0.796,
   0.726,
   0.699,
   0.465,
   0.733
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
   1.71
  ],
  "atkScales": [
   1.5,
   3.2,
   1,
   1,
   1,
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
   128,
   42,
   58,
   66,
   66,
   64
  ],
  "enemyHp": [
   500,
   145,
   384,
   399,
   462,
   328
  ],
  "safeRate": 1,
  "winMedian": 0.062,
  "decided": 1,
  "flawlessReach": 0.793,
  "ceilings": [
   0.62,
   0.424,
   0.722,
   0.793,
   0.6,
   0.54
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
   1.02,
   0.8,
   0.6,
   0.6,
   0.65
  ],
  "atkScales": [
   1,
   1.5,
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
   216,
   231,
   198,
   198,
   124
  ],
  "safeRate": 0.992,
  "winMedian": 0.083,
  "decided": 0.992,
  "flawlessReach": 0.438,
  "ceilings": [
   0.438,
   0,
   0.191,
   0.3,
   0.046,
   0.012
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
   0.73,
   1.03,
   0.87,
   1.03,
   0.76
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
   375,
   154,
   297,
   284,
   340,
   146
  ],
  "safeRate": 1,
  "winMedian": 0.063,
  "decided": 1,
  "flawlessReach": 0.662,
  "ceilings": [
   0.424,
   0.191,
   0.662,
   0.424,
   0.445,
   0.247
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
   1.29,
   1.54,
   0.75,
   1.59,
   1.2
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
   96,
   66,
   110,
   38
  ],
  "enemyHp": [
   456,
   273,
   444,
   246,
   522,
   230
  ],
  "safeRate": 1,
  "winMedian": 0.058,
  "decided": 1,
  "flawlessReach": 0.802,
  "ceilings": [
   0.76,
   0.54,
   0.643,
   0.802,
   0.417,
   0.424
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
   1.31,
   0.98,
   1.18,
   1.11,
   1.52
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
   318,
   278,
   282,
   388,
   366,
   292
  ],
  "safeRate": 1,
  "winMedian": 0.062,
  "decided": 1,
  "flawlessReach": 0.822,
  "ceilings": [
   0.438,
   0.431,
   0.822,
   0.491,
   0.431,
   0.491
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
   1.42,
   1.61,
   1.23,
   1.92,
   2.32
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
   301,
   464,
   403,
   630,
   444
  ],
  "safeRate": 1,
  "winMedian": 0.114,
  "decided": 1,
  "flawlessReach": 0.996,
  "ceilings": [
   0.996,
   0.957,
   0.957,
   0.994,
   0.67,
   0.74
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
   1.88,
   1.85,
   2.88,
   2.27,
   3.11
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
   64
  ],
  "enemyHp": [
   864,
   399,
   533,
   945,
   746,
   596
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
   0.82
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "silence",
   "overload"
  ],
  "name": "静粛＋過負荷",
  "scales": [
   0.73,
   1.27,
   0.76,
   0.87,
   1.75,
   1.33
  ],
  "atkScales": [
   3.2,
   1.5,
   2.2,
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
   38
  ],
  "enemyHp": [
   281,
   268,
   220,
   287,
   576,
   254
  ],
  "safeRate": 1,
  "winMedian": 0.086,
  "decided": 1,
  "flawlessReach": 0.947,
  "ceilings": [
   0.932,
   0.946,
   0.726,
   0.947,
   0.666,
   0.757
  ],
  "ceilingPassed": false
 }
];

export default LAW_TABLE;
