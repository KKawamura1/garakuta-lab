# A4 audit findings — R6 preflight-first continuation

## Scope and order

The latest main was read at commit 66f4aa647b1d91e73489184b8a41be76863ef0cb. The review was performed against R3/R4/R5/R6, the CONTROL 0.2 implementation, and the previous A4 records before starting the new exact search. No sub-agent was used.

The high-cost search was deliberately held until the independent preflight was executable and green. The preflight is analysis/control02-preflight.mjs; it contains a small naive enumerator, executable fixtures, non-vacuity assertions, Gate F semantic execution, and the seed 1..10 comparison.

## Falsification review of the previous evaluator

The review identified these falsifiable failure modes:

1. Gate E used a universal condition over every replacement option. A reward could be genuinely useful in one exchange while an unrelated or illegal exchange made the entire reward group fail. This was a quantifier defect, not evidence that the reward was useful.
2. The ignore-next-attack policy evaluated a reset/initial-like state instead of the current HP, enemy HP, energy, loadout, disabled timers, bonus, previous part, and remaining turns. That could make a fixed-policy result look better or worse for the wrong state.
3. Gate F recorded expected reference conclusions but did not execute constructed reference inputs through B–E. A declarative list could therefore pass without testing semantic rejection.
4. There was no retained independent enumerator, no positive/negative fixture suite, and no explicit non-vacuity assertion. The prior 1..10000 result was therefore diagnostic only.
5. Gate A checked the presence of trace fields more strongly than their arithmetic relations. A malformed event could satisfy a key-presence check.

## Corrections made after the review

- Gate E now evaluates all outcomes for used, non-used, and unrestricted paths, requires the reward-used path to belong to the overall optimal set, and uses the intended existential condition: each offered reward must have at least one strictly improving usable exchange. Bad exchanges remain visible but do not veto a reward that has a valid witness.
- ignore-next-attack now derives a zero-attack future from the current state and recomputes the decision at every real turn.
- Gate F now constructs five reference scenarios and runs their semantic target gates. Rejection is based on the target condition, not only on whether a scenario is outside the generator's range.
- Gate A independently validates required trace values and arithmetic in addition to the A-calc scope check.
- analysis/control02-preflight.mjs adds A–E positive/negative fixtures, a Gate E bad-exchange non-vacuity fixture, the Gate F execution check, the current-state policy check, and naive-vs-optimized comparisons for seeds 1..10.

No gameplay values, initial parts, enemy tables, reward tables, turn limits, gate thresholds, or historical R3 records were changed.

## Audit verdict

The repaired evaluator passed the preflight and the exact search was then run for seeds 1..10000. It found no Gate E pass and no all-gate pass. This is now a valid non-acceptance result of the repaired evaluator, unlike the previous preflight-free diagnostic. UI, deployment, D1, human testing, and a play URL remain out of scope.

