import { BATTLE_SCHEMA_VERSION, POSITIONS, POSITION_ROW } from "./schema.mjs";
import { simulateBattle } from "./engine.mjs";
import {
  ACTIVE_META,
  CHARACTER_DEFINITIONS,
  DISPLAY_NAMES,
  ENCOUNTERS,
  ENEMY_LORE,
  ENEMY_TARGETING,
  EQUIPMENT_META,
  PLAYABLE_CONTENT,
  PASSIVE_META,
  REACTIVE_META,
  PROLOGUE,
  SKILL_TREE_NODES,
} from "./content/index.mjs";
import { RARITY_LABEL } from "./content/affixes.mjs";
// R8 §11 — exact preview は RunState の manifest / 難易度から encounter を
// 組む progression.mjs の composeEncounter をそのまま使う。**preview 用に
// 別の敵編成ロジックを持たない**（別経路で組むと、いつかどちらかだけ変わる）。
import { characterStats, composeEncounter, runContentBundle } from "./progression.mjs";

export const RUN_SEED = "frontier-1801";

// R6 §5.4 — 5人編成、2×3、空きは必ず一枠。
export const PARTY_SIZE = 5;
export const ROW_CAPACITY = 3;

// 有効な隊列は**前3後2 か 前2後3 だけ**。前1後4 と前4後1 は作れない。
// 前3は single melee を分散しやすいが front-row attack が3人へ当たる。
// 前2は後列を3人置けるが、前列一人あたりの被弾が増える。**そこが選択になる。**
export function isValidRowSplit(frontCount, partySize = PARTY_SIZE) {
  return frontCount >= partySize - ROW_CAPACITY && frontCount <= ROW_CAPACITY;
}

// 隊列を必ず有効な形へ落とす。**置き場所の規則はここ一箇所にしかない**
// （画面側にもう一つ持つと、いつか片方だけが直る）。
export function normalizeFormation(formation, rosterIds) {
  const members = (rosterIds ?? []).filter((id) => characterById[id]).slice(0, PARTY_SIZE);
  const next = {};
  const used = new Set();

  // 1. 希望どおりに置けるものを置く（既存の save はここで全部決まる）。
  for (const id of members) {
    const requested = formation?.[id];
    if (POSITIONS.includes(requested) && !used.has(requested)) {
      next[id] = requested;
      used.add(requested);
    }
  }
  // 2. 残りは既定位置を優先し、埋まっていれば空きの先頭へ。
  for (const id of members) {
    if (next[id]) continue;
    const preferred = characterById[id]?.defaultPosition;
    const slot = POSITIONS.includes(preferred) && !used.has(preferred)
      ? preferred
      : POSITIONS.find((candidate) => !used.has(candidate));
    if (!slot) break;
    next[id] = slot;
    used.add(slot);
  }
  // 3. 行の偏りを直す。**ここが無いと、旧 save から前4後1 が生まれる。**
  const rowMembers = (row) => members.filter((id) => next[id] && POSITION_ROW[next[id]] === row);
  const freeIn = (row) => POSITIONS.filter((p) => POSITION_ROW[p] === row && !used.has(p));
  for (let guard = 0; guard <= PARTY_SIZE; guard += 1) {
    const front = rowMembers("front");
    if (isValidRowSplit(front.length, members.length)) break;
    const from = front.length > ROW_CAPACITY ? "front" : "rear";
    const movers = rowMembers(from);
    const mover = movers[movers.length - 1];
    const slot = freeIn(from === "front" ? "rear" : "front")[0];
    if (!mover || !slot) break;
    used.delete(next[mover]);
    next[mover] = slot;
    used.add(slot);
  }
  return next;
}

// 旧 save は4人。**足りない人数を決定的に足す**（並び順の先頭から、まだ居ない人）。
//
// R9 §2.1 — チュートリアル Stage は2〜5人なので、埋める人数は呼び出し側が渡す。
// 渡さなければ従来どおり5人（Free / Endless と旧 save の移行）。
export function ensurePartySize(rosterIds, size = PARTY_SIZE) {
  const target = Math.max(1, Math.min(PARTY_SIZE, Math.floor(size)));
  const roster = (rosterIds ?? []).filter((id) => characterById[id]).slice(0, target);
  for (const option of CHARACTER_OPTIONS) {
    if (roster.length >= target) break;
    if (!roster.includes(option.id)) roster.push(option.id);
  }
  return roster;
}

const clone = (value) => structuredClone(value);


export const CHARACTER_OPTIONS = Object.freeze(
  CHARACTER_DEFINITIONS.map((option) => Object.freeze(option)),
);
const characterById = Object.fromEntries(CHARACTER_OPTIONS.map((option) => [option.id, option]));




function metadata(source, kind) {
  return Object.fromEntries(
    Object.entries(source).map(([id, values]) => [
      id,
      {
        id,
        kind,
        definitionId: id,
        label: values[0],
        effect: values[1],
        grammar: values[2],
        ...(kind === "equipment" ? { maxDurability: values[3] } : {}),
      },
    ]),
  );
}

export const SKILLS = Object.freeze({
  active: Object.freeze(metadata(ACTIVE_META, "active")),
  reactive: Object.freeze(metadata(REACTIVE_META, "reactive")),
  passive: Object.freeze(metadata(PASSIVE_META, "passive")),
});
export const EQUIPMENT = Object.freeze(metadata(EQUIPMENT_META, "equipment"));
export const COMPONENTS = Object.freeze({
  ...SKILLS.active,
  ...SKILLS.reactive,
  ...SKILLS.passive,
  ...EQUIPMENT,
});
export const COMPONENT_ORDER = Object.freeze(Object.keys(COMPONENTS));


const nodeBySkill = Object.fromEntries(SKILL_TREE_NODES.map((node) => [node.skillId, node]));

export function characterInfo(characterId) {
  return characterById[characterId] ?? null;
}

// ---------------------------------------------------------------- 遠征装備の metadata
//
// **遠征ごとの装備は COMPONENTS に居ない。**COMPONENTS は凍結した content 契約
// （contract.test.mjs が分離前の出力と深一致を見ている）なので、実行時に品を
// 差し込まない。代わりに、いま遊んでいる遠征が抱えている定義から作った
// 別表をここへ置き、`componentInfo` が両方を見る。
//
// 表は run が変わるたびに作り直す。**貯め込むと、前の遠征の品が次の遠征の
// 装備画面に残る。**
let generatedComponents = Object.create(null);

export function registerGeneratedEquipment(generated = {}) {
  const table = Object.create(null);
  for (const [id, item] of Object.entries(generated ?? {})) {
    if (!item?.definition) continue;
    table[id] = {
      id,
      kind: "equipment",
      definitionId: id,
      label: item.definition.displayName,
      effect: (item.readout?.lines ?? []).join(" "),
      grammar: "等級 · " + (RARITY_LABEL[item.rarity] ?? item.rarity),
      maxDurability: item.definition.maxDurability,
      generated: true,
      rarity: item.rarity,
      descriptor: item.descriptor,
      carried: item.carried === true,
      readout: item.readout ?? null,
    };
  }
  generatedComponents = table;
  return table;
}

export function generatedComponentIds() {
  return Object.keys(generatedComponents);
}

export function componentInfo(componentId) {
  return COMPONENTS[componentId] ?? generatedComponents[componentId] ?? null;
}

export function componentLabel(componentId) {
  return componentInfo(componentId)?.label ?? DISPLAY_NAMES[componentId] ?? componentId;
}

export function skillNode(skillId) {
  return nodeBySkill[skillId] ?? null;
}

export function initialUnlockedSkills(characterId) {
  const character = characterById[characterId];
  if (!character) return [];
  return [...new Set([
    "strike",
    "mend",
    "bulwark",
    ...character.starterTactics,
    ...character.starterReactives,
  ])];
}

// R18 — 取得済み技能は、行動・反応・常設を問わず自動で有効になる。
// ここでいう「無制限」はゲーム上の枠を設けないという意味で、BattleInput の
// validator にだけ、壊れた入力を早期に止めるための安全上限を置く。
// 装備だけは従来どおり2枠。
export const SLOT_LIMITS = Object.freeze({
  active: Number.MAX_SAFE_INTEGER,
  reactive: Number.MAX_SAFE_INTEGER,
  passive: Number.MAX_SAFE_INTEGER,
  equipment: 2,
});
const LOADOUT_KEYS = Object.freeze({ active: "tactics", reactive: "reactives", passive: "passives" });

export function freshLoadout(rosterIds) {
  const tactics = {};
  const reactives = {};
  const passives = {};
  const equipment = {};
  for (const characterId of rosterIds) {
    if (!characterById[characterId]) continue;
    const skillsByKind = { active: [], reactive: [], passive: [] };
    for (const skillId of initialUnlockedSkills(characterId)) {
      const kind = nodeBySkill[skillId]?.kind;
      if (kind && skillsByKind[kind]) skillsByKind[kind].push(skillId);
    }
    tactics[characterId] = skillsByKind.active;
    reactives[characterId] = skillsByKind.reactive;
    passives[characterId] = skillsByKind.passive;
    equipment[characterId] = [];
  }
  return { tactics, reactives, passives, equipment };
}

// プロローグは通常遠征とは別の固定脚本盤面。物語の勝敗契約を変えないため、
// 本編の初期習得技能を自動反映する loadout ではなく、脚本が指定した starter だけを使う。
function prologueLoadout(rosterIds) {
  const tactics = {};
  const reactives = {};
  const passives = {};
  const equipment = {};
  for (const characterId of rosterIds) {
    const option = characterById[characterId];
    if (!option) continue;
    tactics[characterId] = [...option.starterTactics];
    reactives[characterId] = [...option.starterReactives];
    passives[characterId] = [];
    equipment[characterId] = [];
  }
  return { tactics, reactives, passives, equipment };
}

function normalizeLoadout(loadout, rosterIds, limitsFor) {
  const next = clone(loadout ?? freshLoadout(rosterIds));
  // 旧 save には passives が無い。**足りない鍵はここで生やす**
  // （呼び出し側それぞれで面倒を見ると、いつか一箇所が忘れる）。
  next.tactics = next.tactics ?? {};
  next.reactives = next.reactives ?? {};
  next.passives = next.passives ?? {};
  next.equipment = next.equipment ?? {};
  for (const characterId of rosterIds) {
    const limits = limitsOf(limitsFor, characterId);
    // 技能は上限なし。旧 save の重複だけはここで正規化する。
    next.tactics[characterId] = [...new Set(next.tactics?.[characterId] ?? [])];
    next.reactives[characterId] = [...new Set(next.reactives?.[characterId] ?? [])];
    next.passives[characterId] = [...new Set(next.passives?.[characterId] ?? [])];
    next.equipment[characterId] = [...new Set(next.equipment?.[characterId] ?? [])].slice(0, limits.equipment);
  }
  // disabled は後方互換のため optional。無い save は全技能を有効として扱う。
  // 取得済み一覧に載っている技能だけをオフにできるよう、対象 character 分だけ掃除する。
  if (next.disabled && typeof next.disabled === "object") {
    next.disabled = { ...next.disabled };
    for (const characterId of rosterIds) {
      const listed = new Set([
        ...(next.tactics[characterId] ?? []),
        ...(next.reactives[characterId] ?? []),
        ...(next.passives[characterId] ?? []),
      ]);
      const disabled = [...new Set(Array.isArray(next.disabled[characterId]) ? next.disabled[characterId] : [])]
        .filter((skillId) => listed.has(skillId));
      if (disabled.length) next.disabled[characterId] = disabled;
      else delete next.disabled[characterId];
    }
    if (!Object.keys(next.disabled).length) delete next.disabled;
  }
  return next;
}

// 装備の上限など、人物ごとの loadout 設定をここ一箇所で解く。関数でも表でも渡せる。
function limitsOf(limitsFor, characterId) {
  if (typeof limitsFor === "function") return { ...SLOT_LIMITS, ...limitsFor(characterId) };
  if (limitsFor && typeof limitsFor === "object") return { ...SLOT_LIMITS, ...limitsFor };
  return SLOT_LIMITS;
}

function listedSkillIds(loadout, characterId) {
  return [
    ...(loadout?.tactics?.[characterId] ?? []),
    ...(loadout?.reactives?.[characterId] ?? []),
    ...(loadout?.passives?.[characterId] ?? []),
  ];
}

// R18 — 取得状態は変えず、取得済み一覧にある技能の効果だけを一時停止する。
// disabled を別欄に置くことで、オフにしても技能点や前提の解禁状態は失わない。
export function toggleSkill(loadout, characterId, skillId, limitsFor) {
  const next = normalizeLoadout(loadout, [characterId], limitsFor);
  if (!listedSkillIds(next, characterId).includes(skillId)) {
    return { ok: false, reason: "その技能は取得済み一覧にありません。" };
  }
  const disabled = new Set(next.disabled?.[characterId] ?? []);
  const enabled = disabled.has(skillId);
  if (enabled) disabled.delete(skillId);
  else disabled.add(skillId);
  next.disabled = { ...(next.disabled ?? {}) };
  if (disabled.size) next.disabled[characterId] = [...disabled];
  else {
    delete next.disabled[characterId];
    if (!Object.keys(next.disabled).length) delete next.disabled;
  }
  return { ok: true, loadout: next, enabled };
}

export function equipEquipment(loadout, characterId, equipmentId, slot = 0, limitsFor) {
  const component = componentInfo(equipmentId);
  if (!component || component.kind !== "equipment" || !characterById[characterId]) {
    return { ok: false, reason: "装備か仲間が見つかりません。" };
  }
  const next = normalizeLoadout(loadout, Object.keys(loadout?.tactics ?? {}), limitsFor);
  for (const id of Object.keys(next.equipment)) {
    next.equipment[id] = (next.equipment[id] ?? []).filter((item) => item !== equipmentId);
  }
  next.equipment[characterId] ??= [];
  next.equipment[characterId][Math.max(0, Math.min(1, slot))] = equipmentId;
  next.equipment[characterId] = next.equipment[characterId].filter(Boolean).slice(0, 2);
  return { ok: true, loadout: next };
}

export function removeEquipment(loadout, characterId, equipmentId, limitsFor) {
  const next = normalizeLoadout(loadout, Object.keys(loadout?.tactics ?? {}), limitsFor);
  next.equipment[characterId] = (next.equipment[characterId] ?? []).filter((id) => id !== equipmentId);
  return next;
}

export function encounterInfo(stage) {
  return ENCOUNTERS[Math.max(0, Math.min(ENCOUNTERS.length - 1, stage - 1))];
}

export function encounterLabel(stage) {
  return encounterInfo(stage).name;
}

export function stageRule(stage) {
  if (stage <= 1) return "初期構成を組んで、敵の狙いを確認する";
  if (stage <= 3) return "報酬を一つ拾い、技能と装備を再配置する";
  return "傷と装備消耗を抱えたまま、次の問いに答える";
}

export function enemyTargetingText(enemyActorId) {
  return ENEMY_TARGETING[enemyActorId] ?? "前列を優先して狙う。";
}

// R12 §4.B — 拾い屋のあいだで言われていること。**無ければ黙る**
// （既定文を作ると、書いていない敵にも世界の声があるように見える）。
export function enemyLoreText(enemyActorId) {
  return ENEMY_LORE[enemyActorId] ?? null;
}

export function enemyInfo(enemyActorId) {
  const definition = PLAYABLE_CONTENT.enemyActors[enemyActorId];
  return {
    id: enemyActorId,
    label: DISPLAY_NAMES[enemyActorId] ?? definition?.displayName ?? enemyActorId,
    targeting: enemyTargetingText(enemyActorId),
    lore: enemyLoreText(enemyActorId),
  };
}

export function reorderSkill(loadout, characterId, kind, index, direction, limitsFor) {
  const next = normalizeLoadout(loadout, [characterId], limitsFor);
  const listKey = LOADOUT_KEYS[kind];
  if (!listKey || !["active", "reactive"].includes(kind)) return next;
  const skills = next[listKey][characterId] ?? [];
  const otherIndex = index + direction;
  if (!Number.isInteger(index) || !Number.isInteger(direction)
      || index < 0 || index >= skills.length || otherIndex < 0 || otherIndex >= skills.length) return next;
  [skills[index], skills[otherIndex]] = [skills[otherIndex], skills[index]];
  return next;
}

// 旧 caller との互換入口。active の並び替えも同じ実装へ集約する。
export function reorderTactic(loadout, characterId, index, direction, limitsFor) {
  return reorderSkill(loadout, characterId, "active", index, direction, limitsFor);
}

const TACTIC_USE_WHEN = Object.freeze({
  relay_order: [{ type: "history_count", subject: "self", metric: "active_actions", window: "round", op: "eq", value: 0 }],
});

// **装備の定義は content bundle から引く。**遠征ごとの装備は
// PLAYABLE_CONTENT に無く、遠征ごとの bundle（progression.runContentBundle）
// にしか居ないので、ここで固定 content を直接読むと拾った装備が黙って落ちる。
function equipmentInput(characterId, equipmentIds, durability = {}, content = PLAYABLE_CONTENT) {
  return equipmentIds.filter((id) => content.equipment[id]).map((equipmentId, index) => ({
    instanceId: "e_" + characterId + "_" + equipmentId + "_" + index,
    equipmentId,
    durability: Math.max(0, durability[equipmentId] ?? content.equipment[equipmentId].maxDurability ?? 1),
  }));
}

// **取得済みで有効な行動を、そのまま戦闘へ渡す。**技能数にゲーム上の枠はない。
function usableTactics(ids) {
  return ids.filter((id) => PLAYABLE_CONTENT.activeSkills[id]).map((activeSkillId) => ({
    activeSkillId,
    useWhen: TACTIC_USE_WHEN[activeSkillId] ?? [],
  }));
}

// 味方1人ぶんの battle input。**編成・技能・装備・鍛錬をここでだけ組む。**
// 7区画の試作（makeBattle）と12戦の遠征（makeExpeditionBattle）が同じ関数を通る。
function allyInput(characterId, position, loadout, options = {}) {
  const option = characterById[characterId];
  const initial = freshLoadout([characterId]);
  const tactics = loadout.tactics?.[characterId] ?? initial.tactics[characterId];
  const reactives = loadout.reactives?.[characterId] ?? initial.reactives[characterId];
  const disabled = new Set(loadout.disabled?.[characterId] ?? []);
  const enabled = (ids) => ids.filter((id) => !disabled.has(id));
  const ally = {
    instanceId: "a_" + characterId,
    characterId,
    position,
    tactics: usableTactics(enabled(tactics)),
    reactiveSkillIds: enabled(reactives).filter((id) => PLAYABLE_CONTENT.reactiveSkills[id]),
    passiveSkillIds: enabled(loadout.passives?.[characterId] ?? [])
      .filter((id) => PLAYABLE_CONTENT.passiveSkills[id]),
    equipment: equipmentInput(
      characterId,
      loadout.equipment?.[characterId] ?? [],
      options.equipmentDurability ?? {},
      options.content ?? PLAYABLE_CONTENT,
    ),
  };
  // R6 §9.5 — PHASE B. 鍛錬後の stat と、その level。**engine は鍛錬を知らない**
  // ので、丸め済みの値と記録の両方をここで渡す。
  const trained = options.statsFor?.(characterId) ?? null;
  if (trained) {
    ally.stats = { ...trained.stats };
    ally.training = { ...trained.training };
  }
  const hp = options.hp?.[characterId];
  const ceiling = ally.stats?.maxHp ?? PLAYABLE_CONTENT.characters[characterId].maxHp;
  if (Number.isFinite(hp)) ally.hp = Math.max(0, Math.min(ceiling, hp));
  return ally;
}

export function makeBattle(
  stage,
  rosterIds = ["warden", "mender", "lancer", "guardian", "tactician"],
  loadout = freshLoadout(rosterIds),
  seed = RUN_SEED,
  formation = {},
  persistent = {},
) {
  const encounter = encounterInfo(stage);
  const selected = rosterIds.filter((characterId) => characterById[characterId]).slice(0, PARTY_SIZE);
  // **置き場所の規則は normalizeFormation にしかない。**ここで別に決めると、
  // 画面が見せている隊列と戦闘に入る隊列がずれる。
  const placed = normalizeFormation(formation, selected);
  const allies = selected.map((characterId) => allyInput(
    characterId,
    placed[characterId] ?? characterById[characterId].defaultPosition,
    loadout,
    { hp: persistent.hp, equipmentDurability: persistent.equipmentDurability, limitsFor: persistent.limitsFor, statsFor: persistent.statsFor },
  ));
  return {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: "frontier_" + String(seed).replace(/[^a-z0-9_]/gi, "_") + "_stage_" + stage,
    maxRounds: encounter.maxRounds,
    objective: { type: "eliminate_all_enemies" },
    allies,
    enemies: clone(encounter.enemies),
  };
}

// R6 §5.1 / §11 — PHASE B. 12戦の遠征の一戦。
//
// **敵は composeEncounter が決めた形をそのまま渡す。**難易度で増える増援と変異は
// 既に stat と mutation 名になっていて、ここでは何も足さない
// （難易度の三層を同じ場所で動かさないため。R7 §8）。
export function makeExpeditionBattle(composed, rosterIds, loadout, seed, formation = {}, options = {}) {
  const selected = rosterIds.filter((characterId) => characterById[characterId]).slice(0, PARTY_SIZE);
  const placed = normalizeFormation(formation, selected);
  const allies = selected.map((characterId) => allyInput(
    characterId,
    placed[characterId] ?? characterById[characterId].defaultPosition,
    loadout,
    options,
  ));
  return {
    schemaVersion: BATTLE_SCHEMA_VERSION,
    battleId: "expedition_" + String(seed).replace(/[^a-z0-9_]/gi, "_") + "_e" + composed.index,
    maxRounds: composed.maxRounds,
    objective: { type: "eliminate_all_enemies" },
    allies,
    enemies: composed.enemies.map((enemy) => ({
      instanceId: enemy.instanceId,
      enemyActorId: enemy.enemyActorId,
      position: enemy.position,
      stats: { ...enemy.stats },
      ...(enemy.mutations.length ? { mutations: [...enemy.mutations] } : {}),
    })),
  };
}

// ---------------------------------------------------------------- 序盤の敗北（R9 §2.1）
//
// **本当に負ける配置を、本当に走らせる。**演出で敗北を差し込まない
// （決定的 engine で結果が確定しているので、嘘をつく必要がない）。
// prologue の敵は12戦の梯子に属さないので、composeEncounter は通らない。
const scalePrologueEnemyStat = (value, bps = 10_000) => Math.max(
  0,
  Math.round(value * bps / 10_000),
);

export function prologueEncounter() {
  const scaling = PROLOGUE.enemyScaling ?? {};
  return {
    index: 0,
    act: 0,
    kind: "normal",
    name: PROLOGUE.name,
    description: PROLOGUE.description,
    bossLawId: null,
    bossLaw: null,
    maxRounds: PROLOGUE.maxRounds,
    budget: 0,
    spentThreat: 0,
    enemies: PROLOGUE.enemies.map((enemy) => {
      const definition = PLAYABLE_CONTENT.enemyActors[enemy.enemyActorId];
      const offenseBps = enemy.offenseBps ?? scaling.offenseBps;
      const stats = {
        maxHp: Math.max(1, scalePrologueEnemyStat(definition.maxHp, scaling.maxHpBps)),
        might: scalePrologueEnemyStat(definition.might ?? 0, offenseBps),
        focus: scalePrologueEnemyStat(definition.focus ?? 0, offenseBps),
        guard: definition.guard ?? 0,
      };
      return {
        instanceId: enemy.instanceId,
        enemyActorId: enemy.enemyActorId,
        position: enemy.position,
        stats,
        mutations: [],
        boss: false,
        reinforcement: false,
        threatCost: 0,
        baseStats: {
          ...stats,
        },
      };
    }),
  };
}

export function makePrologueBattle(statsFor, formation = PROLOGUE.formation) {
  const roster = [...PROLOGUE.rosterIds];
  return makeExpeditionBattle(
    prologueEncounter(), roster, prologueLoadout(roster), "prologue", formation, { statsFor },
  );
}

export function loadoutSummary(loadout, rosterIds) {
  return rosterIds.map((characterId) => ({
    characterId,
    tactics: loadout.tactics?.[characterId] ?? [],
    reactives: loadout.reactives?.[characterId] ?? [],
    equipment: loadout.equipment?.[characterId] ?? [],
  }));
}

export function allEncounters() {
  return clone(ENCOUNTERS);
}

// ============================================================ 次戦 exact preview（R8 §11）
//
// **preview と正式実行は、この一つの関数で BattleInput を組み立て、
// 同じ simulateBattle を呼ぶ。**（R8 §11.1「同じ入力の正式実行と完全一致させる」）
// 呼び出し側の違いは、この結果を `commitBattleResult`（progression.mjs）へ
// 渡すかどうかだけである。simulateBattle 自体は input/content を変更せず、
// Date も Math.random も使わない（docs/ARCHITECTURE.md §4）ので、この関数は
// **RunState を一切変更しない**。
//
// R14 §1 — **どの盤面を予測するかは呼び出し側が渡せる。**序盤の「灰の門」は
// 12戦の梯子に属さないので composeEncounter からは出てこない（prologueEncounter が
// 出す）。渡されなければ従来どおり encounterIndex から組む。
export function simulateNextBattle(run, profile, encounterIndex, options = {}) {
  const composed = options.composed
    ?? composeEncounter(encounterIndex, run.difficulty, { partySize: run.partySize });
  const loadout = run.loadout ?? freshLoadout(run.roster);
  const battleInput = makeExpeditionBattle(
    composed,
    run.roster,
    loadout,
    run.runSeed,
    run.formation,
    {
      hp: run.currentHp,
      statsFor: (characterId) => characterStats(profile, characterId),
      content: runContentBundle(run),
    },
  );
  const content = runContentBundle(run);
  const result = simulateBattle(battleInput, content);
  return { composed, battleInput, result, content };
}

function battleResultSummary(run, result) {
  const perCharacter = run.roster.map((characterId) => {
    const actor = result.actors.find((entry) => entry.instanceId === "a_" + characterId);
    // R14 §1 — 開始 HP も上限も **engine が返した値をそのまま使う**。
    // passive の max_hp 補正は engine の中で乗るので、ここで run.currentHp を
    // 読み直すと「満タンで入った回」の開始 HP が上限より低く出る。
    const startingHp = actor ? actor.startingHp : (run.currentHp?.[characterId] ?? 0);
    const endingHp = actor ? actor.hp : 0;
    return {
      characterId,
      maxHp: actor ? actor.maxHp : 0,
      startingHp,
      endingHp,
      // 予測の主役は残量ではなく**減少量**である（負なら回復して終わる）。
      hpLost: startingHp - endingHp,
      defeated: actor ? !actor.alive : true,
    };
  });
  return {
    result: result.result,
    reason: result.reason,
    roundsUsed: result.roundsUsed,
    perCharacter,
    metrics: result.metrics,
  };
}

// 無料・副作用なしの preview（R8 §11.1）。RunState を一切変更しない。
export function previewNextBattle(run, profile, encounterIndex, options = {}) {
  const { result } = simulateNextBattle(run, profile, encounterIndex, options);
  return battleResultSummary(run, result);
}

// 分離前の公開名を保つ。content/ 側が正で、ここは通り道。
export { ENEMY_TARGETING as enemyTargeting, SKILL_TREE_NODES, CHARACTER_DEFINITIONS };

