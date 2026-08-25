# Gate C — 報酬選択の解の厚み

対象: EXP-03 R1_CONTROL「Gate C」

## 結果

**合格: seed 7**

第1戦後・第2戦後の各報酬候補について、装着候補を総当たりし、各候補で勝てる構成が残ることと、報酬選択によって最適結果が変わることを確認した。

| 戦後 | 報酬 | 勝てる構成 | 最良の終了HP | 最良列 |
|---:|---|---|---:|---|
| 1 | follow | generator / nail / follow | 10 | generator×3, nail×5 |
| 1 | capacitor | capacitor / nail / deflector; generator / nail / capacitor | 10 | capacitor×5, nail×2 |
| 2 | follow | follow / nail / capacitor; generator / nail / follow | 4 / 3 | capacitor×5, nail×2; generator×3, nail×5 |
| 2 | collapse | collapse / nail / capacitor; generator / nail / collapse | 4 / 3 | capacitor×5, nail×2; generator×3, nail×5 |

各報酬の両方に少なくとも1つの勝利構成があり、選択肢間で最適な構成または行動列／終了HPが異なるため、報酬が見かけだけの選択になっていない。Gate Cは合格。
