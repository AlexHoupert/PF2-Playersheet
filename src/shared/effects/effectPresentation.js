import { getConditionCatalogEntry, isConditionValued } from '../constants/conditionsCatalog.js';

export const DISPLAYABLE_EFFECT_CATEGORIES = new Set([
  'condition',
  'damage_effect',
  'affliction',
  'custom',
]);

const DEPRECATED_LEGACY_CONDITIONS = new Set([
  'persistent damage',
  'fast healing',
]);

const PERSISTENT_DAMAGE_DESCRIPTION = [
  'Persistent damage is taken at the end of each affected creature\'s turn.',
  'After taking the damage, attempt a DC 15 flat check to end the effect.',
].join(' ');

const AFFLICTION_DESCRIPTION = 'Affliction rules and stage handling will be added in a later wave.';
const CUSTOM_CONDITION_DESCRIPTION = 'This custom condition is visible for tracking but currently has no numerical rules effect.';

export function isDeprecatedLegacyConditionEffect(effect) {
  if (String(effect?.category || '').toLowerCase() !== 'condition') return false;
  return DEPRECATED_LEGACY_CONDITIONS.has(normalizeLabel(effect));
}

export function isDisplayableEffect(effect) {
  const category = String(effect?.category || '').toLowerCase();
  return Boolean(effect)
    && !effect.disabled
    && DISPLAYABLE_EFFECT_CATEGORIES.has(category)
    && !isDeprecatedLegacyConditionEffect(effect);
}

export function buildEffectPresentationItem(effect, options = {}) {
  const { viewerMode = 'owner' } = options;
  if (!isDisplayableEffect(effect)) return null;
  if (viewerMode === 'party' && effect.hidden) return null;

  const category = String(effect.category).toLowerCase();
  const conditionEntry = category === 'condition' ? getConditionCatalogEntry(effect.label || effect.name) : null;
  const value = normalizeEffectValue(effect.value);
  const label = resolveEffectLabel(effect, category, conditionEntry, value);

  return {
    id: effect.id,
    name: conditionEntry?.name || effect.label || effect.name || 'Effect',
    label,
    category,
    value,
    hidden: Boolean(effect.hidden),
    canModifyValue: category === 'condition' && isConditionValued(conditionEntry?.name || label),
    canRemove: true,
    description: resolveEffectDescription(effect, category, conditionEntry),
    variant: resolvePresentationVariant(category),
    source: effect.source || null,
  };
}

export function buildEffectPresentationItems(effects, options = {}) {
  return (Array.isArray(effects) ? effects : [])
    .map((effect) => buildEffectPresentationItem(effect, options))
    .filter(Boolean)
    .sort(compareEffectPresentationItems);
}

export function getEffectPresentationById(effects, effectId, options = {}) {
  if (!effectId) return null;
  return buildEffectPresentationItems(effects, options).find((effect) => effect.id === effectId) || null;
}

function normalizeEffectValue(value) {
  return Number.isFinite(Number(value)) ? Number(value) : value;
}

function normalizeLabel(effect) {
  return String(effect?.label || effect?.name || '').trim().toLowerCase();
}

function resolveEffectLabel(effect, category, conditionEntry, value) {
  if (category === 'condition') {
    const name = conditionEntry?.name || effect.label || effect.name || 'Condition';
    return isConditionValued(name) && Number(value) > 1 ? `${name} ${value}` : name;
  }
  if (category === 'damage_effect') {
    return effect.value?.formula || effect.label || 'Persistent Damage';
  }
  return effect.label || effect.name || (category === 'affliction' ? 'Affliction' : 'Custom Condition');
}

function resolveEffectDescription(effect, category, conditionEntry) {
  if (category === 'condition') {
    return conditionEntry?.description || 'No condition description is available.';
  }
  if (category === 'damage_effect') return PERSISTENT_DAMAGE_DESCRIPTION;
  if (category === 'affliction') return AFFLICTION_DESCRIPTION;
  return CUSTOM_CONDITION_DESCRIPTION;
}

function resolvePresentationVariant(category) {
  if (category === 'damage_effect') return 'persistent';
  if (category === 'affliction') return 'affliction';
  if (category === 'custom') return 'custom';
  return 'condition';
}

function compareEffectPresentationItems(left, right) {
  const categoryOrder = {
    condition: 0,
    damage_effect: 1,
    affliction: 2,
    custom: 3,
  };
  const categoryDifference = (categoryOrder[left.category] ?? 99) - (categoryOrder[right.category] ?? 99);
  if (categoryDifference !== 0) return categoryDifference;
  return String(left.label).localeCompare(String(right.label)) || String(left.id).localeCompare(String(right.id));
}
