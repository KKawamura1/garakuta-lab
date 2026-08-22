// 出してよい法則の組の表。**analysis/tune-laws.mjs が生成する。手で編集しない。**
//
// 生成条件（T1 詰みを作らない／T2 締まっている／T3 順序が効く）と、
// 天井の条件（最上位の等級が1戦で半数以上に到達されない）を通った組だけが載っている。

export const LAW_TABLE = [
 {
  "laws": [
   "vanguard",
   "monotony"
  ],
  "name": "先陣＋単調",
  "scales": [
   0.88,
   0.98,
   1.54,
   0.75,
   1.33,
   1.47
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
   77,
   42,
   96,
   66,
   66,
   64
  ],
  "enemyHp": [
   337,
   207,
   446,
   246,
   436,
   282
  ],
  "safeRate": 1,
  "winMedian": 0.071,
  "decided": 1,
  "flawlessReach": 0.868,
  "ceilings": [
   0.868,
   0.431,
   0.699,
   0.504,
   0.424,
   0.349
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "vanguard",
   "fade"
  ],
  "name": "先陣＋減衰",
  "scales": [
   0.64,
   0.9,
   0.62,
   0.6,
   0.81,
   0.61
  ],
  "atkScales": [
   1,
   1,
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
   42,
   58,
   66,
   66,
   38
  ],
  "enemyHp": [
   244,
   191,
   178,
   198,
   265,
   117
  ],
  "safeRate": 0.992,
  "winMedian": 0.134,
  "decided": 0.992,
  "flawlessReach": 0.845,
  "ceilings": [
   0.265,
   0,
   0.845,
   0.417,
   0.046,
   0
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
   0.72,
   0.86,
   0.68,
   0.7,
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
   277,
   182,
   198,
   230,
   262,
   114
  ],
  "safeRate": 1,
  "winMedian": 0.074,
  "decided": 1,
  "flawlessReach": 0.779,
  "ceilings": [
   0.387,
   0.162,
   0.779,
   0.497,
   0.41,
   0.057
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "counter",
   "reflect"
  ],
  "name": "反継電＋反射",
  "scales": [
   1.07,
   1.61,
   1.26,
   0.69,
   1.28,
   1.42
  ],
  "atkScales": [
   1,
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
   64
  ],
  "enemyHp": [
   408,
   341,
   364,
   227,
   420,
   272
  ],
  "safeRate": 1,
  "winMedian": 0.082,
  "decided": 1,
  "flawlessReach": 0.966,
  "ceilings": [
   0.966,
   0.325,
   0.62,
   0.773,
   0.349,
   0.3
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
   0.96,
   1.04,
   1.34,
   0.8,
   1.48,
   1.22
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
   1.6,
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
   38
  ],
  "enemyHp": [
   366,
   220,
   386,
   261,
   486,
   234
  ],
  "safeRate": 1,
  "winMedian": 0.09,
  "decided": 1,
  "flawlessReach": 0.923,
  "ceilings": [
   0.923,
   0.832,
   0.733,
   0.873,
   0.67,
   0.643
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "counter",
   "silence"
  ],
  "name": "反継電＋静粛",
  "scales": [
   0.72,
   0.65,
   1.54,
   0.75,
   2.23,
   2.14
  ],
  "atkScales": [
   3.2,
   3.2,
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
   42,
   58,
   66,
   110,
   64
  ],
  "enemyHp": [
   275,
   138,
   446,
   244,
   733,
   411
  ],
  "safeRate": 1,
  "winMedian": 0.119,
  "decided": 1,
  "flawlessReach": 0.983,
  "ceilings": [
   0.959,
   0.918,
   0.971,
   0.983,
   0.459,
   0.733
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "relay",
   "vanguard"
  ],
  "name": "継電＋先陣",
  "scales": [
   0.6,
   1,
   1.47,
   0.75,
   1.76,
   1.11
  ],
  "atkScales": [
   3.2,
   2.2,
   1,
   2.2,
   1,
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
  "cycleCaps": [
   77,
   42,
   58,
   66,
   110,
   64
  ],
  "enemyHp": [
   232,
   212,
   424,
   246,
   579,
   213
  ],
  "safeRate": 1,
  "winMedian": 0.064,
  "decided": 1,
  "flawlessReach": 0.757,
  "ceilings": [
   0.333,
   0.691,
   0.757,
   0.695,
   0.534,
   0.459
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
   1.04,
   1.46,
   1.03,
   1.01,
   1.03,
   0.71
  ],
  "atkScales": [
   1,
   1,
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
   96,
   66,
   66,
   38
  ],
  "enemyHp": [
   398,
   308,
   297,
   332,
   339,
   137
  ],
  "safeRate": 1,
  "winMedian": 0.074,
  "decided": 1,
  "flawlessReach": 0.852,
  "ceilings": [
   0.438,
   0.274,
   0.852,
   0.51,
   0.485,
   0.472
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
   0.67,
   1.18,
   0.96,
   1.24,
   1.41,
   0.87
  ],
  "atkScales": [
   2.2,
   1.5,
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
   77,
   42,
   58,
   66,
   110,
   38
  ],
  "enemyHp": [
   258,
   250,
   276,
   406,
   464,
   166
  ],
  "safeRate": 1,
  "winMedian": 0.058,
  "decided": 1,
  "flawlessReach": 0.67,
  "ceilings": [
   0.438,
   0.478,
   0.67,
   0.395,
   0.54,
   0.438
  ],
  "ceilingPassed": false
 },
 {
  "laws": [
   "overload",
   "monotony"
  ],
  "name": "過負荷＋単調",
  "scales": [
   0.76,
   1.21,
   0.63,
   1.18,
   0.75,
   0.68
  ],
  "atkScales": [
   1,
   1,
   1,
   1,
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
   71,
   58,
   109,
   66,
   38
  ],
  "enemyHp": [
   290,
   256,
   182,
   386,
   246,
   131
  ],
  "safeRate": 1,
  "winMedian": 0.121,
  "decided": 1,
  "flawlessReach": 0.904,
  "ceilings": [
   0.81,
   0.864,
   0.904,
   0.431,
   0.491,
   0.402
  ],
  "ceilingPassed": false
 }
];

export default LAW_TABLE;
