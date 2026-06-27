import { createActionContext } from "./actionContext.js";
import { createActorActions } from "./actorActions.js";
import { createCampaignActions } from "./campaignActions.js";
import { createCatalogOverrideActions } from "./catalogOverrideActions.js";
import { createCharacterActions } from "./characterActions.js";
import { createEffectActions } from "./effectActions.js";
import { createMemberActions } from "./memberActions.js";
import { createCatalogOverrideRecord } from "./actorReducers.js";
import { markDeleted, markRestored } from "./campaignReducers.js";
import {
  addItemToCharacter,
  cloneValue,
  createInstanceId,
  findInventoryItemIndex,
  normalizeCharacterInventory,
  removeInventoryItem,
  setInventoryItemQuantity,
  transferInventoryItem,
} from "./inventoryReducers.js";
import {
  addItemsToLootBag,
  applyLootBagUpdate,
  claimLootGoldState,
  claimLootItemState,
  removeItemsFromLootBag,
  setLootItemQuantity,
  splitLootGoldState,
  updateCampaignLootBag,
} from "./lootReducers.js";
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
  updateCombatantInEncounterInCampaign,
  updateEncounterInCampaign,
} from "./encounterReducers.js";
import {
  applyQuestUpdate,
  collectQuestTreeIds,
  createQuestRecord,
  restoreQuestTreeInCampaign,
  revealQuestSecretInCampaign,
  softDeleteQuestTreeInCampaign,
  toggleQuestObjectiveHiddenInCampaign,
  toggleQuestObjectiveInCampaign,
  updateQuestInCampaign,
  upsertQuestInCampaign,
} from "./questReducers.js";
import {
  createMapRecord,
  deleteMapPinInCampaign,
  reorderMapsInCampaign,
  restoreMapInCampaign,
  setMapImageUrlInCampaign,
  setMapScaleInCampaign,
  softDeleteMapInCampaign,
  updateMapInCampaign,
  upsertMapInCampaign,
  upsertMapPinInCampaign,
} from "./mapReducers.js";
import {
  restoreProgressEntryInCampaign,
  softDeleteProgressEntryInCampaign,
  updateProgressInCampaign,
} from "./progressReducers.js";
import {
  assignCampingActivityInCampaign,
  recordCampingActivityRollInCampaign,
  resetDefaultCampingActivityInCampaign,
  restoreCampingActivityInCampaign,
  softDeleteCampingActivityInCampaign,
  updateCampingInCampaign,
  unassignCampingActivityInCampaign,
  upsertCampingActivityInCampaign,
} from "./campingReducers.js";
import {
  addItemsToTraderInDb,
  clearRootNotificationInDb,
  createTraderInDb,
  deleteCreatureInDb,
  deleteCustomActionInDb,
  deleteCustomAbilityInDb,
  deleteCustomItemInDb,
  deleteDeviantAbilityInDb,
  deleteLoreArticleInDb,
  deletePactInDb,
  deleteTraderInDb,
  initializeCreatureMetadataInDb,
  moveLoreArticleInDb,
  removeItemsFromTraderInDb,
  saveCustomActionInDb,
  saveCustomAbilityInDb,
  saveCustomCreatureInDb,
  saveCustomItemInDb,
  saveDeviantAbilityInDb,
  saveLoreArticleInDb,
  savePactInDb,
  setShopFormulaAvailableInDb,
  setShopItemAvailableInDb,
  setTraderHiddenInDb,
  updateBestiaryRevealStateInDb,
  updateCreatureMetadataInDb,
  updateCustomCreatureInDb,
  updateTraderInDb,
} from "./globalContentReducers.js";
export function createDataActions({
  db,
  setDb,
  mode = "legacy",
  firestore = null,
  createId = () => createInstanceId("item"),
  actorEmail = null,
  repositories = {},
} = {}) {
  const actionContext = createActionContext({ db, setDb, mode, firestore, createId, actorEmail, repositories });
  const {
    actor,
    actorDocToCharacter,
    characterToPcActorDoc,
    createDomainId,
    getActivePcActorIds,
    mode: resolvedMode,
    nowIso,
    repos,
    updateCampaignLegacy,
    updateCharacter,
    updateDbLegacy,
    updatePcActorAsCharacter,
    stripChildCollections,
    useFirestoreV2,
  } = actionContext;
  const actorActions = createActorActions(actionContext);
  const campaignActions = createCampaignActions(actionContext);
  const characterActions = createCharacterActions(actionContext);
  const effectActions = createEffectActions(actionContext);
  const memberActions = createMemberActions(actionContext);
  const catalogOverrideActions = createCatalogOverrideActions(actionContext);

  const updateLootBagLegacy = (campaignId, lootBagId, updater) =>
    updateCampaignLegacy(campaignId, (campaign) =>
      updateCampaignLootBag(campaign, lootBagId, (lootBag) => applyLootBagUpdate(lootBag, updater, { createId }), {
        createId,
      })
    );

  const updateLootBag = (campaignId, lootBagId, updater) => {
    if (useFirestoreV2) {
      return repos.lootRepo.updateLootBag(firestore, campaignId, lootBagId, (lootBag) =>
        applyLootBagUpdate(lootBag, updater, { createId })
      );
    }
    return updateLootBagLegacy(campaignId, lootBagId, updater);
  };

  const createLootBag = (campaignId, lootBag) => {
    const normalizedBag = applyLootBagUpdate(
      {
        id: lootBag.id || createId(),
        name: lootBag.name || "Loot",
        items: lootBag.items || [],
        goldValue: lootBag.goldValue || 0,
        ...lootBag,
      },
      (bag) => bag,
      { createId }
    );

    if (useFirestoreV2) {
      return repos.lootRepo.createLootBag(firestore, campaignId, normalizedBag);
    }

    return updateCampaignLegacy(campaignId, (campaign) => {
      const next = cloneValue(campaign);
      next.lootBags = Array.isArray(next.lootBags) ? [...next.lootBags, normalizedBag] : [normalizedBag];
      return next;
    });
  };

  const claimItem = (campaignId, lootBagId, item, characterId) => {
    if (useFirestoreV2) {
      return repos.lootRepo.updateLootBagAndActor(
        firestore,
        campaignId,
        lootBagId,
        characterId,
        (lootBag, actorDoc) => {
          const character = actorDocToCharacter(actorDoc, characterId);
          const result = claimLootItemState(lootBag, { ...character, id: character.id || characterId }, item, {
            createId,
            claimedBy: characterId,
          });
          return {
            lootBag: result.lootBag,
            actor: characterToPcActorDoc(actorDoc, result.character, campaignId, characterId),
          };
        }
      );
    }

    return updateCampaignLegacy(campaignId, (campaign) => {
      const next = cloneValue(campaign);
      const bagIndex = (next.lootBags || []).findIndex((bag) => bag.id === lootBagId);
      const characterIndex = (next.characters || []).findIndex((char) => char.id === characterId);
      if (bagIndex < 0 || characterIndex < 0) return next;
      const result = claimLootItemState(next.lootBags[bagIndex], next.characters[characterIndex], item, {
        createId,
        claimedBy: characterId,
      });
      next.lootBags[bagIndex] = result.lootBag;
      next.characters[characterIndex] = result.character;
      return next;
    });
  };

  const claimGold = (campaignId, lootBagId, characterId, amount) => {
    if (useFirestoreV2) {
      return repos.lootRepo.updateLootBagAndActor(
        firestore,
        campaignId,
        lootBagId,
        characterId,
        (lootBag, actorDoc) => {
          const character = actorDocToCharacter(actorDoc, characterId);
          const result = claimLootGoldState(lootBag, { ...character, id: character.id || characterId }, amount);
          return {
            lootBag: result.lootBag,
            actor: characterToPcActorDoc(actorDoc, result.character, campaignId, characterId),
          };
        }
      );
    }

    return updateCampaignLegacy(campaignId, (campaign) => {
      const next = cloneValue(campaign);
      const bagIndex = (next.lootBags || []).findIndex((bag) => bag.id === lootBagId);
      const characterIndex = (next.characters || []).findIndex((char) => char.id === characterId);
      if (bagIndex < 0 || characterIndex < 0) return next;
      const result = claimLootGoldState(next.lootBags[bagIndex], next.characters[characterIndex], amount, {
        createId,
      });
      next.lootBags[bagIndex] = result.lootBag;
      next.characters[characterIndex] = result.character;
      return next;
    });
  };

  const splitGold = (campaignId, lootBagId) => {
    const campaign = db?.campaigns?.[campaignId];
    const characterIds = getActivePcActorIds(campaign);

    if (useFirestoreV2) {
      return repos.lootRepo.updateLootBagAndActors(
        firestore,
        campaignId,
        lootBagId,
        characterIds,
        (lootBag, actorsById) => {
          const orderedCharacters = characterIds.map((characterId) => actorDocToCharacter(actorsById[characterId], characterId));
          const result = splitLootGoldState(lootBag, orderedCharacters, { createId });
          return {
            lootBag: result.lootBag,
            actorsById: Object.fromEntries(
              result.characters.map((character, index) => [
                characterIds[index],
                characterToPcActorDoc(actorsById[characterIds[index]], character, campaignId, characterIds[index]),
              ])
            ),
          };
        }
      );
    }

    return updateCampaignLegacy(campaignId, (campaignState) => {
      const next = cloneValue(campaignState);
      const bagIndex = (next.lootBags || []).findIndex((bag) => bag.id === lootBagId);
      if (bagIndex < 0) return next;
      const result = splitLootGoldState(next.lootBags[bagIndex], next.characters || [], { createId });
      next.lootBags[bagIndex] = result.lootBag;
      next.characters = result.characters;
      return next;
    });
  };

  const createQuest = (campaignId, quest) => {
    const normalizedQuest = createQuestRecord(quest, { createId: () => createDomainId("quest") });
    if (useFirestoreV2) {
      return repos.questRepo.createQuest(firestore, campaignId, normalizedQuest).then(() => normalizedQuest.id);
    }
    return updateCampaignLegacy(campaignId, (campaign) =>
      upsertQuestInCampaign(campaign, normalizedQuest, { createId: () => createDomainId("quest") })
    ).then(() => normalizedQuest.id);
  };

  const updateQuest = (campaignId, questId, updater) => {
    if (useFirestoreV2) {
      return repos.questRepo.updateQuest(firestore, campaignId, questId, (quest) =>
        applyQuestUpdate({ ...quest, id: quest.id || questId }, updater)
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => updateQuestInCampaign(campaign, questId, updater));
  };

  const softDeleteQuest = (campaignId, questId) => {
    const options = { now: nowIso(), actorEmail: actor };
    const questIds = collectQuestTreeIds(db?.campaigns?.[campaignId]?.quests || [], questId);
    if (useFirestoreV2) {
      return repos.questRepo.updateQuests(firestore, campaignId, questIds, (questsById) =>
        Object.fromEntries(Object.entries(questsById).map(([id, quest]) => [id, markDeleted(quest, options)]))
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => softDeleteQuestTreeInCampaign(campaign, questId, options));
  };

  const restoreQuest = (campaignId, questId) => {
    const options = { now: nowIso(), actorEmail: actor };
    const questIds = collectQuestTreeIds(db?.campaigns?.[campaignId]?.quests || [], questId);
    if (useFirestoreV2) {
      return repos.questRepo.updateQuests(firestore, campaignId, questIds, (questsById) =>
        Object.fromEntries(Object.entries(questsById).map(([id, quest]) => [id, markRestored(quest, options)]))
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => restoreQuestTreeInCampaign(campaign, questId, options));
  };

  const toggleObjective = (campaignId, questId, objectiveIndex, completed) => {
    const campaign = db?.campaigns?.[campaignId];
    const activeActorIds = getActivePcActorIds(campaign);
    const options = {
      now: nowIso(),
      actorEmail: actor,
      createId: () => createDomainId("notification"),
    };

    if (useFirestoreV2) {
      return repos.questRepo.updateQuestAndCampaignAndActors(
        firestore,
        campaignId,
        questId,
        activeActorIds,
        (questDoc, campaignDoc, actorsById) => {
          const current = {
            ...campaignDoc,
            id: campaignDoc.id || campaignId,
            quests: [{ ...questDoc, id: questDoc.id || questId }],
            characters: activeActorIds.map((actorId) => actorDocToCharacter(actorsById[actorId], actorId)),
          };
          const nextCampaign = toggleQuestObjectiveInCampaign(
            current,
            questId,
            objectiveIndex,
            completed,
            options
          );
          const nextQuest = nextCampaign.quests.find((quest) => quest.id === questId);
          return {
            quest: nextQuest || questDoc,
            campaign: stripChildCollections(nextCampaign),
            actorsById: Object.fromEntries(
              (nextCampaign.characters || []).map((character) => [
                character.id,
                characterToPcActorDoc(actorsById[character.id], character, campaignId, character.id),
              ])
            ),
          };
        }
      );
    }

    return updateCampaignLegacy(campaignId, (campaignState) =>
      toggleQuestObjectiveInCampaign(campaignState, questId, objectiveIndex, completed, options)
    );
  };

  const toggleObjectiveHidden = (campaignId, questId, objectiveIndex) => {
    if (useFirestoreV2) {
      return repos.questRepo.updateQuest(firestore, campaignId, questId, (quest) =>
        toggleQuestObjectiveHiddenInCampaign({ quests: [{ ...quest, id: quest.id || questId }] }, questId, objectiveIndex)
          .quests[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) =>
      toggleQuestObjectiveHiddenInCampaign(campaign, questId, objectiveIndex)
    );
  };

  const revealSecret = (campaignId, questId, secretText) => {
    if (useFirestoreV2) {
      return repos.questRepo.updateQuest(firestore, campaignId, questId, (quest) =>
        revealQuestSecretInCampaign({ quests: [{ ...quest, id: quest.id || questId }] }, questId, secretText).quests[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => revealQuestSecretInCampaign(campaign, questId, secretText));
  };

  const createEncounter = (campaignId, nameOrEncounter) => {
    const encounter = createEncounterRecord(nameOrEncounter, { createId: () => createDomainId("encounter") });
    if (useFirestoreV2) {
      return repos.encounterRepo.createEncounter(firestore, campaignId, encounter).then(() => encounter.id);
    }
    return updateCampaignLegacy(campaignId, (campaign) => {
      const result = createEncounterInCampaign(campaign, encounter, { createId: () => createDomainId("encounter") });
      return result.campaign;
    }).then(() => encounter.id);
  };

  const updateEncounter = (campaignId, encounterId, updater) => {
    if (useFirestoreV2) {
      return repos.encounterRepo.updateEncounter(firestore, campaignId, encounterId, (encounter) =>
        applyEncounterUpdate({ ...encounter, id: encounter.id || encounterId }, updater)
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => updateEncounterInCampaign(campaign, encounterId, updater));
  };

  const softDeleteEncounter = (campaignId, encounterId) => {
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
    return updateCampaignLegacy(campaignId, (campaign) => softDeleteEncounterInCampaign(campaign, encounterId, options));
  };

  const restoreEncounter = (campaignId, encounterId) => {
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
  };

  const activateEncounter = (campaignId, encounterId) => {
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
  };

  const updateEncounterViaReducer = (campaignId, encounterId, reducer) => {
    if (useFirestoreV2) {
      return repos.encounterRepo.updateEncounter(firestore, campaignId, encounterId, (encounter) =>
        reducer({ encounters: [{ ...encounter, id: encounter.id || encounterId }] }, encounterId).encounters[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => reducer(campaign, encounterId));
  };

  const addCombatant = (campaignId, encounterId, type, data) =>
    updateEncounterViaReducer(campaignId, encounterId, (campaign, id) =>
      addCombatantToEncounterInCampaign(campaign, id, type, data, { createId: () => createDomainId("combatant") })
    );

  const addAllPlayers = (campaignId, encounterId) => {
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
  };

  const removeCombatant = (campaignId, encounterId, combatantId) =>
    updateEncounterViaReducer(campaignId, encounterId, (campaign, id) =>
      removeCombatantFromEncounterInCampaign(campaign, id, combatantId)
    );

  const updateCombatant = (campaignId, encounterId, combatantId, updater) =>
    updateEncounterViaReducer(campaignId, encounterId, (campaign, id) =>
      updateCombatantInEncounterInCampaign(campaign, id, combatantId, updater)
    );

  const selectEntity = (campaignId, encounterId, entityId) =>
    updateEncounterViaReducer(campaignId, encounterId, (campaign, id) =>
      selectEncounterEntityInCampaign(campaign, id, entityId)
    );

  const endTurn = (campaignId, encounterId) =>
    updateEncounterViaReducer(campaignId, encounterId, (campaign, id) => endEncounterTurnInCampaign(campaign, id));

  const resetRound = (campaignId, encounterId) =>
    updateEncounterViaReducer(campaignId, encounterId, (campaign, id) => resetEncounterRoundInCampaign(campaign, id));

  const rollInitiativeAll = (campaignId, encounterId, creatureDataById = {}) =>
    updateEncounterViaReducer(campaignId, encounterId, (campaign, id) =>
      rollEncounterInitiativeInCampaign(campaign, id, { creatureDataById })
    );

  const addCondition = (campaignId, encounterId, combatantId, condition) =>
    updateEncounterViaReducer(campaignId, encounterId, (campaign, id) =>
      addConditionToCombatantInCampaign(campaign, id, combatantId, condition)
    );

  const createMap = (campaignId, nameOrMap) => {
    const campaignMaps = db?.campaigns?.[campaignId]?.maps || [];
    const maxOrder = Math.max(0, ...campaignMaps.map((map) => Number(map?.order) || 0));
    const map = createMapRecord(nameOrMap, {
      createId: () => createDomainId("map"),
      order: maxOrder + 1000,
    });

    if (useFirestoreV2) {
      return repos.mapRepo.createMap(firestore, campaignId, map).then(() => map.id);
    }
    return updateCampaignLegacy(campaignId, (campaign) =>
      upsertMapInCampaign(campaign, map, { createId: () => createDomainId("map") })
    ).then(() => map.id);
  };

  const updateMap = (campaignId, mapId, updater) => {
    if (useFirestoreV2) {
      return repos.mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
        updateMapInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, updater).maps[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => updateMapInCampaign(campaign, mapId, updater));
  };

  const softDeleteMap = (campaignId, mapId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return repos.mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
        softDeleteMapInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, options).maps[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => softDeleteMapInCampaign(campaign, mapId, options));
  };

  const restoreMap = (campaignId, mapId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return repos.mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
        restoreMapInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, options).maps[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => restoreMapInCampaign(campaign, mapId, options));
  };

  const reorderMaps = (campaignId, orderedIds) => {
    if (useFirestoreV2) {
      return repos.mapRepo.updateMaps(firestore, campaignId, orderedIds, (mapsById) => {
        const nextCampaign = reorderMapsInCampaign(
          { maps: orderedIds.map((id) => ({ ...mapsById[id], id: mapsById[id]?.id || id })) },
          orderedIds
        );
        return Object.fromEntries(nextCampaign.maps.map((map) => [map.id, map]));
      });
    }
    return updateCampaignLegacy(campaignId, (campaign) => reorderMapsInCampaign(campaign, orderedIds));
  };

  const setImageUrl = (campaignId, mapId, imageUrl) => {
    if (useFirestoreV2) {
      return repos.mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
        setMapImageUrlInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, imageUrl).maps[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => setMapImageUrlInCampaign(campaign, mapId, imageUrl));
  };

  const upsertPin = (campaignId, mapId, pin) => {
    const options = { createId: () => createDomainId("pin") };
    if (useFirestoreV2) {
      return repos.mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
        upsertMapPinInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, pin, options).maps[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => upsertMapPinInCampaign(campaign, mapId, pin, options));
  };

  const deletePin = (campaignId, mapId, pinId) => {
    if (useFirestoreV2) {
      return repos.mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
        deleteMapPinInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, pinId).maps[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => deleteMapPinInCampaign(campaign, mapId, pinId));
  };

  const setScale = (campaignId, mapId, scale) => {
    if (useFirestoreV2) {
      return repos.mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
        setMapScaleInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, scale).maps[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => setMapScaleInCampaign(campaign, mapId, scale));
  };

  const updateProgress = (campaignId, patchOrUpdater) => {
    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(updateProgressInCampaign({ ...campaign, id: campaign.id || campaignId }, patchOrUpdater))
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => updateProgressInCampaign(campaign, patchOrUpdater));
  };

  const softDeleteProgressEntry = (campaignId, section, entryId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(
          softDeleteProgressEntryInCampaign({ ...campaign, id: campaign.id || campaignId }, section, entryId, options)
        )
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) =>
      softDeleteProgressEntryInCampaign(campaign, section, entryId, options)
    );
  };

  const restoreProgressEntry = (campaignId, section, entryId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(
          restoreProgressEntryInCampaign({ ...campaign, id: campaign.id || campaignId }, section, entryId, options)
        )
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) =>
      restoreProgressEntryInCampaign(campaign, section, entryId, options)
    );
  };

  const updateCamping = (campaignId, patchOrUpdater) => {
    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(updateCampingInCampaign({ ...campaign, id: campaign.id || campaignId }, patchOrUpdater))
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => updateCampingInCampaign(campaign, patchOrUpdater));
  };

  const upsertCampingActivity = (campaignId, activity) => {
    const options = { createId: () => createDomainId("camping_activity") };
    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(
          upsertCampingActivityInCampaign({ ...campaign, id: campaign.id || campaignId }, activity, options)
        )
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => upsertCampingActivityInCampaign(campaign, activity, options));
  };

  const deleteCampingActivity = (campaignId, activityId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(
          softDeleteCampingActivityInCampaign({ ...campaign, id: campaign.id || campaignId }, activityId, options)
        )
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => softDeleteCampingActivityInCampaign(campaign, activityId, options));
  };

  const restoreCampingActivity = (campaignId, activityId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(
          restoreCampingActivityInCampaign({ ...campaign, id: campaign.id || campaignId }, activityId, options)
        )
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => restoreCampingActivityInCampaign(campaign, activityId, options));
  };

  const resetDefaultCampingActivity = (campaignId, activityId) => {
    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(resetDefaultCampingActivityInCampaign({ ...campaign, id: campaign.id || campaignId }, activityId))
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => resetDefaultCampingActivityInCampaign(campaign, activityId));
  };

  const assignCampingActivity = (campaignId, activityId, character) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(
          assignCampingActivityInCampaign({ ...campaign, id: campaign.id || campaignId }, activityId, character, options)
        )
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) =>
      assignCampingActivityInCampaign(campaign, activityId, character, options)
    );
  };

  const recordCampingActivityRoll = (campaignId, activityId, character, rollResult) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(
          recordCampingActivityRollInCampaign(
            { ...campaign, id: campaign.id || campaignId },
            activityId,
            character,
            rollResult,
            options
          )
        )
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) =>
      recordCampingActivityRollInCampaign(campaign, activityId, character, rollResult, options)
    );
  };

  const unassignCampingActivity = (campaignId, activityId, character) => {
    if (useFirestoreV2) {
      return repos.campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(
          unassignCampingActivityInCampaign({ ...campaign, id: campaign.id || campaignId }, activityId, character)
        )
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) =>
      unassignCampingActivityInCampaign(campaign, activityId, character)
    );
  };

  const updateGlobalConfig = (updater) => {
    if (useFirestoreV2) {
      return repos.globalRepo.updateGlobalConfig(firestore, updater);
    }
    return updateDbLegacy(updater);
  };

  const saveCustomItem = (item) => {
    if (useFirestoreV2) {
      return repos.catalogOverrideRepo.setCatalogOverride(firestore, createCatalogOverrideRecord({
        id: buildCatalogOverrideId("item", item),
        catalogType: "item",
        mode: "custom",
        label: item?.name,
        payload: item,
      }));
    }
    return updateDbLegacy((prev) => saveCustomItemInDb(prev, item));
  };

  const deleteCustomItem = (itemOrName) => {
    if (useFirestoreV2) {
      return repos.catalogOverrideRepo.deleteCatalogOverride(firestore, buildCatalogOverrideId("item", itemOrName));
    }
    return updateDbLegacy((prev) => deleteCustomItemInDb(prev, itemOrName));
  };

  const saveCustomAction = (action) => {
    if (useFirestoreV2) {
      return repos.catalogOverrideRepo.setCatalogOverride(firestore, createCatalogOverrideRecord({
        id: buildCatalogOverrideId("action", action),
        catalogType: "action",
        mode: "custom",
        label: action?.name,
        payload: action,
      }));
    }
    return updateDbLegacy((prev) => saveCustomActionInDb(prev, action));
  };

  const deleteCustomAction = (actionOrName) => {
    if (useFirestoreV2) {
      return repos.catalogOverrideRepo.deleteCatalogOverride(firestore, buildCatalogOverrideId("action", actionOrName));
    }
    return updateDbLegacy((prev) => deleteCustomActionInDb(prev, actionOrName));
  };

  const saveCustomAbility = (ability) => {
    if (useFirestoreV2) {
      return repos.catalogOverrideRepo.setCatalogOverride(firestore, createCatalogOverrideRecord({
        id: buildCatalogOverrideId("ability", ability),
        catalogType: "ability",
        mode: "custom",
        label: ability?.name,
        payload: ability,
      }));
    }
    return updateGlobalConfig((current) => saveCustomAbilityInDb(current, ability));
  };

  const deleteCustomAbility = (abilityOrId) => {
    if (useFirestoreV2) {
      return repos.catalogOverrideRepo.deleteCatalogOverride(firestore, buildCatalogOverrideId("ability", abilityOrId));
    }
    return updateGlobalConfig((current) => deleteCustomAbilityInDb(current, abilityOrId));
  };

  const savePact = (pact) => updateGlobalConfig((current) => savePactInDb(current, pact));

  const deletePact = (pactOrId) => updateGlobalConfig((current) => deletePactInDb(current, pactOrId));

  const saveDeviantAbility = (ability) =>
    updateGlobalConfig((current) => saveDeviantAbilityInDb(current, ability));

  const deleteDeviantAbility = (abilityOrId) =>
    updateGlobalConfig((current) => deleteDeviantAbilityInDb(current, abilityOrId));

  const saveLoreArticle = (article) => {
    if (useFirestoreV2) {
      return repos.globalRepo.setLoreArticle(firestore, article);
    }
    return updateDbLegacy((prev) => saveLoreArticleInDb(prev, article));
  };

  const deleteLoreArticle = (articleOrId) => {
    if (useFirestoreV2) {
      return repos.globalRepo.deleteLoreArticle(firestore, articleOrId);
    }
    return updateDbLegacy((prev) => deleteLoreArticleInDb(prev, articleOrId));
  };

  const moveLoreArticle = (articleId, direction) => {
    if (!useFirestoreV2) {
      return updateDbLegacy((prev) => moveLoreArticleInDb(prev, articleId, direction));
    }
    const currentArticle = (db?.lore?.articles || []).find((article) => article.id === articleId);
    if (!currentArticle || !["up", "down"].includes(direction)) return Promise.resolve();
    const category = String(currentArticle.category || "").toLowerCase();
    const sorted = (db?.lore?.articles || [])
      .filter((article) => String(article.category || "").toLowerCase() === category)
      .sort((a, b) => {
        const orderA = a.sortOrder ?? 9999;
        const orderB = b.sortOrder ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        return String(a.title || "").localeCompare(String(b.title || ""));
      });
    const currentIndex = sorted.findIndex((article) => article.id === articleId);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sorted.length) return Promise.resolve();
    const affectedIds = [sorted[currentIndex].id, sorted[targetIndex].id];

    return repos.globalRepo.updateLoreArticles(firestore, affectedIds, (articlesById) => {
      const current = articlesById[sorted[currentIndex].id];
      const target = articlesById[sorted[targetIndex].id];
      return {
        [sorted[currentIndex].id]: { ...current, sortOrder: targetIndex },
        [sorted[targetIndex].id]: { ...target, sortOrder: currentIndex },
      };
    });
  };

  const clearRootNotification = (notificationId) =>
    updateGlobalConfig((current) => clearRootNotificationInDb(current, notificationId));

  const saveCustomCreature = (creature) => {
    if (useFirestoreV2) {
      return repos.catalogOverrideRepo.setCatalogOverride(firestore, createCatalogOverrideRecord({
        id: buildCatalogOverrideId("creature", creature),
        catalogType: "creature",
        mode: "custom",
        label: creature?.name,
        payload: creature,
      }));
    }
    return updateDbLegacy((prev) => saveCustomCreatureInDb(prev, creature));
  };

  const updateCustomCreature = (creatureId, updater) => {
    if (useFirestoreV2) {
      const current = findCustomCreatureById(db, creatureId) || { id: creatureId, _id: creatureId };
      const next = typeof updater === "function"
        ? updater(cloneValue(current))
        : { ...cloneValue(current), ...updater };
      return saveCustomCreature({ ...next, id: next?.id || creatureId, _id: next?._id || creatureId });
    }
    return updateDbLegacy((prev) => updateCustomCreatureInDb(prev, creatureId, updater));
  };

  const deleteCreature = (creatureId) => {
    if (useFirestoreV2) {
      return Promise.all([
        repos.globalRepo.updateGlobalConfig(firestore, (current) => deleteCreatureInDb(current, creatureId)),
        repos.catalogOverrideRepo.deleteCatalogOverride(firestore, buildCatalogOverrideId("creature", creatureId)),
      ]);
    }
    return updateDbLegacy((prev) => deleteCreatureInDb(prev, creatureId));
  };

  const updateCreatureMetadata = (creatureId, updater) =>
    updateGlobalConfig((current) => updateCreatureMetadataInDb(current, creatureId, updater));

  const initializeCreatureMetadata = (metadataEntries) =>
    updateGlobalConfig((current) => initializeCreatureMetadataInDb(current, metadataEntries));

  const updateBestiaryRevealState = (creatureId, field, revealMode) =>
    updateGlobalConfig((current) => updateBestiaryRevealStateInDb(current, creatureId, field, revealMode));

  const createTrader = (trader, category = "General") => {
    const traderRecord =
      typeof trader === "string"
        ? { id: createDomainId("trader"), name: trader.trim(), inventory: [], category }
        : {
            id: trader?.id ?? createDomainId("trader"),
            name: String(trader?.name || "").trim(),
            inventory: Array.isArray(trader?.inventory) ? trader.inventory : [],
            category: trader?.category || category || "General",
            ...trader,
          };
    if (!traderRecord.name) return Promise.resolve(null);
    return updateGlobalConfig((current) => createTraderInDb(current, traderRecord)).then(() => traderRecord.id);
  };

  const updateTrader = (traderId, updater) =>
    updateGlobalConfig((current) => updateTraderInDb(current, traderId, updater));

  const deleteTrader = (traderId) => updateGlobalConfig((current) => deleteTraderInDb(current, traderId));

  const setTraderHidden = (traderId, hidden) =>
    updateGlobalConfig((current) => setTraderHiddenInDb(current, traderId, hidden));

  const addItemsToTrader = (traderId, items) =>
    updateGlobalConfig((current) => addItemsToTraderInDb(current, traderId, items));

  const removeItemsFromTrader = (traderId, items) =>
    updateGlobalConfig((current) => removeItemsFromTraderInDb(current, traderId, items));

  const setItemAvailable = (itemName, available) =>
    updateGlobalConfig((current) => setShopItemAvailableInDb(current, itemName, available));

  const setFormulaAvailable = (itemName, available) =>
    updateGlobalConfig((current) => setShopFormulaAvailableInDb(current, itemName, available));

  return {
    mode: resolvedMode,
    campaign: campaignActions,
    member: memberActions,
    character: characterActions,
    inventory: {
      addItem(campaignId, characterId, item, options = {}) {
        return updateCharacter(campaignId, characterId, (character) =>
          addItemToCharacter(character, item, { ...options, createId })
        );
      },
      updateItem(campaignId, characterId, item, updater) {
        return updateCharacter(campaignId, characterId, (character) => {
          const next = normalizeCharacterInventory(character, { createId });
          const index = findInventoryItemIndex(next.inventory, item);
          if (index < 0) return next;
          next.inventory[index] =
            typeof updater === "function"
              ? updater(next.inventory[index])
              : { ...next.inventory[index], ...updater };
          return normalizeCharacterInventory(next, { createId });
        });
      },
      removeItem(campaignId, characterId, item) {
        return updateCharacter(campaignId, characterId, (character) =>
          removeInventoryItem(character, item, { createId })
        );
      },
      setItemQuantity(campaignId, characterId, item, qty) {
        return updateCharacter(campaignId, characterId, (character) =>
          setInventoryItemQuantity(character, item, qty, { createId })
        );
      },
      transferItem(campaignId, fromCharacterId, toCharacterId, item, qty) {
        if (useFirestoreV2) {
          return repos.actorRepo.updateActors(
            firestore,
            campaignId,
            [fromCharacterId, toCharacterId],
            (actorsById) => {
              const nextCampaign = transferInventoryItem(
                {
                  id: campaignId,
                  characters: [
                    actorDocToCharacter(actorsById[fromCharacterId], fromCharacterId),
                    actorDocToCharacter(actorsById[toCharacterId], toCharacterId),
                  ],
                },
                fromCharacterId,
                toCharacterId,
                item,
                qty,
                { createId }
              );
              return Object.fromEntries(
                nextCampaign.characters.map((character) => [
                  character.id,
                  characterToPcActorDoc(actorsById[character.id], character, campaignId, character.id),
                ])
              );
            }
          );
        }

        return updateCampaignLegacy(campaignId, (campaign) =>
          transferInventoryItem(campaign, fromCharacterId, toCharacterId, item, qty, { createId })
        );
      },
    },
    actor: actorActions,
    effect: effectActions,
    catalogOverride: catalogOverrideActions,
    loot: {
      createLootBag,
      updateLootBag,
      addItems(campaignId, lootBagId, items) {
        return updateLootBag(campaignId, lootBagId, (lootBag) =>
          addItemsToLootBag(lootBag, items, { createId })
        );
      },
      removeItems(campaignId, lootBagId, items) {
        return updateLootBag(campaignId, lootBagId, (lootBag) =>
          removeItemsFromLootBag(lootBag, items, { createId })
        );
      },
      setItemQuantity(campaignId, lootBagId, items, qty) {
        return updateLootBag(campaignId, lootBagId, (lootBag) =>
          setLootItemQuantity(lootBag, items, qty, { createId })
        );
      },
      claimItem,
      claimGold,
      splitGold,
    },
    quest: {
      createQuest,
      updateQuest,
      softDeleteQuest,
      restoreQuest,
      toggleObjective,
      toggleObjectiveHidden,
      revealSecret,
    },
    encounter: {
      createEncounter,
      updateEncounter,
      softDeleteEncounter,
      restoreEncounter,
      activateEncounter,
      addCombatant,
      addAllPlayers,
      removeCombatant,
      updateCombatant,
      selectEntity,
      endTurn,
      resetRound,
      rollInitiativeAll,
      addCondition,
    },
    map: {
      createMap,
      updateMap,
      softDeleteMap,
      restoreMap,
      reorderMaps,
      setImageUrl,
      upsertPin,
      deletePin,
      setScale,
    },
    progress: {
      updateProgress,
      softDeleteEntry: softDeleteProgressEntry,
      restoreEntry: restoreProgressEntry,
    },
    camping: {
      updateSettings: updateCamping,
      upsertActivity: upsertCampingActivity,
      deleteActivity: deleteCampingActivity,
      restoreActivity: restoreCampingActivity,
      resetDefaultActivity: resetDefaultCampingActivity,
      assignActivity: assignCampingActivity,
      recordActivityRoll: recordCampingActivityRoll,
      unassignActivity: unassignCampingActivity,
    },
    bestiary: {
      updateRevealState: updateBestiaryRevealState,
      saveCustomCreature,
      updateCustomCreature,
      deleteCreature,
      updateCreatureMetadata,
      initializeCreatureMetadata,
    },
    globalContent: {
      saveCustomItem,
      deleteCustomItem,
      saveCustomAction,
      deleteCustomAction,
      saveCustomAbility,
      deleteCustomAbility,
      saveLoreArticle,
      deleteLoreArticle,
      moveLoreArticle,
      clearRootNotification,
    },
    pact: {
      savePact,
      deletePact,
      saveDeviantAbility,
      deleteDeviantAbility,
    },
    shop: {
      createTrader,
      updateTrader,
      deleteTrader,
      setTraderHidden,
      addItemsToTrader,
      removeItemsFromTrader,
      setItemAvailable,
      setFormulaAvailable,
    },
  };
}

function findCustomCreatureById(db, creatureId) {
  const entries = Object.values(db?.bestiary?.customCreatures || {});
  return entries.find((creature) =>
    String(creature?.id || creature?._id || creature?.name) === String(creatureId)
  ) || null;
}

function buildCatalogOverrideId(catalogType, value) {
  const raw = value?.id || value?._id || value?.name || value;
  const normalized = String(raw || catalogType || "override")
    .trim()
    .replace(/[^a-z0-9_-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return `${catalogType}_${normalized || "override"}`;
}
