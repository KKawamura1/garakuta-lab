# Test evidence

Executed:

```sh
node --check analysis/gate-control02.mjs
```

Result: exit `0`.

Also executed:

```sh
node -e 'const x=require("/tmp/control02-exact-final.json"); if(x.limit!==10000||!x.gateA.pass||x.counts.all!==0||x.counts.E!==0||x.top.length!==5) process.exit(1); console.log("result-schema-ok")'
```

Result: `result-schema-ok`, exit `0`.

The full seed command in `4_SEED_RESULTS.md` also completed with exit `0`; its per-seed evaluation exercised Gate A--E and wrote checkpoints.

Not executed (mandatory R5 preflight): executable positive/negative fixtures, non-vacuity assertions, a retained naive enumerator, and DP-vs-naive seed 1..10 comparison.  Therefore this file deliberately does not label the gate suite as passed.
