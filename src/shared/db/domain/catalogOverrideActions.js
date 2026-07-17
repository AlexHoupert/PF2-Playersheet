import { createCatalogOverrideRecord } from "./actorReducers.js";
import { cloneValue } from "./inventoryReducers.js";
import { assertCatalogEffectDefinitions } from "../../rules/catalogEffectDefinitions.js";

export function createCatalogOverrideActions(context) {
  const {
    createDomainId,
    firestore,
    repos,
    updateDbLegacy,
    useFirestoreV2,
  } = context;

  const saveCatalogOverride = (overrideInput) => {
    assertCatalogEffectDefinitions(overrideInput?.payload || overrideInput);
    const override = createCatalogOverrideRecord(overrideInput, {
      createId: () => createDomainId("catalog_override"),
    });
    if (useFirestoreV2) {
      return repos.catalogOverrideRepo.setCatalogOverride(firestore, override).then(() => override.id);
    }
    return updateDbLegacy((prev) => {
      const next = cloneValue(prev) || {};
      next.catalogOverrides = { ...(next.catalogOverrides || {}), [override.id]: override };
      return next;
    }).then(() => override.id);
  };

  const deleteCatalogOverride = (overrideId) => {
    if (useFirestoreV2) {
      return repos.catalogOverrideRepo.deleteCatalogOverride(firestore, overrideId);
    }
    return updateDbLegacy((prev) => {
      const next = cloneValue(prev) || {};
      next.catalogOverrides = { ...(next.catalogOverrides || {}) };
      delete next.catalogOverrides[overrideId];
      return next;
    });
  };

  return {
    saveCatalogOverride,
    deleteCatalogOverride,
  };
}
