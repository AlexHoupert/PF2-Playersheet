import { getConditionCatalogEntry, isConditionValued } from "../constants/conditionsCatalog.js";

export const DAMAGE_TYPES = [
  "acid",
  "bleed",
  "bludgeoning",
  "cold",
  "electricity",
  "fire",
  "force",
  "mental",
  "piercing",
  "poison",
  "precision",
  "slashing",
  "sonic",
  "spirit",
  "void",
  "vitality",
];

const OFF_GUARD_AC_CONDITIONS = new Set([
  "off-guard",
  "blinded",
  "grabbed",
  "paralyzed",
  "prone",
  "restrained",
  "unconscious",
]);

const ABILITY_SELECTORS = {
  strength: ["attribute.strength", "skill.athletics", "melee.attack"],
  dexterity: ["attribute.dexterity", "save.reflex", "skill.acrobatics", "skill.stealth", "skill.thievery", "ranged.attack"],
  constitution: ["attribute.constitution", "save.fortitude"],
  intelligence: ["attribute.intelligence", "skill.arcana", "skill.crafting", "skill.occultism", "skill.society"],
  wisdom: ["attribute.wisdom", "save.will", "perception", "skill.medicine", "skill.nature", "skill.religion", "skill.survival"],
  charisma: ["attribute.charisma", "skill.deception", "skill.diplomacy", "skill.intimidation", "skill.performance"],
};

export function createStandardConditionEffectInput(conditionName, value = 1, options = {}) {
  const canonicalName = getCanonicalConditionName(conditionName);
  const numericValue = normalizeConditionValue(canonicalName, value);
  return {
    templateId: `condition:${slugify(canonicalName)}`,
    label: canonicalName,
    category: "condition",
    value: numericValue,
    source: {
      type: options.sourceType || "manual",
      id: options.sourceId || null,
      name: options.sourceName || canonicalName,
      actorId: options.actorId || null,
    },
    modifiers: buildStandardConditionModifiers(canonicalName, numericValue),
  };
}

export function createPersistentDamageEffectInput(payload = {}, options = {}) {
  const damageType = normalizeDamageType(payload.damageType);
  const mode = payload.mode === "static" ? "static" : "dice";
  const diceCount = Math.max(1, Math.floor(Number(payload.diceCount) || 1));
  const dieSize = Math.max(2, Math.floor(Number(payload.dieSize) || 6));
  const staticValue = Math.max(1, Number(payload.staticValue) || 1);
  const value = mode === "static" ? staticValue : diceAverage(diceCount, dieSize);
  const formula = mode === "static"
    ? `${staticValue} ${damageType} persistent`
    : `${diceCount}d${dieSize} ${damageType} persistent`;

  return {
    templateId: `persistent:${damageType}`,
    label: formula,
    category: "damage_effect",
    value: {
      damageType,
      mode,
      diceCount: mode === "dice" ? diceCount : null,
      dieSize: mode === "dice" ? dieSize : null,
      staticValue: mode === "static" ? staticValue : null,
      formula,
    },
    source: {
      type: options.sourceType || "manual",
      id: options.sourceId || null,
      name: options.sourceName || "Persistent Damage",
      actorId: options.actorId || null,
    },
    modifiers: [{
      selector: "damage.persistent",
      mode: "persistent_damage",
      damageType,
      value,
      formula,
      stackingKey: `persistent:${damageType}`,
    }],
  };
}

export function createCustomBadgeEffectInput(label, options = {}) {
  const safeLabel = String(label || "").trim() || "Custom Condition";
  return {
    templateId: `custom:${slugify(safeLabel)}`,
    label: safeLabel,
    category: "custom",
    value: 1,
    source: {
      type: options.sourceType || "manual",
      id: options.sourceId || null,
      name: options.sourceName || safeLabel,
      actorId: options.actorId || null,
    },
    modifiers: [],
  };
}

export function buildStandardConditionModifiers(conditionName, value = 1) {
  const canonicalName = getCanonicalConditionName(conditionName);
  const lowerName = canonicalName.toLowerCase();
  const val = normalizeConditionValue(canonicalName, value);
  const source = isConditionValued(canonicalName) ? `${canonicalName} ${val}` : canonicalName;
  const modifiers = [];

  if (lowerName === "frightened" || lowerName === "sickened") {
    addPenalty(modifiers, ["all.checks", "all.dcs", "ac"], -val, "status", source);
  }

  if (lowerName === "clumsy") {
    addPenalty(modifiers, ABILITY_SELECTORS.dexterity, -val, "status", source);
    addPenalty(modifiers, ["ac"], -val, "status", source);
  }

  if (lowerName === "enfeebled") {
    addPenalty(modifiers, ABILITY_SELECTORS.strength, -val, "status", source);
  }

  if (lowerName === "drained") {
    addPenalty(modifiers, ABILITY_SELECTORS.constitution, -val, "status", source);
    modifiers.push({
      selector: "hp.max",
      mode: "penalty",
      bonusType: "status",
      value: -val,
      source,
      stackingKey: "condition:drained:hp.max",
    });
  }

  if (lowerName === "stupefied") {
    addPenalty(modifiers, ABILITY_SELECTORS.intelligence, -val, "status", source);
    addPenalty(modifiers, ABILITY_SELECTORS.wisdom, -val, "status", source);
    addPenalty(modifiers, ABILITY_SELECTORS.charisma, -val, "status", source);
    addPenalty(modifiers, ["spell.attack", "spell.dc"], -val, "status", source);
  }

  if (lowerName === "fatigued") {
    addPenalty(modifiers, ["ac", "save.fortitude", "save.reflex", "save.will"], -1, "status", source);
  }

  if (lowerName === "encumbered") {
    addPenalty(modifiers, ABILITY_SELECTORS.dexterity, -1, "status", source);
    modifiers.push({
      selector: "speed",
      mode: "penalty",
      bonusType: "status",
      value: -10,
      source,
      stackingKey: "condition:encumbered:speed",
    });
  }

  if (lowerName === "blinded") {
    addPenalty(modifiers, ["perception"], -4, "status", source);
  }

  if (lowerName === "deafened") {
    addPenalty(modifiers, ["perception"], -2, "status", source);
  }

  if (lowerName === "unconscious") {
    addPenalty(modifiers, ["perception"], -4, "status", source);
  }

  if (OFF_GUARD_AC_CONDITIONS.has(lowerName)) {
    addPenalty(modifiers, ["ac"], -2, "circumstance", "Off-Guard");
  }

  return modifiers;
}

export function getCanonicalConditionName(conditionName) {
  const raw = String(conditionName || "").trim();
  if (!raw) return "Custom Condition";
  return getConditionCatalogEntry(raw)?.name || raw;
}

export function normalizeConditionValue(conditionName, value) {
  if (!isConditionValued(conditionName)) return 1;
  const numeric = Math.floor(Number(value));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

export function normalizeDamageType(damageType) {
  const normalized = String(damageType || "").trim().toLowerCase();
  return DAMAGE_TYPES.includes(normalized) ? normalized : "untyped";
}

export function diceAverage(count, size) {
  return Math.max(1, Number(count) || 1) * ((Math.max(2, Number(size) || 6) + 1) / 2);
}

function addPenalty(modifiers, selectors, value, bonusType, source) {
  for (const selector of selectors) {
    modifiers.push({
      selector,
      mode: "penalty",
      bonusType,
      value,
      source,
      stackingKey: `condition:${source}:${selector}`,
    });
  }
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "effect";
}
