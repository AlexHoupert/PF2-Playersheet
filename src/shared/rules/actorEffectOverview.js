import {
  buildEffectPresentationItem,
  buildEffectPresentationItems,
} from '../effects/effectPresentation.js';
import { buildStandardConditionRuleTree } from './conditionEffectRules.js';
import {
  EFFECT_SELECTOR_GROUPS,
  EFFECT_SELECTOR_REGISTRY,
} from './effectDefinitions.js';
import {
  explainEffectModifiersForSelectors,
  normalizeEffectSelector,
  resolveDamageEffects,
  resolveResistanceWeakness,
} from './effectResolver.js';
import { actorHasImpulses, actorHasMagic } from '../actors/actorCapabilities.js';

const SOURCE_GROUPS = Object.freeze([
  { id: 'conditions', label: 'Conditions & Afflictions', order: 10 },
  { id: 'items', label: 'Item Effects', order: 20 },
  { id: 'magic', label: 'Magic Effects', order: 30 },
  { id: 'feats', label: 'Feat & Impulse Effects', order: 40 },
  { id: 'other', label: 'Other Effects', order: 50 },
]);
const ATTRIBUTABLE_SOURCE_TYPES = new Set(['item', 'spell', 'feat', 'impulse', 'ability', 'action']);
const ATTRIBUTABLE_TRIGGERS = new Set(['cast', 'activate', 'consume']);
const SELECTOR_LABELS = new Map(EFFECT_SELECTOR_REGISTRY.map((entry) => [entry.value, entry.label]));
const ATTACK_SELECTORS = new Set([
  'attack.all',
  'attack.strength',
  'attack.dexterity',
  'attack.melee',
  'attack.ranged',
  'spell.attack',
  'impulse.attack',
]);
const SKILL_SELECTORS = EFFECT_SELECTOR_REGISTRY
  .filter((entry) => entry.value.startsWith('skill.') && entry.value !== 'skill.lore')
  .map((entry) => entry.value);
const BROAD_CHECK_DOMAINS = Object.freeze([
  { id: 'attacks', label: 'Attack Rolls', selectors: ['attack.all'] },
  { id: 'skills', label: 'Skill Checks', selectors: SKILL_SELECTORS },
  { id: 'saves', label: 'Saving Throws', selectors: ['save.fortitude', 'save.reflex', 'save.will'] },
  { id: 'perception', label: 'Perception', selectors: ['perception'] },
]);

export function selectEffectChipItems(actorRules) {
  return buildEffectPresentationItems(
    (actorRules?.effects || []).filter((effect) => !effect?.derived),
    { viewerMode: 'owner' }
  );
}

export function buildActorEffectOverview({ actorRules, campaign = null, scope = 'temporary' } = {}) {
  const allEffects = (actorRules?.effects || []).filter((effect) => effect && !effect.disabled);
  const effects = scope === 'all' ? allEffects : allEffects.filter((effect) => !effect.derived);
  const presentationByEffectId = new Map(
    effects.map((effect) => [effect.id, buildEffectPresentationItem(effect)]).filter(([, item]) => Boolean(item))
  );
  const sourceActorByEffectId = new Map(
    effects.map((effect) => [effect.id, resolveVisibleSourceActor(effect, campaign)])
  );
  const conditionReferenceByEffectId = new Map(
    effects
      .filter((effect) => effect.category === 'condition')
      .map((effect) => [effect.id, buildConditionReference(effect)])
  );
  const conditionReferenceByModifierKey = buildConditionReferenceByModifierKey(effects);
  const contributionByModifier = buildCanonicalContributionMap(effects);

  const rawSelectorRows = EFFECT_SELECTOR_REGISTRY
    .filter((selector) => selector.showInOverview !== false)
    .map((selector) => {
      const resolution = explainEffectModifiersForSelectors(effects, [selector.value]);
      if (resolution.contributions.length === 0) return null;
      return {
        id: selector.value,
        kind: 'selector',
        label: selector.label,
        group: selector.group,
        order: selector.order,
        total: resolution.total,
        breakdown: resolution.breakdown,
        cap: resolution.cap,
        set: resolution.set,
        tone: resolution.total < 0 ? 'harmful' : 'untyped',
        contributions: resolution.contributions.map((contribution) => enrichContribution(
          contribution,
          presentationByEffectId,
          sourceActorByEffectId,
          conditionReferenceByEffectId,
          conditionReferenceByModifierKey
        )),
        children: [],
      };
    })
    .filter(Boolean);
  const selectorRows = selectVisibleAttackRows({
    actorRules,
    selectorRows: rawSelectorRows,
    directContributions: effects.flatMap((effect) => effect.modifiers || []),
  });

  const specialRows = buildSpecialEffectRows(
    effects,
    presentationByEffectId,
    sourceActorByEffectId,
    conditionReferenceByEffectId,
    conditionReferenceByModifierKey,
    contributionByModifier
  );
  const effectGroups = buildEffectGroups([...selectorRows, ...specialRows]);
  const sourceGroups = buildSourceGroups(
    effects,
    presentationByEffectId,
    sourceActorByEffectId,
    conditionReferenceByEffectId,
    contributionByModifier
  );

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

export function resolveVisibleSourceActor(effect, campaign) {
  const sourceType = String(effect?.source?.type || '').toLowerCase();
  const trigger = String(
    effect?.definitionSnapshot?.activation?.trigger
      || effect?.application?.trigger
      || ''
  ).toLowerCase();
  const sourceActorId = effect?.source?.actorId || effect?.application?.sourceActorId || null;
  const targetActorId = effect?.targetActorId || effect?.application?.targetActorId || null;
  if (
    !ATTRIBUTABLE_SOURCE_TYPES.has(sourceType)
    || !ATTRIBUTABLE_TRIGGERS.has(trigger)
    || !sourceActorId
    || sourceActorId === targetActorId
  ) return null;
  const actor = (campaign?.actors || []).find((candidate) => candidate.id === sourceActorId);
  return actor ? { id: actor.id, name: actor.name || 'Unknown actor' } : null;
}

export function selectVisibleAttackRows({ actorRules, selectorRows = [], directContributions = [] } = {}) {
  const directSelectors = new Set(
    (directContributions || []).map((modifier) => normalizeEffectSelector(modifier?.selector))
  );
  const actor = actorRules?.character || null;
  const hasBroadAttackEffect = directSelectors.has('all.checks') || directSelectors.has('attack.all');
  const showSpellAttacks = !actor || actorHasMagic(actor);
  const showImpulseAttacks = !actor || actorHasImpulses(actor);

  return (selectorRows || []).filter((row) => {
    if (!ATTACK_SELECTORS.has(row.id)) return true;
    if (row.id === 'attack.all') return hasBroadAttackEffect;
    if (row.id === 'attack.strength') {
      return directSelectors.has('attack.strength') || directSelectors.has('attribute.strength');
    }
    if (row.id === 'attack.dexterity') {
      return directSelectors.has('attack.dexterity') || directSelectors.has('attribute.dexterity');
    }
    if (row.id === 'spell.attack') return showSpellAttacks && directSelectors.has('spell.attack');
    if (row.id === 'impulse.attack') return showImpulseAttacks && directSelectors.has('impulse.attack');
    return directSelectors.has(row.id);
  });
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

function buildSpecialEffectRows(
  effects,
  presentationByEffectId,
  sourceActorByEffectId,
  conditionReferenceByEffectId,
  conditionReferenceByModifierKey,
  contributionByModifier
) {
  const rows = [];
  const persistent = resolveDamageEffects(effects).persistentByType;
  Object.entries(persistent).forEach(([damageType, modifier], index) => {
    const effect = modifier.sourceEffect;
    if (!effect) return;
    const modifierId = modifier.id || `${effect.id}:persistent`;
    const bonusResolution = explainEffectModifiersForSelectors(effects, [
      'damage.persistent',
      `damage.persistent.${damageType}`,
    ]);
    const bonusContributions = bonusResolution.contributions.filter((entry) => entry.mode !== 'persistent_damage');
    for (const contribution of bonusContributions) {
      contributionByModifier.set(toModifierKey(contribution.effectId, contribution.modifierId), contribution);
    }
    contributionByModifier.set(toModifierKey(effect.id, modifierId), {
      ...modifier,
      effectId: effect.id,
      modifierId,
      applied: true,
      suppressionReason: null,
    });
    rows.push({
      id: `persistent:${damageType}`,
      kind: 'persistent_damage',
      label: 'Persistent Damage',
      group: 'persistent',
      order: index,
      total: bonusResolution.total,
      breakdown: bonusResolution.breakdown,
      cap: null,
      set: null,
      formula: formatPersistentFormula(effect, modifier),
      damageType,
      tone: 'persistent',
      sourceName: effect.source?.name || effect.label || 'Persistent Damage',
      sourceActorName: sourceActorByEffectId.get(effect.id)?.name || null,
      contributions: bonusContributions.map((contribution) => enrichContribution(
        contribution,
        presentationByEffectId,
        sourceActorByEffectId,
        conditionReferenceByEffectId,
        conditionReferenceByModifierKey
      )),
      children: [],
    });
  });

  const resistanceWeakness = resolveResistanceWeakness(effects).netByType;
  Object.entries(resistanceWeakness).forEach(([damageType, values], index) => {
    rows.push({
      id: `damage-defense:${damageType}`,
      kind: 'selector',
      label: `${capitalize(damageType)} resistance / weakness`,
      group: 'defenses',
      order: 1000 + index,
      total: values.netResistance - values.netWeakness,
      breakdown: {},
      cap: null,
      set: null,
      detail: values,
      tone: values.netResistance - values.netWeakness < 0 ? 'harmful' : 'untyped',
      contributions: [],
      children: [],
    });
  });

  effects
    .filter((effect) => !Array.isArray(effect.modifiers) || effect.modifiers.length === 0)
    .forEach((effect, index) => {
      const presentation = presentationByEffectId.get(effect.id) || buildFallbackPresentation(effect);
      rows.push({
        id: `tracked:${effect.id}`,
        kind: 'tracked',
        label: presentation.label,
        group: 'general',
        order: 2000 + index,
        total: 0,
        breakdown: {},
        cap: null,
        set: null,
        tone: presentation.tone || 'untyped',
        contributions: [{
          effectId: effect.id,
          modifierId: `${effect.id}:tracking`,
          sourceName: effect.source?.name || presentation.label,
          sourceActorName: sourceActorByEffectId.get(effect.id)?.name || null,
          tone: presentation.tone || 'untyped',
          mode: 'tracking',
          bonusType: 'untyped',
          value: 0,
          applied: true,
          suppressionReason: null,
          conditionReference: conditionReferenceByEffectId.get(effect.id) || null,
        }],
        children: [],
      });
    });
  return rows;
}

function buildSourceGroups(
  effects,
  presentationByEffectId,
  sourceActorByEffectId,
  conditionReferenceByEffectId,
  contributionByModifier
) {
  const sourceRows = effects.map((effect) => {
    const presentation = presentationByEffectId.get(effect.id) || buildFallbackPresentation(effect);
    const sourceActor = sourceActorByEffectId.get(effect.id);
    const modifiers = (effect.modifiers || [])
      .filter((modifier) => modifier.selector !== 'ac.dex_cap')
      .map((modifier, index) => enrichSourceModifier(effect, modifier, index, contributionByModifier));
    const displayModifiers = expandBroadSourceModifiers(effect, modifiers, effects);
    const ruleTree = effect.category === 'condition'
      ? effect.ruleTree || buildStandardConditionRuleTree(effect.label || effect.name, effect.value)
      : null;
    const tree = ruleTree ? buildRuleTreeView(ruleTree, displayModifiers) : null;
    const persistentModifier = displayModifiers.find((modifier) => modifier.mode === 'persistent_damage');
    return {
      id: effect.id,
      label: effect.category === 'damage_effect' ? 'Persistent Damage' : presentation.label,
      effectLabel: effect.label || effect.name || presentation.label,
      category: effect.category || 'custom',
      kind: effect.category === 'damage_effect' ? 'persistent_damage' : 'source',
      tone: effect.category === 'damage_effect' ? 'persistent' : presentation.tone || 'untyped',
      sourceName: effect.source?.name || effect.label || presentation.label,
      sourceActorId: sourceActor?.id || null,
      sourceActorName: sourceActor?.name || null,
      duration: effect.duration || null,
      durationLabel: formatEffectDuration(effect),
      derived: Boolean(effect.derived),
      removable: !effect.derived && Boolean(effect.id),
      summaryValue: persistentModifier ? formatPersistentFormula(effect, persistentModifier) : null,
      modifiers: tree ? tree.modifiers : displayModifiers.filter((modifier) => modifier.mode !== 'persistent_damage'),
      children: tree?.children || [],
      childSources: [],
      parentEffectId: effect.application?.parentEffectId || null,
      conditionReference: conditionReferenceByEffectId.get(effect.id) || null,
    };
  });

  const sourceById = new Map(sourceRows.map((source) => [source.id, source]));
  const nestedIds = new Set();
  for (const source of sourceRows) {
    const parent = source.parentEffectId ? sourceById.get(source.parentEffectId) : null;
    if (!parent) continue;
    parent.childSources.push(source);
    nestedIds.add(source.id);
  }

  const groups = new Map(SOURCE_GROUPS.map((group) => [group.id, { ...group, sources: [] }]));
  sourceRows.filter((source) => !nestedIds.has(source.id)).forEach((source) => {
    groups.get(getSourceGroupId(source.category)).sources.push(source);
  });
  return [...groups.values()]
    .filter((group) => group.sources.length > 0)
    .sort((left, right) => left.order - right.order)
    .map((group) => ({
      ...group,
      sources: group.sources.sort((left, right) => left.label.localeCompare(right.label)),
    }));
}

function enrichSourceModifier(effect, modifier, index, contributionByModifier) {
  const modifierId = modifier.id || `${effect.id}:${index}`;
  const explained = contributionByModifier.get(toModifierKey(effect.id, modifierId));
  return {
    ...modifier,
    modifierId,
    displayId: modifierId,
    selectorLabel: SELECTOR_LABELS.get(modifier.selector) || modifier.selector || formatSpecialModifierLabel(modifier),
    applied: explained ? explained.applied : true,
    suppressionReason: explained?.suppressionReason || null,
  };
}

function buildRuleTreeView(node, modifiers) {
  const byNodeId = new Map();
  for (const modifier of modifiers) {
    const nodeId = modifier.ruleNodeId || node.id;
    if (!byNodeId.has(nodeId)) byNodeId.set(nodeId, []);
    byNodeId.get(nodeId).push(modifier);
  }
  const mapNode = (current) => ({
    id: current.id,
    label: current.label,
    kind: current.kind,
    conditionReference: current.conditionName
      ? {
          effectId: null,
          conditionName: current.conditionName,
          value: current.value ?? 1,
          derived: current.kind !== 'condition',
        }
      : null,
    modifiers: byNodeId.get(current.id) || [],
    children: (current.children || []).map(mapNode),
  });
  return mapNode(node);
}

function formatSpecialModifierLabel(modifier) {
  if (modifier.mode === 'persistent_damage') return `${capitalize(modifier.damageType || 'untyped')} persistent damage`;
  if (modifier.mode === 'resistance') return `${capitalize(modifier.damageType || 'all')} resistance`;
  if (modifier.mode === 'weakness') return `${capitalize(modifier.damageType || 'all')} weakness`;
  return 'Effect modifier';
}

function enrichContribution(
  contribution,
  presentationByEffectId,
  sourceActorByEffectId,
  conditionReferenceByEffectId,
  conditionReferenceByModifierKey
) {
  const presentation = presentationByEffectId.get(contribution.effectId);
  return {
    ...contribution,
    effectLabel: presentation?.label || contribution.sourceLabel || 'Effect',
    tone: presentation?.tone || contribution.bonusType || 'untyped',
    sourceName: contribution.source?.name || presentation?.label || contribution.sourceLabel || 'Effect',
    sourceActorName: sourceActorByEffectId.get(contribution.effectId)?.name || null,
    conditionReference: conditionReferenceByModifierKey.get(toModifierKey(
      contribution.effectId,
      contribution.modifierId
    )) || conditionReferenceByEffectId.get(contribution.effectId) || null,
  };
}

function buildConditionReferenceByModifierKey(effects) {
  const references = new Map();
  for (const effect of effects) {
    if (effect.category !== 'condition') continue;
    const root = effect.ruleTree || buildStandardConditionRuleTree(
      effect.label || effect.name,
      effect.value
    );
    const rootReference = buildConditionReference(effect);
    const visit = (node) => {
      const reference = node.conditionName
        ? {
            effectId: node.kind === 'condition' ? effect.id : null,
            conditionName: node.conditionName,
            value: node.value ?? 1,
            derived: node.kind !== 'condition',
          }
        : rootReference;
      for (const modifier of node.modifiers || []) {
        if (!modifier.id) continue;
        references.set(toModifierKey(effect.id, modifier.id), reference);
      }
      for (const child of node.children || []) visit(child);
    };
    visit(root);
  }
  return references;
}

function buildCanonicalContributionMap(effects) {
  const contributionByModifier = new Map();
  const resolutionBySelector = new Map();

  for (const effect of effects) {
    (effect.modifiers || []).forEach((modifier, index) => {
      const modifierId = modifier.id || `${effect.id}:${index}`;
      const key = toModifierKey(effect.id, modifierId);
      if (modifier.mode === 'persistent_damage') {
        contributionByModifier.set(key, {
          ...modifier,
          effectId: effect.id,
          modifierId,
          applied: true,
          suppressionReason: null,
        });
        return;
      }

      const selector = normalizeEffectSelector(modifier.selector);
      if (!resolutionBySelector.has(selector)) {
        resolutionBySelector.set(selector, explainEffectModifiersForSelectors(effects, [selector]));
      }
      const explained = resolutionBySelector.get(selector).contributions.find((entry) => (
        toModifierKey(entry.effectId, entry.modifierId) === key
      ));
      if (explained) contributionByModifier.set(key, explained);
    });
  }

  return contributionByModifier;
}

function expandBroadSourceModifiers(effect, modifiers, effects) {
  return modifiers.flatMap((modifier) => {
    const selector = normalizeEffectSelector(modifier.selector);
    if (selector === 'all.checks') {
      return BROAD_CHECK_DOMAINS.map((domain) => enrichDomainModifier(
        effect,
        modifier,
        domain,
        effects
      ));
    }
    if (selector === 'all.dcs') {
      return [enrichDomainModifier(effect, modifier, {
        id: 'dcs',
        label: 'DCs',
        selectors: ['all.dcs'],
      }, effects)];
    }
    return [modifier];
  });
}

function enrichDomainModifier(effect, modifier, domain, effects) {
  const key = toModifierKey(effect.id, modifier.modifierId);
  const explanations = domain.selectors.map((selector) => (
    explainEffectModifiersForSelectors(effects, [selector]).contributions.find((entry) => (
      toModifierKey(entry.effectId, entry.modifierId) === key
    ))
  )).filter(Boolean);
  const applied = explanations.some((entry) => entry.applied);
  const suppressionReason = applied
    ? null
    : explanations.find((entry) => entry.suppressionReason)?.suppressionReason || modifier.suppressionReason;
  return {
    ...modifier,
    displayId: `${modifier.modifierId}:domain:${domain.id}`,
    selectorLabel: domain.label,
    applied,
    suppressionReason,
  };
}

function buildConditionReference(effect) {
  return {
    effectId: effect.id || null,
    conditionName: effect.label || effect.name || 'Condition',
    value: Number(effect.value) || 1,
    derived: false,
  };
}

function buildFallbackPresentation(effect) {
  return {
    label: effect.label || effect.name || 'Effect',
    tone: effect.category === 'item' ? 'item' : effect.category === 'spell' ? 'status' : 'untyped',
  };
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

function formatPersistentFormula(effect, modifier) {
  const formula = modifier?.formula || effect?.value?.formula || effect?.label || 'Persistent damage';
  return String(formula).replace(/\s+persistent$/i, '').trim();
}

function toModifierKey(effectId, modifierId) {
  return `${effectId || 'effect'}:${modifierId || 'modifier'}`;
}

function capitalize(value) {
  const text = String(value || '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
