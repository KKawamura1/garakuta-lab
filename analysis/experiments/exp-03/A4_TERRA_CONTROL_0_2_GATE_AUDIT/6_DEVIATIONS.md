# Deviations and stop condition

R5 prohibits substituting a full search for the required preflight.  Although the completed search used the requested range and order, it was started before all required fixtures and naive-vs-DP equivalence tests existed.

The exact defects are:

1. `gateF()` is a declarative list of expected failures, not semantic execution of each bad reference through B--E.
2. No positive/negative, one-condition-broken fixture suite exists.
3. No small independent naive enumerator remains, so seeds 1..10 cannot prove cached-state equivalence.

Impact: the 1..10000 numbers are useful diagnostic observations but cannot be accepted as the repaired-gate evaluation called for by R5.  No threshold, gameplay value, reward rule, initial loadout, turn limit, historical R3 record, or prior result ticket was changed to obtain them.

Stop: do not proceed to UI, deployment, D1, or author testing.  Sol should decide whether to authorize the missing R5 preflight implementation followed by a fresh acceptance search.
