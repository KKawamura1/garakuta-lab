// 締めつけの版の表。**analysis/tune-squeeze.mjs が生成する。手で編集しない。**
//
// 暴走（速く出すと自分が削れる）と毎巡回復（遅いと削り切れない）で両側から挟む。
// 通す条件：詰みなし90%以上・選択に勝目20%以上・相関が負・**無傷が残る局面が40%以下**。

export const SQUEEZE_TABLE = [
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
  "regenFrac": 0.04,
  "rho": -0.482,
  "flawless": 0.333
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
  "regenFrac": 0.015,
  "rho": -0.241,
  "flawless": 0
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
  "regenFrac": 0.025,
  "rho": -0.164,
  "flawless": 0
 },
 {
  "laws": [
   "balance",
   "monotony"
  ],
  "name": "均衡＋単調",
  "scales": [
   0.616,
   0.864,
   0.848,
   0.52,
   0.976,
   0.584
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
  "regenFrac": 0.04,
  "rho": -0.115,
  "flawless": 0.333
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
  "regenFrac": 0.04,
  "rho": -0.3,
  "flawless": 0
 },
 {
  "laws": [
   "relay",
   "counter"
  ],
  "name": "継電＋反継電",
  "scales": [
   0.442,
   0.929,
   0.598,
   0.429,
   0.643,
   0.397
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
  "regenFrac": 0.04,
  "rho": -0.095,
  "flawless": 0.2
 },
 {
  "laws": [
   "relay",
   "balance"
  ],
  "name": "継電＋均衡",
  "scales": [
   0.84,
   0.52,
   0.88,
   1.008,
   0.936,
   0.504
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
  "regenFrac": 0.04,
  "rho": -0.228,
  "flawless": 0.25
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
  "regenFrac": 0.025,
  "rho": -0.306,
  "flawless": 0.111
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
  "regenFrac": 0.015,
  "rho": -0.214,
  "flawless": 0
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
  "regenFrac": 0.04,
  "rho": -0.08,
  "flawless": 0.357
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
  "regenFrac": 0.04,
  "rho": -0.209,
  "flawless": 0
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
  "regenFrac": 0.025,
  "rho": -0.215,
  "flawless": 0
 },
 {
  "laws": [
   "silence",
   "overload"
  ],
  "name": "静粛＋過負荷",
  "scales": [
   0.64,
   0.864,
   0.8,
   0.656,
   1.192,
   0.472
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
  "regenFrac": 0.025,
  "rho": -0.115,
  "flawless": 0.4
 }
];

export default SQUEEZE_TABLE;
