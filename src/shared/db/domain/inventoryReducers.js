export function cloneValue(value) {
  if (value === undefined || value === null) return value;
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function createInstanceId(prefix = "item") {
  const randomId =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${randomId}`;
}

export function ensureInventoryItemIdentity(item, options = {}) {
  const { createId = () => createInstanceId("item") } = options;
  const next = cloneValue(item) || {};
  if (!next.instanceId) {
    next.instanceId = createId(next);
  }
  return next;
}

export function normalizeInventoryItems(items = [], options = {}) {
  return items.map((item) => ensureInventoryItemIdentity(item, options));
}

export function normalizeCharacterInventory(character, options = {}) {
  const next = cloneValue(character) || {};
  next.inventory = normalizeInventoryItems(next.inventory || [], options);
  return next;
}

export function applyCharacterUpdate(character, updater, options = {}) {
  const current = normalizeCharacterInventory(character, options);
  const result = typeof updater === "function" ? updater(current) : { ...current, ...updater };
  return normalizeCharacterInventory(result || current, options);
}

export function findInventoryItemIndex(inventory = [], target = {}) {
  if (!target) return -1;

  if (Number.isInteger(target._index)) {
    const candidate = inventory[target._index];
    if (candidate && legacyInventoryMatch(candidate, target)) {
      return target._index;
    }
  }

  if (target.instanceId) {
    const byInstanceId = inventory.findIndex((item) => item.instanceId === target.instanceId);
    if (byInstanceId >= 0) return byInstanceId;
  }

  if (target.id) {
    const byId = inventory.findIndex(
      (item) => item.instanceId === target.id || item.id === target.id
    );
    if (byId >= 0) return byId;
  }

  return inventory.findIndex((item) => legacyInventoryMatch(item, target));
}

export function addItemToCharacter(character, item, options = {}) {
  const {
    qty = item?.qty ?? 1,
    createId = () => createInstanceId("item"),
    stack = true,
  } = options;
  const next = normalizeCharacterInventory(character, { createId });
  const itemToAdd = ensureInventoryItemIdentity(
    { ...cloneValue(item), qty: Math.max(1, Number(qty) || 1) },
    { createId }
  );
  delete itemToAdd._index;

  if (stack && shouldStackItem(itemToAdd)) {
    const existing = next.inventory.find(
      (candidate) =>
        shouldStackItem(candidate) &&
        candidate.name === itemToAdd.name &&
        !candidate.equipped &&
        !candidate.prepared
    );
    if (existing) {
      existing.qty = (Number(existing.qty) || 1) + (Number(itemToAdd.qty) || 1);
      return next;
    }
  }

  next.inventory.push(itemToAdd);
  return next;
}

export function setInventoryItemQuantity(character, target, qty, options = {}) {
  const { createId = () => createInstanceId("item") } = options;
  const next = normalizeCharacterInventory(character, { createId });
  const index = findInventoryItemIndex(next.inventory, target);
  if (index < 0) return next;

  const nextQty = Number(qty);
  if (!Number.isFinite(nextQty) || nextQty <= 0) {
    next.inventory.splice(index, 1);
    return next;
  }

  next.inventory[index].qty = Math.floor(nextQty);
  return next;
}

export function removeInventoryItem(character, target, options = {}) {
  return setInventoryItemQuantity(character, target, 0, options);
}

export function transferInventoryItem(campaign, fromCharacterId, toCharacterId, target, qty, options = {}) {
  const { createId = () => createInstanceId("item") } = options;
  const next = cloneValue(campaign) || {};
  next.characters = Array.isArray(next.characters) ? next.characters.map((char) => cloneValue(char)) : [];

  const fromIndex = next.characters.findIndex((char) => char.id === fromCharacterId);
  const toIndex = next.characters.findIndex((char) => char.id === toCharacterId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
    throw new Error("Invalid transfer characters.");
  }

  const sender = normalizeCharacterInventory(next.characters[fromIndex], { createId });
  const recipient = normalizeCharacterInventory(next.characters[toIndex], { createId });
  const itemIndex = findInventoryItemIndex(sender.inventory, target);
  if (itemIndex < 0) {
    throw new Error("Transfer item was not found.");
  }

  const sourceItem = sender.inventory[itemIndex];
  const sourceQty = Number(sourceItem.qty) || 1;
  const transferQty = Math.max(1, Math.min(Number(qty) || 1, sourceQty));
  const movedItem = {
    ...cloneValue(sourceItem),
    qty: transferQty,
    instanceId: createId(sourceItem),
  };

  if (sourceQty > transferQty) {
    sourceItem.qty = sourceQty - transferQty;
  } else {
    sender.inventory.splice(itemIndex, 1);
  }

  next.characters[fromIndex] = sender;
  next.characters[toIndex] = addItemToCharacter(recipient, movedItem, {
    qty: transferQty,
    createId,
  });
  return next;
}

function legacyInventoryMatch(candidate = {}, target = {}) {
  return (
    candidate.name === target.name &&
    (candidate.equipped || false) === (target.equipped || false) &&
    (candidate.prepared || false) === (target.prepared || false) &&
    (candidate.addedAt || null) === (target.addedAt || null)
  );
}

function shouldStackItem(item = {}) {
  const type = String(item.type || "").toLowerCase();
  const traits = [
    ...(item.traits?.value || []),
    ...(item.system?.traits?.value || []),
  ];

  if (traits.includes("bomb")) return true;
  if (type === "ammunition") return true;
  if (item.name && /Arrow|Bolt|Dart/.test(item.name)) return true;
  if (["consumable", "potion", "scroll", "oil"].includes(type)) return true;
  if (["weapon", "armor", "shield"].includes(type)) return false;
  return true;
}
