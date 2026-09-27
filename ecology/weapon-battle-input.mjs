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
import { STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY } from "./weapon-skill-runtime-stage5.mjs";

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
    // Initial R/A1 has no target-priority node. Keep the save vocabulary for
    // later stages, but fail closed until a target node has engine semantics.
    if (run.loadout.targetPriorityByCharacter[characterId].length) {
      throw new TypeError(`Stage 5初期範囲ではtarget優先列を実行できません: ${characterId}`);
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

export function buildWeaponBattleInput({
  run,
  profile,
  composed,
  statsFor,
  contentBundle = PLAYABLE_CONTENT,
  runtimeRegistry = STAGE_5_STARTER_WEAPON_SKILL_RUNTIME_REGISTRY,
} = {}) {
  const executable = checkedRun(run, profile, runtimeRegistry);
  if (!composed || !Number.isSafeInteger(composed.index) || !Number.isSafeInteger(composed.maxRounds)
    || !Array.isArray(composed.enemies)) {
    throw new TypeError("BattleInputには確定済みEncounterが必要です。");
  }

  const compiledContent = compileWeaponSkillRuntimeContent(contentBundle, runtimeRegistry);
  const loadout = emptyLegacyLoadout(run.characterIds);
  const currentHp = {};
  for (const characterId of run.characterIds) {
    loadout.equipment[characterId] = run.battleState.equipmentByCharacter[characterId]
      .map(({ equipmentId }) => equipmentId);
    const hp = run.battleState.currentHpByCharacter[characterId];
    if (hp !== null) currentHp[characterId] = hp;
  }

  const seed = `${run.runId}_${run.manifest.seed}`;
  const battleInput = makeExpeditionBattle(
    composed,
    run.characterIds,
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
    const { activeSkillId, passiveSkillIds, reactiveSkillIds } = newRunPrimaryAndPassives(run, characterId);
    const acquired = run.skillProgression.unlockedSkillKeysByCharacter[characterId];
    if (!executable.has(run.loadout.primarySkillByCharacter[characterId])
      || acquired.some((nodeKey) => !executable.has(nodeKey))) {
      throw new TypeError(`取得技能が実行registryの範囲外です: ${characterId}`);
    }
    ally.tactics = [{ activeSkillId, useWhen: [] }];
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
    result: simulateBattle(battleInput, contentBundle, engineOptions),
  };
}

// Forecast and committed resolution intentionally share the same function.
export const forecastWeaponBattle = simulateWeaponBattle;
