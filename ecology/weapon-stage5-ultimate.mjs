// Stage 5 — expedition-scoped ultimate designations on the weapon Run.
// Selection is a node key; engine IDs exist only at the BattleInput boundary.

import { PLAYABLE_CONTENT } from "./playable-content.mjs";
import { ascendSkill, ultimateFirings, ultimateIdFor, ultimateTraitLabels } from "./ultimates.mjs";
import { WEAPON_SKILL_NODES } from "./weapon-loadout.mjs";
import { compileWeaponSkillRuntimeContent, weaponSkillRuntimeId } from "./weapon-skill-runtime.mjs";
import { STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-stage5.mjs";

export const STAGE5_ULTIMATE_STATE_SCHEMA_VERSION = "ecology-weapon-stage5-ultimate-1";

const BASE_CONTENT = compileWeaponSkillRuntimeContent(
  PLAYABLE_CONTENT,
  STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mapHasExactKeys(value, characterIds) {
  return isRecord(value)
    && Object.keys(value).length === characterIds.length
    && characterIds.every((id) => Object.hasOwn(value, id));
}

export function freshStage5UltimateState(characterIds = []) {
  return {
    schemaVersion: STAGE5_ULTIMATE_STATE_SCHEMA_VERSION,
    selectedSkillKeyByCharacter: Object.fromEntries(characterIds.map((id) => [id, null])),
    armedByCharacter: Object.fromEntries(characterIds.map((id) => [id, false])),
    spentCharacterIds: [],
  };
}

export function stage5UltimateCandidate(run, characterId, skillKey, {
  contentBundle = PLAYABLE_CONTENT,
  runtimeRegistry = STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} = {}) {
  const node = WEAPON_SKILL_NODES[skillKey];
  const acquired = run?.skillProgression?.unlockedSkillKeysByCharacter?.[characterId] ?? [];
  const primary = run?.loadout?.primarySkillByCharacter?.[characterId];
  const reactive = run?.loadout?.reactivePriorityByCharacter?.[characterId] ?? [];
  const selected = node?.kind === "active" ? primary === skillKey
    : node?.kind === "reactive" ? reactive.includes(skillKey) : false;
  if (!node || !acquired.includes(skillKey) || !selected) return null;
  const runtimeSkillId = weaponSkillRuntimeId(skillKey);
  const content = contentBundle === PLAYABLE_CONTENT && runtimeRegistry === STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY
    ? BASE_CONTENT
    : compileWeaponSkillRuntimeContent(contentBundle, runtimeRegistry);
  const ascended = ascendSkill(content, runtimeSkillId);
  if (!ascended) return null;
  return {
    skillKey,
    runtimeSkillId,
    ultimateSkillId: ultimateIdFor(runtimeSkillId),
    kind: node.kind,
    traits: ascended.traits,
    traitLabels: ultimateTraitLabels(ascended.traits),
  };
}

export function validateStage5UltimateState(ultimateState, {
  characterIds = [],
  skillProgression,
  loadout,
} = {}) {
  const errors = [];
  const add = (code, path, message) => errors.push({ code, path, message });
  if (!isRecord(ultimateState)) {
    add("invalid_ultimate_state", "$", "必殺技stateはオブジェクトである必要があります。");
    return { valid: false, errors };
  }
  if (ultimateState.schemaVersion !== STAGE5_ULTIMATE_STATE_SCHEMA_VERSION) {
    add("unsupported_ultimate_version", "schemaVersion", "対応していない必殺技state形式です。");
  }
  const allowed = new Set(["schemaVersion", "selectedSkillKeyByCharacter", "armedByCharacter", "spentCharacterIds"]);
  for (const key of Object.keys(ultimateState)) {
    if (!allowed.has(key)) add("unknown_ultimate_state_field", key, "この必殺技state形式にない欄です。");
  }
  if (!mapHasExactKeys(ultimateState.selectedSkillKeyByCharacter, characterIds)) {
    add("invalid_ultimate_selection_map", "selectedSkillKeyByCharacter", "人物ごとの必殺技能欄がRunの人物一覧と一致しません。");
  }
  if (!mapHasExactKeys(ultimateState.armedByCharacter, characterIds)) {
    add("invalid_ultimate_armed_map", "armedByCharacter", "人物ごとの構え欄がRunの人物一覧と一致しません。");
  }
  if (!Array.isArray(ultimateState.spentCharacterIds)
    || new Set(ultimateState.spentCharacterIds).size !== ultimateState.spentCharacterIds.length
    || ultimateState.spentCharacterIds.some((id) => !characterIds.includes(id))) {
    add("invalid_ultimate_spent_characters", "spentCharacterIds", "使用済み人物はRunの人物一覧から重複なく指定してください。");
  }
  if (mapHasExactKeys(ultimateState.selectedSkillKeyByCharacter, characterIds)
    && mapHasExactKeys(ultimateState.armedByCharacter, characterIds)) {
    const spent = new Set(Array.isArray(ultimateState.spentCharacterIds) ? ultimateState.spentCharacterIds : []);
    for (const characterId of characterIds) {
      const skillKey = ultimateState.selectedSkillKeyByCharacter[characterId];
      const armed = ultimateState.armedByCharacter[characterId];
      if (skillKey !== null && typeof skillKey !== "string") {
        add("invalid_ultimate_skill_key", `selectedSkillKeyByCharacter.${characterId}`, "必殺技能はnode keyかnullである必要があります。");
      } else if (skillKey !== null) {
        const view = {
          skillProgression,
          loadout,
        };
        if (!stage5UltimateCandidate(view, characterId, skillKey)) {
          add("invalid_ultimate_candidate", `selectedSkillKeyByCharacter.${characterId}`, "必殺技には現在装着中の実装済みactive/reactiveを指定してください。");
        }
      }
      if (typeof armed !== "boolean") {
        add("invalid_ultimate_armed", `armedByCharacter.${characterId}`, "構え欄はbooleanである必要があります。");
      } else if (armed && (!skillKey || spent.has(characterId))) {
        add("invalid_ultimate_armed", `armedByCharacter.${characterId}`, "構えるには未使用の必殺技能指定が必要です。");
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function toggleStage5Ultimate(run, characterId, skillKey) {
  const state = run?.ultimateState;
  if (!state || !run.characterIds.includes(characterId)) {
    return { ok: false, code: "invalid_ultimate_character", reason: "この人物はweapon Runにいません。" };
  }
  const spent = state.spentCharacterIds.includes(characterId);
  const selected = state.selectedSkillKeyByCharacter[characterId];
  if (selected === skillKey && (state.armedByCharacter[characterId] || spent)) {
    const nextState = structuredClone(state);
    nextState.selectedSkillKeyByCharacter[characterId] = null;
    nextState.armedByCharacter[characterId] = false;
    return { ok: true, run: { ...run, ultimateState: nextState }, skillKey: null, armed: false };
  }
  if (spent) {
    return { ok: false, code: "ultimate_spent", reason: "この仲間は、この遠征ではもう必殺技を放っています。" };
  }
  const candidate = stage5UltimateCandidate(run, characterId, skillKey);
  if (!candidate) {
    return { ok: false, code: "invalid_ultimate_candidate", reason: "必殺技にできるのは装着中の実装済みactive/reactiveだけです。" };
  }
  const nextState = structuredClone(state);
  nextState.selectedSkillKeyByCharacter[characterId] = skillKey;
  nextState.armedByCharacter[characterId] = true;
  return { ok: true, run: { ...run, ultimateState: nextState }, skillKey, armed: true, candidate };
}

export function settleStage5UltimateFirings(run, result) {
  if (result?.result !== "win") return { run, spentCharacterIds: [] };
  const firedActorIds = new Set(ultimateFirings(result));
  const nextState = structuredClone(run.ultimateState);
  const spentCharacterIds = [];
  for (const characterId of run.characterIds) {
    if (!firedActorIds.has("a_" + characterId)
      || nextState.armedByCharacter[characterId] !== true
      || !nextState.selectedSkillKeyByCharacter[characterId]
      || nextState.spentCharacterIds.includes(characterId)) continue;
    nextState.spentCharacterIds.push(characterId);
    nextState.armedByCharacter[characterId] = false;
    spentCharacterIds.push(characterId);
  }
  return {
    run: spentCharacterIds.length ? { ...run, ultimateState: nextState } : run,
    spentCharacterIds,
  };
}

export function clearUnavailableStage5Ultimate(run, characterId) {
  const skillKey = run?.ultimateState?.selectedSkillKeyByCharacter?.[characterId];
  if (!skillKey || stage5UltimateCandidate(run, characterId, skillKey)) return run;
  const ultimateState = structuredClone(run.ultimateState);
  ultimateState.selectedSkillKeyByCharacter[characterId] = null;
  ultimateState.armedByCharacter[characterId] = false;
  return { ...run, ultimateState };
}
