import {
  WEAPON_SKILL_PROTOTYPE_WEAPONS,
  WEAPON_SKILL_KIND_LABELS,
  buildWeaponSkillPrototypeTree,
  createWeaponSkillLoadoutPrototypeFixture,
  getWeaponSkillPrototypeNode,
  weaponSkillPrototypeSignals,
} from "./weapon-skill-prototype.mjs";
import { moveWeaponPrioritySkill, selectPrimaryWeaponSkill } from "./weapon-loadout.mjs";

const POSITION_ORDER = [
  "R", "A1", "A2", "A3", "AA1", "AA2", "AA3", "AB1", "AB2", "AB3",
  "B1", "B2", "B3", "BA1", "BA2", "BA3", "BB1", "BB2", "BB3",
];
const KIND_GLYPHS = { active: "A", reactive: "R", target: "T", passive: "P" };
const state = {
  screen: "tree",
  weaponId: WEAPON_SKILL_PROTOTYPE_WEAPONS[0].id,
  selectedKey: `${WEAPON_SKILL_PROTOTYPE_WEAPONS[0].id}:R`,
  selectedByWeapon: Object.fromEntries(WEAPON_SKILL_PROTOTYPE_WEAPONS.map((weapon) => [weapon.id, `${weapon.id}:R`])),
  viewByWeapon: Object.fromEntries(WEAPON_SKILL_PROTOTYPE_WEAPONS.map((weapon) => [weapon.id, "map"])),
  mapScrollByWeapon: {},
  loadoutFixture: createWeaponSkillLoadoutPrototypeFixture(),
};
const screenTabs = document.querySelector("#screen-tabs");
const treeScreen = document.querySelector("#tree-screen");
const loadoutScreen = document.querySelector("#loadout-screen");
const loadoutContent = document.querySelector("#loadout-content");
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
  const { condition } = weaponSkillPrototypeSignals(node);
  if (!condition) return "";
  return `<i class="effect-chip condition" title="${escapeHtml(condition.detail)}" aria-label="条件: ${escapeHtml(condition.detail)}">${escapeHtml(condition.label)}</i>`;
}

function costBadges(node) {
  const { costs } = weaponSkillPrototypeSignals(node);
  return costs
    .map((label) => `<i class="effect-chip cost ${label.startsWith("RP") ? "rp" : label.startsWith("HP") ? "hp" : "ap"}">${escapeHtml(label)}</i>`)
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

function priorityList(kind, keys, nodesByKey) {
  if (!keys.length) return '<p class="empty-loadout">この武器に表示例はありません。</p>';
  return `<ol class="sample-skill-list" aria-label="${kind === "reactive" ? "リアクティブ" : "ターゲット"}優先順">${keys.map((key, index) => {
    const node = nodesByKey.get(key);
    return `<li class="sample-skill">
      ${kindIcon(node.kind)}
      <span><b>${escapeHtml(node.displayName)}</b><small>固定例</small></span>
      <span class="priority-controls">
        <button type="button" data-priority-kind="${kind}" data-index="${index}" data-direction="-1" aria-label="${escapeHtml(node.displayName)}を上へ"${index === 0 ? " disabled" : ""}>↑</button>
        <button type="button" data-priority-kind="${kind}" data-index="${index}" data-direction="1" aria-label="${escapeHtml(node.displayName)}を下へ"${index === keys.length - 1 ? " disabled" : ""}>↓</button>
      </span>
    </li>`;
  }).join("")}</ol>`;
}

function renderLoadout() {
  const fixture = state.loadoutFixture;
  const characterId = fixture.characterId;
  const selectedPrimary = fixture.loadout.primarySkillByCharacter[characterId];
  const nodesByKey = new Map([...fixture.primaryChoices, ...fixture.reactiveNodes, ...fixture.targetNodes, ...fixture.passiveNodes]
    .map((node) => [node.key, node]));
  const reactives = fixture.loadout.reactivePriorityByCharacter[characterId];
  const targets = fixture.loadout.targetPriorityByCharacter[characterId];
  loadoutContent.innerHTML = `<div class="loadout-page">
    <section class="card">
      <div class="loadout-title"><div><p class="eyebrow">LOADOUT</p><h2>構成の見え方</h2></div><span class="demo-mark">固定サンプル</span></div>
      <p class="demo-explainer">実装済み技能や取得状態を示す画面ではありません。下の操作は表示順の確認だけに使います。</p>
      <div class="loadout-person" style="margin-top:12px"><b>ゴウ · 戦槌</b><span>人物1名の表示例</span></div>
    </section>

    <section class="card loadout-section" aria-labelledby="primary-title">
      <h3 id="primary-title">主軸 · 一つ</h3>
      <p class="section-note">戦闘で使うactiveを一つ選ぶ形</p>
      <select id="primary-skill-select" class="primary-select" aria-label="主軸の表示例">
        ${fixture.primaryChoices.map((node) => `<option value="${escapeHtml(node.key)}"${node.key === selectedPrimary ? " selected" : ""}>${escapeHtml(node.displayName)} · 本編未実装</option>`).join("")}
      </select>
    </section>

    <section class="card loadout-section" aria-labelledby="reactive-title">
      <h3 id="reactive-title">リアクティブ · 先に成立した一つ</h3>
      <p class="section-note">優先順のデモ。矢印でこのページ内の順を変更</p>
      ${priorityList("reactive", reactives, nodesByKey)}
    </section>

    <section class="card loadout-section" aria-labelledby="target-title">
      <h3 id="target-title">ターゲット · 上から判定</h3>
      <p class="section-note">対象選択規則の優先順を表示</p>
      ${priorityList("target", targets, nodesByKey)}
    </section>

    <section class="card loadout-section" aria-labelledby="passive-title">
      <h3 id="passive-title">パッシブ · 個別の装着欄なし</h3>
      <p class="section-note">分類の表示例。画面で個別にON/OFFする枠は置かない</p>
      <div class="passive-list">${fixture.passiveNodes.map((node) => `<div class="passive-chip">${kindIcon(node.kind)}<b>${escapeHtml(node.displayName)}</b><small>本編未実装</small></div>`).join("")}</div>
    </section>
  </div>`;
}

function renderScreenNavigation() {
  for (const tab of screenTabs.querySelectorAll("[data-screen]")) {
    const selected = tab.dataset.screen === state.screen;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  treeScreen.hidden = state.screen !== "tree";
  loadoutScreen.hidden = state.screen !== "loadout";
}

function render() {
  renderScreenNavigation();
  if (state.screen === "tree") {
    renderWeaponTabs();
    renderTreeControls();
    renderTree();
  } else {
    renderLoadout();
  }
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

screenTabs.addEventListener("click", (event) => {
  const tab = event.target.closest("button[data-screen]");
  if (!tab) return;
  rememberMapScroll();
  state.screen = tab.dataset.screen;
  render();
});

screenTabs.addEventListener("keydown", (event) => {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  const tabs = [...screenTabs.querySelectorAll("button[data-screen]")];
  const current = tabs.indexOf(document.activeElement);
  if (current < 0) return;
  event.preventDefault();
  const delta = event.key === "ArrowRight" ? 1 : -1;
  const next = tabs[(current + delta + tabs.length) % tabs.length];
  rememberMapScroll();
  state.screen = next.dataset.screen;
  render();
  next.focus();
});

loadoutContent.addEventListener("change", (event) => {
  if (event.target.id !== "primary-skill-select") return;
  const fixture = state.loadoutFixture;
  const selected = selectPrimaryWeaponSkill(
    fixture.loadout,
    fixture.characterId,
    event.target.value,
    fixture.unlockedSkillKeysByCharacter,
  );
  if (selected.ok) {
    state.loadoutFixture = { ...fixture, loadout: selected.loadout };
    renderLoadout();
  }
});

loadoutContent.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-priority-kind]");
  if (!button || button.disabled) return;
  const fixture = state.loadoutFixture;
  const index = Number(button.dataset.index);
  const nextIndex = index + Number(button.dataset.direction);
  const moved = moveWeaponPrioritySkill(
    fixture.loadout,
    fixture.characterId,
    button.dataset.priorityKind,
    index,
    nextIndex,
  );
  if (!moved.ok) return;
  state.loadoutFixture = { ...fixture, loadout: moved.loadout };
  renderLoadout();
});

window.addEventListener("resize", layoutWeaponSkillTreeConnectors, { passive: true });
render();
