# EXP-04 Candidate 6 — preflight stop

Status: **STOP / NOT DETERMINABLE**

This candidate stopped before the expensive implementation and seed search, as
allowed by R2 section 4. The stop is caused by a quantifier missing from R1
Gate D, not by a failed search.

The exact reproducible diagnostic is `preflight.mjs`:

```bash
node analysis/experiments/exp-04/A6_CANDIDATE_6/preflight.mjs > preflight-output.json
```

The fixture has four battles and six turns per battle. It contains two
policies that never read `nextAttack`: one completes and one fails. The
completing policy emits a fixed winning action sequence by turn index. For
any finite winning path, the same construction is possible. Consequently,
the literal universal reading of Gate D would contradict its requirement that
an unrestricted optimal policy has a completion path.

The R1/R2 requirements, the competing interpretations, the changed verdict,
and the smallest required decision are recorded in the companion documents.
Gates A–F were not reported as PASS or FAIL because the stop occurs before a
valid Gate D predicate exists.

No UI, deployment, D1 operation, play URL, or human evaluation was performed.
