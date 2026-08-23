// 出題の表。**analysis/gen-puzzles.mjs が生成する。手で編集しない。**
//
// 目標は「法則を足し算で読んで組んだ並びの実測値」と「全列挙の最大値」のあいだに置いてある。
// つまり**足し算で考えている限り届かず、噛み合わせに気づいた時だけ越える。**
// answer は検証用の最良解（画面には出さない）。

export const PUZZLES = [
 {
  "laws": [
   "monotony",
   "wear"
  ],
  "name": "単調＋消耗",
  "pool": [
   "rivet",
   "collapse",
   "surge",
   "rivet",
   "rivet",
   "twin",
   "collapse",
   "hammer"
  ],
  "cap": 99,
  "cycles": 3,
  "target": 424,
  "naive": 369,
  "best": 480,
  "ratio": 1.3,
  "answer": [
   "rivet",
   "rivet",
   "surge",
   "hammer",
   "twin"
  ],
  "space": 820
 },
 {
  "laws": [
   "haste",
   "relay"
  ],
  "name": "倍速＋継電",
  "pool": [
   "auger",
   "twin",
   "twin",
   "auger",
   "collapse",
   "rivet",
   "auger",
   "flurry"
  ],
  "cap": 140,
  "cycles": 3,
  "target": 502,
  "naive": 428,
  "best": 576,
  "ratio": 1.35,
  "answer": [
   "auger",
   "auger",
   "auger",
   "twin",
   "twin"
  ],
  "space": 820
 },
 {
  "laws": [
   "monotony",
   "resonance"
  ],
  "name": "単調＋共鳴",
  "pool": [
   "collapse",
   "auger",
   "hammer",
   "surge",
   "twin",
   "collapse",
   "rivet",
   "collapse"
  ],
  "cap": 99,
  "cycles": 3,
  "target": 444,
  "naive": 373,
  "best": 515,
  "ratio": 1.38,
  "answer": [
   "auger",
   "rivet",
   "surge",
   "hammer",
   "twin"
  ],
  "space": 1520
 },
 {
  "laws": [
   "overload",
   "monotony"
  ],
  "name": "過負荷＋単調",
  "pool": [
   "flurry",
   "twin",
   "rivet",
   "twin",
   "rivet",
   "flurry",
   "flurry",
   "auger"
  ],
  "cap": 60,
  "cycles": 3,
  "target": 208,
  "naive": 174,
  "best": 243,
  "ratio": 1.4,
  "answer": [
   "flurry",
   "auger",
   "flurry",
   "twin",
   "twin"
  ],
  "space": 440
 },
 {
  "laws": [
   "fade",
   "haste"
  ],
  "name": "減衰＋倍速",
  "pool": [
   "collapse",
   "twin",
   "surge",
   "twin",
   "collapse",
   "hammer",
   "surge",
   "flurry"
  ],
  "cap": 99,
  "cycles": 3,
  "target": 368,
  "naive": 305,
  "best": 432,
  "ratio": 1.42,
  "answer": [
   "collapse",
   "surge",
   "hammer",
   "collapse",
   "surge"
  ],
  "space": 1110
 },
 {
  "laws": [
   "monotony",
   "relay"
  ],
  "name": "単調＋継電",
  "pool": [
   "twin",
   "flurry",
   "twin",
   "twin",
   "hammer",
   "collapse",
   "flurry",
   "hammer"
  ],
  "cap": 140,
  "cycles": 3,
  "target": 723,
  "naive": 578,
  "best": 868,
  "ratio": 1.5,
  "answer": [
   "twin",
   "flurry",
   "twin",
   "flurry",
   "twin"
  ],
  "space": 440
 },
 {
  "laws": [
   "haste",
   "overload"
  ],
  "name": "倍速＋過負荷",
  "pool": [
   "surge",
   "hammer",
   "hammer",
   "twin",
   "auger",
   "auger",
   "auger",
   "collapse"
  ],
  "cap": 99,
  "cycles": 3,
  "target": 206,
  "naive": 157,
  "best": 255,
  "ratio": 1.62,
  "answer": [
   "collapse",
   "hammer",
   "hammer",
   "surge",
   "twin"
  ],
  "space": 820
 }
];

export default PUZZLES;
