// Cheap preflight only. It intentionally does not implement the full game.
// It demonstrates why the R1 text is not yet a single deterministic semantics.

const round = (n) => Math.floor(n + 0.5);

const recoilThenChainfire = round(round(5 * 2) * 1.5);
const chainfireThenRecoil = round(round(5 * 1.5) * 2);

const evidence = {
  mutationOrder: {
    input: '発電=継ぎ火, 攻撃=反動, 手動列=発電→攻撃',
    baseAttackEffect: 5,
    applyTargetMutationFirst: recoilThenChainfire,
    applyChainfireFirst: chainfireThenRecoil,
    differs: recoilThenChainfire !== chainfireThenRecoil,
  },
  battleBoundary: {
    input: '戦闘1の最終ターンに反動付き攻撃を使用',
    resetAtBoundary: '戦闘2の第1ターンに攻撃は合法',
    carryAtBoundary: '戦闘2の第1ターンに攻撃は非合法',
    differs: true,
  },
  gateC: {
    input: '取得前後に複数の勝利行動列がある',
    representativeTieBreak: '代表列の選択規則でPASS/FAILが変わり得る',
    setComparison: '勝利列集合の差分なら別の判定になる',
    differs: true,
  },
};

if (!evidence.mutationOrder.differs || !evidence.battleBoundary.differs || !evidence.gateC.differs) {
  throw new Error('preflight evidence unexpectedly collapsed');
}

console.log(JSON.stringify(evidence, null, 2));
