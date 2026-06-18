import { db as firestoreDb } from "../firebase-config.js";
import { campaignRepo, characterRepo, encounterRepo, lootRepo, mapRepo, memberRepo, questRepo } from "../v2/repositories.js";
import {
  addPartyXpInCampaign,
  applyCampaignUpdate,
  assignUserInDb,
  createCampaignInDb,
  createCampaignRecord,
  createCharacterInCampaign,
  createCharacterRecord,
  importLegacyCharacterInDb,
  normalizeEmail,
  restoreCampaignInDb,
  restoreCharacterInCampaign,
  revokeUserInDb,
  setPartyXpInCampaign,
  softDeleteCampaignInDb,
  softDeleteCharacterInDb,
  markDeleted,
  markRestored,
} from "./campaignReducers.js";
import {
  addItemToCharacter,
  applyCharacterUpdate,
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
  clearCampaignNotificationInCampaign,
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

export function createDataActions({
  db,
  setDb,
  mode = "legacy",
  firestore = firestoreDb,
  createId = () => createInstanceId("item"),
  actorEmail = null,
} = {}) {
  const useFirestoreV2 = mode === "firestore-v2" && hasFirestoreConfig(firestore);
  const actor = normalizeEmail(actorEmail);
  const nowIso = () => new Date().toISOString();
  const createDomainId = (prefix) => {
    if (typeof createId === "function" && createId.length > 0) return createId(prefix);
    return createInstanceId(prefix);
  };

  const updateDbLegacy = (updater) => {
    if (!setDb) return Promise.resolve();
    setDb((prev) => (typeof updater === "function" ? updater(prev) : { ...prev, ...updater }));
    return Promise.resolve();
  };

  const updateCampaignLegacy = (campaignId, updater) => {
    return updateDbLegacy((prev) => {
      const next = cloneValue(prev);
      const targetCampaignId = campaignId || next?.activeCampaignId;
      const currentCampaign = next?.campaigns?.[targetCampaignId];
      if (!currentCampaign) return prev;
      next.campaigns[targetCampaignId] =
        typeof updater === "function" ? updater(currentCampaign) : { ...currentCampaign, ...updater };
      return next;
    });
  };

  const updateCharacterLegacy = (campaignId, characterId, updater) =>
    updateCampaignLegacy(campaignId, (campaign) => {
      const next = cloneValue(campaign);
      next.characters = Array.isArray(next.characters) ? next.characters.map((char) => cloneValue(char)) : [];
      const index = next.characters.findIndex((char) => char.id === characterId);
      if (index < 0) return next;
      next.characters[index] = applyCharacterUpdate(next.characters[index], updater, { createId });
      return next;
    });

  const updateCharacter = (campaignId, characterId, updater) => {
    if (useFirestoreV2) {
      return characterRepo.updateCharacter(firestore, campaignId, characterId, (character) =>
        applyCharacterUpdate({ ...character, id: character.id || characterId }, updater, { createId })
      );
    }
    return updateCharacterLegacy(campaignId, characterId, updater);
  };

  const updateLootBagLegacy = (campaignId, lootBagId, updater) =>
    updateCampaignLegacy(campaignId, (campaign) =>
      updateCampaignLootBag(campaign, lootBagId, (lootBag) => applyLootBagUpdate(lootBag, updater, { createId }), {
        createId,
      })
    );

  const updateLootBag = (campaignId, lootBagId, updater) => {
    if (useFirestoreV2) {
      return lootRepo.updateLootBag(firestore, campaignId, lootBagId, (lootBag) =>
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
      return lootRepo.createLootBag(firestore, campaignId, normalizedBag);
    }

    return updateCampaignLegacy(campaignId, (campaign) => {
      const next = cloneValue(campaign);
      next.lootBags = Array.isArray(next.lootBags) ? [...next.lootBags, normalizedBag] : [normalizedBag];
      return next;
    });
  };

  const claimItem = (campaignId, lootBagId, item, characterId) => {
    if (useFirestoreV2) {
      return lootRepo.updateLootBagAndCharacter(
        firestore,
        campaignId,
        lootBagId,
        characterId,
        (lootBag, character) =>
          claimLootItemState(lootBag, { ...character, id: character.id || characterId }, item, {
            createId,
            claimedBy: characterId,
          })
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
      return lootRepo.updateLootBagAndCharacter(
        firestore,
        campaignId,
        lootBagId,
        characterId,
        (lootBag, character) => claimLootGoldState(lootBag, { ...character, id: character.id || characterId }, amount)
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
    const characterIds = (campaign?.characters || []).map((character) => character.id).filter(Boolean);

    if (useFirestoreV2) {
      return lootRepo.updateLootBagAndCharacters(
        firestore,
        campaignId,
        lootBagId,
        characterIds,
        (lootBag, charactersById) => {
          const orderedCharacters = characterIds.map((characterId) => ({
            ...charactersById[characterId],
            id: charactersById[characterId]?.id || characterId,
          }));
          const result = splitLootGoldState(lootBag, orderedCharacters, { createId });
          return {
            lootBag: result.lootBag,
            charactersById: Object.fromEntries(
              result.characters.map((character, index) => [characterIds[index], character])
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
      return questRepo.createQuest(firestore, campaignId, normalizedQuest).then(() => normalizedQuest.id);
    }
    return updateCampaignLegacy(campaignId, (campaign) =>
      upsertQuestInCampaign(campaign, normalizedQuest, { createId: () => createDomainId("quest") })
    ).then(() => normalizedQuest.id);
  };

  const updateQuest = (campaignId, questId, updater) => {
    if (useFirestoreV2) {
      return questRepo.updateQuest(firestore, campaignId, questId, (quest) =>
        applyQuestUpdate({ ...quest, id: quest.id || questId }, updater)
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => updateQuestInCampaign(campaign, questId, updater));
  };

  const softDeleteQuest = (campaignId, questId) => {
    const options = { now: nowIso(), actorEmail: actor };
    const questIds = collectQuestTreeIds(db?.campaigns?.[campaignId]?.quests || [], questId);
    if (useFirestoreV2) {
      return questRepo.updateQuests(firestore, campaignId, questIds, (questsById) =>
        Object.fromEntries(Object.entries(questsById).map(([id, quest]) => [id, markDeleted(quest, options)]))
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => softDeleteQuestTreeInCampaign(campaign, questId, options));
  };

  const restoreQuest = (campaignId, questId) => {
    const options = { now: nowIso(), actorEmail: actor };
    const questIds = collectQuestTreeIds(db?.campaigns?.[campaignId]?.quests || [], questId);
    if (useFirestoreV2) {
      return questRepo.updateQuests(firestore, campaignId, questIds, (questsById) =>
        Object.fromEntries(Object.entries(questsById).map(([id, quest]) => [id, markRestored(quest, options)]))
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => restoreQuestTreeInCampaign(campaign, questId, options));
  };

  const toggleObjective = (campaignId, questId, objectiveIndex, completed) => {
    const campaign = db?.campaigns?.[campaignId];
    const activeCharacterIds = (campaign?.characters || [])
      .filter((character) => !character.deletedAt)
      .map((character) => character.id)
      .filter(Boolean);
    const options = {
      now: nowIso(),
      actorEmail: actor,
      createId: () => createDomainId("notification"),
    };

    if (useFirestoreV2) {
      return questRepo.updateQuestAndCampaignAndCharacters(
        firestore,
        campaignId,
        questId,
        activeCharacterIds,
        (questDoc, campaignDoc, charactersById) => {
          const current = {
            ...campaignDoc,
            id: campaignDoc.id || campaignId,
            quests: [{ ...questDoc, id: questDoc.id || questId }],
            characters: activeCharacterIds.map((characterId) => ({
              ...charactersById[characterId],
              id: charactersById[characterId]?.id || characterId,
            })),
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
            charactersById: Object.fromEntries(
              (nextCampaign.characters || []).map((character) => [character.id, character])
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
      return questRepo.updateQuest(firestore, campaignId, questId, (quest) =>
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
      return questRepo.updateQuest(firestore, campaignId, questId, (quest) =>
        revealQuestSecretInCampaign({ quests: [{ ...quest, id: quest.id || questId }] }, questId, secretText).quests[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => revealQuestSecretInCampaign(campaign, questId, secretText));
  };

  const clearNotification = (campaignId, notificationId) => {
    if (useFirestoreV2 && campaignId) {
      return campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        clearCampaignNotificationInCampaign({ ...campaign, id: campaign.id || campaignId }, notificationId)
      );
    }
    return updateDbLegacy((prev) => {
      const next = cloneValue(prev) || {};
      if (campaignId && next.campaigns?.[campaignId]) {
        next.campaigns[campaignId] = clearCampaignNotificationInCampaign(next.campaigns[campaignId], notificationId);
      }
      next.notificationQueue = (next.notificationQueue || []).filter((notification) => notification.id !== notificationId);
      return next;
    });
  };

  const createEncounter = (campaignId, nameOrEncounter) => {
    const encounter = createEncounterRecord(nameOrEncounter, { createId: () => createDomainId("encounter") });
    if (useFirestoreV2) {
      return encounterRepo.createEncounter(firestore, campaignId, encounter).then(() => encounter.id);
    }
    return updateCampaignLegacy(campaignId, (campaign) => {
      const result = createEncounterInCampaign(campaign, encounter, { createId: () => createDomainId("encounter") });
      return result.campaign;
    }).then(() => encounter.id);
  };

  const updateEncounter = (campaignId, encounterId, updater) => {
    if (useFirestoreV2) {
      return encounterRepo.updateEncounter(firestore, campaignId, encounterId, (encounter) =>
        applyEncounterUpdate({ ...encounter, id: encounter.id || encounterId }, updater)
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => updateEncounterInCampaign(campaign, encounterId, updater));
  };

  const softDeleteEncounter = (campaignId, encounterId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return encounterRepo.updateEncounter(firestore, campaignId, encounterId, (encounter) =>
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
      return encounterRepo.updateEncounter(firestore, campaignId, encounterId, (encounter) =>
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
      return encounterRepo.updateEncounters(firestore, campaignId, encounterIds, (encountersById) =>
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
      return encounterRepo.updateEncounter(firestore, campaignId, encounterId, (encounter) =>
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
      return encounterRepo.updateEncounter(firestore, campaignId, encounterId, (encounter) =>
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
      return mapRepo.createMap(firestore, campaignId, map).then(() => map.id);
    }
    return updateCampaignLegacy(campaignId, (campaign) =>
      upsertMapInCampaign(campaign, map, { createId: () => createDomainId("map") })
    ).then(() => map.id);
  };

  const updateMap = (campaignId, mapId, updater) => {
    if (useFirestoreV2) {
      return mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
        updateMapInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, updater).maps[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => updateMapInCampaign(campaign, mapId, updater));
  };

  const softDeleteMap = (campaignId, mapId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
        softDeleteMapInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, options).maps[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => softDeleteMapInCampaign(campaign, mapId, options));
  };

  const restoreMap = (campaignId, mapId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
        restoreMapInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, options).maps[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => restoreMapInCampaign(campaign, mapId, options));
  };

  const reorderMaps = (campaignId, orderedIds) => {
    if (useFirestoreV2) {
      return mapRepo.updateMaps(firestore, campaignId, orderedIds, (mapsById) => {
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
      return mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
        setMapImageUrlInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, imageUrl).maps[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => setMapImageUrlInCampaign(campaign, mapId, imageUrl));
  };

  const upsertPin = (campaignId, mapId, pin) => {
    const options = { createId: () => createDomainId("pin") };
    if (useFirestoreV2) {
      return mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
        upsertMapPinInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, pin, options).maps[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => upsertMapPinInCampaign(campaign, mapId, pin, options));
  };

  const deletePin = (campaignId, mapId, pinId) => {
    if (useFirestoreV2) {
      return mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
        deleteMapPinInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, pinId).maps[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => deleteMapPinInCampaign(campaign, mapId, pinId));
  };

  const setScale = (campaignId, mapId, scale) => {
    if (useFirestoreV2) {
      return mapRepo.updateMap(firestore, campaignId, mapId, (map) =>
        setMapScaleInCampaign({ maps: [{ ...map, id: map.id || mapId }] }, mapId, scale).maps[0]
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => setMapScaleInCampaign(campaign, mapId, scale));
  };

  const updateProgress = (campaignId, patchOrUpdater) => {
    if (useFirestoreV2) {
      return campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(updateProgressInCampaign({ ...campaign, id: campaign.id || campaignId }, patchOrUpdater))
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => updateProgressInCampaign(campaign, patchOrUpdater));
  };

  const softDeleteProgressEntry = (campaignId, section, entryId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
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
      return campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
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
      return campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(updateCampingInCampaign({ ...campaign, id: campaign.id || campaignId }, patchOrUpdater))
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => updateCampingInCampaign(campaign, patchOrUpdater));
  };

  const upsertCampingActivity = (campaignId, activity) => {
    const options = { createId: () => createDomainId("camping_activity") };
    if (useFirestoreV2) {
      return campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
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
      return campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
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
      return campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(
          restoreCampingActivityInCampaign({ ...campaign, id: campaign.id || campaignId }, activityId, options)
        )
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => restoreCampingActivityInCampaign(campaign, activityId, options));
  };

  const resetDefaultCampingActivity = (campaignId, activityId) => {
    if (useFirestoreV2) {
      return campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(resetDefaultCampingActivityInCampaign({ ...campaign, id: campaign.id || campaignId }, activityId))
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => resetDefaultCampingActivityInCampaign(campaign, activityId));
  };

  const assignCampingActivity = (campaignId, activityId, character) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
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
      return campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
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
      return campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        stripChildCollections(
          unassignCampingActivityInCampaign({ ...campaign, id: campaign.id || campaignId }, activityId, character)
        )
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) =>
      unassignCampingActivityInCampaign(campaign, activityId, character)
    );
  };

  const createCampaign = (name) => {
    const campaignId = `campaign_${Date.now()}`;
    const campaign = createCampaignRecord(name, { id: campaignId, now: Date.now() });

    if (useFirestoreV2) {
      const writes = [campaignRepo.createCampaign(firestore, campaign)];
      if (actor) {
        writes.push(memberRepo.assignUser(firestore, campaignId, actor, {
          role: "gm",
          characterId: null,
        }));
      }
      return Promise.all(writes).then(() => campaignId);
    }

    return updateDbLegacy((prev) => {
      let next = createCampaignInDb(prev, campaign, { campaignId });
      if (actor) next = assignUserInDb(next, actor, campaignId, null, "gm");
      return next;
    }).then(() => campaignId);
  };

  const updateCampaign = (campaignId, updater) => {
    if (useFirestoreV2) {
      return campaignRepo.updateCampaign(firestore, campaignId, (campaign) =>
        applyCampaignUpdate({ ...campaign, id: campaign.id || campaignId }, updater)
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) => applyCampaignUpdate(campaign, updater));
  };

  const softDeleteCampaign = (campaignId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return campaignRepo.updateCampaign(firestore, campaignId, (campaign) => markDeleted(campaign, options));
    }
    return updateDbLegacy((prev) => softDeleteCampaignInDb(prev, campaignId, options));
  };

  const restoreCampaign = (campaignId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return campaignRepo.updateCampaign(firestore, campaignId, (campaign) => markRestored(campaign, options));
    }
    return updateDbLegacy((prev) => restoreCampaignInDb(prev, campaignId, options));
  };

  const setPartyXp = (campaignId, xp) => {
    const campaign = db?.campaigns?.[campaignId];
    const activeCharacterIds = (campaign?.characters || [])
      .filter((character) => !character.deletedAt)
      .map((character) => character.id)
      .filter(Boolean);

    if (useFirestoreV2) {
      return campaignRepo.updateCampaignAndCharacters(
        firestore,
        campaignId,
        activeCharacterIds,
        (campaignDoc, charactersById) => {
          const current = {
            ...campaignDoc,
            id: campaignDoc.id || campaignId,
            characters: activeCharacterIds.map((characterId) => ({
              ...charactersById[characterId],
              id: charactersById[characterId]?.id || characterId,
            })),
          };
          const nextCampaign = setPartyXpInCampaign(current, xp);
          return {
            campaign: stripChildCollections(nextCampaign),
            charactersById: Object.fromEntries(
              nextCampaign.characters.map((character) => [character.id, character])
            ),
          };
        }
      );
    }

    return updateCampaignLegacy(campaignId, (campaignState) => setPartyXpInCampaign(campaignState, xp));
  };

  const addPartyXp = (campaignId, amount) => {
    const campaign = db?.campaigns?.[campaignId];
    const activeCharacterIds = (campaign?.characters || [])
      .filter((character) => !character.deletedAt)
      .map((character) => character.id)
      .filter(Boolean);
    const notificationId = Date.now();

    if (useFirestoreV2) {
      return campaignRepo.updateCampaignAndCharacters(
        firestore,
        campaignId,
        activeCharacterIds,
        (campaignDoc, charactersById) => {
          const current = {
            ...campaignDoc,
            id: campaignDoc.id || campaignId,
            characters: activeCharacterIds.map((characterId) => ({
              ...charactersById[characterId],
              id: charactersById[characterId]?.id || characterId,
            })),
          };
          const nextCampaign = addPartyXpInCampaign(current, amount, { notificationId });
          return {
            campaign: stripChildCollections(nextCampaign),
            charactersById: Object.fromEntries(
              nextCampaign.characters.map((character) => [character.id, character])
            ),
          };
        }
      );
    }

    return updateCampaignLegacy(campaignId, (campaignState) =>
      addPartyXpInCampaign(campaignState, amount, { notificationId })
    );
  };

  const assignUser = (email, campaignId, characterId, role = "player") => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return Promise.resolve();
    if (useFirestoreV2) {
      return memberRepo.assignUser(firestore, campaignId, normalizedEmail, { role, characterId });
    }
    return updateDbLegacy((prev) => assignUserInDb(prev, normalizedEmail, campaignId, characterId, role));
  };

  const revokeUser = (email) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return Promise.resolve();
    const userInfo = db?.users?.[normalizedEmail] || db?.users?.[email];
    if (useFirestoreV2) {
      if (!userInfo?.campaignId) return Promise.resolve();
      return memberRepo.revokeUser(firestore, userInfo.campaignId, normalizedEmail);
    }
    return updateDbLegacy((prev) => revokeUserInDb(prev, normalizedEmail));
  };

  const createCharacter = (campaignId, character) => {
    const normalizedCharacter = createCharacterRecord(character, { createId });
    if (useFirestoreV2) {
      return characterRepo.createCharacter(firestore, campaignId, normalizedCharacter);
    }
    return updateCampaignLegacy(campaignId, (campaign) =>
      createCharacterInCampaign(campaign, normalizedCharacter, { createId })
    );
  };

  const softDeleteCharacter = (campaignId, characterId) => {
    const options = { now: nowIso(), actorEmail: actor };
    const affectedEmails = Object.entries(db?.users || {})
      .filter(([, info]) => info?.campaignId === campaignId && info?.characterId === characterId)
      .map(([email]) => normalizeEmail(email));

    if (useFirestoreV2) {
      return characterRepo.updateCharacterAndMembers(
        firestore,
        campaignId,
        characterId,
        affectedEmails,
        (character) => markDeleted(character, options),
        (member) => ({ ...member, characterId: null })
      );
    }

    return updateDbLegacy((prev) => softDeleteCharacterInDb(prev, campaignId, characterId, options));
  };

  const restoreCharacter = (campaignId, characterId) => {
    const options = { now: nowIso(), actorEmail: actor };
    if (useFirestoreV2) {
      return characterRepo.updateCharacter(firestore, campaignId, characterId, (character) =>
        markRestored(character, options)
      );
    }
    return updateCampaignLegacy(campaignId, (campaign) =>
      restoreCharacterInCampaign(campaign, characterId, options)
    );
  };

  const importLegacyCharacter = (campaignId, character, legacyIndex) => {
    const normalizedCharacter = createCharacterRecord(character, { createId });
    if (useFirestoreV2) {
      return characterRepo.createCharacter(firestore, campaignId, normalizedCharacter);
    }
    return updateDbLegacy((prev) =>
      importLegacyCharacterInDb(prev, campaignId, normalizedCharacter, legacyIndex, { createId })
    );
  };

  return {
    mode: useFirestoreV2 ? "firestore-v2" : "legacy",
    campaign: {
      createCampaign,
      softDeleteCampaign,
      restoreCampaign,
      updateCampaign,
      setPartyXp,
      addPartyXp,
      clearNotification,
    },
    member: {
      assignUser,
      revokeUser,
    },
    character: {
      updateCharacter,
      createCharacter,
      softDeleteCharacter,
      restoreCharacter,
      importLegacyCharacter,
    },
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
          return characterRepo.updateCharacters(
            firestore,
            campaignId,
            [fromCharacterId, toCharacterId],
            (charactersById) => {
              const nextCampaign = transferInventoryItem(
                {
                  id: campaignId,
                  characters: [
                    { ...charactersById[fromCharacterId], id: charactersById[fromCharacterId]?.id || fromCharacterId },
                    { ...charactersById[toCharacterId], id: charactersById[toCharacterId]?.id || toCharacterId },
                  ],
                },
                fromCharacterId,
                toCharacterId,
                item,
                qty,
                { createId }
              );
              return Object.fromEntries(nextCampaign.characters.map((character) => [character.id, character]));
            }
          );
        }

        return updateCampaignLegacy(campaignId, (campaign) =>
          transferInventoryItem(campaign, fromCharacterId, toCharacterId, item, qty, { createId })
        );
      },
    },
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
  };
}

function hasFirestoreConfig(firestore) {
  return Boolean(firestore?.app?.options?.projectId);
}

function stripChildCollections(campaign) {
  const next = { ...campaign };
  delete next.characters;
  delete next.archivedCharacters;
  delete next.quests;
  delete next.archivedQuests;
  delete next.lootBags;
  delete next.encounters;
  delete next.archivedEncounters;
  delete next.maps;
  return next;
}
