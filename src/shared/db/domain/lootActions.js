import { cloneValue } from "./inventoryReducers.js";
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

export function createLootActions(actionContext) {
  const {
    actorDocToCharacter,
    characterToPcActorDoc,
    createId,
    db,
    firestore,
    getActivePcActorIds,
    repos,
    updateCampaignLegacy,
    useFirestoreV2,
  } = actionContext;

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
          const orderedCharacters = characterIds.map((characterId) =>
            actorDocToCharacter(actorsById[characterId], characterId)
          );
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

  return {
    createLootBag,
    updateLootBag,
    addItems(campaignId, lootBagId, items) {
      return updateLootBag(campaignId, lootBagId, (lootBag) => addItemsToLootBag(lootBag, items, { createId }));
    },
    removeItems(campaignId, lootBagId, items) {
      return updateLootBag(campaignId, lootBagId, (lootBag) => removeItemsFromLootBag(lootBag, items, { createId }));
    },
    setItemQuantity(campaignId, lootBagId, items, qty) {
      return updateLootBag(campaignId, lootBagId, (lootBag) => setLootItemQuantity(lootBag, items, qty, { createId }));
    },
    claimItem,
    claimGold,
    splitGold,
  };
}
