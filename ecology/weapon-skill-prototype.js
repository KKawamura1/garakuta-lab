import {
  WEAPON_SKILL_PROTOTYPE_WEAPONS,
  WEAPON_SKILL_KIND_LABELS,
  buildWeaponSkillPrototypeTree,
  getWeaponSkillPrototypeNode,
} from "./weapon-skill-prototype.mjs";

const POSITION_ORDER = [
  "R", "A1", "A2", "A3", "AA1", "AA2", "AA3", "AB1", "AB2", "AB3",
  "B1", "B2", "B3", "BA1", "BA2", "BA3", "BB1", "BB2", "BB3",
];
const KIND_GLYPHS = { active: "A", reactive: "R", target: "T", passive: "P" };
const state = {
  weaponId: WEAPON_SKILL_PROTOTYPE_WEAPONS[0].id,
  selectedKey: `${WEAPON_SKILL_PROTOTYPE_WEAPONS[0].id}:R`,
  selectedByWeapon: Object.fromEntries(WEAPON_SKILL_PROTOTYPE_WEAPONS.map((weapon) => [weapon.id, `${weapon.id}:R`])),
  viewByWeapon: Object.fromEntries(WEAPON_SKILL_PROTOTYPE_WEAPONS.map((weapon) => [weapon.id, "map"])),
  mapScrollByWeapon: {},
};
const weaponTabs = document.querySelector("#weapon-tabs");
const treeControls = document.querySelector("#tree-controls");
const tree = document.querySelector("#skill-tree");
const detail = document.querySelector("#skill-detail");
const visibleCount = document.querySelector("#visible-count");

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function selectedWeapon() {
  return WEAPON_SKILL_PROTOTYPE_WEAPONS.find((weapon) => weapon.id === state.weaponId);
}

function currentNodes() {
  const order = new Map(POSITION_ORDER.map((position, index) => [position, index]));
  return buildWeaponSkillPrototypeTree(state.weaponId).flatMap((group) => group.nodes)
    .sort((left, right) => order.get(left.position) - order.get(right.position));
}

function kindIcon(kind) {
  const label = WEAPON_SKILL_KIND_LABELS[kind] ?? "技能";
  return `<span class="weapon-kind-icon kind-${escapeHtml(kind)}" role="img" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${KIND_GLYPHS[kind] ?? "•"}</span>`;
}

function compactCondition(node) {
  const clause = node.displayEffect.match(/(?:^|[、,])([^、,。]{1,36}(?:時|とき|場合|反応窓)[^、,。]{0,8})(?=[、,。]|$)/)?.[1];
  if (!clause) return "";
  const label = /反応窓/.test(clause) ? "反応窓"
    : /1hit目|初撃/.test(clause) ? "初撃命中"
      : /命中/.test(clause) ? "命中時"
        : /被弾|被攻撃|攻撃を受け/.test(clause) ? "被弾時"
          : /対象変更/.test(clause) ? "対象変更時"
            : /対象選択/.test(clause) ? "対象選択時"
              : /行動.*宣言/.test(clause) ? "宣言時"
                : /行動.*解決/.test(clause) ? "解決時"
                  : /撃破/.test(clause) ? "撃破時"
                    : /ラウンド.*始/.test(clause) ? "開始時"
                      : /ラウンド.*終/.test(clause) ? "終了時" : "条件";
  return `<i class="effect-chip condition" title="${escapeHtml(clause)}" aria-label="条件: ${escapeHtml(clause)}">${label}</i>`;
}

function costBadges(node) {
  const seen = new Set();
  return [...node.displayEffect.matchAll(/\b(AP|RP|HP)\s*(\d+)/g)]
    .map((match) => `${match[1]}${match[2]}`)
    .filter((label) => !seen.has(label) && seen.add(label))
    .map((label) => `<i class="effect-chip cost ${label.startsWith("RP") ? "rp" : label.startsWith("HP") ? "hp" : "ap"}">${label}</i>`)
    .join("");
}

function effectBadges(node, limit = 3) {
  const text = node.displayEffect;
  const badges = [];
  const seen = new Set();
  const push = (label, tone = "") => {
    if (!label || seen.has(label) || badges.length >= limit) return;
    seen.add(label);
    badges.push(`<i class="effect-chip ${tone}">${escapeHtml(label)}</i>`);
  };
  const scaled = text.match(/(腕力|技術|受け|最大HP)\s*([+−-]?\d+%)/);
  if (scaled) push(`${{ 腕力: "腕", 技術: "技", 受け: "受", 最大HP: "HP" }[scaled[1]]}×${scaled[2]}`, "scaled");
  if (/左右/.test(text)) push("左右", "scope");
  else if (/一列|列の敵/.test(text)) push("一列", "scope");
  else if (/敵(?:1|一)体|単体/.test(text)) push("単体", "scope");
  else if (/全員|全体|すべての敵/.test(text)) push("全体", "scope");
  const pierce = text.match(/(?:防御を(?:合計)?|受け)(\d+)無視/)?.[1];
  if (pierce) push(`貫通${pierce}`, "up");
  const hit = text.match(/(\d+(?:〜\d+)?)\s*hit/i)?.[1];
  if (hit) push(`×${hit}`, "hit");
  const status = text.match(/(怯み|裂傷|破甲|集中標|防壁|守勢|再生薬)(?:を|が)?\s*([+−-]?\d+)/);
  if (status) push(`${status[1].replace("防壁", "壁")}${status[2]}`, "status");
  const percent = text.match(/(ダメージ|攻撃|防壁|回復)(?:量|の)?\s*([+−-]\d+%)/);
  if (percent) {
    const prefix = { ダメージ: "ダ", 攻撃: "攻", 防壁: "壁", 回復: "癒" }[percent[1]];
    const down = /[-−]/.test(percent[2]);
    push(`${down ? "↓" : "↑"}${prefix}${percent[2].replace(/^[+−-]/, "")}`, down ? "down" : "up");
  }
  return `<span class="weapon-effect-badges" role="img" aria-label="${escapeHtml(text)}">${badges.join("")}</span>`;
}

function nodeSignals(node) {
  const condition = compactCondition(node);
  const costs = costBadges(node);
  return `<span class="weapon-node-signals"><span class="weapon-node-inputs"${condition || costs ? ' aria-label="条件・コスト"' : ""}>${condition}${costs}</span><i class="weapon-signal-divider" aria-hidden="true"></i>${effectBadges(node)}</span>`;
}

function treeCoordinates(position) {
  if (position === "R") return { column: 1, row: 4 };
  const trunk = /^(A|B)([1-3])$/.exec(position);
  if (trunk) return { column: Number(trunk[2]) + 1, row: trunk[1] === "A" ? 2 : 6 };
  const branch = /^(AA|AB|BA|BB)([1-3])$/.exec(position);
  if (branch) return { column: Number(branch[2]) + 4, row: { AA: 1, AB: 3, BA: 5, BB: 7 }[branch[1]] };
  return { column: 1, row: 4 };
}

function weaponListLayout(nodes) {
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const children = new Map(nodes.map((node) => [node.key, []]));
  for (const node of nodes) {
    for (const required of node.prerequisiteKeys) if (children.has(required)) children.get(required).push(node);
  }
  const roots = nodes.filter((node) => !node.prerequisiteKeys.some((key) => byKey.has(key)));
  const rows = [];
  const walk = (node, depth, guides, last) => {
    const next = children.get(node.key) ?? [];
    rows.push({ node, depth, guides, last, hasChildren: next.length > 0 });
    next.forEach((child, index) => walk(child, depth + 1, depth === 0 ? [] : [...guides, !last], index === next.length - 1));
  };
  roots.forEach((root, index) => walk(root, 0, [], index === roots.length - 1));
  return rows;
}

function weaponListGuide(layout) {
  if (!layout || layout.depth === 0) return '<span class="weapon-list-guide root" aria-hidden="true"><i></i></span>';
  const rails = layout.guides.map((open) => `<i class="rail${open ? " open" : ""}"></i>`).join("");
  return `<span class="weapon-list-guide" aria-hidden="true">${rails}<i class="elbow${layout.last ? " last" : ""}${layout.hasChildren ? " has-children" : ""}"></i></span>`;
}

function nodeCard(node, mode, layout = null) {
  const selected = node.key === state.selectedKey;
  const placement = mode === "map" ? treeCoordinates(node.position) : { depth: layout?.depth ?? 0 };
  const style = mode === "map" ? ` style="grid-column:${placement.column};grid-row:${placement.row}"` : ` style="--weapon-depth:${placement.depth}"`;
  return `<div class="weapon-tree-cell ${mode}${selected ? " selected" : ""}" data-skill-key="${escapeHtml(node.key)}"${style}>${mode === "list" ? weaponListGuide(layout) : ""}
    <article class="weapon-skill-node role-${escapeHtml(node.kind)} locked${selected ? " selected" : ""}">
      <button class="weapon-node-main" type="button" data-skill-key="${escapeHtml(node.key)}" aria-pressed="${selected}">
        <span class="weapon-node-copy"><span class="weapon-node-name">${kindIcon(node.kind)}<b>${escapeHtml(node.displayName)}</b></span>${nodeSignals(node)}</span>
      </button><span class="weapon-node-action"><span class="weapon-node-state locked" aria-label="本編未実装" title="本編未実装">未実装</span></span>
    </article></div>`;
}

function renderWeaponTabs() {
  weaponTabs.innerHTML = WEAPON_SKILL_PROTOTYPE_WEAPONS.map((weapon) => {
    const selected = weapon.id === state.weaponId;
    return `<button class="weapon-tab${selected ? " active" : ""}" type="button" role="tab" aria-pressed="${selected}" data-weapon="${escapeHtml(weapon.id)}">${escapeHtml(weapon.label)}</button>`;
  }).join("");
}

function renderTreeControls() {
  const view = state.viewByWeapon[state.weaponId] ?? "map";
  treeControls.innerHTML = `<div class="view-switch" role="group" aria-label="武器技能ツリーの見方">
    <button type="button" class="view-tab${view === "map" ? " on" : ""}" aria-pressed="${view === "map"}" data-view="map">地図</button>
    <button type="button" class="view-tab${view === "list" ? " on" : ""}" aria-pressed="${view === "list"}" data-view="list">一覧</button>
  </div>`;
}

function renderTree() {
  state.selectedKey = Object.hasOwn(state.selectedByWeapon, state.weaponId) ? state.selectedByWeapon[state.weaponId] : `${state.weaponId}:R`;
  const nodes = currentNodes();
  const view = state.viewByWeapon[state.weaponId] ?? "map";
  const weapon = selectedWeapon();
  visibleCount.textContent = "19節";
  tree.setAttribute("aria-label", `${weapon.label}の技能ツリー、19節`);
  const rows = view === "list" ? weaponListLayout(nodes).map((layout) => nodeCard(layout.node, view, layout)).join("") : nodes.map((node) => nodeCard(node, view)).join("");
  tree.innerHTML = view === "map"
    ? `<div class="weapon-tree-title"><b>${escapeHtml(weapon.label)}</b><small>技能の派生</small></div><div class="weapon-tree-scroll"><div class="weapon-skill-map" data-weapon="${escapeHtml(weapon.id)}"><svg class="weapon-tree-lines" aria-hidden="true"></svg>${rows}</div></div>`
    : `<div class="weapon-tree-title"><b>${escapeHtml(weapon.label)}</b><small>技能の派生</small></div><div class="weapon-skill-list">${rows}</div>`;
  renderDetail();
  if (view === "map") {
    const scroller = tree.querySelector(".weapon-tree-scroll");
    scroller.scrollLeft = state.mapScrollByWeapon[state.weaponId] ?? 0;
    scroller.addEventListener("scroll", () => { state.mapScrollByWeapon[state.weaponId] = scroller.scrollLeft; }, { passive: true });
    layoutWeaponSkillTreeConnectors();
    focusSelectedMapNode();
  }
}

function renderDetail() {
  const node = getWeaponSkillPrototypeNode(state.selectedKey);
  if (!node) { detail.innerHTML = ""; return; }
  detail.innerHTML = `<aside class="weapon-skill-sheet locked" aria-live="polite">
    <header class="weapon-sheet-head">${kindIcon(node.kind)}<span class="weapon-sheet-title"><b>${escapeHtml(node.displayName)}</b></span><span class="weapon-sheet-state">本編未実装</span>
      <button type="button" class="weapon-sheet-close" data-clear-selection aria-label="選択を閉じる" title="閉じる">×</button></header>
    <div class="weapon-sheet-body"><p class="weapon-detail-effect">${escapeHtml(node.displayEffect)}</p></div></aside>`;
}

function layoutWeaponSkillTreeConnectors() {
  const map = tree.querySelector(".weapon-skill-map[data-weapon]");
  const svg = map?.querySelector(".weapon-tree-lines");
  if (!map || !svg) return;
  const nodes = currentNodes();
  const byKey = new Map(nodes.map((node) => [node.key, node]));
  const elements = new Map([...map.querySelectorAll(".weapon-tree-cell[data-skill-key]")].map((element) => [element.dataset.skillKey, element]));
  const mapRect = map.getBoundingClientRect();
  const anchor = (element) => { const rect = element.getBoundingClientRect(); return { left: rect.left - mapRect.left, right: rect.right - mapRect.left, centerY: rect.top - mapRect.top + rect.height / 2 }; };
  const selectedPath = new Set();
  let parentKey = state.selectedKey;
  while (parentKey) { const node = byKey.get(parentKey); parentKey = node?.prerequisiteKeys[0] ?? null; if (parentKey) selectedPath.add(parentKey); }
  const paths = [];
  for (const child of nodes) {
    const childElement = elements.get(child.key);
    if (!childElement) continue;
    for (const requiredKey of child.prerequisiteKeys) {
      const parentElement = elements.get(requiredKey);
      if (!parentElement) continue;
      const parent = anchor(parentElement); const target = anchor(childElement); const busX = parent.right + (target.left - parent.right) / 2;
      const selected = child.key === state.selectedKey || selectedPath.has(child.key);
      paths.push(`<path class="weapon-tree-line${selected ? " selected" : ""}" d="M ${parent.right} ${parent.centerY} H ${busX} V ${target.centerY} H ${target.left}"></path>`);
    }
  }
  svg.setAttribute("viewBox", `0 0 ${map.scrollWidth} ${map.scrollHeight}`);
  svg.innerHTML = paths.join("");
}

function refreshTreeSelection() {
  for (const cell of tree.querySelectorAll(".weapon-tree-cell[data-skill-key]")) {
    const selected = cell.dataset.skillKey === state.selectedKey;
    cell.classList.toggle("selected", selected);
    cell.querySelector(".weapon-skill-node")?.classList.toggle("selected", selected);
    cell.querySelector(".weapon-node-main")?.setAttribute("aria-pressed", String(selected));
  }
  renderDetail();
  layoutWeaponSkillTreeConnectors();
}

function focusSelectedMapNode() {
  const scroller = tree.querySelector(".weapon-tree-scroll");
  const selected = tree.querySelector(".weapon-tree-cell.selected");
  if (!scroller || !selected) return;
  const windowRect = scroller.getBoundingClientRect();
  const nodeRect = selected.getBoundingClientRect();
  if (nodeRect.left < windowRect.left) {
    scroller.scrollBy({ left: nodeRect.left - windowRect.left - 8, behavior: "smooth" });
  } else if (nodeRect.right > windowRect.right) {
    scroller.scrollBy({ left: nodeRect.right - windowRect.right + 8, behavior: "smooth" });
  }
}

function rememberMapScroll() {
  const scroller = tree.querySelector(".weapon-tree-scroll");
  if (scroller) state.mapScrollByWeapon[state.weaponId] = scroller.scrollLeft;
}

function render() {
  renderWeaponTabs();
  renderTreeControls();
  renderTree();
}

weaponTabs.addEventListener("click", (event) => {
  const tab = event.target.closest("button[data-weapon]");
  if (!tab || tab.dataset.weapon === state.weaponId) return;
  rememberMapScroll();
  state.weaponId = tab.dataset.weapon;
  render();
});

treeControls.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-view]");
  if (!button) return;
  rememberMapScroll();
  state.viewByWeapon[state.weaponId] = button.dataset.view;
  render();
});

tree.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-skill-key]");
  if (!button) return;
  state.selectedKey = button.dataset.skillKey;
  state.selectedByWeapon[state.weaponId] = state.selectedKey;
  refreshTreeSelection();
});

detail.addEventListener("click", (event) => {
  if (!event.target.closest("button[data-clear-selection]")) return;
  state.selectedKey = null;
  state.selectedByWeapon[state.weaponId] = null;
  refreshTreeSelection();
});

window.addEventListener("resize", layoutWeaponSkillTreeConnectors, { passive: true });
render();
