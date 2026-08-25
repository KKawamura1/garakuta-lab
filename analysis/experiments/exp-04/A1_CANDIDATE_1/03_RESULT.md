# EXP-04 Candidate 1 — calculation-gate result

## Status

**PASS — computational gate only.** No UI, deployment, D1 operation, play URL, or human evaluation was performed.

- Start commit: `ad66d21a8b74f80cfa8638ba22a1a3a144ddab80`
- Execution command:

  ```bash
  node graft-fixtures.mjs
  node graft-search.mjs --first 0 --last 999 --output search-result.json
  ```

- Search domain: seeds 0–999 in ascending order; stop at the first all-gate pass.
- Evaluated before first pass: 4 seeds (0–3).
- Minimum passing seed in that declared domain: **3**.
- Search elapsed time: recorded in `search-result.json` (machine-dependent).

The delivery commit and PR head are recorded in the PR metadata after the immutable artifact tree is committed. All computed source, inputs, and machine-readable output are in this directory.

## Gate outcomes for seed 3

| Gate | Result | Main evidence |
| --- | --- | --- |
| A | PASS | Nine attachment fixtures, deterministic double replay, and independent oracle comparison. |
| B | PASS | Every offered trait at every spine offer has a winning next-battle witness using the target action. |
| C | PASS | Every spine offer has a shown trait whose post-graft optimal sequence was not pre-graft optimal. |
| D | PASS | All five fixed combat procedures fail even with exhaustive favorable mutation placement; unrestricted spine clears. |
| E | PASS | Recoil: attack/generate/defend; echo: generate/defend/attack; tinder: generate/defend appear as useful full-run targets across viable contexts. |
| F | PASS | Both sides of all three spine offers have at least one full-run continuation. |

The selected run has initial HP 40. Its enemies are HP 13, 17, 17, 14; offer pairs are `[recoil,tinder]`, `[recoil,echo]`, `[echo,tinder]`. Full attack sequences, B/C/F witnesses, E context witnesses, and fixed-policy values are recorded in `search-result.json`.

## Main certificate spine

1. Fight 1: `generate, generate, attack, attack, attack` → HP 23; choose recoil on attack.
2. Fight 2: `generate, generate, defend, attack, defend, attack` → HP 14; choose recoil on generate.
3. Fight 3: `generate, attack, defend, attack` → HP 5; choose tinder on defend.
4. Fight 4: `generate, attack, defend, attack` → victory at HP 1.

At each of the three offers, the unselected displayed mutation also has its own B and F witness. The certificate is therefore not treating the selected spine as the only legal reward continuation.

## Negative and independent checks

`graft-fixtures.mjs` passes only after all of the following are rejected:

- wrong echo rounding (Gate A);
- an offer whose shown traits cannot win the next battle (Gate B);
- a numeric-only upgrade that preserves `generate > attack` (Gate C);
- a run cleared by a charge/attack routine (Gate D);
- a forced one-target placement map for every trait (Gate E);
- an easy immediate battle followed by an unavoidable later dead end (Gate F).

The independent oracle does not import the production `step()` function and is compared with it over all nine trait/action placements.

## Residual risks / explicit limit

- This proves only the declared finite seed domain and these formal policies; it is not a claim that the run is enjoyable or that all conceivable fixed policies fail.
- Gate C's “optimal” objective and the explicit timing choices are documented in `02_SEMANTICS.md`; they should be retained for any later UI implementation so the computation and visible game do not drift.
- Trait-type recurrence is an explicit interpretation of R1, not an additional rule. A later decision to limit a trait type to one action would require a fresh gate run.
- Per R1/R2, this result stops here and awaits separate review before any next-stage work.
