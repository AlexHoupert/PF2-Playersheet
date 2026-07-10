export function isDefeatedCombatant(combatant) {
  return Boolean(combatant?.defeatedAt);
}

export function getEncounterTurnOrder(combatants) {
  return (Array.isArray(combatants) ? combatants : [])
    .map((combatant, index) => ({ combatant, index }))
    .sort((left, right) => {
      const initiativeDifference = numericInitiative(right.combatant) - numericInitiative(left.combatant);
      if (initiativeDifference !== 0) return initiativeDifference;
      return left.index - right.index || String(left.combatant?.id || '').localeCompare(String(right.combatant?.id || ''));
    })
    .map(({ combatant }) => combatant);
}

export function getEligibleEncounterCombatants(encounter) {
  return getEncounterTurnOrder(encounter?.combatants).filter((combatant) => !isDefeatedCombatant(combatant));
}

export function getCurrentTurnCombatantId(encounter) {
  const ordered = getEncounterTurnOrder(encounter?.combatants);
  if (ordered.length === 0) return null;

  const currentId = encounter?.currentTurnCombatantId;
  if (currentId && ordered.some((combatant) => combatant.id === currentId && !isDefeatedCombatant(combatant))) {
    return currentId;
  }

  const legacyIndex = normalizeIndex(encounter?.currentTurnIndex, ordered.length);
  for (let offset = 0; offset < ordered.length; offset += 1) {
    const candidate = ordered[(legacyIndex + offset) % ordered.length];
    if (!isDefeatedCombatant(candidate)) return candidate.id;
  }
  return null;
}

export function getCurrentTurnIndex(encounter) {
  const currentId = getCurrentTurnCombatantId(encounter);
  if (!currentId) return 0;
  const index = getEncounterTurnOrder(encounter?.combatants).findIndex((combatant) => combatant.id === currentId);
  return index >= 0 ? index : 0;
}

export function getNextTurnCombatantId(encounter, fromCombatantId = getCurrentTurnCombatantId(encounter)) {
  const ordered = getEncounterTurnOrder(encounter?.combatants);
  if (ordered.length === 0 || !ordered.some((combatant) => !isDefeatedCombatant(combatant))) return null;

  const startIndex = ordered.findIndex((combatant) => combatant.id === fromCombatantId);
  if (startIndex < 0) return ordered.find((combatant) => !isDefeatedCombatant(combatant))?.id || null;

  for (let offset = 1; offset <= ordered.length; offset += 1) {
    const candidate = ordered[(startIndex + offset) % ordered.length];
    if (!isDefeatedCombatant(candidate)) return candidate.id;
  }
  return null;
}

export function getRoundStartCombatantId(encounter) {
  return getEligibleEncounterCombatants(encounter)[0]?.id || null;
}

export function getRotatedEncounterTurnOrder(encounter, options = {}) {
  const { includeDefeated = true } = options;
  const ordered = getEncounterTurnOrder(encounter?.combatants);
  const currentId = getCurrentTurnCombatantId(encounter);
  const startIndex = ordered.findIndex((combatant) => combatant.id === currentId);
  const rotated = startIndex >= 0
    ? [...ordered.slice(startIndex), ...ordered.slice(0, startIndex)]
    : ordered;
  return includeDefeated ? rotated : rotated.filter((combatant) => !isDefeatedCombatant(combatant));
}

function numericInitiative(combatant) {
  const value = Number(combatant?.initiative);
  return Number.isFinite(value) ? value : 0;
}

function normalizeIndex(value, total) {
  if (total <= 0) return 0;
  const index = Number.isFinite(Number(value)) ? Number(value) : 0;
  return ((index % total) + total) % total;
}
