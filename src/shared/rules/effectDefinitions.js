import { createStandardConditionEffectInput } from "./conditionEffectRules.js";
import { readActorRuntimeField } from "../actors/actorRuntimeFields.js";

export const EFFECT_ACTIVATION_MODES = Object.freeze(["passive", "usable"]);
export const EFFECT_TRIGGERS = Object.freeze(["owned", "equipped", "consume", "cast", "activate"]);
export const EFFECT_DURATION_UNITS = Object.freeze([
  "unlimited",
  "manual",
  "daily_preparation",
  "rounds",
  "minutes",
]);
export const EFFECT_TICKS = Object.freeze(["turn_start", "turn_end"]);
export const EFFECT_MODES = Object.freeze([
  "bonus",
  "penalty",
  "cap",
  "set",
  "resistance",
  "weakness",
  "persistent_damage",
]);
export const EFFECT_BONUS_TYPES = Object.freeze(["item", "status", "circumstance", "untyped"]);
export const EFFECT_PROFICIENCY_DOMAINS = Object.freeze(["skill", "armor", "weapon"]);
export const EFFECT_PROFICIENCY_RANKS = Object.freeze([
  { value: 0, label: "Untrained" },
  { value: 2, label: "Trained" },
  { value: 4, label: "Expert" },
  { value: 6, label: "Master" },
  { value: 8, label: "Legendary" },
]);

export const EFFECT_PROFICIENCY_SKILLS = Object.freeze([
  "acrobatics", "arcana", "athletics", "crafting", "deception", "diplomacy",
  "intimidation", "medicine", "nature", "occultism", "performance", "religion",
  "society", "stealth", "survival", "thievery",
]);
export const EFFECT_PROFICIENCY_ARMOR = Object.freeze(["unarmored", "light", "medium", "heavy"]);
export const EFFECT_PROFICIENCY_WEAPONS = Object.freeze(["unarmed", "simple", "martial", "advanced"]);

export const EFFECT_SELECTOR_GROUPS = Object.freeze([
  { id: "defenses", label: "Defenses", order: 10 },
  { id: "combat", label: "Combat", order: 20 },
  { id: "movement", label: "Movement & Perception", order: 30 },
  { id: "attributes", label: "Attributes", order: 40 },
  { id: "skills", label: "Skills", order: 50 },
  { id: "dcs", label: "DCs", order: 60 },
  { id: "general", label: "General", order: 70 },
]);

const RAW_EFFECT_SELECTOR_REGISTRY = [
  { value: "ac", label: "Armor Class" },
  { value: "ac.dex_cap", label: "AC Dexterity Cap", showInOverview: false },
  { value: "hp.max", label: "Maximum HP" },
  { value: "speed", label: "Land Speed" },
  { value: "perception", label: "Perception" },
  { value: "all.checks", label: "All Checks", showInOverview: false },
  { value: "all.dcs", label: "All DCs" },
  { value: "save.fortitude", label: "Fortitude" },
  { value: "save.reflex", label: "Reflex" },
  { value: "save.will", label: "Will" },
  { value: "attribute.strength", label: "Strength" },
  { value: "attribute.dexterity", label: "Dexterity" },
  { value: "attribute.constitution", label: "Constitution" },
  { value: "attribute.intelligence", label: "Intelligence" },
  { value: "attribute.wisdom", label: "Wisdom" },
  { value: "attribute.charisma", label: "Charisma" },
  { value: "attack.all", label: "All Attacks" },
  { value: "attack.strength", label: "Strength-based Attacks" },
  { value: "attack.dexterity", label: "Dexterity-based Attacks" },
  { value: "attack.melee", label: "Melee Attacks" },
  { value: "attack.ranged", label: "Ranged Attacks" },
  { value: "melee.attack", label: "Melee Attacks", legacy: true, showInEditor: false, showInOverview: false },
  { value: "ranged.attack", label: "Ranged Attacks", legacy: true, showInEditor: false, showInOverview: false },
  { value: "spell.attack", label: "Spell Attacks" },
  { value: "spell.dc", label: "Spell DC" },
  { value: "impulse.attack", label: "Impulse Attacks" },
  { value: "impulse.dc", label: "Impulse DC" },
  { value: "class.dc", label: "Class DC" },
  { value: "initiative", label: "Initiative" },
  { value: "melee.damage", label: "Melee Damage" },
  { value: "ranged.damage", label: "Ranged Damage" },
  { value: "spell.damage", label: "Spell Damage" },
  { value: "impulse.damage", label: "Impulse Damage" },
  { value: "skill.lore", label: "Lore Skills" },
  ...EFFECT_PROFICIENCY_SKILLS.map(skill => ({ value: `skill.${skill}`, label: skill.charAt(0).toUpperCase() + skill.slice(1) })),
];

export const EFFECT_SELECTOR_REGISTRY = Object.freeze(
  RAW_EFFECT_SELECTOR_REGISTRY.map((entry, order) => Object.freeze({
    ...entry,
    group: getEffectSelectorGroup(entry.value),
    order,
  }))
);

const SELECTOR_SET = new Set(EFFECT_SELECTOR_REGISTRY.map(entry => entry.value));
const VALUE_MODES = new Set(["fixed", "actor_level_multiplier", "actor_level_tiers", "source_level_tiers", "proficiency_tiers"]);
const PREDICATE_TYPES = new Set([
  "actor_level",
  "source_level",
  "actor_kind",
  "actor_trait",
  "source_trait",
  "has_feat",
  "has_impulse",
  "has_effect",
  "equipped",
  "unarmored",
]);
const OPERATORS = new Set(["eq", "neq", "gte", "lte", "includes", "not_includes"]);
const APPLY_ACTION_TYPES = new Set(["adjust_hp", "ensure_temp_hp", "add_condition", "remove_condition"]);

function getEffectSelectorGroup(selector) {
  if (["ac", "ac.dex_cap", "hp.max", "save.fortitude", "save.reflex", "save.will"].includes(selector)) return "defenses";
  if (["speed", "perception"].includes(selector)) return "movement";
  if (selector.startsWith("attribute.")) return "attributes";
  if (selector.startsWith("skill.")) return "skills";
  if (selector === "all.dcs" || selector.endsWith(".dc") || selector === "class.dc") return "dcs";
  if (
    selector === "initiative"
    || selector.startsWith("attack.")
    || selector.endsWith(".attack")
    || selector.endsWith(".damage")
  ) return "combat";
  return "general";
}

export function normalizeEffectDefinitions(definitions = [], options = {}) {
  return (Array.isArray(definitions) ? definitions : [])
    .map((definition, index) => normalizeEffectDefinition(definition, { ...options, index }))
    .filter(Boolean);
}

export function normalizeEffectDefinition(definition = {}, options = {}) {
  const activationMode = EFFECT_ACTIVATION_MODES.includes(definition?.activation?.mode)
    ? definition.activation.mode
    : options.defaultActivationMode || "usable";
  const defaultTrigger = activationMode === "passive" ? "owned" : options.defaultTrigger || "activate";
  const trigger = EFFECT_TRIGGERS.includes(definition?.activation?.trigger)
    ? definition.activation.trigger
    : defaultTrigger;
  const durationUnit = EFFECT_DURATION_UNITS.includes(definition?.duration?.unit)
    ? definition.duration.unit
    : activationMode === "passive" ? "unlimited" : options.defaultDurationUnit || "manual";
  const tick = EFFECT_TICKS.includes(definition?.duration?.tick)
    ? definition.duration.tick
    : "turn_end";
  const id = String(definition.id || `effect_definition_${options.index ?? 0}`).trim();

  return {
    id,
    label: String(definition.label || options.sourceLabel || "Effect").trim() || "Effect",
    enabled: definition.enabled !== false,
    category: String(definition.category || options.category || "custom"),
    activation: {
      mode: activationMode,
      trigger,
      instancePolicy: ["replace", "refresh", "stack"].includes(definition?.activation?.instancePolicy)
        ? definition.activation.instancePolicy
        : "replace",
      stackingGroup: String(definition?.activation?.stackingGroup || id),
      cost: normalizeActivationCost(definition?.activation?.cost),
    },
    targeting: {
      mode: ["self", "single", "multiple"].includes(definition?.targeting?.mode)
        ? definition.targeting.mode
        : "self",
      allowedActorKinds: normalizeStringList(definition?.targeting?.allowedActorKinds?.length
        ? definition.targeting.allowedActorKinds
        : ["pc", "guest", "npc"]),
    },
    duration: {
      unit: durationUnit,
      value: ["rounds", "minutes"].includes(durationUnit)
        ? Math.max(1, Math.floor(toFiniteNumber(definition?.duration?.value, 1)))
        : null,
      tick,
    },
    predicates: {
      all: normalizePredicates(definition?.predicates?.all),
      any: normalizePredicates(definition?.predicates?.any),
    },
    modifiers: normalizeModifiers(definition.modifiers),
    onApply: normalizeApplyActions(definition.onApply),
  };
}

export function validateEffectDefinition(definition) {
  const normalized = normalizeEffectDefinition(definition);
  const errors = [];
  const rawActivationMode = definition?.activation?.mode;
  const rawTrigger = definition?.activation?.trigger;
  const rawDurationUnit = definition?.duration?.unit;
  const rawTick = definition?.duration?.tick;
  if (rawActivationMode && !EFFECT_ACTIVATION_MODES.includes(rawActivationMode)) errors.push("Unsupported activation mode");
  if (rawTrigger && !EFFECT_TRIGGERS.includes(rawTrigger)) errors.push("Unsupported activation trigger");
  if (rawDurationUnit && !EFFECT_DURATION_UNITS.includes(rawDurationUnit)) errors.push("Unsupported duration unit");
  if (rawTick && !EFFECT_TICKS.includes(rawTick)) errors.push("Unsupported duration tick");
  if (!normalized.id) errors.push("Effect definition requires an id");
  if (!normalized.label) errors.push("Effect definition requires a label");
  if (!EFFECT_ACTIVATION_MODES.includes(normalized.activation.mode)) errors.push("Unsupported activation mode");
  if (!EFFECT_TRIGGERS.includes(normalized.activation.trigger)) errors.push("Unsupported activation trigger");
  if (normalized.activation.mode === "passive" && !["owned", "equipped"].includes(normalized.activation.trigger)) {
    errors.push("Passive effects must use owned or equipped as trigger");
  }
  if (normalized.activation.mode === "usable" && ["owned", "equipped"].includes(normalized.activation.trigger)) {
    errors.push("Usable effects must use consume, cast, or activate as trigger");
  }
  for (const [index, modifier] of normalized.modifiers.entries()) {
    const rawModifier = definition?.modifiers?.[index];
    if (rawModifier?.mode && !EFFECT_MODES.includes(rawModifier.mode)) errors.push(`Modifier ${index + 1} uses an unsupported mode`);
    if (rawModifier?.bonusType && !EFFECT_BONUS_TYPES.includes(rawModifier.bonusType)) {
      errors.push(`Modifier ${index + 1} uses an unsupported bonus type`);
    }
    if (rawModifier?.value?.mode && !VALUE_MODES.has(rawModifier.value.mode)) {
      errors.push(`Modifier ${index + 1}: unsupported value mode`);
    }
    if (!isSupportedEffectSelector(modifier.selector)) errors.push(`Modifier ${index + 1} uses an unsupported selector`);
    if (!EFFECT_MODES.includes(modifier.mode)) errors.push(`Modifier ${index + 1} uses an unsupported mode`);
    if (["bonus", "penalty"].includes(modifier.mode) && !EFFECT_BONUS_TYPES.includes(modifier.bonusType)) {
      errors.push(`Modifier ${index + 1} uses an unsupported bonus type`);
    }
    const valueValidation = validateValueExpression(rawModifier?.value ?? modifier.value);
    if (valueValidation.length) {
      errors.push(...valueValidation.map(error => `Modifier ${index + 1}: ${error}`));
    }
  }
  for (const predicate of [...normalized.predicates.all, ...normalized.predicates.any]) {
    if (!PREDICATE_TYPES.has(predicate.type)) errors.push(`Unsupported predicate: ${predicate.type}`);
    if (!OPERATORS.has(predicate.operator)) errors.push(`Unsupported predicate operator: ${predicate.operator}`);
  }
  for (const action of normalized.onApply) {
    if (!APPLY_ACTION_TYPES.has(action.type)) errors.push(`Unsupported apply action: ${action.type}`);
  }
  return { valid: errors.length === 0, errors, definition: normalized };
}

export function validateEffectDefinitions(definitions = []) {
  const inputs = Array.isArray(definitions) ? definitions : [];
  const normalized = normalizeEffectDefinitions(inputs);
  const errors = [];
  const ids = new Set();
  normalized.forEach((definition, index) => {
    const result = validateEffectDefinition(inputs[index] || definition);
    result.errors.forEach(error => errors.push(`Effect ${index + 1}: ${error}`));
    if (ids.has(definition.id)) errors.push(`Effect ${index + 1}: duplicate id ${definition.id}`);
    ids.add(definition.id);
  });
  return { valid: errors.length === 0, errors, definitions: normalized };
}

export function evaluateEffectPredicates(definition, context = {}) {
  const predicates = definition?.predicates || {};
  const all = Array.isArray(predicates.all) ? predicates.all : [];
  const any = Array.isArray(predicates.any) ? predicates.any : [];
  return all.every(predicate => evaluatePredicate(predicate, context))
    && (any.length === 0 || any.some(predicate => evaluatePredicate(predicate, context)));
}

export function resolveEffectValue(expression, context = {}) {
  if (typeof expression === "number" || typeof expression === "string") {
    return toFiniteNumber(expression, 0);
  }
  const normalized = normalizeValueExpression(expression);
  const actorLevel = toFiniteNumber(context.actor?.level ?? context.actor?.sheet?.level, 1);
  const sourceLevel = toFiniteNumber(
    context.source?.level ?? context.source?.system?.level?.value ?? context.source?.rank,
    0
  );
  if (normalized.mode === "actor_level_multiplier") {
    return actorLevel * normalized.multiplier + normalized.value;
  }
  if (normalized.mode === "actor_level_tiers") return resolveTier(normalized.tiers, actorLevel, normalized.value);
  if (normalized.mode === "source_level_tiers") return resolveTier(normalized.tiers, sourceLevel, normalized.value);
  if (normalized.mode === "proficiency_tiers") {
    return resolveTier(normalized.tiers, resolveActorProficiencyRank(context.actor, normalized.proficiency), normalized.value);
  }
  return normalized.value;
}

export function materializeEffectDefinition(definitionInput, context = {}) {
  const validation = validateEffectDefinition(definitionInput);
  if (!validation.valid) throw new Error(validation.errors.join("; "));
  const definition = validation.definition;
  if (!definition.enabled || !evaluateEffectPredicates(definition, context)) return null;
  const now = context.now || new Date().toISOString();
  const sourceId = context.source?.id || context.source?._id || context.source?.baseId || context.source?.name || null;
  const effectId = context.effectId || [
    "source",
    context.targetActorId,
    context.sourceType,
    sourceId,
    definition.id,
  ].filter(Boolean).join(":");
  return {
    id: effectId,
    campaignId: context.campaignId || context.actor?.campaignId || null,
    targetActorId: context.targetActorId || context.actor?.id || null,
    templateId: `catalog:${context.sourceType || "source"}:${sourceId || "unknown"}:${definition.id}`,
    label: definition.label,
    category: definition.category,
    value: 1,
    source: {
      type: context.sourceType || "catalog",
      id: sourceId,
      name: context.source?.name || context.sourceLabel || definition.label,
      actorId: context.sourceActorId || context.actor?.id || null,
    },
    modifiers: definition.modifiers.map(modifier => ({
      ...modifier,
      value: normalizeMaterializedModifierValue(modifier.mode, resolveEffectValue(modifier.value, context)),
      source: modifier.source || definition.label,
      stackingKey: modifier.stackingKey || definition.activation.stackingGroup,
    })),
    duration: createRuntimeDuration(definition.duration, now),
    definitionSnapshot: definition,
    application: {
      appliedAt: now,
      appliedBy: context.appliedBy || null,
      sourceActorId: context.sourceActorId || context.actor?.id || null,
      targetActorId: context.targetActorId || context.actor?.id || null,
      parentEffectId: context.parentEffectId || null,
      relation: context.parentEffectId ? "caused_by" : null,
      activationKey: context.activationKey || null,
      lastTickKey: null,
    },
    onApply: definition.onApply,
    hidden: Boolean(context.hidden),
    disabled: false,
    derived: Boolean(context.derived),
  };
}

export function applyEffectOnApplyActions(actor, effect, options = {}) {
  let nextActor = structuredCloneSafe(actor);
  const additionalEffects = [];
  const removedTemplateIds = [];
  for (const action of effect?.onApply || []) {
    const value = resolveEffectValue(action.value, { actor: nextActor, source: options.source });
    if (action.type === "adjust_hp") {
      const hp = readHp(nextActor);
      writeHp(nextActor, { ...hp, current: Math.max(0, hp.current + value) });
    } else if (action.type === "ensure_temp_hp") {
      const hp = readHp(nextActor);
      writeHp(nextActor, { ...hp, temp: Math.max(hp.temp, value) });
    } else if (action.type === "add_condition") {
      const additionalEffect = createStandardConditionEffectInput(action.conditionName, value || 1, {
        sourceType: effect?.source?.type,
        sourceId: effect?.source?.id,
        sourceName: effect?.source?.name,
        actorId: effect?.source?.actorId,
      });
      additionalEffect.application = {
        parentEffectId: effect?.id || null,
        relation: effect?.id ? "caused_by" : null,
        sourceActorId: effect?.application?.sourceActorId || effect?.source?.actorId || null,
        targetActorId: effect?.application?.targetActorId || effect?.targetActorId || null,
      };
      additionalEffects.push(additionalEffect);
    } else if (action.type === "remove_condition") {
      removedTemplateIds.push(`condition:${slugify(action.conditionName)}`);
    }
  }
  return { actor: nextActor, additionalEffects, removedTemplateIds };
}

export function advanceEffectDuration(effect, options = {}) {
  const duration = effect?.duration;
  if (!duration || !["rounds", "minutes"].includes(duration.unit)) {
    return { effect, expired: false, changed: false };
  }
  const tick = options.tick || duration.tick || "turn_end";
  if (tick !== duration.tick) return { effect, expired: false, changed: false };
  const tickKey = String(options.tickKey || "");
  if (tickKey && effect?.application?.lastTickKey === tickKey) {
    return { effect, expired: false, changed: false };
  }
  const amount = Math.max(1, Math.floor(toFiniteNumber(options.rounds, 1)));
  const remainingRounds = Math.max(0, toFiniteNumber(duration.remainingRounds, 0) - amount);
  const next = {
    ...effect,
    duration: { ...duration, remainingRounds },
    application: { ...(effect.application || {}), lastTickKey: tickKey || effect?.application?.lastTickKey || null },
  };
  return { effect: next, expired: remainingRounds <= 0, changed: true };
}

export function isDailyPreparationEffect(effect) {
  return effect?.duration?.unit === "daily_preparation";
}

export function isSupportedEffectSelector(selector) {
  return SELECTOR_SET.has(String(selector || "").trim().toLowerCase());
}

function normalizeModifiers(modifiers) {
  return (Array.isArray(modifiers) ? modifiers : []).map((modifier, index) => ({
    id: String(modifier.id || `modifier_${index}`),
    selector: String(modifier.selector || "").trim().toLowerCase(),
    mode: EFFECT_MODES.includes(modifier.mode) ? modifier.mode : "bonus",
    bonusType: EFFECT_BONUS_TYPES.includes(modifier.bonusType) ? modifier.bonusType : "untyped",
    damageType: modifier.damageType ? String(modifier.damageType).toLowerCase() : null,
    value: normalizeValueExpression(modifier.value),
    stackingKey: String(modifier.stackingKey || ""),
    dependencyKey: String(modifier.dependencyKey || ""),
    source: String(modifier.source || ""),
  }));
}

function normalizeApplyActions(actions) {
  return (Array.isArray(actions) ? actions : []).map((action, index) => ({
    id: String(action.id || `apply_${index}`),
    type: APPLY_ACTION_TYPES.has(action.type) ? action.type : "adjust_hp",
    value: normalizeValueExpression(action.value),
    conditionName: action.conditionName ? String(action.conditionName) : null,
  }));
}

function normalizePredicates(predicates) {
  return (Array.isArray(predicates) ? predicates : []).map((predicate, index) => ({
    id: String(predicate.id || `predicate_${index}`),
    type: String(predicate.type || "actor_level"),
    operator: String(predicate.operator || "gte"),
    value: predicate.value,
  }));
}

function normalizeActivationCost(cost) {
  if (!cost || cost.type !== "inventory_item") return null;
  return {
    type: "inventory_item",
    quantity: Math.max(1, Math.floor(toFiniteNumber(cost.quantity, 1))),
    consumeSource: cost.consumeSource !== false,
  };
}

function normalizeValueExpression(expression) {
  if (typeof expression === "number" || typeof expression === "string") {
    return { mode: "fixed", value: toFiniteNumber(expression, 0), multiplier: 0, tiers: [] };
  }
  const mode = VALUE_MODES.has(expression?.mode) ? expression.mode : "fixed";
  return {
    mode,
    value: toFiniteNumber(expression?.value, 0),
    multiplier: toFiniteNumber(expression?.multiplier, 1),
    ...(mode === "proficiency_tiers" ? { proficiency: normalizeProficiencyReference(expression?.proficiency) } : {}),
    tiers: (Array.isArray(expression?.tiers) ? expression.tiers : [])
      .map(tier => ({ min: toFiniteNumber(tier?.min, 0), value: toFiniteNumber(tier?.value, 0) }))
      .sort((a, b) => a.min - b.min),
  };
}

function validateValueExpression(expression) {
  const normalized = normalizeValueExpression(expression);
  if (!VALUE_MODES.has(normalized.mode)) return ["unsupported value mode"];
  if (
    normalized.mode === "proficiency_tiers"
    && expression?.proficiency?.domain
    && !EFFECT_PROFICIENCY_DOMAINS.includes(expression.proficiency.domain)
  ) {
    return ["unsupported proficiency type"];
  }
  if (["actor_level_tiers", "source_level_tiers", "proficiency_tiers"].includes(normalized.mode) && normalized.tiers.length === 0) {
    return ["tiered values require at least one tier"];
  }
  if (normalized.mode === "proficiency_tiers" && !normalized.proficiency.key) {
    return ["proficiency scaling requires a proficiency"];
  }
  return [];
}

export function resolveActorProficiencyRank(actor = {}, reference = {}) {
  const proficiency = normalizeProficiencyReference(reference);
  if (!proficiency.key) return 0;

  const sheet = actor.sheet || {};
  if (proficiency.domain === "skill") {
    const aliases = proficiency.key === "performance" ? ["performance", "perform"]
      : proficiency.key === "intimidation" ? ["intimidation", "intimidate"]
        : [proficiency.key];
    return readCaseInsensitiveNumber(actor.skills, sheet.skills, aliases);
  }
  if (proficiency.domain === "armor") {
    return readCaseInsensitiveNumber(
      actor.stats?.proficiencies,
      sheet.stats?.proficiencies,
      actor.proficiencies,
      sheet.proficiencies,
      proficiency.key,
    );
  }
  return readCaseInsensitiveNumber(
    actor.proficiencies,
    sheet.proficiencies,
    actor.stats?.proficiencies,
    sheet.stats?.proficiencies,
    proficiency.key,
  );
}

function normalizeProficiencyReference(reference = {}) {
  const domain = EFFECT_PROFICIENCY_DOMAINS.includes(reference?.domain || reference?.type)
    ? (reference.domain || reference.type)
    : "skill";
  return {
    domain,
    key: String(reference?.key || "").trim().toLowerCase(),
  };
}

function readCaseInsensitiveNumber(...values) {
  const requestedKeys = values.pop();
  const keys = (Array.isArray(requestedKeys) ? requestedKeys : [requestedKeys])
    .map(key => String(key || "").toLowerCase());
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const matchingKey = Object.keys(value).find(candidate => keys.includes(candidate.toLowerCase()));
    if (matchingKey) return toFiniteNumber(value[matchingKey], 0);
  }
  return 0;
}

function evaluatePredicate(predicate, context) {
  const actor = context.actor || {};
  const source = context.source || {};
  let actual;
  if (predicate.type === "actor_level") actual = actor.level ?? actor.sheet?.level ?? 1;
  else if (predicate.type === "source_level") actual = source.level ?? source.system?.level?.value ?? source.rank ?? 0;
  else if (predicate.type === "actor_kind") actual = actor.kind || "pc";
  else if (predicate.type === "actor_trait") actual = normalizeStringList(actor.traits || actor.sheet?.traits);
  else if (predicate.type === "source_trait") actual = normalizeStringList(source.traits || source.system?.traits?.value);
  else if (predicate.type === "has_feat") actual = collectSourceNames(actor, "feats");
  else if (predicate.type === "has_impulse") actual = collectSourceNames(actor, "impulses");
  else if (predicate.type === "has_effect") actual = (context.effects || []).flatMap(effect => [effect.id, effect.templateId, effect.label]);
  else if (predicate.type === "equipped") actual = Boolean(context.equipped);
  else if (predicate.type === "unarmored") actual = isActorUnarmored(actor);
  return comparePredicate(actual, predicate.operator, predicate.value);
}

function comparePredicate(actual, operator, expected) {
  if (operator === "gte") return toFiniteNumber(actual, 0) >= toFiniteNumber(expected, 0);
  if (operator === "lte") return toFiniteNumber(actual, 0) <= toFiniteNumber(expected, 0);
  if (operator === "neq") return String(actual) !== String(expected);
  if (operator === "includes") return normalizeStringList(actual).includes(String(expected || "").toLowerCase());
  if (operator === "not_includes") return !normalizeStringList(actual).includes(String(expected || "").toLowerCase());
  return String(actual) === String(expected);
}

function createRuntimeDuration(duration, now) {
  const unit = duration?.unit || "manual";
  const configuredValue = ["rounds", "minutes"].includes(unit) ? Math.max(1, Number(duration.value) || 1) : null;
  return {
    unit,
    configuredValue,
    remainingRounds: unit === "rounds" ? configuredValue : unit === "minutes" ? configuredValue * 10 : null,
    tick: duration?.tick || "turn_end",
    startedAt: now,
    clockAnchor: null,
  };
}

function resolveTier(tiers, level, fallback) {
  return (tiers || []).reduce((current, tier) => level >= tier.min ? tier.value : current, fallback);
}

function normalizeMaterializedModifierValue(mode, value) {
  const numeric = toFiniteNumber(value, 0);
  if (mode === "penalty") return -Math.abs(numeric);
  if (["bonus", "resistance", "weakness", "persistent_damage"].includes(mode)) return Math.abs(numeric);
  return numeric;
}

function isActorUnarmored(actor) {
  const inventory = readActorRuntimeField(actor, "inventory", []);
  return !inventory.some(item => {
    const equipped = Boolean(item.equipped || item.isEquipped || item.system?.equipped?.value);
    if (!equipped) return false;
    const category = String(item.category || item.type || item.system?.category || "").toLowerCase();
    const name = String(item.name || "").toLowerCase();
    return (category.includes("armor") || item.system?.category === "armor")
      && !name.includes("explorer's clothing")
      && !name.includes("explorers clothing");
  });
}

function collectSourceNames(actor, field) {
  const values = readActorRuntimeField(actor, field, []);
  return (Array.isArray(values) ? values : []).map(value => String(value?.name || value?.id || value).toLowerCase());
}

function normalizeStringList(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return values.map(item => String(item?.value || item).trim().toLowerCase()).filter(Boolean);
}

function readHp(actor) {
  const hp = readActorRuntimeField(actor, "stats", {})?.hp || {};
  return {
    current: toFiniteNumber(hp.current, 0),
    max: Math.max(1, toFiniteNumber(hp.max, 1)),
    temp: Math.max(0, toFiniteNumber(hp.temp, 0)),
  };
}

function writeHp(actor, hp) {
  actor.stats = { ...(actor.stats || {}), hp };
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function slugify(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
