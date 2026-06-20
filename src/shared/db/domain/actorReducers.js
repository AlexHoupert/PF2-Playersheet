import { normalizeCharacterRuntimeShape } from "./characterShape.js";
import { cloneValue, createInstanceId } from "./inventoryReducers.js";
import { applyRecordUpdater } from "./updateHelpers.js";

export const ACTOR_KINDS = new Set([
  "pc",
  "npc",
  "animal_companion",
  "familiar",
  "pet",
  "summoned",
  "eidolon",
  "follower",
]);

export const EFFECT_CATEGORIES = new Set([
  "condition",
  "status_effect",
  "damage_effect",
  "resistance_effect",
  "affliction",
  "item",
  "feat",
  "spell",
  "custom",
]);

export function createActorRecord(actor, options = {}) {
  const { createId = () => createInstanceId("actor"), campaignId = actor?.campaignId || null } = options;
  const id = actor?.id || createId(actor);
  const kind = normalizeActorKind(actor?.kind);
  const base = {
    id,
    kind,
    campaignId,
    name: actor?.name || (kind === "pc" ? "Unnamed Character" : "Unnamed Actor"),
    level: toFiniteNumber(actor?.level, 1),
    ownerActorId: actor?.ownerActorId || null,
    controllerUserEmail: actor?.controllerUserEmail || null,
    controllerActorId: actor?.controllerActorId || null,
    commandMode: actor?.commandMode || (kind === "pc" ? "self" : "command_animal"),
    ruleset: actor?.ruleset || "pf2e_remaster",
    sheet: cloneValue(actor?.sheet || {}),
    stats: cloneValue(actor?.stats || {}),
    inventory: cloneValue(actor?.inventory || []),
    magic: cloneValue(actor?.magic || { slots: {}, list: [] }),
    baseTemplateId: actor?.baseTemplateId || null,
    progression: cloneValue(actor?.progression || {}),
    selectionSlots: cloneValue(actor?.selectionSlots || {}),
    sourceStatus: actor?.sourceStatus || "legacy_current",
  };

  if (kind === "pc") {
    const normalized = normalizeCharacterRuntimeShape({
      ...base.sheet,
      id,
      name: base.name,
      level: base.level,
      stats: base.stats,
      inventory: base.inventory,
      magic: base.magic,
    });
    base.sheet = {
      ...normalized,
      legacyCharacterId: base.sheet.legacyCharacterId || normalized.id || id,
    };
    base.stats = normalized.stats;
    base.inventory = normalized.inventory;
    base.magic = normalized.magic;
  }

  if (actor?.deletedAt) base.deletedAt = actor.deletedAt;
  if (actor?.deletedBy) base.deletedBy = actor.deletedBy;
  return base;
}

export function applyActorUpdate(actor, updater, options = {}) {
  const current = createActorRecord(actor, { ...options, campaignId: actor?.campaignId || options.campaignId });
  return createActorRecord(applyRecordUpdater(current, updater), {
    ...options,
    campaignId: current.campaignId,
  });
}

export function createActorEffectRecord(effect, options = {}) {
  const {
    createId = () => createInstanceId("effect"),
    campaignId = effect?.campaignId || null,
    targetActorId = effect?.targetActorId || null,
  } = options;
  const label = effect?.label || effect?.name || "Effect";
  return {
    id: effect?.id || createId(effect),
    campaignId,
    targetActorId,
    templateId: effect?.templateId || null,
    label,
    category: normalizeEffectCategory(effect?.category),
    value: toFiniteNumber(effect?.value ?? effect?.level, 1),
    source: {
      type: effect?.source?.type || effect?.type || "manual",
      id: effect?.source?.id || effect?.sourceId || null,
      name: effect?.source?.name || label,
      actorId: effect?.source?.actorId || null,
    },
    modifiers: Array.isArray(effect?.modifiers) ? cloneValue(effect.modifiers) : [],
    duration: effect?.duration || null,
    stage: effect?.stage || null,
    hidden: Boolean(effect?.hidden),
    disabled: Boolean(effect?.disabled),
  };
}

export function applyActorEffectUpdate(effect, updater, options = {}) {
  const current = createActorEffectRecord(effect, options);
  return createActorEffectRecord(applyRecordUpdater(current, updater), {
    ...options,
    campaignId: current.campaignId,
    targetActorId: current.targetActorId,
  });
}

export function createCatalogOverrideRecord(override, options = {}) {
  const { createId = () => createInstanceId("catalog_override") } = options;
  const catalogType = String(override?.catalogType || "item");
  const id = override?.id || createId(override);
  const timestamp = override?.updatedAt || new Date().toISOString();
  return {
    id,
    catalogType,
    baseId: override?.baseId || null,
    mode: override?.mode || "custom",
    label: override?.label || override?.payload?.name || id,
    payload: cloneValue(override?.payload || {}),
    sourceFile: null,
    createdAt: override?.createdAt || timestamp,
    updatedAt: timestamp,
    updatedBy: override?.updatedBy || null,
  };
}

function normalizeActorKind(kind) {
  const value = String(kind || "pc");
  return ACTOR_KINDS.has(value) ? value : "pc";
}

function normalizeEffectCategory(category) {
  const value = String(category || "condition");
  return EFFECT_CATEGORIES.has(value) ? value : "condition";
}

function toFiniteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
