# Corrected traceability

| R5 / R4 requirement | Implementation / evidence | Status |
| --- | --- | --- |
| Exact 1..10000, same order | `analysis/gate-control02.mjs`, `CHECKPOINT=/tmp/cp-a.json SEED_LIMIT=10000` | completed |
| Memoized state evaluation | battle and suffix maps; cleared after each seed | completed |
| Checkpoints | JSON written every 100 seeds; final `nextSeed:10001, complete:true` | completed |
| Gate A calc scope | `gateA()` asserts required simulation-log fields | completed (A-calc only) |
| Gate B counterfactual witnesses | `predictionWitness()` emits state/action values at attack 0 and 7 | implemented |
| Gate C five policies | `gateC()` stores all five campaign results | implemented |
| Gate D direct witnesses | max HP, overuse, all-deflect, take-damage witnesses stored | implemented |
| Gate E use/non-use lexical comparison | `rewardEvidence()` stores used/no-use/overall outcomes | implemented |
| Gate F semantic reference execution | references are declarative, not injected through B--E | **not satisfied** |
| Positive/negative/non-vacuous fixtures | no executable fixture suite | **not satisfied** |
| Naive-vs-DP seeds 1..10 | no retained naive implementation/comparison | **not satisfied** |

The three unmet R5 preflight requirements make the final search non-acceptance evidence.
