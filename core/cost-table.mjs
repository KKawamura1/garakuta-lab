// 出してよい法則の組の表。**analysis/tune-laws.mjs が生成する。手で編集しない。**
//
// 生成条件（T1 詰みを作らない／T2 締まっている／T3 順序が効く）と、
// 天井の条件（最上位の等級が1戦で半数以上に到達されない）を通った組だけが載っている。

// **暴走あり（代償の版）の表。** 素の表とは別物である。

export const COST_TABLE = [
 {
  "laws": [
   "vanguard",
   "reflect"
  ],
  "name": "先陣＋反射",
  "scales": [
   1.03,
   1.21,
   1.16,
   1.01,
   1.06,
   1.01
  ],
  "atkScales": [
   1,
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
   2.5,
   1,
   1
  ],
  "cycleCaps": [
   77,
   42,
   96,
   109,
   66,
   64
  ],
  "enemyHp": [
   394,
   256,
   336,
   333,
   348,
   195
  ],
  "safeRate": 1,
  "winMedian": 0.061,
  "decided": 1,
  "flawlessReach": 0.927,
  "ceilings": [
   0.528,
   0.699,
   0.927,
   0.465,
   0.579,
   0.557
  ],
  "ceilingPassed": false,
  "rho": -0.482
 },
 {
  "laws": [
   "resonance",
   "monotony"
  ],
  "name": "共鳴＋単調",
  "scales": [
   0.85,
   0.89,
   1.15,
   0.93,
   1.07,
   0.69
  ],
  "atkScales": [
   1.5,
   2.2,
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
   96,
   66,
   110,
   38
  ],
  "enemyHp": [
   324,
   188,
   332,
   303,
   351,
   133
  ],
  "safeRate": 1,
  "winMedian": 0.053,
  "decided": 1,
  "flawlessReach": 0.557,
  "ceilings": [
   0.491,
   0.546,
   0.557,
   0.497,
   0.424,
   0.333
  ],
  "ceilingPassed": false,
  "rho": -0.241
 },
 {
  "laws": [
   "counter",
   "vanguard"
  ],
  "name": "反継電＋先陣",
  "scales": [
   0.94,
   1.42,
   1.16,
   0.7,
   1.11,
   0.94
  ],
  "atkScales": [
   2.2,
   1.5,
   1,
   3.2,
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
   66,
   66,
   38
  ],
  "enemyHp": [
   358,
   300,
   336,
   229,
   364,
   180
  ],
  "safeRate": 1,
  "winMedian": 0.051,
  "decided": 1,
  "flawlessReach": 0.648,
  "ceilings": [
   0.528,
   0.497,
   0.648,
   0.625,
   0.431,
   0.452
  ],
  "ceilingPassed": false,
  "rho": -0.164
 },
 {
  "laws": [
   "balance",
   "monotony"
  ],
  "name": "均衡＋単調",
  "scales": [
   0.77,
   1.08,
   1.06,
   0.65,
   1.22,
   0.73
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
   296,
   228,
   306,
   213,
   402,
   141
  ],
  "safeRate": 1,
  "winMedian": 0.052,
  "decided": 1,
  "flawlessReach": 0.6,
  "ceilings": [
   0.562,
   0.387,
   0.573,
   0.465,
   0.6,
   0.431
  ],
  "ceilingPassed": false,
  "rho": -0.211
 },
 {
  "laws": [
   "relay",
   "resonance"
  ],
  "name": "継電＋共鳴",
  "scales": [
   0.83,
   1.53,
   1.06,
   1.17,
   1.35,
   0.77
  ],
  "atkScales": [
   2.2,
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
   1.6,
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
   317,
   325,
   306,
   383,
   444,
   148
  ],
  "safeRate": 1,
  "winMedian": 0.051,
  "decided": 1,
  "flawlessReach": 0.674,
  "ceilings": [
   0.465,
   0.674,
   0.62,
   0.459,
   0.562,
   0.573
  ],
  "ceilingPassed": false,
  "rho": -0.3
 },
 {
  "laws": [
   "relay",
   "counter"
  ],
  "name": "継電＋反継電",
  "scales": [
   0.68,
   1.43,
   0.92,
   0.66,
   0.99,
   0.61
  ],
  "atkScales": [
   2.2,
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
   262,
   302,
   264,
   215,
   324,
   117
  ],
  "safeRate": 1,
  "winMedian": 0.054,
  "decided": 1,
  "flawlessReach": 0.485,
  "ceilings": [
   0.417,
   0.452,
   0.485,
   0.395,
   0.438,
   0.445
  ],
  "ceilingPassed": true,
  "rho": -0.267
 },
 {
  "laws": [
   "relay",
   "balance"
  ],
  "name": "継電＋均衡",
  "scales": [
   1.05,
   0.65,
   1.1,
   1.26,
   1.17,
   0.63
  ],
  "atkScales": [
   2.2,
   3.2,
   1,
   1,
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
   128,
   42,
   58,
   109,
   110,
   38
  ],
  "enemyHp": [
   402,
   137,
   318,
   413,
   384,
   121
  ],
  "safeRate": 1,
  "winMedian": 0.052,
  "decided": 1,
  "flawlessReach": 0.718,
  "ceilings": [
   0.718,
   0.674,
   0.62,
   0.674,
   0.643,
   0.465
  ],
  "ceilingPassed": false,
  "rho": -0.146
 },
 {
  "laws": [
   "buildup",
   "wear"
  ],
  "name": "蓄積＋消耗",
  "scales": [
   0.82,
   1.23,
   1.26,
   1.01,
   1.07,
   0.92
  ],
  "atkScales": [
   1,
   2.2,
   1,
   2.2,
   1.5,
   1.5
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
   66,
   38
  ],
  "enemyHp": [
   313,
   260,
   365,
   330,
   352,
   177
  ],
  "safeRate": 1,
  "winMedian": 0.103,
  "decided": 1,
  "flawlessReach": 1,
  "ceilings": [
   1,
   0.995,
   0.963,
   0.996,
   0.976,
   0.958
  ],
  "ceilingPassed": false,
  "rho": -0.306
 },
 {
  "laws": [
   "buildup",
   "fade"
  ],
  "name": "蓄積＋減衰",
  "scales": [
   0.71,
   1.19,
   1.18,
   1,
   1.05,
   0.76
  ],
  "atkScales": [
   2.2,
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
   71,
   96,
   109,
   66,
   38
  ],
  "enemyHp": [
   271,
   253,
   341,
   327,
   345,
   146
  ],
  "safeRate": 0.992,
  "winMedian": 0.067,
  "decided": 0.992,
  "flawlessReach": 0.478,
  "ceilings": [
   0.478,
   0.431,
   0.452,
   0.229,
   0.431,
   0.3
  ],
  "ceilingPassed": true,
  "rho": -0.214
 },
 {
  "laws": [
   "overload",
   "wear"
  ],
  "name": "過負荷＋消耗",
  "scales": [
   0.63,
   0.67,
   1,
   0.61,
   1.18,
   0.59
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
   1.6,
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
   110,
   38
  ],
  "enemyHp": [
   240,
   142,
   288,
   200,
   388,
   114
  ],
  "safeRate": 0.983,
  "winMedian": 0.123,
  "decided": 0.983,
  "flawlessReach": 0.998,
  "ceilings": [
   0.963,
   0.998,
   0.788,
   0.991,
   0.815,
   0.722
  ],
  "ceilingPassed": false,
  "rho": -0.08
 },
 {
  "laws": [
   "silence",
   "vanguard"
  ],
  "name": "静粛＋先陣",
  "scales": [
   1.26,
   1.81,
   1.28,
   1.31,
   1.27,
   1.19
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
   1,
   1,
   1
  ],
  "cycleCaps": [
   128,
   71,
   96,
   109,
   110,
   64
  ],
  "enemyHp": [
   483,
   384,
   368,
   429,
   416,
   228
  ],
  "safeRate": 1,
  "winMedian": 0.051,
  "decided": 1,
  "flawlessReach": 0.81,
  "ceilings": [
   0.753,
   0.634,
   0.81,
   0.79,
   0.643,
   0.715
  ],
  "ceilingPassed": false,
  "rho": -0.209
 },
 {
  "laws": [
   "silence",
   "monotony"
  ],
  "name": "静粛＋単調",
  "scales": [
   0.65,
   1.1,
   1,
   1.17,
   1,
   1
  ],
  "atkScales": [
   1.5,
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
   1,
   1,
   1
  ],
  "cycleCaps": [
   77,
   42,
   96,
   109,
   66,
   64
  ],
  "enemyHp": [
   247,
   234,
   288,
   384,
   328,
   192
  ],
  "safeRate": 0.992,
  "winMedian": 0.068,
  "decided": 0.992,
  "flawlessReach": 0.726,
  "ceilings": [
   0.722,
   0.691,
   0.726,
   0.699,
   0.431,
   0.333
  ],
  "ceilingPassed": false,
  "rho": -0.215
 },
 {
  "laws": [
   "silence",
   "overload"
  ],
  "name": "静粛＋過負荷",
  "scales": [
   0.8,
   1.08,
   1,
   0.82,
   1.49,
   0.59
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
   1.6,
   1,
   1,
   1,
   1
  ],
  "cycleCaps": [
   77,
   42,
   96,
   66,
   110,
   38
  ],
  "enemyHp": [
   305,
   229,
   288,
   267,
   490,
   114
  ],
  "safeRate": 0.983,
  "winMedian": 0.082,
  "decided": 0.983,
  "flawlessReach": 0.935,
  "ceilings": [
   0.935,
   0.87,
   0.898,
   0.884,
   0.557,
   0.832
  ],
  "ceilingPassed": false,
  "rho": -0.106
 }
];

export default COST_TABLE;
