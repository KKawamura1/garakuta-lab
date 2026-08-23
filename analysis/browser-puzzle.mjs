// 「破れ」を通しで確かめる。**解けることを、機械で解いて確かめる。**
//
// 出題は「足し算では届かない」ように作ってあるので、適当に触っても越えない。
// 表に入っている検証用の最良解を画面で組み立てて、**本当に目標を越えるか**を見る。
// （学び#59：起きない条件を検査で済ませるのは、確かめていないのと同じ。）
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { spawn, execSync } from "node:child_process";
import { PUZZLES } from "../core/puzzle-table.mjs";
import { PARTS } from "../core/laws.mjs";

{
  const local = execSync("git rev-parse HEAD").toString().trim();
  const remote = execSync("git rev-parse origin/claude/repository-inventory-yvut4e").toString().trim();
  if (local !== remote) console.warn("  （注意：手元と origin が違う）");
}

const PORT = 8961;
const server = spawn("python3", ["-m", "http.server", String(PORT)], { stdio: "ignore", detached: true });
const stop = () => { try { process.kill(-server.pid); } catch (_) {} };
await new Promise(r => setTimeout(r, 900));
let bad = 0;
try {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on("pageerror", e => errs.push(String(e)));
  p.on("console", m => { if (m.type() === "error") errs.push(m.text()); });
  p.on("response", r => { if (r.status() >= 400) errs.push(`${r.status()} ${r.url()}`); });
  p.on("dialog", d => d.accept());
  await p.goto(`http://localhost:${PORT}/puzzle/`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);

  for (let i = 0; i < PUZZLES.length; i += 1) {
    const q = PUZZLES[i];
    // 検証用の最良解を、手持ちから順に置く。
    for (let sIdx = 0; sIdx < q.answer.length; sIdx += 1) {
      const name = PARTS[q.answer[sIdx]].name;
      const btn = p.locator(".pool button").filter({ hasText: name })
        .filter({ hasNot: p.locator(".used") });
      const anyBtn = (await btn.count()) ? btn : p.locator(".pool button").filter({ hasText: name });
      await anyBtn.first().click({ timeout: 4000 }).catch(() => {});
      await p.waitForTimeout(40);
      await p.locator(".rack button").nth(sIdx).click({ timeout: 4000 }).catch(() => {});
      await p.waitForTimeout(40);
    }
    await p.waitForTimeout(200);
    const now = Number((await p.locator(".goal .now").innerText()).trim());
    const ok = now >= q.target;
    if (!ok) bad += 1;
    console.log(`  ${ok ? "ok  " : "NG  "} ${String(i + 1).padStart(2)}問目 ${q.name.padEnd(11)}`
      + ` 画面 ${String(now).padStart(4)} / 目標 ${String(q.target).padStart(4)}（表の最良 ${q.best}）`);
    if (i < PUZZLES.length - 1) {
      const next = p.getByRole("button", { name: "次の問題へ" });
      if (!(await next.count())) { console.log("      **次へ進む口が出ない**"); bad += 1; break; }
      await next.first().click(); await p.waitForTimeout(400);
    }
  }
  // **遊び方・気持ち・感想の口があること。**
  //
  // 作者：「感想を書く欄や遊び方を見る欄はないんですか？」——無かった。
  // 遊べるものを作って、**何が起きたかを持ち帰る道を作っていなかった。**
  // 破れは本編の骨格を一つも引き継がずに作ったので、
  // 引き継がなかったものの中に**要るもの**（規則の説明・感想・通報）が混ざっていた。
  {
    await p.locator("#menuButton").click(); await p.waitForTimeout(200);
    for (const name of ["遊び方", "感想を書いて送る"]) {
      const btn = p.locator("#menuDialog button").filter({ hasText: name });
      if (!(await btn.count())) { console.log(`  NG   ⋯ に「${name}」が無い`); bad += 1; }
    }
    await p.locator("#howBtn").click(); await p.waitForTimeout(300);
    const how = await p.locator("#howBody").innerText();
    const hasRules = how.includes("位相") && how.includes("法則が2つ") && how.includes("勝ち負けはない");
    console.log(`  ${hasRules ? "ok  " : "NG  "} 遊び方に規則が書いてある（${how.split("\n").length}行）`);
    if (!hasRules) bad += 1;
    await p.locator("#closeHow").click(); await p.waitForTimeout(200);

    // 気持ちは**その場で残る**こと。押して、保存に入るまで見る。
    await p.locator("#markButton").click(); await p.waitForTimeout(250);
    await p.locator("#markNote").fill("噛み合わせに気づいた");
    await p.locator("#markChoices button").filter({ hasText: "ひらめいた" }).first().click();
    await p.waitForTimeout(250);
    const saved = JSON.parse(await p.evaluate(() => localStorage.getItem("garakuta-puzzle")) || "{}");
    const marks = (saved.marks || []).length;
    console.log(`  ${marks ? "ok  " : "NG  "} 気持ちが記録に残る（${marks}件）`);
    if (!marks) bad += 1;

    // 感想は**未回答を弾く**こと。空のまま送れると、記録が空で埋まる。
    await p.locator("#menuButton").click(); await p.waitForTimeout(200);
    await p.locator("#surveyBtn").click(); await p.waitForTimeout(300);
    const ask = p.locator("dialog.ask");
    await ask.locator("button").filter({ hasText: "記録して送る" }).click();
    await p.waitForTimeout(200);
    const warn = await ask.locator(".warn").innerText();
    console.log(`  ${warn.includes("未回答") ? "ok  " : "NG  "} 空の感想を弾く（「${warn}」）`);
    if (!warn.includes("未回答")) bad += 1;
    await ask.locator("button").filter({ hasText: "やめる" }).click();
    await p.waitForTimeout(200);
  }

  console.log("  例外:", errs.length ? errs.slice(0, 3) : "なし");
  if (errs.length) bad += 1;
  await b.close();
} finally { stop(); }
if (bad) { console.error(`puzzle 通し確認: ${bad}件が通らなかった`); process.exitCode = 1; }
else console.log("puzzle 通し確認: 全問、最良解で目標を越えられた OK");
