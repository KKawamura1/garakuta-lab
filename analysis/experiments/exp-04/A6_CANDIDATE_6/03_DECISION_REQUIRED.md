# Minimum decision required before EXP-04 can continue

R1/R2 need one explicit choice for Gate D. The smallest safe choices are:

## Option A — fixed policy catalog

Define a finite, pre-registered list of blind policies, including the exact
state fields each policy may read, and test exactly that list. State that
seed-specific hard-coded action sequences are excluded, and define how a
policy may use turn number and past observations.

## Option B — robust hidden-information quantifier

Define a pre-registered set or distribution of possible attack sequences.
Require a policy that does not observe the current attack to win for every
sequence in that set (or define the required probability and sample size).
The set must be fixed before candidate search.

## Option C — remove the blind-policy clause

If the intended claim is only rejection of a small set of named macros, remove
the unnamed “nextAttackを見ない方策” universal clause and list those macros
explicitly.

No option is selected by this candidate because selecting it would change an
R1 acceptance condition. The smallest author/Sol decision is to choose A, B,
or C and update the registration before rerunning candidates.
