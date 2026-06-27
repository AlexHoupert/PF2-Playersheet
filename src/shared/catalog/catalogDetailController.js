import { getActionIndexItemByName, fetchActionDetailBySourceFile } from "./actionIndex.js";
import { getFeatIndexItemByName, fetchFeatDetailBySourceFile } from "./featIndex.js";
import { getImpulseIndexItemByName, fetchImpulseDetailBySourceFile } from "./impulseIndex.js";
import { getShopIndexItemByName, fetchShopItemDetailBySourceFile } from "./shopIndex.js";
import { getSpellIndexItemByName, fetchSpellDetailBySourceFile } from "./spellIndex.js";
import {
  inferCatalogEntityType as inferCatalogEntityTypeCore,
  normalizeCatalogType as normalizeCatalogTypeCore,
  resolveCatalogSourceFile as resolveCatalogSourceFileCore,
  resolveContentLink as resolveContentLinkCore,
  shouldFetchCatalogDetail as shouldFetchCatalogDetailCore,
} from "./catalogDetailCore.js";

const CATALOG_CONFIG = {
  action: {
    modalMode: "item",
    fetchDetail: fetchActionDetailBySourceFile,
    findIndexItem: getActionIndexItemByName,
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

export function resolveCatalogSourceFile(entity, modalMode = null) {
  return resolveCatalogSourceFileCore(entity, modalMode, findIndexItemByType);
}

export function shouldFetchCatalogDetail(entity, modalMode = null) {
  return shouldFetchCatalogDetailCore(entity, modalMode, findIndexItemByType);
}

export function resolveContentLink(type, name) {
  const resolved = resolveContentLinkCore(type, name, findIndexItemByType);
  const config = getCatalogDetailConfig(resolved.type);
  return {
    ...resolved,
    fetchDetail: resolved.sourceFile ? config.fetchDetail : null,
  };
}

export async function fetchCatalogDetail(type, sourceFile) {
  if (!sourceFile) return null;
  return getCatalogDetailConfig(type).fetchDetail(sourceFile);
}

function findIndexItemByType(type, name) {
  return getCatalogDetailConfig(type).findIndexItem(name);
}
