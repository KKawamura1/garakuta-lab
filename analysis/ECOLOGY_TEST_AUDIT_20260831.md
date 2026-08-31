# ecology のテスト・fixture 棚卸し（2026-08-31）

## 結論

今回の主な発見は4つです。

1. fixture-content.mjs は engine の能力を証明するための極端な定義なのに、content/base.mjs の renamed() と clone*() を通じて遊べる bundle の原型にもなっている。cover_ally の二重 redirect はその典型で、R5 の証人としては正しいが、遊べる content の仕様としては別の判断が必要。
2. termination 用の技能・敵・装備が、タグや clone の形を保ったまま playable bundle、技能パック、Phase B encounter に届いている。これは「エンジンを止められるか」と「プレイヤーへ提供するか」の境界が未分離。
3. Phase B は EXPEDITION_ENCOUNTERS と phase-b.test.mjs / ecology-expedition-smoke.mjs で検査されている一方、Phase A の7区画も playable.test.mjs、phase-a.test.mjs、contract snapshot、beat smoke に残っている。削除すれば失われる互換・比較・戦闘契約があるため、削除はしなかった。
4. 表示文は、反応5件・装備5件の明示的な数値ずれと、固定量を省略していた装備2件を確認した。係数・挙動は変えず、表示文を実効値へ揃え、readout smoke の対象を active / reactive / passive / equipment へ拡張した。

この監査では、閾値・ゲーム数値・engine の仕様を変更していません。analysis/ecology-decision-space-smoke.mjs は未変更です。別担当の挙動作業と衝突する ecology/content/skills-reactive.mjs も未変更で、ecology/content/skill-tree.mjs は表示文だけを修正しました。

## 調査条件

- 基準: main の 43f5e2ce28794f092db0468fd681199c83971709（PR #61 merge）
- 作業ブランチ: audit/ecology-test-fixtures-20260831
- 必読資料は AGENTS.md → PROJECT_MEMORY.md → analysis/CURRENT.md → analysis/ECOLOGY_DECISION_SPACE_20260830.md → docs/OPERATIONS.md の順で確認した。
- ecology/fixture-content.mjs、その参照テスト5本、ecology/content/、Phase A/B の battle builder・snapshot・smoke・表示文を、定義と実行経路がつながるところまで照合した。
- 「通った」は面白さの証明とは扱わない。fixture / contract / smoke は、それぞれ何を証明しているかを分けて記録する。

## 1. fixture が engine の証人と game の仕様を兼ねている箇所

### F-01: cover_ally の二重 redirect

| 項目 | 内容 |
|---|---|
| 場所 | ecology/fixture-content.mjs:349-365、ecology/engine.test.mjs:199-215、ecology/content/base.mjs:11-19、ecology/content/skills-reactive.mjs:31-51 |
| 何を固定しているか | cover_ally の rule は target_selected interrupt、chain 内1回、RP1、redirect_pending_target。fixture battle では engine.test.mjs が同じ敵行動に対する target_changed を2件、順序つきで期待する。 |
| なぜ古い / 危険か | 2件の redirect は「候補列挙・優先順・target の再評価・順次処理」を証明する R5 witness としては適切。しかし renamed() が定義全体を clone するため playable 側にも同じ無共有の反応権モデルが届く。依頼で報告された、敵の一撃ごとに全員がRP1を使って引き取り合う事故を、fixture test の緑だけでは検出できない。監査時点の main には依頼文にある limit.shared の修正はまだ入っていない。 |
| 提案 | fixture 側は二重 redirect の witness として残す。遊べる側は「一つの敵行動に対する身代わり予算」を content 側で明示し、別の playable test で共有上限を検査する。engine.test.mjs の文言も「ゲーム仕様」ではなく「fixture の順次 redirect witness」と分かる名前にする。 |
| 作者判断 | 要る。共有の単位（action / chain / round など）と、身代わりを複数装備したときの扱いを作者が決める必要がある。 |

### F-02: urging の ordering witness が playable pack に入っている

| 項目 | 内容 |
|---|---|
| 場所 | ecology/fixture-content.mjs:426-464、ecology/content/skills-reactive.mjs:12-51、ecology/content/packs.mjs:47-58、ecology/content/roster.mjs の arcanist |
| 何を固定しているか | fixture のコメント自身が「ordering witness only」「not carried into production」と説明する、準備開始への外部 advance。fixture には対象がまだ準備中かを確認する predicate があり、反応順の証人になっている。 |
| なぜ古い / 危険か | renamed("reactiveSkills", ...) のあとに除外されず、pack_tempo で解禁可能、arcanist の starter reactive にも入っている。以前の「味方かどうかだけを predicate にして、完了後にもRPを払う」実害の修正コメントは fixture に残ったが、証人とゲーム仕様の所有権は分かれていない。 |
| 提案 | ordering witness を fixture-content 専用にし、playable の urging は別定義または明示的な production override として管理する。production 版を残すなら、実際に払う前の target eligibility と同一 chain 内の発火数を playable test で見る。 |
| 作者判断 | 要る。急かすを現行ゲームの選択肢として残すか、engine test 専用へ戻すか。 |

### F-03: termination 用の技能が playable に流れている

| 項目 | 内容 |
|---|---|
| 場所 | ecology/fixture-content.mjs:246-267, 317-328, 513-633、ecology/content/skills-active.mjs:35-39、ecology/content/skills-reactive.mjs:31-51、ecology/content/packs.mjs:31-58、ecology/content/skill-tree.mjs |
| 何を固定しているか | long_swing は準備再入を試す3段準備、idle_shuffle はAP0・常時使用可能な自由行動 loop、ap_loop / damage_echo / barrier_bloom / relay_front / relay_rear / prep_spiral は同 owner / 同 rule の発火上限を証明する chain / battle loop。 |
| なぜ古い / 危険か | これらは termination タグと count:99 を持つ極端な engine witness。うち long_swing と4反応（ap_loop / damage_echo / barrier_bloom / prep_spiral）は pack / skill tree からプレイヤーが選べ、relay_front / relay_rear は現行の技能ツリーには出ないものの playable bundle へ残る。idle_shuffle は playable 側で steady_aim の互換 alias に上書きされるため挙動は軽減されているが、旧 save 互換として残り、同じ ID が fixture と production の両方に存在する。テストが「停止した」ことは、プレイヤーに提供する価値を保証しない。 |
| 提案 | fixture-only の ID と playable ID を分けるか、termination witness を production registry から明示的に除外する。除外できない旧 save ID は retired / compatibility policy を書き、現行 pack に出るものだけ別の playable behavior test を持つ。 |
| 作者判断 | 要る。どの termination 用技能をゲームの意図した高リスク選択として残すかを決める必要がある。 |

### F-04: termination 用の敵・装備も同じ bundle に残る

| 項目 | 内容 |
|---|---|
| 場所 | ecology/fixture-content.mjs:747-775, 925-937、ecology/content/equipment-fixed.mjs:39-48, 178-179、ecology/content/enemies.mjs:34-105、ecology/content/expedition.mjs:167-212 |
| 何を固定しているか | hungry_plate は自身の wear に反応する self-wear witness、husk_echo は damage_echo を持つ echo witness。cloneEquipment() / cloneEnemy() は元定義の rule / reactiveSkillIds / tags を保持する。 |
| なぜ古い / 危険か | hungry_plate は報酬 pool からは除外されているが、playable equipment bundle と旧 save test には存在する。gray_echo は husk_echo から clone され、damage_echo を保持したまま Phase B の5・6・7・8・12戦などに登場する。つまり termination witness のための意味が、敵の現行 encounter の仕様へ継承されている。 |
| 提案 | 敵については「反響体をゲームへ出す」という意図を明示した production 定義にし、fixture 由来の termination tag / rule を偶然継承しないようにする。装備は hungry_plate の旧 save 互換と報酬 pool 外の扱いを分けて記録する。 |
| 作者判断 | 要る。反響体の反射はゲーム仕様として残すのか、termination test 専用に戻すのか。 |

### F-05: clone 境界そのものが provenance を隠す

| 項目 | 内容 |
|---|---|
| 場所 | ecology/content/base.mjs:11-48、ecology/content/index.mjs:44-55 |
| 何を固定しているか | renamed() は fixture の各 section を全件 clone し、cloneActive / cloneEnemy / cloneEquipment も fixture を起点にする。さらに bundle は ...FIXTURE_CONTENT を先に spread する。 |
| なぜ古い / 危険か | playable 定義が「fixture の派生」なのか「ゲームの定義」なのか、コード上で区別できない。現在のタグを見ると、playable bundle には long_swing、6つの termination reactive、hungry_plate、husk_echo、gray_echo が termination の provenance を持ったまま残っている。 |
| 提案 | fixture と playable を registry レベルで分離し、派生が必要な項目だけ production 側で明示的に書く。設計が決まったあと、fixture tag / termination tag が production へ漏れたら落とす provenance smoke を追加する。現時点でこれを落とす検査は、作者の仕様決定前に既存 playable を全て赤くするため追加していない。 |
| 作者判断 | 要る。分離後も旧 ID / 旧 save をどう読むかを含む。 |

### 参照テスト5本の分類

| テスト | 現在の主な証人 | 判定 |
|---|---|---|
| ecology/engine.test.mjs | event queue、interrupt / after、target change、cost、決定性などの engine 不変条件。cover の2 redirectだけは playable 仕様に読める文言になっている。 | 大半は fixture-only のままでよい。F-01 の意味を「ゲーム仕様」と混同しない整理が必要。 |
| ecology/extensibility.test.mjs | Gate E の4項目が、engine を変更せずデータ追加だけで成立すること。 | engine / fixture の証人。現行の「4項目が production に採用されたか」は見ていない。 |
| ecology/mine.test.mjs | fixture pool の chain 形状、決定性、エラー診断、termination を採掘できること。 | fixture-only の証人。fun や playable balance のテストではない。 |
| ecology/schema.test.mjs | fixture bundle / battle が schema を通り、意図した不正データを拒否すること。 | fixture-only の validator test。content 側のゲーム意味は固定しない。 |
| ecology/termination.test.mjs | ap_loop、damage_echo、barrier_bloom、prep_spiral、hungry_plate などが上限・診断つきで止まること。 | engine の停止性証人。playable bundle へ同じものを露出させる理由は別途必要。 |

## 2. Phase A の遺物と、消すと失われるもの

Phase B の現行経路は ecology/content/expedition.mjs の EXPEDITION_ENCOUNTERS、makeExpeditionBattle()、ecology/phase-b.test.mjs、analysis/ecology-expedition-smoke.mjs です。Phase A の7区画は消さず、依存関係を以下のように記録します。

| 依存先 | Phase A への依存 | 消すと失われるもの | 提案 | 作者判断 |
|---|---|---|---|---|
| ecology/content/encounters.mjs | 旧7区画 ENCOUNTERS と ENEMY_TARGETING の source。 | 旧 battle input と旧表示名・敵狙いの比較基準。 | legacy-phase-a と明示して保存するか、移行表を残して retired にする。 | 要る |
| ecology/playable-battles.mjs | makeBattle() / allEncounters() / encounterInfo() / stageRule() が旧 ENCOUNTERS を読む。makeExpeditionBattle() は Phase B 側。 | 旧 save / caller / replay adapter が使う入口。 | current entry と legacy adapter を API 上でも名前で分ける。 | 要る |
| ecology/playable.test.mjs | for (stage = 1; stage <= 7) の validate・deterministic replay・snapshot、makeBattle(7) の Wave 1 clear / default no-clear、旧 idle_shuffle と target / durability の補助検査。 | 旧7戦を最後まで再生する互換証拠、Wave 1 の旧 final 判定、legacy alias の安全性。現行12戦の通し検査は持っていない。 | 12戦の検査は Phase B 側へ寄せ、旧7戦部分は legacy と明示するか、保存 replay 用へ分離する。 | 要る |
| ecology/phase-a.test.mjs | 主体は custom CONTENT による block / guard / 多段 / row-column / reach / deterministic の低レベル戦闘契約。後半で current content の makeBattle(2) を一度使う。 | Phase B でも使う engine mechanics の契約。単純に削除すると、隊列・防御・射程の回帰検査が消える。 | combat-contract.test.mjs のような名前へ移し、旧 makeBattle(2) の1ケースは Phase B fixture へ移す。 | 要る |
| ecology/contract-snapshot.mjs | STAGES = [1..7]、旧 battles / rewards / encounterInfo / stageRules を snapshot に含める。後半には Phase B 12戦も含む。 | 旧保存形式・D1 / replay の7 battle input と reward の安定した比較点。 | current contract と legacyPhaseAContract を別 section / 別 snapshot に分ける。 | 要る |
| ecology/contract.test.mjs | frozen battles が7件、rewards が42件以上であることを明示し、全体を深一致・byte一致する。 | 旧7戦の contract が勝手に消えたことを検出する guard。 | 7件を legacy contract として意図的に残すか、migration と一緒に別 snapshot へ移す。数字を緩めるだけにはしない。 | 要る |
| analysis/ecology-beats-smoke.mjs | makeBattle(stage) を1〜7で回し、旧7区画の実イベントを拍へ畳めることを検査。 | 旧UI replay beat の7区画実測。Phase B 12戦の beat coverage は不足する。 | makeExpeditionBattle() の12戦版へ移すか、旧比較 smoke として名前・出力を明示する。 | 要る |
| analysis/ecology-decision-space-smoke.mjs | 旧7区画を decision-space の測定対象にしている。 | 直近の比較基準・測定結果。 | 別担当が Phase B へ移す。今回触っていない。 | 別担当 |

### Phase A を残す理由と、現行との混同

- Phase A を残す価値は、旧 save / replay / D1 contract の互換、過去の比較測定、そして Phase B が引き続き使う低レベル戦闘語彙の回帰検査です。
- 残すことの危険は、playable.test.mjs の「7区画を通し、7戦目で Wave 1 を判定する」ことが現行遠征の合格条件に見えることです。
- したがって、今回の安全な文書修正では ecology/PLAYABLE_RULES.md と ecology/README.md に現行 Phase B と旧 Phase A の境界を明記しました。テスト・snapshot の移動や削除は作者判断として残しています。

## 3. 表示文・文書の値ずれ

### 係数・固定量の棚卸し

bpsForLegacyAmount(N) は N をそのまま百分率にしません。中立値40、移行後尺度10倍なので、bpsForLegacyAmount(10) = 250% です。

| 対象 | 監査時の定義側 | 監査時の表示 | 判定 / 対応 |
|---|---:|---:|---|
| counter_blow | might の bpsForLegacyAmount(2) = 50% | 2ダメージ | 表示を50%へ修正 |
| guard_step | focus の bpsForLegacyAmount(2) = 50% | 防壁2 | 表示を50%へ修正 |
| brace_after_hit | focus の bpsForLegacyAmount(2) = 50% | 防壁2 | 表示を50%へ修正 |
| damage_echo | might の bpsForLegacyAmount(1) = 25% | 1ダメージ | 表示を25%へ修正 |
| barrier_bloom | focus の bpsForLegacyAmount(1) = 25% | 防壁1 | 表示を25%へ修正 |
| splinter_edge | flat constant 1 × 10 = 10 | 1ダメージ | 表示を10へ修正 |
| standing_plate | flat constant 2 × 10 = 20 | 防壁2 | 表示を20へ修正 |
| bastion_shell | flat constant 3 × 10 = 30 | 防壁3 | 表示を30へ修正 |
| block_latch | flat constant 1 × 10 = 10 | 防壁1 | 表示を10へ修正 |
| impact_spring | flat constant 1 × 10 = 10 | 防壁1 | 表示を10へ修正 |
| thorn_clasp | splinter_edge clone の flat constant 10 | 固定量の記載なし | 10ダメージを明記 |
| shard_hilt | splinter_edge clone の flat constant 10 | 固定量の記載なし | 10ダメージを明記 |

追加の照合結果は次のとおりです。

- 行動技能21件の stat-scaled 表示は、既存の6件を含め追加不一致なし。
- triage_relay の event-value scale は125%で表示と一致。
- 常設技能の maxHP / might / focus / guard / speed と、開始時AP・RP・blockの固定量は一致。
- guard_lantern、quiet_lensなど、数値を書かない定性的な装備文は「数値を勝手に補う」対象にしなかった。

### 文書の遺物

| 場所 | 問題 | 対応 |
|---|---|---|
| ecology/PLAYABLE_RULES.md | 7区画、Wave 1 の置換、Phase B は将来、報酬は「装備3候補 / 全員の技能点+2」、4枠など、Phase A の説明が現行として書かれていた。 | 現行の3幕12戦、4・8・12戦目のボス、装備2 / 技能点+2 / 補給+1、6枠を記載。旧7区画は「比較用・削除しない」の節へ移し、旧リプレイ・contract・beat smoke の依存を明記。戦闘尺度の数値は変更していない。 |
| ecology/README.md | check.mjs を8本と記載し、Phase B test と content/expedition.mjs の導線が無かった。 | 9本へ修正し、Phase B test・現行 expedition・旧 Phase A test の位置づけを記載。 |
| docs/REPOSITORY_MAP.md | main の対象commitが 3c0790c、EXP-18が8人・24技能・18装備・7区画のdraftと記載され、現行 Phase B とずれていた。 | main の監査基準commitと、Phase B 3幕12戦 / 旧Phase A互換資産を記載。 |
| docs/ のその他 | ecology の係数を直接表示する追加文言は検索で見つからなかった。歴史資料・実験票の旧数値は当時の証拠なので書き換えていない。 | 変更なし。 |

## 4. 通っているが守っていないテスト

### 実際に見つけた恒真比較

| 場所 | 元の形 | 判定 | 対応 |
|---|---|---|---|
| ecology/phase-b.test.mjs の報酬 section | assert.deepEqual(composeEncounter(2, 0), composeEncounter(2, 0)) | 同じ式を左右で評価しているだけで、報酬の引き直しが何も壊さないことを証明していなかった。 | 引き直し前に nextEncounterBefore を取り、rewardOffer(...) 後に nextEncounterAfter を取り、前後を比較する形へ修正。 |

### 恒真ではないが、意味を取り違えやすいもの

- ecology/phase-b.test.mjs の composeEncounter(7, 3) を同じ式同士で比較する行は、同じ入力から2回独立に編成を作る決定性テストなので恒真ではない。残した。
- ecology/contract.test.mjs の Object.keys(frozen.battles).length === 7 は恒真ではないが、現行12戦の数ではなく旧 Phase A contract の存在を固定する stale gate。数字を緩めず、残すか legacy snapshot へ分けるかを作者判断にした。
- ecology/playable.test.mjs の skill.effect.length > 0 は表示 registry の存在検査であり、技能の挙動を検査していない。現行 Phase B の通しも starter / mid / late の一部 loadout なので、21行動・14反応すべての発火条件を実行するものではない。これは不足であって、今の assert が恒真という意味ではない。
- analysis/ecology-contract-smoke.mjs の合成入力による self-check は、検出器自体が鳴ることを確かめるテスト。実ゲームの branch coverage と混同しない。
- analysis/ecology-beats-smoke.mjs は各拍の対象が空にならない totalSelf > 0 / totalOther > 0 を持っており、対象 branch が全く通らない green を防いでいる。ただし対象は旧7区画である。

### 未カバーとして残した提案

- 現行 Phase B の12 encounter は phase-b.test.mjs と ecology-expedition-smoke.mjs で validate / 決着 / rank を検査するが、全プレイヤー技能を1回ずつ使うテストではない。
- content/packs.mjs の pack ごとの技能が、実際の reward / manifest から使えることと、各 reactive の実発火条件は別検査が必要。fixture の termination test をその代用にしない。
- cover_ally、urging、termination 由来の定義は、作者が production policy を決めたあと、playable 用の実戦 scenario test を追加する。

## 実施した安全な修正

- ecology/content/skill-tree.mjs: 実効係数・実効固定量に表示文を合わせた。behavior / ID / threshold は変更していない。
- analysis/ecology-readout-smoke.mjs: nested effect を読み、active / reactive の stat-scaled、event-value scale、equipment の固定量、passive の statBonus / AP / RP / block を照合するよう拡張。既存の checked >= 10 閾値は動かしていない。
- analysis/ecology-test-hygiene-smoke.mjs: ecology test の assert.ok(true) と、同じリテラル同士の明らかな恒真比較を検出。意図的な変数同士の決定性比較は推測で禁止しない。
- ecology/phase-b.test.mjs: 報酬引き直しの恒真比較を、前後状態の実比較へ修正。
- ecology/contract-snapshot.json: 上記表示文の変更に伴う skills / equipment / components の凍結値だけを更新。battle 7件や Phase B の数値は変更していない。
- ecology/PLAYABLE_RULES.md、ecology/README.md、docs/REPOSITORY_MAP.md: 現行 Phase B と旧 Phase A の境界を明記。

## 実施しなかった修正

- analysis/ecology-decision-space-smoke.mjs は未変更。
- ecology/content/skills-reactive.mjs の limit.shared など、反応の発火回数・資源消費を変える挙動修正は未変更。別担当の修正と衝突するため、F-01 として提案のみ記録した。
- Phase A の ENCOUNTERS、7 battle snapshot、Phase A test、旧 beat smoke は削除・数字の緩和をしていない。
- 係数、戦闘数、敵のHP、難易度・関門の閾値は変更していない。

## 検査

監査ブランチ上で次を確認する。

~~~sh
node analysis/ecology-readout-smoke.mjs
node analysis/ecology-test-hygiene-smoke.mjs
node ecology/phase-b.test.mjs
bash analysis/check-all.sh
~~~

readout smoke は checked: 21、drifted: 0、4 section（active / reactive / passive / equipment）で通る。hygiene smoke は ecology の9 test fileを読み、literal tautology 0件で通る。phase-b.test.mjs は616 checksで通る。GitHub Actions の Checks run 33356168202（commit d12236037c26769abb94604d46fc7c9c6ee5babd）では bash analysis/check-all.sh が実際に実行され、全 fast checks が37368ms（1分以内）で通った。latest report commit の再実行は同一 source hash の cache hit だが、検査済みコードは変わっていない。今後1分を超える場合も閾値を動かさず、docs/OPERATIONS.md の pushごとの配置に従って分離する。
