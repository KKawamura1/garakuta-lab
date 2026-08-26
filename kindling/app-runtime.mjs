export const GAME_VERSION = "kindling-0.1";
export const BUILD_STAMP = "K1-20260826-A";
export const SLOT_KEYS = ["eyes", "heart", "hands", "feet"];
export const SLOT_LABELS = { eyes: "目", heart: "胸", hands: "手", feet: "脚" };
export const STAT_LABELS = {
  sense: "見つける",
  warm: "あたためる",
  echo: "響かせる",
  dash: "駆ける",
  light: "灯す",
  bind: "つかまえる",
  guard: "まもる",
  spark: "火花",
  mend: "なおす",
  bond: "つなぐ",
  bite: "かじる",
  open: "ひらく",
  feed: "食べる"
};

export const PARTS = [
  {
    id: "bell", name: "ひび割れた鈴", glyph: "◌", color: "#ffd166",
    line: "音を拾う。静かな場所で強い。",
    uses: {
      eyes: { verb: "見つける", stat: "sense", value: 2 },
      heart: { verb: "あたためる", stat: "warm", value: 2 },
      hands: { verb: "鳴らす", stat: "echo", value: 2 },
      feet: { verb: "跳ねる", stat: "dash", value: 1 }
    }
  },
  {
    id: "scarf", name: "赤いマフラー", glyph: "〰", color: "#ff8295",
    line: "風をつかむ。誰かの匂いがする。",
    uses: {
      eyes: { verb: "目印を読む", stat: "sense", value: 1 },
      heart: { verb: "あたためる", stat: "warm", value: 2 },
      hands: { verb: "つかまえる", stat: "bind", value: 2 },
      feet: { verb: "風をつかむ", stat: "dash", value: 2 }
    }
  },
  {
    id: "mirror", name: "青い鏡片", glyph: "◇", color: "#8bc9ff",
    line: "ひかりを返す。弱いものを守る。",
    uses: {
      eyes: { verb: "遠くを見る", stat: "sense", value: 2 },
      heart: { verb: "灯す", stat: "light", value: 2 },
      hands: { verb: "はね返す", stat: "guard", value: 2 },
      feet: { verb: "滑る", stat: "dash", value: 1 }
    }
  },
  {
    id: "coal", name: "まだ熱い炭", glyph: "●", color: "#ff8b5d",
    line: "火を隠している。触ると熱い。",
    uses: {
      eyes: { verb: "暗闇を読む", stat: "sense", value: 1 },
      heart: { verb: "燃える", stat: "warm", value: 2 },
      hands: { verb: "火花を散らす", stat: "spark", value: 2 },
      feet: { verb: "踏ん張る", stat: "guard", value: 1 }
    }
  },
  {
    id: "key", name: "錆びた鍵", glyph: "⌘", color: "#c2b1ff",
    line: "開かないものを、開けたがる。",
    uses: {
      eyes: { verb: "穴を見つける", stat: "sense", value: 1 },
      heart: { verb: "約束する", stat: "bond", value: 2 },
      hands: { verb: "ひらく", stat: "open", value: 2 },
      feet: { verb: "抜け道へ行く", stat: "dash", value: 2 }
    }
  },
  {
    id: "feather", name: "夜鳥の羽", glyph: "羽", color: "#9be3bd",
    line: "軽くなる。高いところが好き。",
    uses: {
      eyes: { verb: "風向きを読む", stat: "sense", value: 1 },
      heart: { verb: "灯りを軽くする", stat: "light", value: 1 },
      hands: { verb: "舞い上げる", stat: "echo", value: 1 },
      feet: { verb: "飛ぶ", stat: "dash", value: 3 }
    }
  },
  {
    id: "nail", name: "曲がった釘", glyph: "╱", color: "#a8dca7",
    line: "留める。踏まれても離れない。",
    uses: {
      eyes: { verb: "線を測る", stat: "sense", value: 1 },
      heart: { verb: "留める", stat: "guard", value: 2 },
      hands: { verb: "刺す", stat: "bite", value: 2 },
      feet: { verb: "踏ん張る", stat: "guard", value: 2 }
    }
  },
  {
    id: "glass", name: "透けたガラス", glyph: "△", color: "#a8e8f2",
    line: "割れやすいが、ひかりを増やす。",
    uses: {
      eyes: { verb: "反射を読む", stat: "sense", value: 2 },
      heart: { verb: "光の種になる", stat: "light", value: 2 },
      hands: { verb: "きらめかせる", stat: "spark", value: 1 },
      feet: { verb: "切り抜ける", stat: "dash", value: 2 }
    }
  },
  {
    id: "button", name: "知らない服のボタン", glyph: "⊙", color: "#f2a6d1",
    line: "小さいけれど、誰かを思い出す。",
    uses: {
      eyes: { verb: "顔を思い出す", stat: "bond", value: 1 },
      heart: { verb: "結ぶ", stat: "bond", value: 2 },
      hands: { verb: "とめる", stat: "guard", value: 1 },
      feet: { verb: "ころがる", stat: "dash", value: 1 }
    }
  },
  {
    id: "tape", name: "使いかけのテープ", glyph: "◎", color: "#d8b4ff",
    line: "つなぐ。破れたところを知っている。",
    uses: {
      eyes: { verb: "つなぎ目を読む", stat: "sense", value: 1 },
      heart: { verb: "なおす", stat: "mend", value: 2 },
      hands: { verb: "巻きつく", stat: "bind", value: 2 },
      feet: { verb: "すべる", stat: "dash", value: 1 }
    }
  },
  {
    id: "flower", name: "押し花", glyph: "✿", color: "#ffb4c9",
    line: "眠っている。あたたかい場所で開く。",
    uses: {
      eyes: { verb: "季節を読む", stat: "sense", value: 2 },
      heart: { verb: "あたためる", stat: "warm", value: 2 },
      hands: { verb: "なおす", stat: "mend", value: 1 },
      feet: { verb: "灯りを運ぶ", stat: "light", value: 1 }
    }
  },
  {
    id: "spoon", name: "曲がったスプーン", glyph: "∪", color: "#f1d28b",
    line: "すくう。空っぽの胸を満たす。",
    uses: {
      eyes: { verb: "落とし物を探す", stat: "sense", value: 1 },
      heart: { verb: "あたためる", stat: "warm", value: 1 },
      hands: { verb: "すくう", stat: "feed", value: 2 },
      feet: { verb: "弾む", stat: "dash", value: 1 }
    }
  },
  {
    id: "seed", name: "眠る種", glyph: "❧", color: "#92e6b6",
    line: "今は小さい。夜明けにだけ芽を出す。",
    uses: {
      eyes: { verb: "芽吹きを見つける", stat: "sense", value: 1 },
      heart: { verb: "育てる", stat: "warm", value: 2 },
      hands: { verb: "ひらく", stat: "open", value: 1 },
      feet: { verb: "根を張る", stat: "guard", value: 2 }
    }
  }
];

export const PART_BY_ID = Object.fromEntries(PARTS.map(function (part) {
  return [part.id, part];
}));

export const SCENES = [
  {
    title: "霧の路地",
    eyebrow: "01 / 最初の角",
    intro: "霧が濃く、胸の灯りが自分の足元しか照らさない。",
    question: "最初の角を、どう越える？",
    routes: [
      {
        id: "roof",
        name: "屋根を跳ぶ",
        icon: "↗",
        desc: "濡れた瓦を一息で越える。高い場所なら霧を見下ろせる。",
        req: { dash: 3, light: 1 },
        reward: "memory",
        rewardText: "高い場所から見た、最初の窓",
        success: "相棒は屋根の上で、灯りを高く掲げた。霧の向こうに、帰るべき窓が一つ見えた。"
      },
      {
        id: "alley",
        name: "鈴で道を探す",
        icon: "◌",
        desc: "急がずに、音を返して霧の厚みを読む。灯りを落としにくい。",
        req: { guard: 2, bond: 2 },
        reward: "light",
        rewardText: "灯りが少し戻る",
        success: "相棒はあなたの袖をつかみ、霧の薄い方へ歩いた。小さな灯りはまだ消えていない。"
      }
    ]
  },
  {
    title: "鉄犬の角",
    eyebrow: "02 / 追いつく音",
    intro: "鉄の犬が、遠くで一度だけ吠えた。次の一度は、すぐそばだ。",
    question: "追いつかれる前に、どうする？",
    routes: [
      {
        id: "rush",
        name: "火花で走る",
        icon: "✦",
        desc: "一瞬の火花で犬の目をくらませ、先に曲がる。速さが要る。",
        req: { dash: 4, spark: 1 },
        reward: "memory",
        rewardText: "鉄犬が迷った、ほんの一秒",
        success: "火花が夜の中で弾け、鉄犬は一秒だけ道を見失った。その一秒で、相棒はあなたの手を引いた。"
      },
      {
        id: "stand",
        name: "胸を張って守る",
        icon: "盾",
        desc: "逃げずに灯りを囲む。相棒を信じるほど、足が止まらない。",
        req: { guard: 3, bond: 2 },
        reward: "light",
        rewardText: "灯りが少し戻る",
        success: "鉄犬の鼻先が灯りに触れた。それでも相棒は動かなかった。犬は、あなたたちを通り過ぎた。"
      }
    ]
  },
  {
    title: "崩れた橋",
    eyebrow: "03 / 雨の裂け目",
    intro: "橋の真ん中だけが抜けている。下には、夜より暗い川が流れている。",
    question: "向こう岸へ、何を残して渡る？",
    routes: [
      {
        id: "repair",
        name: "橋をつなぐ",
        icon: "⌁",
        desc: "壊れたものを直して、灯りと一緒に渡る。時間がかかる。",
        req: { mend: 2, light: 2 },
        reward: "memory",
        rewardText: "直すと、橋は少しだけ歌った",
        success: "テープと種が裂け目をふさいだ。渡り終えると、橋の奥から古い歌が一節だけ聞こえた。"
      },
      {
        id: "jump",
        name: "一気に跳ぶ",
        icon: "⌁",
        desc: "振り返らずに向こう岸へ。灯りを抱えたまま、落ちないことが条件。",
        req: { dash: 4, guard: 2 },
        reward: "light",
        rewardText: "灯りが少し戻る",
        success: "相棒はあなたを抱えたまま跳んだ。着地の音で、川の黒さが一瞬だけ銀色になった。"
      }
    ]
  },
  {
    title: "雨の市場",
    eyebrow: "04 / 眠らない店",
    intro: "誰もいない市場で、濡れた店先だけがまだ誰かを待っている。",
    question: "ここで、何を拾っていく？",
    routes: [
      {
        id: "warm",
        name: "あたたかい店へ",
        icon: "⌂",
        desc: "灯りを分けて、店の奥に残ったものを起こす。",
        req: { warm: 3, bond: 2 },
        reward: "memory",
        rewardText: "店の奥に残っていた、赤い糸",
        success: "相棒の胸が明るくなり、店の奥から赤い糸が一筋だけ伸びた。帰る窓まで、途切れずに続いている。"
      },
      {
        id: "echo",
        name: "看板の音を返す",
        icon: "♫",
        desc: "雨音にまぎれた看板を鳴らす。返事があれば道が開く。",
        req: { echo: 3, sense: 2 },
        reward: "light",
        rewardText: "灯りが少し戻る",
        success: "看板の音が雨の中を走り、遠くの扉が一つだけ開いた。相棒は迷わずそこへ向かった。"
      }
    ]
  },
  {
    title: "塔の階段",
    eyebrow: "05 / 空に近い場所",
    intro: "塔の階段には、夜を食べる黒いものが詰まっている。",
    question: "闇をどかして、最後の高さへ？",
    routes: [
      {
        id: "fire",
        name: "火花を咲かせる",
        icon: "✹",
        desc: "一度きりの大きな光で、階段を空ける。守りが薄いと危険。",
        req: { spark: 3, guard: 2 },
        reward: "memory",
        rewardText: "相棒の影が、初めて笑った",
        success: "火花が花のように開き、黒いものは影へ戻った。相棒の影が、初めてあなたと同じ形に笑った。"
      },
      {
        id: "listen",
        name: "上からの音を聴く",
        icon: "♩",
        desc: "急がず、塔の内側から返る音を探す。灯りを絶やさないこと。",
        req: { echo: 3, light: 2 },
        reward: "light",
        rewardText: "灯りが少し戻る",
        success: "上から三度、鈴の音が返った。黒いものは道を空け、相棒はその音を胸にしまった。"
      }
    ]
  },
  {
    title: "夜明けの窓",
    eyebrow: "06 / 帰る場所",
    intro: "最後の窓は、もう見えている。けれど、灯りは風に揺れている。",
    question: "誰に、灯りを返す？",
    routes: [
      {
        id: "home",
        name: "胸の灯りを渡す",
        icon: "♡",
        desc: "自分の中に残ったあたたかさを、窓の向こうへ返す。",
        req: { warm: 3, bond: 3 },
        reward: "ending",
        rewardText: "灯りが、帰る場所を思い出す",
        success: "相棒は窓辺に座り、胸の灯りを両手で差し出した。向こう側で、誰かが名前を呼んだ。"
      },
      {
        id: "bell",
        name: "夜明けを鳴らす",
        icon: "☼",
        desc: "ここまで拾った音を、朝の合図にする。見つける力と響きが要る。",
        req: { echo: 3, sense: 3 },
        reward: "ending",
        rewardText: "灯りが、朝の合図になる",
        success: "相棒が鳴らした音は、町じゅうの窓を順番に起こした。朝は、誰か一人のものではなくなった。"
      }
    ]
  }
];

export function partById(id) {
  return id ? PART_BY_ID[id] || null : null;
}

export function partName(id) {
  return partById(id)?.name || (id ? id : "空き");
}

export function useFor(partId, slotKey) {
  const part = partById(partId);
  return part && part.uses[slotKey] ? part.uses[slotKey] : null;
}

export function buildSignature(slots) {
  return (slots || []).map(function (id) { return id || "empty"; }).join(">");
}

export function makeRng(seed) {
  let value = (Number(seed) >>> 0) || 1;
  return function () {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function hashText(value) {
  let hash = 2166136261;
  for (let i = 0; i < String(value).length; i += 1) {
    hash ^= String(value).charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function shuffle(items, rng) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = result[i];
    result[i] = result[j];
    result[j] = swap;
  }
  return result;
}

export function sceneFor(stage, seed) {
  const source = SCENES[Math.max(0, Math.min(SCENES.length - 1, stage))];
  const rng = makeRng((Number(seed) + (stage + 1) * 7919 + 31) >>> 0);
  return {
    ...source,
    options: shuffle(source.routes, rng)
  };
}

function totalsFor(slots) {
  const totals = {};
  (slots || []).forEach(function (partId, index) {
    if (!partId) return;
    const use = useFor(partId, SLOT_KEYS[index]);
    if (!use) return;
    totals[use.stat] = (totals[use.stat] || 0) + use.value;
  });
  return totals;
}

function addTotal(totals, stat, amount) {
  totals[stat] = (totals[stat] || 0) + amount;
}

export function evaluateBuild(slots, route) {
  const actions = (slots || []).map(function (partId, index) {
    const slotKey = SLOT_KEYS[index];
    const use = useFor(partId, slotKey);
    const part = partById(partId);
    return {
      slot: index,
      slotKey: slotKey,
      slotName: SLOT_LABELS[slotKey],
      partId: partId || null,
      partName: part ? part.name : "空き",
      glyph: part ? part.glyph : "·",
      color: part ? part.color : "#8792ab",
      use: use ? { ...use } : null
    };
  });
  const rawTotals = totalsFor(slots);
  const totals = { ...rawTotals };
  const combos = [];

  if ((totals.light || 0) >= 2 && (totals.echo || 0) >= 2) {
    addTotal(totals, "light", 1);
    addTotal(totals, "echo", 1);
    combos.push({ id: "light-echo", name: "灯りが音になる", text: "光が音を拾い、暗がりに道を描いた。", color: "#ffd166" });
  }
  if ((totals.dash || 0) >= 3 && (totals.guard || 0) >= 2) {
    addTotal(totals, "dash", 1);
    combos.push({ id: "dash-guard", name: "受け流し", text: "勢いを殺さず、守りを足場にして跳ねた。", color: "#9be3bd" });
  }
  if ((totals.warm || 0) >= 2 && (totals.mend || 0) >= 2) {
    addTotal(totals, "bond", 1);
    addTotal(totals, "warm", 1);
    combos.push({ id: "warm-mend", name: "なおして、あたためる", text: "壊れたところが、あたたかさを覚えていた。", color: "#ffb4c9" });
  }
  if ((totals.sense || 0) >= 3 && (totals.bind || 0) >= 2) {
    addTotal(totals, "bind", 1);
    addTotal(totals, "sense", 1);
    combos.push({ id: "sense-bind", name: "見つけて、つかまえる", text: "見えない道の端を、しっかりつかんだ。", color: "#c2b1ff" });
  }
  if ((totals.spark || 0) >= 2 && (totals.bite || 0) >= 2) {
    addTotal(totals, "spark", 1);
    combos.push({ id: "spark-bite", name: "噛みつく火花", text: "小さな歯が、火花をひとつ噛み砕いた。", color: "#ff8b5d" });
  }
  if (actions[0]?.use?.stat === "sense" && actions[3]?.use?.stat === "dash") {
    addTotal(totals, "dash", 1);
    combos.push({ id: "eyes-feet", name: "見つけた方へ走る", text: "目が道を見つけ、脚が迷う前に動いた。", color: "#8bc9ff" });
  }
  if (actions[1]?.use?.stat === "warm" && actions[2]?.use?.stat === "echo") {
    addTotal(totals, "echo", 1);
    combos.push({ id: "heart-hands", name: "鼓動の返事", text: "胸の鼓動が、手の音を返した。", color: "#f2a6d1" });
  }

  const requirements = Object.entries(route.req).map(function (entry) {
    const stat = entry[0];
    const need = entry[1];
    const have = totals[stat] || 0;
    return { stat: stat, label: STAT_LABELS[stat] || stat, need: need, have: have, ok: have >= need };
  });
  const passed = requirements.every(function (item) { return item.ok; });
  const shortage = requirements.reduce(function (sum, item) {
    return sum + Math.max(0, item.need - item.have);
  }, 0);

  return {
    actions: actions,
    rawTotals: rawTotals,
    totals: totals,
    combos: combos,
    requirements: requirements,
    passed: passed,
    close: !passed && shortage <= 1,
    shortage: shortage,
    primaryStat: requirements[0]?.stat || null
  };
}

export function offersFor(state) {
  const scene = sceneFor(state.stage, state.seed);
  const route = scene.options.find(function (item) { return item.id === state.routeChoice; }) || scene.options[0];
  const current = totalsFor(state.slots);
  const deficits = Object.entries(route.req).map(function (entry) {
    return { stat: entry[0], missing: Math.max(0, entry[1] - (current[entry[0]] || 0)) };
  }).sort(function (a, b) { return b.missing - a.missing; });
  const desired = (deficits[0] && deficits[0].missing > 0) ? deficits[0].stat : Object.keys(route.req)[0];
  const rng = makeRng((Number(state.seed) + (state.stage + 1) * 104729 + hashText(route.id)) >>> 0);
  const helpers = PARTS.filter(function (part) {
    return Object.values(part.uses).some(function (use) { return use.stat === desired; });
  });
  const helper = helpers[Math.floor(rng() * helpers.length)];
  const others = shuffle(PARTS.filter(function (part) { return part.id !== helper.id; }), rng);
  return shuffle([helper, others[0]], rng).map(function (part) { return part.id; });
}

export function statLabel(stat) {
  return STAT_LABELS[stat] || stat;
}
