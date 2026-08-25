# EXP-04 Candidate 1 — formal computation semantics

## Persistent state and battle state

- Persistent: `hp`, plus `{ generate, attack, defend } -> mutation | null`.
- Battle-local: `enemyHp`, `energy`, `turn` (0–5), `disabled`, `pendingTinder`, and one pending `echo`.
- A battle starts with energy 0 and all local fields empty. A win carries only the resulting HP into the next battle.

## Manual action resolution

For a legal action (a), let its base effect be (b(a) = 2, 5, 7) for generate, attack, defend respectively. If the action has recoil and/or it consumes a pending tinder, its resolved manual amount is:

\[
\operatorname{round}\left(b(a) \times (2\ \text{if recoil else}\ 1) \times (1.5\ \text{if tinder else}\ 1)\right).
\]

Attack and defense spend one energy. Defense guards against that turn's displayed attack only. A recoil action disables itself for the next manual turn. A tinder action leaves itself pending; a different later manual action consumes that one pending tinder, receives the 1.5 multiplier, and may then create its own pending tinder. An echo action stores `round(resolvedAmount × 0.5)` for the next turn start.

At the next turn start, echo applies once as energy, damage, or guard. Echo damage may win before a manual action. Echo never causes another echo, recoil lock, or tinder trigger.

## Enumeration and objectives

Battle enumeration is a direct DFS over every legal manual action sequence of at most six turns. No score-based pruning is used. A battle optimum is ordered by:

1. win over loss;
2. higher remaining HP;
3. fewer manual actions;
4. higher remaining energy.

Gate C compares **the full set** of sequences tied for that objective. A post-graft sequence is a C witness only if it was not optimal before grafting; a mere larger score on the identical action sequence is rejected.

`canCompleteBeforeFight` recursively enumerates winning battle outcomes, then every shown mutation and every legal unmutated action target. Its only terminal success is a win after fight four.

## Gate quantifiers

| Gate | Candidate-1 executable condition |
| --- | --- |
| A | Fixtures verify exact behavior for all 3 × 3 placements, deterministic replay, timing, rounding, lock, and non-chain. |
| B | At each offer on one connected certified spine, both offered traits have at least one unmutated target with a winning next-battle sequence that contains that target action. |
| C | At each offer on the same spine, at least one attachable shown trait yields a post-graft next-battle optimum absent from the pre-graft optimum set, and that attachment can still clear the run. |
| D | Every listed fixed combat policy fails even after existentially favorable reward placements; an unrestricted certified spine clears. |
| E | Across all reachable offer boundaries that have a full completion, each trait has useful full-run placements on at least two different base actions. |
| F | At each spine offer, each offered trait has some legal target with a full four-fight continuation. |

## Candidate generator

`generateSeed(seed)` uses a deterministic Mulberry32-style PRNG. Before search, it fixes:

- domain: seeds 0 through 999, ascending;
- initial HP: one of 34, 36, 38, 40, 42;
- fight 1 enemy HP: 13–15; fights 2–4: 12–18;
- six displayed attacks per fight: 0–8, with one per fight raised to at least 7;
- offers: the three distinct pairs `[recoil, echo]`, `[recoil, tinder]`, `[echo, tinder]`, exactly once each in seeded order.

The first battle's HP restriction is structural: without a mutation and starting at zero energy, at most three normal attacks fit into six manual turns. This is a fixed generator bound, not a value fitted after observing a passing seed.
