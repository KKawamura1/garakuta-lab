# R5 exact-search diagnostic result

Command:

```sh
CHECKPOINT=/tmp/cp-a.json SEED_LIMIT=10000 node analysis/gate-control02.mjs > /tmp/control02-exact-final.json
```

Exit status: `0`.  Final checkpoint: `nextSeed=10001`, `complete=true`.

| metric | count | first seed |
| --- | ---: | ---: |
| Gate B | 127 | 25 |
| Gate C | 5823 | 1 |
| Gate D | 173 | 22 |
| Gate E | 0 | — |
| B ∩ C | 74 | 187 |
| B ∩ D | 16 | 25 |
| C ∩ D | 124 | 22 |
| B ∩ C ∩ D | 14 | 1301 |
| B ∩ C ∩ D ∩ E | 0 | — |
| all gates | 0 | — |

Top candidates by satisfied B--E conditions were seeds `1301`, `1884`, `2119`, `2943`, and `3020`; each had score 3 and failed Gate E.  The serialized final output retains each candidate's optimal campaign/action rows and fixed-policy results: `/tmp/control02-exact-final.json` during execution (not a repository artifact).

This result is diagnostic only, because the R5 fixture and naive-equivalence preflight were not completed.  It does not authorize a play URL or the next phase.
