// Generated from docs/skill-reboot/11-weapon-catalog.md by analysis/sync-pr287-weapon-spec.mjs.

export const WEAPON_SKILL_SPECIFICATIONS = Object.freeze([
  {
    "weaponId": "warhammer",
    "position": "R",
    "kind": "active",
    "displayName": "槌打ち",
    "implementationContract": "最も近い有効な敵一体へ腕力100%のダメージ。",
    "displayEffect": "敵1体に腕力100%のダメージ。",
    "flavorText": "振り下ろせば、それで十分だ。"
  },
  {
    "weaponId": "warhammer",
    "position": "A1",
    "kind": "passive",
    "displayName": "重い頭",
    "implementationContract": "自分の攻撃の第1hitのダメージを+15%。武器不問。",
    "displayEffect": "攻撃の1hit目のダメージ+15%。",
    "flavorText": "一撃の重みは、数では測れない。"
  },
  {
    "weaponId": "warhammer",
    "position": "A2",
    "kind": "reactive",
    "displayName": "響く鉄",
    "implementationContract": "自分の攻撃の第1hitが命中した時、RP1を一度消費。以降、その攻撃で対象へ命中するたび怯み1（第1hitを含めて最大2回）。武器不問。",
    "displayEffect": "攻撃の1hit目命中時、RP1を一度消費。その攻撃の命中hitごとに怯み1、最大2。",
    "flavorText": "鉄の音が、膝を折る。"
  },
  {
    "weaponId": "warhammer",
    "position": "A3",
    "kind": "active",
    "displayName": "大槌打ち",
    "implementationContract": "槌打ちを置換。ターゲット規則で選んだ敵1体へ腕力170%のダメージ。",
    "displayEffect": "敵1体に腕力170%のダメージ。",
    "flavorText": "重さをためらわず振り抜き、敵の芯まで叩き潰す。"
  },
  {
    "weaponId": "warhammer",
    "position": "AA1",
    "kind": "passive",
    "displayName": "鉄塊",
    "implementationContract": "自分の攻撃の第1hitのダメージ+20%。武器不問。",
    "displayEffect": "攻撃の1hit目のダメージ+20%。",
    "flavorText": "振るうのではない。落とすのだ。"
  },
  {
    "weaponId": "warhammer",
    "position": "AA2",
    "kind": "passive",
    "displayName": "深い衝撃",
    "implementationContract": "自分が付与する怯みは、付与段数にさらに+1。武器不問。",
    "displayEffect": "自分が付ける怯みにさらに+1。",
    "flavorText": "表面で止まった音は、肉と骨の奥で二度目の衝撃になる。"
  },
  {
    "weaponId": "warhammer",
    "position": "AA3",
    "kind": "active",
    "displayName": "震天打ち",
    "implementationContract": "大槌打ちを置換。最も近い敵へ腕力220%のダメージ。",
    "displayEffect": "敵1体に腕力220%のダメージ。",
    "flavorText": "天を震わせる一撃は、地の底まで逃がさない。\n立っているものすべてに、終わりの重さを教えてやる。"
  },
  {
    "weaponId": "warhammer",
    "position": "AB1",
    "kind": "reactive",
    "displayName": "振り幅",
    "implementationContract": "自分の攻撃計画の基礎対象が1体で、対象変更後の主対象の左右に元の射程で有効な敵が1体以上いる時、共通「副対象拡張」反応窓でリアクティブ優先列に選ばれれば、RP1でその敵全員を副対象として計画へ追加する。各副対象へ攻撃に使う能力値の35%の追加ダメージを1回ずつ与える。RPは計画時に消費し、不命中でも返さない。副対象追加は1行動1回で、派生ダメージは独立したhit/攻撃にならない。武器不問。",
    "displayEffect": "副対象拡張反応窓でRP1を払い、近接単体攻撃の主対象の左右にいる射程内の敵へ、攻撃に使う能力値の35%の追加ダメージを各1回。1行動1回。",
    "flavorText": "大振りは、隣まで巻き込む。"
  },
  {
    "weaponId": "warhammer",
    "position": "AB2",
    "kind": "passive",
    "displayName": "横薙ぎ",
    "implementationContract": "自分の攻撃計画で異なる有効な敵2体以上へダメージを予定した時、主対象と副対象を含む攻撃全体のダメージ+15%。横列/縦列、攻撃前にRPを払った振り幅、貫通、炸裂筒の副対象を含む。敵IDの重複や同じ敵への多段hitは人数に数えない。hitを解決する前に一度だけ判定し、後の不命中・防御・撃破で戻さない。派生ダメージや追撃で再判定しない。武器不問。",
    "displayEffect": "射程を問わず、攻撃前に2体以上の敵を対象にした攻撃のダメージ+15%。振り幅・貫通などの副対象も含む。",
    "flavorText": "槌の軌道を広げ、逃げた隣までまとめて薙ぎ払う。"
  },
  {
    "weaponId": "warhammer",
    "position": "AB3",
    "kind": "active",
    "displayName": "地割り",
    "implementationContract": "大槌打ちを置換。敵一列へ腕力160%のダメージ。",
    "displayEffect": "敵一列に腕力160%のダメージ。",
    "flavorText": "振り下ろした先から、大地そのものが敵へ牙を剥く。\n一列まとめて、立つ場所ごと叩き割れ。"
  },
  {
    "weaponId": "warhammer",
    "position": "B1",
    "kind": "target",
    "displayName": "鎧を指す",
    "implementationContract": "受け構えまたは防壁を持つ有効な敵を優先する。両方なら受け構えを持つ敵を優先し、同条件なら現在の受けが高い敵、距離、固定マス順で選ぶ。どちらも持たなければ次のターゲット規則へ進む。",
    "displayEffect": "受け構えのある敵、次に防壁のある敵を優先。同条件なら受けの高い敵。",
    "flavorText": "まず、硬いものから壊す。"
  },
  {
    "weaponId": "warhammer",
    "position": "B2",
    "kind": "reactive",
    "displayName": "打ち返し",
    "implementationContract": "敵の攻撃で自分以外の味方がHPダメージを受けた時、攻撃者が生存していればRP1で攻撃者へ腕力70%の反撃ダメージと怯み1。反撃ダメージは攻撃アクションとして扱わず、hit／攻撃開始時の効果を発生させない。1チェイン1回。武器不問。",
    "displayEffect": "味方が敵からHPダメージを受けた時、RP1で攻撃者に腕力70%の反撃ダメージと怯み1。1チェイン1回。",
    "flavorText": "仲間が殴られた音を聞いたなら、次に鳴るのは俺の槌だ。"
  },
  {
    "weaponId": "warhammer",
    "position": "B3",
    "kind": "active",
    "displayName": "破城打ち",
    "implementationContract": "槌打ちを置換。最も近い敵の防壁と受け構えをすべて除去してから、腕力130%のダメージ。",
    "displayEffect": "敵1体の防壁と受け構えをすべて除去し、腕力130%のダメージ。",
    "flavorText": "城壁も構えも、正面から砕けば同じだ。"
  },
  {
    "weaponId": "warhammer",
    "position": "BA1",
    "kind": "reactive",
    "displayName": "砕けた鎧",
    "implementationContract": "自分の攻撃効果がhit前またはhit中に敵の防壁を減らして0にした時、または受け構えを1以上減らした時、その防御結果直後に対象ごとに開く共通「防御崩し」反応窓でリアクティブ優先列に選ばれれば、その敵へ破甲2を付与する。同じ防御結果の窓は一度だけ開き、破甲は1段につき各hitの受け-1、終了時に半減し、段数上限なし。武器不問。",
    "displayEffect": "攻撃で防壁を壊すか受け構えを減らした直後、共通防御崩し窓で選ばれれば敵に破甲2。",
    "flavorText": "砕けた鎧は、もう守りにならない。"
  },
  {
    "weaponId": "warhammer",
    "position": "BA2",
    "kind": "reactive",
    "displayName": "砕け音",
    "implementationContract": "自分の攻撃のhitが受け構えで防がれ、そのhitで受け構えが減った後もその敵に受け構えが1以上残る時、同じhitの共通「防御崩し」反応窓でリアクティブ優先列に選ばれれば、残りの受け構えをすべて除去する。除去による効果は攻撃として扱わず、同じhitの窓を再び開かない。武器不問。",
    "displayEffect": "受け構えで防がれたhit後、残りの受け構えがあれば、防御崩し反応窓で選ばれた時にすべて除去。",
    "flavorText": "鎧の砕ける音が、次の一撃の合図になる。"
  },
  {
    "weaponId": "warhammer",
    "position": "BA3",
    "kind": "active",
    "displayName": "解体槌",
    "implementationContract": "破城打ちを置換。ターゲット規則で選んだ敵の防壁・受け構え・堅牢をすべて解除してから腕力170%のダメージ。受け構えを強化解除で二度数えない。基礎受けと破甲は残る。",
    "displayEffect": "敵1体の防壁・受け構え・堅牢をすべて解除してから、腕力170%のダメージ。",
    "flavorText": "鎧も構えも、積み上げた守りも関係ない。\n守れるという思い込みから、順番に解体する。"
  },
  {
    "weaponId": "warhammer",
    "position": "BB1",
    "kind": "passive",
    "displayName": "戦利の破片",
    "implementationContract": "自分が敵の強化を1段解除するたび、自分へ堅牢2を付与する。受け構えも強化1段として数えるが、防壁は数えない。堅牢は終了時に半減し、段数上限はなく、各hitの受けを2増やす。",
    "displayEffect": "敵の強化を1段解除するたび、自分に堅牢2（受け+2、終了時に半減）。段数上限なし。",
    "flavorText": "敵の守りは、こちらの鎧になる。"
  },
  {
    "weaponId": "warhammer",
    "position": "BB2",
    "kind": "passive",
    "displayName": "逆鍛造",
    "implementationContract": "自分の攻撃開始時の堅牢1段につき、その攻撃のダメージ+15%。攻撃後に自分の堅牢をすべて消費する。付与元は問わない。",
    "displayEffect": "攻撃時、堅牢1段につきダメージ+15%。攻撃後に堅牢を全消費。",
    "flavorText": "拾い集めた敵の守りを、次に振り下ろす鉄へ鍛え直す。"
  },
  {
    "weaponId": "warhammer",
    "position": "BB3",
    "kind": "active",
    "displayName": "王殺し",
    "implementationContract": "破城打ちを置換。ターゲット規則で選んだ敵の防壁とすべての強化を全段解除してから腕力180%のダメージ。受け構えは強化に含めて一度だけ除去し、弱体・基礎能力は残る。",
    "displayEffect": "敵1体の防壁と強化をすべて解除してから、腕力180%のダメージ。受け構えも強化に含む。",
    "flavorText": "奪った守りを鉄へ鍛え、すべてを最後の一打へ。\n王冠ごと沈めてこそ、戦槌の勝ちだ。"
  },
  {
    "weaponId": "gauntlets",
    "position": "R",
    "kind": "active",
    "displayName": "正拳",
    "implementationContract": "最も近い有効な敵一体へ腕力90%のダメージを1hit。",
    "displayEffect": "敵1体に腕力90%のダメージ。",
    "flavorText": "余計な道具はいらない。"
  },
  {
    "weaponId": "gauntlets",
    "position": "A1",
    "kind": "passive",
    "displayName": "握り込み",
    "implementationContract": "自分の攻撃の2hit目以降の各hitのダメージ+10%。武器不問。",
    "displayEffect": "攻撃の2hit目以降の各hitのダメージ+10%。",
    "flavorText": "拳を握れば、力は逃げない。"
  },
  {
    "weaponId": "gauntlets",
    "position": "A2",
    "kind": "reactive",
    "displayName": "追い拳",
    "implementationContract": "自分の単体近接攻撃の第1hitが命中した時、RP1で同じ敵へ腕力50%の追撃1hit。1行動1回。武器不問。",
    "displayEffect": "単体近接攻撃の1hit目が命中した時、RP1で腕力50%追撃。1行動1回。",
    "flavorText": "一発で止めるから、次が見えない。"
  },
  {
    "weaponId": "gauntlets",
    "position": "A3",
    "kind": "active",
    "displayName": "二連拳",
    "implementationContract": "正拳を置換。同じ敵へ腕力65%のダメージを2hit。",
    "displayEffect": "敵1体に腕力65%のダメージを2hit。",
    "flavorText": "右で視線を奪い、左を逃げ道へ叩き込む。"
  },
  {
    "weaponId": "gauntlets",
    "position": "AA1",
    "kind": "passive",
    "displayName": "連打",
    "implementationContract": "追い拳が追加する追撃を1hit増やす。",
    "displayEffect": "「追い拳」の追撃を1hit増やす。",
    "flavorText": "拍が続く限り、拳も続く。"
  },
  {
    "weaponId": "gauntlets",
    "position": "AA2",
    "kind": "passive",
    "displayName": "拳圧",
    "implementationContract": "自分の近接攻撃は対象の受けを6無視する。複数hitなら各hitに適用し、他の受け無視とも合算する。武器不問。",
    "displayEffect": "近接攻撃は、各hitで対象の受けを6無視。",
    "flavorText": "連なる拳の圧が守りを押し潰し、身体の奥から息を奪う。"
  },
  {
    "weaponId": "gauntlets",
    "position": "AA3",
    "kind": "active",
    "displayName": "百裂",
    "implementationContract": "二連拳を置換。ターゲット規則で選んだ敵1体へ腕力65%のダメージを4hit。追い拳があれば主軸第1hitの命中時に一度だけ判定する。",
    "displayEffect": "敵1体に腕力65%のダメージを4hit。",
    "flavorText": "一打を見切った頃には、百の拳が身体を通り過ぎている。\n数える暇も、倒れる暇も与えない。"
  },
  {
    "weaponId": "gauntlets",
    "position": "AB1",
    "kind": "reactive",
    "displayName": "流し身",
    "implementationContract": "自分が任意の攻撃の対象になった`damage_proposed`時、RP1でその攻撃のダメージを35%減らす。発動前が前列なら、解決後も生存し後列に空きがあれば1マス後退する。ラウンド終了時、元の前列に空きがあれば戻る。武器不問。",
    "displayEffect": "RP1。自分が攻撃対象になった時、ダメージ-35%。生存し、後列に空きがあれば攻撃後に後退。ラウンド終了時に前列へ戻る。",
    "flavorText": "まともに受ける理由がなければ、拳も身体もそこには置かない。"
  },
  {
    "weaponId": "gauntlets",
    "position": "AB2",
    "kind": "passive",
    "displayName": "打って守る",
    "implementationContract": "自分の攻撃が1hit命中するたび、自分に防壁4。武器不問。",
    "displayEffect": "攻撃1hitごとに自分に防壁4。",
    "flavorText": "振り抜いた腕を引かず、そのまま次の衝撃を受ける盾に変える。"
  },
  {
    "weaponId": "gauntlets",
    "position": "AB3",
    "kind": "active",
    "displayName": "鉄身打ち",
    "implementationContract": "二連拳を置換。腕力140%のダメージ後、与えたHPダメージと同量の防壁を付与する。",
    "displayEffect": "敵1体に腕力140%のダメージ。与えたHPダメージと同量の防壁を得る。",
    "flavorText": "打ち抜いた手応えを、そのまま己の鎧へ変える。\n拳が届く限り、この身体は砕けない。"
  },
  {
    "weaponId": "gauntlets",
    "position": "B1",
    "kind": "target",
    "displayName": "目を離さない",
    "implementationContract": "HPが減っている有効な敵のうち、HP割合が最も低い敵を優先する。同率は距離、固定マス順。全員が満HPなら次のターゲットへ進む。",
    "displayEffect": "HPが減っている敵のうち、HP割合が最も低い敵を優先。",
    "flavorText": "倒れるまで、視線は切らない。"
  },
  {
    "weaponId": "gauntlets",
    "position": "B2",
    "kind": "passive",
    "displayName": "拳順",
    "implementationContract": "自分の攻撃が同じ敵に命中するたび連携1。上限300。連携対象がない時に得た連携は次に攻撃した敵へ結びつく。攻撃開始時の連携1につきその敵への与ダメージ+0.5%。攻撃中の増加は次の攻撃から適用。対象変更・対象撃破で0。連携は強化段数として複製・解除・消費できる。武器不問。",
    "displayEffect": "同じ敵への命中ごとに連携+1、最大300。連携1段につきその敵への与ダメージ+0.5%。対象変更・撃破で0。",
    "flavorText": "同じ相手なら、癖が読める。"
  },
  {
    "weaponId": "gauntlets",
    "position": "B3",
    "kind": "active",
    "displayName": "畳み掛け",
    "implementationContract": "正拳を置換。敵1体へ腕力120%＋攻撃開始時の連携1につき腕力1.5%。拳順の与ダメージ補正も適用し、連携は消費しない。",
    "displayEffect": "敵1体に腕力120%＋連携1につき腕力1.5%。",
    "flavorText": "積み重ねた読みを拳へ変え、逃げ道ごと畳み掛ける。"
  },
  {
    "weaponId": "gauntlets",
    "position": "BA1",
    "kind": "reactive",
    "displayName": "歩法",
    "implementationContract": "近接攻撃の直前、自分が後列で前列に空きがあれば、RP0で前進する。武器不問。",
    "displayEffect": "後列から近接攻撃する時、RP0で空き前列へ前進。",
    "flavorText": "足が運んだ力を、拳へ通す。"
  },
  {
    "weaponId": "gauntlets",
    "position": "BA2",
    "kind": "reactive",
    "displayName": "空いた懐",
    "implementationContract": "自分が1マス以上移動するたび、RP0で連携1を得る。上限300。連携対象がない時に得た連携は次に攻撃した敵へ結びつく。武器不問。",
    "displayEffect": "移動するたび連携+1、最大300。",
    "flavorText": "倒れた身体が空けた間合いを見逃さず、次に生きる場所へ滑り込む。"
  },
  {
    "weaponId": "gauntlets",
    "position": "BA3",
    "kind": "active",
    "displayName": "飛び込み膝",
    "implementationContract": "畳み掛けを置換。敵1体へ腕力170%＋攻撃開始時の連携1につき腕力2%。拳順の与ダメージ補正も適用し、連携は消費しない。",
    "displayEffect": "敵1体に腕力170%＋連携1につき腕力2%。",
    "flavorText": "踏み込んだ距離も読みも、すべて膝の一点へ。\n倒し切れなくても、次の一手は逃がさない。"
  },
  {
    "weaponId": "gauntlets",
    "position": "BB1",
    "kind": "reactive",
    "displayName": "見取り",
    "implementationContract": "隣接する味方が強化をN段得た時、RP1で同じ種類を自分へN段付与する。連携・仕込み・再生・誘引・受け構えも対象。共通の段数上限を適用。防壁・AP・RP・HPは対象外。複製による付与は見取り・重ね構えを再発動しない。",
    "displayEffect": "RP1。隣接味方が強化を得た時、自分も同じ強化を同じ段数得る。",
    "flavorText": "一度見た技は、身体が覚える。"
  },
  {
    "weaponId": "gauntlets",
    "position": "BB2",
    "kind": "reactive",
    "displayName": "重ね構え",
    "implementationContract": "自分が強化を得た時、RP1で同じ種類を1段追加する。連携・仕込み・再生・誘引・受け構えも対象。防壁・AP・RP・HPは対象外。追加付与は見取り・重ね構えを再発動しない。",
    "displayEffect": "RP1。自分が強化を得た時、同じ強化を1段追加。",
    "flavorText": "借りた型を、もう一度だけ自分の骨格へ重ねる."
  },
  {
    "weaponId": "gauntlets",
    "position": "BB3",
    "kind": "active",
    "displayName": "無手",
    "implementationContract": "畳み掛けを置換。攻撃開始時に自分の強化段数を種類ごとに数える。連携・仕込み・再生・誘引・受け構えを含み、各種類は最大6段まで数える。強化を消費せず、敵1体へ腕力160%＋数えた段数につき腕力20%のダメージ。連携が結び付く敵に命中した後は連携をさらに2得る。現在の強化は通常どおりこの攻撃にも適用する。",
    "displayEffect": "敵1体に腕力160%＋各強化の段数（種類ごと最大6）につき腕力20%。強化は消費せず、連携中の敵への命中後に連携+2。",
    "flavorText": "積み上げた型を、殴った後ではなく最後の一打へ。\n武器を持たぬ両手に、あらゆる強さを集める。"
  },
  {
    "weaponId": "launcher",
    "position": "R",
    "kind": "active",
    "displayName": "射出",
    "implementationContract": "最も近い敵一体へ技術100%のダメージ。",
    "displayEffect": "敵1体に技術100%のダメージ。",
    "flavorText": "必要な一本だけ、正しく通す。"
  },
  {
    "weaponId": "launcher",
    "position": "A1",
    "kind": "passive",
    "displayName": "高圧筒",
    "implementationContract": "自分の遠隔攻撃の第1hitのダメージ+15%。武器不問。",
    "displayEffect": "遠隔攻撃の1hit目のダメージ+15%。",
    "flavorText": "圧を逃がさず、一点へ。"
  },
  {
    "weaponId": "launcher",
    "position": "A2",
    "kind": "passive",
    "displayName": "穿孔針",
    "implementationContract": "自分の遠隔攻撃は対象の受けを8無視する。複数hitなら各hitに適用し、他の受け無視とも合算する。武器不問。",
    "displayEffect": "遠隔攻撃は、各hitで対象の受けを8無視。",
    "flavorText": "細い針ほど、守りの隙を通る。"
  },
  {
    "weaponId": "launcher",
    "position": "A3",
    "kind": "active",
    "displayName": "大口径射出",
    "implementationContract": "射出を置換。ターゲット規則で選んだ敵1体へ技術150%のダメージ。穿孔針などのパッシブは通常どおり適用する。",
    "displayEffect": "敵1体に技術150%のダメージ。",
    "flavorText": "さらに太く、さらに深く。必要な場所まで確実に通します。"
  },
  {
    "weaponId": "launcher",
    "position": "AA1",
    "kind": "passive",
    "displayName": "圧縮薬",
    "implementationContract": "自分の遠隔攻撃の第1hitのダメージ+15%。武器不問。",
    "displayEffect": "遠隔攻撃の1hit目のダメージ+15%。",
    "flavorText": "一滴に、もう一滴ぶんを詰める。"
  },
  {
    "weaponId": "launcher",
    "position": "AA2",
    "kind": "passive",
    "displayName": "硬芯",
    "implementationContract": "自分の遠隔攻撃の基礎対象に弱体があれば、攻撃ダメージ+20%。弱体の種類と付与元は問わず、複数種類あっても一度だけ適用。武器不問。",
    "displayEffect": "弱体のある敵への遠隔攻撃ダメージ+20%。",
    "flavorText": "折れない芯が圧を逃がさず、守りのさらに奥へ処置を運ぶ。"
  },
  {
    "weaponId": "launcher",
    "position": "AA3",
    "kind": "active",
    "displayName": "穿城射",
    "implementationContract": "大口径射出を置換。ターゲット規則で選んだ敵1体へ技術220%のダメージ。取得済みの穿孔針と硬芯は、それぞれの条件で別途適用する。",
    "displayEffect": "敵1体に技術220%のダメージ。",
    "flavorText": "細い一本に圧を重ね、城壁の向こうまで処置を通す。\n遮るものごと、必要な場所へ届かせます。"
  },
  {
    "weaponId": "launcher",
    "position": "AB1",
    "kind": "reactive",
    "displayName": "連装筒",
    "implementationContract": "自分の遠隔攻撃の第1hitが命中した時、RP1で同じ敵へ基礎量50%の追撃1hit。1行動1回。武器不問。",
    "displayEffect": "遠隔攻撃の1hit目命中時、RP1で同じ敵へ50%追撃。1行動1回。",
    "flavorText": "一本で足りないなら、筒を増やす。"
  },
  {
    "weaponId": "launcher",
    "position": "AB2",
    "kind": "reactive",
    "displayName": "援護弾",
    "implementationContract": "敵の攻撃で自分以外の味方がHPダメージを受けた時、攻撃者が生存していればRP1で攻撃者へ技術60%の援護射撃を1hit行う。1チェイン1回。援護弾自身はこの追撃で再発動しない。武器不問。",
    "displayEffect": "味方が敵からHPダメージを受けた時、RP1で攻撃者に技術60%の援護射撃。1チェイン1回。",
    "flavorText": "仲間へ向いた一撃へ、こちらから先に正確な返事を送る。"
  },
  {
    "weaponId": "launcher",
    "position": "AB3",
    "kind": "active",
    "displayName": "二連射",
    "implementationContract": "大口径射出を置換。同じ敵へ技術90%を2hit。",
    "displayEffect": "敵1体に技術90%のダメージを2hit。",
    "flavorText": "二つの弾が、別々の逃げ道を同時に塞ぐ。\n処方は二つ、結末はひとつです。"
  },
  {
    "weaponId": "launcher",
    "position": "B1",
    "kind": "target",
    "displayName": "医療役を抜く",
    "implementationContract": "HP回復を行う有効な敵がいればそれを優先する。いなければ防壁を付与する有効な敵を優先する。複数なら距離、固定マス順。どちらもいなければ次のターゲットへ進む。",
    "displayEffect": "HP回復を使う敵を優先。いなければ防壁を使う敵を優先。",
    "flavorText": "治す手から止めるのが合理的です。"
  },
  {
    "weaponId": "launcher",
    "position": "B2",
    "kind": "target",
    "displayName": "準備を抜く",
    "implementationContract": "準備中の有効な敵を優先する。複数なら準備値が高い順、さらに最も近い敵、既定の位置順。いなければ次のターゲットへ進む。",
    "displayEffect": "準備中の敵を優先。準備値が高い敵から選ぶ。",
    "flavorText": "完成する前なら、ただの隙です。"
  },
  {
    "weaponId": "launcher",
    "position": "B3",
    "kind": "active",
    "displayName": "指定射",
    "implementationContract": "射出を置換。ターゲット優先列、次に既定の最短距離で有効な敵1体を選ぶ。技術160%のダメージ。選んだ敵が準備中またはHP回復を行う敵なら技術230%。条件は対象確定時に固定する。",
    "displayEffect": "敵1体に技術160%。準備中またはHP回復を使う敵なら技術230%。",
    "flavorText": "狙う理由も落とす順番も、引き金の前に決めてあります。"
  },
  {
    "weaponId": "launcher",
    "position": "BA1",
    "kind": "reactive",
    "displayName": "観測孔",
    "implementationContract": "自分が攻撃の基準対象を選んだ時、その敵への観測3の付与を予約する。今回の基準対象は変更しない。攻撃主軸の解決後、開始前から同じ敵にあった観測を1段消費してから、予約した観測3を共通上限まで付与する。以前の観測が別の敵なら、予約分の付与で旧観測を消す。観測中の敵は次の味方の攻撃主軸でターゲット規則より先に選ぶ。観測中の敵へ味方の攻撃が命中した時、観測孔を持つ本人がRP0で技術30%の追撃をラウンド1回行う。誰が観測を付けたかは問わない。追撃は観測を消費せず、この技能を再発動しない。付与予約は1行動1回。",
    "displayEffect": "攻撃後、基準に選んだ敵へ観測3。その敵への味方の攻撃が命中した時、自分が技術30%で追撃（ラウンド1回）。",
    "flavorText": "見える穴を開ければ、皆がそこを狙える。"
  },
  {
    "weaponId": "launcher",
    "position": "BA2",
    "kind": "passive",
    "displayName": "測距",
    "implementationContract": "自分が観測中の敵へ与える攻撃ダメージ+20%。観測を付けた人物や使った武器は問わない。",
    "displayEffect": "観測中の敵への自分の攻撃ダメージ+20%。",
    "flavorText": "開いた穴を測り直せば、次の一発は迷わない。"
  },
  {
    "weaponId": "launcher",
    "position": "BA3",
    "kind": "active",
    "displayName": "一斉照準",
    "implementationContract": "指定射を置換。ターゲットで選んだ敵のいる横列へ技術160%のダメージ。攻撃主軸を解決した後、生存している基準対象へ観測2を付与する。この攻撃では新たな観測を消費しない。観測孔を取得していれば、観測中の敵への味方命中時に観測孔を持つ本人が無償追撃をラウンド1回行える。",
    "displayEffect": "選んだ敵のいる一列に技術160%のダメージ。基準に選んだ敵に観測2。",
    "flavorText": "私が開けた一点へ、全員の狙いを重ねてください。\nそこが敵陣の穴になります。"
  },
  {
    "weaponId": "launcher",
    "position": "BB1",
    "kind": "reactive",
    "displayName": "弱点標",
    "implementationContract": "自分の攻撃行動後、主対象が生存していればRP1でその敵へ露呈2を付与する。同じ敵には段数を加え、終了時に半減し、その敵が受けるダメージを1段につき+10%。付与者を問わず段数を合算し、別の敵に付けても以前の露呈は残る。敵に付く弱体段数として扱う。",
    "displayEffect": "攻撃後、主対象が生存していればRP1で露呈2。その敵が受けるダメージが1段につき+10%、段数上限なし。",
    "flavorText": "三手先ではなく、今撃つ一体だけを見ればいい。"
  },
  {
    "weaponId": "launcher",
    "position": "BB2",
    "kind": "reactive",
    "displayName": "合点射",
    "implementationContract": "味方の攻撃が露呈の敵へ命中した時、その敵が生存していればRP1で技術50%の追撃を1hit行う。1チェイン1回。合点射自身はこの追撃で再発動しない。",
    "displayEffect": "露呈の敵が生存中に味方の攻撃を受けた時、RP1で技術50%の追撃。1チェイン1回。",
    "flavorText": "小さな合図が敵の隙を照らし、味方の狙いを揃える。"
  },
  {
    "weaponId": "launcher",
    "position": "BB3",
    "kind": "active",
    "displayName": "一点集中射",
    "implementationContract": "指定射を置換。ターゲットで選んだ敵1体へ技術120%のダメージ。攻撃開始時にその敵の露呈が1段以上あれば技術200%に変わり、露呈の被ダメージ補正もこの攻撃へ適用する。攻撃後にその敵の露呈を全段消費する。誰が付けた段かは問わず、別の敵の露呈は消費しない。",
    "displayEffect": "敵1体に技術120%。露呈があれば200%になり、その被ダメージ補正を適用してから全消費。",
    "flavorText": "三つの標的も三手先もいらない。\n一点へ圧を集め、そこだけを撃ち抜きます。"
  },
  {
    "weaponId": "medical_kit",
    "position": "R",
    "kind": "active",
    "displayName": "応急防壁",
    "implementationContract": "HP割合が最も低い生存味方1人へ技術100%の防壁を付与。持続1ラウンド。直接HP回復は行わない。",
    "displayEffect": "味方1人に技術100%の防壁（1ラウンド）。",
    "flavorText": "傷を消せなくても、次の一撃を止める手はある。"
  },
  {
    "weaponId": "medical_kit",
    "position": "A1",
    "kind": "reactive",
    "displayName": "応急手当",
    "implementationContract": "味方が敵からHPダメージを受けた直後にHP50%以下になった時、RP1でその味方を技術50%回復。自分も対象にできる。1チェイン1回。実際の回復はその味方が同じチェイン中にHPダメージで失ったHPまで。",
    "displayEffect": "味方が被弾してHP50%以下になった時、RP1で技術50%回復。最大でもそのチェイン中に失ったHPまで。1チェイン1回。",
    "flavorText": "まだ戻せる。そう判断した瞬間に、手は動いている。"
  },
  {
    "weaponId": "medical_kit",
    "position": "A2",
    "kind": "passive",
    "displayName": "回復の手際",
    "implementationContract": "自分が発生させるHP回復量+15%。被弾に反応する回復では、加算後に同じチェインで失ったHPの上限を適用する。武器不問。",
    "displayEffect": "自分が与えるHP回復量+15%。",
    "flavorText": "手を早めるだけで、こぼれる命が減っていく。"
  },
  {
    "weaponId": "medical_kit",
    "position": "A3",
    "kind": "active",
    "displayName": "救護防壁",
    "implementationContract": "応急防壁を置換。HP割合が最も低い味方1人へ技術160%の防壁。直接HP回復は行わない。",
    "displayEffect": "最も傷ついた味方1人に技術160%の防壁。",
    "flavorText": "戻らない傷にも、戻るまでの時間は与えられる。"
  },
  {
    "weaponId": "medical_kit",
    "position": "AA1",
    "kind": "passive",
    "displayName": "急所を診る",
    "implementationContract": "HP50%以下の味方へHP回復を行う時、回復量+20%。武器・発動元不問。",
    "displayEffect": "HP50%以下の味方へのHP回復量+20%。",
    "flavorText": "どこを見れば、まだ間に合うか。"
  },
  {
    "weaponId": "medical_kit",
    "position": "AA2",
    "kind": "reactive",
    "displayName": "連携治療",
    "implementationContract": "同一の敵の一行動で2人以上の味方がHPダメージを受けた時、RP2で生存味方全員を技術30%回復する。1チェイン1回。各対象の回復量は同じチェイン中に失ったHPまで。",
    "displayEffect": "同じ敵の一行動で味方2人以上がHPダメージを受けた時、RP2で味方全員を技術30%回復。1チェイン1回。",
    "flavorText": "一人の深手を、隊全体で越える。"
  },
  {
    "weaponId": "medical_kit",
    "position": "AA3",
    "kind": "active",
    "displayName": "救命防壁",
    "implementationContract": "救護防壁を置換。HP割合が最も低い味方1人へ技術250%の防壁を付与し、その味方に付いた弱体を全種類・全段解除する。",
    "displayEffect": "最も傷ついた味方1人に技術250%の防壁。弱体をすべて解除。",
    "flavorText": "戻る命を囲う壁は、誰かの手を次へ渡す。"
  },
  {
    "weaponId": "medical_kit",
    "position": "AB1",
    "kind": "passive",
    "displayName": "早期手当",
    "implementationContract": "応急手当のHP50%以下という条件を外す。敵の攻撃で味方が実際にHPダメージを受けた後なら、HP割合を問わずRP1で回復できる。チェイン中に失ったHPを上限とする。",
    "displayEffect": "応急手当が、被弾後のHP割合に関係なく発動する。",
    "flavorText": "深く沈む前に、呼び止める。"
  },
  {
    "weaponId": "medical_kit",
    "position": "AB2",
    "kind": "passive",
    "displayName": "合併症対応",
    "implementationContract": "応急手当で味方のHPを回復した時、対象に付いた弱体を全種類・全段解除する。",
    "displayEffect": "応急手当で回復した味方の弱体をすべて解除。",
    "flavorText": "傷を塞ぐだけで終わらせず、次に倒れる理由まで取り除く。"
  },
  {
    "weaponId": "medical_kit",
    "position": "AB3",
    "kind": "active",
    "displayName": "野戦処置",
    "implementationContract": "救護防壁を置換。ターゲット規則または既定のHP割合最低で選んだ味方1人に技術180%の防壁を付与し、その味方に隣接する生存味方にも技術100%の防壁を付与する。隣接は味方2×3盤面の上下左右。",
    "displayEffect": "味方1人に技術180%の防壁。隣接する味方にも技術100%の防壁。",
    "flavorText": "救う手を一人へ伸ばしても、守る布は隣の命まで届く。\n立てる場所を残せば、治療は続けられる。"
  },
  {
    "weaponId": "medical_kit",
    "position": "B1",
    "kind": "passive",
    "displayName": "危険域",
    "implementationContract": "自分の主軸または自分が発動した技能がHP25%以下の味方へ直接付与する防壁量+100%。横板・再生などによる派生付与や、他人が付与した防壁には適用しない。武器不問。",
    "displayEffect": "HP25%以下の味方へ自分が直接与える防壁量+100%。",
    "flavorText": "危険なほど、壁は厚くする。"
  },
  {
    "weaponId": "medical_kit",
    "position": "B2",
    "kind": "reactive",
    "displayName": "緊急蘇生",
    "implementationContract": "味方が倒れた時、RP2でその味方を技術80%のHPで蘇生する。戦闘中の発動回数に上限は設けず、RPが足りない時は発動しない。",
    "displayEffect": "味方が倒れた時、RP2で技術80%のHPで蘇生。",
    "flavorText": "途切れた呼吸を、もう一度こちらへ引き戻す。"
  },
  {
    "weaponId": "medical_kit",
    "position": "B3",
    "kind": "active",
    "displayName": "戦列防壁",
    "implementationContract": "応急防壁を置換。味方一列へ技術100%の防壁を付与する。持続1ラウンド。",
    "displayEffect": "味方一列に技術100%の防壁（1ラウンド）。",
    "flavorText": "一人を守る布を、戦列全体へ伸ばす。"
  },
  {
    "weaponId": "medical_kit",
    "position": "BA1",
    "kind": "passive",
    "displayName": "広域化",
    "implementationContract": "自分の主軸が基礎対象として生存味方2人以上に防壁を付与する時、その主軸で各人に付与する防壁量+25%。基礎対象は横板などの派生付与より前に決め、派生で人数が増えても元の防壁量を再計算しない。武器不問。",
    "displayEffect": "2人以上を対象にする防壁の量+25%。派生した追加対象は人数に含めない。",
    "flavorText": "広げた布は、人数が増えても薄くならない。"
  },
  {
    "weaponId": "medical_kit",
    "position": "BA2",
    "kind": "reactive",
    "displayName": "重ね包帯",
    "implementationContract": "自分の主軸または自分が発動した技能が、再生以外から生存味方1人以上へ直接防壁を付与した後、RP1で今回防壁を直接与えた各対象へ再生1を付与する。派生した防壁付与は対象に含めず、再生由来の防壁では再発動しない。1行動1回。武器不問。",
    "displayEffect": "RP1。自分が防壁を直接与えた対象全員に再生1。1行動1回。",
    "flavorText": "結び直すたび、守りを次の一撃へ残していく。"
  },
  {
    "weaponId": "medical_kit",
    "position": "BA3",
    "kind": "active",
    "displayName": "野戦防壁",
    "implementationContract": "戦列防壁を置換。生存味方全員へ技術100%の防壁（1ラウンド）と再生1を付与する。再生は次のラウンド開始時、1段につき防壁15を付与し全段消費する。",
    "displayEffect": "味方全員に技術100%の防壁（1ラウンド）と再生1。",
    "flavorText": "戦列すべてを、ひとつの包帯で結ぶ。"
  },
  {
    "weaponId": "medical_kit",
    "position": "BB1",
    "kind": "reactive",
    "displayName": "血へ還す",
    "implementationContract": "ラウンド終了時、残存防壁が1以上ある生存味方がいる場合に限り、RP2で生存味方全員の残存防壁を解除し、各自が失った防壁量の50%をHP回復する。1ラウンド1回。",
    "displayEffect": "ラウンド終了時、残存防壁がある時だけRP2で味方全員の残存防壁を解除し、その50%だけHP回復。",
    "flavorText": "使い切れなかった守りを、次の傷が来る前に血へ戻す。"
  },
  {
    "weaponId": "medical_kit",
    "position": "BB2",
    "kind": "passive",
    "displayName": "戦後治療",
    "implementationContract": "戦闘終了時、生存味方全員のHPを技術20%回復する。",
    "displayEffect": "戦闘終了時、味方全員のHPを技術20%回復。",
    "flavorText": "戦いが終わった後まで、治療は終わらない。"
  },
  {
    "weaponId": "medical_kit",
    "position": "BB3",
    "kind": "active",
    "displayName": "終療防壁",
    "implementationContract": "戦列防壁を置換。選んだ味方一列へ技術160%の防壁（1ラウンド）と再生2を付与する。再生は次のラウンド開始時、1段につき防壁15を付与し全段消費する。",
    "displayEffect": "味方一列に技術160%の防壁（1ラウンド）と再生2。",
    "flavorText": "守る力を最後まで一列へ通し、戦闘の終わりまで立たせる。"
  },
  {
    "weaponId": "tower_shield",
    "position": "R",
    "kind": "active",
    "displayName": "守りを引く",
    "implementationContract": "自分へ防壁30と誘引2。誘引は有効な敵単体攻撃を自分へ書き換え、1消費する。",
    "displayEffect": "自分に防壁30と誘引2。",
    "flavorText": "狙うなら、私を。"
  },
  {
    "weaponId": "tower_shield",
    "position": "A1",
    "kind": "passive",
    "displayName": "厚板",
    "implementationContract": "自分が得る防壁+15。武器不問。",
    "displayEffect": "自分が得る防壁+15。",
    "flavorText": "厚みは、裏切らない。"
  },
  {
    "weaponId": "tower_shield",
    "position": "A2",
    "kind": "reactive",
    "displayName": "痛みの肩代わり",
    "implementationContract": "他の味方が敵の単体攻撃を受ける直前、RP1でその攻撃の元対象への全hitを自分へ変更する。元対象はその攻撃のダメージを受けない。自分の受け構え・受け・防壁・守勢で各hitを解決する。自分も既に対象なら発動しない。1チェイン1回。武器不問。",
    "displayEffect": "RP1。味方への単体攻撃を全hit引き受ける。自分の受け・防壁が効く。1チェイン1回。",
    "flavorText": "狙いを引き受けるだけが盾ではない。痛みそのものを、こちらへ分ければいい。"
  },
  {
    "weaponId": "tower_shield",
    "position": "A3",
    "kind": "active",
    "displayName": "堅守",
    "implementationContract": "守りを引くを置換。自分へ防壁60と誘引3。",
    "displayEffect": "自分に防壁60と誘引3。",
    "flavorText": "ここから先へは通さない。この盾が、皆の城壁になる。"
  },
  {
    "weaponId": "tower_shield",
    "position": "AA1",
    "kind": "passive",
    "displayName": "衝撃吸収",
    "implementationContract": "誘引で自分へ対象変更された攻撃の最終ダメージ-20%。武器不問。",
    "displayEffect": "誘引で引き受けた攻撃のダメージ-20%。",
    "flavorText": "受ける角度で、重さは変わる。"
  },
  {
    "weaponId": "tower_shield",
    "position": "AA2",
    "kind": "passive",
    "displayName": "城壁骨格",
    "implementationContract": "最大HP+15%。現在HPも同率で増える。",
    "displayEffect": "最大HP+15%。現在HPも同率で増える。",
    "flavorText": "受け止め続ける覚悟が骨を柱へ変え、身体そのものを城壁にする。"
  },
  {
    "weaponId": "tower_shield",
    "position": "AA3",
    "kind": "active",
    "displayName": "城門",
    "implementationContract": "堅守を置換。自分へ防壁100と誘引5。",
    "displayEffect": "自分に防壁100と誘引5。",
    "flavorText": "この身体を門とし、この盾を閉ざされた城壁とする。\n私が立つ限り、誰一人ここから先へは通さない。"
  },
  {
    "weaponId": "tower_shield",
    "position": "AB1",
    "kind": "passive",
    "displayName": "横板",
    "implementationContract": "自分が防壁を得る時、元の防壁量を確定した後、防壁の最も少ない他の生存味方1人へその50%の防壁を付与する。元の付与が主軸で1人対象だった場合も、この追加対象によって元の広域化の条件は変わらない。追加付与は横板を再発動させず、1効果につき1人。武器不問。",
    "displayEffect": "自分が防壁を得る時、防壁の最も少ない他の味方にもその半分を付与。追加付与からは再発動しない。",
    "flavorText": "盾は横へ広げられる。"
  },
  {
    "weaponId": "tower_shield",
    "position": "AB2",
    "kind": "passive",
    "displayName": "盾の列",
    "implementationContract": "自分が味方へ防壁を与えた時、その味方へ守勢1を付与する。守勢1段につき被ダメージ-4%、段数上限なし。複数人へ防壁を与えれば各人へ付与する。",
    "displayEffect": "自分が味方へ防壁を与えた時、その味方に守勢1（終了時に半減）。",
    "flavorText": "一枚ずつ重ねた盾が、仲間全員を覆う切れ目のない線になる。"
  },
  {
    "weaponId": "tower_shield",
    "position": "AB3",
    "kind": "active",
    "displayName": "防護線",
    "implementationContract": "堅守を置換。生存味方全員へ防壁45、自分へ誘引3を付与する。",
    "displayEffect": "味方全員に防壁45。自分に誘引3。",
    "flavorText": "盾を連ねたその線が、仲間のための前線になる。\n一歩も退かず、全員の帰る場所を守り抜く。"
  },
  {
    "weaponId": "tower_shield",
    "position": "B1",
    "kind": "passive",
    "displayName": "引き受け役",
    "implementationContract": "自分の誘引を1段消費するたび守勢1を得る。守勢は1段につき被ダメージ-4%、終了時に半減し、段数上限なし。",
    "displayEffect": "誘引を消費するたび守勢1。守勢1段につき被ダメージ-4%、終了時に半減。",
    "flavorText": "受けるほど、足は地に沈む。"
  },
  {
    "weaponId": "tower_shield",
    "position": "B2",
    "kind": "reactive",
    "displayName": "盾を差す",
    "implementationContract": "他の味方が敵の単体攻撃に狙われた時、RP1で自分の防壁30をその味方へ付与する。味方の位置も攻撃対象も変えない。1チェイン1回。武器不問。",
    "displayEffect": "味方が単体攻撃に狙われた時、RP1でその味方に防壁30。対象変更はしない。1チェイン1回。",
    "flavorText": "間に合うなら、迷う理由はない。"
  },
  {
    "weaponId": "tower_shield",
    "position": "B3",
    "kind": "active",
    "displayName": "盾撃",
    "implementationContract": "守りを引くを置換。ターゲット規則で選んだ敵1体へ腕力100%のダメージ後、自分へ防壁80。誘引は付与しない。",
    "displayEffect": "敵1体に腕力100%のダメージ。自分に防壁80。",
    "flavorText": "受けるだけが守りじゃない。押し返して道を空ける。"
  },
  {
    "weaponId": "tower_shield",
    "position": "BA1",
    "kind": "passive",
    "displayName": "守り分け",
    "implementationContract": "自分の防壁が1以上のダメージを止めた時、防壁が最も少ない他の生存味方へ止めた量の50%の防壁を付与する。1攻撃1回。",
    "displayEffect": "自分の防壁が止めたダメージの50%を、防壁の最も少ない味方へ与える。1攻撃1回。",
    "flavorText": "受け止めた力を、隣へ回す。"
  },
  {
    "weaponId": "tower_shield",
    "position": "BA2",
    "kind": "reactive",
    "displayName": "持ち直す",
    "implementationContract": "自分の防壁が敵の攻撃ダメージを1以上止めた時、RP1で自分に誘引2を付与する。1チェイン1回。武器不問。",
    "displayEffect": "自分の防壁が攻撃を防いだ時、RP1で自分に誘引2。1チェイン1回。",
    "flavorText": "一撃を止めた盾を、次の一撃へ向け直す。"
  },
  {
    "weaponId": "tower_shield",
    "position": "BA3",
    "kind": "active",
    "displayName": "聖域",
    "implementationContract": "盾撃を置換。ターゲット規則で選んだ敵1体へ腕力120%のダメージ後、生存味方全員へ防壁70。誘引は付与しない。",
    "displayEffect": "敵1体に腕力120%のダメージ。味方全員に防壁70。",
    "flavorText": "攻めて押し返した場所を、そのまま全員の安全地帯にする。"
  },
  {
    "weaponId": "tower_shield",
    "position": "BB1",
    "kind": "reactive",
    "displayName": "反響膜",
    "implementationContract": "自分の誘引が1段消費された時、RP0で攻撃者へ隙1を付与する。1攻撃1回。隙は次に受ける攻撃全体のダメージを1段につき30%増やし、その攻撃後に全消費する。",
    "displayEffect": "誘引を消費した時、攻撃者に隙1。1攻撃1回。",
    "flavorText": "受けた圧は、盾の向こうへ返してやる。"
  },
  {
    "weaponId": "tower_shield",
    "position": "BB2",
    "kind": "reactive",
    "displayName": "盾の奥",
    "implementationContract": "自分が敵の攻撃対象に確定した攻撃前、受け・防壁・守勢を引く前のその攻撃の基礎ダメージ全hit合計が自分の最大HPの25%以上なら、RP2でその攻撃の自分への全hitのダメージを無効化する。基礎量は攻撃側の能力値と各hit係数から一度だけ算出し、後の防御や被弾結果を先読みしない。複数対象攻撃なら他の対象へのダメージは残る。1チェイン1回。",
    "displayEffect": "RP2。自分への攻撃の補正前ダメージが最大HPの25%以上なら、その攻撃の自分への全hitを無効化。1チェイン1回。",
    "flavorText": "崩れるはずの瞬間、盾の奥へ嵐を収める。"
  },
  {
    "weaponId": "tower_shield",
    "position": "BB3",
    "kind": "active",
    "displayName": "城壁の返礼",
    "implementationContract": "盾撃を置換。ターゲット規則で選んだ敵へ腕力180%のダメージ後、自分へ防壁60・誘引3・守勢2を付与する。守勢は1段につき被ダメージ-4%、段数上限なし。",
    "displayEffect": "敵1体に腕力180%。自分に防壁60、誘引3、守勢2（被ダメージ-8%、終了時に半減）。",
    "flavorText": "受け止めた重さを相手へ返し、なお城壁のように立つ。\nここを越える一撃は、もう許さない。"
  },
  {
    "weaponId": "long_spear",
    "position": "R",
    "kind": "active",
    "displayName": "貫き突き",
    "implementationContract": "ターゲット規則で選んだ有効な敵1体へ腕力110%。同じ縦列を強制せず、斜めの敵も単体対象には選べる。",
    "displayEffect": "敵1体に腕力110%のダメージ。",
    "flavorText": "遠いほど、穂先は真っ直ぐ届く。"
  },
  {
    "weaponId": "long_spear",
    "position": "A1",
    "kind": "passive",
    "displayName": "遠間の読み",
    "implementationContract": "距離2以上の敵への自分の攻撃の与ダメージ+15%。武器不問。",
    "displayEffect": "距離2以上の敵への攻撃の与ダメージ+15%。",
    "flavorText": "間合いの外から、こちらだけが届く。"
  },
  {
    "weaponId": "long_spear",
    "position": "A2",
    "kind": "passive",
    "displayName": "鎧抜き",
    "implementationContract": "自分の攻撃は対象の受けを技術10ごとに2無視する（小数切捨て）。武器・距離不問。攻撃開始時に技術値で確定し、各hitで同じ値を適用する。",
    "displayEffect": "攻撃は、技術10ごとに対象の受けを2無視。",
    "flavorText": "鎧の重なりを見れば、突くべき隙は細く見える。"
  },
  {
    "weaponId": "long_spear",
    "position": "A3",
    "kind": "active",
    "displayName": "深突き",
    "implementationContract": "貫き突きを置換。ターゲット規則で選んだ有効な敵1体へ腕力145%。取得済みの鎧抜きは別に適用する。",
    "displayEffect": "敵1体に腕力145%のダメージ。",
    "flavorText": "一歩ぶん深く踏み込み、逃げ場の奥まで穂先を通す。"
  },
  {
    "weaponId": "long_spear",
    "position": "AA1",
    "kind": "passive",
    "displayName": "遠間の圧",
    "implementationContract": "距離2以上の敵への自分の攻撃の与ダメージ+20%。武器不問。",
    "displayEffect": "距離2以上の敵への攻撃の与ダメージ+20%。",
    "flavorText": "柄の端まで、間合いの力を余さない。"
  },
  {
    "weaponId": "long_spear",
    "position": "AA2",
    "kind": "reactive",
    "displayName": "貫通",
    "implementationContract": "自分の攻撃計画の基礎対象が1体で、対象変更後の主対象と同じ縦列に元の攻撃の射程で有効な別の敵がいる時、共通「副対象拡張」反応窓でリアクティブ優先列に選ばれれば、その敵へ主対象に向けた全基礎hitの合計ダメージの40%を追加ダメージとして1回与える。基礎ダメージは他の割合補正・受け・防壁を適用する前の値。副対象への追加ダメージは独立したhitや攻撃にならず、hitごとに繰り返さない。RPを消費せず、副対象がいなくても主対象を攻撃する。武器不問。",
    "displayEffect": "単体攻撃時、主対象と同じ縦列の別の敵にも、元の攻撃の基礎ダメージの40%を1回与える。",
    "flavorText": "最初の一人を抜いた穂先は勢いを失わず、その奥の敵まで貫く。"
  },
  {
    "weaponId": "long_spear",
    "position": "AA3",
    "kind": "active",
    "displayName": "天穿ち",
    "implementationContract": "深突きを置換。選んだ敵1体へ腕力230%。同じ縦列のもう1体にも腕力115%。副対象がいなくても主対象を攻撃する。",
    "displayEffect": "敵1体に腕力230%。同じ縦列のもう1体にも腕力115%。",
    "flavorText": "天へ伸びる一筋の穂先が、列の果てまで敵を貫く。\nこの間合いに並んだ以上、逃げ場などない。"
  },
  {
    "weaponId": "long_spear",
    "position": "AB1",
    "kind": "passive",
    "displayName": "二段突き",
    "implementationContract": "基礎hit数1の長射程攻撃へ、同じ対象への基礎量50%の追加hitを一つ加える。",
    "displayEffect": "1hit長射程攻撃に、同じ敵への50%追撃を追加。",
    "flavorText": "引いた穂先は、もう一度伸びる。"
  },
  {
    "weaponId": "long_spear",
    "position": "AB2",
    "kind": "reactive",
    "displayName": "縫い留め",
    "implementationContract": "自分の攻撃の最終hitが命中した時、RP0で対象へ移動不能2。1行動1回、武器不問。",
    "displayEffect": "攻撃の最終hitで移動不能2。1行動1回。",
    "flavorText": "連ねた突きの最後に穂先を残し、逃げる足を地面へ縫い止める。"
  },
  {
    "weaponId": "long_spear",
    "position": "AB3",
    "kind": "active",
    "displayName": "串刺し",
    "implementationContract": "深突きを置換。選んだ敵のいる縦列の前後に腕力180%。同じ縦列に1体しかいなければその敵だけを攻撃する。取得済みの縫い留めは最後に命中した敵へ一度だけ適用する。",
    "displayEffect": "選んだ敵と、同じ縦列の別の敵に腕力180%のダメージ。別の敵がいなくても攻撃する。",
    "flavorText": "並んだ敵も、重ねた守りも、一息にひとつの線へ縫う。\n穂先が止まるのは、最後の一人を抜いた後だ。"
  },
  {
    "weaponId": "long_spear",
    "position": "B1",
    "kind": "target",
    "displayName": "構えを刺す",
    "implementationContract": "準備中の有効な敵を優先する。複数なら準備値が高い順、距離、固定マス順。いなければ次のターゲットへ進む。",
    "displayEffect": "準備中の敵を優先。準備値が高い敵から選ぶ。",
    "flavorText": "構えが固まる、その前を刺す。"
  },
  {
    "weaponId": "long_spear",
    "position": "B2",
    "kind": "reactive",
    "displayName": "迎え槍",
    "implementationContract": "敵の攻撃で自分以外の味方がHPダメージを受けた時、攻撃者が生存していればRP1で攻撃者へ腕力80%の反撃ダメージと移動不能2。1チェイン1回。反撃ダメージは攻撃アクションとして扱わず、hit／攻撃開始時の効果を発生させない。武器不問。",
    "displayEffect": "味方が敵からHPダメージを受けた時、RP1で攻撃者に腕力80%の反撃ダメージと移動不能2。1チェイン1回。",
    "flavorText": "仲間へ向いた矛先へ、自分の槍を差し込む。"
  },
  {
    "weaponId": "long_spear",
    "position": "B3",
    "kind": "active",
    "displayName": "先制突き",
    "implementationContract": "貫き突きを置換。敵1体へ腕力180%。対象が準備中なら腕力100%を追加する。",
    "displayEffect": "敵1体に腕力180%。準備中の敵には腕力280%。",
    "flavorText": "動く兆しを先に射抜けば、相手の一手は始まらない。"
  },
  {
    "weaponId": "long_spear",
    "position": "BA1",
    "kind": "reactive",
    "displayName": "足を止める",
    "implementationContract": "自分が準備中の敵へ攻撃を命中させた時、RP0で対象へ移動不能2。1ラウンド1回。武器不問。",
    "displayEffect": "準備中の敵への命中時、移動不能2。ラウンド1回。",
    "flavorText": "足元を払えば、次の手は遅れる。"
  },
  {
    "weaponId": "long_spear",
    "position": "BA2",
    "kind": "reactive",
    "displayName": "横槍",
    "implementationContract": "移動不能が敵の移動を実際に止めた時、RP0でその敵へ腕力100%の追撃攻撃を1hit。1移動試行1回。この追撃は横槍を再発動しない。武器不問。",
    "displayEffect": "移動不能で敵の移動を止めた時、RP0で腕力100%の追撃。",
    "flavorText": "敵が動いた先へ先回りし、次の一歩が始まる場所に穂先を置く。"
  },
  {
    "weaponId": "long_spear",
    "position": "BA3",
    "kind": "active",
    "displayName": "関所",
    "implementationContract": "先制突きを置換。敵一列へ腕力220%。命中した敵へ移動不能2を付与する。",
    "displayEffect": "敵一列に腕力220%のダメージ。命中した敵は移動不能2。",
    "flavorText": "この槍を立てた場所から先は、誰の道でもない。\n越えようとした足は、その一歩ごと地へ縫い止める。"
  },
  {
    "weaponId": "long_spear",
    "position": "BB1",
    "kind": "reactive",
    "displayName": "遅延標",
    "implementationContract": "自分の攻撃が敵へ命中した時、RP0で対象が準備中なら残りの準備値を1増やし、そうでなければ移動不能2を付与する。1ラウンド1回。武器不問。",
    "displayEffect": "命中時、準備中の敵は残り準備+1。それ以外は移動不能2。ラウンド1回。",
    "flavorText": "順番を奪うのではなく、次の一歩だけを重くする。"
  },
  {
    "weaponId": "long_spear",
    "position": "BB2",
    "kind": "reactive",
    "displayName": "迎え返し",
    "implementationContract": "敵が攻撃を開始した時、RP1で攻撃者へ腕力120%の反撃ダメージと怯み1。1ラウンド1回。反撃ダメージは攻撃アクションとして扱わず、hit／攻撃開始時の効果を発生させない。",
    "displayEffect": "RP1。敵の攻撃開始時、攻撃者へ腕力120%の反撃ダメージと怯み1。ラウンド1回。",
    "flavorText": "敵が踏み出した瞬間へ、槍の返事を置く。"
  },
  {
    "weaponId": "long_spear",
    "position": "BB3",
    "kind": "active",
    "displayName": "時穿ち",
    "implementationContract": "先制突きを置換。敵1体へ腕力240%のダメージ。対象が準備中なら怯み2、そうでなければ怯み1を付与する。",
    "displayEffect": "敵1体に腕力240%。準備中なら怯み2、それ以外なら怯み1。",
    "flavorText": "未来を書き換えず、始まりかけた一手だけを断つ。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "R",
    "kind": "active",
    "displayName": "引き打ち",
    "implementationContract": "最も近い敵へ技術80%後、対象を自分の方向へ1マス動かす。空きがなければ移動だけ行わない。",
    "displayEffect": "敵1体に技術80%のダメージを与え、こちらへ1マス引く。",
    "flavorText": "届かないなら、届く場所へ引けばいい。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "A1",
    "kind": "passive",
    "displayName": "鉄鉤",
    "implementationContract": "自分の攻撃主軸に敵を強制移動させる効果が記載されていれば、その攻撃の与ダメージ+15%。移動先に空きがなく実際には動かせなくても適用する。武器不問。",
    "displayEffect": "敵を強制移動させる効果を持つ攻撃のダメージ+15%。移動できなくても有効。",
    "flavorText": "鉤が食い込めば、引くほど深い。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "A2",
    "kind": "passive",
    "displayName": "長縄",
    "implementationContract": "自分の敵への主軸が移動させる距離+1マス。武器不問。",
    "displayEffect": "敵を移動させる距離+1マス。",
    "flavorText": "あと一歩ぶん、縄を伸ばす。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "A3",
    "kind": "active",
    "displayName": "強引き",
    "implementationContract": "引き打ちを置換。技術130%後、自分へ2マス引く。",
    "displayEffect": "敵1体に技術130%のダメージを与え、こちらへ2マス引く。",
    "flavorText": "嫌がるほど強く引く。間合いも覚悟もこちらで決める。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "AA1",
    "kind": "passive",
    "displayName": "巻き上げ",
    "implementationContract": "自分の攻撃主軸に敵を強制移動させる効果が記載されていれば、その攻撃の与ダメージ+35%。実際の移動成否や距離では攻撃前の倍率を再計算しない。武器不問。",
    "displayEffect": "敵を強制移動させる効果を持つ攻撃のダメージ+35%。移動できなくても有効。",
    "flavorText": "巻き取る力を、傷へ変える。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "AA2",
    "kind": "passive",
    "displayName": "壁打ち",
    "implementationContract": "敵を予定した距離だけ強制移動させられなかった時、攻撃後に動かせなかった1マスにつき技術50%の追加ダメージ片を元の対象へ一度与える。移動前の元攻撃と対象数・倍率を再計算せず、追加片は元攻撃で固定した割合補正を一度だけ継承し、受け・防壁を新たに計算する。武器不問。",
    "displayEffect": "敵を動かせなかった距離1マスにつき、攻撃後に技術50%の追加ダメージ。",
    "flavorText": "引けない場所なら縄を張り切り、逃げ場のない衝撃をその場へ返す。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "AA3",
    "kind": "active",
    "displayName": "捕縛",
    "implementationContract": "強引きを置換。技術200%のダメージ後、対象を自分へ2マス引く。2マス引けなくてもダメージは与える。",
    "displayEffect": "敵1体に技術200%のダメージを与え、2マス引く。動かせなくても攻撃は行う。",
    "flavorText": "逃げ道を読み、足場を奪い、最後の一寸まで縄で塞ぐ。\n捕まえたのは身体ではない。戦場そのものだ。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "AB1",
    "kind": "target",
    "displayName": "救助索",
    "implementationContract": "味方を後列へ移動させる主軸の対象選択では、HP35%以下の前列味方を優先し、その中でHP割合が最も低い味方を返す。同率は固定マス順。該当者がいなければ次のターゲットへ進む。移動可能な後列がなくても前列の味方を選択し、防壁だけ付与できる。",
    "displayEffect": "前列の味方を後列へ移す時、HP35%以下の最も傷ついた味方を優先。",
    "flavorText": "危ないなら、縄は仲間にも投げる。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "AB2",
    "kind": "passive",
    "displayName": "引き上げ",
    "implementationContract": "自分が味方を移動させた時、その味方へ防壁30を付与する。",
    "displayEffect": "味方を移動させた時、その味方に防壁30。",
    "flavorText": "危地から引き寄せた仲間を、縄の届くところで終わらせず守りまで渡す。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "AB3",
    "kind": "active",
    "displayName": "救出",
    "implementationContract": "強引きを置換。救助索を含む味方ターゲット規則で選んだ生存前列味方1人を対象に固定し、後列の空きマスのうち現在の横位置に最も近い位置へ移せれば移す。移動の成否を問わず、その同じ対象へ技術250%の防壁を付与する。前列に生存味方がいない時は対象を選べず使用できない。",
    "displayEffect": "前列の味方1人を後列へ移す。移動できなくても、その味方に技術250%の防壁。",
    "flavorText": "どれほど遠く、どれほど危険でも、縄は必ず仲間へ届く。\n引き戻し、立たせるまでが救助だ。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "B1",
    "kind": "reactive",
    "displayName": "崩し足",
    "implementationContract": "自分が敵を移動させた時、RP0で実際に移動した距離1マスにつき、その敵へ隙1を付与する。移動しなければ発動しない。",
    "displayEffect": "敵を動かした時、移動1マスにつき隙1。",
    "flavorText": "足場をずらせば、守りもずれる。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "B2",
    "kind": "reactive",
    "displayName": "引き戻し",
    "implementationContract": "前列の味方が敵の単体攻撃に対象指定された時、後列に空きがあればRP1で最も近い後列へ移動させる。移動後に攻撃者の射程から外れればその味方への攻撃は不発となり、別の対象へ選び直さない。射程内なら受けるダメージを30%減らす。空きがなければ発動しない。1チェイン1回。武器不問。",
    "displayEffect": "RP1。狙われた前列味方を後列へ引く。射程外になればその味方への攻撃は不発。届く攻撃はダメージ-30%。",
    "flavorText": "危地に残すくらいなら、縄が届く場所まで引き戻す。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "B3",
    "kind": "active",
    "displayName": "投げ縄",
    "implementationContract": "引き打ちを置換。対象へ技術100%のダメージを与え、敵側盤面の空きマスのうち自分との距離が最も短くなるマスへ最大2マス引く。実際に動かした距離1マスにつき隙1。空きマスがなくてもダメージを与える。",
    "displayEffect": "敵1体に技術100%のダメージ。こちらへ最大2マス引き、移動1マスにつき隙1。",
    "flavorText": "後ろに隠れたなら、縄ごと前線へ投げ出してやる。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "BA1",
    "kind": "reactive",
    "displayName": "壁崩し",
    "implementationContract": "自分が敵を1マス以上移動させた時、RP0でその敵の受け構えを最大1段除去し、受け構えが0でも隙1を付与する。敵1体につきラウンド1回。",
    "displayEffect": "敵を動かすと、受け構えを最大1段除去し、隙1。受け構えがなくても有効。",
    "flavorText": "足場をずらせば、壁役の守りにも綻びができる。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "BA2",
    "kind": "reactive",
    "displayName": "釣り出し",
    "implementationContract": "自分が敵を前列へ移動させた時、RP1でその敵の防壁を最大30除去し、防壁が0でも隙1を付与する。武器不問。",
    "displayEffect": "RP1。敵を前列へ動かすと、防壁を最大30除去して隙1。防壁がなくても有効。",
    "flavorText": "引き出した敵の守りを、縄の先でほどいていく。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "BA3",
    "kind": "active",
    "displayName": "壁抜き",
    "implementationContract": "投げ縄を置換。基準対象選択で敵後列の有効な敵1体を選び、同じ縦列の敵前列に敵がいれば位置交換、空きならそこへ移動させる。位置交換/移動とその反応を攻撃前に解決し、選んだ元の敵を主対象として固定して技術180%と隙1を与える。前列へ移してもターゲット規則を再実行しない。敵後列に候補がなければ通常のターゲット規則で敵1体へ技術180%と隙1。",
    "displayEffect": "敵後列1体を同じ縦列の前列へ動かしてから、その敵へ技術180%と隙1。後列に敵がいなければ敵1体へ同じ攻撃。",
    "flavorText": "壁の後ろに隠れた役目ほど、前へ引きずり出して正面から崩す。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "BB1",
    "kind": "reactive",
    "displayName": "連動縄",
    "implementationContract": "自分が敵か味方を1マス以上移動させた時、RP0で実際に移動した距離1マスにつき自分に高揚1を付与する。高揚は主軸のダメージ・回復・防壁量を1段につき+20%、終了時に半減する。攻撃前の移動で得た段は同じ攻撃に有効、攻撃後なら次の行動から。武器不問。",
    "displayEffect": "敵か味方を動かすと、移動1マスにつき自分に高揚1。",
    "flavorText": "誰かが動けば、その動きが次の一投を強くする。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "BB2",
    "kind": "reactive",
    "displayName": "返し縄",
    "implementationContract": "自分が味方を移動させた時、RP0でその味方へ守勢1を付与する。1移動につき1回。武器不問。",
    "displayEffect": "味方を動かした時、RP0でその味方に守勢1。",
    "flavorText": "動いた者すべてへ、縄はすぐ次の意味を返す。"
  },
  {
    "weaponId": "grappling_hook",
    "position": "BB3",
    "kind": "active",
    "displayName": "大捕縛",
    "implementationContract": "投げ縄を置換。敵1体へ技術240%のダメージを与え、2マス引き、隙2を付与する。2マス引けなくてもダメージは与える。",
    "displayEffect": "敵1体に技術240%。2マス引き、隙2。動かせなくても攻撃は行う。",
    "flavorText": "逃げ道も守りもまとめて絡め取り、最後の一寸まで戦場をこちらへ引き寄せる。\n捕まえたなら、もう離さない。"
  },
  {
    "weaponId": "dual_blades",
    "position": "R",
    "kind": "active",
    "displayName": "二連斬り",
    "implementationContract": "最も近い敵へ腕力55%のダメージを2hit。",
    "displayEffect": "敵1体に腕力55%のダメージを2hit。",
    "flavorText": "二本あるなら、二度斬る。"
  },
  {
    "weaponId": "dual_blades",
    "position": "A1",
    "kind": "passive",
    "displayName": "研ぎ分け",
    "implementationContract": "基礎hit数2以上の自分の攻撃の与ダメージ+10%。武器不問。",
    "displayEffect": "2hit以上の攻撃の与ダメージ+10%。",
    "flavorText": "刃ごとに、違う角度で研ぐ。"
  },
  {
    "weaponId": "dual_blades",
    "position": "A2",
    "kind": "reactive",
    "displayName": "駆け込み",
    "implementationContract": "近接攻撃の直前、自分が後列で前列に空きがあれば、RP0で最も近い空き前列へ移動する。移動後の位置で射程を判定する。武器不問。",
    "displayEffect": "後列から近接攻撃する時、RP0で空き前列へ移動してから攻撃。",
    "flavorText": "届かない距離は、走って消す。"
  },
  {
    "weaponId": "dual_blades",
    "position": "A3",
    "kind": "active",
    "displayName": "三連斬り",
    "implementationContract": "二連斬りを置換。同じ敵へ腕力50%を3hit。後列なら駆け込みを先に解決する。",
    "displayEffect": "敵1体に腕力50%のダメージを3hit。",
    "flavorText": "二本の刃へもう一拍を重ね、逃げる隙ごと刻み取る。"
  },
  {
    "weaponId": "dual_blades",
    "position": "AA1",
    "kind": "passive",
    "displayName": "手数",
    "implementationContract": "自分の近接攻撃に基礎量35%の追加hitを1つ加える。武器不問。",
    "displayEffect": "近接攻撃に35%追撃を1hit追加。",
    "flavorText": "空いた一瞬にも、刃を差し込む。"
  },
  {
    "weaponId": "dual_blades",
    "position": "AA2",
    "kind": "reactive",
    "displayName": "引き足",
    "implementationContract": "`駆け込み`で前進した近接攻撃の解決後、RP0で後列に空きがあれば1マス後退する。武器不問。",
    "displayEffect": "「駆け込み」で前進した攻撃後、RP0で後列へ戻る。空きがある時のみ。",
    "flavorText": "斬るために危地へ踏み込み、刃の余韻が消える前に生きる場所へ戻る。"
  },
  {
    "weaponId": "dual_blades",
    "position": "AA3",
    "kind": "active",
    "displayName": "六花",
    "implementationContract": "三連斬りを置換。同じ敵へ腕力40%を6hit。",
    "displayEffect": "敵1体に腕力40%のダメージを6hit。",
    "flavorText": "六つの斬光が重なり、血煙の中に一輪の花を結ぶ。\n咲いたと気づく頃には、刃はもう鞘へ戻っている。"
  },
  {
    "weaponId": "dual_blades",
    "position": "AB1",
    "kind": "passive",
    "displayName": "刃渡し",
    "implementationContract": "2hit以上の攻撃では、射程内の有効な敵だけを攻撃開始時に固定する。ターゲット規則で選んだ主対象へ第1hitを割り当て、残りを有効な敵へ順番に配って各敵のhit数の差を最大1にする。同数候補は固定マス順。攻撃中の死亡で再配分せず、不発hitは消える。",
    "displayEffect": "2hit以上の攻撃の最初のhitを選んだ敵に当て、残りを射程内の敵へ均等に配る。",
    "flavorText": "一人へ執着せず、刃の行き先をその場で渡していく。"
  },
  {
    "weaponId": "dual_blades",
    "position": "AB2",
    "kind": "passive",
    "displayName": "無駄なし",
    "implementationContract": "一度の攻撃で複数体を攻撃する時、直前hitと別の敵へ割り当てたhitのダメージ+30%。対象・hit配分を確定した後で判定する。",
    "displayEffect": "一度の攻撃で複数体を攻撃する時、別の敵へ続けて当てるhitのダメージ+30%。",
    "flavorText": "同じ場所を二度切らず、空いたところへ刃を送る。"
  },
  {
    "weaponId": "dual_blades",
    "position": "AB3",
    "kind": "active",
    "displayName": "舞い斬り",
    "implementationContract": "三連斬りを置換。腕力50%のダメージを5hit。刃渡しがあれば第1hitを選んだ主対象へ、残りを有効な敵へ配る。なければ同じ主対象へ5hit。",
    "displayEffect": "敵に腕力50%のダメージを5hit。刃渡しがあればhitを配る。",
    "flavorText": "群れなら舞い、ひとりなら刃を重ねる。\nどちらでも、最後まで足を止めない。"
  },
  {
    "weaponId": "dual_blades",
    "position": "B1",
    "kind": "reactive",
    "displayName": "裂き傷",
    "implementationContract": "同じ敵への一行動中2hit目が命中した時、RP1で裂傷4を付与する。1行動1回。",
    "displayEffect": "同じ敵への2hit目に、RP1で裂傷4。1行動1回。",
    "flavorText": "二度目の刃が、傷を開く。"
  },
  {
    "weaponId": "dual_blades",
    "position": "B2",
    "kind": "target",
    "displayName": "血を追う",
    "implementationContract": "裂傷を持つ射程内の有効な敵のうち段数が最大の敵を優先する。同率は距離、固定マス順。裂傷持ちがいなければ次のターゲットへ進む。",
    "displayEffect": "裂傷が最も多い敵を優先。刃渡し中は最初のhitに適用。",
    "flavorText": "血の濃い方へ、刃が向く。"
  },
  {
    "weaponId": "dual_blades",
    "position": "B3",
    "kind": "active",
    "displayName": "傷刻み",
    "implementationContract": "二連斬りを置換。腕力50%を2hitし、各hit後に裂傷1を付与する。",
    "displayEffect": "敵1体に腕力50%を2hit。各hitで裂傷1。",
    "flavorText": "一太刀ごとに傷を開き、最後には逃げ道まで刻み消す。"
  },
  {
    "weaponId": "dual_blades",
    "position": "BA1",
    "kind": "reactive",
    "displayName": "傷口拡大",
    "implementationContract": "自分の攻撃で裂傷中の敵へhitが命中するたび、RP0で命中時点の裂傷1段につき固定ダメージ5を、そのhitの割合補正後、受け構え・受け・防壁の前に加える。固定値は割合補正で増やさず、既に決めた対象・hit配分・攻撃全体倍率を再計算しない。同一hitにつき一度。武器不問。",
    "displayEffect": "裂傷中の敵への命中hitごとに、裂傷1段につき固定5ダメージを追加。",
    "flavorText": "できた傷なら、そこから広げる。"
  },
  {
    "weaponId": "dual_blades",
    "position": "BA2",
    "kind": "reactive",
    "displayName": "返り刃",
    "implementationContract": "敵の攻撃で自分以外の味方がHPダメージを受けた時、攻撃者が生存していればRP1で攻撃者へ腕力45%の反撃ダメージと裂傷2。1チェイン1回。反撃ダメージは攻撃アクションとして扱わず、hit／攻撃開始時の効果を発生させない。武器不問。",
    "displayEffect": "味方が敵からHPダメージを受けた時、RP1で攻撃者に腕力45%の反撃ダメージと裂傷2。1チェイン1回。",
    "flavorText": "誰かの傷が開いたなら、その隙へ刃を返す。"
  },
  {
    "weaponId": "dual_blades",
    "position": "BA3",
    "kind": "active",
    "displayName": "血路",
    "implementationContract": "傷刻みを置換。敵一列へ腕力140%のダメージを与え、各対象へ裂傷2を付与する。",
    "displayEffect": "敵一列に腕力140%のダメージ。各対象に裂傷2。",
    "flavorText": "刻んだ傷と散った血が、次に駆ける道を赤く示す。\n列の端まで斬り抜けて、帰り道まで血路に変える。"
  },
  {
    "weaponId": "dual_blades",
    "position": "BB1",
    "kind": "reactive",
    "displayName": "刃の予約",
    "implementationContract": "自分以外の味方が非攻撃の主軸を解決した時、RP0で仕込み1を得る。仕込みは双刃・重弩で共有する強化段数で、最大6。武器不問。",
    "displayEffect": "味方の非攻撃主軸ごとに仕込み1。最大6。",
    "flavorText": "仲間が作った間へ、刃を予約する。"
  },
  {
    "weaponId": "dual_blades",
    "position": "BB2",
    "kind": "reactive",
    "displayName": "差し刃",
    "implementationContract": "味方の攻撃hitが敵へ命中し、その敵が生存している時、RP1と仕込み1で同じ敵へ腕力100%の追撃攻撃を1hit行う。1行動1回。対象が倒れていれば発動せず、仕込みとRPを消費しない。この追撃は差し刃を再発動しない。",
    "displayEffect": "味方の命中時、RP1と仕込み1で同じ敵へ腕力100%の追撃。1行動1回。",
    "flavorText": "仲間の一撃が作った刹那の隙へ、待たせた自分の刃を滑り込ませる。"
  },
  {
    "weaponId": "dual_blades",
    "position": "BB3",
    "kind": "active",
    "displayName": "千客万来",
    "implementationContract": "傷刻みを置換。攻撃前に仕込みを最大6段消費し、腕力80%のダメージを2+消費段数hit与える。第1hitはターゲット規則の主対象、残りは刃渡し取得時のみその規則で配る。未取得なら同じ敵へすべて当てる。各命中hit後に裂傷1。消費した仕込みは同攻撃の他の効果で再使用しない。",
    "displayEffect": "敵に腕力80%を2hit。仕込みを最大6消費して、1段につき1hit追加。各命中hitで裂傷1。",
    "flavorText": "仲間が作った一瞬へ、溜めた刃を惜しみなく差し込む。\n来る者すべてを迎えよう。ひとりに一刃、逃さずに。"
  },
  {
    "weaponId": "banner",
    "position": "R",
    "kind": "active",
    "displayName": "号令",
    "implementationContract": "APが最も少ない自分以外の生存味方1人へAP1。同率は準備中、さらに固定の人物順。自分は選べず、号旗のAP付与主軸は同じ人物がラウンド1回だけ使用できる。",
    "displayEffect": "自分以外のAPが最も少ない味方1人にAP1。号旗のAP付与主軸は各人物ラウンド1回。",
    "flavorText": "声が届く限り、次の一歩は止まらない。"
  },
  {
    "weaponId": "banner",
    "position": "A1",
    "kind": "passive",
    "displayName": "声を通す",
    "implementationContract": "自分の号旗の主軸（号令・進め・総進撃・列進・急かす・前借り命令）が味方へAPを付与した時、対象それぞれへ集中1を付与する。集中は次の主軸のダメージ・回復・防壁+30%。",
    "displayEffect": "号旗の主軸でAPを渡した味方に集中1。",
    "flavorText": "届く声は、刃より先に背を押す。"
  },
  {
    "weaponId": "banner",
    "position": "A2",
    "kind": "reactive",
    "displayName": "息を合わせる",
    "implementationContract": "非攻撃主軸で味方へAPを付与した後、RP1でその対象へRP1を渡す。同じ対象へラウンド1回。対象のRPが上限なら発動しない。",
    "displayEffect": "非攻撃主軸でAPを渡した後、RP1でその味方にRP1。対象ごとにラウンド1回。",
    "flavorText": "呼吸が合えば、合図は要らない。"
  },
  {
    "weaponId": "banner",
    "position": "A3",
    "kind": "active",
    "displayName": "進め",
    "implementationContract": "号令を置換。APが最も少ない味方1人へAP1と高揚1を付与する。取得済みの声を通す・大号令の付与もそれぞれ加える。解決後に息を合わせるの反応窓を開く。",
    "displayEffect": "味方1人にAP1と高揚1（終了時に半減）。",
    "flavorText": "前へ。迷う時間も、次の一歩も、こちらが引き受ける。"
  },
  {
    "weaponId": "banner",
    "position": "AA1",
    "kind": "passive",
    "displayName": "大号令",
    "implementationContract": "自分の非攻撃主軸が味方へAPを付与した時、対象それぞれへ高揚1を追加する。主軸・武器不問。高揚は主軸のダメージ・回復・防壁を1段につき+20%、終了時に半減。",
    "displayEffect": "非攻撃主軸でAPを渡した味方に高揚1を追加。",
    "flavorText": "大きな声は、隊全体の迷いを消す。"
  },
  {
    "weaponId": "banner",
    "position": "AA2",
    "kind": "reactive",
    "displayName": "二拍先",
    "implementationContract": "自分の号旗の主軸が1人へAPを付与する時、対象を確定した後、RP1を支払えれば付与AP量+1。複数対象には適用せず、RP不足なら発動しない。追加APも元の号旗のAPを再付与する効果を誘発しない。",
    "displayEffect": "RP1。号旗の主軸で1人へ渡すAPを+1。",
    "flavorText": "いま渡す一歩だけでなく、その次に必要な力まで声に乗せる。"
  },
  {
    "weaponId": "banner",
    "position": "AA3",
    "kind": "active",
    "displayName": "総進撃",
    "implementationContract": "進めを置換。APが最も少ない自分以外の味方1人へAP1・高揚2・集中1を付与する。号旗のAP付与主軸は同じ人物がラウンド1回だけ使用できる。",
    "displayEffect": "自分以外の味方1人にAP1・高揚2・集中1。",
    "flavorText": "一歩で止まるな。二歩目の力まで、この声が背中へ渡す。\n敵陣を抜けるその時まで、全員で進み続けろ。"
  },
  {
    "weaponId": "banner",
    "position": "AB1",
    "kind": "reactive",
    "displayName": "遺志の号令",
    "implementationContract": "味方が倒れた時、RP2で生存味方全員に集中1を付与し、APが最も少ない生存味方1人へAP1を与える。",
    "displayEffect": "味方が倒れた時、RP2で生存味方全員に集中1。AP最少の味方1人にAP1。",
    "flavorText": "倒れた者の一歩を、残った者全員の足へ渡す。"
  },
  {
    "weaponId": "banner",
    "position": "AB2",
    "kind": "reactive",
    "displayName": "揃い足",
    "implementationContract": "自分の号旗の主軸で味方1人以上へAPを付与した時、RP0で対象全員に守勢1を付与する。1行動1回。",
    "displayEffect": "号旗の主軸でAPを渡した味方に守勢1。",
    "flavorText": "出る足と攻撃の拍を、ひとつの号令へ揃える。"
  },
  {
    "weaponId": "banner",
    "position": "AB3",
    "kind": "active",
    "displayName": "列進",
    "implementationContract": "進めを置換。AP2を消費し、APが最も少ない自分以外の生存味方を最大2人選ぶ。それぞれにAP1と集中1を付与する。対象が1人なら1人のみ。号旗のAP付与主軸は同じ人物がラウンド1回だけ使用できる。",
    "displayEffect": "AP2。自分以外の味方最大2人に、それぞれAP1と集中1。",
    "flavorText": "二人ぶんの一歩を揃え、隊の攻めを一度に前へ出す。\n声が重なれば、列は崩れない。"
  },
  {
    "weaponId": "banner",
    "position": "B1",
    "kind": "target",
    "displayName": "次は誰だ",
    "implementationContract": "準備中の生存味方を優先する。同率はAPが最も少ない味方、さらに固定の人物順。いなければ次のターゲットまたは既定対象へ進む。",
    "displayEffect": "味方対象の非攻撃主軸で、準備中の味方を優先。",
    "flavorText": "待っている者から、先へ出す。"
  },
  {
    "weaponId": "banner",
    "position": "B2",
    "kind": "reactive",
    "displayName": "背を押す",
    "implementationContract": "味方が主軸を開始した時、RP1でその味方に集中1を付与する。付与した集中は開始した主軸へ適用。1チェイン1回。",
    "displayEffect": "RP1。味方の主軸開始時、その味方に集中1。1チェイン1回。",
    "flavorText": "あと一押しなら、こちらが出す。"
  },
  {
    "weaponId": "banner",
    "position": "B3",
    "kind": "active",
    "displayName": "急かす",
    "implementationContract": "号令を置換。自分以外でAPが最も少ない味方1人へAP1と集中1・借り1を付与し、その味方が準備中なら残り準備値を1減らす（0になれば通常の準備完了窓で解決）。借りは返済まで残る。",
    "displayEffect": "自分以外の味方1人にAP1・集中1・借り1。準備中なら残り準備-1。",
    "flavorText": "仕上がりを待つな。必要な一手を、今すぐ強くする。"
  },
  {
    "weaponId": "banner",
    "position": "BA1",
    "kind": "passive",
    "displayName": "借り札",
    "implementationContract": "自分の号旗の主軸で味方へ借りを付与した時、対象それぞれに高揚1を付与する。付与した借りの段数には依存しない。借りの付与は主軸で一度だけ行い、AP加算によって借りを重複付与しない。",
    "displayEffect": "号旗の主軸で借りを付与した味方に高揚1。",
    "flavorText": "前借りした一拍には、必ず返す時が来る。"
  },
  {
    "weaponId": "banner",
    "position": "BA2",
    "kind": "reactive",
    "displayName": "返済猶予",
    "implementationContract": "ラウンド開始時、借りの返済より前に、自分以外の借りがある生存味方1人を選ぶ。自分のRPを最大でその味方の借り段数まで支払い、支払ったRPと同数の借りを消す。RP0なら発動しない。1ラウンド1回。",
    "displayEffect": "ラウンド開始時、自分以外の味方1人の借りを、支払ったRP1につき1段消す。",
    "flavorText": "返すべき一拍を選び、次の一歩だけは軽くする。"
  },
  {
    "weaponId": "banner",
    "position": "BA3",
    "kind": "active",
    "displayName": "前借り命令",
    "implementationContract": "急かすを置換。自分以外の味方1人へAP3・高揚2・借り3を付与する。号旗のAP付与主軸は同じ人物がラウンド1回だけ使用できる。借りはラウンド開始時、所持APと借りの小さい方だけAPを減らして同じ段数を消す。未返済は次の開始時まで残る。借り札で追加の借りは付かない。",
    "displayEffect": "自分以外の味方1人にAP3・高揚2・借り3。借りはAPで返せるまで残る。",
    "flavorText": "明日の力も、今日の命も、勝利のためならここで使い切れ。"
  },
  {
    "weaponId": "banner",
    "position": "BB1",
    "kind": "reactive",
    "displayName": "持久旗",
    "implementationContract": "ラウンド終了時、そのラウンド中に味方が倒れておらず、味方全員が生存していれば、RP0で自分へ守勢3を付与する。守勢は先に行う半減の後に付与する。味方が倒れたラウンドは付与せず、既存の守勢は半減する。",
    "displayEffect": "味方全員が生存したラウンド終了時、自分に守勢3。次のラウンド終了時から半減。",
    "flavorText": "一日を越えるたび、旗には次の朝の色が増える。"
  },
  {
    "weaponId": "banner",
    "position": "BB2",
    "kind": "passive",
    "displayName": "旗の守り",
    "implementationContract": "ラウンド終了時、持久旗を解決した後に自分の守勢が4段以上なら、他の生存味方全員に守勢1を付与する。自分の守勢が5段以上なら付与を守勢2に増やす。発生源は問わない。守勢は1段につき被ダメージ-4%、終了時に半減。",
    "displayEffect": "ラウンド終了時、自分の守勢が4段以上なら他の味方全員に守勢1。5段以上なら守勢2。",
    "flavorText": "長く立つ旗は、立っている者の心まで守る。"
  },
  {
    "weaponId": "banner",
    "position": "BB3",
    "kind": "active",
    "displayName": "勝旗",
    "implementationContract": "急かすを置換。主軸開始時の自分の守勢段数で効果を固定する。4段未満なら味方全員へ防壁30、4段なら防壁60と集中1、5段以上なら防壁100と集中1を付与する。守勢を消費せず、APは付与しない。",
    "displayEffect": "味方全員に防壁30。守勢4段なら防壁60と集中1、5段以上なら防壁100と集中1。",
    "flavorText": "三度朝を迎えた旗が立つなら、ここで全員をもう一度立たせる。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "R",
    "kind": "active",
    "displayName": "装填射",
    "implementationContract": "準備1。完了後、最も近い敵へ腕力200%。",
    "displayEffect": "準備1の後、敵1体に腕力200%のダメージ。",
    "flavorText": "重い一矢には、待つ価値がある。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "A1",
    "kind": "passive",
    "displayName": "強弦",
    "implementationContract": "準備を要する自分の攻撃は、その攻撃の与ダメージ+20%。武器不問。",
    "displayEffect": "準備攻撃の与ダメージ+20%。",
    "flavorText": "張り詰めた時間まで、矢へ乗せる。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "A2",
    "kind": "passive",
    "displayName": "徹甲矢",
    "implementationContract": "自分の準備攻撃は各対象の最初のhitの直前に、その対象の防壁を現在量の50%（切り捨て）解除する。解除分はダメージやhitとして扱わず、防御崩しの反応窓を開く。武器不問。",
    "displayEffect": "準備攻撃の最初のhit前に、対象の防壁を半分解除。",
    "flavorText": "鎧を避けず、鎧ごと通す。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "A3",
    "kind": "active",
    "displayName": "重装填射",
    "implementationContract": "装填射を置換。準備1後、腕力280%。取得済みの`徹甲矢`は別に適用する。",
    "displayEffect": "準備1の後、敵1体に腕力280%のダメージ。",
    "flavorText": "もう一段、弦を引き切る。待った分だけ重く放つ。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "AA1",
    "kind": "passive",
    "displayName": "極太矢",
    "implementationContract": "準備を要する自分の攻撃は、その攻撃の与ダメージ+25%。武器不問。",
    "displayEffect": "準備攻撃の与ダメージ+25%。",
    "flavorText": "当てる矢ではない。潰す矢だ。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "AA2",
    "kind": "passive",
    "displayName": "城抜き",
    "implementationContract": "自分の準備攻撃で敵の防壁を壊した時、対象が生存していれば攻撃後に同じ対象へ腕力100%の追加ダメージを一度与える。防壁への解除だけで0になった場合も含む。この追加はhitではなく元の攻撃の派生ダメージで、城抜きや防御崩しを再発動しない。",
    "displayEffect": "準備攻撃で敵の防壁を壊した時、同じ敵に腕力100%の追加ダメージ。",
    "flavorText": "城壁の厚みまで読み切った芯が、重い矢の力を一点も逃がさない。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "AA3",
    "kind": "active",
    "displayName": "城砕き",
    "implementationContract": "重装填射を置換。準備1後、腕力400%のダメージ。徹甲矢・城抜きはそれぞれの条件で別途適用する。",
    "displayEffect": "準備1の後、敵1体に腕力400%のダメージ。",
    "flavorText": "城壁を射抜く太矢へ、待った時間も張り詰めた力も注ぎ込む。\n逃げる必要はない。城ごと消せばいい。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "AB1",
    "kind": "reactive",
    "displayName": "炸裂筒",
    "implementationContract": "自分の準備攻撃の攻撃計画の基礎対象が1体で、対象変更後の主対象以外に同じ列で元の射程の有効な敵がいる時、共通「副対象拡張」反応窓でリアクティブ優先列に選ばれれば、その敵へ基礎量の35%を与える。RPを消費しない。武器不問。",
    "displayEffect": "副対象拡張反応窓で選ばれた時、準備を要する単体攻撃は同じ列の他の敵にも基礎量35%を与える。",
    "flavorText": "着弾は一点、爆風は一列。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "AB2",
    "kind": "reactive",
    "displayName": "爆圧",
    "implementationContract": "自分の準備攻撃が2体以上に命中した時、RP0でその攻撃の対象全員へ怯み1を付与する。1行動1回。",
    "displayEffect": "準備攻撃が2体以上に命中した時、対象全員に怯み1。1行動1回。",
    "flavorText": "着弾から膨れた空気が列を呑み込み、敵の次の一手まで押し潰す。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "AB3",
    "kind": "active",
    "displayName": "破裂矢",
    "implementationContract": "重装填射を置換。準備1後、敵一列へ腕力220%。取得済みの`爆圧`で各対象へ怯み2。",
    "displayEffect": "準備1の後、敵1列に腕力220%のダメージ。",
    "flavorText": "一本の着弾が列を呑み、爆圧が次の一手まで奪い去る。\n並んだことを後悔する間も与えない。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "B1",
    "kind": "target",
    "displayName": "大物を狙う",
    "implementationContract": "最大HPが最も高い有効な敵を優先する。同率は現在HPが高い敵、さらに最も近い敵、既定の位置順。",
    "displayEffect": "最大HPが最も高い敵を優先。",
    "flavorText": "大きな獲物にこそ、重い矢を使う。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "B2",
    "kind": "reactive",
    "displayName": "迎撃照準",
    "implementationContract": "敵が準備を開始した時、その敵が生存していればRP1で腕力70%の射撃1hitと怯み1を与える。射撃は追撃攻撃として解決し、この技能自身は再発動しない。1チェイン1回。武器不問。",
    "displayEffect": "敵が準備を開始した時、RP1で腕力70%の射撃と怯み1。1チェイン1回。",
    "flavorText": "弦を引く音を聞いたら、放たれる前にこちらの矢を通す。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "B3",
    "kind": "active",
    "displayName": "強装填",
    "implementationContract": "装填射を置換。準備1の後、最も近い有効な敵へ腕力260%のダメージ。対象が準備中なら腕力360%に上げる。準備完了時に対象と条件を固定する。",
    "displayEffect": "準備1。敵1体に腕力260%。準備中の敵には腕力360%。",
    "flavorText": "今いる場所へ、待った時間ごと重い矢を通す。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "BA1",
    "kind": "reactive",
    "displayName": "準備射撃",
    "implementationContract": "自分が準備中に敵の攻撃でHPダメージを受けた時、攻撃者が生存していればRP0で腕力40%の反撃ダメージを与える。1ラウンド1回。反撃ダメージは攻撃アクションとして扱わず、hit／攻撃開始時の効果を発生させない。",
    "displayEffect": "準備中に敵の攻撃でHPダメージを受けた時、攻撃者に腕力40%の反撃ダメージ。ラウンド1回。",
    "flavorText": "弦を引き切るまでの時間にも、一本ずつ圧を返す。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "BA2",
    "kind": "passive",
    "displayName": "引き絞り",
    "implementationContract": "自分の準備攻撃は準備時間が1延び、最終ダメージ+50%。",
    "displayEffect": "準備攻撃の準備時間+1、最終ダメージ+50%。",
    "flavorText": "長く引くほど、放つ瞬間の重さは逃げ場を失う。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "BA3",
    "kind": "active",
    "displayName": "大装填",
    "implementationContract": "強装填を置換。準備2の後、最も近い有効な敵へ腕力700%のダメージ。",
    "displayEffect": "準備2の後、敵1体に腕力700%のダメージ。",
    "flavorText": "二度ぶん待ち、二度ぶん弦を張り、城門ごと射抜く。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "BB1",
    "kind": "reactive",
    "displayName": "次弾装填",
    "implementationContract": "自分の準備攻撃の開始時、極限装填以外なら仕込みを最大6段消費し、その攻撃の最終ダメージを1段につき+25%。準備攻撃の解決後は、極限装填を含めRP0で仕込み1を得る。仕込みの共通上限は6。",
    "displayEffect": "準備攻撃後に仕込み1。次の準備攻撃は仕込みを最大6消費し、1段につき最終ダメージ+25%。",
    "flavorText": "撃ち終える前に、次の矢を考える。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "BB2",
    "kind": "reactive",
    "displayName": "速射準備",
    "implementationContract": "自分が準備を開始した時、RP2と仕込み1を消費してその準備値を1進める。ラウンド1回。現在の準備だけに適用し、次の行動を変更しない。",
    "displayEffect": "準備開始時、RP2と仕込み1で今回の準備を1進める。ラウンド1回。",
    "flavorText": "次の矢を使って、今の一矢だけを早める。"
  },
  {
    "weaponId": "heavy_crossbow",
    "position": "BB3",
    "kind": "active",
    "displayName": "極限装填",
    "implementationContract": "大装填を置換。準備3の後、基準対象の敵1体へ腕力1100%のダメージ。仕込みは消費しない。準備攻撃後の次弾装填による仕込み1は通常どおり得る。",
    "displayEffect": "準備3の後、敵1体に腕力1100%のダメージ。仕込みは消費しない。",
    "flavorText": "三度引いた弦が軋む。逃げるなら、今しかない。\nそれでも狙いは外さない。"
  }
].map((spec) => Object.freeze(spec)));

export const WEAPON_SKILL_SPEC_BY_POSITION = Object.freeze(Object.fromEntries(
  WEAPON_SKILL_SPECIFICATIONS.map((spec) => [`${spec.weaponId}:${spec.position}`, spec]),
));
