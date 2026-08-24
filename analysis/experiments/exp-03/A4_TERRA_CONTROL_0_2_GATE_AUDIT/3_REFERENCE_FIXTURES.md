# Reference fixtures — R6 preflight

The executable preflight command was:

    node analysis/control02-preflight.mjs

It exited 0. The fixture summary was:

| check | result |
| --- | --- |
| Gate A positive / negative | true / true |
| Gate B positive / negative | true / true |
| Gate C positive / negative | true / true |
| Gate D positive / negative | true / true |
| Gate E positive / negative | true / true |
| Gate E bad-exchange does not vacuously fail | true |
| Gate F semantic reference execution | true |
| Current-state ignore-next-attack check | true; expected and actual action generator |
| Naive-vs-optimized equivalence | true; 10 seeds, no mismatches |

## Gate F references

Gate F builds each reference, runs its semantic target through the real gate functions, and records whether the reference was correctly rejected. The five references all correctly reject; this is what makes Gate F pass. The last reference is intentionally generator-valid, so the result is not a range-only rejection.

| reference | target | semantic result | input-range note |
| --- | --- | --- | --- |
| all-zero | D | rejected; B/C/D/E all false | attack shape invalid |
| all-one | D | rejected; B/C/D/E all false | attack shape invalid |
| attack-only | C | rejected; B/C/D/E all false | attack shape invalid |
| defend-safe | D | rejected; B/C/D/E all false | attack shape invalid |
| reward-irrelevant | E | rejected; B/C/D/E all false | attack shape valid |

The reference runner records the semantic result and completion flag rather than accepting a reference merely because its input falls outside normal generation. The fixture suite also asserts witness presence and intended-condition failure, preventing evidence-free or vacuous passes.

