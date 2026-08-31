# EXP-18 R8 Implementation Phase 4 — Phase C（生成装備と Blueprint）実装状況

作成日: 2026-08-31（UTC）
状態: 実装済み。作者評価は未了。
対象: EXP-18「灰の遠征」 ecology/
関連: [R8 §3.5 / §3.6 / §13.2 / §18](./R8_FIXED_DIFFICULTY_SYNERGY_LADDER.md)

## 0. Gate の扱い

R8 §18 は Phase 4 を「Gate 2 後に限り」実装すると書いている。**Gate 2（作者による
Stage 0〜3 統合評価）は通っていない。**この実装は作者の指示で先行させたもので、
順序を守っていないことをここに記録する。

R8 §18 が Phase 4 の末尾に置いた歯止め——「作者が『奇跡の品を保存したい』
『持込品によって今回の構成が変わった』と感じた後に装備content waveを広げる」——は
守っている。affix は目録どおりの最小構成で、content wave は広げていない。

## 1. 実装した順序（R8 §18 Phase 4 の step どおり）

| step | 実装 |
|---|---|
| 1. affix schema、完結rule grammar、canonical descriptor、budget | `ecology/content/affixes.mjs` |
| 2. 決定的generator、50 attempt診断、dead rule / 無料循環validator | `ecology/equipment-gen.mjs` |
| 3. rarity別rule数と報酬table | `RARITY_BUDGET`、`RARITY_DROP_WEIGHTS` |
| 4. Blueprint exact保存、archive、再製造、carry capacity 1〜5、旧version disable表示 | `ecology/blueprints.mjs` |
| 5. 目利き、生成装備報酬、勝利 / 安全撤退 / 敗北の保存数 | `progression.mjs` |
| 6. 生成装備を含むpreview、save / reload / export / D1 | `playable-battles.mjs`、`app.js` |

## 2. 契約

### 2.1 完結 rule の文法（R8 §3.5）

`trigger -> condition 0〜2 -> cost 0〜1 -> effect 1〜2 -> limit -> durability`。

affix の role は R8 §13.2 の四種（source / converter / payoff / stabilizer）に、
legendary だけが持つ keystone を足した五種。

**source は power を払わず、affix 数にも数えない。** trigger は「どの出来事を
読むか」であって強さではないので、そこへ予算を割くと rarity が
「読む出来事の数」を意味してしまう。R8 §3.5 の「総affix目安」は
converter / payoff / stabilizer / keystone の数として数えている。

| rarity | 完結rule数 | 総affix | power budget |
|---|---:|---:|---:|
| common | 1 | 1〜2 | 2 |
| rare | 1〜2 | 2〜4 | 4 |
| epic | 2〜3 | 4〜7 | 7 |
| legendary | 3〜4 + keystone 0〜1 | 6〜10 | 10 |

item 全体で budget は一つ。rule 数で倍にしない。

### 2.2 生成しないもの

generator が落とす形（`auditDraft`）:

- trigger が提供しないものを要求する payoff / condition（発火不能）。
- trigger が持たない値を読む `event_value` 述語（永久に発火しない）。
- 資源・HP・耐久を戻すのに代償が無い rule（無料無限循環）。
- 同じ資源を払って同じ資源を得る rule（差し引き0の死に rule）。
- 代償が trigger と同じ出来事を出す rule（払った瞬間に自分を呼び戻す）。
- 同じ軸の condition を二つ持つ rule（永久に成立しない条件）。
- 耐久で払えない摩耗コスト。
- 自分の trigger を出し直す rule で、発火回数が2を超えるもの。
- `heal` を、被弾 chain の外や有限コスト無しで持つ rule
  （`analysis/ecology-anti-stall-audit.mjs` と同じ条件）。

**50 attempt で作れないときは、既定品へ黙って落ちず `EquipmentGenerationError` を
投げる。**報酬画面はその診断をそのまま出す（候補が消えたことを隠さない）。

### 2.3 決定性と来歴（R8 §3.5, §3.9）

`generateEquipment({ seed, dropIndex, rarity, familyIds })` は同じ引数から同じ品を返す。
`origin`（runId や encounterIndex）は来歴に残るが **descriptor には入らない**ので、
同じ品を別の遠征で拾っても同じ Blueprint になる。

保存するもの: generator 版、content contract 版、seed、drop index、rarity、
affix family、attempt 番号、canonical descriptor、affix ID 列、resolved parameter、来歴。

### 2.4 Blueprint（R8 §3.6, §10.3）

- immutable。同じ descriptor は重複品にせず、取得履歴だけを足す。
- archive 自体に所持上限は無い。制限が掛かるのは持込枠だけ。
- 持込枠は初期1、最大5。費用は 4,000 / 20,000 / 100,000 / 500,000。
- 遠征開始時、持込枠のぶんを **exact copy として再製造**する。seed から作り直さない。
- 持込品は manifest 外の affix family でも動く。
- 互換性は「現行 content でその定義が検証を通るか」で判定する。落ちたものは
  削除せず `disabledReason` を付け、持込選択からも外す。
- 遠征終了時の保存数は 勝利2 / 安全撤退2 / 敗北1。**等級の高い順**に残す
  （取得順に依らせると、同じ遠征を同じように遊んでも残る品が変わる）。

### 2.5 目利き（R8 §3.7）

15,000 / 45,000 / 120,000 / 300,000 / 750,000 の5段。

**情報を隠して売る仕組みにはしていない。** R8 §11 の完全開示と衝突するので、
生成装備の rule は最初から全部読める。目利きが変えるのは等級の引きで、
level+1 回引いて良い方を採る。

### 2.6 affix family（R8 §13.2）

manifest の `enabledAffixFamilyIds` が、その遠征で引ける affix pool を決める。
family は pack に紐づく（`family_edge` ↔ `pack_edge` など）ほか、
どの pack にも属さない `family_scar`（被弾という全 role が共有する出来事）がある。

**Stage 番号では決めない。**pack が意味の単位である。

R8 §3.7 の「装備基材 / affix family 一群2,000〜20,000」は未実装。
買って pool を広げる経路はまだ開けていない。

## 3. 報酬の形

装備2枠のうち**一つは生成装備**、もう一つは固定装備。固定装備は比較基準として
残し、報酬の主食にしない（R8 §13.1）。まだ拾っていない固定装備が尽きた
遠征後半では、両枠とも生成装備になる。

「報酬4候補が全て同じroleにならない」（R8 §13.2）は、装備2・技能点・補給という
構成そのものが満たしている。装備どうしが同じ払い先に寄る場合だけ、生成側を
隣の drop 列へずらす。

## 4. 検査

- `ecology/phase-c.test.mjs` — 2205 checks。決定性、完結 rule、budget、診断 error、
  戦闘への投入、Blueprint の immutability と持込枠、互換不能の扱い、保存数。
- `analysis/ecology-equipment-gen-smoke.mjs` — Stage 0〜3 の pool で全 rarity が
  作れること、**生成した品が実際の戦闘で鳴ること**（一度も鳴らない trigger を
  名指しする）、報酬候補の種類が3種未満にならないこと。

## 5. 未確認・未実装

- 作者評価。生成装備が「現在構成を壊して再評価させる副構築」（R8 §3.5）として
  働くかは、機械検査では判定していない。
- affix family の購入（R8 §3.7）。
- 生成装備の耐久は、固定装備と同じく戦闘ごとにリセットされる
  （R8 §3.5 の charge はまだ別語彙になっていない）。
- Blueprint archive の人物・地域での絞り込みは実装してあるが、画面に出しているのは
  rarity と favorite だけ。
