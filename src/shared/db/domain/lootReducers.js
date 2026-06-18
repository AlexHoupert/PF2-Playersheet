import {
  addItemToCharacter,
  cloneValue,
  createInstanceId,
  ensureInventoryItemIdentity,
} from "./inventoryReducers.js";

export function normalizeLootItems(items = [], options = {}) {
  const { createId = () => createInstanceId("loot") } = options;
  return items.map((item) => ensureInventoryItemIdentity(item, { createId }));
}

export function normalizeLootBag(lootBag, options = {}) {
  const next = cloneValue(lootBag) || {};
  next.items = normalizeLootItems(next.items || [], options);
  next.goldValue = Number(next.goldValue) || 0;
  return next;
}

export function applyLootBagUpdate(lootBag, updater, options = {}) {
  const current = normalizeLootBag(lootBag, options);
  const result = typeof updater === "function" ? updater(current) : { ...current, ...updater };
  return normalizeLootBag(result || current, options);
}

export function updateCampaignLootBag(campaign, lootBagId, updater, options = {}) {
  const next = cloneValue(campaign) || {};
  next.lootBags = Array.isArray(next.lootBags) ? next.lootBags.map((bag) => cloneValue(bag)) : [];
  const bagIndex = next.lootBags.findIndex((bag) => bag.id === lootBagId);
  if (bagIndex < 0) {
    throw new Error("Loot bag was not found.");
  }
  next.lootBags[bagIndex] = applyLootBagUpdate(next.lootBags[bagIndex], updater, options);
  return next;
}

export function addItemsToLootBag(lootBag, items, options = {}) {
  const { createId = () => createInstanceId("loot") } = options;
  const next = normalizeLootBag(lootBag, { createId });
  const incomingItems = Array.isArray(items) ? items : [items];

  incomingItems.forEach((item) => {
    const prepared = ensureInventoryItemIdentity(
      {
        ...cloneValue(item),
        qty: Math.max(1, Number(item?.qty) || 1),
      },
      { createId }
    );
    delete prepared._index;

    const existing = next.items.find(
      (candidate) => candidate.name === prepared.name && !candidate.claimedBy
    );
    if (existing) {
      existing.qty = (Number(existing.qty) || 1) + (Number(prepared.qty) || 1);
    } else {
      next.items.push(prepared);
    }
  });

  return next;
}

export function removeItemsFromLootBag(lootBag, items, options = {}) {
  const next = normalizeLootBag(lootBag, options);
  const removeKeys = new Set(
    (Array.isArray(items) ? items : [items]).map((item) => item?.instanceId || item?.id || item?.name)
  );
  next.items = next.items.filter((item) => {
    const keys = [item.instanceId, item.id, item.name].filter(Boolean);
    return !keys.some((key) => removeKeys.has(key));
  });
  return next;
}

export function setLootItemQuantity(lootBag, items, qty, options = {}) {
  const next = normalizeLootBag(lootBag, options);
  const targets = new Set(
    (Array.isArray(items) ? items : [items]).map((item) => item?.instanceId || item?.id || item?.name)
  );
  const nextQty = Math.max(0, Math.floor(Number(qty) || 0));

  next.items = next.items.flatMap((item) => {
    const matches =
      targets.has(item.instanceId) ||
      targets.has(item.id) ||
      targets.has(item.name);
    if (!matches) return [item];
    return nextQty > 0 ? [{ ...item, qty: nextQty }] : [];
  });

  return next;
}

export function claimLootItemState(lootBag, character, itemTarget, options = {}) {
  const {
    createId = () => createInstanceId("loot"),
    claimedBy = character?.id || character?.name || "",
  } = options;
  const nextLootBag = normalizeLootBag(lootBag, { createId });
  const nextCharacter = cloneValue(character) || {};
  const itemIndex = findLootItemIndex(nextLootBag.items, itemTarget);

  if (itemIndex < 0) {
    throw new Error("Loot item was not found.");
  }

  const lootItem = nextLootBag.items[itemIndex];
  if (lootItem.claimedBy && lootItem.claimedBy !== claimedBy) {
    throw new Error("Loot item is already claimed.");
  }

  if (!lootItem.claimedBy) {
    const availableQty = Number(lootItem.qty) || 1;
    const requestedQty = Math.max(1, Math.min(Number(itemTarget?.qty) || availableQty, availableQty));
    const claimedItem = {
      ...cloneValue(lootItem),
      qty: requestedQty,
      instanceId: createId(lootItem),
      claimedAt: Date.now(),
    };
    delete claimedItem.claimedBy;
    delete claimedItem.claimedAt;
    const updatedCharacter = addItemToCharacter(nextCharacter, claimedItem, {
      qty: claimedItem.qty,
      createId,
    });
    if (requestedQty < availableQty) {
      nextLootBag.items[itemIndex] = {
        ...lootItem,
        qty: availableQty - requestedQty,
      };
    } else {
      nextLootBag.items[itemIndex] = {
        ...lootItem,
        claimedBy,
        claimedAt: Date.now(),
      };
    }
    return { lootBag: nextLootBag, character: updatedCharacter };
  }

  return { lootBag: nextLootBag, character: nextCharacter };
}

export function claimLootGoldState(lootBag, character, amount, options = {}) {
  const nextLootBag = normalizeLootBag(lootBag, options);
  const nextCharacter = cloneValue(character) || {};
  const requestedAmount = Math.max(0, Number(amount) || 0);
  const claimedAmount = Math.min(requestedAmount, Number(nextLootBag.goldValue) || 0);

  nextLootBag.goldValue = Math.max(0, (Number(nextLootBag.goldValue) || 0) - claimedAmount);
  nextCharacter.gold = (Number(nextCharacter.gold) || 0) + claimedAmount;

  return { lootBag: nextLootBag, character: nextCharacter };
}

export function splitLootGoldState(lootBag, characters, options = {}) {
  const nextLootBag = normalizeLootBag(lootBag, options);
  const nextCharacters = (characters || []).map((char) => cloneValue(char));
  if (!nextCharacters.length) {
    return { lootBag: nextLootBag, characters: nextCharacters };
  }

  const totalGold = Math.max(0, Number(nextLootBag.goldValue) || 0);
  const share = Math.floor((totalGold / nextCharacters.length) * 100) / 100;
  nextLootBag.goldValue = 0;
  nextCharacters.forEach((character) => {
    character.gold = (Number(character.gold) || 0) + share;
  });

  return { lootBag: nextLootBag, characters: nextCharacters };
}

export function findLootItemIndex(items = [], target = {}) {
  if (!target) return -1;

  if (target.instanceId) {
    const byInstanceId = items.findIndex((item) => item.instanceId === target.instanceId);
    if (byInstanceId >= 0) return byInstanceId;
  }

  if (target.id) {
    const byId = items.findIndex((item) => item.instanceId === target.id || item.id === target.id);
    if (byId >= 0) return byId;
  }

  const unclaimedByName = items.findIndex((item) => item.name === target.name && !item.claimedBy);
  if (unclaimedByName >= 0) return unclaimedByName;

  return items.findIndex((item) => item.name === target.name);
}
