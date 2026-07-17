import { isSoftDeleted, markDeleted, markRestored } from "./campaignReducers.js";
import { cloneValue, createInstanceId } from "./inventoryReducers.js";
import { applyRecordUpdater } from "./updateHelpers.js";
import {
  getCurrentTurnCombatantId,
  getCurrentTurnIndex,
  getNextTurnCombatantId,
  getRoundStartCombatantId,
} from "../../encounter/turnOrder.js";

export function createEncounterRecord(nameOrEncounter, options = {}) {
  const { createId = () => createInstanceId("encounter") } = options;
  const source =
    typeof nameOrEncounter === "string"
      ? { name: nameOrEncounter }
      : cloneValue(nameOrEncounter) || {};

  const next = {
    id: source.id || createId(source),
    name: source.name || "New Encounter",
    isActive: Boolean(source.isActive),
    currentTurnIndex: Number.isFinite(Number(source.currentTurnIndex)) ? Number(source.currentTurnIndex) : 0,
    turnSequence: Number.isFinite(Number(source.turnSequence)) ? Math.max(0, Number(source.turnSequence)) : 0,
    roundNumber: Number.isFinite(Number(source.roundNumber)) ? Math.max(1, Number(source.roundNumber)) : 1,
    selectedEntityId: source.selectedEntityId || null,
    combatants: Array.isArray(source.combatants) ? source.combatants.map(normalizeCombatant) : [],
    ...source,
  };
  delete next.deletedAt;
  delete next.deletedBy;
  return normalizeEncounter(next);
}

export function createCombatantRecord(type, data, options = {}) {
  const { createId = () => createInstanceId("combatant") } = options;
  if (type === "player") {
    const maxHp = data?.stats?.hp?.max ?? data?.hp?.max ?? 0;
    const currentHp = data?.stats?.hp?.current ?? data?.hp?.current ?? maxHp;
    const id = createId(data);
    return normalizeCombatant({
      id,
      type: "player",
      playerId: data?.id,
      effectTargetId: data?.id || id,
      creatureId: null,
      name: data?.name || "Player",
      instanceLabel: 1,
      initiative: 0,
      currentHp,
      maxHp,
      conditions: [],
      visible: true,
    });
  }

  const hp = data?.system?.attributes?.hp?.max ?? data?.hp?.max ?? 0;
  const id = createId(data);
  return normalizeCombatant({
    id,
    type: "creature",
    effectTargetId: data?.effectTargetId || buildEncounterCombatantEffectTargetId(options.encounterId, id),
    creatureId: data?._catalogId || data?.id || data?.name,
    name: data?.name || "Creature",
    unknownName: data?.unknownName || "???",
    instanceLabel: 1,
    initiative: 0,
    currentHp: hp,
    maxHp: hp,
    conditions: [],
    visible: true,
    playerId: null,
  });
}

export function applyEncounterUpdate(encounter, updater) {
  const current = normalizeEncounter(encounter);
  const result = applyRecordUpdater(cloneValue(current), updater);
  return normalizeEncounter(result);
}

export function createEncounterInCampaign(campaign, nameOrEncounter, options = {}) {
  const next = normalizeCampaignEncounters(campaign);
  const encounter = createEncounterRecord(nameOrEncounter, options);
  next.encounters.push(encounter);
  return { campaign: next, encounter };
}

export function updateEncounterInCampaign(campaign, encounterId, updater) {
  const next = normalizeCampaignEncounters(campaign);
  const index = next.encounters.findIndex((encounter) => encounter.id === encounterId);
  if (index < 0) return next;
  next.encounters[index] = applyEncounterUpdate(next.encounters[index], updater);
  return next;
}

export function softDeleteEncounterInCampaign(campaign, encounterId, options = {}) {
  return updateEncounterInCampaign(campaign, encounterId, (encounter) => ({
    ...markDeleted(encounter, options),
    isActive: false,
    selectedEntityId: null,
  }));
}

export function restoreEncounterInCampaign(campaign, encounterId, options = {}) {
  return updateEncounterInCampaign(campaign, encounterId, (encounter) => markRestored(encounter, options));
}

export function activateEncounterInCampaign(campaign, encounterId) {
  const next = normalizeCampaignEncounters(campaign);
  next.encounters = next.encounters.map((encounter) => ({
    ...encounter,
    isActive: !isSoftDeleted(encounter) && encounter.id === encounterId,
  }));
  return next;
}

export function addCombatantToEncounterInCampaign(campaign, encounterId, type, data, options = {}) {
  return updateEncounterInCampaign(campaign, encounterId, (encounter) => {
    const combatants = Array.isArray(encounter.combatants) ? [...encounter.combatants] : [];
    const combatant = createCombatantRecord(type, data, { ...options, encounterId });

    if (type === "player" && combatant.playerId && combatants.some((entry) => entry.playerId === combatant.playerId)) {
      return encounter;
    }

    if (type === "creature") {
      const sameCreatureCount = combatants.filter((entry) => entry.creatureId === combatant.creatureId).length;
      combatant.instanceLabel = sameCreatureCount + 1;
    }

    return {
      ...encounter,
      combatants: [...combatants, combatant],
    };
  });
}

export function addAllPlayersToEncounterInCampaign(campaign, encounterId, options = {}) {
  const next = normalizeCampaignEncounters(campaign);
  const characters = Array.isArray(next.characters) ? next.characters.filter((character) => !isSoftDeleted(character)) : [];
  const index = next.encounters.findIndex((encounter) => encounter.id === encounterId);
  if (index < 0) return next;

  let encounter = next.encounters[index];
  characters.forEach((character) => {
    if (encounter.combatants.some((combatant) => combatant.playerId === character.id)) return;
    encounter = addCombatantToEncounterInCampaign(
      { ...next, encounters: [encounter] },
      encounter.id,
      "player",
      character,
      options
    ).encounters[0];
  });
  next.encounters[index] = encounter;
  return next;
}

export function removeCombatantFromEncounterInCampaign(campaign, encounterId, combatantId) {
  return updateEncounterInCampaign(campaign, encounterId, (encounter) => {
    const combatants = (encounter.combatants || []).filter((combatant) => combatant.id !== combatantId);
    return {
      ...encounter,
      combatants,
      selectedEntityId: encounter.selectedEntityId === combatantId ? null : encounter.selectedEntityId,
    };
  });
}

export function updateCombatantInEncounterInCampaign(campaign, encounterId, combatantId, updater) {
  return updateEncounterInCampaign(campaign, encounterId, (encounter) => {
    const combatants = (encounter.combatants || []).map((combatant) => {
      if (combatant.id !== combatantId) return combatant;
      const current = normalizeCombatant(combatant);
      const next = typeof updater === "function" ? updater(cloneValue(current)) : { ...current, ...updater };
      return normalizeCombatant(next || current);
    });
    return { ...encounter, combatants };
  });
}

export function setCombatantDefeatedInCampaign(campaign, encounterId, combatantId, options = {}) {
  return updateEncounterInCampaign(campaign, encounterId, (encounter) => {
    const currentTurnId = getCurrentTurnCombatantId(encounter);
    const combatant = (encounter.combatants || []).find((entry) => entry.id === combatantId);
    if (!combatant || combatant.type !== "creature") return encounter;

    const next = {
      ...encounter,
      combatants: (encounter.combatants || []).map((entry) => (
        entry.id === combatantId
          ? {
            ...entry,
            currentHp: 0,
            defeatedAt: options.now || new Date().toISOString(),
            defeatedBy: options.actorEmail || null,
          }
          : entry
      )),
      selectedEntityId: encounter.selectedEntityId === combatantId ? null : encounter.selectedEntityId,
    };

    if (currentTurnId === combatantId) {
      next.currentTurnCombatantId = getNextTurnCombatantId(next, combatantId);
    }
    return next;
  });
}

export function selectEncounterEntityInCampaign(campaign, encounterId, entityId) {
  return updateEncounterInCampaign(campaign, encounterId, (encounter) => ({
    ...encounter,
    selectedEntityId: encounter.selectedEntityId === entityId ? null : entityId,
  }));
}

export function endEncounterTurnInCampaign(campaign, encounterId) {
  return updateEncounterInCampaign(campaign, encounterId, (encounter) => {
    const currentTurnCombatantId = getNextTurnCombatantId(encounter);
    const startsNewRound = Boolean(currentTurnCombatantId)
      && currentTurnCombatantId === getRoundStartCombatantId(encounter);
    return {
      ...encounter,
      currentTurnCombatantId,
      turnSequence: (Number(encounter.turnSequence) || 0) + 1,
      roundNumber: Math.max(1, Number(encounter.roundNumber) || 1) + (startsNewRound ? 1 : 0),
    };
  });
}

export function resetEncounterRoundInCampaign(campaign, encounterId) {
  return updateEncounterInCampaign(campaign, encounterId, (encounter) => ({
    ...encounter,
    currentTurnCombatantId: getRoundStartCombatantId(encounter),
    turnSequence: (Number(encounter.turnSequence) || 0) + 1,
    roundNumber: Math.max(1, Number(encounter.roundNumber) || 1) + 1,
  }));
}

export function rollEncounterInitiativeInCampaign(campaign, encounterId, options = {}) {
  const { creatureDataById = {}, rollD20 = () => Math.floor(Math.random() * 20) + 1 } = options;
  return updateEncounterInCampaign(campaign, encounterId, (encounter) => ({
    ...encounter,
    combatants: (encounter.combatants || []).map((combatant) => {
      if (combatant.type === "player") return combatant;
      const creatureData = creatureDataById[combatant.creatureId];
      const perception =
        Number.parseInt(
          creatureData?.system?.perception?.value ??
            creatureData?.system?.attributes?.perception?.value ??
            creatureData?.perception ??
            0,
          10
        ) || 0;
      return { ...combatant, initiative: rollD20() + perception };
    }),
  }));
}

export function addConditionToCombatantInCampaign(campaign, encounterId, combatantId, condition) {
  const trimmed = String(condition || "").trim();
  if (!trimmed) return campaign;
  return updateCombatantInEncounterInCampaign(campaign, encounterId, combatantId, (combatant) => ({
    ...combatant,
    conditions: [...(combatant.conditions || []), trimmed],
  }));
}

function normalizeCampaignEncounters(campaign) {
  const next = cloneValue(campaign) || {};
  next.encounters = Array.isArray(next.encounters) ? next.encounters.map(normalizeEncounter) : [];
  next.characters = Array.isArray(next.characters) ? next.characters.map((character) => cloneValue(character)) : [];
  return next;
}

function normalizeEncounter(encounter = {}) {
  const next = cloneValue(encounter) || {};
  next.id = next.id || createInstanceId("encounter");
  next.name = next.name || "New Encounter";
  next.isActive = Boolean(next.isActive);
  next.currentTurnIndex = Number.isFinite(Number(next.currentTurnIndex)) ? Number(next.currentTurnIndex) : 0;
  next.turnSequence = Number.isFinite(Number(next.turnSequence)) ? Math.max(0, Number(next.turnSequence)) : 0;
  next.roundNumber = Number.isFinite(Number(next.roundNumber)) ? Math.max(1, Number(next.roundNumber)) : 1;
  next.selectedEntityId = next.selectedEntityId || null;
  next.combatants = Array.isArray(next.combatants)
    ? next.combatants.map((combatant) => normalizeCombatant(combatant, next.id))
    : [];
  next.currentTurnCombatantId = getCurrentTurnCombatantId(next);
  next.currentTurnIndex = getCurrentTurnIndex(next);
  return next;
}

function normalizeCombatant(combatant = {}, encounterId = null) {
  const next = cloneValue(combatant) || {};
  next.id = next.id || createInstanceId("combatant");
  next.type = next.type || "creature";
  next.name = next.name || "Combatant";
  next.instanceLabel = Number.isFinite(Number(next.instanceLabel)) ? Number(next.instanceLabel) : 1;
  next.initiative = Number.isFinite(Number(next.initiative)) ? Number(next.initiative) : 0;
  next.maxHp = Number.isFinite(Number(next.maxHp)) ? Number(next.maxHp) : 0;
  next.currentHp = clamp(Number(next.currentHp) || 0, 0, next.maxHp);
  if (next.currentHp > 0) {
    delete next.defeatedAt;
    delete next.defeatedBy;
  }
  next.conditions = Array.isArray(next.conditions) ? next.conditions : [];
  next.visible = next.visible !== false;
  if (next.type === "player") {
    next.creatureId = null;
    next.effectTargetId = next.effectTargetId || next.playerId || next.id;
  }
  if (next.type === "creature") {
    next.playerId = null;
    next.effectTargetId = next.effectTargetId || buildEncounterCombatantEffectTargetId(encounterId, next.id);
  }
  return next;
}

export function buildEncounterCombatantEffectTargetId(encounterId, combatantId) {
  if (!encounterId || !combatantId) return null;
  return `encounter:${encounterId}:combatant:${combatantId}`;
}

function clamp(value, min, max) {
  if (max < min) return min;
  return Math.max(min, Math.min(value, max));
}
