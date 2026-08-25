# EXP-04 preflight review

## Scope

This review was performed before implementing the core, evaluator, enemy
generator, or seed search. It uses only the BASE_SHA documents and a minimal
standalone fixture.

## Blocking finding: Gate D does not define the policy quantifier

R1 Gate D requires both of the following:

1. no `nextAttack`-blind policy can complete four battles; and
2. an unrestricted optimal policy has a completion path.

R1 does not define the set of policies quantified by “nextAttackを見ない方策”.
It does not say whether such a policy may depend on the seed, turn number,
previous observations, the full fixed action history, or an externally fixed
attack-sequence distribution.

The smallest machine-checkable evidence is in `preflight.mjs` and its output:

- four battles, each with six turns;
- enemy HP 20;
- attack sequence `[2, 0, 0, 2, 0, 0]`;
- player HP 20 carried between battles;
- fixed action sequence `generate, attack, attack, generate, attack, attack`
  completes all four battles;
- alternating `generate, attack, generate, attack, generate, attack` fails;
- neither policy reads `nextAttack`.

The first policy is not a claim that a human would discover that sequence. It
is a literal counterexample to the universal predicate as written. More
generally, if an optimal finite action sequence `s` exists, the policy
`P(t)=s[t]` is a policy that does not inspect `nextAttack` and completes the
same deterministic seed. Thus the two Gate D requirements cannot both be
literal universal statements.

## Competing interpretations and verdict impact

| Interpretation | Blind policy set | Result for the fixture | Effect on Gate D |
| --- | --- | --- | --- |
| Literal universal | all programs whose runtime does not read `nextAttack` | includes the fixed winning sequence | Gate D is impossible whenever an optimal path exists |
| Fixed heuristic catalog | a pre-registered finite list such as alternating, attack-greedy, and defense-priority | depends on the catalog | Gate D can be PASS or FAIL depending on an unspecified list |
| Robust hidden-information test | policies must win for every attack sequence in a pre-registered uncertainty set | may reject the fixed sequence | requires a new uncertainty set and quantifier |
| Seed-independent policy | one policy may not encode the selected seed or future attack sequence | potentially rejects the fixed sequence | requires a formal ban and test method |

These are not equivalent implementations of the same condition. Choosing one
after seeing search results would change the acceptance criterion, which is
forbidden by AGENTS.md and R2.

## Additional non-blocking underspecifications

The following were recorded but not used as the primary stop reason:

| Area | Missing definition | Why it can affect evidence |
| --- | --- | --- |
| Mutation offers | R1 requires two different candidates but does not fix the three offer pairs or their seed generator | Gate E/F depend on which mutation appears at which acquisition |
| Energy lifecycle | HP carry-over is explicit, but energy reset/carry-over and initial energy are not | Gate B/C/F compare different battle start states |
| “Effect” | R1 does not explicitly say whether a kindling multiplier applies to positive output only or also energy cost | legal action availability and optimal sequences can change |
| Optimal sequence | tie-breaking and whether a tie-only sequence change counts are not specified | Gate C can change truth value through arbitrary tie-breaking |
| Gate F quantifier | “continuation path” does not state whether future offers are known to the evaluator or must be robust to unknown offers | a candidate can be accepted or rejected under different information models |
| Multiple kindlings | the one-pending rule does not fully specify selecting a different kindling target while one is pending | edge-case traces in Gate A can differ |

These may be delegated as HOW only after the blocking Gate D policy class is
fixed and the resulting decisions are recorded before search.

## Stop decision

Under R2 section 4, this is a concrete ambiguity that changes the gate result.
The candidate therefore stops before expensive exploration. It does not
claim a gate PASS, a gate FAIL, or that no numerical candidate could exist.
