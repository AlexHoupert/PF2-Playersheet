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

const ABILITY_SELECTORS = {
  strength: ["attribute.strength"],
  dexterity: ["attribute.dexterity"],
  constitution: ["attribute.constitution"],
  intelligence: ["attribute.intelligence"],
  wisdom: ["attribute.wisdom"],
  charisma: ["attribute.charisma"],
};

const DURABLE_CONDITION_CHILDREN = Object.freeze({
  confused: [{ name: "Off-Guard" }],
  dying: [{ name: "Unconscious" }],
  encumbered: [{ name: "Clumsy", value: 1 }],
  grabbed: [{ name: "Off-Guard" }, { name: "Immobilized" }],
  paralyzed: [{ name: "Off-Guard" }],
  restrained: [{ name: "Off-Guard" }, { name: "Immobilized" }],
  unconscious: [{ name: "Blinded" }, { name: "Off-Guard" }],
});

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
  return flattenConditionRuleModifiers(buildStandardConditionRuleTree(conditionName, value));
}

export function buildStandardConditionRuleTree(conditionName, value = 1) {
  const canonicalName = getCanonicalConditionName(conditionName);
  const val = normalizeConditionValue(canonicalName, value);
  return buildConditionRuleNode(canonicalName, val, {
    id: `condition:${slugify(canonicalName)}`,
    kind: "condition",
  });
}

function buildConditionRuleNode(conditionName, value, options = {}) {
  const canonicalName = getCanonicalConditionName(conditionName);
  const lowerName = canonicalName.toLowerCase();
  const val = normalizeConditionValue(canonicalName, value);
  const source = isConditionValued(canonicalName) ? `${canonicalName} ${val}` : canonicalName;
  const node = createRuleNode(
    options.id || `condition:${slugify(canonicalName)}`,
    source,
    options.kind || "derived_condition",
    canonicalName,
    val
  );

  if (lowerName === "frightened" || lowerName === "sickened") {
    addPenalty(node, ["all.checks", "all.dcs"], -val, "status", source);
  }

  if (lowerName === "clumsy") {
    addPenalty(node, ABILITY_SELECTORS.dexterity, -val, "status", source);
  }

  if (lowerName === "enfeebled") {
    addPenalty(node, ABILITY_SELECTORS.strength, -val, "status", source);
  }

  if (lowerName === "drained") {
    addPenalty(node, ABILITY_SELECTORS.constitution, -val, "status", source);
    addModifier(node, {
      selector: "hp.max",
      mode: "penalty",
      bonusType: "status",
      value: -val,
      source,
      stackingKey: "condition:drained:hp.max",
    });
  }

  if (lowerName === "stupefied") {
    addPenalty(node, ABILITY_SELECTORS.intelligence, -val, "status", source);
    addPenalty(node, ABILITY_SELECTORS.wisdom, -val, "status", source);
    addPenalty(node, ABILITY_SELECTORS.charisma, -val, "status", source);
    addPenalty(node, ["spell.attack", "spell.dc"], -val, "status", source);
  }

  if (lowerName === "fatigued") {
    addPenalty(node, ["ac", "save.fortitude", "save.reflex", "save.will"], -1, "status", source);
  }

  if (lowerName === "encumbered") {
    addModifier(node, {
      selector: "speed",
      mode: "penalty",
      bonusType: "status",
      value: -10,
      source,
      stackingKey: "condition:encumbered:speed",
    });
  }

  if (lowerName === "blinded") {
    addPenalty(node, ["perception"], -4, "status", source);
  }

  if (lowerName === "deafened") {
    addPenalty(node, ["perception"], -2, "status", source);
  }

  if (lowerName === "unconscious") {
    addPenalty(node, ["ac", "save.reflex"], -4, "status", source);
  }

  if (lowerName === "off-guard") {
    addPenalty(node, ["ac"], -2, "circumstance", "Off-Guard");
  }

  if (lowerName === "immobilized") {
    addModifier(node, {
      selector: "speed",
      mode: "set",
      bonusType: "untyped",
      value: 0,
      source: "Immobilized",
      stackingKey: "condition:immobilized:speed",
    });
  }

  if (lowerName === "prone") {
    node.children.push(buildConditionRuleNode("Off-Guard", 1, {
      id: `${node.id}:off-guard`,
      kind: "derived_condition",
    }));
    const attackPenalty = createRuleNode(`${node.id}:attack-penalty`, "Attack Penalty", "rule_consequence");
    addPenalty(attackPenalty, ["attack.all"], -2, "circumstance", "Prone");
    node.children.push(attackPenalty);
  }

  for (const child of DURABLE_CONDITION_CHILDREN[lowerName] || []) {
    node.children.push(buildConditionRuleNode(child.name, child.value ?? 1, {
      id: `${node.id}:${slugify(child.name)}`,
      kind: "derived_condition",
    }));
  }

  return node;
}

export function flattenConditionRuleModifiers(ruleTree) {
  if (!ruleTree) return [];
  return [
    ...(ruleTree.modifiers || []),
    ...(ruleTree.children || []).flatMap(flattenConditionRuleModifiers),
  ];
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

function createRuleNode(id, label, kind, conditionName = null, value = null) {
  return { id, label, kind, conditionName, value, modifiers: [], children: [] };
}

function addModifier(node, modifier) {
  const index = node.modifiers.length;
  node.modifiers.push({
    id: modifier.id || `${node.id}:modifier:${index}`,
    ruleNodeId: node.id,
    ...modifier,
  });
}

function addPenalty(node, selectors, value, bonusType, source) {
  for (const selector of selectors) {
    addModifier(node, {
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
