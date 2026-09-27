// Stage 5g — compile a versioned weapon Run into the engine's one BattleInput.
// Live resolution and forecast deliberately call the same builder and engine.

import { validateBattleInput } from "./validate.mjs";
import { simulateBattle } from "./engine.mjs";
import { PLAYABLE_CONTENT } from "./content/index.mjs";
import { maxHpWithStaticBonuses } from "./static-bonuses.mjs";
import { makeExpeditionBattle, freshLoadout, CHARACTER_OPTIONS } from "./playable-battles.mjs";
import { WEAPON_SKILL_NODES } from "./weapon-loadout.mjs";
import { availableWeaponSkillNodeKeys } from "./weapon-pack-manifest.mjs";
import { validateWeaponRun } from "./weapon-save.mjs";
import {
  availableExecutableWeaponSkillNodeKeys,
  compileWeaponSkillRuntimeContent,
  weaponSkillRuntimeId,
} from "./weapon-skill-runtime.mjs";
import { STAGE_6_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-stage6.mjs";
import { ultimateFirings, withUltimates } from "./ultimates.mjs";
import { stage5UltimateCandidate } from "./weapon-stage5-ultimate.mjs";

const CHARACTER_ID_SET = new Set(CHARACTER_OPTIONS.map(({ id }) => id));

function checkedRun(run, profile, registry) {
  const validation = validateWeaponRun(run, { profile });
  if (!validation.valid) {
    throw new TypeError(validation.errors.map(({ path, message }) => `${path}: ${message}`).join("\n"));
  }
  if (run.characterIds.length > 5 || run.characterIds.some((id) => !CHARACTER_ID_SET.has(id))) {
    throw new TypeError("BattleInputには本編の人物IDを5人まで指定できます。");
  }

  const manifestAvailable = new Set(availableWeaponSkillNodeKeys(run.manifest));
  const executable = new Set(availableExecutableWeaponSkillNodeKeys(run.manifest, registry));
  for (const characterId of run.characterIds) {
    const acquired = run.skillProgression.unlockedSkillKeysByCharacter[characterId] ?? [];
    for (const nodeKey of acquired) {
      if (!manifestAvailable.has(nodeKey)) {
        throw new TypeError(`取得済み技能がManifestにありません: ${characterId}.${nodeKey}`);
      }
      if (!executable.has(nodeKey)) {
        throw new TypeError(`未実装の武器技能はBattleInputにできません: ${characterId}.${nodeKey}`);
      }
    }
  }
  const partyCharacterIds = run.battleState.partyCharacterIds;
  for (const characterId of partyCharacterIds) {
    const primary = run.loadout.primarySkillByCharacter[characterId];
    if (!primary) throw new TypeError(`主軸技能を選んでください: ${characterId}`);
    if (!executable.has(primary) || !run.skillProgression.unlockedSkillKeysByCharacter[characterId].includes(primary)) {
      throw new TypeError(`主軸技能はManifestで利用できる実装済み取得技能に限ります: ${characterId}.${primary}`);
    }
    if (WEAPON_SKILL_NODES[primary]?.kind !== "active") {
      throw new TypeError(`主軸技能はactiveだけを指定できます: ${characterId}.${primary}`);
    }
    for (const key of run.loadout.reactivePriorityByCharacter[characterId]) {
      if (!executable.has(key)) throw new TypeError(`未実装のreactive技能は装備できません: ${characterId}.${key}`);
    }
    for (const key of run.loadout.targetPriorityByCharacter[characterId]) {
      if (!executable.has(key)) throw new TypeError(`未実装のtarget技能は装備できません: ${characterId}.${key}`);
    }
  }
  return executable;
}

function emptyLegacyLoadout(characterIds) {
  const loadout = freshLoadout(characterIds);
  for (const characterId of characterIds) {
    loadout.tactics[characterId] = [];
    loadout.reactives[characterId] = [];
    loadout.passives[characterId] = [];
    loadout.equipment[characterId] = [];
  }
  return loadout;
}

function newRunEquipment(run, characterId, content) {
  const saved = run.battleState.equipmentByCharacter[characterId];
  return saved.map((item, index) => {
    const definition = content.equipment[item.equipmentId];
    if (!definition) throw new TypeError(`装備の定義がBattle contentにありません: ${item.equipmentId}`);
    const maximum = definition.maxDurability ?? 1;
    if (item.durability > maximum) {
      throw new TypeError(`装備の耐久が定義上限を超えています: ${item.instanceId}`);
    }
    return { ...item, slot: index };
  });
}

function newRunPrimaryAndPassives(run, characterId) {
  const unlocked = run.skillProgression.unlockedSkillKeysByCharacter[characterId];
  const activeSkillId = weaponSkillRuntimeId(run.loadout.primarySkillByCharacter[characterId]);
  const passiveSkillIds = unlocked
    .filter((nodeKey) => WEAPON_SKILL_NODES[nodeKey].kind === "passive")
    .map(weaponSkillRuntimeId);
  const reactiveSkillIds = run.loadout.reactivePriorityByCharacter[characterId]
    .map(weaponSkillRuntimeId);
  return { activeSkillId, passiveSkillIds, reactiveSkillIds };
}

function withTargetPriority(content, characterId, targetNodeKeys, activeSkillIds, runtimeRegistry) {
  if (targetNodeKeys.length === 0) return { content, skillIds: activeSkillIds };
  const prioritySorts = targetNodeKeys.flatMap((nodeKey) => {
    const query = runtimeRegistry.entries[nodeKey]?.definition?.query;
    if (!query || query.scope !== "enemies") {
      throw new TypeError(`target技能のruntime queryがありません: ${characterId}.${nodeKey}`);
    }
    return (query.sort ?? []).map((sort) => sort.type ?? sort);
  });
  const activeSkills = { ...content.activeSkills };
  const skillIds = activeSkillIds.map((skillId) => {
    const source = activeSkills[skillId];
    if (!source?.targetQuery) throw new TypeError(`target優先を適用できるactive技能がありません: ${skillId}`);
    const targetedId = `${skillId}.target_${characterId}`;
    activeSkills[targetedId] = {
      ...source,
      id: targetedId,
      targetQuery: {
        ...source.targetQuery,
        sort: [...prioritySorts, ...(source.targetQuery.sort ?? []).map((sort) => sort.type ?? sort)],
      },
    };
    return targetedId;
  });
  return {
    content: Object.freeze({ ...content, activeSkills: Object.freeze(activeSkills) }),
    skillIds,
  };
}

export function buildWeaponBattleInput({
  run,
  profile,
  composed,
  statsFor,
  contentBundle = PLAYABLE_CONTENT,
  runtimeRegistry = STAGE_6_WEAPON_SKILL_RUNTIME_REGISTRY,
} = {}) {
  const executable = checkedRun(run, profile, runtimeRegistry);
  if (!composed || !Number.isSafeInteger(composed.index) || !Number.isSafeInteger(composed.maxRounds)
    || !Array.isArray(composed.enemies)) {
    throw new TypeError("BattleInputには確定済みEncounterが必要です。");
  }

  const partyCharacterIds = run.battleState.partyCharacterIds;
  const armedUltimates = Object.fromEntries(partyCharacterIds.flatMap((characterId) => {
    if (run.ultimateState.armedByCharacter[characterId] !== true) return [];
    const skillKey = run.ultimateState.selectedSkillKeyByCharacter[characterId];
    const candidate = stage5UltimateCandidate(run, characterId, skillKey, { contentBundle, runtimeRegistry });
    if (!candidate) throw new TypeError(`必殺技の指定は装着中の実装済み技能に限ります: ${characterId}.${skillKey}`);
    return [[characterId, candidate]];
  }));
  const compiledBaseContent = compileWeaponSkillRuntimeContent(contentBundle, runtimeRegistry);
  let compiledContent = withUltimates(
    compiledBaseContent,
    Object.values(armedUltimates).map(({ runtimeSkillId }) => runtimeSkillId),
  );
  const activeSkillIdsByCharacter = {};
  const ultimateSkillIdsByCharacter = {};
  for (const characterId of partyCharacterIds) {
    const primaryId = weaponSkillRuntimeId(run.loadout.primarySkillByCharacter[characterId]);
    const ultimate = armedUltimates[characterId];
    const actionSkillIds = [
      ...(ultimate?.kind === "active" ? [ultimate.ultimateSkillId] : []),
      primaryId,
    ];
    const targeted = withTargetPriority(
      compiledContent,
      characterId,
      run.loadout.targetPriorityByCharacter[characterId],
      actionSkillIds,
      runtimeRegistry,
    );
    compiledContent = targeted.content;
    let cursor = 0;
    if (ultimate?.kind === "active") ultimateSkillIdsByCharacter[characterId] = targeted.skillIds[cursor++];
    activeSkillIdsByCharacter[characterId] = targeted.skillIds[cursor];
  }
  const loadout = emptyLegacyLoadout(partyCharacterIds);
  const currentHp = {};
  for (const characterId of partyCharacterIds) {
    loadout.equipment[characterId] = run.battleState.equipmentByCharacter[characterId]
      .map(({ equipmentId }) => equipmentId);
    const hp = run.battleState.currentHpByCharacter[characterId];
    if (hp !== null) currentHp[characterId] = hp;
  }

  const seed = `${run.runId}_${run.manifest.seed}`;
  const battleInput = makeExpeditionBattle(
    composed,
    partyCharacterIds,
    loadout,
    seed,
    run.battleState.formationByCharacter,
    {
      content: compiledContent,
      statsFor,
      hp: currentHp,
    },
  );

  for (const ally of battleInput.allies) {
    const characterId = ally.characterId;
    const { activeSkillId, passiveSkillIds, reactiveSkillIds: baseReactiveSkillIds } = newRunPrimaryAndPassives(run, characterId);
    const ultimate = armedUltimates[characterId];
    const reactiveIndex = ultimate?.kind === "reactive"
      ? baseReactiveSkillIds.indexOf(ultimate.runtimeSkillId)
      : -1;
    const reactiveSkillIds = reactiveIndex >= 0
      ? [
        ...baseReactiveSkillIds.slice(0, reactiveIndex),
        ultimate.ultimateSkillId,
        ...baseReactiveSkillIds.slice(reactiveIndex),
      ]
      : baseReactiveSkillIds;
    const acquired = run.skillProgression.unlockedSkillKeysByCharacter[characterId];
    if (!executable.has(run.loadout.primarySkillByCharacter[characterId])
      || acquired.some((nodeKey) => !executable.has(nodeKey))) {
      throw new TypeError(`取得技能が実行registryの範囲外です: ${characterId}`);
    }
    ally.tactics = ultimate?.kind === "active"
      ? [
        { activeSkillId: ultimateSkillIdsByCharacter[characterId], useWhen: [] },
        { activeSkillId: activeSkillIdsByCharacter[characterId], useWhen: [] },
      ]
      : [{ activeSkillId: activeSkillIdsByCharacter[characterId], useWhen: [] }];
    ally.passiveSkillIds = passiveSkillIds;
    ally.reactiveSkillIds = reactiveSkillIds;
    ally.equipment = newRunEquipment(run, characterId, compiledContent).map(({ slot, ...item }) => item);

    const savedHp = run.battleState.currentHpByCharacter[characterId];
    if (savedHp !== null) {
      const maxHp = maxHpWithStaticBonuses(
        ally.stats?.maxHp ?? compiledContent.characters[characterId].maxHp,
        compiledContent,
        ally.passiveSkillIds,
        ally.equipment.map((item) => ({ ...item, broken: item.durability === 0 })),
      );
      if (savedHp > maxHp) {
        throw new TypeError(`保存HPが現在のmaxHPを超えています: ${characterId}.${savedHp}>${maxHp}`);
      }
      ally.hp = savedHp;
    }
  }

  const inputIssues = validateBattleInput(battleInput, compiledContent);
  if (inputIssues.length) {
    throw new TypeError(inputIssues.map(({ path, message }) => `${path}: ${message}`).join("\n"));
  }
  return { battleInput, contentBundle: compiledContent };
}

export function simulateWeaponBattle(options, engineOptions) {
  const { battleInput, contentBundle } = buildWeaponBattleInput(options);
  return {
    battleInput,
    contentBundle,
    result: (() => {
      const result = simulateBattle(battleInput, contentBundle, engineOptions);
      const partyCharacterIds = options.run.battleState.partyCharacterIds;
      return {
        ...result,
        ultimateFiredBy: ultimateFirings(result)
          .map((instanceId) => instanceId.replace(/^a_/, ""))
          .filter((characterId) => partyCharacterIds.includes(characterId)),
      };
    })(),
  };
}

// Forecast and committed resolution intentionally share the same function.
export const forecastWeaponBattle = simulateWeaponBattle;
