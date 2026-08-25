# EXP-04 Candidate 3 — computation-gate result

- BASE_SHA: `ad66d21a8b74f80cfa8638ba22a1a3a144ddab80`
- Branch: `exp-04/candidate-3`
- Scope: computation core, fixtures, exhaustive bounded search only. No UI, deployment, D1, play URL, or human evaluation was performed.
- Command: `node analysis/experiments/exp-04/A3_CANDIDATE_3/graft-evaluator.mjs`
- Result: **PASS A–F** for the first candidate in the pre-fixed finite grid (runtime 1.8 s in the recorded run).

## Traceability

| R1 requirement | Evidence |
|---|---|
| Three base actions; mutation effects and ordering | `step`, `testSemantics` |
| A: all 9 attachments, rounding, timing, cooldown, non-chaining | direct semantic fixtures in `testSemantics`; attachment is represented uniformly by `mutations[action]` |
| B–F | `gateB` through `gateF`; result emitted by the command |
| Fixed-procedure rejection | `policyRun` plus five named policies in `policies` |
| Independent check | `oracle` is a direct replay without memoization/search; it is compared with the memoized solver |
| Reproducibility | this file contains the fixed search generator, solver, fixtures, and reporting command |

## Formalization decisions

- Energy starts at zero each battle and does not carry: R1 explicitly makes only HP carry between battles.
- A legal attack/defense requires at least one energy. Generator is always legal.
- “Optimal” means a winning policy maximizing remaining HP, then minimizing manual actions.
- For B/C/E, an attachment is useful when a winning next-battle strategy uses that newly mutated action. B and C compare the specified next battle with the same zero-mutation baseline; E ranges over the four battle contexts.
- F enumerates mutation/attachment continuations with one mutation per action. It accepts a choice only when a four-battle completion exists.

## Preflight / falsification review

1. Backlash cannot be a permanent ban: fixture verifies it blocks exactly the following manual turn.
2. Echo must occur before selection and must not create another echo, backlash, or chainfire: fixture checks a rounded attack echo at next-turn start.
3. Chainfire must be consumed only by a different manual action: fixture checks the 150% rounded follow-up.
4. Gates are not tautologies: the search prints counts of candidates satisfying B/C/E/F; a weak-reference construction fails D because defend-first finishes it.
5. The search uses a bounded fixed grid before results: player HP 18..50 by 2; two attack values 4..12 by 2; enemy HP fixed at 8/9/10/10; four six-turn attack rows are deterministic alternations. It returns the lexicographically first all-gate candidate.

## Witness and residual risk

Witness: HP 26; enemy HP 8,9,10,10; every listed enemy attack is 4; offers are [B,E], [B,C], [E,C]. The emitted result reports all gates PASS.

Residual risk: “useful” and “optimal” are operational definitions required for finite checking. The evaluator deliberately records them rather than claiming they are a human-interest measure. The fixed policy definitions also need review before using this seed for UI work.

Stopped after the computational gate as R1/R2 require.