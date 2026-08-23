# EXP-01 MUTATION 構造ゲート測定結果

## 目的

人間テストの前に、MUTATEの仮説である「ラン途中に既存部品の意味が変わる」が、実装上の構造として成立しているかを測定する。

このゲートは合否閾値を持たない。測定結果を見てから閾値・敵数値・チップ内容を変更していない。

## 測定方法

- スクリプト: `analysis/gate-mutate-structure.mjs`
- 標本: seed 1〜8。各seedの初期手持ちは、実際のMUTATE生成と `startContract` を通ったもの。
- 到達確認: 8/8 seedで、第1戦勝利→第1チップ取得→通常報酬提示まで到達。
- 配置: 8部品から5枠を選ぶ順列、1手持ちあたり8P5 = 6,720通り。
- チップ取得後: 3チップ種×8装着先×6,720配置 = 53,760通り/チップ。
- 最適化順位: 勝敗 > 敵残HP > 自HP > 決着の短さ。
- 同率の最適解は捨てず、すべて保持して距離・分布・順位を計算。
- 取得前後の配置距離は、敵変更の影響を切り分けるため同じ敵1で比較。
- 後続報酬は、第1戦後に提示される通常部品報酬を追加し、敵2で比較。各seedで実際に取得した第1チップについて、3つの提示報酬を全列挙。

## 結果

### ① 取得前後の最適配置距離

5枠のうち異なる位置数による距離。

- 全体平均: 1.500 / 5
- 中央値: 1 / 5
- P90: 4 / 5
- 最大: 5 / 5
- 過速歯車: 平均1.375
- 蓄圧筒: 平均1.375
- 追従軸: 平均1.750

### ② 最適装着先の分布

同率最適解に含まれる装着先を、部品種別に集計した。seedごとに同じ装着先は1回として数えている。

- 過速歯車: 厚殻5、環流管4、崩落砲2、貫錐2、双撃1、偏向板1、重鎚1、連射1、打鋲1
- 蓄圧筒: 薄殻4、重鎚4、環流管4、貫錐3、打鋲2、偏向板2、双撃1、厚殻1、崩落砲1、連射1、過給器1
- 追従軸: 崩落砲4、厚殻2、重鎚2、貫錐1、過給器1

seedごとの平均ユニーク最適装着先は、過速歯車2.25、蓄圧筒3.00、追従軸1.25だった。

### ③ 採用部品の順位変化

最適配置に含まれる割合から順位を作り、3チップ種・24状態を合算した。負のΔは順位上昇。

| 部品 | 取得前平均順位 | 取得後平均順位 | Δ |
|---|---:|---:|---:|
| 厚殻 | 6.50 | 5.50 | -1.00 |
| 重鎚 | 4.00 | 3.20 | -0.80 |
| 打鋲 | 5.83 | 5.06 | -0.78 |
| 連射 | 3.57 | 2.90 | -0.67 |
| 過給器 | 6.50 | 6.00 | -0.50 |
| 貫錐 | 4.86 | 4.86 | 0.00 |
| 整流器 | 2.00 | 2.00 | 0.00 |
| 双撃 | 5.00 | 5.00 | 0.00 |
| 偏向板 | 6.33 | 6.67 | +0.33 |
| 崩落砲 | 1.00 | 1.58 | +0.58 |
| 薄殻 | 4.63 | 5.67 | +1.04 |
| 環流管 | 2.40 | 3.93 | +1.53 |

### ④ 後続報酬による最適装着先変更率

敵2で、第1チップを付けた状態に通常部品報酬を1つ追加する前後を比較。

- 強制変更率（旧最適先が新最適集合に1つも残らない）: 3/24 = 12.5%
- 最適集合変更率（最適先の集合が完全一致しない）: 13/24 = 54.2%

### ⑤ 勝てる構成ゼロ率

- チップ取得前、配置のみ: 0/8 = 0.0%
- チップ取得後、配置×装着先: 0/24 = 0.0%

### ⑥ 全配置勝利率

「全配置勝利率」は、状態内の列挙構成のうち勝てた割合と、「全ての配置が勝てる状態」の割合を分けて記録する。

- 取得前の配置単位: 12,486/53,760 = 23.23%
- 取得前に全配置が勝利した手持ち: 0/8 = 0.0%
- 取得後の配置×装着先単位: 324,868/1,290,240 = 25.18%

## 実装上の解釈

1. **チップは見た目だけの変化ではない。**  
   最適配置距離は平均1.5枠、最大5枠まで動いた。少なくともこの標本では、既存部品の意味を再評価させるだけの配置変化が生じている。

2. **ただし、チップごとに作用の集中度が違う。**  
   追従軸は崩落砲・厚殻・重鎚・貫錐などに比較的集中した。一方、蓄圧筒は最適先が広く、どの部品にも付きうる。これは「毎回同じ正解先に付ける」構造ではないことを示す一方、蓄圧筒の判断が弱くなる可能性もある。

3. **部品の再評価は起きているが、サンプルは小さい。**  
   厚殻・重鎚・連射は順位が上がり、環流管・薄殻は下がった。チップによる採用部品の入れ替えは観測できる。ただし8 seed・24状態なので、順位の安定性を示す結果ではない。

4. **後続報酬は、常にチップ移動を強制しない。**  
   旧最適先が完全に消える強制変更は12.5%だった。一方、最適集合が何らかの形で変わる割合は54.2%で、後続報酬はチップ装着先の再検討を発生させるが、毎回の必須作業にはしていない。

5. **構造上の詰み・自動勝利は、この標本では見えていない。**  
   勝てる構成ゼロ率は取得前後とも0%、全配置勝利状態も0%だった。配置の良し悪しは残っており、初期手持ちが完全な詰みでも、全配置が勝てる自動勝利でもない。

## 判断保留

この結果だけでは、人間テスト公開の可否は決めない。

- 構造ゲートの実装と測定は完了。
- 閾値による合否判定は未設定。
- 敵HP、チップ倍率、報酬内容、標本seedを結果に合わせて変更していない。
- 人間テストへ公開するかは、この測定結果を確認したSol/Luna側で判断する。


## 人間テスト用seed選定

seed 1〜32を昇順に走査し、各seedで実際に取得する第1チップだけを対象に、指定条件を機械判定した。

### seed×チップ別の取得前後距離

下表はseed 1〜8について、3チップすべてを全列挙した距離。選定走査ではseed 1〜32について実取得チップを追加測定した。

| seed | 過速歯車 | 蓄圧筒 | 追従軸 | 実取得 |
|---:|---:|---:|---:|---|
| 1 | 0 | 2 | 0 | 追従軸 |
| 2 | 1 | 1 | 0 | 追従軸 |
| 3 | 5 | 5 | 4 | 過速歯車 |
| 4 | 1 | 0 | 3 | 蓄圧筒 |
| 5 | 0 | 0 | 0 | 追従軸 |
| 6 | 0 | 0 | 2 | 過速歯車 |
| 7 | 3 | 2 | 5 | 過速歯車 |
| 8 | 1 | 1 | 0 | 追従軸 |

選定走査での実取得チップ距離は、seed 9:蓄圧筒0、10:過速歯車4、11:過速歯車0、12:蓄圧筒0、13:蓄圧筒0、14:蓄圧筒3、15:過速歯車2、16:蓄圧筒1、17:過速歯車0、18:追従軸3、19:蓄圧筒3、20:蓄圧筒2、21:蓄圧筒0、22:過速歯車1、23:追従軸1、24:追従軸2、25:過速歯車2、26:蓄圧筒2、27:蓄圧筒0、28:追従軸1、29:過速歯車3、30:蓄圧筒2、31:追従軸3、32:過速歯車2。

### seed×報酬別の装着先変更結果

`forced` は旧最適装着先が新最適集合から完全に消えた場合、`setChanged` は最適集合が完全一致しない場合。

- seed 1: deflect forced / twin forced / flurry forced
- seed 2: loop — / collapse setChanged / flurry setChanged
- seed 3: auger — / thin — / surge —
- seed 4: deflect setChanged / loop setChanged / auger setChanged
- seed 5: deflect setChanged / twin setChanged / collapse —
- seed 6: twin setChanged / surge setChanged / thick —
- seed 7: auger — / twin — / flurry —
- seed 8: collapse setChanged / thin — / deflect —
- seed 9: surge — / feed — / deflect setChanged
- seed 10: rivet setChanged / deflect — / hammer —
- seed 11: hammer — / thin — / thick setChanged
- seed 12: loop setChanged / auger setChanged / hammer setChanged
- seed 13: twin setChanged / auger setChanged / rivet setChanged
- seed 14: rivet setChanged / thin — / deflect —
- seed 15: thick forced / flurry — / collapse —
- seed 16: feed setChanged / thick setChanged / surge setChanged
- seed 17: thick forced / surge — / thin —
- seed 18: feed — / flurry setChanged / auger setChanged
- seed 19: twin setChanged / loop setChanged / feed setChanged
- seed 20: rivet setChanged / surge setChanged / loop setChanged
- seed 21: thin setChanged / auger setChanged / thick setChanged
- seed 22: deflect — / thick — / collapse —
- seed 23: thick — / deflect — / twin —
- seed 24: hammer setChanged / rivet setChanged / feed —
- seed 25: surge — / feed forced / deflect —
- seed 26: thick setChanged / collapse setChanged / thin setChanged
- seed 27: deflect — / thin forced / feed forced
- seed 28: collapse setChanged / flurry setChanged / auger setChanged
- seed 29: thin forced / twin setChanged / thick forced
- seed 30: thin — / auger — / rivet forced
- seed 31: feed setChanged / deflect — / thin —
- seed 32: thick setChanged / auger — / flurry setChanged

### 選定結果

最初に条件を満たしたseedは **29**。

- URL: `https://garakuta-lab.pages.dev/play/?ruleset=mutate&seed=29`
- 第1チップ: 過速歯車
- 勝てる構成ゼロ: false
- 全配置勝利: false
- 取得前後の最適配置距離: 3枠
- 第1戦後の3報酬: 薄殻・双撃・厚殻
- 旧最適装着先が完全に消える報酬: 薄殻、厚殻
- seed 1〜28には、距離3枠以上かつ強制変更報酬ありのseedが存在しなかった。

この選定は、チップの面白さや個別結果を見て選んだものではなく、seed昇順と指定条件だけで決定した。
