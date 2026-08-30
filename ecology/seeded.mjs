// ecology/seeded.mjs
//
// **用途ごとに分けた決定的な乱数。R6 §16。**
//
// 一つの可変 PRNG を全用途で共有すると、報酬を1回引き直しただけで
// 後続の敵も後続の drop 列も動く。だから状態を持ち回さず、
// **鍵の文字列から毎回作り直す。** 同じ鍵は何度呼んでも同じ列を出す。
//
//   runSeed:manifest:offerIndex
//   runSeed:encounter:encounterIndex
//   runSeed:reward:encounterIndex:rerollIndex:slot
//   runSeed:item:dropIndex:attempt
//
// アルゴリズムは PR #49 から**1バイトも変えていない**（既存の報酬列が
// 凍結 fixture と一致し続ける必要がある）。置き場所だけを共有へ移した。

export function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function makeRng(key) {
  let state = hashSeed(key) || 1;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 1 | state) + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 7), 61 | value) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle(values, key) {
  const result = [...values];
  const next = makeRng(key);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

// 鍵の組み立てを一箇所に閉じる。**区切りを別々に書くと、いつか片方だけが変わる。**
export function seedKey(...parts) {
  return parts.join(":");
}
