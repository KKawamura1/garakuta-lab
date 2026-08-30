# EXP-18 Phase A 実装契約（PREFLIGHT 固定分）

作成日：2026-08-30
対象：[R6](../R6_LONG_TERM_PROGRESSION_PROCEDURAL_LOOT_AND_BLUEPRINTS.md) §20 手順1
状態：**固定した。Phase A の実装はまだ1行も書いていない。**

R6 §20 は Phase A の PREFLIGHT で次の4つを固定せよと言っている。
ここがその答えで、Phase A の実装はこの通りに書けば済むようにしてある。

1. 10倍の対象／非対象
2. 4 → 6 position の migration
3. parameter 式
4. hit 順

---

## 1. 10倍の対象／非対象

### 1.1 判断の単位は「欄の名前」ではなく「effect の種別」

現在の content には数値の欄が47種ある。しかし `amount.value` という同じ欄が、
damage にも AP にも耐久にも使われている。**欄で分けると必ず取り違える。**

| 実例 | 欄 | 中身 | 10倍 |
|---|---|---|---|
| `statuses.exposed` | `effects.amount.value = 1` | damage の増分 | **する** |
| `equipment.recovery_satchel` | `effects.amount.value = 2` | 装備耐久の回復 | しない |
| `reactiveSkills.scavenge_ap` | `effects.amount.value = 1` | 行動権 | しない |

したがって effect の種別で分ける。

### 1.2 連続量（10倍する）

| effect | 意味 |
|---|---|
| `deal_damage` | damage 量 |
| `heal` | heal 量 |
| `gain_barrier` | barrier 量 |
| `modify_pending_amount` | damage / heal の増減 |

加えて次の欄も連続量である。

- `characters.maxHp` … **10倍ではなく R6 §4.4 の表をそのまま使う**（8人ぶん明示されている）
- `enemyActors.maxHp` … 10倍
- `content/encounters.mjs` の `enemies[].hp` … 10倍

### 1.3 離散量（10倍しない）

| effect | 意味 |
|---|---|
| `gain_resource` | 行動権 / 反応権 |
| `repair_equipment` | 装備耐久 |
| `wear_equipment` | 装備耐久 |
| `advance_preparation` | 準備の段数 |

欄では次。`apCost`、`costs.amount`、`take`、`stacks`、`steps`、`maxStacks`、
`maxDurability`、`baseActionPoints`、`baseReactionPoints`、`speed`、
`limit.count`、`priority`。

### 1.4 判断が要るもの（機械では決められない4件）

`event_value` 述語の閾値は、**listenTo している event の amount が連続量か離散量か**で決まる。
現在の4件はすべて `resource_unused`（余った行動権）を見ているので**離散量。閾値は 1 のまま。**

| 定義 | listenTo | 閾値 | 10倍 |
|---|---|---|---|
| `characters.pivot` | `resource_unused` | 1 | しない |
| `equipment.field_kit` | `resource_unused` | 1 | しない |
| `equipment.repair_pouch` | `resource_unused` | 1 | しない |
| `equipment.recovery_satchel` | `resource_unused` | 1 | しない |

`event_value_scaled`（`reactiveSkills.overflow_care` / `triage_relay` の heal、
`characters.pivot` の barrier）は event の量から導くので、**移行不要。自動で追従する。**

`hp_percent` の 50 / 100 は割合なので 10倍しない。

### 1.5 機械

`analysis/ecology-contract-smoke.mjs` が、種別の宣言されていない effect の定数を拒否する。
**新しい effect を content で使った瞬間に落ちる**ので、移行表に穴が空いたまま Phase A へ入れない。
（`add_status` を足して鳴ることを確認済み。）

### 1.6 R6 §4.4 が明示的に禁じていること

> 既存 skill を定数×10だけへ変換して終えない。

10倍は**下限**であって作業ではない。24技能それぞれについて
「might か focus か」「係数いくつか」を決める。中立 parameter
（might = 40 / focus = 40）で現行の相対効果量を概ね保つ係数から始める。
判断が要るのは技能23件と状態4件の計27件（[PREFLIGHT](./PREFLIGHT.md) §7.2 で数えた）。

---

## 2. 4 → 6 position の migration

### 2.1 新しい canonical ID と順序

~~~js
export const POSITIONS = freeze([
  "front_left", "front_center", "front_right",
  "rear_left",  "rear_center",  "rear_right",
]);
~~~

順序は「前列を先に、各行は左→中→右」。`POSITION_ORDER` の添字は
0..5 へ変わる（`front_right` は 1 → 2）。

**添字はどこにも保存されていない。** `POSITION_ORDER` は `position_asc` の
並べ替えと rule の発火順にしか使われず、save も D1 も content も
position を**文字列 ID で**持っている。したがって添字の変化は安全。
（`analysis/ecology-contract-smoke.mjs` の §5 が、content に表示語が
紛れ込んでいないことを見ている。）

### 2.2 既存 content の移行

既存の4 position はすべて新しい集合の要素なので、**content 側の書き換えは0件。**
`content/encounters.mjs` の敵配置も、`front_left` / `front_right` / `rear_left`
のままで有効。中央列を使うかは encounter 担当の判断で、Phase A では必須にしない。

### 2.3 既存 save の移行（4人 → 5人）

旧 save は `formation: { characterId: position }` を4件持つ。R6 §5.4 は
5人編成・空き1枠・前3後2 または 前2後3 を要求する。

移行は決定的に行う。

1. 既存4件の position をそのまま採用する。
2. 5人目を選ぶ。`roster` に居ない仲間のうち、`CHARACTER_OPTIONS` の並び順で最初の一人。
3. 5人目の `defaultPosition` の行（front / rear）に空きがあり、
   その行へ置いた結果が 前3後2 または 前2後3 になるなら、その行の空き position へ置く。
4. ならなければ、もう一方の行の空き position へ置く。
5. どちらでも成立しないとき（旧 save が前2後2 以外）は、
   前列から順に詰め直して 前3後2 にする。

旧 save は必ず前2後2（4 position を1つずつ使う）なので、通常は手順3か4で決まる。
**手順5は現れないはずだが、現れたときに黙って壊れないために置く。**

### 2.4 SAVE_KEY

**上げない。** 上げると作者の進行が消える。上の移行はすべて additive で、
`loadState` の中で完結する。移行できない項目が出たときだけ key を上げ、
そのときは理由を書く。

`replayEvents` / `replaySnapshots` だけは旧 engine の出力なので読み込み時に捨てる
（区画の進行と編成は保つ）。捨てても失われるのは「直前の戦闘をもう一度見る」だけ。

---

## 3. parameter 式

R6 §4.4 の式をそのまま使う。**独自に変えない。**

~~~text
rawAmount = flat + roundHalfUp(source[scalingStat] * coefficientBps / 10_000)

effectiveGuard = roundHalfUp(target.guard * (10_000 - guardPierceBps) / 10_000)

damage = max(
  roundHalfUp(rawAmount * 1_000 / 10_000),   // 最低10%は通す
  rawAmount - effectiveGuard
)
~~~

固定する細部：

- **`roundHalfUp` は「絶対値で0.5切り上げ」ではなく「+0.5して床関数」とする。**
  `roundHalfUp(x) = Math.floor(x + 0.5)`。負値はこの式では現れない
  （amount も guard も非負）が、現れたら validator で拒否する。
- **中間計算は整数の分子で持つ。** 割り算はこの2箇所だけで行い、
  そこで丸める。effect を event へ確定する前に小数を作らない。
- `guard` は **hit ごと**に引く。同じ総係数なら多段は guard に弱く、単発大威力は強い。
- `heal` と `barrier` に guard を適用しない。
- basic strike は原則 might 100%。weapon 技能は might、technique 技能は focus。

因果ログには「適用前の値・係数・丸め後の値」を残す（R6 §4.4）。
いまの `damage_proposed` → `damage_taken` の2段はそのまま使え、
`values` へ `coefficientBps` と `scalingStat` を足すだけでよい。

---

## 4. hit 順

R6 §6.7 の順をそのまま固定する。

1. action 開始時に target list を**一度だけ**確定し、position 順へ並べる。
2. `hitIndex` を外側、target 順を内側にして処理する。
3. 一 damage instance ごとに
   `damage_proposed` → **block** → **guard** → **barrier** → `damage_taken` / `damage_blocked`
   を完了する。
4. その instance の after reaction を処理してから次の target へ進む。
5. 途中で倒れた target への残り hit は**失われる。別 target へ自動 retarget しない。**
6. retarget を行う skill は、将来 明示的な別 effect として追加する。暗黙挙動にしない。

block は「次の damage instance を一回完全に防ぎ、1 charge 消費する」。
追加する event は4つ：`block_proposed`、`block_gained`、`damage_blocked`、`block_spent`。

**この4 event は Phase A で実装するときに足す。**いま schema へ名前だけ置くことはしない
（R7 §4.3「空の実装や架空 event を先に置かない」）。

### 4.1 いまの実装との差

現在の `effects.mjs` の `dealDamage` は
`damage_proposed` → `absorbBarrier` → `damage_taken` の順で、guard と block が無い。
Phase A では `absorbBarrier` の前に block と guard を挟む。

**barrier の位置は変わらない**ので、barrier だけを使う既存の定義は挙動不変。
（block も guard も持たない actor では、新しい2段は素通りする。）

---

## 5. これで Phase A に残る仕事

上の4点が決まったので、Phase A の実装は次に分解できる。

| # | 仕事 | 依存 |
|---|---|---|
| 1 | schema へ additive に語彙を足す（6 position、might/focus/guard、`scaled` 値、target pattern、reach、block 4 event） | — |
| 2 | `effects.mjs` に block → guard を挟み、hit 順を §4 の通りにする | 1 |
| 3 | content を §1 の表で移行する（機械14件＋maxHp 22件、判断27件） | 1 |
| 4 | 5人編成・2×3・空き1枠の編成 UI と、§2.3 の save 移行 | 1 |
| 5 | 3 active / 3 reactive / 2 passive と、常設 fallback passive 7種 | 1、3 |
| 6 | basic strike と utility 後の50%追撃 | 2、3 |
| 7 | 6 attack archetype（basic / heavy / rapid / pierce / row / column） | 2、3 |
| 8 | UI・因果ログ・D1・深一致 fixture の作り直し | 全部 |

**1つの統合 PR で行う**（R7 §5 Milestone 1）。content 量産 PR を同時に merge しない。
終わったら作者が1〜2遠征を遊び、R7 §5 Milestone 2 の6項目を自分の言葉で
説明・利用できるかで進退を決める。
