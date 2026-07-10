const LEGACY_GENERIC_CONDITION_NAMES = new Set(['persistent damage', 'fast healing']);

export function isLegacyGenericConditionEffect(effect) {
  return String(effect?.category || '').toLowerCase() === 'condition'
    && LEGACY_GENERIC_CONDITION_NAMES.has(normalizeLabel(effect));
}

export function isLegacyGenericCombatantCondition(condition) {
  return LEGACY_GENERIC_CONDITION_NAMES.has(String(condition || '').trim().toLowerCase());
}

export function buildLegacyConditionCleanupPlan({ campaignId, effects = [], encounters = [] } = {}) {
  const effectRecords = Array.isArray(effects) ? effects : [];
  const encounterRecords = Array.isArray(encounters) ? encounters : [];
  const legacyEffects = effectRecords.filter(isLegacyGenericConditionEffect);
  const encounterUpdates = encounterRecords.flatMap((encounter) => {
    const combatants = Array.isArray(encounter?.combatants) ? encounter.combatants : [];
    const cleanedCombatants = combatants.map((combatant) => ({
      ...combatant,
      conditions: Array.isArray(combatant?.conditions)
        ? combatant.conditions.filter((condition) => !isLegacyGenericCombatantCondition(condition))
        : combatant?.conditions,
    }));
    const affectedCombatants = combatants.filter((combatant, index) => (
      JSON.stringify(combatant?.conditions || []) !== JSON.stringify(cleanedCombatants[index]?.conditions || [])
    ));

    return affectedCombatants.length
      ? [{
        encounterId: encounter.id,
        originalCombatants: combatants,
        cleanedCombatants,
        affectedCombatantIds: affectedCombatants.map((combatant) => combatant.id),
      }]
      : [];
  });

  return {
    campaignId: campaignId || null,
    effectIds: legacyEffects.map((effect) => effect.id).filter(Boolean),
    effectSnapshots: legacyEffects,
    encounterUpdates,
    counts: {
      actorEffects: legacyEffects.length,
      encounters: encounterUpdates.length,
      combatants: encounterUpdates.reduce((total, update) => total + update.affectedCombatantIds.length, 0),
    },
  };
}

function normalizeLabel(value) {
  return String(value?.label || value?.name || '').trim().toLowerCase();
}
