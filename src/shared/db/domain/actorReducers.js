import { normalizeCharacterRuntimeShape } from "./characterShape.js";
import { cloneValue, createInstanceId } from "./inventoryReducers.js";
import { applyRecordUpdater } from "./updateHelpers.js";
import {
  actorToCharacterRuntimeView,
  readActorRuntimeField,
  stripActorRuntimeFieldsFromSheet,
} from "../../actors/actorRuntimeFields.js";

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
    sheet: stripActorRuntimeFieldsFromSheet(actor?.sheet || {}),
    stats: cloneValue(readActorRuntimeField(actor, "stats")),
    skills: cloneValue(readActorRuntimeField(actor, "skills")),
    inventory: cloneValue(readActorRuntimeField(actor, "inventory")),
    magic: cloneValue(readActorRuntimeField(actor, "magic")),
    formulaBook: cloneValue(readActorRuntimeField(actor, "formulaBook")),
    languages: cloneValue(readActorRuntimeField(actor, "languages")),
    senses: cloneValue(readActorRuntimeField(actor, "senses")),
    proficiencies: cloneValue(readActorRuntimeField(actor, "proficiencies")),
    gold: toFiniteNumber(readActorRuntimeField(actor, "gold"), 0),
    xp: cloneValue(readActorRuntimeField(actor, "xp")),
    dailyCraftingMax: readActorRuntimeField(actor, "dailyCraftingMax"),
    feats: cloneValue(readActorRuntimeField(actor, "feats")),
    actions: cloneValue(readActorRuntimeField(actor, "actions")),
    impulses: cloneValue(readActorRuntimeField(actor, "impulses")),
    isCaster: Boolean(readActorRuntimeField(actor, "isCaster")),
    isKineticist: Boolean(readActorRuntimeField(actor, "isKineticist")),
    baseTemplateId: actor?.baseTemplateId || null,
    progression: cloneValue(actor?.progression || {}),
    selectionSlots: cloneValue(actor?.selectionSlots || {}),
    sourceStatus: actor?.sourceStatus || "legacy_current",
  };

  if (kind === "pc") {
    const normalized = normalizeCharacterRuntimeShape(actorToCharacterRuntimeView({
      ...actor,
      ...base,
      sheet: {
        ...(actor?.sheet || {}),
        ...(base.sheet || {}),
      },
    }, id));
    base.sheet = stripActorRuntimeFieldsFromSheet({
      ...(base.sheet || {}),
      legacyCharacterId: actor?.sheet?.legacyCharacterId || normalized.id || id,
    });
    base.stats = normalized.stats;
    base.skills = normalized.skills || {};
    base.inventory = normalized.inventory;
    base.magic = normalized.magic;
    base.formulaBook = normalized.formulaBook || [];
    base.languages = normalized.languages || [];
    base.senses = normalized.senses || [];
    base.proficiencies = normalized.proficiencies || {};
    base.gold = normalized.gold ?? base.gold;
    base.xp = normalized.xp || base.xp;
    base.dailyCraftingMax = normalized.dailyCraftingMax ?? base.dailyCraftingMax;
    base.feats = normalized.feats || [];
    base.actions = normalized.actions || [];
    base.impulses = normalized.impulses || [];
    base.isCaster = Boolean(normalized.isCaster);
    base.isKineticist = Boolean(normalized.isKineticist);
  }

  if (base.dailyCraftingMax === undefined) delete base.dailyCraftingMax;

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
    value: effect?.value && typeof effect.value === "object"
      ? cloneValue(effect.value)
      : toFiniteNumber(effect?.value ?? effect?.level, 1),
    source: {
      type: effect?.source?.type || effect?.type || "manual",
      id: effect?.source?.id || effect?.sourceId || null,
      name: effect?.source?.name || label,
      actorId: effect?.source?.actorId || null,
      instanceId: effect?.source?.instanceId || null,
    },
    modifiers: Array.isArray(effect?.modifiers) ? cloneValue(effect.modifiers) : [],
    duration: effect?.duration ? cloneValue(effect.duration) : null,
    definitionSnapshot: effect?.definitionSnapshot ? cloneValue(effect.definitionSnapshot) : null,
    application: effect?.application ? cloneValue(effect.application) : null,
    onApply: Array.isArray(effect?.onApply) ? cloneValue(effect.onApply) : [],
    stage: effect?.stage || null,
    hidden: Boolean(effect?.hidden),
    disabled: Boolean(effect?.disabled),
    derived: Boolean(effect?.derived),
    createdAt: effect?.createdAt || null,
    createdBy: effect?.createdBy || null,
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
