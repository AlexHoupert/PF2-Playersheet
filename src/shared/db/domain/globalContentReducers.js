import { cloneValue } from "./inventoryReducers.js";

export function saveCustomItemInDb(db, item) {
  if (!item?.name) return db;
  const next = ensureRoot(db);
  next.shop.customItems[item.name] = item;
  return next;
}

export function deleteCustomItemInDb(db, itemOrName) {
  const name = typeof itemOrName === "string" ? itemOrName : itemOrName?.name;
  if (!name) return db;
  const next = ensureRoot(db);
  delete next.shop.customItems[name];
  return next;
}

export function saveCustomActionInDb(db, action) {
  if (!action?.name) return db;
  const next = ensureRoot(db);
  next.actions[action.name] = action;
  return next;
}

export function deleteCustomActionInDb(db, actionOrName) {
  const name = typeof actionOrName === "string" ? actionOrName : actionOrName?.name;
  if (!name) return db;
  const next = ensureRoot(db);
  delete next.actions[name];
  return next;
}

export function updateBestiaryRevealStateInDb(db, creatureId, field, mode) {
  if (!creatureId || !field) return db;
  const next = ensureRoot(db);
  if (!next.bestiary.creatures[creatureId]) next.bestiary.creatures[creatureId] = { revealState: {} };
  next.bestiary.creatures[creatureId].revealState = {
    ...(next.bestiary.creatures[creatureId].revealState || {}),
    [field]: mode,
  };
  return next;
}

export function createTraderInDb(db, trader, options = {}) {
  const normalized = normalizeTrader(trader, options);
  if (!normalized.name) return db;
  const next = ensureRoot(db);
  next.shop.traders.push(normalized);
  return next;
}

export function updateTraderInDb(db, traderId, updater) {
  const next = ensureRoot(db);
  const index = next.shop.traders.findIndex((trader) => String(trader.id) === String(traderId));
  if (index < 0) return next;
  next.shop.traders[index] =
    typeof updater === "function"
      ? updater(next.shop.traders[index])
      : { ...next.shop.traders[index], ...updater };
  return next;
}

export function deleteTraderInDb(db, traderId) {
  const next = ensureRoot(db);
  next.shop.traders = next.shop.traders.filter((trader) => String(trader.id) !== String(traderId));
  return next;
}

export function setTraderHiddenInDb(db, traderId, hidden) {
  return updateTraderInDb(db, traderId, (trader) => ({ ...trader, hidden: Boolean(hidden) }));
}

export function addItemsToTraderInDb(db, traderId, items) {
  return updateTraderInDb(db, traderId, (trader) => {
    const inventory = Array.isArray(trader.inventory) ? [...trader.inventory] : [];
    for (const item of normalizeItems(items)) {
      if (!inventory.some((entry) => itemName(entry) === item.name)) inventory.push(item.name);
    }
    return { ...trader, inventory };
  });
}

export function removeItemsFromTraderInDb(db, traderId, items) {
  const itemNames = new Set(normalizeItems(items).map((item) => item.name).filter(Boolean));
  if (itemNames.size === 0) return db;
  return updateTraderInDb(db, traderId, (trader) => ({
    ...trader,
    inventory: (trader.inventory || []).filter((entry) => !itemNames.has(itemName(entry))),
  }));
}

export function setShopItemAvailableInDb(db, itemNameValue, available) {
  return updateShopList(db, "availableItems", itemNameValue, available);
}

export function setShopFormulaAvailableInDb(db, itemNameValue, available) {
  return updateShopList(db, "availableFormulas", itemNameValue, available);
}

function updateShopList(db, field, itemNameValue, available) {
  const name = itemName(itemNameValue);
  if (!name) return db;
  const next = ensureRoot(db);
  const values = new Set(Array.isArray(next.shop[field]) ? next.shop[field] : []);
  if (available) values.add(name);
  else values.delete(name);
  next.shop[field] = [...values];
  return next;
}

function normalizeTrader(trader, options = {}) {
  if (typeof trader === "string") {
    return {
      id: options.createId ? options.createId() : Date.now(),
      name: trader.trim(),
      inventory: [],
      category: options.category || "General",
    };
  }
  return {
    id: trader?.id ?? (options.createId ? options.createId() : Date.now()),
    name: String(trader?.name || "").trim(),
    inventory: Array.isArray(trader?.inventory) ? trader.inventory : [],
    category: trader?.category || "General",
    ...trader,
  };
}

function normalizeItems(items) {
  return (Array.isArray(items) ? items : [items]).filter(Boolean);
}

function itemName(item) {
  return typeof item === "string" ? item : item?.name;
}

function ensureRoot(db) {
  const next = cloneValue(db || {});
  if (!next.shop || typeof next.shop !== "object") next.shop = {};
  if (!Array.isArray(next.shop.availableItems)) next.shop.availableItems = [];
  if (!Array.isArray(next.shop.availableFormulas)) next.shop.availableFormulas = [];
  if (!Array.isArray(next.shop.traders)) next.shop.traders = [];
  if (!next.shop.customItems || typeof next.shop.customItems !== "object") next.shop.customItems = {};
  if (!next.actions || typeof next.actions !== "object") next.actions = {};
  if (!next.bestiary || typeof next.bestiary !== "object") next.bestiary = {};
  if (!next.bestiary.creatures || typeof next.bestiary.creatures !== "object") next.bestiary.creatures = {};
  return next;
}
