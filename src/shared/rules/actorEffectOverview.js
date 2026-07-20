import {
  buildEffectPresentationItem,
  buildEffectPresentationItems,
} from '../effects/effectPresentation.js';
import {
  EFFECT_SELECTOR_GROUPS,
  EFFECT_SELECTOR_REGISTRY,
} from './effectDefinitions.js';
import {
  explainEffectModifiersForSelectors,
  resolveDamageEffects,
  resolveResistanceWeakness,
} from './effectResolver.js';

const SOURCE_GROUPS = Object.freeze([
  { id: 'conditions', label: 'Conditions & Afflictions', order: 10 },
  { id: 'items', label: 'Item Effects', order: 20 },
  { id: 'magic', label: 'Magic Effects', order: 30 },
  { id: 'feats', label: 'Feat & Impulse Effects', order: 40 },
  { id: 'other', label: 'Other Effects', order: 50 },
]);
const SELECTOR_LABELS = new Map(EFFECT_SELECTOR_REGISTRY.map((entry) => [entry.value, entry.label]));

export function selectEffectChipItems(actorRules) {
  return buildEffectPresentationItems(
    (actorRules?.effects || []).filter((effect) => !effect?.derived),
    { viewerMode: 'owner' }
  );
}

export function buildActorEffectOverview({ actorRules, campaign = null, scope = 'temporary' } = {}) {
  const allEffects = (actorRules?.effects || []).filter((effect) => effect && !effect.disabled);
  const effects = scope === 'all' ? allEffects : allEffects.filter((effect) => !effect.derived);
  const actorNames = new Map((campaign?.actors || []).map((actor) => [actor.id, actor.name || 'Unknown actor']));
  const presentationByEffectId = new Map(
    effects.map((effect) => [effect.id, buildEffectPresentationItem(effect)]).filter(([, item]) => Boolean(item))
  );
  const contributionByModifier = new Map();

  const selectorRows = EFFECT_SELECTOR_REGISTRY.map((selector) => {
    const resolution = explainEffectModifiersForSelectors(effects, [selector.value]);
    for (const contribution of resolution.contributions) {
      contributionByModifier.set(toModifierKey(contribution.effectId, contribution.modifierId), contribution);
    }
    if (resolution.contributions.length === 0) return null;
    return {
      id: selector.value,
      label: selector.label,
      group: selector.group,
      order: selector.order,
      total: resolution.total,
      breakdown: resolution.breakdown,
      cap: resolution.cap,
      set: resolution.set,
      contributions: resolution.contributions.map((contribution) => enrichContribution(
        contribution,
        presentationByEffectId,
        actorNames
      )),
    };
  }).filter(Boolean);

  const specialRows = buildSpecialEffectRows(effects, presentationByEffectId, actorNames, contributionByModifier);
  const effectGroups = buildEffectGroups([...selectorRows, ...specialRows]);
  const sourceGroups = buildSourceGroups(effects, presentationByEffectId, actorNames, contributionByModifier);

  return {
    scope,
    chips: selectEffectChipItems(actorRules),
    effectGroups,
    sourceGroups,
    temporaryCount: allEffects.filter((effect) => !effect.derived).length,
    derivedCount: allEffects.filter((effect) => effect.derived).length,
    totalCount: effects.length,
  };
}

function buildEffectGroups(rows) {
  const groupById = new Map(EFFECT_SELECTOR_GROUPS.map((group) => [group.id, { ...group, rows: [] }]));
  groupById.set('persistent', { id: 'persistent', label: 'Persistent Damage', order: 0, rows: [] });
  for (const row of rows) {
    const group = groupById.get(row.group) || groupById.get('general');
    group.rows.push(row);
  }
  return [...groupById.values()]
    .filter((group) => group.rows.length > 0)
    .sort((left, right) => left.order - right.order)
    .map((group) => ({ ...group, rows: group.rows.sort((left, right) => (left.order || 0) - (right.order || 0)) }));
}

function buildSpecialEffectRows(effects, presentationByEffectId, actorNames, contributionByModifier) {
  const rows = [];
  const persistent = resolveDamageEffects(effects).persistentByType;
  for (const effect of effects) {
    for (const [index, modifier] of (effect.modifiers || []).entries()) {
      if (modifier.mode !== 'persistent_damage') continue;
      const winner = persistent[modifier.damageType || 'untyped'];
      const modifierId = modifier.id || `${effect.id}:${index}`;
      const contribution = {
        ...modifier,
        effectId: effect.id,
        modifierId,
        source: effect.source || null,
        category: effect.category,
        duration: effect.duration || null,
        derived: Boolean(effect.derived),
        applied: winner?.sourceEffectId === effect.id && (winner?.id || modifierId) === modifierId,
        suppressionReason: null,
      };
      if (!contribution.applied) contribution.suppressionReason = 'Lower persistent damage of the same type';
      contributionByModifier.set(toModifierKey(effect.id, modifierId), contribution);
      rows.push({
        id: `persistent:${effect.id}:${modifierId}`,
        label: `${capitalize(modifier.damageType || 'untyped')} persistent damage`,
        group: 'persistent',
        order: 0,
        total: Number(modifier.value) || 0,
        breakdown: {},
        cap: null,
        set: null,
        formula: modifier.formula || effect.value?.formula || effect.label,
        contributions: [enrichContribution(contribution, presentationByEffectId, actorNames)],
      });
    }
  }

  const resistanceWeakness = resolveResistanceWeakness(effects).netByType;
  Object.entries(resistanceWeakness).forEach(([damageType, values], index) => {
    rows.push({
      id: `damage-defense:${damageType}`,
      label: `${capitalize(damageType)} resistance / weakness`,
      group: 'defenses',
      order: 1000 + index,
      total: values.netResistance - values.netWeakness,
      breakdown: {},
      cap: null,
      set: null,
      detail: values,
      contributions: [],
    });
  });

  effects
    .filter((effect) => !Array.isArray(effect.modifiers) || effect.modifiers.length === 0)
    .forEach((effect, index) => {
      const presentation = presentationByEffectId.get(effect.id) || buildFallbackPresentation(effect);
      rows.push({
        id: `tracked:${effect.id}`,
        label: presentation.label,
        group: 'general',
        order: 2000 + index,
        total: 0,
        breakdown: {},
        cap: null,
        set: null,
        contributions: [{
          effectId: effect.id,
          modifierId: `${effect.id}:tracking`,
          sourceName: effect.source?.name || presentation.label,
          sourceActorName: resolveSourceActorName(effect, actorNames),
          tone: presentation.tone || 'untyped',
          mode: 'tracking',
          bonusType: 'untyped',
          value: 0,
          applied: true,
          suppressionReason: null,
        }],
      });
    });
  return rows;
}

function buildSourceGroups(effects, presentationByEffectId, actorNames, contributionByModifier) {
  const groups = new Map(SOURCE_GROUPS.map((group) => [group.id, { ...group, sources: [] }]));
  for (const effect of effects) {
    const presentation = presentationByEffectId.get(effect.id) || buildFallbackPresentation(effect);
    const sourceActorId = effect.source?.actorId || effect.application?.sourceActorId || null;
    const modifiers = (effect.modifiers || []).map((modifier, index) => {
      const modifierId = modifier.id || `${effect.id}:${index}`;
      const explained = contributionByModifier.get(toModifierKey(effect.id, modifierId));
      return {
        ...modifier,
        modifierId,
        selectorLabel: SELECTOR_LABELS.get(modifier.selector) || modifier.selector || formatSpecialModifierLabel(modifier),
        applied: explained ? explained.applied : true,
        suppressionReason: explained?.suppressionReason || null,
      };
    });
    const groupId = getSourceGroupId(effect.category);
    groups.get(groupId).sources.push({
      id: effect.id,
      label: presentation.label,
      effectLabel: effect.label || effect.name || presentation.label,
      category: effect.category || 'custom',
      tone: presentation.tone || 'untyped',
      sourceName: effect.source?.name || effect.label || presentation.label,
      sourceActorId,
      sourceActorName: sourceActorId ? actorNames.get(sourceActorId) || 'Unknown actor' : null,
      duration: effect.duration || null,
      durationLabel: formatEffectDuration(effect),
      derived: Boolean(effect.derived),
      removable: !effect.derived && Boolean(effect.id),
      modifiers,
    });
  }

  return [...groups.values()]
    .filter((group) => group.sources.length > 0)
    .sort((left, right) => left.order - right.order)
    .map((group) => ({
      ...group,
      sources: group.sources.sort((left, right) => left.label.localeCompare(right.label)),
    }));
}

function formatSpecialModifierLabel(modifier) {
  if (modifier.mode === 'persistent_damage') return `${capitalize(modifier.damageType || 'untyped')} persistent damage`;
  if (modifier.mode === 'resistance') return `${capitalize(modifier.damageType || 'all')} resistance`;
  if (modifier.mode === 'weakness') return `${capitalize(modifier.damageType || 'all')} weakness`;
  return 'Effect modifier';
}

function enrichContribution(contribution, presentationByEffectId, actorNames) {
  const presentation = presentationByEffectId.get(contribution.effectId);
  const sourceActorId = contribution.sourceActorId || contribution.source?.actorId || null;
  return {
    ...contribution,
    effectLabel: presentation?.label || contribution.sourceLabel || 'Effect',
    tone: presentation?.tone || contribution.bonusType || 'untyped',
    sourceName: contribution.source?.name || presentation?.label || contribution.sourceLabel || 'Effect',
    sourceActorName: sourceActorId ? actorNames.get(sourceActorId) || 'Unknown actor' : null,
  };
}

function buildFallbackPresentation(effect) {
  return {
    label: effect.label || effect.name || 'Effect',
    tone: effect.category === 'item' ? 'item' : effect.category === 'spell' ? 'status' : 'untyped',
  };
}

function resolveSourceActorName(effect, actorNames) {
  const sourceActorId = effect?.source?.actorId || effect?.application?.sourceActorId || null;
  return sourceActorId ? actorNames.get(sourceActorId) || 'Unknown actor' : null;
}

function getSourceGroupId(categoryInput) {
  const category = String(categoryInput || '').toLowerCase();
  if (['condition', 'affliction', 'damage_effect'].includes(category)) return 'conditions';
  if (category === 'item') return 'items';
  if (category === 'spell') return 'magic';
  if (['feat', 'impulse'].includes(category)) return 'feats';
  return 'other';
}

export function formatEffectDuration(effect) {
  if (effect?.derived) {
    const trigger = effect.definitionSnapshot?.activation?.trigger;
    if (trigger === 'equipped') return 'Equipped';
    if (trigger === 'owned') return 'Owned';
    return 'Passive';
  }
  const duration = effect?.duration || {};
  if (duration.unit === 'daily_preparation') return 'Until daily preparation';
  if (duration.unit === 'rounds' || duration.unit === 'minutes') {
    const rounds = Math.max(0, Number(duration.remainingRounds) || 0);
    if (duration.unit === 'minutes') return `${Math.ceil(rounds / 10)} min remaining`;
    return `${rounds} round${rounds === 1 ? '' : 's'} remaining`;
  }
  if (duration.unit === 'unlimited') return 'Unlimited';
  return 'Manual';
}

function toModifierKey(effectId, modifierId) {
  return `${effectId || 'effect'}:${modifierId || 'modifier'}`;
}

function capitalize(value) {
  const text = String(value || '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
