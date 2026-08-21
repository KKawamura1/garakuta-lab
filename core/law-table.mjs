// 出してよい法則の組の表。**analysis/tune-laws.mjs が生成する。手で編集しない。**
//
// 生成条件（T1 詰みを作らない／T2 締まっている／T3 順序が効く）と、
// 天井の条件（最上位の等級が1戦で半数以上に到達されない）を通った組だけが載っている。
//
// JSON ではなく .mjs にしてあるのは、`import ... with { type: "json" }` が
// 端末によっては解釈できず、**画面が丸ごと出なくなったから**である（作者の iPhone で発生）。
// 素の ES モジュールなら、どこでも読める。

export const LAW_TABLE = [
 {
  "laws": [
   "resonance",
   "monotony"
  ],
  "name": "共鳴＋単調",
  "scales": [
   0.43,
   0.26,
   1.16,
   0.28,
   0.34,
   0.58
  ],
  "atkScales": [
   3.2,
   4.5,
   1,
   6,
   3.2,
   2.2
  ],
  "enemyHp": [
   167,
   55,
   337,
   93,
   113,
   111
  ],
  "safeRate": 1,
  "winMedian": 0.146,
  "decided": 1,
  "flawlessReach": 0.5
 },
 {
  "laws": [
   "counter",
   "monotony"
  ],
  "name": "反継電＋単調",
  "scales": [
   0.35,
   0.2,
   0.28,
   0.24,
   0.2,
   0.27
  ],
  "atkScales": [
   3.2,
   6,
   2.2,
   4.5,
   4.5,
   3.2
  ],
  "enemyHp": [
   132,
   42,
   81,
   80,
   66,
   53
  ],
  "safeRate": 1,
  "winMedian": 0.129,
  "decided": 1,
  "flawlessReach": 0.299
 },
 {
  "laws": [
   "counter",
   "reflect"
  ],
  "name": "反継電＋反射",
  "scales": [
   0.41,
   0.2,
   0.36,
   0.28,
   0.28,
   0.68
  ],
  "atkScales": [
   3.2,
   6,
   2.2,
   4.5,
   3.2,
   1.5
  ],
  "enemyHp": [
   156,
   42,
   105,
   92,
   93,
   131
  ],
  "safeRate": 1,
  "winMedian": 0.145,
  "decided": 1,
  "flawlessReach": 0.346
 },
 {
  "laws": [
   "counter",
   "overload"
  ],
  "name": "反継電＋過負荷",
  "scales": [
   0.41,
   0.2,
   0.74,
   0.2,
   0.2,
   0.3
  ],
  "atkScales": [
   2.2,
   4.5,
   1,
   4.5,
   3.2,
   2.2
  ],
  "enemyHp": [
   158,
   42,
   215,
   66,
   66,
   59
  ],
  "safeRate": 1,
  "winMedian": 0.144,
  "decided": 1,
  "flawlessReach": 0.395
 },
 {
  "laws": [
   "relay",
   "monotony"
  ],
  "name": "継電＋単調",
  "scales": [
   0.24,
   0.24,
   0.2,
   0.37,
   0.2,
   0.52
  ],
  "atkScales": [
   3.2,
   3.2,
   2.2,
   2.2,
   3.2,
   1
  ],
  "enemyHp": [
   90,
   51,
   58,
   122,
   66,
   101
  ],
  "safeRate": 1,
  "winMedian": 0.135,
  "decided": 1,
  "flawlessReach": 0.104
 },
 {
  "laws": [
   "relay",
   "reflect"
  ],
  "name": "継電＋反射",
  "scales": [
   0.2,
   0.49,
   0.22,
   0.21,
   0.22,
   0.9
  ],
  "atkScales": [
   6,
   2.2,
   3.2,
   6,
   4.5,
   1
  ],
  "enemyHp": [
   77,
   105,
   65,
   69,
   73,
   173
  ],
  "safeRate": 1,
  "winMedian": 0.14,
  "decided": 1,
  "flawlessReach": 0.245
 },
 {
  "laws": [
   "relay",
   "counter"
  ],
  "name": "継電＋反継電",
  "scales": [
   0.31,
   0.27,
   0.32,
   0.37,
   0.26,
   0.6
  ],
  "atkScales": [
   4.5,
   4.5,
   3.2,
   4.5,
   6,
   2.2
  ],
  "enemyHp": [
   120,
   56,
   92,
   121,
   87,
   115
  ],
  "safeRate": 1,
  "winMedian": 0.147,
  "decided": 1,
  "flawlessReach": 0.182
 },
 {
  "laws": [
   "relay",
   "balance"
  ],
  "name": "継電＋均衡",
  "scales": [
   0.29,
   0.26,
   0.29,
   0.28,
   0.31,
   0.46
  ],
  "atkScales": [
   4.5,
   4.5,
   4.5,
   6,
   4.5,
   3.2
  ],
  "enemyHp": [
   113,
   54,
   85,
   93,
   101,
   89
  ],
  "safeRate": 1,
  "winMedian": 0.145,
  "decided": 1,
  "flawlessReach": 0.194
 },
 {
  "laws": [
   "relay",
   "wear"
  ],
  "name": "継電＋消耗",
  "scales": [
   0.24,
   0.34,
   0.41,
   0.31,
   0.21,
   0.42
  ],
  "atkScales": [
   4.5,
   2.2,
   1.5,
   3.2,
   4.5,
   2.2
  ],
  "enemyHp": [
   91,
   73,
   119,
   103,
   69,
   82
  ],
  "safeRate": 1,
  "winMedian": 0.142,
  "decided": 1,
  "flawlessReach": 0.058
 },
 {
  "laws": [
   "relay",
   "fade"
  ],
  "name": "継電＋減衰",
  "scales": [
   0.23,
   0.2,
   0.34,
   0.2,
   0.43,
   0.29
  ],
  "atkScales": [
   4.5,
   6,
   1.5,
   6,
   1.5,
   6
  ],
  "enemyHp": [
   87,
   42,
   98,
   66,
   142,
   57
  ],
  "safeRate": 1,
  "winMedian": 0.139,
  "decided": 1,
  "flawlessReach": 0.039
 },
 {
  "laws": [
   "relay",
   "buildup"
  ],
  "name": "継電＋蓄積",
  "scales": [
   0.2,
   0.2,
   0.22,
   0.46,
   0.21,
   0.29
  ],
  "atkScales": [
   6,
   6,
   4.5,
   4.5,
   6,
   6
  ],
  "enemyHp": [
   78,
   43,
   63,
   150,
   69,
   57
  ],
  "safeRate": 1,
  "winMedian": 0.137,
  "decided": 1,
  "flawlessReach": 0.452
 },
 {
  "laws": [
   "relay",
   "overload"
  ],
  "name": "継電＋過負荷",
  "scales": [
   0.26,
   0.2,
   0.2,
   0.2,
   0.2,
   0.33
  ],
  "atkScales": [
   3.2,
   4.5,
   2.2,
   4.5,
   6,
   2.2
  ],
  "enemyHp": [
   100,
   42,
   58,
   66,
   66,
   63
  ],
  "safeRate": 1,
  "winMedian": 0.123,
  "decided": 1,
  "flawlessReach": 0.066
 },
 {
  "laws": [
   "relay",
   "silence"
  ],
  "name": "継電＋静粛",
  "scales": [
   0.41,
   0.3,
   0.44,
   0.5,
   0.46,
   0.66
  ],
  "atkScales": [
   6,
   4.5,
   4.5,
   6,
   4.5,
   4.5
  ],
  "enemyHp": [
   159,
   64,
   129,
   165,
   153,
   127
  ],
  "safeRate": 1,
  "winMedian": 0.15,
  "decided": 1,
  "flawlessReach": 0.324
 },
 {
  "laws": [
   "buildup",
   "fade"
  ],
  "name": "蓄積＋減衰",
  "scales": [
   0.36,
   0.2,
   1.02,
   0.2,
   0.2,
   0.66
  ],
  "atkScales": [
   3.2,
   4.5,
   1,
   4.5,
   3.2,
   1.5
  ],
  "enemyHp": [
   139,
   42,
   295,
   66,
   66,
   128
  ],
  "safeRate": 1,
  "winMedian": 0.142,
  "decided": 1,
  "flawlessReach": 0.214
 }
];

export default LAW_TABLE;
