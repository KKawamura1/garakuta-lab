// ecology/playable-content.mjs — 互換の入口。
//
// **定義は ecology/content/ へ種類別に分かれた**（R7 Milestone 0）。
// ここは既存の import を壊さないための adapter で、新しい定義を足す場所ではない。
// 技能なら content/skills-active.mjs、敵なら content/enemies.mjs を触ること。

export { PLAYABLE_CONTENT, DISPLAY_NAMES, CONTENT_CONTRACT_VERSION } from "./content/index.mjs";

