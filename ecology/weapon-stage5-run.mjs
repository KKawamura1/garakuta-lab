// Stage 5 h — game-facing operations for the first executable weapon-skill slice.

import {
  freshWeaponProfile,
  freshWeaponRun,
  validateWeaponRun,
} from "./weapon-save.mjs";
import {
  WEAPON_SKILL_NODES,
  addWeaponPrioritySkill,
  moveWeaponPrioritySkill,
  removeWeaponPrioritySkill,
  selectPrimaryWeaponSkill,
} from "./weapon-loadout.mjs";
import {
  makeWeaponPackManifest,
  WEAPON_SKILL_PACKS,
} from "./weapon-pack-manifest.mjs";
import {
  cancelWeaponSkillReservation,
  fulfillWeaponSkillReservations,
  grantWeaponSkillPointsForClear,
  reserveWeaponSkill,
  unlockWeaponSkill,
} from "./weapon-progression.mjs";
import {
  availableExecutableWeaponSkillNodeKeys,
} from "./weapon-skill-runtime.mjs";
import {
  STAGE_5_DEFAULT_PRIMARY_SKILL_BY_CHARACTER,
  STAGE_5_STARTER_SKILL_KEYS_BY_CHARACTER,
  STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} from "./weapon-skill-runtime-stage5.mjs";
import { freshWeaponRunBattleState } from "./weapon-run-battle-state.mjs";
import {
  clearUnavailableStage5Ultimate,
  toggleStage5Ultimate,
} from "./weapon-stage5-ultimate.mjs";

const CHARACTER_IDS = Object.keys(STAGE_5_STARTER_SKILL_KEYS_BY_CHARACTER);
const EXECUTABLE_NODE_KEYS = Object.freeze(availableExecutableWeaponSkillNodeKeys({
  schemaVersion: "ecology-weapon-pack-manifest-1",
  seed: "stage5-runtime-allowlist",
  enabledSkillPackIds: WEAPON_SKILL_PACKS.map(({ id }) => id),
  enabledEquipmentPackIds: [],
}, STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY));

function copyProgression(progression) {
  return {
    ...progression,
    unlockedSkillKeysByCharacter: Object.fromEntries(Object.entries(progression.unlockedSkillKeysByCharacter)
      .map(([id, keys]) => [id, [...keys]])),
    skillPointsByCharacter: { ...progression.skillPointsByCharacter },
    skillReservationByCharacter: { ...progression.skillReservationByCharacter },
    grantedSkillPointRewardKeys: [...progression.grantedSkillPointRewardKeys],
  };
}

function copyLoadout(loadout) {
  return {
    ...loadout,
    primarySkillByCharacter: { ...loadout.primarySkillByCharacter },
    reactivePriorityByCharacter: Object.fromEntries(Object.entries(loadout.reactivePriorityByCharacter)
      .map(([id, keys]) => [id, [...keys]])),
    targetPriorityByCharacter: Object.fromEntries(Object.entries(loadout.targetPriorityByCharacter)
      .map(([id, keys]) => [id, [...keys]])),
  };
}

function copyUltimateState(ultimateState) {
  return {
    ...ultimateState,
    selectedSkillKeyByCharacter: { ...ultimateState.selectedSkillKeyByCharacter },
    armedByCharacter: { ...ultimateState.armedByCharacter },
    spentCharacterIds: [...ultimateState.spentCharacterIds],
  };
}

function fail(reason, code = "invalid_stage5_run") {
  return { ok: false, reason, code };
}

function validActorIds(ids) {
  return Array.isArray(ids) && ids.length > 0 && ids.length <= 5
    && ids.every((id) => CHARACTER_IDS.includes(id)) && new Set(ids).size === ids.length;
}

function setDefaultLoadout(run, characterId) {
  const acquired = run.skillProgression.unlockedSkillKeysByCharacter[characterId];
  let result = selectPrimaryWeaponSkill(
    run.loadout, characterId, STAGE_5_DEFAULT_PRIMARY_SKILL_BY_CHARACTER[characterId],
    run.skillProgression.unlockedSkillKeysByCharacter,
  );
  if (!result.ok) throw new TypeError(result.reason);
  run.loadout = result.loadout;
  for (const key of acquired) {
    if (WEAPON_SKILL_NODES[key].kind !== "reactive") continue;
    result = addWeaponPrioritySkill(run.loadout, characterId, key, run.skillProgression.unlockedSkillKeysByCharacter);
    if (!result.ok) throw new TypeError(result.reason);
    run.loadout = result.loadout;
  }
}

export function createStage5WeaponProfile(profileId) {
  return freshWeaponProfile({
    profileId,
    unlockedSkillPackIds: WEAPON_SKILL_PACKS.map(({ id }) => id),
  });
}

export function createStage5WeaponRun({
  runId,
  profile,
  characterIds,
  seed,
  formationByCharacter = {},
  equipmentByCharacter = {},
  currentHpByCharacter = {},
} = {}) {
  if (!validActorIds(characterIds)) throw new TypeError("Stage 5の人物は本編の5人から重複なく指定してください。");
  const manifest = makeWeaponPackManifest(String(seed), profile.packUnlocks, {
    skillPackCount: WEAPON_SKILL_PACKS.length,
    equipmentPackCount: 0,
  });
  const run = freshWeaponRun({
    runId,
    profile,
    characterIds,
    partyCharacterIds: characterIds,
    seed: manifest.seed,
    manifest,
    startingSkillKeysByCharacter: STAGE_5_STARTER_SKILL_KEYS_BY_CHARACTER,
    formationByCharacter,
    equipmentByCharacter,
    currentHpByCharacter,
  });
  for (const id of characterIds) setDefaultLoadout(run, id);
  return run;
}

// Keep every joined character's acquired skills and loadout when the current
// party changes. Only `partyCharacterIds` determines who enters BattleInput.
export function syncStage5WeaponParty(run, {
  partyCharacterIds,
  formationByCharacter = run.battleState.formationByCharacter,
  equipmentByCharacter = run.battleState.equipmentByCharacter,
  currentHpByCharacter = run.battleState.currentHpByCharacter,
} = {}) {
  if (!validActorIds(partyCharacterIds)) return fail("Stage 5の編成は1〜5人の本編人物を指定してください。", "invalid_party");
  const characterIds = [...new Set([...run.characterIds, ...partyCharacterIds])];
  if (!validActorIds(characterIds)) return fail("Stage 5の累積参加者は本編の5人までです。", "invalid_roster");
  const next = structuredClone(run);
  const priorIds = new Set(run.characterIds);
  const progression = copyProgression(run.skillProgression);
  const loadout = copyLoadout(run.loadout);
  const ultimateState = copyUltimateState(run.ultimateState);
  for (const id of characterIds) {
    if (priorIds.has(id)) continue;
    progression.unlockedSkillKeysByCharacter[id] = [...STAGE_5_STARTER_SKILL_KEYS_BY_CHARACTER[id]];
    progression.skillPointsByCharacter[id] = 0;
    progression.skillReservationByCharacter[id] = null;
    loadout.primarySkillByCharacter[id] = null;
    loadout.reactivePriorityByCharacter[id] = [];
    loadout.targetPriorityByCharacter[id] = [];
    ultimateState.selectedSkillKeyByCharacter[id] = null;
    ultimateState.armedByCharacter[id] = false;
  }
  next.characterIds = characterIds;
  next.skillProgression = progression;
  next.loadout = loadout;
  next.ultimateState = ultimateState;
  next.battleState = freshWeaponRunBattleState(characterIds, {
    partyCharacterIds,
    formationByCharacter,
    equipmentByCharacter,
    currentHpByCharacter,
  });
  for (const id of partyCharacterIds) {
    if (next.loadout.primarySkillByCharacter[id]) continue;
    // New and returning participants retain skills; defaults are only seeded
    // when they have no active primary yet.
    const acquired = next.skillProgression.unlockedSkillKeysByCharacter[id];
    const defaultPrimary = STAGE_5_DEFAULT_PRIMARY_SKILL_BY_CHARACTER[id];
    if (acquired.includes(defaultPrimary)) {
      const result = selectPrimaryWeaponSkill(next.loadout, id, defaultPrimary, next.skillProgression.unlockedSkillKeysByCharacter);
      if (!result.ok) return result;
      next.loadout = result.loadout;
    }
    for (const key of acquired) {
      if (WEAPON_SKILL_NODES[key].kind !== "reactive" || next.loadout.reactivePriorityByCharacter[id].includes(key)) continue;
      const result = addWeaponPrioritySkill(next.loadout, id, key, next.skillProgression.unlockedSkillKeysByCharacter);
      if (!result.ok) return result;
      next.loadout = result.loadout;
    }
  }
  const validation = validateWeaponRun(next);
  if (!validation.valid) return fail(validation.errors[0].message, validation.errors[0].code);
  return { ok: true, run: next };
}

function applyAutomaticActions(run, actions) {
  let loadout = copyLoadout(run.loadout);
  for (const action of actions) {
    if (!action.target) continue;
    const node = WEAPON_SKILL_NODES[action.skillKey];
    if (node.kind === "active") {
      const selected = selectPrimaryWeaponSkill(loadout, action.characterId, action.skillKey,
        run.skillProgression.unlockedSkillKeysByCharacter);
      if (selected.ok) loadout = selected.loadout;
    } else if (node.kind === "reactive") {
      const equipped = addWeaponPrioritySkill(loadout, action.characterId, action.skillKey,
        run.skillProgression.unlockedSkillKeysByCharacter);
      if (equipped.ok) loadout = equipped.loadout;
    }
  }
  let next = { ...run, loadout };
  for (const characterId of run.characterIds) {
    next = clearUnavailableStage5Ultimate(next, characterId);
  }
  return next;
}

export function acquireStage5WeaponSkill(run, characterId, skillKey) {
  if (!EXECUTABLE_NODE_KEYS.includes(skillKey)) return fail("この段階で実行できるのは初期20節だけです。", "skill_not_executable");
  const acquired = unlockWeaponSkill(run.skillProgression, characterId, skillKey,
    availableExecutableWeaponSkillNodeKeys(run.manifest, STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY));
  if (!acquired.ok) return acquired;
  let next = { ...run, skillProgression: acquired.progression };
  next = applyAutomaticActions(next, [{ characterId, skillKey, target: true }]);
  return { ok: true, run: next };
}

export function reserveStage5WeaponSkill(run, characterId, skillKey) {
  if (!EXECUTABLE_NODE_KEYS.includes(skillKey)) return fail("この段階で実行できるのは初期20節だけです。", "skill_not_executable");
  const reserved = reserveWeaponSkill(run.skillProgression, characterId, skillKey,
    availableExecutableWeaponSkillNodeKeys(run.manifest, STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY));
  if (!reserved.ok) return reserved;
  let next = { ...run, skillProgression: reserved.progression };
  next = applyAutomaticActions(next, reserved.actions);
  return { ok: true, run: next, actions: reserved.actions, completed: reserved.completed };
}

export function cancelStage5WeaponSkillReservation(run, characterId) {
  const result = cancelWeaponSkillReservation(run.skillProgression, characterId);
  return result.ok ? { ok: true, run: { ...run, skillProgression: result.progression } } : result;
}

export function selectStage5Primary(run, characterId, skillKey) {
  if (skillKey !== null && !EXECUTABLE_NODE_KEYS.includes(skillKey)) return fail("この段階で実行できるのは初期20節だけです。", "skill_not_executable");
  const result = selectPrimaryWeaponSkill(run.loadout, characterId, skillKey,
    run.skillProgression.unlockedSkillKeysByCharacter);
  if (!result.ok) return result;
  const next = clearUnavailableStage5Ultimate({ ...run, loadout: result.loadout }, characterId);
  return { ok: true, run: next };
}

export function addStage5Reactive(run, characterId, skillKey) {
  if (!EXECUTABLE_NODE_KEYS.includes(skillKey)) return fail("この段階で実行できるのは初期20節だけです。", "skill_not_executable");
  const result = addWeaponPrioritySkill(run.loadout, characterId, skillKey,
    run.skillProgression.unlockedSkillKeysByCharacter);
  return result.ok ? { ok: true, run: { ...run, loadout: result.loadout } } : result;
}

export function removeStage5Priority(run, characterId, skillKey) {
  if (!EXECUTABLE_NODE_KEYS.includes(skillKey)) return fail("この段階で実行できるのは初期20節だけです。", "skill_not_executable");
  const result = removeWeaponPrioritySkill(run.loadout, characterId, skillKey);
  if (!result.ok) return result;
  const next = clearUnavailableStage5Ultimate({ ...run, loadout: result.loadout }, characterId);
  return { ok: true, run: next };
}

export function toggleStage5WeaponUltimate(run, characterId, skillKey) {
  return toggleStage5Ultimate(run, characterId, skillKey);
}

export function moveStage5Priority(run, characterId, kind, fromIndex, toIndex) {
  const key = run.loadout[`${kind}PriorityByCharacter`]?.[characterId]?.[fromIndex];
  if (!EXECUTABLE_NODE_KEYS.includes(key)) return fail("この段階で実行できるのは初期20節だけです。", "skill_not_executable");
  const result = moveWeaponPrioritySkill(run.loadout, characterId, kind, fromIndex, toIndex);
  return result.ok ? { ok: true, run: { ...run, loadout: result.loadout } } : result;
}

export function grantStage5SkillPointsForClear(run, clearKey, amount = 1) {
  const activeIds = new Set(run.battleState.partyCharacterIds);
  const available = availableExecutableWeaponSkillNodeKeys(run.manifest, STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY);
  const grant = grantWeaponSkillPointsForClear(run.skillProgression, clearKey, amount, available);
  if (!grant.ok) return grant;
  if (!grant.granted) return { ...grant, run };
  const prior = run.skillProgression;
  const progression = copyProgression(grant.progression);
  for (const id of run.characterIds) {
    if (activeIds.has(id)) continue;
    progression.skillPointsByCharacter[id] = prior.skillPointsByCharacter[id];
    progression.skillReservationByCharacter[id] = prior.skillReservationByCharacter[id];
    progression.unlockedSkillKeysByCharacter[id] = [...prior.unlockedSkillKeysByCharacter[id]];
  }
  let next = { ...run, skillProgression: progression };
  next = applyAutomaticActions(next, grant.actions.filter(({ characterId }) => activeIds.has(characterId)));
  return { ...grant, progression, run: next };
}

export function fulfillStage5SkillReservations(run) {
  const activeIds = new Set(run.battleState.partyCharacterIds);
  const available = availableExecutableWeaponSkillNodeKeys(run.manifest, STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY);
  const prior = run.skillProgression;
  const fulfilled = fulfillWeaponSkillReservations(prior, available);
  if (!fulfilled.ok) return fulfilled;
  const progression = copyProgression(fulfilled.progression);
  for (const id of run.characterIds) {
    if (activeIds.has(id)) continue;
    progression.skillPointsByCharacter[id] = prior.skillPointsByCharacter[id];
    progression.skillReservationByCharacter[id] = prior.skillReservationByCharacter[id];
    progression.unlockedSkillKeysByCharacter[id] = [...prior.unlockedSkillKeysByCharacter[id]];
  }
  let next = { ...run, skillProgression: progression };
  next = applyAutomaticActions(next, fulfilled.actions.filter(({ characterId }) => activeIds.has(characterId)));
  return { ok: true, run: next, actions: fulfilled.actions.filter(({ characterId }) => activeIds.has(characterId)),
    completed: fulfilled.completed.filter(({ characterId }) => activeIds.has(characterId)) };
}
