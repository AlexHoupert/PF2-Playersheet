import { buildEditOverride, getCatalogEntryBaseId } from "../catalog/catalogEntryModel.js";
import { readCatalogEffectDefinitions, writeCatalogEffectDefinitions } from "../rules/catalogEffectDefinitions.js";
import { selectSeededEffectDefinitions } from "../rules/declarativeRuleSeeds.js";

const SUPPORTED_TYPES = Object.freeze(["item", "feat", "spell", "impulse"]);

export function buildCatalogEffectBackfillPlan({ catalogIndexes = {}, existingOverrides = [] } = {}) {
  const writes = [];
  const skipped = [];
  for (const catalogType of SUPPORTED_TYPES) {
    for (const source of catalogIndexes[catalogType] || []) {
      const definitions = selectSeededEffectDefinitions(catalogType, source);
      if (!definitions.length) continue;
      const existing = findOverride(existingOverrides, catalogType, source);
      const existingDefinitions = readCatalogEffectDefinitions(existing?.payload);
      if (existingDefinitions.length) {
        skipped.push({
          catalogType,
          name: source.name,
          overrideId: existing.id,
          reason: "existing-effect-definitions",
        });
        continue;
      }
      const payload = writeCatalogEffectDefinitions({ ...source, ...(existing?.payload || {}) }, definitions);
      const override = buildEditOverride(catalogType, source, payload, {
        id: existing?.id,
        baseId: existing?.baseId || getCatalogEntryBaseId(source),
      });
      writes.push({ catalogType, source, before: existing || null, override });
    }
  }
  return {
    writes,
    skipped,
    counts: {
      writes: writes.length,
      creates: writes.filter(entry => !entry.before).length,
      updates: writes.filter(entry => entry.before).length,
      skipped: skipped.length,
      byType: Object.fromEntries(SUPPORTED_TYPES.map(type => [type, writes.filter(entry => entry.catalogType === type).length])),
    },
  };
}

function findOverride(overrides, catalogType, source) {
  const baseId = normalizeKey(getCatalogEntryBaseId(source));
  return overrides.find(override => {
    if (override.catalogType !== catalogType || override.mode === "custom") return false;
    const candidates = [override.baseId, override.payload?.overrideSourceFile, override.payload?.sourceFile]
      .map(normalizeKey)
      .filter(Boolean);
    return Boolean(baseId && candidates.includes(baseId));
  }) || null;
}

function normalizeKey(value) {
  return String(value || "").trim().replace(/\\/g, "/").replace(/^res+s?ources\//i, "").toLowerCase();
}
