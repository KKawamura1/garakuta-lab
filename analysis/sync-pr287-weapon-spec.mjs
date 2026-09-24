import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "docs/skill-reboot/11-weapon-catalog.md");
const outputPath = path.join(root, "ecology/content/weapon-specifications.mjs");
const catalog = fs.readFileSync(catalogPath, "utf8");

const weaponIds = new Map([
  ["戦槌", "warhammer"], ["格闘具", "gauntlets"], ["射出器", "launcher"],
  ["医療具", "medical_kit"], ["大盾", "tower_shield"], ["長槍", "long_spear"],
  ["鉤縄", "grappling_hook"], ["双刃", "dual_blades"], ["号旗", "banner"],
  ["重弩", "heavy_crossbow"],
]);
const kinds = new Map([
  ["アクティブ", "active"], ["リアクティブ", "reactive"],
  ["ターゲット", "target"], ["パッシブ", "passive"],
]);
const expectedPositions = [
  "R", "A1", "A2", "A3", "AA1", "AA2", "AA3", "AB1", "AB2", "AB3",
  "B1", "B2", "B3", "BA1", "BA2", "BA3", "BB1", "BB2", "BB3",
];
const cleanCell = (cell) => cell.trim().replaceAll("<br>", "\n").replaceAll("<br/>", "\n");
const specs = [];
const seenWeapons = new Set();

const sections = [...catalog.matchAll(/^## (\d+)\. ([^\n]+)$/gm)];
for (const [sectionIndex, match] of sections.entries()) {
  const sectionTitle = match[2];
  const weaponName = sectionTitle.match(/^([^（—]+?)(?:（|—)/)?.[1]?.trim();
  const weaponId = weaponIds.get(weaponName);
  if (!weaponId) continue;
  if (seenWeapons.has(weaponId)) throw new Error(`duplicate weapon section: ${weaponName}`);
  seenWeapons.add(weaponId);
  const start = match.index + match[0].length;
  const end = sections[sectionIndex + 1]?.index ?? catalog.length;
  const section = catalog.slice(start, end);
  const tableLines = section.split("\n").filter((line) => line.trimStart().startsWith("|"));
  if (tableLines.length < 3) throw new Error(`missing skill table: ${weaponName}`);
  const rows = tableLines.slice(2).map((line) => line.trim().replace(/^\|/, "").replace(/\|$/, "")
    .split("|").map(cleanCell));
  const before = specs.length;
  for (const [rowIndex, row] of rows.entries()) {
    if (row.length !== 6) throw new Error(`${weaponName} row ${rowIndex + 1}: expected 6 columns, got ${row.length}`);
    const [position, kindName, displayName, implementationContract, displayEffect, flavorText] = row;
    const kind = kinds.get(kindName);
    if (!kind) throw new Error(`${weaponName} ${position}: unknown kind ${kindName}`);
    if (!position || !displayName || !implementationContract || !displayEffect || !flavorText) {
      throw new Error(`${weaponName} ${position}: empty catalog field`);
    }
    specs.push({
      weaponId,
      position,
      kind,
      displayName,
      implementationContract,
      displayEffect,
      flavorText,
    });
  }
  const positions = specs.slice(before).map((spec) => spec.position);
  if (JSON.stringify(positions) !== JSON.stringify(expectedPositions)) {
    throw new Error(`${weaponName}: position order differs from the 19-node contract`);
  }
}

if (seenWeapons.size !== 10 || specs.length !== 190) {
  throw new Error(`expected 10 weapons / 190 skills, got ${seenWeapons.size} / ${specs.length}`);
}
const content = `// Generated from docs/skill-reboot/11-weapon-catalog.md by analysis/sync-pr287-weapon-spec.mjs.\n\nexport const WEAPON_SKILL_SPECIFICATIONS = Object.freeze(${JSON.stringify(specs, null, 2)}.map((spec) => Object.freeze(spec)));\n\nexport const WEAPON_SKILL_SPEC_BY_POSITION = Object.freeze(Object.fromEntries(\n  WEAPON_SKILL_SPECIFICATIONS.map((spec) => [\`${"${spec.weaponId}"}:${"${spec.position}"}\`, spec]),\n));\n`;

if (process.argv.includes("--check")) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : "";
  if (current !== content) throw new Error("weapon specifications are stale; run node analysis/sync-pr287-weapon-spec.mjs");
  console.log("PR #287 weapon catalog: 190 specification rows are synchronized.");
} else {
  fs.writeFileSync(outputPath, content);
  console.log(`wrote ${specs.length} specification rows to ecology/content/weapon-specifications.mjs`);
}
