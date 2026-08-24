# R6 exact-search result

## Commands and runtime

The benchmark was run after the preflight:

    time env SEED_LIMIT=100 node analysis/gate-control02.mjs > /tmp/r6-benchmark-100.json

It exited 0 in 17.289 seconds. The observed benchmark counts were B=1, C=0, D=4, E=0, BC=0, BD=1, CD=0, BCD=0, BCDE=0, all=0. The full 1..10000 run was forecast below R5's 120-minute ceiling.

The exact run was:

    time env SEED_LIMIT=10000 CHECKPOINT=/tmp/r6-control02-checkpoint.json node analysis/gate-control02.mjs > /tmp/r6-control02-exact-final.json

It exited 0 after 16 minutes 52.151 seconds. The checkpoint ended with nextSeed=10001, complete=true. overallPass=false and uiDeploymentAllowed=false.

## Counts

| metric | count | first seed |
| --- | ---: | ---: |
| Gate B | 127 | 25 |
| Gate C | 58 | 187 |
| Gate D | 173 | 22 |
| Gate E | 0 | — |
| B ∩ C | 56 | 187 |
| B ∩ D | 16 | 25 |
| C ∩ D | 13 | 1301 |
| B ∩ C ∩ D | 13 | 1301 |
| B ∩ C ∩ D ∩ E | 0 | — |
| all gates | 0 | — |

The first combined candidates were D=22, B=25, B∩D=25, C=187, B∩C=187, C∩D=1301, and B∩C∩D=1301. Gate E had no passing seed.

## Top candidates and the Gate E reason

The five highest B/C/D candidates all had B=true, C=true, D=true, and E=false. Each row below lists the number of useful strict exchanges for each reward group in encounter order. A reward group passes only when that number is at least one.

| seed | optimal campaign (defeated, HP, turns) | encounter reward groups: reward → useful exchanges | E summary |
| ---: | --- | --- | --- |
| 1301 | (3, 4, 13) | collapse→2, capacitor→1; capacitor→1, follow→0 | valid=false, changed=true, exchange=true |
| 1884 | (3, 3, 16) | capacitor→1, collapse→2; capacitor→0, follow→0 | valid=false, changed=true, exchange=true |
| 2119 | (3, 2, 17) | capacitor→1, collapse→2; capacitor→1, follow→0 | valid=false, changed=true, exchange=true |
| 2943 | (3, 1, 17) | collapse→2, follow→0; follow→0, capacitor→1 | valid=false, changed=true, exchange=true |
| 3020 | (3, 2, 16) | follow→0, collapse→2; capacitor→1, follow→0 | valid=false, changed=true, exchange=true |

Therefore the repaired existential quantifier is doing the intended work: the good reward groups have witnesses, but a candidate still fails when even one offered reward has no useful exchange. The failure is not caused by requiring every exchange to be good, and it is not caused by the action-change or exchange-witness predicates.

The complete optimal action rows and fixed-policy outcomes for these candidates are retained in 8_TOP_CANDIDATES.json. No user-facing play URL or release action was taken.

