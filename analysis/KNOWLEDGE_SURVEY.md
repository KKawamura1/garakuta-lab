# 「知識アンロック」の既存の型（2026-08-22）

作者：「知識アンロック系をちゃんとサーベイしてください。既存の型があるはずですよ。」

**あった。4つある。**そして調べた結果、**私が前に立てた P13 は反証された。**先にそれを書く。

---

## 反証：P13「押す前に結果が確定しているとつまらない」は誤り

反例が有名なところに1つある。**Into the Breach**（FTL の作者）である。

- 霧も命中率も無い。**敵は自分の攻撃を事前に予告する。**完全情報・決定的
- 開発者いわく「ストラテジーの皮をかぶったパズルゲーム」
- 乱数でごまかせないぶん、AI を極めて丁寧に作る必要があった

**押す前に結果が分かっているのに、つまらなくない。**では何が不確実性の代わりをしているか。
設計解説はそこを名指ししている：

> players make strategic trade-offs between **protecting buildings** and
> **securing better positioning** for future turns

**全部は守れない。**建物を守るか、次の手の位置を取るか、どちらかを諦める。
不確実なのは結果ではなく、**何を諦めるかの正解**である。

### これは、うちの実測にそのまま刺さる

`analysis/BOREDOM.md` の測定：**20ラン中15ランが失点0。無傷率83%。**

**諦めるものが何も無い。** 予告どおりに勝つことがつまらないのではなく、
**予告どおりに「全部手に入る」ことがつまらない。**

そしてこれは、**登録済みなのに一度も試していない条件**の名前そのものである：

> **T5「外した代償」** — `agents/HYPOTHESIS_TESTING.md` の証拠表：**未検証**

新しい仮説を発明する必要は無かった。**棚にあって、埃をかぶっていた。**

---

## 型1：知識ゲート（Metroidbrainia）

**扉は最初から開いている。閉じているのは、遊ぶ側の理解だけ。**
Outer Wilds、The Witness、Tunic、Animal Well、Void Stranger、Blue Prince。

ジャンル分析が分類を与えている：

- **系統的知識**（仕組みの理解）と **非系統的知識**（合言葉のような個別の情報）
- ゲートの**透明さ**：はっきり見える／謎めいている／隠れている
- ゲートの**入力の複雑さ**：合言葉、相互作用、環境条件、パズル

**うちへの当てはまり：悪い。** 知識は**使い切ると尽きる。**
Outer Wilds は二度目が無い。うちは**繰り返し遊んで測る実験室**なので、
一度で尽きる未知は土台に置けない。作者の評価が 5→1 と落ちたのは、
まさに「尽きる未知」しか無かったからである。

## 型2：同定ゲーム（identification game）

NetHack、DCSS、Binding of Isaac。**見た目と効果の対応が、ランごとに引き直される。**
「赤い薬」が何かは毎回違う。だから**覚えるのは事実ではなく、確かめ方**になる。

**知識が尽きない。**尽きるのは個別の対応表であって、同定の技術は毎回使う。
（コミュニティが厖大な spoiler を書くのは、**技術**の方を共有しているからである。）

**うちへの当てはまり：良い。** 法則は既にランごとに引いている。
いま法則は名前と説明文が最初から開示されている。**それを伏せて、
挙動から当てさせる**なら、未知が毎ラン再生産される。

## 型3：予告＋図鑑（初見だけ未知）

Slay the Spire の敵の意図表示、モンスターハンター。
**初見は分からない。一度見れば以後は完全に分かる。**

**うちへの当てはまり：弱い。** 敵は数体しかいないので、**数ランで尽きる。**
私が前の分岐で「推し」として出した案（敵に二つ目の挙動を持たせる）は**この型**で、
4つの中で**繰り返しに一番弱い型**だった。作者が「いまいち」と言ったのは正しい。

## 型4：噛み合わせの発見（combinatorial synergy）

Balatro、Noita。**組み合わせの数が、遊ぶ時間より多い。**

> Three Jokers that interact ... create a procedural generation of power combinations
> that **no single player will fully map in their first 50 hours**

作者が意図していない組み合わせを遊ぶ側が見つける。**知識が尽きないのは、
空間が大きすぎて汲み尽くせないから。**

**うちへの当てはまり：良い。そして既に作ってある。**
`analysis/interaction.mjs` が測っているのはまさにこれで、
`insight` の対（噛み合わせ 57% 対 2%）が既に稼働している。

---

## まとめ：4つの型と、繰り返しへの強さ

| 型 | 未知の出どころ | 繰り返すと | うちへの当てはまり |
|---|---|---|---|
| 1 知識ゲート | 仕組みの理解 | **尽きる** | 悪い（実験室に向かない） |
| 2 **同定** | ランごとに引き直す対応表 | **尽きない** | **良い。未着手** |
| 3 予告＋図鑑 | 初見 | **数回で尽きる** | 弱い（前の私の推しはこれ） |
| 4 **噛み合わせ** | 組み合わせ爆発 | **尽きない** | **良い。稼働中（`insight`）** |
| ― Into the Breach | **未知ではない** | 尽きない | **代償の設計。T5 が未検証** |

## 次にやること（提案）

**大きな方向転換は要らなかった。** 順番はこうなる。

1. **T5「外した代償」の対を作る。**登録済みで未検証、しかも Into the Breach が
   「完全情報でも面白い理由」として名指ししている量。**失点0が15/20ラン**という実測もある。
   操作：片側は全部守れる（いまの版）、片側は**必ず何かを諦める**（守ると削れない配分にする）。
2. **`insight`（型4）の対を回す。**既に立っている。
3. **型2（同定）は、その先の候補。**法則の名前と説明を伏せて挙動から当てさせる版。
   大きい変更なので、1と2の結果を見てから。

**型3（敵に二つ目の挙動）は落とす。**繰り返しに弱く、初見で理不尽に負ける危険だけが残る。

## 出典

- [Metroidbrainia: An in-depth exploration of knowledge-gated games (Thinky Games)](https://thinkygames.com/features/metroidbrainia-an-in-depth-exploration-of-knowledge-gated-games/)
- [Metroidbrainia: A Genre Analysis of Knowledge-Based Exploration Games (ResearchGate)](https://www.researchgate.net/publication/397024365_Metroidbrainia_A_Genre_Analysis_of_Knowledge-Based_Exploration_Games)
- [Perfect Information: The Killer Feature of Slay the Spire and Into the Breach](https://jeremiahgames.com/2019/03/04/perfect-information-the-killer-feature-of-slay-the-spire-and-into-the-breach/)
- [Into the Breach Design Postmortem (GDC 2019)](https://ubm-twvideo01.s3.amazonaws.com/o1/vault/gdc2019/presentations/Into%20the%20Breach%20Postmortem%20Final.pdf)
- [Into The Breach And Dynamic Puzzles](https://blogofarcanesecrets.wordpress.com/2018/03/09/into-the-breach-and-dynamic-puzzles/)
- [I Used To Think Permadeath Made A Roguelike, But Balatro Shows Its Actually Combining Abilities (TheGamer)](https://www.thegamer.com/permadeath-define-roguelike-balatro-shows-its-synergy/)
- [The NetHack object identification spoiler / rec.games.roguelike.nethack FAQ (NetHack Wiki)](https://nethackwiki.com/wiki/Rec.games.roguelike.nethack_FAQ)
