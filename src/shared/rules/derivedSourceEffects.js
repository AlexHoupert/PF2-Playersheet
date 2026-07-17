import {
  materializeEffectDefinition,
  normalizeEffectDefinitions,
} from "./effectDefinitions.js";
import { selectSeededEffectDefinitions } from "./declarativeRuleSeeds.js";
import { readCatalogEffectDefinitions } from "./catalogEffectDefinitions.js";

export function buildDerivedSourceEffects({ actor, campaign = null, catalog = null, persistedEffects = [] } = {}) {
  if (!actor) return [];
  const sources = collectActorRuleSources(actor);
  return sources.flatMap(sourceRecord => {
    const source = resolveCatalogSource(sourceRecord, catalog);
    const definitions = selectSourceEffectDefinitions(sourceRecord.sourceType, source);
    return definitions
      .filter(definition => definition.enabled !== false && definition.activation.mode === "passive")
      .filter(definition => definition.activation.trigger !== "equipped" || sourceRecord.equipped)
      .map(definition => materializeEffectDefinition(definition, {
        actor,
        campaignId: campaign?.id || actor.campaignId,
        derived: true,
        effects: persistedEffects,
        equipped: sourceRecord.equipped,
        source,
        sourceActorId: actor.id,
        sourceType: sourceRecord.sourceType,
        targetActorId: actor.id,
        effectId: createDerivedEffectId(actor.id, sourceRecord, definition.id),
      }))
      .filter(Boolean);
  });
}

export function selectSourceEffectDefinitions(sourceType, source) {
  const embedded = readCatalogEffectDefinitions(source);
  if (embedded.length) return embedded;
  return normalizeEffectDefinitions(selectSeededEffectDefinitions(sourceType, source));
}

export function collectActorRuleSources(actor) {
  const sheet = actor.sheet || {};
  const inventory = actor.inventory || sheet.inventory || [];
  return [
    ...inventory.map((source, index) => ({
      source,
      sourceType: "item",
      instanceKey: source.instanceId || source.id || source._id || `inventory_${index}`,
      equipped: isItemEquipped(source),
    })),
    ...collectList(actor, sheet, "feats").map((source, index) => ({ source, sourceType: "feat", instanceKey: getSourceId(source, index), equipped: true })),
    ...collectSpellList(actor, sheet).map((source, index) => ({ source, sourceType: "spell", instanceKey: getSourceId(source, index), equipped: true })),
    ...collectList(actor, sheet, "impulses").map((source, index) => ({ source, sourceType: "impulse", instanceKey: getSourceId(source, index), equipped: true })),
  ];
}

function resolveCatalogSource(sourceRecord, catalog) {
  const source = typeof sourceRecord.source === "string"
    ? { id: sourceRecord.source, name: sourceRecord.source }
    : sourceRecord.source || {};
  if (source.rules?.effectDefinitions || source.system?.effectDefinitions || source.system?.rules?.effectDefinitions) return source;
  if (typeof catalog?.resolve === "function") return catalog.resolve(sourceRecord.sourceType, source) || source;
  const entries = catalog?.[sourceRecord.sourceType] || catalog?.[`${sourceRecord.sourceType}s`] || [];
  const candidates = Array.isArray(entries) ? entries : Object.values(entries || {});
  const keys = new Set([source.id, source._id, source.baseId, source.sourceFile, source.name].filter(Boolean).map(normalizeKey));
  return candidates.find(candidate => [candidate.id, candidate._id, candidate.baseId, candidate.sourceFile, candidate.name]
    .filter(Boolean)
    .map(normalizeKey)
    .some(key => keys.has(key))) || source;
}

function collectList(actor, sheet, field) {
  const value = actor[field] || sheet[field] || [];
  return Array.isArray(value) ? value : [];
}

function collectSpellList(actor, sheet) {
  return actor.magic?.list || sheet.magic?.list || actor.spells?.known || sheet.spells?.known || [];
}

function isItemEquipped(item) {
  return Boolean(item?.equipped || item?.isEquipped || item?.system?.equipped?.value || item?.system?.equipped === true);
}

function getSourceId(source, index) {
  if (typeof source === "string") return source;
  return source?.instanceId || source?.id || source?._id || source?.sourceFile || source?.name || `source_${index}`;
}

function createDerivedEffectId(actorId, sourceRecord, definitionId) {
  return `derived:${actorId}:${sourceRecord.sourceType}:${normalizeKey(sourceRecord.instanceKey)}:${normalizeKey(definitionId)}`;
}

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_");
}
