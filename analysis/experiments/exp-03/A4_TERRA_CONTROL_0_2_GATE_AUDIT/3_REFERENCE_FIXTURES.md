# Reference fixtures

No positive/negative fixture suite was added in this continuation.  This is an explicit R5 nonconformance, not a vacuous pass.

The current evaluator contains five named reference descriptions in `gateF()` (`all-zero`, `all-one`, `attack-only`, `defend-safe`, `reward-irrelevant`), but they are not constructed game inputs and do not run through the semantic B--E gate implementations.  They must not be treated as fixtures or as proof that Gate F has passed.

Required next work before an acceptance rerun:

- create a positive fixture and a one-condition-broken negative fixture for every semantic condition;
- assert that every negative fixture fails its intended condition;
- assert witness presence so no evidence-free condition can pass;
- retain a small naive enumerator and compare all comparable state values, witnesses, policies, and B--E decisions against cached evaluation for seeds 1..10.
