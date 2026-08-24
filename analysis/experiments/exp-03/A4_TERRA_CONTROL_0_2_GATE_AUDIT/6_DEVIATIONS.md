# Deviations and stop condition — R6

## Experiment deviations

There were no changes to the CONTROL 0.2 game specification, gameplay values, initial loadout, enemy or reward tables, turn limit, gate thresholds, seed range, seed order, or historical R3 records.

The only semantic implementation changes were those required by the R6 review:

1. Replace Gate E's accidental universal exchange requirement with the specified existential useful-exchange requirement per reward.
2. Make ignore-next-attack state-aware and recomputed at each real turn.
3. Execute Gate F references through the actual semantic gates.
4. Strengthen Gate A with arithmetic trace validation.
5. Add an independent preflight script and bounded per-seed cache cleanup.

These changes affect evaluator correctness and evidence quality, not the game rules.

## Search result and stop

The preflight passed, but the repaired exact search found no Gate E pass in seeds 1..10000. The five best B/C/D candidates all fail because at least one offered reward has zero useful strict exchanges; their changed and exchange conditions are true. This is a valid non-acceptance result, not a reason to weaken the quantifier again.

Stop before UI, deployment, D1, human testing, and a play URL. CONTROL 0.2 should not advance from this checkpoint without a separate Sol decision.

## Repository operation

The latest-main base was 66f4aa647b1d91e73489184b8a41be76863ef0cb. The changes are held on codex/r6-gate-e-quantifier-fix because direct substantial writes to the default main ref were blocked by the repository safety policy. The implementation commits are:

- dbf2f24a82100ac8ddf6e58859d04172f9fdefed — corrected Gate A–F evaluator
- 97cc20ff7ef93790833bec494d7649b03551b1c6 — independent preflight and naive equivalence

This branch status is operational only; it is not an experiment-spec deviation.

