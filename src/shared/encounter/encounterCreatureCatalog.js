import { buildBestiaryCreatureEntries } from "../bestiary/creaturePresentation.js";
import { mergeCreatureDetailIntoEntry } from "../catalog/catalogDetailMerge.js";
import { selectBestiaryCreatureMetadata } from "../db/selectors/bestiarySelectors.js";
import { selectCatalogEntryStates } from "../db/selectors/catalogOverrideSelectors.js";

export function buildEncounterCreatureCatalog(staticCreatures = [], source = {}) {
  return buildBestiaryCreatureEntries({
    entryStates: selectCatalogEntryStates(staticCreatures, source, "creature"),
    metadata: selectBestiaryCreatureMetadata(source),
    includeUnpublished: true,
  }).filter((creature) => !creature.isDeleted);
}

export function resolveEncounterCreatureStaticId(catalogEntry, staticCreatures = []) {
  if (!catalogEntry) return null;
  const matchKeys = new Set([
    catalogEntry.id,
    catalogEntry._id,
    catalogEntry.baseId,
    catalogEntry.sourceFile,
    catalogEntry.overrideSourceFile,
  ].filter(Boolean).map(normalizeKey));
  const match = staticCreatures.find((creature) => [
    creature.id,
    creature._id,
    creature.sourceFile,
  ].filter(Boolean).map(normalizeKey).some((key) => matchKeys.has(key)));
  return match?.id || null;
}

export function mergeEncounterCreatureData(catalogEntry, baseDetail = null) {
  const merged = mergeCreatureDetailIntoEntry(baseDetail, catalogEntry || {});
  if (merged?.data?.system) return merged.data;
  if (merged?.system) return merged;
  return baseDetail?.system ? baseDetail : null;
}

function normalizeKey(value) {
  return String(value || "").trim().replace(/\\/g, "/").toLowerCase();
}
