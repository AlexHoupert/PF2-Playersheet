export function normalizeItemInstance(item, options = {}) {
  const { createId = () => null } = options;
  const next = { ...(item || {}) };
  if (!next.instanceId) {
    const id = createId(next);
    if (id) next.instanceId = id;
  }
  return next;
}

export function resolveInventoryItemIdentity(inventory = [], target = {}) {
  const index = findInventoryItemIndex(inventory, target);
  return {
    index,
    item: index >= 0 ? inventory[index] : null,
  };
}

export function findInventoryItemIndex(inventory = [], target = {}) {
  if (!Array.isArray(inventory) || !target) return -1;

  if (Number.isInteger(target._index)) {
    const candidate = inventory[target._index];
    if (candidate && legacyInventoryMatch(candidate, target)) return target._index;
  }

  if (target.instanceId) {
    const byInstanceId = inventory.findIndex(item => item.instanceId === target.instanceId);
    if (byInstanceId >= 0) return byInstanceId;
  }

  if (target.id) {
    const byId = inventory.findIndex(item => item.instanceId === target.id || item.id === target.id);
    if (byId >= 0) return byId;
  }

  return inventory.findIndex(item => legacyInventoryMatch(item, target));
}

export function resolveLootItemIdentity(items = [], target = {}) {
  const index = findLootItemIndex(items, target);
  return {
    index,
    item: index >= 0 ? items[index] : null,
  };
}

export function findLootItemIndex(items = [], target = {}) {
  if (!Array.isArray(items) || !target) return -1;

  if (target.instanceId) {
    const byInstanceId = items.findIndex(item => item.instanceId === target.instanceId);
    if (byInstanceId >= 0) return byInstanceId;
  }

  if (target.id) {
    const byId = items.findIndex(item => item.instanceId === target.id || item.id === target.id);
    if (byId >= 0) return byId;
  }

  const unclaimedByName = items.findIndex(item => item.name === target.name && !item.claimedBy);
  if (unclaimedByName >= 0) return unclaimedByName;

  return items.findIndex(item => item.name === target.name);
}

function legacyInventoryMatch(candidate = {}, target = {}) {
  return (
    candidate.name === target.name &&
    (candidate.equipped || false) === (target.equipped || false) &&
    (candidate.prepared || false) === (target.prepared || false) &&
    (candidate.addedAt || null) === (target.addedAt || null)
  );
}
