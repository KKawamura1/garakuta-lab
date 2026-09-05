// ecology/blueprints.mjs
//
// **Phase C の Blueprint archive。R8 §3.6、Implementation Phase 4 step 4。**
//
// Blueprint は「もう一度あの品を作れる紙」であって、品そのものではない。だから
//
//   - **immutable。** 同じ canonical descriptor は重複させず、取得履歴だけを足す。
//   - **archive に所持上限を設けない。** 制限が掛かるのは持込枠だけ。
//   - **exact に保存する。** descriptor と全 rule と resolved parameter と来歴を持ち、
//     遠征開始時にその写しを再製造する。seed から作り直すのではない
//     （generator の版が動いたときに、保存した品が別物になるのを防ぐ）。
//   - **互換不能でも消さない。** 現行 content で検証に落ちる Blueprint は
//     disabledReason を付けて残す。
//
// ここは画面を知らない。ProfileState の一区画として、入力から出力を作るだけにする。

import { validateContentBundle } from "./validate.mjs";
import { PLAYABLE_CONTENT } from "./content/index.mjs";
import { RARITIES } from "./content/affixes.mjs";
import { GENERATOR_VERSION } from "./equipment-gen.mjs";

export const BLUEPRINT_ARCHIVE_VERSION = "ecology-blueprint-1";

// R8 §3.7 —「Blueprint持込枠 4,000 / 20,000 / 100,000 / 500,000」。初期1、最大5。
export const BLUEPRINT_BASE_CAPACITY = 1;
export const BLUEPRINT_MAX_CAPACITY = 5;
export const BLUEPRINT_CAPACITY_COSTS = Object.freeze(["4000", "20000", "100000", "500000"]);
export const BLUEPRINT_CAPACITY_UPGRADE_ID = "blueprint_capacity";

// R8 §10.3 — 勝利は最大2件、安全撤退はそのrunの新規取得候補から最大2件、敗北は最大1件。
export const BLUEPRINT_SAVE_LIMIT = Object.freeze({ won: 2, retreat: 2, lost: 1 });

function hash(value) {
  let a = 2166136261;
  for (const character of String(value)) {
    a = Math.imul(a ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return a.toString(16).padStart(8, "0");
}

export function blueprintIdFor(descriptor) {
  return "bp_" + hash(descriptor) + hash(String(descriptor).length + ":" + descriptor.slice(-16));
}

export function newArchive() {
  return { schemaVersion: BLUEPRINT_ARCHIVE_VERSION, entries: [], carrySelection: [] };
}

// **未知の欄は落とし、足りない欄は生やす。** 版が違う archive は捨てるのではなく、
// 読める entry だけを引き継ぐ（保存した品が黙って消えるのが一番困る）。
export function normalizeArchive(saved) {
  const archive = newArchive();
  if (!saved || typeof saved !== "object") return archive;
  const entries = Array.isArray(saved.entries) ? saved.entries : [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const descriptor = typeof entry.descriptor === "string" ? entry.descriptor : null;
    const definition = entry.definition;
    if (!descriptor || !definition || typeof definition !== "object") continue;
    if (typeof definition.id !== "string" || !Array.isArray(definition.rules)) continue;
    if (seen.has(descriptor)) continue;
    seen.add(descriptor);
    archive.entries.push({
      blueprintId: typeof entry.blueprintId === "string" ? entry.blueprintId : blueprintIdFor(descriptor),
      descriptor,
      rarity: typeof entry.rarity === "string" ? entry.rarity : "common",
      definition: structuredClone(definition),
      provenance: entry.provenance ? structuredClone(entry.provenance) : {},
      readout: entry.readout ? structuredClone(entry.readout) : null,
      acquisitions: Array.isArray(entry.acquisitions) ? entry.acquisitions.slice(-20) : [],
      favorite: entry.favorite === true,
    });
  }
  archive.carrySelection = Array.isArray(saved.carrySelection)
    ? saved.carrySelection.filter((id) => archive.entries.some((entry) => entry.blueprintId === id))
    : [];
  return archive;
}

// R8 §3.6 —「同じdescriptorは重複品にせず取得履歴を追加できる。」
export function saveBlueprint(archive, item, acquisition = {}) {
  const base = archive ?? newArchive();
  const descriptor = item.descriptor;
  const record = {
    runId: acquisition.runId ?? null,
    encounterIndex: acquisition.encounterIndex ?? null,
    campaignStageId: acquisition.campaignStageId ?? null,
    outcome: acquisition.outcome ?? null,
    characterId: acquisition.characterId ?? null,
    at: acquisition.at ?? null,
  };
  const index = base.entries.findIndex((entry) => entry.descriptor === descriptor);
  const entries = [...base.entries];
  if (index >= 0) {
    entries[index] = {
      ...entries[index],
      acquisitions: [...entries[index].acquisitions, record].slice(-20),
    };
    return { archive: { ...base, entries }, blueprintId: entries[index].blueprintId, added: false };
  }
  const blueprintId = blueprintIdFor(descriptor);
  entries.push({
    blueprintId,
    descriptor,
    rarity: item.rarity,
    definition: structuredClone(item.definition),
    provenance: structuredClone(item.provenance ?? {}),
    readout: item.readout ? structuredClone(item.readout) : null,
    acquisitions: [record],
    favorite: false,
  });
  return { archive: { ...base, entries }, blueprintId, added: true };
}

export function blueprintById(archive, blueprintId) {
  return (archive?.entries ?? []).find((entry) => entry.blueprintId === blueprintId) ?? null;
}

export function toggleFavorite(archive, blueprintId) {
  const entries = (archive?.entries ?? []).map((entry) =>
    entry.blueprintId === blueprintId ? { ...entry, favorite: !entry.favorite } : entry);
  return { ...(archive ?? newArchive()), entries };
}

// ---------------------------------------------------------------- 互換性
//
// **generator の版が違うだけでは無効にしない。** 保存してあるのは resolved な
// 定義そのものなので、現行 content で検証を通るなら、そのまま動く。
// 落ちたときだけ理由を出す（R8 §3.6「disabledReasonを表示する」）。
export function blueprintCompatibility(blueprint) {
  if (!blueprint) return { ok: false, disabledReason: "この Blueprint は archive にありません。" };
  const definition = blueprint.definition;
  const bundle = { ...PLAYABLE_CONTENT, equipment: { [definition.id]: definition } };
  const errors = validateContentBundle(bundle).filter((error) => error.path.startsWith("equipment."));
  if (!errors.length) return { ok: true, disabledReason: null };
  const staleGenerator = blueprint.provenance?.generatorVersion
    && blueprint.provenance.generatorVersion !== GENERATOR_VERSION;
  return {
    ok: false,
    disabledReason: (staleGenerator ? `古い generator（${blueprint.provenance.generatorVersion}）で作られた品です。` : "")
      + `現行の content 契約では作れません：${errors[0].code}（${errors[0].path}）`,
  };
}

// ---------------------------------------------------------------- 持込枠
export function carryCapacity(upgradeLevel = 0) {
  return Math.min(BLUEPRINT_MAX_CAPACITY, BLUEPRINT_BASE_CAPACITY + Math.max(0, Math.floor(upgradeLevel)));
}

// 選択を枠へ丸める。**無効な Blueprint は持込まない**（持込枠を無駄に埋めない）。
export function normalizeCarrySelection(archive, capacity) {
  const chosen = [];
  for (const blueprintId of archive?.carrySelection ?? []) {
    if (chosen.length >= capacity) break;
    const entry = blueprintById(archive, blueprintId);
    if (!entry) continue;
    if (!blueprintCompatibility(entry).ok) continue;
    if (chosen.includes(blueprintId)) continue;
    chosen.push(blueprintId);
  }
  return chosen;
}

export function setCarrySelection(archive, blueprintIds, capacity) {
  const next = { ...(archive ?? newArchive()), carrySelection: [...new Set(blueprintIds ?? [])] };
  return { ...next, carrySelection: normalizeCarrySelection(next, capacity) };
}

// R8 §3.6 —「遠征開始時、carry capacity以内のBlueprintを一品ずつexact copyとして再製造する。」
// **manifest 外の affix family でも有効**。再製造は pool を見ない。
export function manufactureCarried(archive, capacity) {
  const items = [];
  for (const blueprintId of normalizeCarrySelection(archive, capacity)) {
    const entry = blueprintById(archive, blueprintId);
    if (!entry) continue;
    items.push({
      definition: structuredClone(entry.definition),
      descriptor: entry.descriptor,
      rarity: entry.rarity,
      provenance: { ...structuredClone(entry.provenance ?? {}), carriedFromBlueprintId: blueprintId },
      readout: entry.readout ? structuredClone(entry.readout) : null,
      carried: true,
    });
  }
  return items;
}

// ---------------------------------------------------------------- 検索
//
// R8 §3.6 —「検索、filter、favorite、人物、地域、affix familyを持つ。」
export function searchBlueprints(archive, filters = {}) {
  const query = String(filters.query ?? "").trim();
  const entries = (archive?.entries ?? []).filter((entry) => {
    if (filters.rarity && entry.rarity !== filters.rarity) return false;
    if (filters.favorite && !entry.favorite) return false;
    if (filters.familyId && !(entry.provenance?.familyIds ?? []).includes(filters.familyId)) return false;
    if (filters.characterId
      && !entry.acquisitions.some((record) => record.characterId === filters.characterId)) return false;
    if (filters.campaignStageId
      && !entry.acquisitions.some((record) => record.campaignStageId === filters.campaignStageId)) return false;
    if (query) {
      const haystack = [entry.definition.displayName, entry.descriptor, ...(entry.readout?.lines ?? [])].join(" ");
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
  // 表示順は favorite → rarity → 表示名。**取得順に依らない**ので、
  // 同じ archive はいつ開いても同じ並びになる。
  const rank = Object.fromEntries(RARITIES.map((rarity, index) => [rarity, RARITIES.length - 1 - index]));
  return [...entries].sort((a, b) =>
    (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0)
    || (rank[a.rarity] ?? 9) - (rank[b.rarity] ?? 9)
    || a.definition.displayName.localeCompare(b.definition.displayName, "ja")
    || a.blueprintId.localeCompare(b.blueprintId));
}
