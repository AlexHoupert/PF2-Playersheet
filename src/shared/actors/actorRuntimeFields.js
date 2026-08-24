const ACTOR_RUNTIME_DEFAULTS = Object.freeze({
  stats: {},
  skills: {},
  inventory: [],
  magic: { slots: {}, list: [] },
  formulaBook: [],
  languages: [],
  senses: [],
  proficiencies: {},
  gold: 0,
  xp: { current: 0, max: 1000 },
  dailyCraftingMax: undefined,
  feats: [],
  actions: [],
  impulses: [],
  isCaster: false,
  isKineticist: false,
});

export const ACTOR_RUNTIME_FIELD_NAMES = Object.freeze(Object.keys(ACTOR_RUNTIME_DEFAULTS));

const ACTOR_CORE_FIELD_NAMES = Object.freeze([
  "id",
  "name",
  "level",
  "campaignId",
]);

function cloneValue(value) {
  if (value === undefined || value === null) return value;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function hasRuntimeValue(record, key) {
  return Object.prototype.hasOwnProperty.call(record || {}, key) && record[key] != null;
}

export function readActorRuntimeField(actor, key, fallback = ACTOR_RUNTIME_DEFAULTS[key]) {
  if (hasRuntimeValue(actor, key)) return actor[key];
  if (hasRuntimeValue(actor?.sheet, key)) return actor.sheet[key];
  return cloneValue(fallback);
}

export function stripActorRuntimeFieldsFromSheet(sheet = {}) {
  const next = cloneValue(sheet) || {};
  [...ACTOR_CORE_FIELD_NAMES, ...ACTOR_RUNTIME_FIELD_NAMES].forEach((key) => {
    delete next[key];
  });
  return next;
}

export function actorToCharacterRuntimeView(actor, actorId = actor?.id) {
  const sheet = actor?.sheet || {};
  const view = {
    ...sheet,
    id: actor?.id || actorId || sheet.id || sheet.legacyCharacterId,
    name: actor?.name || sheet.name,
    level: actor?.level ?? sheet.level,
    campaignId: actor?.campaignId || sheet.campaignId,
  };

  ACTOR_RUNTIME_FIELD_NAMES.forEach((key) => {
    view[key] = readActorRuntimeField(actor, key);
  });

  if (actor?.deletedAt) view.deletedAt = actor.deletedAt;
  if (actor?.deletedBy) view.deletedBy = actor.deletedBy;
  if (actor?.restoredAt) view.restoredAt = actor.restoredAt;
  if (actor?.restoredBy) view.restoredBy = actor.restoredBy;
  return view;
}

export function canonicalizeActorRuntimeFields(actor = {}) {
  const next = cloneValue(actor) || {};
  ACTOR_RUNTIME_FIELD_NAMES.forEach((key) => {
    const value = readActorRuntimeField(actor, key);
    if (value === undefined) delete next[key];
    else next[key] = cloneValue(value);
  });
  next.sheet = stripActorRuntimeFieldsFromSheet(actor.sheet || {});
  return next;
}

export function findActorRuntimeMirrorConflicts(actor = {}) {
  return ACTOR_RUNTIME_FIELD_NAMES.filter((key) => (
    hasRuntimeValue(actor, key)
    && hasRuntimeValue(actor.sheet, key)
    && !runtimeValuesEqual(actor[key], actor.sheet[key])
  ));
}

export function runtimeValuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (left == null || right == null) return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((value, index) => runtimeValuesEqual(value, right[index]));
  }
  if (typeof left !== "object" || typeof right !== "object") return false;
  const leftKeys = Object.keys(left).filter((key) => left[key] !== undefined).sort();
  const rightKeys = Object.keys(right).filter((key) => right[key] !== undefined).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key, index) => (
    key === rightKeys[index] && runtimeValuesEqual(left[key], right[key])
  ));
}
