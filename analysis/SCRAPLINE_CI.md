# SCRAPLINE CI notes

The full check set remains unchanged: all syntax checks, all smoke scripts, the 256-seed regression, and the complete 64,471 ordered-train balance space still run on a cache miss.

The heavy SCRAPLINE regressions are split across worker threads, independent checks run concurrently, and successful results are cached by the source-code hash. A cache hit reuses the result for the exact same checked source. The branch-level concurrency group cancels superseded duplicate push/pull-request runs.
