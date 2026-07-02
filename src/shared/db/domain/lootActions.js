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

  const updateLegacyActorAndCharacter = (campaign, actorId, character) => {
    const actorIndex = (campaign.actors || []).findIndex((actor) => actor.id === actorId);
    if (actorIndex >= 0) {
      campaign.actors[actorIndex] = characterToPcActorDoc(campaign.actors[actorIndex], character, campaign.id, actorId);
    }
    const characterIndex = (campaign.characters || []).findIndex((char) => char.id === actorId);
    if (characterIndex >= 0) {
      campaign.characters[characterIndex] = character;
    }
  };

  const getLegacyCharacterForActor = (campaign, actorId) => {
    const actorDoc = (campaign.actors || []).find((actor) => actor.id === actorId);
    if (actorDoc) return actorDocToCharacter(actorDoc, actorId);
    return (campaign.characters || []).find((char) => char.id === actorId) || null;
  };

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
      return repos.lootRepo.createLootBag(firestore, campaignId, normalizedBag).then(() => normalizedBag.id);
    }

    return updateCampaignLegacy(campaignId, (campaign) => {
      const next = cloneValue(campaign);
      next.lootBags = Array.isArray(next.lootBags) ? [...next.lootBags, normalizedBag] : [normalizedBag];
      return next;
    }).then(() => normalizedBag.id);
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
      const character = getLegacyCharacterForActor(next, characterId);
      if (bagIndex < 0 || !character) return next;
      const result = claimLootItemState(next.lootBags[bagIndex], character, item, {
        createId,
        claimedBy: characterId,
      });
      next.lootBags[bagIndex] = result.lootBag;
      updateLegacyActorAndCharacter(next, characterId, result.character);
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
      const character = getLegacyCharacterForActor(next, characterId);
      if (bagIndex < 0 || !character) return next;
      const result = claimLootGoldState(next.lootBags[bagIndex], character, amount, {
        createId,
      });
      next.lootBags[bagIndex] = result.lootBag;
      updateLegacyActorAndCharacter(next, characterId, result.character);
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
      const characters = characterIds.length
        ? characterIds.map((characterId) => getLegacyCharacterForActor(next, characterId)).filter(Boolean)
        : next.characters || [];
      const result = splitLootGoldState(next.lootBags[bagIndex], characters, { createId });
      next.lootBags[bagIndex] = result.lootBag;
      result.characters.forEach((character) => updateLegacyActorAndCharacter(next, character.id, character));
      if (!characterIds.length) next.characters = result.characters;
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
