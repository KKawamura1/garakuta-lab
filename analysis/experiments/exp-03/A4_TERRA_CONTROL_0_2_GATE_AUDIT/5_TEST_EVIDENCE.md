# Test evidence — R6

All checks below were run on the repaired branch after the preflight-first review.

## Syntax and preflight

    node --check analysis/gate-control02.mjs
    node --check analysis/control02-preflight.mjs
    node analysis/control02-preflight.mjs

The two syntax checks exited 0. The executable preflight exited 0 and reported:

    fixtures: A/B/C/D/E positive and negative = true
    Gate E badExchangeDoesNotVacuouslyFail = true
    Gate F positive = true
    ignoreNextAttack positive = true
    naive-vs-optimized passed = true
    seeds compared = 10
    mismatches = []
    policyMismatches = []

## Search and result checks

    time env SEED_LIMIT=100 node analysis/gate-control02.mjs > /tmp/r6-benchmark-100.json
    time env SEED_LIMIT=10000 CHECKPOINT=/tmp/r6-control02-checkpoint.json node analysis/gate-control02.mjs > /tmp/r6-control02-exact-final.json

Both search commands exited 0. The benchmark took 17.289 seconds; the exact run took 16 minutes 52.151 seconds and completed the checkpoint.

A result-schema assertion also verified the final limit, preflight Gate A/F status, counts.all=0, counts.E=0, and five retained top candidates. It exited 0.

No UI/E2E, persistent-event three-way agreement, deployment, D1, human play, or URL check was run. These are explicitly downstream of an all-gate pass and remain prohibited by the current result.

