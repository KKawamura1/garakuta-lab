# EXP-03 CONTROL 0.2 — Gate A〜E・seed探索結果

対象: R3_SOL_CONTROL_0_2  
実行日: 2026-08-24  
実行コマンド: node analysis/gate-control02.mjs  
実行結果: ゲート不合格のため終了コード1  
UI・デプロイ: 実施していない

## Gate A

**PASS**

5グループの計算検査を実行した。

- 決定的なスケジュール戦闘
- 全ターンの選択前後状態とログの一致
- エネルギー不足と崩落砲停止
- 蓄電輪の一回加算と追従軸の連鎖禁止
- 遮蔽、予定攻撃、実攻撃、被害の分離記録

## seed昇順探索

Gate Fを先に実行して合格した後、seed 1から10000まで昇順に調べた。

| 指標 | 件数 |
|---|---:|
| 探索seed | 10000 |
| 3戦完走可能 | 140 |
| Gate B単独通過 | 124 |
| Gate C単独通過 | 84 |
| Gate D単独通過 | 104 |
| Gate E単独通過 | 0 |
| Gate A〜Eを同一seedで通過 | 0 |
| 採用seed | なし |

## Gate B〜E

| Gate | 結果 | 理由 |
|---|---|---|
| Gate B | 同一seedでの採用候補なし | Gate B単独通過は124件あったが、Gate Eまで同時に通るseedなし |
| Gate C | 同一seedでの採用候補なし | Gate C単独通過は84件あったが、Gate Eまで同時に通るseedなし |
| Gate D | 同一seedでの採用候補なし | Gate D単独通過は104件あったが、Gate Eまで同時に通るseedなし |
| Gate E | **FAIL / 0件** | 10,000seed中、報酬取得部品を使う最適方策が、同じ交換後構成で取得部品を使わない最良方策を辞書順で厳密に上回る候補が残らなかった |

Gate Eの「取得部品を使う最適方策がある」「取得部品を使わない最良方策より厳密に良い」「報酬候補間で最適行動列が変わる」という条件を、seed選定後に緩和していない。

## 総合判定

- Gate F: PASS
- Gate A: PASS
- Gate B: 同一seedで未成立
- Gate C: 同一seedで未成立
- Gate D: 同一seedで未成立
- Gate E: FAIL
- Gate A〜F総合: **FAIL**
- selectedSeed: null
- uiDeploymentAllowed: false

R3の規定どおり、seed探索範囲・敵HP範囲・攻撃値範囲・Gate閾値を変更せず停止する。