import { getConditionCatalogEntry, isConditionValued } from '../constants/conditionsCatalog.js';
import { NEG_CONDS, POS_CONDS, VIS_CONDS } from '../constants/conditions.js';

export const DISPLAYABLE_EFFECT_CATEGORIES = new Set([
  'condition',
  'damage_effect',
  'affliction',
  'custom',
  'item',
  'spell',
  'impulse',
  'feat',
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
  const name = conditionEntry?.name || effect.label || effect.name || 'Effect';
  const label = resolveEffectLabel(effect, category, conditionEntry, value);
  const tone = resolveEffectTone(effect, category, name);

  return {
    id: effect.id,
    name,
    label,
    category,
    value,
    hidden: Boolean(effect.hidden),
    derived: Boolean(effect.derived),
    canModifyValue: category === 'condition' && isConditionValued(conditionEntry?.name || label),
    canRemove: !effect.derived && Boolean(effect.id),
    description: resolveEffectDescription(effect, category, conditionEntry),
    variant: tone,
    tone,
    primaryBonusType: resolvePrimaryBonusType(effect.modifiers),
    source: effect.source || null,
    duration: effect.duration || null,
    modifiers: Array.isArray(effect.modifiers) ? effect.modifiers : [],
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

export function resolveEffectTone(effect, categoryInput = null, nameInput = null) {
  const category = String(categoryInput || effect?.category || '').toLowerCase();
  const name = String(nameInput || effect?.label || effect?.name || '').toLowerCase();
  if (category === 'damage_effect') return 'persistent';
  if (category === 'affliction') return 'harmful';
  if (category === 'condition' && VIS_CONDS.includes(name)) return 'visibility';
  if (category === 'condition' && NEG_CONDS.includes(name)) return 'harmful';
  if (category === 'condition' && POS_CONDS.includes(name)) return 'status';

  const bonusType = resolvePrimaryBonusType(effect?.modifiers);
  if (bonusType === 'item') return 'item';
  if (bonusType === 'status') return 'status';
  if (bonusType === 'circumstance') return 'circumstance';
  if (category === 'spell') return 'status';
  if (category === 'item') return 'item';
  if (category === 'custom') return 'custom';
  return 'untyped';
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

  const sourceName = String(effect.source?.name || '').trim();
  const effectName = String(effect.label || effect.name || '').trim();
  if (!sourceName) return effectName || (category === 'affliction' ? 'Affliction' : 'Custom Condition');
  if (!effectName || normalizeComparableName(sourceName).includes(normalizeComparableName(effectName))) return sourceName;
  if (normalizeComparableName(sourceName) === normalizeComparableName(effectName)) return sourceName;
  return `${sourceName}: ${effectName}`;
}

function resolveEffectDescription(effect, category, conditionEntry) {
  if (category === 'condition') {
    return conditionEntry?.description || 'No condition description is available.';
  }
  if (category === 'damage_effect') return PERSISTENT_DAMAGE_DESCRIPTION;
  if (category === 'affliction') return effect.description || AFFLICTION_DESCRIPTION;
  if (category === 'custom') return effect.description || CUSTOM_CONDITION_DESCRIPTION;
  if (effect.description || effect.definitionSnapshot?.description) {
    return effect.description || effect.definitionSnapshot.description;
  }
  const sourceName = effect.source?.name || effect.label || 'source';
  return `Active ${category} effect from ${sourceName}.`;
}

function resolvePrimaryBonusType(modifiers = []) {
  const candidates = (Array.isArray(modifiers) ? modifiers : [])
    .filter((modifier) => ['bonus', 'penalty'].includes(modifier.mode || 'bonus'))
    .map((modifier) => ({
      type: modifier.bonusType || 'untyped',
      magnitude: Math.abs(Number(modifier.value) || 0),
    }))
    .sort((left, right) => right.magnitude - left.magnitude || bonusTypeOrder(left.type) - bonusTypeOrder(right.type));
  return candidates[0]?.type || null;
}

function bonusTypeOrder(type) {
  return ['item', 'status', 'circumstance', 'untyped'].indexOf(type);
}

function normalizeComparableName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function compareEffectPresentationItems(left, right) {
  const categoryOrder = {
    condition: 0,
    damage_effect: 1,
    affliction: 2,
    item: 3,
    spell: 4,
    impulse: 5,
    feat: 6,
    custom: 7,
  };
  const categoryDifference = (categoryOrder[left.category] ?? 99) - (categoryOrder[right.category] ?? 99);
  if (categoryDifference !== 0) return categoryDifference;
  return String(left.label).localeCompare(String(right.label)) || String(left.id).localeCompare(String(right.id));
}
