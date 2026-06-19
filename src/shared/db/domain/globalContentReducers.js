import { cloneValue } from "./inventoryReducers.js";

export function saveCustomItemInDb(db, item) {
  if (!item?.name) return db;
  const next = ensureRoot(db);
  next.shop.customItems[item.name] = cleanUndefinedValues(item);
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
  next.actions[action.name] = cleanUndefinedValues(action);
  return next;
}

export function deleteCustomActionInDb(db, actionOrName) {
  const name = typeof actionOrName === "string" ? actionOrName : actionOrName?.name;
  if (!name) return db;
  const next = ensureRoot(db);
  delete next.actions[name];
  return next;
}

export function saveCustomAbilityInDb(db, ability) {
  const id = ability?.id || ability?.name;
  if (!id) return db;
  const next = ensureRoot(db);
  next.abilities.custom[id] = { ...ability, id, isCustom: true };
  return next;
}

export function deleteCustomAbilityInDb(db, abilityOrId) {
  const id = typeof abilityOrId === "string" ? abilityOrId : abilityOrId?.id || abilityOrId?.name;
  if (!id) return db;
  const next = ensureRoot(db);
  delete next.abilities.custom[id];
  return next;
}

export function saveDeviantAbilityInDb(db, ability) {
  const id = ability?.id || ability?.name;
  if (!id) return db;
  const next = ensureRoot(db);
  next.abilities.deviant[id] = { ...ability, id };
  return next;
}

export function deleteDeviantAbilityInDb(db, abilityOrId) {
  const id = typeof abilityOrId === "string" ? abilityOrId : abilityOrId?.id || abilityOrId?.name;
  if (!id) return db;
  const next = ensureRoot(db);
  delete next.abilities.deviant[id];
  return next;
}

export function savePactInDb(db, pact) {
  const id = pact?.id || pact?.name;
  if (!id) return db;
  const next = ensureRoot(db);
  next.pacts[id] = { ...pact, id };
  return next;
}

export function deletePactInDb(db, pactOrId) {
  const id = typeof pactOrId === "string" ? pactOrId : pactOrId?.id || pactOrId?.name;
  if (!id) return db;
  const next = ensureRoot(db);
  delete next.pacts[id];
  return next;
}

export function saveLoreArticleInDb(db, article) {
  if (!article?.id) return db;
  const next = ensureRoot(db);
  const normalized = normalizeLoreArticle(article);
  const index = next.lore.articles.findIndex((entry) => entry.id === normalized.id);
  if (index >= 0) next.lore.articles[index] = normalized;
  else next.lore.articles.push(normalized);
  return next;
}

export function deleteLoreArticleInDb(db, articleOrId) {
  const id = typeof articleOrId === "string" ? articleOrId : articleOrId?.id;
  if (!id) return db;
  const next = ensureRoot(db);
  next.lore.articles = next.lore.articles.filter((article) => article.id !== id);
  return next;
}

export function moveLoreArticleInDb(db, articleId, direction) {
  if (!articleId || !["up", "down"].includes(direction)) return db;
  const next = ensureRoot(db);
  const articles = next.lore.articles;
  const current = articles.find((article) => article.id === articleId);
  if (!current) return next;
  const category = String(current.category || "").toLowerCase();
  const sorted = articles
    .filter((article) => String(article.category || "").toLowerCase() === category)
    .sort(sortLoreArticles);
  const currentIndex = sorted.findIndex((article) => article.id === articleId);
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sorted.length) return next;
  const target = sorted[targetIndex];
  next.lore.articles = articles.map((article) => {
    if (article.id === current.id) return { ...article, sortOrder: targetIndex };
    if (article.id === target.id) return { ...article, sortOrder: currentIndex };
    return article;
  });
  return next;
}

export function clearRootNotificationInDb(db, notificationId) {
  const next = ensureRoot(db);
  if (!Array.isArray(next.notificationQueue)) return next;
  next.notificationQueue = next.notificationQueue.filter((notification) => notification.id !== notificationId);
  return next;
}

export function saveCustomCreatureInDb(db, creature) {
  const entry = normalizeCustomCreatureEntry(creature);
  if (!entry?.id) return db;
  const next = ensureRoot(db);
  next.bestiary.customCreatures[entry.id] = entry;
  return next;
}

export function updateCustomCreatureInDb(db, creatureId, updater) {
  if (!creatureId) return db;
  const next = ensureRoot(db);
  const current = next.bestiary.customCreatures[creatureId];
  if (!current) return next;
  const updated = typeof updater === "function" ? updater(current) : { ...current, ...updater };
  const entry = normalizeCustomCreatureEntry({ ...current, ...updated, id: updated?.id || creatureId });
  next.bestiary.customCreatures[entry.id] = entry;
  if (entry.id !== creatureId) delete next.bestiary.customCreatures[creatureId];
  return next;
}

export function deleteCreatureInDb(db, creatureId) {
  if (!creatureId) return db;
  const next = ensureRoot(db);
  delete next.bestiary.creatures[creatureId];
  delete next.bestiary.customCreatures[creatureId];
  return next;
}

export function updateCreatureMetadataInDb(db, creatureId, updater) {
  if (!creatureId) return db;
  const next = ensureRoot(db);
  const current = next.bestiary.creatures[creatureId] || { id: creatureId };
  next.bestiary.creatures[creatureId] =
    typeof updater === "function" ? updater(current) : { ...current, ...updater };
  if (!next.bestiary.creatures[creatureId].id) next.bestiary.creatures[creatureId].id = creatureId;
  return next;
}

export function initializeCreatureMetadataInDb(db, metadataEntries) {
  const next = ensureRoot(db);
  for (const entry of Array.isArray(metadataEntries) ? metadataEntries : []) {
    if (!entry?.id || next.bestiary.creatures[entry.id]) continue;
    next.bestiary.creatures[entry.id] = { ...entry };
  }
  return next;
}

export function updateBestiaryRevealStateInDb(db, creatureId, field, mode) {
  if (!creatureId || !field) return db;
  const next = ensureRoot(db);
  if (!next.bestiary.creatures[creatureId]) next.bestiary.creatures[creatureId] = { id: creatureId, revealState: {} };
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

function normalizeLoreArticle(article) {
  return {
    ...article,
    category: String(article.category || "history").toLowerCase(),
    tags: Array.isArray(article.tags) ? article.tags : [],
  };
}

function sortLoreArticles(a, b) {
  const orderA = a.sortOrder ?? 9999;
  const orderB = b.sortOrder ?? 9999;
  if (orderA !== orderB) return orderA - orderB;
  return String(a.title || "").localeCompare(String(b.title || ""));
}

function normalizeCustomCreatureEntry(creature) {
  if (!creature) return null;
  if (creature.data) {
    const data = creature.data;
    const id = creature.id || data._id || data.id;
    return {
      ...creature,
      id,
      type: creature.type || data.type || "npc",
      name: creature.name || data.name || id,
      data: {
        ...data,
        _id: data._id || id,
      },
    };
  }
  const id = creature._id || creature.id;
  return {
    id,
    type: creature.type || "npc",
    name: creature.name || id,
    data: {
      ...creature,
      _id: creature._id || id,
    },
  };
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
  if (!next.bestiary.customCreatures || typeof next.bestiary.customCreatures !== "object") next.bestiary.customCreatures = {};
  if (!next.abilities || typeof next.abilities !== "object") next.abilities = {};
  if (!next.abilities.custom || typeof next.abilities.custom !== "object") next.abilities.custom = {};
  if (!next.abilities.deviant || typeof next.abilities.deviant !== "object") next.abilities.deviant = {};
  if (!next.pacts || typeof next.pacts !== "object") next.pacts = {};
  if (!next.lore || typeof next.lore !== "object") next.lore = {};
  if (!Array.isArray(next.lore.articles)) next.lore.articles = [];
  if (!Array.isArray(next.notificationQueue)) next.notificationQueue = [];
  return next;
}

function cleanUndefinedValues(value) {
  if (Array.isArray(value)) {
    return value.map(cleanUndefinedValues).filter((entry) => entry !== undefined);
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (child === undefined) continue;
      const cleaned = cleanUndefinedValues(child);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  return value;
}
