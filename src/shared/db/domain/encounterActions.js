import {
  addAllPlayersToEncounterInCampaign,
  addCombatantToEncounterInCampaign,
  addConditionToCombatantInCampaign,
  applyEncounterUpdate,
  createEncounterInCampaign,
  createEncounterRecord,
  endEncounterTurnInCampaign,
  resetEncounterRoundInCampaign,
  restoreEncounterInCampaign,
  rollEncounterInitiativeInCampaign,
  selectEncounterEntityInCampaign,
  softDeleteEncounterInCampaign,
  activateEncounterInCampaign,
  removeCombatantFromEncounterInCampaign,
  setCombatantDefeatedInCampaign,
  updateCombatantInEncounterInCampaign,
  updateEncounterInCampaign,
} from "./encounterReducers.js";

export function createEncounterActions(actionContext) {
  const { actor, createDomainId, db, firestore, nowIso, repos, updateCampaignLegacy, useFirestoreV2 } = actionContext;

  const updateEncounterViaReducer = (campaignId, encounterId, reducer) => {
    if (useFirestoreV2) {
      return repos.encounterRepo.updateEncounter(firestore, campaignId, encounterId, (encounter) =>
        reducer({ encounters: [{ ...encounter, id: encounter.id || encounterId }] }, encounterId).encounters[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => reducer(campaign, encounterId));
  };

  return {
    createEncounter(campaignId, nameOrEncounter) {
      const encounter = createEncounterRecord(nameOrEncounter, { createId: () => createDomainId("encounter") });
      if (useFirestoreV2) {
        return repos.encounterRepo.createEncounter(firestore, campaignId, encounter).then(() => encounter.id);
      }
      return updateCampaignLegacy(campaignId, (campaign) => {
        const result = createEncounterInCampaign(campaign, encounter, { createId: () => createDomainId("encounter") });
        return result.campaign;
      }).then(() => encounter.id);
    },
    updateEncounter(campaignId, encounterId, updater) {
      if (useFirestoreV2) {
        return repos.encounterRepo.updateEncounter(firestore, campaignId, encounterId, (encounter) =>
          applyEncounterUpdate({ ...encounter, id: encounter.id || encounterId }, updater)
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) => updateEncounterInCampaign(campaign, encounterId, updater));
    },
    softDeleteEncounter(campaignId, encounterId) {
      const options = { now: nowIso(), actorEmail: actor };
      if (useFirestoreV2) {
        return repos.encounterRepo.updateEncounter(firestore, campaignId, encounterId, (encounter) =>
          softDeleteEncounterInCampaign(
            { encounters: [{ ...encounter, id: encounter.id || encounterId }] },
            encounterId,
            options
          ).encounters[0]
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) =>
        softDeleteEncounterInCampaign(campaign, encounterId, options)
      );
    },
    restoreEncounter(campaignId, encounterId) {
      const options = { now: nowIso(), actorEmail: actor };
      if (useFirestoreV2) {
        return repos.encounterRepo.updateEncounter(firestore, campaignId, encounterId, (encounter) =>
          restoreEncounterInCampaign(
            { encounters: [{ ...encounter, id: encounter.id || encounterId }] },
            encounterId,
            options
          ).encounters[0]
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) => restoreEncounterInCampaign(campaign, encounterId, options));
    },
    activateEncounter(campaignId, encounterId) {
      const encounterIds = (db?.campaigns?.[campaignId]?.encounters || [])
        .filter((encounter) => encounter.id === encounterId || encounter.isActive)
        .map((encounter) => encounter.id);

      if (useFirestoreV2) {
        return repos.encounterRepo.updateEncounters(firestore, campaignId, encounterIds, (encountersById) =>
          Object.fromEntries(
            Object.entries(encountersById).map(([id, encounter]) => [
              id,
              {
                ...encounter,
                isActive: !encounter.deletedAt && id === encounterId,
              },
            ])
          )
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) => activateEncounterInCampaign(campaign, encounterId));
    },
    addCombatant(campaignId, encounterId, type, data) {
      return updateEncounterViaReducer(campaignId, encounterId, (campaign, id) =>
        addCombatantToEncounterInCampaign(campaign, id, type, data, { createId: () => createDomainId("combatant") })
      );
    },
    addAllPlayers(campaignId, encounterId) {
      if (useFirestoreV2) {
        const campaign = db?.campaigns?.[campaignId] || {};
        return repos.encounterRepo.updateEncounter(firestore, campaignId, encounterId, (encounter) =>
          addAllPlayersToEncounterInCampaign(
            {
              ...campaign,
              encounters: [{ ...encounter, id: encounter.id || encounterId }],
            },
            encounterId,
            { createId: () => createDomainId("combatant") }
          ).encounters[0]
        );
      }
      return updateCampaignLegacy(campaignId, (campaign) =>
        addAllPlayersToEncounterInCampaign(campaign, encounterId, { createId: () => createDomainId("combatant") })
      );
    },
    removeCombatant(campaignId, encounterId, combatantId) {
      return updateEncounterViaReducer(campaignId, encounterId, (campaign, id) =>
        removeCombatantFromEncounterInCampaign(campaign, id, combatantId)
      );
    },
    updateCombatant(campaignId, encounterId, combatantId, updater) {
      return updateEncounterViaReducer(campaignId, encounterId, (campaign, id) =>
        updateCombatantInEncounterInCampaign(campaign, id, combatantId, updater)
      );
    },
    setCombatantDefeated(campaignId, encounterId, combatantId) {
      return updateEncounterViaReducer(campaignId, encounterId, (campaign, id) =>
        setCombatantDefeatedInCampaign(campaign, id, combatantId, { now: nowIso(), actorEmail: actor })
      );
    },
    selectEntity(campaignId, encounterId, entityId) {
      return updateEncounterViaReducer(campaignId, encounterId, (campaign, id) =>
        selectEncounterEntityInCampaign(campaign, id, entityId)
      );
    },
    endTurn(campaignId, encounterId) {
      return updateEncounterViaReducer(campaignId, encounterId, (campaign, id) =>
        endEncounterTurnInCampaign(campaign, id)
      );
    },
    resetRound(campaignId, encounterId) {
      return updateEncounterViaReducer(campaignId, encounterId, (campaign, id) =>
        resetEncounterRoundInCampaign(campaign, id)
      );
    },
    rollInitiativeAll(campaignId, encounterId, creatureDataById = {}) {
      return updateEncounterViaReducer(campaignId, encounterId, (campaign, id) =>
        rollEncounterInitiativeInCampaign(campaign, id, { creatureDataById })
      );
    },
    addCondition(campaignId, encounterId, combatantId, condition) {
      return updateEncounterViaReducer(campaignId, encounterId, (campaign, id) =>
        addConditionToCombatantInCampaign(campaign, id, combatantId, condition)
      );
    },
  };
}
