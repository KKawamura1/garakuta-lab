# Corrected traceability — R6

| R6 / R5 requirement | Implementation or evidence | Status |
| --- | --- | --- |
| Latest main and relevant documents reviewed first | Base main commit 66f4aa647b1d91e73489184b8a41be76863ef0cb; R3/R4/R5/R6, workflow, charter, core, and prior A4 records read | complete |
| No sub-agents | Single-agent work log | complete |
| Preserve CONTROL 0.2 rules | core/control02.mjs values and limits retained; no threshold/spec edits | complete |
| Gate A arithmetic | validateTrace() checks event fields and state transitions; scope remains A-calc only | complete; UI/persistent-event agreement not executed |
| Gate B counterfactual witness | predictionWitness() compares attack 0 and attack 7 from a reachable state | implemented and covered by fixtures |
| Gate C best-case reward chooser | Exact per-battle reward/replace enumeration with campaign score defeated, HP, then fewer turns | implemented |
| Gate C fixed policies | All five required policies are simulated, including current-state ignore-next-attack | implemented and compared against naive policy runs |
| Gate D direct witnesses | Max-HP winner, overuse, all-deflect, and take-damage witnesses are retained | implemented and fixture-covered |
| Gate E used/non-used comparison | Used, no-use, and unrestricted outcomes include wins, losses, and timeouts in lexicographic comparison | implemented |
| Gate E quantifier | For every offered reward group, exists at least one strict useful exchange; bad exchanges do not veto a reward | implemented and non-vacuity-tested |
| Gate E semantic details | Reward-used path must be in the overall optimal set; action sequence must change; a reachable same-state exchange witness must exist | implemented |
| Gate F semantic references | Five constructed references execute B–E and report target-gate rejection/completion | preflight pass |
| Positive/negative fixtures | A–E each have positive and one-condition-broken negative fixtures; Gate E has a bad-exchange non-vacuity fixture | preflight pass |
| Independent naive equivalence | Naive enumeration, fixed policies, witnesses, and B–E decisions compare for seeds 1..10 | pass; zero mismatches |
| Benchmark before full search | Seed 1..100 benchmark completed in 17.289 seconds; full run forecast under 30 minutes | complete |
| Exact search | Seeds 1..10000 in ascending order; final checkpoint nextSeed=10001, complete=true | complete |
| Release boundary | No UI, deploy, D1, human test, or URL unless all gates pass | enforced; uiDeploymentAllowed=false |

The evaluator is acceptance-ready from a preflight/integrity perspective. The experiment itself remains non-accepting because no seed satisfied Gate E and therefore no seed satisfied all gates.

