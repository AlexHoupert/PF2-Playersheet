import { createCatalogOverrideRecord } from "./actorReducers.js";
import { cloneValue } from "./inventoryReducers.js";
import { selectDeviantAbility, selectDeviantAbilityList } from "../selectors/abilitySelectors.js";
import { selectPact, selectPactAbilityOptions } from "../selectors/pactSelectors.js";
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

export function createGlobalContentActions(actionContext) {
  const { actor, createDomainId, db, firestore, nowIso, repos, updateDbLegacy, updatePcActorAsCharacter, useFirestoreV2 } = actionContext;

  const updateGlobalConfig = (updater) => {
    if (useFirestoreV2) {
      return repos.globalRepo.updateGlobalConfig(firestore, updater);
    }
    return updateDbLegacy(updater);
  };

  const saveCustomItem = (item) => {
    if (useFirestoreV2) {
      return repos.catalogOverrideRepo.setCatalogOverride(
        firestore,
        createCatalogOverrideRecord({
          id: buildCatalogOverrideId("item", item),
          catalogType: "item",
          mode: "custom",
          label: item?.name,
          payload: item,
        })
      );
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
      return repos.catalogOverrideRepo.setCatalogOverride(
        firestore,
        createCatalogOverrideRecord({
          id: buildCatalogOverrideId("action", action),
          catalogType: "action",
          mode: "custom",
          label: action?.name,
          payload: action,
        })
      );
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
      return repos.catalogOverrideRepo.setCatalogOverride(
        firestore,
        createCatalogOverrideRecord({
          id: buildCatalogOverrideId("ability", ability),
          catalogType: "ability",
          mode: "custom",
          label: ability?.name,
          payload: ability,
        })
      );
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
  const saveDeviantAbility = (ability) => updateGlobalConfig((current) => saveDeviantAbilityInDb(current, ability));
  const deleteDeviantAbility = (abilityOrId) =>
    updateGlobalConfig((current) => deleteDeviantAbilityInDb(current, abilityOrId));

  const offerPactToActors = (campaignId, actorIds, pactId) => {
    const pact = selectPact(db, pactId);
    if (!campaignId || !pact?.id) return Promise.reject(new Error("Cannot offer unknown pact."));
    const uniqueActorIds = [...new Set((Array.isArray(actorIds) ? actorIds : [actorIds]).filter(Boolean))];
    const offeredAt = nowIso();
    return Promise.all(uniqueActorIds.map((actorId) =>
      updatePcActorAsCharacter(campaignId, actorId, (character) => {
        if (!character || character.deletedAt || character.pact?.pactId || character.pactOffer?.status === "pending") {
          return character;
        }
        const next = cloneValue(character);
        next.pactOffer = {
          id: createDomainId("pact_offer"),
          pactId: pact.id,
          offeredAt,
          offeredBy: actor || null,
          status: "pending",
        };
        return next;
      })
    ));
  };

  const rejectPactOffer = (campaignId, actorId, offerId = null) =>
    updatePcActorAsCharacter(campaignId, actorId, (character) => {
      if (!character?.pactOffer || (offerId && character.pactOffer.id !== offerId)) return character;
      const next = cloneValue(character);
      delete next.pactOffer;
      return next;
    });

  const acceptPactOffer = (campaignId, actorId, offerId, abilityId) =>
    updatePcActorAsCharacter(campaignId, actorId, (character) => {
      const offer = character?.pactOffer;
      if (!offer || offer.status !== "pending" || (offerId && offer.id !== offerId)) {
        throw new Error("This pact offer is no longer available.");
      }
      if (character.pact?.pactId) {
        throw new Error("This character already has a pact.");
      }
      const pact = selectPact(db, offer.pactId);
      if (!pact) throw new Error("The offered pact no longer exists.");
      const ability = selectDeviantAbility(db, abilityId);
      const option = selectPactAbilityOptions({
        pact,
        abilities: selectDeviantAbilityList(db),
        characterLevel: character.level,
        currentChoices: {},
        slotIndex: 0,
      }).find((entry) => entry.ability.id === ability?.id);
      if (!option?.selectable) {
        throw new Error(option?.disabledReason || "This ability cannot be learned from this pact.");
      }
      const dedication = normalizePactDedication(pact);
      const next = cloneValue(character);
      next.pact = {
        pactId: pact.id,
        dedicationId: dedication?.id || null,
        dedicationName: dedication?.name || null,
        choices: { 0: ability.id },
        unlockedAwakenings: {},
        awakeningPoints: Number(next.pact?.awakeningPoints) || 0,
        acceptedAt: nowIso(),
        acceptedBy: actor || null,
      };
      delete next.pactOffer;
      return next;
    });

  const grantAwakeningPoints = (campaignId, actorId, amount) =>
    updatePcActorAsCharacter(campaignId, actorId, (character) => {
      if (!character?.pact?.pactId) return character;
      const next = cloneValue(character);
      const current = Number(next.pact.awakeningPoints) || 0;
      next.pact = {
        ...next.pact,
        awakeningPoints: Math.max(0, current + (Number(amount) || 0)),
      };
      return next;
    });

  const spendAwakeningPoint = (campaignId, actorId, abilityId, awakeningIndex) =>
    updatePcActorAsCharacter(campaignId, actorId, (character) => {
      if (!character?.pact?.pactId) throw new Error("This character has no pact.");
      const ability = selectDeviantAbility(db, abilityId);
      const level = Number(awakeningIndex) === 2 ? 2 : 1;
      if (!ability?.[`awakening${level}`]?.name) throw new Error("This awakening is not defined.");
      const learnedIds = new Set(Object.values(character.pact.choices || {}).filter(Boolean));
      if (!learnedIds.has(ability.id)) throw new Error("This ability has not been learned.");
      const points = Number(character.pact.awakeningPoints) || 0;
      if (points <= 0) throw new Error("No awakening points available.");
      const currentLevel = Number(character.pact.unlockedAwakenings?.[ability.id]) || 0;
      if (currentLevel >= level) throw new Error("This awakening is already unlocked.");
      const next = cloneValue(character);
      next.pact = {
        ...next.pact,
        awakeningPoints: points - 1,
        unlockedAwakenings: {
          ...(next.pact.unlockedAwakenings || {}),
          [ability.id]: level,
        },
      };
      return next;
    });

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

    return repos.globalRepo.updateLoreArticles(firestore, [sorted[currentIndex].id, sorted[targetIndex].id], (articlesById) => {
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
      return repos.catalogOverrideRepo.setCatalogOverride(
        firestore,
        createCatalogOverrideRecord({
          id: buildCatalogOverrideId("creature", creature),
          catalogType: "creature",
          mode: "custom",
          label: creature?.name,
          payload: creature,
        })
      );
    }
    return updateDbLegacy((prev) => saveCustomCreatureInDb(prev, creature));
  };

  const updateCustomCreature = (creatureId, updater) => {
    if (useFirestoreV2) {
      const current = findCustomCreatureById(db, creatureId) || { id: creatureId, _id: creatureId };
      const next = typeof updater === "function" ? updater(cloneValue(current)) : { ...cloneValue(current), ...updater };
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
      offerPactToActors,
      rejectPactOffer,
      acceptPactOffer,
      grantAwakeningPoints,
      spendAwakeningPoint,
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
  return (
    entries.find((creature) => String(creature?.id || creature?._id || creature?.name) === String(creatureId)) || null
  );
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

function normalizePactDedication(pact) {
  const dedication = pact?.dedication;
  if (!dedication) return null;
  if (typeof dedication === "string") {
    return { type: "feat", id: dedication, name: dedication };
  }
  return {
    type: dedication.type || "feat",
    id: dedication.id || dedication.name || null,
    name: dedication.name || dedication.id || null,
  };
}
