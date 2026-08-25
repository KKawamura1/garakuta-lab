# EXP-04 Candidate 1 — requirements trace

| Source requirement | Implementation / evidence |
| --- | --- |
| R1: independent three-action GRAFT core; no existing RELAY/CONTROL mechanism | `graft-core.mjs` is a UI-free, self-contained state machine. |
| R1: three base actions, three traits, one trait per action, irreversible graft | `ACTIONS`, `MUTATIONS`, `attachMutation`, and `unmutatedActions` in `graft-core.mjs`. |
| R1: start-of-turn echo, start-kill, manual choice, enemy attack, recoil lock, then schedule echo | `step()` implements that order; the 9 attachment fixtures exercise it. |
| R1 Gate A: all 9 trait/action combinations, rounding, timing, lock, non-chain, deterministic result | `graft-fixtures.mjs`; `graft-oracle.mjs` independently replays the 9 cases. |
| R1 Gate B: each offered trait has a legal placement that wins next battle and uses the grafted action | `GraftSolver.checkOffer()` records `bWitnesses` for every offer on one connected run spine. |
| R1 Gate C: at least one offered trait changes next battle's optimal action sequence, rather than only its number | `checkOffer()` compares complete sets of optimum sequences and rejects a sequence that was already optimal before grafting. The numeric-only negative fixture must fail. |
| R1 Gate D: listed fixed procedures cannot clear, while unrestricted play can | `policyCanClear()` gives every fixed procedure all reward-placement choices; all five still fail for the selected run. A certified unrestricted spine clears. |
| R1 Gate E: useful graft targets vary by context for every trait | `gateE()` enumerates viable offer contexts and requires at least two base actions per trait. |
| R1 Gate F: each side of each actual offer has a clearable continuation | `checkOffer()` records `fWitnesses`; a separate hidden-future trap fixture fails. |
| R1: known bad reference and one failure of every Gate before main search | `graft-fixtures.mjs` includes an explicit negative fixture for A through F. |
| R1: candidate generation and pass condition fixed before search; preserve minimum witness | `generateSeed()` and `findFirstPassingSeed()` in `graft-evaluator.mjs`; `graft-search.mjs` records ascending domain, stopping rule, aggregate, and seed 3 certificate in `search-result.json`. |
| R1: cross-check optimized search with a small independent enumeration/oracle | `graft-oracle.mjs` is separate from the production transition function and is compared in fixtures. Battle enumeration itself is direct, unpruned DFS over legal manual actions. |
| R2: trace, preflight, formal semantics, fixtures, evaluator, oracle, command, reproducible result, risks | This directory contains `00_` through `03_`, all source files, and `search-result.json`. |
| R2/R1 prohibitions: UI, deployment, D1, play URL, human test, other-candidate intake | Not performed. This directory contains calculation artifacts only. |

## Reproduction

```bash
node graft-fixtures.mjs
node graft-search.mjs --first 0 --last 999 --output search-result.json
```

The second command enumerates in ascending order and stops at its first full pass. Therefore its first pass is the minimum seed in the declared domain.
