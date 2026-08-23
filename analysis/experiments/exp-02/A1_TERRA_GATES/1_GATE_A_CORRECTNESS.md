# EXP-02 / A01 Gate A: 正しさ

> 対応要求: `EXP-02-R01-A`

ゲーム規則・問題表・人間向け画面は変更していない。

## Gate A: 正しさ

| 問題 | 表の最良一致 | 目標到達 | 足し算では未到達 | 空間≥400 | 手持ちから解を作れる | 判定 |
|---:|---|---|---|---|---|---|
| 1 単調＋消耗 | OK | OK | OK | OK | OK | PASS |
| 2 倍速＋継電 | OK | OK | OK | OK | OK | PASS |
| 3 単調＋共鳴 | OK | OK | OK | OK | OK | PASS |
| 4 過負荷＋単調 | OK | OK | OK | OK | OK | PASS |
| 5 減衰＋倍速 | OK | OK | OK | OK | OK | PASS |
| 6 単調＋継電 | OK | OK | OK | OK | OK | PASS |
| 7 倍速＋過負荷 | OK | OK | OK | OK | OK | PASS |

ブラウザ実測: FAIL（browser executable not found: /root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome）


## 実行環境補足

- `node analysis/smoke-puzzle.mjs`: OK。
- 既存 `analysis/browser-puzzle.mjs` は、ハードコードされた `/opt/node22/lib/node_modules/playwright/index.mjs` がこの環境に無く、画面検査開始前に停止した。
- 新しいGate Aブラウザ検査も、Playwrightのブラウザ実体 `/root/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome` が無く、画面検査を未実行扱いにした。
- したがって、ブラウザ未実行を合格扱いせず、Gate Dの選定数を0とした。
