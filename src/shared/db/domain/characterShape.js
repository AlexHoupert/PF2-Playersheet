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

export function normalizeCharacterRuntimeShape(character) {
  const next = cloneValue(character) || {};
  if (!next.stats || typeof next.stats !== "object") next.stats = {};
  if (!next.skills || typeof next.skills !== "object") next.skills = {};
  if (!next.stats.attributes || typeof next.stats.attributes !== "object" || Array.isArray(next.stats.attributes)) {
    next.stats.attributes = {};
  }

  moveSkill(next.skills, "Intimidate", "Intimidation");
  moveSkill(next.skills, "intimidate", "Intimidation");
  moveSkill(next.skills, "Perform", "Performance");
  moveSkill(next.skills, "perform", "Performance");

  ATTRIBUTE_KEYS.forEach((key) => {
    const value = Number(next.stats.attributes[key]);
    next.stats.attributes[key] = Number.isFinite(value) ? value : 0;
  });

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
