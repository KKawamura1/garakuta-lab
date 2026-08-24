# Sol handoff — A4 R6 completion

## Decision record

The R6 A4 continuation is complete on codex/r6-gate-e-quantifier-fix.

- Preflight integrity: passed.
- Gate F: passed with executable semantic references.
- Naive-vs-optimized comparison: passed for seeds 1..10 with zero mismatches.
- Exact search: seeds 1..10000 completed in ascending order.
- Gate E: 0 passing seeds.
- All gates: 0 passing seeds.
- UI/deployment/D1/human-test boundary: held; no URL created.

The result is therefore a repaired-evaluator non-acceptance of CONTROL 0.2. The previous preflight-free 1..10000 run remains historical diagnostic context; it is superseded for decision-making by this R6 run.

## Why the best candidates still fail E

Seeds 1301, 1884, 2119, 2943, and 3020 all pass B/C/D. They also show changed=true and exchange=true for Gate E. Each fails valid=true because one of the offered rewards has no strict useful exchange. The per-reward useful-exchange counts are recorded in 4_SEED_RESULTS.md and the full action/policy evidence in 8_TOP_CANDIDATES.json.

## Handoff boundary

Do not publish a play URL or begin UI, deployment, D1, or human testing from this result. Sol's next decision is whether to stop CONTROL 0.2 at this non-acceptance checkpoint or authorize a separately specified experiment revision. No threshold or game value should be changed merely to obtain a pass.

