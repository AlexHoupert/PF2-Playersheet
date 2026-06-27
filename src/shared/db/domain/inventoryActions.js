import {
  addItemToCharacter,
  createInstanceId,
  findInventoryItemIndex,
  normalizeCharacterInventory,
  removeInventoryItem,
  setInventoryItemQuantity,
  transferInventoryItem,
} from "./inventoryReducers.js";

export function createInventoryActions(actionContext) {
  const {
    actorDocToCharacter,
    characterToPcActorDoc,
    createId = () => createInstanceId("item"),
    firestore,
    repos,
    updateCampaignLegacy,
    updateCharacter,
    useFirestoreV2,
  } = actionContext;

  return {
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
          typeof updater === "function" ? updater(next.inventory[index]) : { ...next.inventory[index], ...updater };
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
        return repos.actorRepo.updateActors(firestore, campaignId, [fromCharacterId, toCharacterId], (actorsById) => {
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
        });
      }

      return updateCampaignLegacy(campaignId, (campaign) =>
        transferInventoryItem(campaign, fromCharacterId, toCharacterId, item, qty, { createId })
      );
    },
  };
}
