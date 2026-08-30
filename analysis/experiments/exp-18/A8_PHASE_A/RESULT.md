# EXP-18 Phase A — 実装結果

作成日：2026-08-30
対象：[R6](../R6_LONG_TERM_PROGRESSION_PROCEDURAL_LOOT_AND_BLUEPRINTS.md) §17.1
前提：[Milestone 0 PREFLIGHT](../A7_MILESTONE_0/PREFLIGHT.md)、[Phase A 実装契約](../A7_MILESTONE_0/PHASE_A_CONTRACT.md)
状態：**実装済み。作者はまだ遊んでいない。**

## 1. R6 §17.1 の項目

| 項目 | 状態 | 置き場所 |
|---|---|---|
| 戦闘量を約10倍し、maxHp / might / focus / guard を導入 | 済 | `content/base.mjs` の移行、`schema.mjs` の `ACTOR_STATS` |
| 既存8人物の parameter 表 | 済 | `content/characters.mjs` の `CHARACTER_STATS`（R6 §4.4 の表をそのまま） |
| 5人編成、2×3 formation、敵最大5 | 済 | `playable-battles.mjs` の `normalizeFormation`、`LIMITS` |
| 基本3 active / 3 reactive / 2 passive | 済 | `SLOT_LIMITS`、`LIMITS` |
| basic strike と utility 後50%追撃 | 済 | `engine.mjs` の `coreActionChoice`、`content/index.mjs` の `coreActions` |
| 常設 fallback passive 7種 | 済 | `content/skills-passive.mjs` |
| guard、block、barrier | 済 | `effects.mjs` の `dealOneInstance` |
| 6 attack archetype | 済 | 斬撃・溜め突き・刻み斬り・貫き突き・薙ぎ払い・突き通し |
| multi-hit と block → guard → barrier → HP の event 順 | 済 | `effects.mjs`（R6 §6.7 の6手順） |
| 既存24 skill を新 parameter へ migration | 済 | `ACTIVE_SCALING` / `REACTIVE_SCALING` |
| UI、因果 log、D1、save migration | 済 | 盤面が guard / block / AP / RP / 状態を出す。`SAVE_KEY` は据え置き |

**Phase A で実装しないもの**（R6 §17.1）はすべて手つかず。12戦 run、活動資金、
生成装備、Blueprint、SkillPack manifest、補給、Difficulty、endless、
splash / all の archetype、第4枠の購入。

## 2. 移行で強さが動いていないことの実測

| 段階 | 第1 | 第2 | 第3 | 第4 | 第5 | 第6 | 第7 |
|---|---|---|---|---|---|---|---|
| 移行前（4人・v1 尺度） | win 4R | win 6R | win 6R | win 5R | **loss** 9R | win 9R | **loss** 12R |
| 10倍移行の直後（4人） | win 3R | win 6R | win 6R | win 5R | **loss** 9R | win 9R | **loss** 12R |
| Phase A 完成（5人・追撃あり） | win 2R | win 3R | win 4R | win 3R | win 8R | win 6R | win 9R |

2行目が「移行そのものでは強さが動かない」ことの証拠である（中立 parameter で
現行の相対効果量を保つ係数から始めたため）。stage 1 の 4R → 3R だけは、
レオンの腕力46が中立40より高いことによる。

## 3. **未検証のまま残す観測：初期構成が7区画すべてを勝つようになった**

3行目の通り、技能点を1点も使わない初期構成が全区画を勝ち抜く。原因は分離できる。

- 編成が4人 → 5人になった（手数が25%増えた）
- 支援技能のあとに威力50%の追撃が必ず入る（R6 §6.4 の不変条件）

**これは調整していない。** 理由は3つある。

1. R6 §17.1 は Phase A に Difficulty も threat budget も含めていない。
2. R7 §8 は難易度の3層（unit / encounter / rank）を同時に動かすことを禁じ、
   まず Difficulty 0 の reference encounter を固定せよと言っている。それは Phase B。
3. R7 §11 は「system と content の数値を同じ比較で同時変更し、差分原因を
   分離できない」を停止条件にしている。engine を変えた同じ PR で
   encounter を締めると、次に何が効いたのか誰も言えなくなる。

**作者へ：** 遊んで「歯ごたえが無い」と感じたら、それは想定内の観測であって
Phase A の失敗ではない。R6 §17.1 の Gate が問うのは勝てるかどうかではなく、
次の6つを自分の言葉で説明・利用できるかである（R7 §5 Milestone 2）。

- 人物 parameter の違い
- 前3後2 と 前2後3 の選択
- 単発・多段・row・column の使い分け
- guard / block / barrier への攻撃相性
- 増えた skill 枠によって成立した構成
- fallback passive を選んだ理由

締めるのは Phase B の encounter 層と rank 層で、そのときは一層ずつ動かす。

## 4. 実装中に見つけて直したもの

| 何 | どう分かったか |
|---|---|
| `mine.mjs` だけが battle 版を文字列で持っていた | 版を上げたら 162 build が全部 invalid になった |
| round-half-up が 2^53 付近で1ずれる | 検査に大きな数を入れておいたら落ちた。**検査を緩めず実装を直した** |
| `row_is` が id の綴りから行を導いていた | position を6つへ増やすときに気づいた。語彙表を引くようにした |
| 出足（開始時 AP+1）が何もしなかった | ラウンド頭の補充に上書きされていた。`round_started` ＋ battle 一回の limit へ |
| 後衛が近接で追撃していた | `basicStrikeReach` を actor へ運び忘れ。実イベント列を見て気づいた |
| 5人で戦闘へ入れなかった | `LIMITS` が4人のまま。**PR #49 の診断画面が原因を名指しした** |

## 5. 検査

- `RUN_EXHAUSTIVE=1 bash analysis/check-all.sh` … 終了コード0
- `node ecology/check.mjs` … 8 suites（`phase-a.test.mjs` 55 checks を新設）
- `node analysis/ecology-trial.mjs` … 33/33、390×844
- 深一致 fixture は Phase A の変更ぶんだけ動かして凍結し直した

`phase-a.test.mjs` が見ているのは実装の有無ではなく **R6 の主張そのもの**である。
guard 30 に対して単発40は10通り、同じ総係数の4段は4しか通らない。guard 0 では
両方40で並ぶ——差を作っているのが guard であることまで確かめている。
攻撃テンポも同じで、全員を防壁形成だけにした構成を実際に走らせ、
敵にダメージが入ること、追撃の数が支援行動の数を超えないことを見ている。
