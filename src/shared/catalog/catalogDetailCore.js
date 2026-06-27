export const CATALOG_TYPES = ["action", "feat", "impulse", "item", "spell"];

export function inferCatalogEntityType(entity, modalMode = null) {
  if (entity?._entityType) return normalizeCatalogType(entity._entityType);
  if (modalMode === "spell" || modalMode === "feat" || modalMode === "impulse") return modalMode;
  if (entity?.type === "Impulse") return "impulse";
  if (entity?.type === "Spell" || entity?.rank != null) return "spell";
  if (entity?.type === "Feat") return "feat";
  if (entity?.type === "Action") return "action";
  return "item";
}

export function normalizeCatalogType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  if (normalized === "shop" || normalized === "equipment") return "item";
  if (normalized === "condition") return "condition";
  return CATALOG_TYPES.includes(normalized) ? normalized : "item";
}

export function resolveCatalogSourceFile(entity, modalMode = null, findIndexItemByType = () => null) {
  if (!entity) return null;
  if (entity.sourceFile || entity.overrideSourceFile) return entity.sourceFile || entity.overrideSourceFile;
  if (!entity.name) return null;
  const type = inferCatalogEntityType(entity, modalMode);
  return findIndexItemByType(type, entity.name)?.sourceFile || null;
}

export function shouldFetchCatalogDetail(entity, modalMode = null, findIndexItemByType = () => null) {
  if (!entity) return false;
  if (!resolveCatalogSourceFile(entity, modalMode, findIndexItemByType)) return false;
  if (!entity.description) return true;
  const type = inferCatalogEntityType(entity, modalMode);
  return type === "spell" || type === "feat" || type === "impulse";
}

export function resolveContentLink(type, name, findIndexItemByType = () => null) {
  const catalogType = normalizeCatalogType(type);
  if (!name || catalogType === "condition") {
    return {
      type: catalogType,
      name,
      sourceFile: null,
      modalMode: catalogType === "condition" ? "conditionInfo" : "item",
    };
  }
  const indexItem = findIndexItemByType(catalogType, name);
  return {
    type: catalogType,
    name,
    sourceFile: indexItem?.sourceFile || null,
    modalMode: "item",
  };
}
