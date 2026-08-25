# Reproduction metadata

- Candidate: `6`
- Repository: `KKawamura1/garakuta-lab`
- Branch: `exp-04/candidate-6`
- `BASE_SHA`: `ad66d21a8b74f80cfa8638ba22a1a3a144ddab80`
- Ending HEAD: the single artifact commit adding this directory; the exact SHA is recorded in the submission PR and is the branch tip.
- Search range: no seed search was started because the R2 stop condition was reached during preflight.
- Seeds tested: none.
- UI/deployment/D1/play URL/human evaluation: none.

## Commands

Executed locally before submission:

```bash
node work/preflight.mjs > work/preflight-output.json
node -e "const x=require('fs').readFileSync('work/preflight-output.json','utf8'); const j=JSON.parse(x); console.log(JSON.stringify({fixedWinning:j.policies.fixedWinningSequence.outcome.win, alternating:j.policies.alternatingSequence.outcome.win, failedBattle:j.policies.alternatingSequence.outcome.failedBattle, contradiction:j.literalGateDImplication.literalUniversalNoNextAttackFailureIsIncompatibleWithThatRequirement},null,2))"
```

Expected summary:

```json
{
  "fixedWinning": true,
  "alternating": false,
  "failedBattle": 1,
  "contradiction": true
}
```
