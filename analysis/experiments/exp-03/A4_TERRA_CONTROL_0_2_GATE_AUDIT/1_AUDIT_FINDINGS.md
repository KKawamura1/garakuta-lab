# A4 audit findings — R5 continuation

R5 requested an exact CONTROL 0.2 search, without changing game values, gate thresholds, or the seed range/order.  The evaluator now uses cached battle enumeration and suffix evaluation, releases per-seed caches, and checkpoints every 100 seeds.

The complete 1..10000 run finished.  It found no Gate E pass and therefore no all-gate pass.  UI, deployment, D1, and human-play URL work were not performed.

Important audit limitation: this continuation did **not** yet satisfy R5's mandatory preflight.  The executable has no independent naive enumerator equivalence comparison for seeds 1..10, and `gateF()` currently records reference conclusions instead of injecting constructed reference inputs through B--E.  The run is consequently preserved as diagnostic evidence, not as a release/acceptance result.  `6_DEVIATIONS.md` records the stop condition.

Gate A remains `A-calc` only: calculation/event log fields were checked, but the UI and persistent-event three-way agreement was not executed.
