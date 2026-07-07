import { getActionIndexItemByName, fetchActionDetailBySourceFile } from "./actionIndex.js";
import { getAbilityByName } from "./abilityIndex.js";
import { getFeatIndexItemByName, fetchFeatDetailBySourceFile } from "./featIndex.js";
import { getImpulseIndexItemByName, fetchImpulseDetailBySourceFile } from "./impulseIndex.js";
import { getShopIndexItemByName, fetchShopItemDetailBySourceFile } from "./shopIndex.js";
import { getSpellIndexItemByName, fetchSpellDetailBySourceFile } from "./spellIndex.js";
import { getAllCreatures } from "./creatureIndex.js";
import { resolveCatalogLink, resolveCatalogReference } from "./catalogReferenceResolver.js";
import {
  inferCatalogEntityType as inferCatalogEntityTypeCore,
  normalizeCatalogType as normalizeCatalogTypeCore,
  resolveCatalogSourceFile as resolveCatalogSourceFileCore,
  resolveContentLink as resolveContentLinkCore,
  shouldFetchCatalogDetail as shouldFetchCatalogDetailCore,
} from "./catalogDetailCore.js";

const CATALOG_CONFIG = {
  ability: {
    modalMode: "item",
    fetchDetail: null,
    findIndexItem: getAbilityByName,
  },
  action: {
    modalMode: "item",
    fetchDetail: fetchActionDetailBySourceFile,
    findIndexItem: getActionIndexItemByName,
  },
  creature: {
    modalMode: "item",
    fetchDetail: null,
    findIndexItem: getCreatureIndexItemByName,
  },
  feat: {
    modalMode: "feat",
    fetchDetail: fetchFeatDetailBySourceFile,
    findIndexItem: getFeatIndexItemByName,
  },
  impulse: {
    modalMode: "impulse",
    fetchDetail: fetchImpulseDetailBySourceFile,
    findIndexItem: getImpulseIndexItemByName,
  },
  item: {
    modalMode: "item",
    fetchDetail: fetchShopItemDetailBySourceFile,
    findIndexItem: getShopIndexItemByName,
  },
  spell: {
    modalMode: "spell",
    fetchDetail: fetchSpellDetailBySourceFile,
    findIndexItem: getSpellIndexItemByName,
  },
};

export function inferCatalogEntityType(entity, modalMode = null) {
  return inferCatalogEntityTypeCore(entity, modalMode);
}

export function normalizeCatalogType(type) {
  return normalizeCatalogTypeCore(type);
}

export function getCatalogDetailConfig(type) {
  return CATALOG_CONFIG[normalizeCatalogType(type)] || CATALOG_CONFIG.item;
}

export function resolveCatalogSourceFile(entity, modalMode = null, source = null) {
  const resolved = source ? resolveCatalogReference(entity?.catalogRef || entity, source, {
    catalogType: inferCatalogEntityType(entity, modalMode),
  }) : null;
  return resolveCatalogSourceFileCore(resolved?.entry || entity, modalMode, findIndexItemByType);
}

export function shouldFetchCatalogDetail(entity, modalMode = null, source = null) {
  const resolved = source ? resolveCatalogReference(entity?.catalogRef || entity, source, {
    catalogType: inferCatalogEntityType(entity, modalMode),
  }) : null;
  if (resolved?.isDeleted) return false;
  return shouldFetchCatalogDetailCore(resolved?.entry || entity, modalMode, findIndexItemByType);
}

export function resolveContentLink(type, name, source = null) {
  const coreResolved = resolveContentLinkCore(type, name, findIndexItemByType);
  const catalogResolved = source && coreResolved.type !== "condition"
    ? resolveCatalogLink(coreResolved.type, name, source)
    : null;
  const effectiveType = catalogResolved?.catalogType || coreResolved.type;
  const config = getCatalogDetailConfig(effectiveType);
  const entry = catalogResolved?.entry || null;
  return {
    ...coreResolved,
    type: effectiveType,
    name: entry?.name || coreResolved.name,
    sourceFile: entry?.sourceFile || entry?.overrideSourceFile || coreResolved.sourceFile,
    entry,
    status: catalogResolved?.status || entry?.catalogEntryStatus || null,
    isDeleted: Boolean(catalogResolved?.isDeleted || entry?.isDeleted),
    fetchDetail: (entry?.sourceFile || entry?.overrideSourceFile || coreResolved.sourceFile) && config.fetchDetail ? config.fetchDetail : null,
  };
}

export async function fetchCatalogDetail(type, sourceFile) {
  if (!sourceFile) return null;
  return getCatalogDetailConfig(type).fetchDetail(sourceFile);
}

function findIndexItemByType(type, name) {
  return getCatalogDetailConfig(type).findIndexItem(name);
}

function getCreatureIndexItemByName(name) {
  if (!name) return null;
  const lowerName = String(name).toLowerCase();
  return getAllCreatures().find((creature) => creature.name === name || String(creature.name || '').toLowerCase() === lowerName) || null;
}
