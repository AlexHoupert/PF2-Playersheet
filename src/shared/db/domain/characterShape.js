function cloneValue(value) {
  if (value === undefined || value === null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

const ATTRIBUTE_KEYS = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
];

function ensureObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

export function normalizeCharacterRuntimeShape(character) {
  const next = cloneValue(character) || {};
  next.stats = ensureObject(next.stats);
  next.skills = ensureObject(next.skills);
  next.stats.attributes = ensureObject(next.stats.attributes);
  next.stats.saves = ensureObject(next.stats.saves);
  next.stats.ac = ensureObject(next.stats.ac);
  next.stats.proficiencies = ensureObject(next.stats.proficiencies);
  next.stats.speed = ensureObject(next.stats.speed);
  next.magic = ensureObject(next.magic);
  next.magic.slots = ensureObject(next.magic.slots);
  next.magic.list = ensureArray(next.magic.list);
  next.formulaBook = ensureArray(next.formulaBook);
  next.languages = ensureArray(next.languages);
  next.senses = ensureArray(next.senses);
  if (
    next.proficiencies === undefined ||
    next.proficiencies === null ||
    (typeof next.proficiencies !== "object" && !Array.isArray(next.proficiencies))
  ) {
    next.proficiencies = {};
  }

  moveSkill(next.skills, "Intimidate", "Intimidation");
  moveSkill(next.skills, "intimidate", "Intimidation");
  moveSkill(next.skills, "Perform", "Performance");
  moveSkill(next.skills, "perform", "Performance");

  ATTRIBUTE_KEYS.forEach((key) => {
    next.stats.attributes[key] = normalizeNumber(next.stats.attributes[key], 0);
  });

  next.stats.hp = ensureObject(next.stats.hp);
  next.stats.hp.current = Math.max(0, normalizeNumber(next.stats.hp.current, 0));
  next.stats.hp.max = Math.max(1, normalizeNumber(next.stats.hp.max, 1));
  next.stats.hp.temp = Math.max(0, normalizeNumber(next.stats.hp.temp, 0));
  next.stats.speed.land = Math.max(0, normalizeNumber(next.stats.speed.land, 25));
  next.stats.ac.shield_raised = normalizeBoolean(next.stats.ac.shield_raised);
  next.stats.ac.armor_equipped = normalizeBoolean(next.stats.ac.armor_equipped);
  if (!Array.isArray(next.impulses)) next.impulses = [];
  if (next.stats.impulse_proficiency == null) next.stats.impulse_proficiency = 0;
  if (next.stats.spell_proficiency == null) next.stats.spell_proficiency = 0;
  if (next.isKineticist === undefined) next.isKineticist = false;
  if (next.isCaster === undefined) next.isCaster = false;

  return next;
}

function moveSkill(skills, from, to) {
  if (!Object.prototype.hasOwnProperty.call(skills, from)) return;
  if (!Object.prototype.hasOwnProperty.call(skills, to)) skills[to] = skills[from];
  delete skills[from];
}
