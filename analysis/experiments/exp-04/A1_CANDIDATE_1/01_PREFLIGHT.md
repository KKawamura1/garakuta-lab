# EXP-04 Candidate 1 — preflight / falsification review

## Result

No R1-level contradiction was found. The core and search were implemented only after the following boundary decisions and negative checks were fixed.

## Semantics checked before search

| Check | Finding | Treatment |
| --- | --- | --- |
| Does any trait map to one action regardless of context? | It could have; a numerical pass alone would not disprove it. | Gate E is evaluated from all viable offer contexts, and requires two or more useful target actions for each trait. |
| Can a trait be a permanent numeric multiplier with no order change? | Yes. An easy run with 5-HP enemies keeps `generate > attack` optimal after every offered attachment. | This is the Gate C negative fixture; it must fail. Gate C accepts only an action sequence absent from the pre-graft optimal set. |
| Are echo, recoil, and tinder ordered at a start-of-turn boundary? | Yes after explicitly defining the state fields: delayed echo, one-turn disabled action, and one pending tinder source. | Tested across all 9 placements and timing fixtures. |
| Does a reward that wins the next battle still conceal a later forced loss? | Yes. | The Gate F negative fixture has an easy next fight and an impossible later 60-HP fight; it must fail. |
| Can a fixed combat routine pass by receiving omniscient reward placements? | Potentially. | Gate D gives each fixed combat routine every legal mutation/target branch. It still must fail; this is stronger than testing one arbitrary attachment policy. |
| Is the search accidentally proving only a selected numerical outcome? | Potentially. | Candidate range, generator, criterion, order, and early-stop rule are in source before the command is run. Seed 3 is accepted only after all B–F checks. |

## Definitions fixed for this computation

These choices follow the R1 wording and are made explicit so a reviewer can reproduce every result.

1. **Only HP crosses battle boundaries.** Each next battle starts at energy 0 with no delayed echo, recoil lock, or tinder pending. R1 explicitly says that HP carries between battles and lists no other carrying state.
2. **A manual action resolves all multipliers before rounding once.** Recoil and a pending tinder multiply its base effect; the resulting non-negative value is rounded half-up. An echo then stores half of that resolved, rounded manual effect, rounded half-up again. Thus a defense made 11 by tinder produces an echo guard of 6. This follows “effect's 50%”, “after multipliers round”, and “schedule an echo originating from the manual action.”
3. **A six-turn cap permits six turn starts only.** An echo created by the sixth manual action has no seventh turn on which to resolve.
4. **Trait types may recur on different actions.** R1 restricts a *single action* to one mutation but does not say a mutation type may be installed only once. The offer itself always contains two distinct types. This is necessary to evaluate the stated “each trait across multiple contexts” condition without adding an unstated uniqueness rule.
5. **The same connected run must satisfy B, C, and F at all three offers.** At each actual offer state on that spine, both shown trait types receive independent B and F witnesses; the selected spine choice is also a Gate C witness that can still clear all four battles. Gate E is then evaluated over every viable reachable offer state, not merely the spine.

These are not post-search numerical adjustments. Their behavior is covered by fixtures and the independent oracle.

## Fixed Gate-D procedures

The labels in R1 are made executable as follows. Reward choice and target placement are exhaustively favorable to the routine; only the combat action rule is fixed.

| R1 policy | Executable policy |
| --- | --- |
| 発電後に攻撃だけ | `charge-then-attack`: generate below 1 energy, otherwise attack. |
| 発電と攻撃の交互 | `strict-generate-attack`: generate on odd manual turns, attack on even turns. |
| 防御優先 | defend whenever the displayed attack is positive and defense is legal; otherwise charge/attack. |
| 合法最大ダメージ優先 | attack whenever legal; otherwise generate. |
| nextAttackを見ない | fixed `generate, defend, attack` cycle, with only a legality fallback; it never reads the displayed attack. |

All five have a deterministic legality fallback for a recoil-disabled action. This prevents a routine from failing merely because its requested action is temporarily illegal.

## No-stop decision

The listed choices are ordinary missing implementation details with a direct textual reading, rather than mutually exclusive readings of the success thresholds. The evaluator records them and does not alter R1’s game meaning, Gate thresholds, or pass/fail words. No high-cost search was started until the negative cases above had executable checks.
