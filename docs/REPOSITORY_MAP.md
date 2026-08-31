# リポジトリ地図

更新日: 2026-08-31（UTC）

## 現行の入口

| パス | 役割 | 状態 |
|---|---|---|
| /ecology/ | 灰の遠征の本編 UI | 現行 |
| / | /ecology/ へのリダイレクト | 現行 |
| /api/runs | プレイ記録の D1 保存 | 現行 |

## 現行コード

| パス | 内容 |
|---|---|
| ecology/ | Campaign、戦闘エンジン、content、進行、リプレイ、保存 |
| core/build.mjs | 公開版 build 印 |
| functions/api/runs.js | プレイ記録の受け取りと検証 |
| migrations/ | D1 schema |
| wrangler.jsonc | Cloudflare Pages / D1 設定 |
| analysis/check-all.sh | 現行のローカル・CI 検査 |
| analysis/ecology-*.mjs | 契約、画面、決定性、公開送信の検査 |
| analysis/experiments/exp-18/ | EXP-18 の設計・実装履歴 |

frontier/ は EXP-18 R1 の教材・参照実装です。現行本編の実行経路ではありません。

## 仕様の正本

1. 実コードと直接テスト
2. analysis/experiments/exp-18/R8_FIXED_DIFFICULTY_SYNERGY_LADDER.md
3. analysis/CURRENT.md、PROJECT_MEMORY.md
4. R6/R7 などの履歴資料

## 現行でないもの

旧ゲームの独立ルート、旧分析、旧エージェント運用は現行ブランチから整理しました。過去の判断を再現する必要がある場合は Git の履歴を参照し、現在の入口へ戻す変更は PR で理由を明示してください。
