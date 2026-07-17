import {
  normalizeEffectDefinitions,
  validateEffectDefinitions,
} from "./effectDefinitions.js";

export function readCatalogEffectDefinitions(source) {
  const definitions = source?.rules?.effectDefinitions
    || (!Array.isArray(source?.system?.rules) ? source?.system?.rules?.effectDefinitions : null)
    || source?.system?.effectDefinitions
    || [];
  return normalizeEffectDefinitions(definitions);
}

export function writeCatalogEffectDefinitions(source, definitions) {
  const validation = validateEffectDefinitions(definitions);
  if (!validation.valid) throw new Error(validation.errors.join("; "));
  return {
    ...source,
    rules: {
      ...(source?.rules || {}),
      effectDefinitions: validation.definitions,
    },
  };
}

export function validateCatalogEffectDefinitions(definitions) {
  return validateEffectDefinitions(definitions);
}

export function assertCatalogEffectDefinitions(source) {
  const definitions = source?.rules?.effectDefinitions
    || (!Array.isArray(source?.system?.rules) ? source?.system?.rules?.effectDefinitions : null)
    || source?.system?.effectDefinitions;
  if (definitions == null) return;
  const validation = validateEffectDefinitions(definitions);
  if (!validation.valid) throw new Error(validation.errors.join("; "));
}
